from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register('proposals', views.ProposalViewSet, basename='proposal')
router.register('evaluations', views.EvaluationViewSet, basename='evaluation')

urlpatterns = [
    path('auth/login/', views.login, name='login'),
    path('auth/register/', views.register, name='register'),
    path('auth/logout/', views.logout, name='logout'),
    path('auth/me/', views.me, name='me'),
    path('ai/status/', views.ai_status, name='ai-status'),
    path('ai/extract/', views.ai_extract, name='ai-extract'),
    path('ai/evaluate/', views.ai_evaluate, name='ai-evaluate'),
    path('', include(router.urls)),
]
