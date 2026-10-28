from django.urls import path

from . import views

urlpatterns = [
    path("entree/", views.entree, name="admin-entree"),
    path("apercu/", views.apercu, name="admin-apercu"),
    path("signalements/", views.signalements, name="admin-signalements"),
    path("signalements/<int:pk>/retirer/", views.retirer, name="admin-retirer"),
    path("comptes/", views.comptes, name="admin-comptes"),
    path("comptes/<int:pk>/", views.compte_modifier, name="admin-compte"),
    path("reglages/", views.reglages, name="admin-reglages"),
]
