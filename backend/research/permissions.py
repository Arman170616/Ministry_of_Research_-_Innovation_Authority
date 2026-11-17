from django.db.models import QuerySet


def proposals_for(user) -> QuerySet:
    """Staff see every proposal; other users see only the proposals they submitted."""
    from .models import Proposal

    qs = Proposal.objects.all()
    return qs if user.is_staff else qs.filter(user=user)
