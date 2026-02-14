"""Email ingestion: Fetch emails from Microsoft 365 via Graph API."""

import logging
from datetime import datetime

from celery import Celery

from app.config import settings
from app.services.graph_client import GraphClient

logger = logging.getLogger(__name__)

celery_app = Celery("inbox-agent", broker=settings.redis_url)


@celery_app.task
def process_webhook_notification(notification: dict) -> dict:
    """Handle a Graph API webhook notification for a new email."""
    import asyncio

    resource = notification.get("resource", "")
    # resource format: /users/{user-id}/messages/{message-id}
    parts = resource.strip("/").split("/")
    if len(parts) < 4:
        logger.warning("Invalid webhook resource: %s", resource)
        return {"status": "invalid_resource"}

    user_id = parts[1]
    message_id = parts[3]

    return asyncio.run(_ingest_email(user_id, message_id))


@celery_app.task
def poll_for_new_emails(organization_id: str) -> dict:
    """Fallback polling: Check for new emails using delta query."""
    import asyncio

    return asyncio.run(_poll_emails(organization_id))


async def _ingest_email(user_id: str, message_id: str) -> dict:
    """Fetch and process a single email from Graph API."""
    from supabase import create_client

    supabase = create_client(settings.supabase_url, settings.supabase_service_role_key)
    graph = GraphClient()

    # Fetch full email with attachments
    message = await graph.get_message(user_id, message_id)

    graph_message_id = message.get("id")

    # Deduplicate by message ID
    existing = supabase.table("inbox_items").select("id").eq(
        "email_message_id", graph_message_id
    ).execute()

    if existing.data:
        logger.info("Email %s already processed, skipping", graph_message_id)
        return {"status": "duplicate", "message_id": graph_message_id}

    # Find organization by inbox email
    to_addresses = [
        r.get("emailAddress", {}).get("address", "")
        for r in message.get("toRecipients", [])
    ]
    from_address = message.get("from", {}).get("emailAddress", {}).get("address", "")

    # Look up organization by any recipient address matching inbox_email
    org = None
    for addr in to_addresses:
        result = supabase.table("organizations").select("*").eq(
            "inbox_email", addr
        ).execute()
        if result.data:
            org = result.data[0]
            break

    if not org:
        logger.warning("No organization found for recipients: %s", to_addresses)
        return {"status": "no_org_found"}

    # Extract email body (plain text from HTML)
    body_content = message.get("body", {}).get("content", "")
    body_type = message.get("body", {}).get("contentType", "text")

    if body_type == "html":
        # Basic HTML stripping (production would use a proper HTML-to-text converter)
        import re
        body_text = re.sub(r"<[^>]+>", "", body_content)
        body_text = re.sub(r"\s+", " ", body_text).strip()
    else:
        body_text = body_content

    # Create inbox item
    inbox_item = supabase.table("inbox_items").insert({
        "organization_id": org["id"],
        "email_message_id": graph_message_id,
        "email_conversation_id": message.get("conversationId"),
        "email_subject": message.get("subject"),
        "email_from": from_address,
        "email_to": ", ".join(to_addresses),
        "email_body": body_text,
        "email_received_at": message.get("receivedDateTime"),
        "status": "processing",
    }).execute()

    inbox_item_id = inbox_item.data[0]["id"]

    # Process attachments
    for attachment in message.get("attachments", []):
        if attachment.get("@odata.type") == "#microsoft.graph.fileAttachment":
            import base64

            content = base64.b64decode(attachment.get("contentBytes", ""))
            file_name = attachment.get("name", "attachment")
            content_type = attachment.get("contentType", "")

            # Determine file type
            file_type = "other"
            if "pdf" in content_type.lower() or file_name.lower().endswith(".pdf"):
                file_type = "pdf"
            elif any(ext in file_name.lower() for ext in [".jpg", ".jpeg", ".png", ".tiff"]):
                file_type = "image"
            elif file_name.lower().endswith(".csv"):
                file_type = "csv"

            # Upload to Supabase Storage
            storage_path = f"{org['id']}/{inbox_item_id}/{file_name}"
            supabase.storage.from_("documents").upload(
                storage_path, content
            )

            # Create document record
            supabase.table("documents").insert({
                "inbox_item_id": inbox_item_id,
                "file_path": storage_path,
                "file_name": file_name,
                "file_type": file_type,
                "file_size": len(content),
            }).execute()

    logger.info("Ingested email %s → inbox item %s", graph_message_id, inbox_item_id)

    # Trigger AI pipeline
    from app.tasks.pipeline import process_inbox_item

    process_inbox_item.delay(inbox_item_id, org["id"])

    return {"status": "ingested", "inbox_item_id": inbox_item_id}


async def _poll_emails(organization_id: str) -> dict:
    """Poll for new emails using Graph API delta query."""
    from supabase import create_client

    supabase = create_client(settings.supabase_url, settings.supabase_service_role_key)

    org = supabase.table("organizations").select("*").eq(
        "id", organization_id
    ).single().execute()
    org_data = org.data

    if not org_data.get("inbox_email"):
        return {"status": "no_inbox_configured"}

    graph = GraphClient(tenant_id=org_data.get("ms365_tenant_id"))
    messages = await graph.get_messages(
        user_id=org_data["inbox_email"], top=20
    )

    ingested_count = 0
    for message in messages:
        msg_id = message.get("id")
        existing = supabase.table("inbox_items").select("id").eq(
            "email_message_id", msg_id
        ).execute()

        if not existing.data:
            await _ingest_email(org_data["inbox_email"], msg_id)
            ingested_count += 1

    logger.info("Polling complete for org %s: %d new emails", organization_id, ingested_count)
    return {"status": "polled", "new_count": ingested_count}
