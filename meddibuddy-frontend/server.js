const express = require('express');
const cron    = require('node-cron');
const axios   = require('axios');
const cors    = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const BOT_TOKEN = 'BOT_TOKENs';
const CHAT_ID   = 'chat_id';


// POST /add-reminder — called by the frontend when user saves a reminder
app.post('/add-reminder', (req, res) => {
  const { name, dose, time } = req.body;
  if (!name || !time) return res.status(400).json({ error: 'Missing name or time' });

  scheduleReminder({ name, dose, time });
  res.json({ message: `Reminder scheduled for ${name} at ${time}` });
});


// Schedules a cron job for the given reminder time (runs daily at that hour:minute)
function scheduleReminder({ name, dose, time }) {
  const [hour, minute] = time.split(':');

  cron.schedule(`${minute} ${hour} * * *`, () => {
    sendTelegram({ name, dose });
  });

  console.log(`⏰ Reminder scheduled — ${name} at ${time}`);
}


// Sends a Telegram message via the Bot API
function sendTelegram({ name, dose }) {
  const text = `💊 *Medicine Reminder*\n\nTake: *${name}*${dose ? ` (${dose})` : ''}\n\nStay healthy 💙\n— MediBuddy`;

  axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    chat_id:    CHAT_ID,
    text,
    parse_mode: 'Markdown',
  })
  .then(() => console.log(`✅ Telegram sent — ${name}`))
  .catch(err => console.error(`❌ Telegram error — ${err.message}`));
}


app.listen(3000, () => console.log('🚀 MediBuddy backend running on http://localhost:3000'));