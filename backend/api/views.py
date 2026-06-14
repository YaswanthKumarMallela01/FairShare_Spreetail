"""
FairShare API views.
"""

import io
import os
import json
import requests
import pandas as pd
from datetime import date, datetime
from django.http import HttpResponse
from django.db import transaction

from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from rest_framework import generics, permissions, status, viewsets
from rest_framework.authtoken.models import Token
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from .balance import (
    compute_balances,
    compute_member_detail,
    compute_timeline,
)
from .importer import import_csv
from .models import (
    Expense,
    ExpenseSplit,
    Group,
    GroupMembership,
    ImportAnomaly,
    ImportReport,
    Settlement,
    OTPVerification,
)
from .serializers import (
    ExpenseSerializer,
    ExpenseSplitSerializer,
    GroupMembershipSerializer,
    GroupSerializer,
    ImportAnomalySerializer,
    ImportReportSerializer,
    RegisterSerializer,
    SettlementSerializer,
    UserSerializer,
)


# =====================================================================
# Auth views
# =====================================================================
class RegisterView(APIView):
    """Create a new user account and return a token."""

    permission_classes = [permissions.AllowAny]

    def post(self, request: Request) -> Response:
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        token, _ = Token.objects.get_or_create(user=user)
        return Response(
            {
                "user": UserSerializer(user).data,
                "token": token.key,
            },
            status=status.HTTP_201_CREATED,
        )


