"""Keyword-overlap matching between proposals and publications."""
from collections.abc import Iterable

from django.db import transaction

from .models import Match, Proposal, Publication

POINTS_PER_SHARED_KEYWORD = 20
MAX_SCORE = 100


def score(proposal_keywords: list[str], publication_keywords: list[str]) -> tuple[int, list[str]]:
    """Return (score 0-100, shared keywords). Comparison is exact, as before."""
    pub_set = set(publication_keywords or [])
    shared = [k for k in (proposal_keywords or []) if k in pub_set]
    return min(MAX_SCORE, len(shared) * POINTS_PER_SHARED_KEYWORD), shared


@transaction.atomic
def generate_matches(proposals: Iterable[Proposal], publications: Iterable[Publication] | None = None) -> int:
    """Create or update a Match for every proposal/publication pair that shares a keyword.

    Existing matches keep their review status and notes; only score and keywords are refreshed.
    Returns the number of matches created or updated.
    """
    publications = list(publications if publications is not None else Publication.objects.all())
    count = 0
    for proposal in proposals:
        for publication in publications:
            match_score, shared = score(proposal.keywords, publication.keywords)
            if not shared:
                continue
            Match.objects.update_or_create(
                proposal=proposal,
                publication=publication,
                defaults={'match_score': match_score, 'matched_keywords': shared, 'method': 'keyword', 'rationale': ''},
            )
            count += 1
    return count


@transaction.atomic
def save_ai_matches(proposal: Proposal, results: list[dict]) -> int:
    """Store Claude's matches for one proposal.

    Matches people have already reviewed are kept as they are apart from the refreshed score and reason.
    Pending matches that Claude no longer considers relevant are removed.
    """
    kept_ids = []
    for r in results:
        match, _ = Match.objects.update_or_create(
            proposal=proposal,
            publication=r['publication'],
            defaults={
                'match_score': r['score'],
                'matched_keywords': r['topics'],
                'rationale': r['reason'],
                'method': 'ai',
            },
        )
        kept_ids.append(match.id)
    Match.objects.filter(proposal=proposal, status=Match.Status.PENDING).exclude(id__in=kept_ids).delete()
    return len(kept_ids)
