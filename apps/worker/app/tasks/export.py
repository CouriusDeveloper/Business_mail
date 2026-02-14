"""Export tasks: Forward original PDFs to DATEV Upload Mail or OneDrive."""

import logging
from datetime import datetime

from celery import Celery

from app.config import settings
from app.services.graph_client import GraphClient

logger = logging.getLogger(__name__)

celery_app = Celery("inbox-agent", broker=settings.redis_url)


@celery_app.task(bind=True, max_retries=3)
def export_to_datev(
    self,
    inbox_item_id: str,
    organization_id: str,
    company_id: str,
) -> dict:
    """Export original PDF to DATEV Upload Mail."""
    import asyncio

    try:
        return asyncio.run(
            _export_to_datev_async(inbox_item_id, organization_id, company_id)
        )
    except Exception as exc:
        logger.error("DATEV export failed for item %s: %s", inbox_item_id, exc)
        raise self.retry(exc=exc, countdown=60)


async def _export_to_datev_async(
    inbox_item_id: str, organization_id: str, company_id: str
) -> dict:
    """Forward original PDF to DATEV Upload Mail via Graph API."""
    from supabase import create_client

    supabase = create_client(settings.supabase_url, settings.supabase_service_role_key)

    # Fetch company config
    company = supabase.table("companies").select("*").eq("id", company_id).single().execute()
    company_data = company.data

    if not company_data.get("datev_upload_email"):
        raise ValueError(f"No DATEV Upload Mail configured for company {company_id}")

    # Fetch organization for inbox email
    org = supabase.table("organizations").select("*").eq("id", organization_id).single().execute()
    org_data = org.data

    # Fetch primary document
    doc = supabase.table("documents").select("*").eq(
        "inbox_item_id", inbox_item_id
    ).limit(1).execute()

    if not doc.data:
        raise ValueError(f"No documents found for inbox item {inbox_item_id}")

    document = doc.data[0]

    # Download original PDF from Supabase Storage
    file_content = supabase.storage.from_("documents").download(document["file_path"])

    # Send via Graph API
    graph = GraphClient()
    await graph.send_email(
        user_id=org_data["inbox_email"],
        to_address=company_data["datev_upload_email"],
        subject=f"Beleg: {document.get('file_name', 'document.pdf')}",
        body="Automatisch weitergeleitet durch Business Inbox Agent.",
        attachment_name=document.get("file_name", "document.pdf"),
        attachment_content=file_content,
    )

    # Log export
    supabase.table("export_log").insert({
        "inbox_item_id": inbox_item_id,
        "company_id": company_id,
        "export_target": "datev_upload_mail",
        "export_status": "sent",
        "target_address": company_data["datev_upload_email"],
    }).execute()

    # Update inbox item
    supabase.table("inbox_items").update({
        "exported_at": datetime.utcnow().isoformat(),
    }).eq("id", inbox_item_id).execute()

    logger.info("DATEV export complete for item %s → %s",
                inbox_item_id, company_data["datev_upload_email"])

    return {"status": "sent", "target": company_data["datev_upload_email"]}


@celery_app.task(bind=True, max_retries=3)
def export_to_onedrive(
    self,
    inbox_item_id: str,
    organization_id: str,
    company_id: str,
) -> dict:
    """Export original PDF to OneDrive folder."""
    import asyncio

    try:
        return asyncio.run(
            _export_to_onedrive_async(inbox_item_id, organization_id, company_id)
        )
    except Exception as exc:
        logger.error("OneDrive export failed for item %s: %s", inbox_item_id, exc)
        raise self.retry(exc=exc, countdown=60)


async def _export_to_onedrive_async(
    inbox_item_id: str, organization_id: str, company_id: str
) -> dict:
    """Upload original PDF to OneDrive via Graph API."""
    from supabase import create_client

    supabase = create_client(settings.supabase_url, settings.supabase_service_role_key)

    # Fetch company config
    company = supabase.table("companies").select("*").eq("id", company_id).single().execute()
    company_data = company.data

    if not company_data.get("onedrive_folder_path"):
        raise ValueError(f"No OneDrive path configured for company {company_id}")

    org = supabase.table("organizations").select("*").eq("id", organization_id).single().execute()
    org_data = org.data

    # Fetch document and extracted data for filename
    doc = supabase.table("documents").select("*, inbox_items(*)").eq(
        "inbox_item_id", inbox_item_id
    ).limit(1).execute()

    if not doc.data:
        raise ValueError(f"No documents found for inbox item {inbox_item_id}")

    document = doc.data[0]
    extracted = document.get("extracted_data") or {}

    # Build filename from schema
    now = datetime.utcnow()
    folder_path = f"{company_data['onedrive_folder_path'].rstrip('/')}/{now.year}/{now.month:02d}"

    schema = company_data.get("filename_schema", "{type}_{date}_{supplier}_{amount}")
    file_name = schema.format(
        type=document.get("inbox_items", {}).get("type", "doc"),
        date=now.strftime("%Y-%m-%d"),
        supplier=extracted.get("supplier_name", "unknown").replace("/", "-")[:30],
        amount=str(extracted.get("gross_amount", "0")).replace(".", "-"),
    ) + ".pdf"

    # Download and upload
    file_content = supabase.storage.from_("documents").download(document["file_path"])

    graph = GraphClient()
    await graph.upload_to_onedrive(
        user_id=org_data["inbox_email"],
        folder_path=folder_path,
        file_name=file_name,
        content=file_content,
    )

    # Log export
    supabase.table("export_log").insert({
        "inbox_item_id": inbox_item_id,
        "company_id": company_id,
        "export_target": "onedrive",
        "export_status": "sent",
        "target_address": f"{folder_path}/{file_name}",
    }).execute()

    supabase.table("inbox_items").update({
        "exported_at": datetime.utcnow().isoformat(),
    }).eq("id", inbox_item_id).execute()

    logger.info("OneDrive export complete for item %s → %s/%s",
                inbox_item_id, folder_path, file_name)

    return {"status": "sent", "path": f"{folder_path}/{file_name}"}
