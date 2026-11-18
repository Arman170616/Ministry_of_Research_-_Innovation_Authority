from django.contrib import admin

from .models import Evaluation, Proposal


@admin.register(Proposal)
class ProposalAdmin(admin.ModelAdmin):
    list_display = ['title', 'author', 'research_area', 'status', 'funding_requested', 'user', 'created_at']
    list_filter = ['status', 'research_area']
    search_fields = ['title', 'author', 'abstract']


@admin.register(Evaluation)
class EvaluationAdmin(admin.ModelAdmin):
    list_display = ['proposal', 'user', 'recommendation', 'updated_at']
    list_filter = ['recommendation']
    raw_id_fields = ['proposal']
