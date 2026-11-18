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
    # Full text of the uploaded document, used by the AI evaluation.
    document_text = models.TextField(blank=True, default='')
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='proposals'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self) -> str:
        return self.title


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
    # What the AI said when it assessed the proposal: a reason per criterion, summary, strengths,
    # weaknesses and its own recommendation. Kept for the matching report; the scores above are final.
    ai_assessment = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['proposal', 'user'], name='unique_evaluation_per_user'),
        ]

    def __str__(self) -> str:
        return f'Evaluation of {self.proposal} by {self.user}'

    @property
    def score(self) -> int:
        """How well the proposal meets the criteria: all criterion scores as a percentage of the maximum."""
        scores = [*self.a_scores, *self.b_scores, *self.c_scores]
        return round(sum(scores) / (len(scores) * 10) * 100) if scores else 0
