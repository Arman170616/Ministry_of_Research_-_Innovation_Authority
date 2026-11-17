from django.contrib.auth import authenticate, get_user_model
from django.shortcuts import get_object_or_404
from rest_framework import mixins, status, viewsets
from rest_framework.authtoken.models import Token
from rest_framework.decorators import action, api_view, parser_classes, permission_classes, throttle_classes
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle, ScopedRateThrottle

from . import ai
from .matching import generate_matches, save_ai_matches
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

    def get_throttles(self):
        if self.action == 'generate':
            self.throttle_scope = 'ai'
            return [ScopedRateThrottle()]
        return super().get_throttles()

    @staticmethod
    def _match(proposals, language: str = 'en') -> tuple[int, str, str | None]:
        """Match proposals with Claude when available, otherwise by keyword overlap.

        Returns (number of matches, method used, warning to show or None).
        """
        proposals = list(proposals)
        if ai.is_enabled():
            try:
                publications = list(Publication.objects.all())
                count = sum(save_ai_matches(p, ai.match_publications(p, publications, language)) for p in proposals)
                return count, 'ai', None
            except ai.AIError as e:
                return generate_matches(proposals), 'keyword', f'AI matching failed ({e}) - used keyword matching instead.'
        return generate_matches(proposals), 'keyword', None

    @action(detail=False, methods=['post'])
    def generate(self, request):
        """Run matching.

        With {"proposal_id": ...}: match that one proposal and return its matches.
        Without: match every proposal the user can see and return {"count": n, "method": ..., "warning": ...}.
        """
        proposal_id = request.data.get('proposal_id')
        language = _language(request)
        if proposal_id:
            proposal = get_object_or_404(proposals_for(request.user), pk=proposal_id)
            _, method, warning = self._match([proposal], language)
            matches = self.get_queryset().filter(proposal=proposal)
            response = Response(self.get_serializer(matches, many=True).data)
            response['X-Match-Method'] = method
            if warning:
                response['X-Match-Warning'] = warning
            return response
        count, method, warning = self._match(proposals_for(request.user), language)
        return Response({'count': count, 'method': method, 'warning': warning})


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


# ── AI analysis ──────────────────────────────────────────────────────────────

def _language(request) -> str:
    """Language for AI-written text: 'ar' or 'en' (default)."""
    return 'ar' if request.data.get('language') == 'ar' else 'en'


class AIThrottle(ScopedRateThrottle):
    scope = 'ai'


def _ai_error(e: ai.AIError) -> Response:
    return Response({'detail': str(e)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)


@api_view(['GET'])
def ai_status(request):
    return Response({'enabled': ai.is_enabled(), 'model': ai.model() if ai.is_enabled() else None})


@api_view(['POST'])
@parser_classes([MultiPartParser])
@throttle_classes([AIThrottle])
def ai_extract(request):
    """Read an uploaded proposal document and return the form fields (nothing is saved)."""
    upload = request.FILES.get('file')
    if upload is None:
        return Response({'detail': 'Attach the document as "file".'}, status=status.HTTP_400_BAD_REQUEST)
    if upload.size > ai.MAX_DOCUMENT_BYTES:
        return Response({'detail': 'The file is larger than 15 MB.'}, status=status.HTTP_400_BAD_REQUEST)
    publication_keywords = [k for kws in Publication.objects.values_list('keywords', flat=True) for k in (kws or [])]
    try:
        return Response(ai.extract_proposal(upload.read(), upload.name, publication_keywords))
    except ai.AIError as e:
        return _ai_error(e)


@api_view(['POST'])
@throttle_classes([AIThrottle])
def ai_evaluate(request):
    """Suggest evaluation scores for a proposal (nothing is saved; the reviewer submits the final scores)."""
    proposal = get_object_or_404(proposals_for(request.user), pk=request.data.get('proposal_id'))
    matches = Match.objects.filter(proposal=proposal).select_related('publication').order_by('-match_score')[:10]
    try:
        return Response(ai.suggest_evaluation(proposal, matches, _language(request)))
    except ai.AIError as e:
        return _ai_error(e)
