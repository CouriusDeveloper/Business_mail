"""Pydantic models matching the database schema and AI pipeline I/O."""

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class DocumentType(str, Enum):
    INCOMING_INVOICE = "incoming_invoice"
    OUTGOING_INVOICE = "outgoing_invoice"
    CREDIT_NOTE = "credit_note"
    CONTRACT = "contract"
    GENERAL_CORRESPONDENCE = "general_correspondence"
    IRRELEVANT = "irrelevant"


class InboxItemStatus(str, Enum):
    PROCESSING = "processing"
    READY_FOR_REVIEW = "ready_for_review"
    APPROVED = "approved"
    REJECTED = "rejected"
    UNCLEAR = "unclear"
    ERROR = "error"


# ─── AI Pipeline Output Models ────────────────────────────────


class ClassificationResult(BaseModel):
    """Output from Step 1: Classification (Claude Haiku)."""

    document_type: DocumentType
    company_id: Optional[str] = None
    company_confidence: float = Field(ge=0.0, le=1.0)
    reasoning: str


class ExtractedLineItem(BaseModel):
    """Single line item from an invoice."""

    position: int
    description: str
    quantity: Optional[float] = None
    unit_price: Optional[float] = None
    total_price: Optional[float] = None


class ExtractionResult(BaseModel):
    """Output from Step 2: Data Extraction (GPT-4o Vision)."""

    invoice_number: Optional[str] = None
    invoice_date: Optional[str] = None
    net_amount: Optional[float] = None
    vat_rate: Optional[float] = None
    vat_amount: Optional[float] = None
    gross_amount: Optional[float] = None
    supplier_name: Optional[str] = None
    customer_name: Optional[str] = None
    vat_id: Optional[str] = None
    iban: Optional[str] = None
    payment_terms: Optional[str] = None
    due_date: Optional[str] = None
    line_items: list[ExtractedLineItem] = []
    field_confidences: dict[str, float] = {}


class SummaryResult(BaseModel):
    """Output from Step 3: Summarization (Claude Haiku)."""

    summary: str
    required_action: Optional[str] = None


# ─── Email Ingestion Models ──────────────────────────────────


class EmailAttachment(BaseModel):
    """Attachment metadata from Microsoft Graph API."""

    id: str
    name: str
    content_type: str
    size: int
    content_bytes: Optional[bytes] = None


class IngestedEmail(BaseModel):
    """Parsed email from Microsoft Graph API."""

    message_id: str
    conversation_id: Optional[str] = None
    subject: Optional[str] = None
    from_address: Optional[str] = None
    to_address: Optional[str] = None
    body_text: Optional[str] = None
    received_at: Optional[datetime] = None
    attachments: list[EmailAttachment] = []
