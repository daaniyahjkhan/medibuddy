"""
utils/medicine.py
Looks up medicine info using Gemini — what it does, side effects, warnings.
"""
import os
import json
import logging
import re

logger = logging.getLogger(__name__)

MEDICINE_PROMPT = """You are a clinical pharmacist and medical educator. A patient wants to understand a medicine they have been prescribed.

Medicine name: "{medicine}"

Provide a thorough, patient-friendly explanation. Return ONLY valid JSON, no markdown fences, no extra text.

{{
  "medicine_name": "official/full name of the medicine",
  "also_known_as": "common brand names or generic equivalents, comma separated",
  "medicine_class": "what category/class of drug this is",
  "what_it_does": "2-3 sentences explaining the mechanism and purpose in simple language. What does it do inside the body?",
  "common_uses": "2-3 sentences listing what conditions/symptoms it treats",
  "how_to_take": "2-3 sentences on dosage guidance, timing, with food or without, etc.",
  "common_side_effects": "List the 5-6 most common side effects as a plain sentence each, separated by | character",
  "serious_side_effects": "List 3-4 serious/rare side effects to watch for, separated by | character",
  "warnings": "2-3 sentences on who should avoid it, drug interactions, or special precautions",
  "simple_explanation": "3-4 sentences in very plain language a non-medical person can understand. Use an analogy if helpful.",
  "concern_level": "low | medium | high  (based on how strong/risky this medicine typically is)"
}}

Rules:
- If the medicine name is not recognized or not a real medicine, set medicine_name to "Unknown" and explain in what_it_does
- Be accurate, warm, and non-alarmist
- No markdown inside string values"""


def analyze_medicine(medicine_name: str) -> dict:
    try:
        import google.generativeai as genai
    except ImportError:
        raise RuntimeError("google-generativeai not installed.")

    api_key = os.environ.get("GEMINI_API_KEY", "")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY not set.")

    genai.configure(api_key=api_key)
    model = genai.GenerativeModel("gemini-2.5-flash")

    prompt = MEDICINE_PROMPT.format(medicine=medicine_name)
    logger.info(f"Looking up medicine: {medicine_name}")

    response = model.generate_content(prompt)
    raw = response.text.strip()

    raw = re.sub(r"^```json\s*", "", raw)
    raw = re.sub(r"^```\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)
    raw = raw.strip()

    try:
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        logger.error(f"Medicine JSON parse error: {e}")
        return {
            "medicine_name": medicine_name,
            "error": "Could not parse medicine information. Please try again."
        }

    # Normalize concern level
    cl = data.get("concern_level", "low").lower()
    data["concern_level"] = cl
    data["color_code"] = {"low": "green", "medium": "yellow", "high": "red"}.get(cl, "green")

    return data