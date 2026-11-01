from django.urls import path

from . import views

urlpatterns = [
    path("inscription/", views.inscription, name="inscription"),
    path("connexion/", views.connexion, name="connexion"),
    path("confirmer/", views.confirmer, name="confirmer"),
    path("renvoyer/", views.renvoyer, name="renvoyer"),
    path("mot-oublie/", views.mot_oublie, name="mot-oublie"),
    path("mot-nouveau/", views.mot_nouveau, name="mot-nouveau"),
    path("profil/", views.profil, name="profil"),
    path("moi/", views.moi, name="moi"),
    path("premium/", views.premium, name="premium"),
    path("listes/", views.listes, name="listes"),
    path("listes/<int:pk>/", views.liste_detail, name="liste-detail"),
    path("listes/<int:pk>/lieux/", views.ajouter_lieu, name="liste-lieu"),
    path("listes/<int:pk>/lieux/<slug:lieu_id>/", views.retirer_lieu, name="liste-lieu-retrait"),
]
