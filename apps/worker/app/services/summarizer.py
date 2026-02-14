"""Step 3: Document/email summarization using Claude Haiku."""

import json
import logging

import anthropic

from app.config import settings
from app.models.schemas import SummaryResult

logger = logging.getLogger(__name__)

SUMMARY_PROMPT = """Du bist ein Experte für die Zusammenfassung von Geschäftskorrespondenz.
Erstelle eine kurze, prägnante Zusammenfassung (2-3 Sätze) des folgenden Dokuments/E-Mail.

Bei Rechnungen: Betrag, Absender, wofür.
Bei Verträgen: Parteien, Gegenstand, wichtige Termine.
Bei Korrespondenz: Kernaussage und erforderliche Aktion.

Dokumenttyp: {document_type}

E-Mail-Betreff: {subject}
E-Mail-Inhalt:
{body}

{extracted_data_section}

Antworte im JSON-Format:
{{
    "summary": "<2-3 Sätze Zusammenfassung>",
    "required_action": "<erforderliche Aktion oder null>"
}}"""


async def summarize_document(
    document_type: str,
    subject: str | None,
    body: str | None,
    extracted_data: dict | None = None,
) -> SummaryResult:
    """Generate a summary for a document/email using Claude Haiku."""
    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)

    extracted_section = ""
    if extracted_data:
        extracted_section = f"Extrahierte Daten:\n{json.dumps(extracted_data, indent=2, ensure_ascii=False)}"

    prompt = SUMMARY_PROMPT.format(
        document_type=document_type,
        subject=subject or "(kein Betreff)",
        body=(body or "(kein Inhalt)")[:3000],
        extracted_data_section=extracted_section,
    )

    message = await client.messages.create(
        model="claude-haiku-4-5-20241022",
        max_tokens=512,
        messages=[{"role": "user", "content": prompt}],
    )

    response_text = message.content[0].text
    logger.info("Summary response: %s", response_text)

    try:
        result = json.loads(response_text)
        return SummaryResult(**result)
    except (json.JSONDecodeError, ValueError) as e:
        logger.error("Failed to parse summary response: %s", e)
        return SummaryResult(summary="Zusammenfassung konnte nicht erstellt werden.")
