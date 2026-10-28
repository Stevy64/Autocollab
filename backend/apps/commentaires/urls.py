from django.urls import path

from . import views

urlpatterns = [
    path("<int:pk>/commentaires/", views.commentaire, name="commentaire"),
]
