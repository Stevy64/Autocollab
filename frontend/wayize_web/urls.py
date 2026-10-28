from django.urls import path

from web import admin_vues, views

urlpatterns = [
    path("admin/connexion/", admin_vues.connexion, name="admin-connexion"),
    path("admin/sortie/", admin_vues.sortie, name="admin-sortie"),
    path("admin/", admin_vues.apercu, name="admin-apercu"),
    path("admin/signalements/", admin_vues.signalements, name="admin-signalements"),
    path("admin/signalements/<int:pk>/retirer/", admin_vues.retirer, name="admin-retirer"),
    path("admin/comptes/", admin_vues.comptes, name="admin-comptes"),
    path("admin/comptes/<int:pk>/", admin_vues.compte, name="admin-compte"),
    path("admin/reglages/", admin_vues.reglages, name="admin-reglages"),
    path("", views.index, name="index"),
    path("manifest.webmanifest", views.manifest, name="manifest"),
    path("sw.js", views.service_worker, name="service-worker"),
    path("sante/", views.sante, name="sante"),
    path("api/<path:reste>", views.proxy, name="proxy"),
]
