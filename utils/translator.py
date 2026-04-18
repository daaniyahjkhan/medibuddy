"""
utils/translator.py
Translates the simple_explanation field into Hindi and Telugu using Gemini.
"""
import os
import json
import logging
import re

logger = logging.getLogger(__name__)


def translate_explanation(text: str) -> dict:
    """
    Returns {"hindi": "...", "telugu": "..."}
    """
    if not text or not text.strip():
        return {
            "hindi": "कोई जानकारी उपलब्ध नहीं है।",
            "telugu": "సమాచారం అందుబాటులో లేదు."
        }

    try:
        import google.generativeai as genai
    except ImportError:
        logger.warning("google-generativeai not available for translation")
        return {"hindi": text, "telugu": text}

    api_key = os.environ.get("GEMINI_API_KEY", "")
    if not api_key:
        return {"hindi": text, "telugu": text}

    genai.configure(api_key=api_key)
    model = genai.GenerativeModel("gemini-2.5-flash")

    prompt = f"""Translate the following health explanation into two Indian languages.
Return ONLY valid JSON, no markdown, no extra text.

Required format:
{{
  "hindi": "<full translation in Hindi, using Devanagari script>",
  "telugu": "<full translation in Telugu, using Telugu script>"
}}

Text to translate:
\"\"\"{text}\"\"\"

Important:
- Use natural, everyday language that a common person can understand
- Keep the warm, reassuring tone
- Complete full sentences only"""

    logger.info("Requesting Hindi + Telugu translations…")
    response = model.generate_content(prompt)
    raw = response.text.strip()

    raw = re.sub(r"^```json\s*", "", raw)
    raw = re.sub(r"^```\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)
    raw = raw.strip()

    try:
        translations = json.loads(raw)
        logger.info("Translations parsed successfully")
        return {
            "hindi": translations.get("hindi", "हिंदी अनुवाद उपलब्ध नहीं है।"),
            "telugu": translations.get("telugu", "తెలుగు అనువాదం అందుబాటులో లేదు.")
        }
    except json.JSONDecodeError as e:
        logger.error(f"Translation JSON parse error: {e}")
        return {
            "hindi": "हिंदी अनुवाद अभी उपलब्ध नहीं है।",
            "telugu": "తెలుగు అనువాదం ప్రస్తుతం అందుబాటులో లేదు."
        }
