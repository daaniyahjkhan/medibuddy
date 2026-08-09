# 🩺 MediBuddy

**MediBuddy** is an AI-powered healthcare assistant designed to make medical information more accessible, understandable, and easier to act on.

It brings together multiple healthcare utilities—from lab report analysis and medicine information to symptom checking, medication reminders, and emergency assistance—into a single platform.

> ⚠️ **Disclaimer:** MediBuddy is an educational project and is not a substitute for professional medical advice, diagnosis, or treatment.

---

## ✨ Features

### 🩺 Lab Report Analyzer

Upload a medical/lab report and get simplified explanations of the information in it.

- OCR-powered text extraction
- AI-assisted report analysis
- Multilingual explanations
- Supports **English, Hindi, and Telugu**

### 💊 Medicine Explainer

Get easy-to-understand information about medicines, including:

- Uses
- Dosage information
- Side effects
- General medicine information

### ⚠️ Drug Interaction Checker

Check medicines for potential interactions and receive an understandable explanation of the result.

### ⏰ Smart Medication Reminders

Set medication reminders and receive notifications through:

- Browser notifications
- Telegram
- WhatsApp

### 🧍 Interactive Body Map Symptom Checker

An interactive body map allows users to select an area of the body and explore symptoms with AI-assisted guidance.

### 📱 Medical Shorts

Access short, educational healthcare videos for quick and accessible learning.

### 🚑 Emergency SOS

Provides quick-access emergency assistance features including:

- Nearby hospital locator
- Emergency contacts
- CPR guidance

---

## 🛠️ Tech Stack

**Frontend**

- HTML
- CSS
- JavaScript

**Backend**

- Node.js
- Express.js
- Python

**AI & APIs**

- LLMs
- OCR
- Telegram Bot API
- YouTube Data API

---

## 🏗️ Project Structure

```text
medibuddy/
│
├── static/
│   ├── bodymap.js
│   ├── interaction.js
│   ├── script.js
│   ├── server.js
│   ├── shorts.js
│   ├── sos.js
│   ├── style.css
│   ├── package.json
│   └── package-lock.json
│
├── templates/
│   └── index.html
│
├── utils/
│   ├── __init__.py
│   ├── analyzer.py
│   ├── extractor.py
│   ├── medicine.py
│   └── translator.py
│
├── app.py
├── package.json
├── package-lock.json
├── requirements.txt
└── .gitignore
```

---

## 🚀 Getting Started

### 1. Clone the repository

```bash
git clone <repository-url>
cd medibuddy
```

### 2. Install Python dependencies

```bash
pip install -r requirements.txt
```

### 3. Install Node.js dependencies

```bash
npm install
```

If the frontend has its own dependencies:

```bash
cd static
npm install
cd ..
```

### 4. Configure environment variables

Create a `.env` file in the project root and add the required API credentials.

Refer to the required environment variable names used in the project configuration.

**Never commit your `.env` file or expose API keys publicly.**

### 5. Run the application

```bash
python app.py
```

Open the local URL shown by the application in your browser.

---

## 🎥 Demo

**Demo:** (https://drive.google.com/file/d/17wO_ato3pD61v0EkeTRtDSRuvUqEpC5X/view?usp=drivesdk)

---

## ⚠️ Disclaimer

MediBuddy is intended for **educational and informational purposes only**. It does not provide medical diagnosis or replace consultation with a qualified healthcare professional.

Always consult a healthcare professional for medical advice, diagnosis, or treatment.
