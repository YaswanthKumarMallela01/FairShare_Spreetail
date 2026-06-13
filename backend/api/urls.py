"""
URL routing for the FairShare API.
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register(r"groups", views.GroupViewSet, basename="group")
router.register(r"expenses", views.ExpenseViewSet, basename="expense")
router.register(r"settlements", views.SettlementViewSet, basename="settlement")
router.register(r"import-reports", views.ImportReportViewSet, basename="importreport")

urlpatterns = [
    # Auth
    path("auth/register/", views.RegisterView.as_view(), name="register"),
    path("auth/login/", views.LoginView.as_view(), name="login"),
    path("auth/logout/", views.LogoutView.as_view(), name="logout"),
    path("auth/profile/", views.UserProfileView.as_view(), name="profile"),
    path("auth/demo/", views.DemoLoginView.as_view(), name="demo-login"),

    # Memberships (nested under groups)
    path(
        "groups/<int:group_pk>/memberships/",
        views.GroupMembershipViewSet.as_view({"get": "list", "post": "create"}),
        name="group-memberships-list",
    ),
    path(
        "groups/<int:group_pk>/memberships/<int:pk>/",
        views.GroupMembershipViewSet.as_view(
            {"get": "retrieve", "put": "update", "patch": "partial_update", "delete": "destroy"}
        ),
        name="group-memberships-detail",
    ),

    # Balance endpoints
    path(
        "groups/<int:group_pk>/balances/",
        views.BalanceSummaryView.as_view(),
        name="balance-summary",
    ),
    path(
        "groups/<int:group_pk>/balances/detail/",
        views.BalanceDetailView.as_view(),
        name="balance-detail",
    ),
    path(
        "groups/<int:group_pk>/timeline/",
        views.TimelineView.as_view(),
        name="timeline",
    ),
    path(
        "groups/<int:group_pk>/ai-advise/",
        views.AIAssistantView.as_view(),
        name="group-ai-advise",
    ),

    # CSV import
    path("import/", views.ImportCSVView.as_view(), name="import-csv"),

    # Router-registered routes
    path("", include(router.urls)),
]
