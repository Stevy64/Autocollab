from django.urls import path

from . import views

urlpatterns = [
    path("", views.index, name="index"),
    path("manifest.webmanifest", views.manifest, name="manifest"),
    path("sw.js", views.service_worker, name="service-worker"),
    path("api/lieux/", views.lieux, name="lieux"),
    path("api/signalements/", views.signalements, name="signalements"),
    path("api/signalements/<int:pk>/appui/", views.appui, name="appui"),
    path("api/signalements/<int:pk>/commentaires/", views.commentaire, name="commentaire"),
]
