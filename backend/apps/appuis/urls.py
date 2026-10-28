from django.urls import path

from . import views

urlpatterns = [
    path("<int:pk>/appui/", views.appui, name="appui"),
    path("<int:pk>/degage/", views.degage, name="degage"),
]
