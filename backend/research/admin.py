from django.contrib import admin

from .models import Evaluation, Match, Proposal, Publication


@admin.register(Proposal)
class ProposalAdmin(admin.ModelAdmin):
    list_display = ['title', 'author', 'research_area', 'status', 'funding_requested', 'user', 'created_at']
    list_filter = ['status', 'research_area']
    search_fields = ['title', 'author', 'abstract']


@admin.register(Publication)
class PublicationAdmin(admin.ModelAdmin):
    list_display = ['title', 'authors', 'journal', 'research_area', 'citation_count', 'publication_date']
    list_filter = ['research_area']
    search_fields = ['title', 'authors', 'abstract', 'doi']


@admin.register(Match)
class MatchAdmin(admin.ModelAdmin):
    list_display = ['proposal', 'publication', 'match_score', 'status', 'reviewed_by']
    list_filter = ['status']
    raw_id_fields = ['proposal', 'publication']


@admin.register(Evaluation)
class EvaluationAdmin(admin.ModelAdmin):
    list_display = ['proposal', 'user', 'recommendation', 'updated_at']
    list_filter = ['recommendation']
    raw_id_fields = ['proposal']
