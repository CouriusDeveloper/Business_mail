"""Step 1: Document classification using Claude Haiku."""

import json
import logging

import anthropic

from app.config import settings
from app.models.schemas import ClassificationResult, DocumentType

logger = logging.getLogger(__name__)

CLASSIFICATION_PROMPT = """Du bist ein Experte für die Klassifikation von Geschäftskorrespondenz.
Analysiere die folgende E-Mail und klassifiziere den Dokumenttyp.

Mögliche Typen:
- incoming_invoice: Eingangsrechnung (Rechnung an uns)
- outgoing_invoice: Ausgangsrechnung (Rechnung von uns an Kunden)
- credit_note: Gutschrift
- contract: Vertrag oder Vereinbarung
- general_correspondence: Allgemeine Geschäftskorrespondenz
- irrelevant: Newsletter, Werbung, Spam, automatische Benachrichtigungen

E-Mail:
Betreff: {subject}
Von: {from_address}
An: {to_address}

Inhalt:
{body}

Anhänge: {attachments}

Bekannte Unternehmen im System:
{companies}

Antworte im JSON-Format:
{{
    "document_type": "<type>",
    "company_id": "<uuid oder null>",
    "company_confidence": <0.0-1.0>,
    "reasoning": "<kurze Begründung>"
}}"""


async def classify_email(
    subject: str | None,
    from_address: str | None,
    to_address: str | None,
    body: str | None,
    attachment_names: list[str],
    known_companies: list[dict],
) -> ClassificationResult:
    """Classify an email using Claude Haiku."""
    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)

    companies_str = "\n".join(
        f"- {c['name']} (ID: {c['id']}, USt-ID: {c.get('tax_id', 'N/A')})"
        for c in known_companies
    ) or "Keine Unternehmen konfiguriert"

    prompt = CLASSIFICATION_PROMPT.format(
        subject=subject or "(kein Betreff)",
        from_address=from_address or "(unbekannt)",
        to_address=to_address or "(unbekannt)",
        body=(body or "(kein Inhalt)")[:3000],  # Limit body length
        attachments=", ".join(attachment_names) if attachment_names else "Keine",
        companies=companies_str,
    )

    message = await client.messages.create(
        model="claude-haiku-4-5-20241022",
        max_tokens=512,
        messages=[{"role": "user", "content": prompt}],
    )

    response_text = message.content[0].text
    logger.info("Classification response: %s", response_text)

    try:
        result = json.loads(response_text)
        return ClassificationResult(**result)
    except (json.JSONDecodeError, ValueError) as e:
        logger.error("Failed to parse classification response: %s", e)
        return ClassificationResult(
            document_type=DocumentType.GENERAL_CORRESPONDENCE,
            company_confidence=0.0,
            reasoning=f"Parse error: {e}",
        )
