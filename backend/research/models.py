import uuid

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models


class Proposal(models.Model):
    class Status(models.TextChoices):
        PENDING = 'pending'
        UNDER_REVIEW = 'under_review'
        APPROVED = 'approved'
        REJECTED = 'rejected'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.TextField()
    author = models.TextField()
    author_email = models.TextField(null=True, blank=True)
    institution = models.TextField(null=True, blank=True)
    research_area = models.TextField(null=True, blank=True, db_index=True)
    abstract = models.TextField(null=True, blank=True)
    document_url = models.TextField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING, db_index=True)
    funding_requested = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True, default=0)
    publication_date = models.DateField(null=True, blank=True, db_index=True)
    keywords = models.JSONField(default=list, blank=True)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='proposals'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self) -> str:
        return self.title


class Publication(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.TextField()
    authors = models.TextField()
    journal = models.TextField(null=True, blank=True)
    research_area = models.TextField(null=True, blank=True, db_index=True)
    abstract = models.TextField(null=True, blank=True)
    document_url = models.TextField(null=True, blank=True)
    doi = models.TextField(null=True, blank=True)
    publication_date = models.DateField(null=True, blank=True, db_index=True)
    keywords = models.JSONField(default=list, blank=True)
    citation_count = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self) -> str:
        return self.title


class Match(models.Model):
    class Status(models.TextChoices):
        PENDING = 'pending'
        REVIEWED = 'reviewed'
        ACCEPTED = 'accepted'
        REJECTED = 'rejected'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    proposal = models.ForeignKey(Proposal, on_delete=models.CASCADE, related_name='matches')
    publication = models.ForeignKey(Publication, on_delete=models.CASCADE, related_name='matches')
    match_score = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    matched_keywords = models.JSONField(default=list, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    reviewed_by = models.TextField(null=True, blank=True)
    notes = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-match_score']
        constraints = [
            models.UniqueConstraint(fields=['proposal', 'publication'], name='unique_proposal_publication'),
        ]
        verbose_name_plural = 'matches'

    def __str__(self) -> str:
        return f'{self.proposal} ↔ {self.publication} ({self.match_score})'


class Evaluation(models.Model):
    class Recommendation(models.TextChoices):
        RECOMMEND = 'recommend'
        DO_NOT_FUND = 'do_not_fund'

    score_0_10 = [MinValueValidator(0), MaxValueValidator(10)]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    proposal = models.ForeignKey(Proposal, on_delete=models.CASCADE, related_name='evaluations')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='evaluations')
    a_scores = models.JSONField(default=list, blank=True)
    b_scores = models.JSONField(default=list, blank=True)
    c_scores = models.JSONField(default=list, blank=True)
    scientific_capacity = models.PositiveSmallIntegerField(default=5, validators=score_0_10)
    leadership = models.PositiveSmallIntegerField(default=5, validators=score_0_10)
    team_size = models.PositiveIntegerField(default=1)
    recommendation = models.CharField(max_length=20, choices=Recommendation.choices, null=True, blank=True)
    evaluator_notes = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['proposal', 'user'], name='unique_evaluation_per_user'),
        ]

    def __str__(self) -> str:
        return f'Evaluation of {self.proposal} by {self.user}'
