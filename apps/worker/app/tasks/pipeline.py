"""Main AI processing pipeline for inbox items.

Pipeline Steps:
1. Classification (Claude Haiku) → document type + company assignment
2. Extraction (GPT-4o Vision) → structured data from PDF/images
3. Summarization (Claude Haiku) → 2-3 sentence summary

Runs as a Celery task, triggered by email ingestion.
"""

import logging

from celery import Celery

from app.config import settings
from app.models.schemas import DocumentType, InboxItemStatus
from app.services.classifier import classify_email
from app.services.extractor import extract_document_data
from app.services.summarizer import summarize_document

logger = logging.getLogger(__name__)

celery_app = Celery("inbox-agent", broker=settings.redis_url)
celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="Europe/Berlin",
    enable_utc=True,
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    task_default_retry_delay=60,
    task_max_retries=3,
)


@celery_app.task(bind=True, max_retries=3)
def process_inbox_item(self, inbox_item_id: str, organization_id: str) -> dict:
    """Process a single inbox item through the AI pipeline.

    This is the main entry point, called after email ingestion.
    """
    import asyncio

    try:
        return asyncio.run(
            _process_inbox_item_async(inbox_item_id, organization_id)
        )
    except Exception as exc:
        logger.error("Pipeline failed for item %s: %s", inbox_item_id, exc)
        # Update status to error
        asyncio.run(_update_item_status(inbox_item_id, "error"))
        raise self.retry(exc=exc)


async def _process_inbox_item_async(
    inbox_item_id: str, organization_id: str
) -> dict:
    """Async implementation of the processing pipeline."""
    from supabase import create_client

    supabase = create_client(settings.supabase_url, settings.supabase_service_role_key)

    # Fetch inbox item with documents
    item_response = supabase.table("inbox_items").select(
        "*, documents(*)"
    ).eq("id", inbox_item_id).single().execute()
    item = item_response.data

    # Fetch known companies for classification
    companies_response = supabase.table("companies").select(
        "id, name, tax_id"
    ).eq("organization_id", organization_id).execute()
    companies = companies_response.data

    # ─── Step 1: Classification ───────────────────────────────
    logger.info("Step 1: Classifying item %s", inbox_item_id)

    attachment_names = [
        doc["file_name"] for doc in (item.get("documents") or []) if doc.get("file_name")
    ]

    classification = await classify_email(
        subject=item.get("email_subject"),
        from_address=item.get("email_from"),
        to_address=item.get("email_to"),
        body=item.get("email_body"),
        attachment_names=attachment_names,
        known_companies=companies,
    )

    # Update item with classification
    update_data = {
        "type": classification.document_type.value,
        "company_id": classification.company_id,
        "company_confidence": float(classification.company_confidence),
    }

    # Skip irrelevant items
    if classification.document_type == DocumentType.IRRELEVANT:
        update_data["status"] = InboxItemStatus.READY_FOR_REVIEW.value
        update_data["summary"] = f"Als irrelevant klassifiziert: {classification.reasoning}"
        supabase.table("inbox_items").update(update_data).eq("id", inbox_item_id).execute()
        return {"status": "classified_irrelevant"}

    # ─── Step 2: Extraction (for documents with attachments) ──
    documents = item.get("documents") or []
    extraction_data = None

    for doc in documents:
        if doc.get("file_type") in ("pdf", "image", "png", "jpg", "jpeg", "tiff"):
            logger.info("Step 2: Extracting data from document %s", doc["id"])

            # Download file from Supabase Storage
            file_content = supabase.storage.from_("documents").download(doc["file_path"])

            extraction = await extract_document_data(
                file_content=file_content,
                file_type=doc.get("file_type", "pdf"),
            )
            extraction_data = extraction.model_dump()

            # Update document with extracted data
            supabase.table("documents").update({
                "extracted_data": extraction_data,
                "field_confidences": extraction.field_confidences,
                "extraction_model": "gpt-4o",
            }).eq("id", doc["id"]).execute()

            break  # Process primary document only

    # ─── Step 3: Summarization ────────────────────────────────
    logger.info("Step 3: Summarizing item %s", inbox_item_id)

    summary = await summarize_document(
        document_type=classification.document_type.value,
        subject=item.get("email_subject"),
        body=item.get("email_body"),
        extracted_data=extraction_data,
    )

    # Calculate overall confidence
    overall_confidence = classification.company_confidence
    if extraction_data and extraction_data.get("field_confidences"):
        field_scores = list(extraction_data["field_confidences"].values())
        if field_scores:
            avg_extraction = sum(field_scores) / len(field_scores)
            overall_confidence = (overall_confidence + avg_extraction) / 2

    # Final update
    update_data["summary"] = summary.summary
    update_data["overall_confidence"] = round(overall_confidence, 2)
    update_data["status"] = InboxItemStatus.READY_FOR_REVIEW.value
    update_data["processed_at"] = "now()"

    supabase.table("inbox_items").update(update_data).eq("id", inbox_item_id).execute()

    logger.info("Pipeline complete for item %s: type=%s, confidence=%.2f",
                inbox_item_id, classification.document_type.value, overall_confidence)

    return {
        "status": "processed",
        "type": classification.document_type.value,
        "confidence": overall_confidence,
    }


async def _update_item_status(inbox_item_id: str, status: str) -> None:
    """Update inbox item status (for error handling)."""
    from supabase import create_client

    supabase = create_client(settings.supabase_url, settings.supabase_service_role_key)
    supabase.table("inbox_items").update({"status": status}).eq("id", inbox_item_id).execute()
