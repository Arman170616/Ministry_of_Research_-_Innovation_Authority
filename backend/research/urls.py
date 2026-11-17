from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register('proposals', views.ProposalViewSet, basename='proposal')
router.register('publications', views.PublicationViewSet, basename='publication')
router.register('matches', views.MatchViewSet, basename='match')
router.register('evaluations', views.EvaluationViewSet, basename='evaluation')

urlpatterns = [
    path('auth/login/', views.login, name='login'),
    path('auth/register/', views.register, name='register'),
    path('auth/logout/', views.logout, name='logout'),
    path('auth/me/', views.me, name='me'),
    path('', include(router.urls)),
]
