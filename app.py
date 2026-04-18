from dotenv import load_dotenv
load_dotenv()
import os
import logging
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from utils.extractor import extract_text
from utils.analyzer import analyze_with_gemini
from utils.translator import translate_explanation

# ── Logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

# ── App ───────────────────────────────────────────────────────────────────────
app = Flask(__name__)
CORS(app)

ALLOWED_EXTENSIONS = {"pdf", "jpg", "jpeg", "png"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


# ── Routes ────────────────────────────────────────────────────────────────────
@app.route("/")
def index():
    return render_template("index.html")


@app.route("/health", methods=["GET"])
def health():
    logger.info("Health check requested")
    return jsonify({"status": "ok", "message": "MediBuddy API is running 🩺"})


@app.route("/upload", methods=["POST"])
def upload():
    logger.info("=== /upload called ===")

    # ── Validate file presence ────────────────────────────────────────────────
    if "file" not in request.files:
        logger.warning("No file part in request")
        return jsonify({"error": "No file provided. Please upload a PDF or image."}), 400

    file = request.files["file"]

    if file.filename == "":
        logger.warning("Empty filename")
        return jsonify({"error": "No file selected. Please choose a file before uploading."}), 400

    if not allowed_file(file.filename):
        logger.warning(f"Invalid file type: {file.filename}")
        return jsonify({"error": "Unsupported file type. Please upload a PDF, JPG, JPEG, or PNG."}), 415

    file_bytes = file.read()
    if len(file_bytes) == 0:
        return jsonify({"error": "The uploaded file is empty. Please upload a valid medical report."}), 400

    if len(file_bytes) > MAX_FILE_SIZE:
        return jsonify({"error": "File too large. Maximum allowed size is 10 MB."}), 413

    ext = file.filename.rsplit(".", 1)[1].lower()
    logger.info(f"Processing file: {file.filename} ({ext.upper()}, {len(file_bytes)//1024} KB)")

    # ── Extract text ──────────────────────────────────────────────────────────
    try:
        extracted_text, image_bytes = extract_text(file_bytes, ext)
        logger.info(f"Extracted {len(extracted_text)} characters of text")
    except Exception as e:
        logger.error(f"Extraction error: {e}")
        return jsonify({"error": f"Could not read the file: {str(e)}"}), 500

    # ── AI analysis ───────────────────────────────────────────────────────────
    try:
        result = analyze_with_gemini(extracted_text, image_bytes, ext)
        logger.info(f"Analysis complete. Concern level: {result.get('concern_level', 'unknown')}")
    except Exception as e:
        logger.error(f"AI analysis error: {e}")
        return jsonify({"error": f"AI analysis failed: {str(e)}"}), 500

    # ── Translations ──────────────────────────────────────────────────────────
    try:
        simple = result.get("simple_explanation", "")
        translations = translate_explanation(simple)
        result["translations"] = translations
        logger.info("Translations added successfully")
    except Exception as e:
        logger.warning(f"Translation error (non-fatal): {e}")
        result["translations"] = {
            "hindi": "अनुवाद उपलब्ध नहीं है।",
            "telugu": "అనువాదం అందుబాటులో లేదు."
        }

    return jsonify(result), 200


@app.route("/medicine", methods=["POST"])
def medicine_search():
    logger.info("=== /medicine called ===")
    data = request.get_json()
    if not data or not data.get("name"):
        return jsonify({"error": "No medicine name provided."}), 400

    medicine_name = data["name"].strip()
    if len(medicine_name) < 2:
        return jsonify({"error": "Please enter a valid medicine name."}), 400

    try:
        from utils.medicine import analyze_medicine
        result = analyze_medicine(medicine_name)
        return jsonify(result), 200
    except Exception as e:
        logger.error(f"Medicine search error: {e}")
        return jsonify({"error": f"Medicine lookup failed: {str(e)}"}), 500

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    logger.info(f"Starting MediBuddy on http://localhost:{port}")
    app.run(debug=True, port=port)
