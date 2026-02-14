"""Microsoft Graph API client for email ingestion and export."""

import logging
from typing import Any

import httpx
import msal

from app.config import settings

logger = logging.getLogger(__name__)


class GraphClient:
    """Client for Microsoft Graph API operations."""

    GRAPH_BASE = "https://graph.microsoft.com/v1.0"

    def __init__(self, tenant_id: str | None = None):
        self._tenant_id = tenant_id or settings.azure_tenant_id
        self._token: str | None = None

    async def _get_token(self) -> str:
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

    # ─── Email Ingestion ──────────────────────────────────────

    async def get_messages(
        self, user_id: str, top: int = 50, skip: int = 0
    ) -> list[dict]:
        """Fetch messages from a user's inbox."""
        result = await self._request(
            "GET",
            f"/users/{user_id}/messages",
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
        return await self._request(
            "GET",
            f"/users/{user_id}/messages/{message_id}",
            params={"$expand": "attachments"},
        )

    async def get_attachment_content(
        self, user_id: str, message_id: str, attachment_id: str
    ) -> bytes:
        """Download attachment content."""
        token = await self._get_token()
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.GRAPH_BASE}/users/{user_id}/messages/{message_id}/attachments/{attachment_id}/$value",
                headers={"Authorization": f"Bearer {token}"},
            )
            response.raise_for_status()
            return response.content

    # ─── Webhook Management ───────────────────────────────────

    async def create_subscription(
        self, user_id: str, notification_url: str, expiration_minutes: int = 4230
    ) -> dict:
        """Create a webhook subscription for new emails."""
        return await self._request(
            "POST",
            "/subscriptions",
            json={
                "changeType": "created",
                "notificationUrl": notification_url,
                "resource": f"/users/{user_id}/messages",
                "expirationDateTime": None,  # Will be calculated by Graph API
                "clientState": "inbox-agent-webhook",
            },
        )

    async def renew_subscription(self, subscription_id: str) -> dict:
        """Renew an existing webhook subscription."""
        from datetime import datetime, timedelta, timezone

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
            result = await self._request(
                "GET",
                f"/users/{user_id}/messages/delta",
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

        await self._request(
            "POST",
            f"/users/{user_id}/sendMail",
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
        path = f"{folder_path.rstrip('/')}/{file_name}"
        async with httpx.AsyncClient() as client:
            response = await client.put(
                f"{self.GRAPH_BASE}/users/{user_id}/drive/root:/{path}:/content",
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/octet-stream",
                },
                content=content,
            )
            response.raise_for_status()
            return response.json()
