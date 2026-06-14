"""
fairshare URL Configuration
"""

from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse

def health_check(request):
    return JsonResponse({"status": "ok", "message": "FairShare API is running"})

urlpatterns = [
    path("", health_check, name="health-check"),
    path("api/health/", health_check, name="api-health-check"),
    path("admin/", admin.site.urls),
    path("api/", include("api.urls")),
    path("api-auth/", include("rest_framework.urls")),  # browsable API login
]
