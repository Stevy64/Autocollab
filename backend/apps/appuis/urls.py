from django.urls import path

from . import views

urlpatterns = [
    path("<int:pk>/appui/", views.appui, name="appui"),
]
