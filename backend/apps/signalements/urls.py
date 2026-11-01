from django.urls import path

from . import views

urlpatterns = [
    path("", views.signalements, name="signalements"),
    path("<int:pk>/position/", views.position, name="signalement-position"),
]
