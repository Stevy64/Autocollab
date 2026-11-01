from django.urls import include, path

from apps.pilotage.views import logo

from . import views

urlpatterns = [
    path("api/sante/", views.sante, name="sante"),
    path("api/logo/", logo, name="logo"),
    path("api/signalements/", include("apps.signalements.urls")),
    path("api/signalements/", include("apps.appuis.urls")),
    path("api/signalements/", include("apps.commentaires.urls")),
    path("api/lieux/", include("apps.lieux.urls")),
    path("api/carte/", include("apps.signalements.carte_urls")),
    path("api/comptes/", include("apps.comptes.urls")),
    path("api/admin/", include("apps.pilotage.urls")),
]
