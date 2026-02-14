"""Microsoft Graph API client for email ingestion and export."""

import logging
from datetime import datetime, timezone
from typing import Any, Callable, Awaitable

import httpx
import msal

from app.config import settings

logger = logging.getLogger(__name__)


class GraphClient:
    """Client for Microsoft Graph API operations.

    Supports two authentication modes:
    1. Client Credentials Flow (app-level, uses AZURE_CLIENT_ID + SECRET)
    2. Delegated Token Flow (per-org OAuth tokens from user consent)
    """

    GRAPH_BASE = "https://graph.microsoft.com/v1.0"

    def __init__(self, tenant_id: str | None = None):
        """Create a client using client credentials flow."""
        self._tenant_id = tenant_id or settings.azure_tenant_id
        self._token: str | None = None
        self._refresh_token: str | None = None
        self._token_expiry: datetime | None = None
        self._delegated = False
        self._on_token_refresh: Callable[[str, str, str], Awaitable[None]] | None = None

    @classmethod
    def from_delegated(
        cls,
        access_token: str,
        refresh_token: str,
        token_expiry: str | None = None,
        on_token_refresh: Callable[[str, str, str], Awaitable[None]] | None = None,
    ) -> "GraphClient":
        """Create a client using delegated (per-user OAuth) tokens.

        Args:
            access_token: The OAuth access token.
            refresh_token: The OAuth refresh token (for renewal).
            token_expiry: ISO timestamp when the access token expires.
            on_token_refresh: Async callback(new_access, new_refresh, new_expiry)
                              called when the token is refreshed.
        """
        instance = cls.__new__(cls)
        instance._tenant_id = None
        instance._token = access_token
        instance._refresh_token = refresh_token
        instance._delegated = True
        instance._on_token_refresh = on_token_refresh
        instance._token_expiry = None
        if token_expiry:
            try:
                instance._token_expiry = datetime.fromisoformat(
                    token_expiry.replace("Z", "+00:00")
                )
            except (ValueError, AttributeError):
                pass
        return instance

    async def _get_token(self) -> str:
        """Acquire or refresh an access token."""
        if self._delegated:
            return await self._get_delegated_token()
        return await self._get_client_credentials_token()

    async def _get_client_credentials_token(self) -> str:
        """Acquire an access token using client credentials flow."""
        if self._token:
            return self._token

        authority = f"https://login.microsoftonline.com/{self._tenant_id}"
        app = msal.ConfidentialClientApplication(
            settings.azure_client_id,
            authority=authority,
            client_credential=settings.azure_client_secret,
        )
        result = app.acquire_token_for_client(
            scopes=["https://graph.microsoft.com/.default"]
        )
        if "access_token" not in result:
            raise RuntimeError(f"Failed to acquire token: {result.get('error_description')}")

        self._token = result["access_token"]
        return self._token

    async def _get_delegated_token(self) -> str:
        """Get or refresh a delegated OAuth token."""
        # Check if token is still valid (with 5 min buffer)
        if self._token and self._token_expiry:
            now = datetime.now(timezone.utc)
            if now < self._token_expiry.replace(tzinfo=timezone.utc if self._token_expiry.tzinfo is None else self._token_expiry.tzinfo):
                return self._token

        # Token expired or missing — refresh it
        if not self._refresh_token:
            if self._token:
                return self._token
            raise RuntimeError("No access token or refresh token available")

        logger.info("Refreshing delegated OAuth token")
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://login.microsoftonline.com/common/oauth2/v2.0/token",
                data={
                    "client_id": settings.azure_client_id,
                    "client_secret": settings.azure_client_secret,
                    "grant_type": "refresh_token",
                    "refresh_token": self._refresh_token,
                    "scope": "Mail.Read Mail.ReadWrite Mail.Send User.Read offline_access",
                },
            )
            if response.status_code != 200:
                raise RuntimeError(f"Token refresh failed: {response.text}")

            data = response.json()

        self._token = data["access_token"]
        self._refresh_token = data.get("refresh_token", self._refresh_token)
        expires_in = data.get("expires_in", 3600)
        self._token_expiry = datetime.now(timezone.utc).__class__.fromtimestamp(
            datetime.now(timezone.utc).timestamp() + expires_in, tz=timezone.utc
        )
        new_expiry_iso = self._token_expiry.isoformat()

        # Persist refreshed tokens back to DB
        if self._on_token_refresh:
            await self._on_token_refresh(
                self._token, self._refresh_token, new_expiry_iso
            )

        return self._token

    @property
    def is_delegated(self) -> bool:
        """Whether this client uses delegated (user) tokens."""
        return self._delegated

    async def _request(self, method: str, path: str, **kwargs: Any) -> dict:
        """Make an authenticated request to Graph API."""
        token = await self._get_token()
        async with httpx.AsyncClient() as client:
            response = await client.request(
                method,
                f"{self.GRAPH_BASE}{path}",
                headers={"Authorization": f"Bearer {token}"},
                **kwargs,
            )
            response.raise_for_status()
            return response.json() if response.content else {}

    def _user_path(self, user_id: str) -> str:
        """Return the Graph API user path prefix.

        For delegated tokens, uses /me (acts as the signed-in user).
        For client credentials, uses /users/{user_id}.
        """
        if self._delegated:
            return "/me"
        return f"/users/{user_id}"

    # ─── Email Ingestion ──────────────────────────────────────

    async def get_messages(
        self, user_id: str, top: int = 50, skip: int = 0
    ) -> list[dict]:
        """Fetch messages from a user's inbox."""
        prefix = self._user_path(user_id)
        result = await self._request(
            "GET",
            f"{prefix}/messages",
            params={
                "$top": top,
                "$skip": skip,
                "$expand": "attachments",
                "$orderby": "receivedDateTime desc",
                "$select": "id,conversationId,subject,from,toRecipients,body,receivedDateTime,hasAttachments",
            },
        )
        return result.get("value", [])

    async def get_message(self, user_id: str, message_id: str) -> dict:
        """Fetch a single message with attachments."""
        prefix = self._user_path(user_id)
        return await self._request(
            "GET",
            f"{prefix}/messages/{message_id}",
            params={"$expand": "attachments"},
        )

    async def get_attachment_content(
        self, user_id: str, message_id: str, attachment_id: str
    ) -> bytes:
        """Download attachment content."""
        token = await self._get_token()
        prefix = self._user_path(user_id)
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.GRAPH_BASE}{prefix}/messages/{message_id}/attachments/{attachment_id}/$value",
                headers={"Authorization": f"Bearer {token}"},
            )
            response.raise_for_status()
            return response.content

    # ─── Webhook Management ───────────────────────────────────

    async def create_subscription(
        self, user_id: str, notification_url: str, expiration_minutes: int = 4230
    ) -> dict:
        """Create a webhook subscription for new emails."""
        prefix = self._user_path(user_id)
        return await self._request(
            "POST",
            "/subscriptions",
            json={
                "changeType": "created",
                "notificationUrl": notification_url,
                "resource": f"{prefix}/messages",
                "expirationDateTime": None,  # Will be calculated by Graph API
                "clientState": "inbox-agent-webhook",
            },
        )

    async def renew_subscription(self, subscription_id: str) -> dict:
        """Renew an existing webhook subscription."""
        from datetime import timedelta

        new_expiry = datetime.now(timezone.utc) + timedelta(days=3)
        return await self._request(
            "PATCH",
            f"/subscriptions/{subscription_id}",
            json={
                "expirationDateTime": new_expiry.isoformat(),
            },
        )

    # ─── Delta Query (Fallback Polling) ───────────────────────

    async def get_delta_messages(
        self, user_id: str, delta_link: str | None = None
    ) -> tuple[list[dict], str | None]:
        """Get new/changed messages using delta query."""
        if delta_link:
            token = await self._get_token()
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    delta_link,
                    headers={"Authorization": f"Bearer {token}"},
                )
                response.raise_for_status()
                result = response.json()
        else:
            prefix = self._user_path(user_id)
            result = await self._request(
                "GET",
                f"{prefix}/messages/delta",
                params={"$select": "id,subject,receivedDateTime"},
            )

        messages = result.get("value", [])
        next_link = result.get("@odata.deltaLink")
        return messages, next_link

    # ─── Email Sending (for DATEV Upload & Notifications) ─────

    async def send_email(
        self,
        user_id: str,
        to_address: str,
        subject: str,
        body: str,
        attachment_name: str | None = None,
        attachment_content: bytes | None = None,
        attachment_content_type: str = "application/pdf",
    ) -> None:
        """Send an email (for DATEV Upload Mail forwarding)."""
        import base64

        message: dict[str, Any] = {
            "message": {
                "subject": subject,
                "body": {"contentType": "Text", "content": body},
                "toRecipients": [
                    {"emailAddress": {"address": to_address}}
                ],
            }
        }

        if attachment_name and attachment_content:
            message["message"]["attachments"] = [
                {
                    "@odata.type": "#microsoft.graph.fileAttachment",
                    "name": attachment_name,
                    "contentType": attachment_content_type,
                    "contentBytes": base64.b64encode(attachment_content).decode(),
                }
            ]

        prefix = self._user_path(user_id)
        await self._request(
            "POST",
            f"{prefix}/sendMail",
            json=message,
        )
        logger.info("Email sent to %s: %s", to_address, subject)

    # ─── OneDrive Upload ──────────────────────────────────────

    async def upload_to_onedrive(
        self,
        user_id: str,
        folder_path: str,
        file_name: str,
        content: bytes,
    ) -> dict:
        """Upload a file to OneDrive."""
        token = await self._get_token()
        prefix = self._user_path(user_id)
        path = f"{folder_path.rstrip('/')}/{file_name}"
        async with httpx.AsyncClient() as client:
            response = await client.put(
                f"{self.GRAPH_BASE}{prefix}/drive/root:/{path}:/content",
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/octet-stream",
                },
                content=content,
            )
            response.raise_for_status()
            return response.json()