class LoginView(APIView):
    """Authenticate and return a token."""

    permission_classes = [permissions.AllowAny]

    def post(self, request: Request) -> Response:
        username = request.data.get("username", "")
        password = request.data.get("password", "")
        user = authenticate(username=username, password=password)
        if user is None:
            return Response(
                {"detail": "Invalid credentials."},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        token, _ = Token.objects.get_or_create(user=user)
        return Response(
            {
                "user": UserSerializer(user).data,
                "token": token.key,
            },
        )


class LogoutView(APIView):
    """Delete the current user's token."""

    def post(self, request: Request) -> Response:
        try:
            request.user.auth_token.delete()
        except Exception:
            pass
        return Response({"detail": "Logged out."}, status=status.HTTP_200_OK)


class UserProfileView(APIView):
    """Return the authenticated user's profile."""

    def get(self, request: Request) -> Response:
        return Response(UserSerializer(request.user).data)


import random
from django.core.mail import send_mail
from django.conf import settings

class ForgotPasswordView(APIView):
    """Generates and sends a 6-digit OTP code to the user's email."""

    permission_classes = [permissions.AllowAny]

    def post(self, request: Request) -> Response:
        try:
            email = request.data.get("email", "").strip()
            if not email:
                return Response(
                    {"detail": "Email address is required."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Look up user(s) matching this email
            users = User.objects.filter(email__iexact=email)
            if not users.exists():
                return Response(
                    {"detail": "No account found with this email address."},
                    status=status.HTTP_404_NOT_FOUND,
                )

            # Generate a random 6-digit OTP
            otp = f"{random.randint(100000, 999999)}"

            # Save to database (delete existing OTP requests for this email first)
            OTPVerification.objects.filter(email__iexact=email).delete()
            OTPVerification.objects.create(email=email.lower(), otp=otp)

            # Send the email
            subject = "Reset Your FairShare Password"
            html_message = f"""
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);">
                <div style="text-align: center; border-bottom: 1px solid #f1f5f9; padding-bottom: 24px; margin-bottom: 28px;">
                    <h1 style="color: #0f172a; margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.5px;">FairShare</h1>
                    <p style="color: #64748b; font-size: 14px; margin: 6px 0 0 0; font-weight: 500;">Shared expense tracking made simple</p>
                </div>
                
                <p style="color: #334155; font-size: 16px; margin: 0 0 16px 0; font-weight: 500;">Hello,</p>
                <p style="color: #475569; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0;">We received a request to reset the password for your FairShare account. Please use the following One-Time Password (OTP) to complete the verification process:</p>
                
                <div style="text-align: center; margin: 32px 0; padding: 20px; background-color: #f8fafc; border-radius: 8px; border: 1px dashed #cbd5e1;">
                    <span style="font-size: 36px; font-weight: 800; letter-spacing: 6px; color: #2563eb; font-family: 'Courier New', Courier, monospace;">{otp}</span>
                </div>
                
                <p style="color: #dc2626; font-size: 13px; font-weight: 600; margin: 0 0 24px 0;">⚠️ This OTP code is valid for 10 minutes. Do not share this email or code with anyone.</p>
                
                <p style="color: #64748b; font-size: 13px; line-height: 1.5; margin: 28px 0 0 0; padding-top: 20px; border-top: 1px solid #f1f5f9;">
                    If you did not request a password reset, you can safely ignore this email. Your password will remain unchanged.
                </p>
                
                <p style="color: #94a3b8; font-size: 11px; text-align: center; margin-top: 36px; margin-bottom: 0;">
                    &copy; 2026 FairShare. All rights reserved.
                </p>
            </div>
            """
            plain_message = (
                f"Hello,\n\n"
                f"We received a request to reset your FairShare password. "
                f"Your One-Time Password (OTP) code is:\n\n"
                f"{otp}\n\n"
                f"This code is valid for 10 minutes. Do not share this code with anyone.\n\n"
                f"If you did not request a password reset, you can safely ignore this email.\n\n"
                f"Best regards,\n"
                f"FairShare Team"
            )

            send_mail(
                subject=subject,
                message=plain_message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[email],
                html_message=html_message,
                fail_silently=False,
            )
            return Response(
                {"detail": "OTP sent successfully. Please check your inbox."},
                status=status.HTTP_200_OK,
            )
        except Exception as e:
            import traceback
            return Response(
                {
                    "detail": "Failed to send email.",
                    "error": str(e),
                    "traceback": traceback.format_exc()
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class VerifyOTPView(APIView):
    """Verifies the OTP code sent to the user's email."""

    permission_classes = [permissions.AllowAny]

    def post(self, request: Request) -> Response:
        email = request.data.get("email", "").strip()
        otp = request.data.get("otp", "").strip()

        if not email or not otp:
            return Response(
                {"detail": "Email and OTP are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        verification = OTPVerification.objects.filter(email__iexact=email).first()
        if not verification:
            return Response(
                {"detail": "No OTP code request found for this email."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if verification.is_expired():
            return Response(
                {"detail": "This OTP code has expired. Please request a new one."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if verification.otp != otp:
            return Response(
                {"detail": "Invalid OTP code. Please check and try again."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        verification.is_verified = True
        verification.save()

        return Response(
            {"detail": "OTP verified successfully. You can now reset your password."},
            status=status.HTTP_200_OK,
        )


class ResetPasswordView(APIView):
    """Resets the password after verifying the OTP."""

    permission_classes = [permissions.AllowAny]

    def post(self, request: Request) -> Response:
        email = request.data.get("email", "").strip()
        otp = request.data.get("otp", "").strip()
        new_password = request.data.get("new_password", "").strip()

        if not email or not otp or not new_password:
            return Response(
                {"detail": "Email, OTP, and new password are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        verification = OTPVerification.objects.filter(email__iexact=email).first()
        if not verification or not verification.is_verified or verification.otp != otp:
            return Response(
                {"detail": "OTP verification is incomplete or invalid."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if verification.is_expired():
            return Response(
                {"detail": "OTP code has expired. Please request a new one."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        users = User.objects.filter(email__iexact=email)
        if not users.exists():
            return Response(
                {"detail": "No account found with this email."},
                status=status.HTTP_404_NOT_FOUND,
            )

        for u in users:
            u.set_password(new_password)
            u.save()

        # Delete the verification record after successful reset
        verification.delete()

        return Response(
            {"detail": "Your password has been successfully reset. You can now log in."},
            status=status.HTTP_200_OK,
        )


# =====================================================================
# Group CRUD
# =====================================================================
class GroupViewSet(viewsets.ModelViewSet):
    serializer_class = GroupSerializer

    def get_queryset(self):
        return Group.objects.filter(
            memberships__user=self.request.user,
            memberships__is_active=True,
        ).distinct()

    def perform_create(self, serializer):
        group = serializer.save(created_by=self.request.user)
        # Auto-add creator as member
        GroupMembership.objects.get_or_create(
            user=self.request.user,
            group=group,
            defaults={"joined_at": date.today(), "is_active": True},
        )

    @action(detail=True, methods=["post"])
    def seed(self, request, pk=None):
        """Seed group with flatmates for testing."""
        group = self.get_object()
        flatmates = ["Aisha", "Rohan", "Priya", "Meera", "Dev", "Sam"]
        
        seeded_members = []
        for name in flatmates:
            username = name.strip().title()
            email = f"{username.lower()}@fairshare.com"
            # Get or create the user
            user, created = User.objects.get_or_create(
                username=username,
                defaults={"email": email}
            )
            if created:
                user.set_password("password123")
                user.save()
            
            # Add to group memberships
            membership, m_created = GroupMembership.objects.get_or_create(
                user=user,
                group=group,
                defaults={"joined_at": date(2026, 1, 1), "is_active": True}
            )
            
            # Dev left on 15th April 2026, Sam joined on 1st March 2026
            if username == "Dev":
                membership.joined_at = date(2026, 1, 1)
                membership.left_at = date(2026, 4, 15)
                membership.save()
            elif username == "Sam":
                membership.joined_at = date(2026, 3, 1)
                membership.save()
                
            seeded_members.append(username)
            
        return Response({
            "detail": f"Successfully seeded 6 flatmates: {', '.join(seeded_members)}",
            "members": seeded_members
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=["post"], permission_classes=[permissions.IsAuthenticated])
    def join(self, request):
        """Join a group using its invite code."""
        code = request.data.get("invite_code")
        if not code:
            return Response(
                {"detail": "invite_code is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            group = Group.objects.get(invite_code__iexact=code.strip())
        except Group.DoesNotExist:
            return Response(
                {"detail": "Invalid invite code. Group not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
            
        # Add current user to group
        membership, created = GroupMembership.objects.get_or_create(
            group=group,
            user=request.user,
            defaults={"joined_at": date.today(), "is_active": True}
        )
        if not created and not membership.is_active:
            membership.is_active = True
            membership.joined_at = date.today()
            membership.left_at = None
            membership.save()
            
        return Response({
            "detail": f"Successfully joined group: {group.name}",
            "group_id": group.id
        }, status=status.HTTP_200_OK)


# =====================================================================
# Group Membership
# =====================================================================
class GroupMembershipViewSet(viewsets.ModelViewSet):
    serializer_class = GroupMembershipSerializer

    def get_queryset(self):
        group_id = self.kwargs.get("group_pk")
        if group_id:
            return GroupMembership.objects.filter(group_id=group_id)
        return GroupMembership.objects.filter(
            group__memberships__user=self.request.user,
        ).distinct()

    def create(self, request, *args, **kwargs):
        group_id = self.kwargs.get("group_pk") or request.data.get("group")
        username = request.data.get("username")
        
        if not username:
            return Response(
                {"detail": "username is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
            
        try:
            user = User.objects.get(username__iexact=username)
        except User.DoesNotExist:
            return Response(
                {"detail": "User with this username does not exist. They must register first."},
                status=status.HTTP_400_BAD_REQUEST,
            )
            
        # Check if already a member
        if GroupMembership.objects.filter(group_id=group_id, user=user, is_active=True).exists():
            return Response(
                {"detail": f"{user.username} is already a member of this group."},
                status=status.HTTP_400_BAD_REQUEST,
            )
            
        membership, created = GroupMembership.objects.get_or_create(
            group_id=group_id,
            user=user,
            defaults={"joined_at": date.today(), "is_active": True}
        )
        if not created and not membership.is_active:
            membership.is_active = True
            membership.joined_at = date.today()
            membership.left_at = None
            membership.save()
            
        serializer = self.get_serializer(membership)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def perform_create(self, serializer):
        group_id = self.kwargs.get("group_pk") or self.request.data.get("group")
        serializer.save(group_id=group_id)


# =====================================================================
# Expense CRUD
# =====================================================================
class ExpenseViewSet(viewsets.ModelViewSet):
    serializer_class = ExpenseSerializer

    def get_queryset(self):
        qs = Expense.objects.select_related("paid_by").prefetch_related("splits__user")
        group_id = self.request.query_params.get("group")
        if group_id:
            qs = qs.filter(group_id=group_id)
        return qs

    def perform_create(self, serializer):
        serializer.save()


# =====================================================================
# Settlement CRUD
# =====================================================================
class SettlementViewSet(viewsets.ModelViewSet):
    serializer_class = SettlementSerializer

    def get_queryset(self):
        qs = Settlement.objects.select_related("paid_by", "paid_to")
        group_id = self.request.query_params.get("group")
        if group_id:
            qs = qs.filter(group_id=group_id)
        return qs


# =====================================================================
# CSV Import
# =====================================================================
class ImportCSVView(APIView):
    """Upload a CSV file to import expenses into a group."""

    parser_classes = [MultiPartParser, FormParser]

    def post(self, request: Request) -> Response:
        csv_file = request.FILES.get("file")
        group_id = request.data.get("group_id") or request.data.get("group")
        if not csv_file:
            return Response(
                {"detail": "No file uploaded."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not group_id:
            return Response(
                {"detail": "group_id is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            group_id = int(group_id)
        except (TypeError, ValueError):
            return Response(
                {"detail": "group_id must be an integer."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            report = import_csv(
                csv_file=csv_file,
                group_id=group_id,
                user_id=request.user.id,
                filename=csv_file.name,
            )
        except Exception as exc:
            return Response(
                {"detail": f"Import failed: {exc}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            ImportReportSerializer(report).data,
            status=status.HTTP_201_CREATED,
        )


# =====================================================================
# Import Report
# =====================================================================
class ImportReportViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = ImportReportSerializer

    def get_queryset(self):
        qs = ImportReport.objects.prefetch_related("anomalies")
        group_id = self.request.query_params.get("group")
        if group_id:
            qs = qs.filter(group_id=group_id)
        return qs

    @action(detail=True, methods=["get"], permission_classes=[permissions.AllowAny])
    def excel(self, request, pk=None):
        """Export report anomalies to an Excel sheet."""
        report = self.get_object()
        anomalies = report.anomalies.all().order_by("row_number")

        data = []
        for a in anomalies:
            data.append({
                "Row Number": a.row_number,
                "Anomaly Type": a.anomaly_type,
                "Severity": a.severity,
                "Description": a.description,
                "Original Data": a.original_data,
                "Action Taken": a.action_taken,
                "Requires Review": "Yes" if a.requires_review else "No",
            })

        df = pd.DataFrame(data)
        if df.empty:
            df = pd.DataFrame(columns=[
                "Row Number", "Anomaly Type", "Severity", "Description",
                "Original Data", "Action Taken", "Requires Review"
            ])

        output = io.BytesIO()
        with pd.ExcelWriter(output, engine="openpyxl") as writer:
            df.to_excel(writer, index=False, sheet_name="Anomaly Log")

        output.seek(0)
        response = HttpResponse(
            output.read(),
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
        response["Content-Disposition"] = f"attachment; filename=anomaly_report_{report.id}.xlsx"
        return response


# =====================================================================
# Balance views
# =====================================================================
class BalanceSummaryView(APIView):
    """GET /api/groups/<group_pk>/balances/ — who owes whom."""

    def get(self, request: Request, group_pk: int) -> Response:
        as_of = request.query_params.get("as_of")
        from_date_str = request.query_params.get("from")
        as_of_date = _parse_query_date(as_of)
        from_date = _parse_query_date(from_date_str)

        summary = compute_balances(
            group_id=group_pk,
            as_of_date=as_of_date,
            from_date=from_date,
        )
        return Response({
            "group_id": summary.group_id,
            "member_balances": [
                {
                    "user_id": mb.user_id,
                    "username": mb.username,
                    "total_paid": str(mb.total_paid),
                    "total_owed": str(mb.total_owed),
                    "net_balance": str(mb.net_balance),
                }
                for mb in summary.member_balances
            ],
            "simplified_debts": [
                {
                    "from_user_id": d.from_user_id,
                    "from_username": d.from_username,
                    "to_user_id": d.to_user_id,
                    "to_username": d.to_username,
                    "amount": str(d.amount),
                }
                for d in summary.simplified_debts
            ],
        })


class BalanceDetailView(APIView):
    """GET /api/groups/<group_pk>/balances/detail/?user_id=X"""

    def get(self, request: Request, group_pk: int) -> Response:
        user_id = request.query_params.get("user_id")
        if not user_id:
            user_id = request.user.id
        else:
            user_id = int(user_id)

        details = compute_member_detail(group_id=group_pk, user_id=user_id)
        return Response({
            "group_id": group_pk,
            "user_id": user_id,
            "expenses": [
                {
                    "expense_id": d.expense_id,
                    "date": d.date.isoformat(),
                    "description": d.description,
                    "total_amount": str(d.total_amount),
                    "paid_by": d.paid_by_username,
                    "amount_owed": str(d.amount_owed),
                    "is_payer": d.is_payer,
                }
                for d in details
            ],
        })


class TimelineView(APIView):
    """GET /api/groups/<group_pk>/timeline/ — cumulative balance snapshots."""

    def get(self, request: Request, group_pk: int) -> Response:
        from_str = request.query_params.get("from")
        to_str = request.query_params.get("to")
        snapshots = compute_timeline(
            group_id=group_pk,
            from_date=_parse_query_date(from_str),
            to_date=_parse_query_date(to_str),
        )
        return Response({
            "group_id": group_pk,
            "snapshots": [
                {
                    "date": s.date.isoformat(),
                    "balances": {
                        str(uid): str(bal)
                        for uid, bal in s.member_balances.items()
                    },
                }
                for s in snapshots
            ],
        })


# =====================================================================
# Helpers
# =====================================================================
def _parse_query_date(value: str | None) -> date | None:
    if not value:
        return None
    for fmt in ("%Y-%m-%d", "%d-%m-%Y"):
        try:
            return datetime.strptime(value, fmt).date()
        except ValueError:
            continue
    return None


# =====================================================================
# Demo Mode & AI Assistant
# =====================================================================
class DemoLoginView(APIView):
    """Logs in (or registers) a demo user and pre-seeds their account with 5-6 groups."""

    permission_classes = [permissions.AllowAny]

    @transaction.atomic
    def post(self, request: Request) -> Response:
        try:
            from django.conf import settings
            
            # 1. Create/Get the recruiter demo user
            username = "RecruiterDemo"
            email = "recruiter@fairshare.com"
            user, created = User.objects.get_or_create(
                username=username,
                defaults={"email": email}
            )
            if created:
                user.set_password("recruiter1234")
                user.save()

            # If user already exists and has 6 groups pre-seeded, skip re-seeding completely
            # to make logins instant (in under 150ms). Force re-seed only if 'reset' param is true.
            force_reset = request.data.get("reset", False) or request.query_params.get("reset", "false").lower() in ("true", "1", "yes")
            if not created and not force_reset:
                existing_groups = Group.objects.filter(created_by=user)
                if existing_groups.count() == 6:
                    token, _ = Token.objects.get_or_create(user=user)
                    first_group = existing_groups.order_by("created_at").first()
                    return Response({
                        "user": UserSerializer(user).data,
                        "token": token.key,
                        "group_id": first_group.id if first_group else None
                    })

            # 2. Reset database state for this user by deleting existing groups they created
            groups = Group.objects.filter(created_by=user)
            # Bulk delete children first to bypass slow Django in-memory cascades:
            ExpenseSplit.objects.filter(expense__group__in=groups).delete()
            Expense.objects.filter(group__in=groups).delete()
            Settlement.objects.filter(group__in=groups).delete()
            ImportAnomaly.objects.filter(import_report__group__in=groups).delete()
            ImportReport.objects.filter(group__in=groups).delete()
            GroupMembership.objects.filter(group__in=groups).delete()
            groups.delete()

            # 3. Create or get flatmates
            flatmates = ["Aisha", "Rohan", "Priya", "Meera", "Dev", "Sam"]
            users_map = {"RecruiterDemo": user}
            for name in flatmates:
                u_name = name.strip().title()
                u_email = f"{u_name.lower()}@fairshare.com"
                f_user, _ = User.objects.get_or_create(
                    username=u_name,
                    defaults={"email": u_email}
                )
                if _:
                    f_user.set_password("password123")
                    f_user.save()
                users_map[u_name] = f_user

            # Helper function to create membership
            def add_membership(grp, u_obj, joined_date, left_date=None):
                GroupMembership.objects.create(
                    user=u_obj,
                    group=grp,
                    joined_at=joined_date,
                    left_at=left_date,
                    is_active=(left_date is None or left_date > date.today())
                )

            # Helper function to add expenses
            def add_expense(grp, desc, amount, payer_name, split_type, exp_date, splits=None, percentages=None):
                payer = users_map[payer_name]
                expense = Expense.objects.create(
                    group=grp,
                    description=desc,
                    amount=amount,
                    original_amount=amount,
                    original_currency="INR",
                    exchange_rate=1.0,
                    date=exp_date,
                    paid_by=payer,
                    split_type=split_type
                )
                if split_type == "equal":
                    # Find members active on that date
                    active_users = []
                    for m in grp.memberships.all():
                        if m.joined_at <= exp_date and (m.left_at is None or m.left_at >= exp_date):
                            active_users.append(m.user)
                    if not active_users:
                        active_users = [grp.created_by]
                    split_amt = amount / len(active_users)
                    for u in active_users:
                        ExpenseSplit.objects.create(expense=expense, user=u, amount_owed=split_amt)
                elif split_type == "unequal" and splits:
                    for name, owed in splits.items():
                        ExpenseSplit.objects.create(expense=expense, user=users_map[name], amount_owed=owed)
                elif split_type == "percentage" and percentages:
                    for name, pct in percentages.items():
                        owed = (amount * pct) / 100
                        ExpenseSplit.objects.create(expense=expense, user=users_map[name], amount_owed=owed)
                return expense

            # Helper to add settlements
            def add_settlement(grp, payer_name, payee_name, amount, set_date, notes=""):
                Settlement.objects.create(
                    group=grp,
                    paid_by=users_map[payer_name],
                    paid_to=users_map[payee_name],
                    amount=amount,
                    date=set_date,
                    notes=notes
                )

            # --- GROUP 1: Flat 304 Demo (Spreetail CSV data + anomalies) ---
            g1 = Group.objects.create(
                name="Flat 304 Demo",
                description="A comprehensive roommates group pre-seeded with Spreetail's sample CSV file. It contains 43 records representing chaotic transactions. Use it to explore the CSV Anomaly Detective dashboard displaying 20+ types of parsing anomalies, the cumulative balance playback timeline, the spending insights statistics charts, and the interactive SVG debt graph.",
                created_by=user
            )
            # Add members
            add_membership(g1, user, date(2026, 1, 1))
            for name in flatmates:
                joined = date(2026, 1, 1)
                left = None
                if name == "Dev":
                    left = date(2026, 4, 15)
                elif name == "Sam":
                    joined = date(2026, 3, 1)
                add_membership(g1, users_map[name], joined, left)

            # Import the CSV
            csv_path = os.path.join(settings.BASE_DIR, "expenses_export.csv")
            if not os.path.exists(csv_path):
                csv_path = os.path.join(settings.BASE_DIR.parent, "expenses_export.csv")
            
            if os.path.exists(csv_path):
                try:
                    with open(csv_path, "r", encoding="utf-8-sig") as f:
                        import_csv(
                            csv_file=f,
                            group_id=g1.id,
                            user_id=user.id,
                            filename="expenses_export.csv",
                        )
                except Exception as e:
                    print(f"Error seeding demo CSV: {e}")

            # --- GROUP 2: Goa Road Trip 2026 ---
            g2 = Group.objects.create(
                name="Goa Road Trip 2026",
                description="An exciting vacation road trip shared expense group for 4 friends traveling to Goa. It includes high-value travel transactions like beachside villa bookings, fuel costs, highway tolls, local seafood shack bills, and adventure scuba diving activities. Test the balance engines, unequal splitting, and quick settle-up payments here.",
                created_by=user
            )
            for name in ["RecruiterDemo", "Rohan", "Priya", "Dev"]:
                add_membership(g2, users_map[name], date(2026, 5, 1))

            add_expense(g2, "Luxury Beach Villa Booking", 24000, "RecruiterDemo", "equal", date(2026, 5, 1))
            add_expense(g2, "Fuel & Highway Tolls", 8500, "Rohan", "equal", date(2026, 5, 2))
            add_expense(g2, "Seafood at Curlies Shack", 6200, "Priya", "unequal", date(2026, 5, 3), 
                        splits={"Rohan": 2000, "Priya": 2200, "Dev": 1000, "RecruiterDemo": 1000})
            add_expense(g2, "Scuba Diving & Watersports", 12000, "Dev", "percentage", date(2026, 5, 4),
                        percentages={"Rohan": 25, "Priya": 25, "Dev": 25, "RecruiterDemo": 25})
            add_settlement(g2, "Rohan", "RecruiterDemo", 5000, date(2026, 5, 5), "Settle fuel part")

            # --- GROUP 3: Office Lunch Crew ---
            g3 = Group.objects.create(
                name="Office Lunch Crew",
                description="A workplace shared expense group tracking daily team cafeteria runs, coffee bills, and client dinners. This group showcases quick, lightweight daily transaction flows and complex splitting behaviors such as unequal user shares and quick peer settlements. Excellent for checking fast, high-frequency small-value expense calculations.",
                created_by=user
            )
            for name in ["RecruiterDemo", "Aisha", "Dev", "Sam"]:
                add_membership(g3, users_map[name], date(2026, 5, 10))

            add_expense(g3, "Friday Lunch Buffet", 4800, "Aisha", "equal", date(2026, 5, 10))
            add_expense(g3, "Starbucks Coffee Run", 1800, "RecruiterDemo", "unequal", date(2026, 5, 12),
                        splits={"Aisha": 500, "Dev": 400, "Sam": 400, "RecruiterDemo": 500})
            add_expense(g3, "Evening Tea & Samosas", 900, "Sam", "equal", date(2026, 5, 15))
            add_settlement(g3, "Dev", "Aisha", 1000, date(2026, 5, 16), "Lunch return")

            # --- GROUP 4: Weekend Jam Sessions ---
            g4 = Group.objects.create(
                name="Weekend Jam Sessions",
                description="A hobby-focused expense group tracking music jam sessions, studio renting charges, equipment costs, and snack bills among band members. Demonstrates straightforward equal splits for short-term projects and casual collaboration. A perfect, clean playground for simple balance tracking and verifying the simplified debt network logic.",
                created_by=user
            )
            for name in ["RecruiterDemo", "Rohan", "Sam"]:
                add_membership(g4, users_map[name], date(2026, 5, 20))

            add_expense(g4, "Music Studio Rent (3 Hours)", 2100, "Rohan", "equal", date(2026, 5, 20))
            add_expense(g4, "New Bass Guitar Strings", 1200, "RecruiterDemo", "equal", date(2026, 5, 22))
            add_expense(g4, "Midnight Pizzas & Soda", 650, "Sam", "equal", date(2026, 5, 25))

            # --- GROUP 5: New Flat Setup ---
            g5 = Group.objects.create(
                name="New Flat Setup",
                description="A high-value real estate setup group for roommates organizing move-in painter charges, apartment security deposits, deep cleaning expenses, and broker commission payouts. Shows how the FairShare debt engine handles massive high-value transfers, simplifying complex multi-thousand rupee transactions into a single direct payment.",
                created_by=user
            )
            for name in ["RecruiterDemo", "Aisha", "Priya"]:
                add_membership(g5, users_map[name], date(2026, 3, 1))

            add_expense(g5, "Security Deposit", 90000, "RecruiterDemo", "equal", date(2026, 3, 1))
            add_expense(g5, "Agent Brokerage Fee", 30000, "Aisha", "equal", date(2026, 3, 2))
            add_expense(g5, "Flat Wall Painting & Cleaning", 15000, "Priya", "equal", date(2026, 3, 5))
            add_settlement(g5, "Aisha", "RecruiterDemo", 10000, date(2026, 3, 10), "Initial transfer")
            add_settlement(g5, "Priya", "RecruiterDemo", 15000, date(2026, 3, 12), "Deposit part share")

            # --- GROUP 6: Spreetail Hackathon ---
            g6 = Group.objects.create(
                name="Spreetail Hackathon",
                description="A fast-paced software hackathon team tracker documenting cloud domain purchases, server hosting subscriptions, midnight energy drinks, pizza boxes, and coffee runs. Created to demonstrate the absolute speed and reliability of logging bills in real-time under tight deadlines, featuring clean layouts and rapid balance updates.",
                created_by=user
            )
            for name in ["RecruiterDemo", "Aisha", "Rohan"]:
                add_membership(g6, users_map[name], date(2026, 6, 1))

            add_expense(g6, "Cloud Domain & Server Hosting", 2500, "RecruiterDemo", "equal", date(2026, 6, 1))
            add_expense(g6, "Midnight Energy Drinks & Pizzas", 3200, "Aisha", "equal", date(2026, 6, 2))
            add_expense(g6, "Hackathon Morning Coffee", 1200, "Rohan", "equal", date(2026, 6, 3))

            # 6. Generate and return authentication token
            token, _ = Token.objects.get_or_create(user=user)
            return Response({
                "user": UserSerializer(user).data,
                "token": token.key,
                "group_id": g1.id
            })
        except Exception as e:
            import traceback
            return Response(
                {
                    "detail": "Exception occurred in DemoLoginView",
                    "error": str(e),
                    "traceback": traceback.format_exc()
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class AIAssistantView(APIView):
    """Calls Gemini API to analyze group spending and answer user questions with chat memory."""

    def post(self, request: Request, group_pk: int) -> Response:
        try:
            group = Group.objects.get(pk=group_pk)
        except Group.DoesNotExist:
            return Response({"detail": "Group not found."}, status=status.HTTP_404_NOT_FOUND)

        # 1. Extract chat history and latest question from POST payload
        history = request.data.get("messages", [])
        question = request.data.get("question", "")

        # Fetch balances and expenses
        from .balance import compute_balances
        balances = compute_balances(group_id=group_pk)
        expenses = Expense.objects.filter(group_id=group_pk).order_by("-date")[:15]

        # Format context for Gemini
        members_str = ", ".join([m.user.username for m in GroupMembership.objects.filter(group=group, is_active=True)])
        
        debts_list = []
        for d in balances.simplified_debts:
            debts_list.append(f"- {d.from_username} owes {d.to_username} INR {d.amount}")
        debts_str = "\n".join(debts_list) if debts_list else "No outstanding debts. Everyone is settled!"

        expenses_list = []
        for e in expenses:
            expenses_list.append(f"- {e.paid_by.username} paid INR {e.amount} for '{e.description}' on {e.date} (Split: {e.split_type})")
        expenses_str = "\n".join(expenses_list) if expenses_list else "No recent expenses logged."

        # Base prompt setting the system role and financial context
        context_prompt = f"""
You are the "FairShare AI roommate", a smart, friendly, and slightly humorous financial assistant for a shared household.
Here are the current finances for the group "{group.name}":
Members: {members_str}

Recent Expenses:
{expenses_str}

Outstanding Debts (Simplified):
{debts_str}

Answer questions based on these finances. Keep the tone fun, punchy, and friendly. Output in clean Markdown, with emojis. Keep responses concise and under 150 words.
"""

        # 2. Build multi-turn Gemini payload (contents array)
        contents = []
        context_injected = False

        if history:
            # Map history from frontend structure [{"sender": "user"|"ai", "text": "..."}] to Gemini role structure
            for i, msg in enumerate(history):
                role = "user" if msg.get("sender") == "user" else "model"
                text = msg.get("text", "")
                
                # Inject system context into the first user turn in the history
                if role == "user" and not context_injected:
                    text = f"{context_prompt}\n\nUser Question: {text}"
                    context_injected = True
                
                contents.append({
                    "role": role,
                    "parts": [{"text": text}]
                })
            
            # Append current question as the latest user turn
            if question:
                text = question
                # If context was never injected, inject it here
                if not context_injected:
                    text = f"{context_prompt}\n\nUser Question: {text}"
                    context_injected = True
                contents.append({
                    "role": "user",
                    "parts": [{"text": text}]
                })
        else:
            # Standard initial prompt
            initial_query = question if question else "Provide a short, engaging financial analysis of this group."
            contents.append({
                "role": "user",
                "parts": [{"text": f"{context_prompt}\n\nUser Question: {initial_query}"}]
            })

        # Use user's API Key
        from django.conf import settings
        api_key = getattr(settings, "GEMINI_API_KEY", "")
        model = "gemini-3.1-flash-lite"
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
        
        headers = {
            "Content-Type": "application/json",
            "x-goog-api-key": api_key
        }
        payload = {
            "contents": contents
        }

        try:
            response = requests.post(url, headers=headers, json=payload, timeout=30)
            if response.status_code == 200:
                res_data = response.json()
                
                # Defensive parsing to avoid KeyError: 'text' or 'content'
                candidates = res_data.get("candidates", [])
                if not candidates:
                    return Response(
                        {"detail": f"Gemini API returned 200 but no candidates. Response: {res_data}"},
                        status=status.HTTP_502_BAD_GATEWAY
                    )
                
                content = candidates[0].get("content", {})
                parts = content.get("parts", [])
                if not parts:
                    return Response(
                        {"detail": f"Gemini API returned 200 but empty parts. Response: {res_data}"},
                        status=status.HTTP_502_BAD_GATEWAY
                    )
                
                part = parts[0]
                if "text" not in part:
                    return Response(
                        {"detail": f"Gemini response part missing 'text'. Response: {res_data}"},
                        status=status.HTTP_502_BAD_GATEWAY
                    )
                
                ai_text = part["text"]
                return Response({"advice": ai_text})
            else:
                return Response(
                    {"detail": f"Gemini API returned error (status {response.status_code}): {response.text}"},
                    status=status.HTTP_502_BAD_GATEWAY
                )
        except Exception as e:
            return Response(
                {"detail": f"Failed to connect to Gemini: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
