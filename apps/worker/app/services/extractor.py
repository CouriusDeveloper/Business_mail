"""Step 2: Data extraction from documents using GPT-4o Vision."""

import base64
import json
import logging

import openai

from app.config import settings
from app.models.schemas import ExtractionResult

logger = logging.getLogger(__name__)

EXTRACTION_PROMPT = """Du bist ein Experte für die Extraktion strukturierter Daten aus Geschäftsdokumenten.
Analysiere das folgende Dokument und extrahiere alle relevanten Daten.

Extrahiere folgende Felder (falls vorhanden):
- invoice_number: Rechnungsnummer
- invoice_date: Rechnungsdatum (Format: YYYY-MM-DD)
- net_amount: Nettobetrag (Dezimalzahl)
- vat_rate: USt-Satz (z.B. 19, 7, 0)
- vat_amount: USt-Betrag (Dezimalzahl)
- gross_amount: Bruttobetrag (Dezimalzahl)
- supplier_name: Name des Lieferanten/Rechnungsstellers
- customer_name: Name des Empfängers/Kunden
- vat_id: USt-Identifikationsnummer
- iban: IBAN
- payment_terms: Zahlungsbedingungen (Text)
- due_date: Fälligkeitsdatum (Format: YYYY-MM-DD)
- line_items: Array von Rechnungspositionen mit position, description, quantity, unit_price, total_price

Für jedes Feld, gib auch einen Confidence-Score (0.0-1.0) an.

Plausibilitätsprüfung: Prüfe ob net_amount + vat_amount = gross_amount.

Antworte im JSON-Format:
{
    "invoice_number": "...",
    "invoice_date": "...",
    ...
    "line_items": [...],
    "field_confidences": {
        "invoice_number": 0.95,
        "invoice_date": 0.98,
        ...
    }
}"""


async def extract_document_data(
    file_content: bytes,
    file_type: str,
) -> ExtractionResult:
    """Extract structured data from a document image/PDF using GPT-4o Vision."""
    client = openai.AsyncOpenAI(api_key=settings.openai_api_key)

    # Encode file for vision API
    base64_content = base64.b64encode(file_content).decode("utf-8")
    media_type = "image/png" if file_type in ("png", "jpg", "jpeg") else "application/pdf"

    # For PDFs, GPT-4o Vision processes the first pages
    image_content = {
        "type": "image_url",
        "image_url": {
            "url": f"data:{media_type};base64,{base64_content}",
            "detail": "high",
        },
    }

    response = await client.chat.completions.create(
        model="gpt-4o",
        max_tokens=2048,
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": EXTRACTION_PROMPT},
                    image_content,
                ],
            }
        ],
        response_format={"type": "json_object"},
    )

    response_text = response.choices[0].message.content
    logger.info("Extraction response length: %d chars", len(response_text or ""))

    try:
        result = json.loads(response_text)
        return ExtractionResult(**result)
    except (json.JSONDecodeError, ValueError) as e:
        logger.error("Failed to parse extraction response: %s", e)
        return ExtractionResult(field_confidences={})
