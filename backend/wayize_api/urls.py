from django.urls import include, path

from . import views

urlpatterns = [
    path("api/sante/", views.sante, name="sante"),
    path("api/signalements/", include("apps.signalements.urls")),
    path("api/signalements/", include("apps.appuis.urls")),
    path("api/signalements/", include("apps.commentaires.urls")),
    path("api/lieux/", include("apps.lieux.urls")),
    path("api/carte/", include("apps.signalements.carte_urls")),
    path("api/comptes/", include("apps.comptes.urls")),
]
