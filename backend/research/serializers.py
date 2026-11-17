from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from .models import Evaluation, Match, Proposal, Publication

User = get_user_model()


class KeywordListField(serializers.ListField):
    child = serializers.CharField(allow_blank=False, max_length=200)


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'is_staff']


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField(help_text='Username or email address')
    password = serializers.CharField(trim_whitespace=False)


class RegisterSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(trim_whitespace=False)

    def validate_email(self, value: str) -> str:
        value = value.lower()
        if User.objects.filter(email__iexact=value).exists() or User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError('An account with this email already exists.')
        return value

    def validate(self, attrs):
        validate_password(attrs['password'], user=User(username=attrs['email'], email=attrs['email']))
        return attrs

    def create(self, validated_data):
        return User.objects.create_user(
            username=validated_data['email'], email=validated_data['email'], password=validated_data['password']
        )


class ProposalSerializer(serializers.ModelSerializer):
    keywords = KeywordListField(required=False)
    user_id = serializers.PrimaryKeyRelatedField(source='user', read_only=True)

    class Meta:
        model = Proposal
        fields = [
            'id', 'title', 'author', 'author_email', 'institution', 'research_area', 'abstract',
            'document_url', 'status', 'funding_requested', 'publication_date', 'keywords',
            'user_id', 'created_at',
        ]
        read_only_fields = ['id', 'user_id', 'created_at']


class PublicationSerializer(serializers.ModelSerializer):
    keywords = KeywordListField(required=False)

    class Meta:
        model = Publication
        fields = [
            'id', 'title', 'authors', 'journal', 'research_area', 'abstract', 'document_url', 'doi',
            'publication_date', 'keywords', 'citation_count', 'created_at',
        ]
        read_only_fields = ['id', 'created_at']


class MatchSerializer(serializers.ModelSerializer):
    proposal_id = serializers.UUIDField(read_only=True)
    publication_id = serializers.UUIDField(read_only=True)
    proposal = ProposalSerializer(read_only=True)
    publication = PublicationSerializer(read_only=True)

    class Meta:
        model = Match
        fields = [
            'id', 'proposal_id', 'publication_id', 'match_score', 'matched_keywords', 'status',
            'reviewed_by', 'notes', 'created_at', 'proposal', 'publication',
        ]
        # Only the review fields can be changed through the API.
        read_only_fields = ['id', 'proposal_id', 'publication_id', 'match_score', 'matched_keywords', 'created_at']


class EvaluationSerializer(serializers.ModelSerializer):
    proposal_id = serializers.PrimaryKeyRelatedField(source='proposal', queryset=Proposal.objects.all())
    user_id = serializers.PrimaryKeyRelatedField(source='user', read_only=True)
    a_scores = serializers.ListField(child=serializers.IntegerField(min_value=0, max_value=10), required=False)
    b_scores = serializers.ListField(child=serializers.IntegerField(min_value=0, max_value=10), required=False)
    c_scores = serializers.ListField(child=serializers.IntegerField(min_value=0, max_value=10), required=False)

    class Meta:
        model = Evaluation
        fields = [
            'id', 'proposal_id', 'user_id', 'a_scores', 'b_scores', 'c_scores', 'scientific_capacity',
            'leadership', 'team_size', 'recommendation', 'evaluator_notes', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'user_id', 'created_at', 'updated_at']
        # Saving is an upsert on (proposal, user), handled in the view.
        validators = []
