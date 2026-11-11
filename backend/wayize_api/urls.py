from django.urls import include, path

from apps.pilotage.views import logo
from apps.signalements.notif_views import abonnement as push_abonnement
from apps.signalements.notif_views import etat as push_etat

from . import views

urlpatterns = [
    path("api/sante/", views.sante, name="sante"),
    path("api/logo/", logo, name="logo"),
    path("api/notifications/etat/", push_etat, name="push-etat"),
    path("api/notifications/abonnement/", push_abonnement, name="push-abonnement"),
    path("api/signalements/", include("apps.signalements.urls")),
    path("api/signalements/", include("apps.appuis.urls")),
    path("api/signalements/", include("apps.commentaires.urls")),
    path("api/lieux/", include("apps.lieux.urls")),
    path("api/carte/", include("apps.signalements.carte_urls")),
    path("api/comptes/", include("apps.comptes.urls")),
    path("api/admin/", include("apps.pilotage.urls")),
]
