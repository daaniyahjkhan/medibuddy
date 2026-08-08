const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf-8').split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const idx = trimmed.indexOf('=');
    if (idx === -1) return;
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
    process.env[key] = val;
  });
  console.log(`✅ Loaded .env manually (${Object.keys(process.env).length} total env vars)`);
} else {
  console.error('❌ .env file not found at', envPath);
}

// ── Diagnostics: catch anything that would kill the process ──
process.on('uncaughtException', (err) => {
  console.error('💥 UNCAUGHT EXCEPTION:', err);
});
process.on('unhandledRejection', (err) => {
  console.error('💥 UNHANDLED REJECTION:', err);
});
process.on('exit', (code) => {
  console.log(`⚠️ Process exiting with code ${code}`);
});
process.on('SIGINT', () => {
  console.log('🛑 Received SIGINT (Ctrl+C)');
  process.exit(0);
});
process.on('SIGTERM', () => {
  console.log('🛑 Received SIGTERM (killed by system/parent process)');
  process.exit(0);
});

const express = require('express');
const cron    = require('node-cron');
const axios   = require('axios');
const cors    = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
const GROQ_API_KEY = process.env.GROQ_API_KEY;

if (!GROQ_API_KEY) {
  console.error('❌ Missing GROQ_API_KEY in .env');
  process.exit(1);
}

// ── Body Map Symptom Checker ──
app.post('/api/body-map-analyze', async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Missing prompt' });

  try {
    const resp = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
      model: 'llama-3.1-8b-instant',
      temperature: 0.3,
      messages: [{ role: 'user', content: prompt }],
    }, {
      headers: { Authorization: `Bearer ${GROQ_API_KEY}` },
      timeout: 15000,
    });

    res.json(resp.data);
  } catch (err) {
    const status  = err.response?.status || 500;
    const message = err.response?.data?.error?.message || err.message;
    console.error(`❌ Groq error [${status}]:`, message);
    res.status(status).json({ error: message });
  }
});

// ── Medicine Interaction Checker ──
app.post('/api/check-interactions', async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Missing prompt' });

  try {
    const resp = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
      model: 'llama-3.1-8b-instant',
      temperature: 0.3,
      messages: [{ role: 'user', content: prompt }],
    }, {
      headers: { Authorization: `Bearer ${GROQ_API_KEY}` },
      timeout: 15000,
    });

    res.json(resp.data);
  } catch (err) {
    const status  = err.response?.status || 500;
    const message = err.response?.data?.error?.message || err.message;
    console.error(`❌ Groq error [${status}]:`, message);
    res.status(status).json({ error: message });
  }
});

const BOT_TOKEN        = process.env.BOT_TOKEN;
const CHAT_ID          = process.env.CHAT_ID;
const YOUTUBE_API_KEY   = process.env.YOUTUBE_API_KEY;
const PORT              = process.env.PORT || 3000;

if (!BOT_TOKEN || !CHAT_ID) {
  console.error('❌ Missing BOT_TOKEN or CHAT_ID in .env');
  process.exit(1);
}
if (!YOUTUBE_API_KEY) {
  console.error('❌ Missing YOUTUBE_API_KEY in .env');
  process.exit(1);
}

const activeJobs = {};

// ═══════════════════════════════════════════
//  MEDICAL SHORTS — YouTube Data API v3
// ═══════════════════════════════════════════

app.get('/api/medical-shorts', async (req, res) => {
  const { q } = req.query;

  if (!q) {
    return res.status(400).json({ error: 'Missing query param "q"' });
  }

  try {
    const resp = await axios.get('https://www.googleapis.com/youtube/v3/search', {
      params: {
        part: 'snippet',
        q,
        type: 'video',
        videoDuration: 'short',
        maxResults: 10,
        safeSearch: 'strict',
        relevanceLanguage: 'en',
        key: YOUTUBE_API_KEY,
      },
      timeout: 8000,
    });

    res.json(resp.data);

  } catch (err) {
    const status  = err.response?.status || 500;
    const message = err.response?.data?.error?.message || err.message;

    console.error(`❌ YouTube API error [${status}]:`, message);

    res.status(status).json({ error: message });
  }
});

// ═══════════════════════════════════════════
//  REMINDERS
// ═══════════════════════════════════════════

app.post('/add-reminder', (req, res) => {
  const { name, dose, time } = req.body;

  if (!name || !time) {
    return res.status(400).json({ error: 'Missing name or time' });
  }

  if (!/^\d{2}:\d{2}$/.test(time)) {
    return res.status(400).json({ error: 'Time must be in HH:MM format' });
  }

  scheduleReminder({ name, dose, time });
  res.json({ message: `Reminder scheduled for ${name} at ${time}` });
});

function scheduleReminder({ name, dose, time }) {
  const [hour, minute] = time.split(':');

  if (activeJobs[name]) {
    activeJobs[name].stop();
  }

  const job = cron.schedule(`${minute} ${hour} * * *`, () => {
    sendTelegram({ name, dose });
  });

  activeJobs[name] = job;

  console.log(`⏰ Reminder scheduled — ${name} at ${time}`);
}

function sendTelegram({ name, dose }) {
  const text = `💊 *Medicine Reminder*\n\nTake: *${name}*${dose ? ` (${dose})` : ''}\n\nStay healthy 💙\n— MediBuddy`;

  axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    chat_id:    CHAT_ID,
    text,
    parse_mode: 'Markdown',
  })
  .then(() => console.log(`✅ Telegram sent — ${name}`))
  .catch(err => console.error(`❌ Telegram error — ${err.response?.data?.description || err.message}`));
}

const server = app.listen(PORT, () => console.log(`🚀 MediBuddy backend running on http://localhost:${PORT}`));

// Keep-alive safety net — logs every 30s so you can visually confirm it's still up
setInterval(() => {
  console.log(`💓 Still alive — ${new Date().toLocaleTimeString()}`);
}, 30000);