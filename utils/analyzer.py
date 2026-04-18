"""
utils/analyzer.py
Two-step Gemini analysis:
  Step 1 – Generate rich plain-text analysis (multiple expert roles)
  Step 2 – Convert to structured JSON
"""
import os
import json
import base64
import logging
import re

logger = logging.getLogger(__name__)

# ── Gemini client ─────────────────────────────────────────────────────────────
def _get_model():
    try:
        import google.generativeai as genai
    except ImportError:
        raise RuntimeError("google-generativeai not installed. Run: pip install google-generativeai")

    api_key = os.environ.get("GEMINI_API_KEY", "")
    if not api_key:
        raise RuntimeError(
            "GEMINI_API_KEY environment variable is not set. "
            "Export it before starting the server."
        )
    genai.configure(api_key=api_key)
    return genai.GenerativeModel("gemini-2.5-flash")

# ── Prompts ───────────────────────────────────────────────────────────────────
STEP1_SYSTEM = """You are a panel of three highly experienced medical experts analysing a patient's medical report:

1. ** Blood Test & Lab Analyst**
   Focus: Lab values, reference ranges, abnormalities, trends.

2. ** Medical Research Specialist**
   Focus: Clinical context, differential considerations, evidence-based interpretation.

3. ** Holistic Health Advisor**
   Focus: Lifestyle, diet, practical safe advice, emotional reassurance.

TASK:
Read the report content carefully. Then write a DETAILED, COMPASSIONATE analysis with the following clearly labeled sections:

REPORT TYPE: (identify what kind of report this is)

PATIENT PROFILE:
(2-3 sentences about the patient based on available info)

KEY FINDINGS:
(List every measured value, its result, normal range, and whether it is LOW / NORMAL / HIGH. Be thorough.)

DIAGNOSIS / INTERPRETATION:
(2-4 sentences of clinical interpretation — what do the findings collectively suggest?)

RECOMMENDATIONS:
(At least 4 actionable, safe, practical recommendations)

SIMPLE EXPLANATION:
(3-4 sentences in very plain language that a 10-year-old could understand. No jargon.)

CONCERN LEVEL:
(Exactly one word: low / medium / high)

Use complete sentences throughout. Be thorough, warm, and non-alarmist."""


STEP2_SYSTEM = """You are a JSON formatter. Convert the medical analysis text below into EXACTLY this JSON structure.
Every field MUST be 2-4 complete, rich sentences. Do NOT shorten or summarise — preserve all detail.
Return ONLY valid JSON, no markdown fences, no extra text.

Required JSON shape:
{
  "patient_profile": "...",
  "key_findings": "...",
  "diagnosis": "...",
  "recommendations": "...",
  "simple_explanation": "...",
  "concern_level": "low | medium | high",
  "color_code": "green | yellow | red"
}

Rules:
- concern_level low   → color_code green
- concern_level medium → color_code yellow
- concern_level high  → color_code red
- All string values must be plain text (no markdown inside strings)
- key_findings: explicitly mention each abnormal value and whether it is high or low
- recommendations: at least 3-4 clear action items separated by '. '"""


# ── Main entry ────────────────────────────────────────────────────────────────
def analyze_with_gemini(text: str, image_bytes: bytes | None, ext: str) -> dict:
    model = _get_model()

    # ── Step 1: Rich plain-text analysis ─────────────────────────────────────
    logger.info("Step 1: Generating detailed plain-text analysis…")
    step1_result = _run_step1(model, text, image_bytes, ext)
    logger.info(f"Step 1 complete ({len(step1_result)} chars)")

    # ── Step 2: Convert to JSON ───────────────────────────────────────────────
    logger.info("Step 2: Converting to structured JSON…")
    result = _run_step2(model, step1_result)
    logger.info("Step 2 complete — structured JSON ready")

    return result


def _run_step1(model, text: str, image_bytes: bytes | None, ext: str) -> str:
    import google.generativeai as genai

    if image_bytes:
        # Image: send bytes directly so Gemini does OCR + analysis
        mime = f"image/{'jpeg' if ext in ('jpg','jpeg') else ext}"
        image_part = {
            "inline_data": {
                "mime_type": mime,
                "data": base64.b64encode(image_bytes).decode()
            }
        }
        prompt_parts = [
            STEP1_SYSTEM + "\n\nAnalyse the medical report shown in this image:",
            image_part
        ]
    else:
        prompt_parts = [
            STEP1_SYSTEM + f"\n\nHere is the extracted text from the medical report:\n\n{text}"
        ]

    response = model.generate_content(prompt_parts)
    return response.text.strip()


def _run_step2(model, plain_text: str) -> dict:
    prompt = f"{STEP2_SYSTEM}\n\n--- ANALYSIS TEXT ---\n{plain_text}"
    response = model.generate_content(prompt)
    raw = response.text.strip()

    # Strip possible markdown fences
    raw = re.sub(r"^```json\s*", "", raw)
    raw = re.sub(r"^```\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)
    raw = raw.strip()

    try:
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        logger.error(f"JSON parse error: {e}\nRaw output:\n{raw[:500]}")
        # Fallback: build a safe dict from the plain text
        data = _fallback_dict(plain_text)

    # Ensure color_code is consistent
    cl = data.get("concern_level", "low").lower()
    data["concern_level"] = cl
    data["color_code"] = {"low": "green", "medium": "yellow", "high": "red"}.get(cl, "green")

    return data


def _fallback_dict(plain_text: str) -> dict:
    """Emergency fallback when JSON parsing fails."""
    logger.warning("Using fallback dict construction")
    return {
        "patient_profile": "Report processed successfully. Please see the full findings below.",
        "key_findings": plain_text[:600],
        "diagnosis": "Please review the detailed analysis above for full interpretation.",
        "recommendations": "Consult your healthcare provider with these results for personalised advice.",
        "simple_explanation": "Your medical report has been analysed. Please share results with your doctor.",
        "concern_level": "medium",
        "color_code": "yellow"
    }
