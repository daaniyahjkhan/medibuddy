# 🩺 MediBuddy — AI Medical Report Analyser

A demo Flask web app that uses **Google Gemini** to analyse medical reports (PDFs & images)
and explains findings in plain language, with Hindi & Telugu translations.

---

## 📁 Project Structure

```
medibuddy/
├── app.py                  # Flask backend (routes, CORS, orchestration)
├── requirements.txt        # Python dependencies
├── utils/
│   ├── __init__.py
│   ├── extractor.py        # PDF text extraction (PyPDF2) / image passthrough
│   ├── analyzer.py         # Gemini 2-step analysis (plain text → JSON)
│   └── translator.py       # Hindi & Telugu translation via Gemini
└── templates/
    └── index.html          # Vanilla HTML/CSS/JS frontend
```

---

## ⚡ Quick Start

### 1. Clone / download the project

```bash
cd medibuddy
```

### 2. Create a virtual environment (recommended)

```bash
python -m venv venv
source venv/bin/activate      # macOS/Linux
venv\Scripts\activate         # Windows
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

### 4. Set your Gemini API key

Get a free API key from https://aistudio.google.com/app/apikey

```bash
# macOS / Linux
export GEMINI_API_KEY="your-key-here"

# Windows (Command Prompt)
set GEMINI_API_KEY=your-key-here

# Windows (PowerShell)
$env:GEMINI_API_KEY="your-key-here"
```

### 5. Run the server

```bash
python app.py
```

Visit: **http://localhost:5000**

---

## 🔌 API Endpoints

| Method | Route     | Description                          |
|--------|-----------|--------------------------------------|
| GET    | /health   | Server status check                  |
| POST   | /upload   | Upload PDF/image, returns JSON analysis |

### POST /upload — Response Format

```json
{
  "patient_profile": "...",
  "key_findings": "...",
  "diagnosis": "...",
  "recommendations": "...",
  "simple_explanation": "...",
  "concern_level": "low | medium | high",
  "color_code": "green | yellow | red",
  "translations": {
    "hindi": "...",
    "telugu": "..."
  }
}
```

---

## 📋 Supported File Types

| Type | Method |
|------|--------|
| PDF  | PyPDF2 text extraction |
| JPG / JPEG / PNG | Gemini Vision (OCR + analysis) |

Max file size: **10 MB**

---

## ⚠️ Disclaimer

MediBuddy is a **demo project** for educational purposes only.
It does not provide medical advice. Always consult a qualified healthcare professional.
