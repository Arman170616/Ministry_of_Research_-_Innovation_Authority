from django.contrib.auth import authenticate, get_user_model
from django.shortcuts import get_object_or_404
from rest_framework import mixins, status, viewsets
from rest_framework.authtoken.models import Token
from rest_framework.decorators import action, api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle

from .matching import generate_matches
from .models import Evaluation, Match, Publication
from .permissions import proposals_for
from .serializers import (
    EvaluationSerializer,
    LoginSerializer,
    MatchSerializer,
    ProposalSerializer,
    PublicationSerializer,
    RegisterSerializer,
    UserSerializer,
)

User = get_user_model()

# Usernames without "@" may also belong to an account registered as <username>@ria.gov.om.
DEFAULT_EMAIL_DOMAIN = 'ria.gov.om'


class AuthThrottle(AnonRateThrottle):
    rate = '20/min'


def _auth_response(user, http_status=status.HTTP_200_OK) -> Response:
    token, _ = Token.objects.get_or_create(user=user)
    return Response({'token': token.key, 'user': UserSerializer(user).data}, status=http_status)


def _find_username(identifier: str) -> str | None:
    """Map what the person typed (username or email) to an account's username."""
    identifier = identifier.strip()
    if User.objects.filter(username__iexact=identifier).exists():
        return User.objects.get(username__iexact=identifier).username
    email = identifier if '@' in identifier else f'{identifier}@{DEFAULT_EMAIL_DOMAIN}'
    user = User.objects.filter(email__iexact=email).first()
    return user.username if user else None


@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([AuthThrottle])
def login(request):
    data = LoginSerializer(data=request.data)
    data.is_valid(raise_exception=True)
    username = _find_username(data.validated_data['username'])
    user = authenticate(request, username=username, password=data.validated_data['password']) if username else None
    if user is None:
        return Response({'detail': 'Incorrect username or password.'}, status=status.HTTP_400_BAD_REQUEST)
    return _auth_response(user)


@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([AuthThrottle])
def register(request):
    serializer = RegisterSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    user = serializer.save()
    return _auth_response(user, status.HTTP_201_CREATED)


@api_view(['POST'])
def logout(request):
    Token.objects.filter(user=request.user).delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(['GET'])
def me(request):
    return Response(UserSerializer(request.user).data)


class ProposalViewSet(viewsets.ModelViewSet):
    serializer_class = ProposalSerializer

    def get_queryset(self):
        return proposals_for(self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class PublicationViewSet(viewsets.ModelViewSet):
    """Publications are a shared library for all signed-in staff."""

    queryset = Publication.objects.all()
    serializer_class = PublicationSerializer


class MatchViewSet(
    mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.UpdateModelMixin, viewsets.GenericViewSet
):
    """Matches are created by the matching engine; people can only review them."""

    serializer_class = MatchSerializer

    def get_queryset(self):
        qs = Match.objects.select_related('proposal', 'publication').filter(
            proposal__in=proposals_for(self.request.user)
        )
        proposal_id = self.request.query_params.get('proposal_id')
        if proposal_id:
            qs = qs.filter(proposal_id=proposal_id)
        return qs.order_by('-match_score', '-created_at')

    @action(detail=False, methods=['post'])
    def generate(self, request):
        """Run keyword matching.

        With {"proposal_id": ...}: match that one proposal and return its matches.
        Without: match every proposal the user can see and return {"count": n}.
        """
        proposal_id = request.data.get('proposal_id')
        if proposal_id:
            proposal = get_object_or_404(proposals_for(request.user), pk=proposal_id)
            generate_matches([proposal])
            matches = self.get_queryset().filter(proposal=proposal)
            return Response(self.get_serializer(matches, many=True).data)
        count = generate_matches(proposals_for(request.user))
        return Response({'count': count})


class EvaluationViewSet(mixins.ListModelMixin, mixins.CreateModelMixin, viewsets.GenericViewSet):
    """Each reviewer has one evaluation per proposal. POST creates or updates it."""

    serializer_class = EvaluationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Evaluation.objects.filter(user=self.request.user)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        proposal = serializer.validated_data.pop('proposal')
        if not proposals_for(request.user).filter(pk=proposal.pk).exists():
            return Response({'detail': 'Proposal not found.'}, status=status.HTTP_404_NOT_FOUND)
        evaluation, created = Evaluation.objects.update_or_create(
            proposal=proposal, user=request.user, defaults=serializer.validated_data
        )
        return Response(
            self.get_serializer(evaluation).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )
