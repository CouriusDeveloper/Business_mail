"""FastAPI application for the AI pipeline worker.

Exposes:
- POST /webhooks/graph: Microsoft Graph API webhook receiver
- POST /api/process/{inbox_item_id}: Manual pipeline trigger
- GET /health: Health check
"""

import logging

from fastapi import FastAPI, Request, Response

from app.tasks.ingestion import process_webhook_notification
from app.tasks.pipeline import process_inbox_item

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Business Inbox Agent Worker",
    description="AI pipeline worker for document processing",
    version="0.1.0",
)


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "ok", "service": "inbox-agent-worker"}


@app.post("/webhooks/graph")
async def graph_webhook(request: Request):
    """Receive Microsoft Graph API webhook notifications.

    Graph API sends a validation request (with validationToken query param)
    on subscription creation, which must be echoed back as plain text.
    """
    # Handle validation request
    validation_token = request.query_params.get("validationToken")
    if validation_token:
        return Response(content=validation_token, media_type="text/plain")

    body = await request.json()
    notifications = body.get("value", [])

    for notification in notifications:
        # Verify client state
        if notification.get("clientState") != "inbox-agent-webhook":
            logger.warning("Invalid client state in webhook notification")
            continue

        # Queue processing
        process_webhook_notification.delay(notification)

    return {"status": "accepted"}


@app.post("/api/process/{inbox_item_id}")
async def trigger_processing(inbox_item_id: str, organization_id: str):
    """Manually trigger AI pipeline processing for an inbox item."""
    process_inbox_item.delay(inbox_item_id, organization_id)
    return {"status": "queued", "inbox_item_id": inbox_item_id}
