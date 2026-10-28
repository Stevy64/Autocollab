from django.urls import path

from web import views

urlpatterns = [
    path("", views.index, name="index"),
    path("manifest.webmanifest", views.manifest, name="manifest"),
    path("sw.js", views.service_worker, name="service-worker"),
    path("sante/", views.sante, name="sante"),
    path("api/<path:reste>", views.proxy, name="proxy"),
]
