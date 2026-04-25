// ══════════════════════════════════════════════════
//  EMERGENCY SOS PAGE
// ══════════════════════════════════════════════════

const CPR_STEPS = [
  { icon: '📞', title: 'Call for Help',         body: 'Call 108 (ambulance) immediately. Put on speaker. Do not hang up.' },
  { icon: '🛏️', title: 'Position the Person',  body: 'Lay them flat on their back on a firm surface. Tilt head back slightly to open airway.' },
  { icon: '👂', title: 'Check for Breathing',   body: 'Look, listen and feel for breathing for no more than 10 seconds. If not breathing, start CPR.' },
  { icon: '🙌', title: 'Hand Position',          body: 'Place heel of your hand on the centre of the chest. Place other hand on top. Interlock fingers.' },
  { icon: '💪', title: 'Chest Compressions',    body: 'Press down hard and fast — at least 5 cm deep. Do 30 compressions at 100–120 per minute. (Beat of "Stayin\' Alive")' },
  { icon: '💨', title: 'Rescue Breaths',         body: 'Tilt head back, lift chin. Pinch nose, seal your mouth over theirs. Give 2 breaths, each 1 second long. Watch chest rise.' },
  { icon: '🔁', title: 'Repeat',                body: 'Continue 30 compressions → 2 breaths. Don\'t stop until ambulance arrives or person starts breathing.' },
];

const EMERGENCY_NUMBERS = [
  { label: 'Ambulance',      number: '108',  icon: '🚑', color: '#f87171' },
  { label: 'Police',         number: '100',  icon: '🚔', color: '#60a5fa' },
  { label: 'Fire Brigade',   number: '101',  icon: '🚒', color: '#fb923c' },
  { label: 'Women Helpline', number: '1091', icon: '👩', color: '#c084fc' },
  { label: 'Poison Control', number: '1800-11-6117', icon: '☠️', color: '#34d399' },
  { label: 'Disaster Mgmt',  number: '1078', icon: '🆘', color: '#fbbf24' },
];

let sosTimer      = null;
let sosSeconds    = 0;
let cpCurrentStep = 0;

function renderSOSPage() {
  document.getElementById('sos-container').innerHTML = `

    <!-- BIG SOS BUTTON -->
    <div class="sos-hero">
      <button class="sos-btn" id="sosBigBtn" onclick="triggerSOS()">
        <span class="sos-btn-ring"></span>
        <span class="sos-btn-ring sos-ring2"></span>
        <span class="sos-btn-label">SOS</span>
        <span class="sos-btn-sub">Tap to call 108</span>
      </button>
      <div class="sos-hero-caption">Tap the button in an emergency to immediately dial ambulance</div>
    </div>

    <!-- EMERGENCY NUMBERS -->
    <div class="sos-section-title">📞 Emergency Numbers</div>
    <div class="sos-numbers-grid">
      ${EMERGENCY_NUMBERS.map(e => `
        <a href="tel:${e.number}" class="sos-number-card" style="border-color:${e.color}25;">
          <div class="sos-number-icon" style="background:${e.color}15;">${e.icon}</div>
          <div class="sos-number-label">${e.label}</div>
          <div class="sos-number-val" style="color:${e.color};">${e.number}</div>
        </a>`).join('')}
    </div>

    <!-- NEAREST HOSPITAL -->
    <div class="sos-section-title">🏥 Find Nearest Hospital</div>
    <div class="sos-hospital-row">
      <button class="btn btn-primary" onclick="findNearestHospital()">📍 Find Nearest Hospital</button>
      <button class="btn btn-ghost"   onclick="findNearestPharmacy()">💊 Find Nearest Pharmacy</button>
    </div>
    <div id="sos-map-result"></div>

    <!-- CPR GUIDE -->
    <div class="sos-section-title" style="margin-top:32px;">🫀 CPR Step-by-Step Guide</div>
    <div class="sos-cpr-intro">
      For use when someone is <strong>unconscious and not breathing</strong>. Start immediately — every second counts.
    </div>

    <div class="sos-cpr-steps" id="sosSteps">
      ${CPR_STEPS.map((s, i) => `
        <div class="sos-step ${i === 0 ? 'sos-step-active' : ''}" id="sos-step-${i}" onclick="activateCPRStep(${i})">
          <div class="sos-step-num">${i + 1}</div>
          <div class="sos-step-icon">${s.icon}</div>
          <div class="sos-step-content">
            <div class="sos-step-title">${s.title}</div>
            <div class="sos-step-body">${s.body}</div>
          </div>
        </div>`).join('')}
    </div>

    <!-- CPR Timer -->
    <div class="sos-timer-card" id="sosTimerCard">
      <div class="sos-timer-label">CPR Compression Timer</div>
      <div class="sos-timer-display" id="sosTimerDisplay">00:00</div>
      <div class="sos-timer-hint">Target: 100–120 compressions per minute</div>
      <div class="sos-timer-btns">
        <button class="btn btn-primary" onclick="startCPRTimer()">▶ Start</button>
        <button class="btn btn-secondary" onclick="stopCPRTimer()">⏹ Stop</button>
        <button class="btn btn-ghost" onclick="resetCPRTimer()">↺ Reset</button>
      </div>
    </div>`;
}

// ── Big SOS button ────────────────────────────────
function triggerSOS() {
  window.location.href = 'tel:108';
}

// ── Find nearest hospital via Google Maps ─────────
function findNearestHospital() {
  if (!navigator.geolocation) {
    document.getElementById('sos-map-result').innerHTML =
      `<div class="bm-error">⚠️ Location not available on this device.</div>`;
    return;
  }
  showToast('📍 Getting your location…');
  navigator.geolocation.getCurrentPosition(pos => {
    const { latitude: lat, longitude: lng } = pos.coords;
    const url = `https://www.google.com/maps/search/hospital/@${lat},${lng},15z`;
    window.open(url, '_blank');
  }, () => {
    window.open('https://www.google.com/maps/search/hospital+near+me', '_blank');
  });
}

function findNearestPharmacy() {
  if (!navigator.geolocation) {
    window.open('https://www.google.com/maps/search/pharmacy+near+me', '_blank');
    return;
  }
  navigator.geolocation.getCurrentPosition(pos => {
    const { latitude: lat, longitude: lng } = pos.coords;
    window.open(`https://www.google.com/maps/search/pharmacy/@${lat},${lng},15z`, '_blank');
  }, () => {
    window.open('https://www.google.com/maps/search/pharmacy+near+me', '_blank');
  });
}

// ── CPR Step highlight ────────────────────────────
function activateCPRStep(index) {
  document.querySelectorAll('.sos-step').forEach((el, i) => {
    el.classList.toggle('sos-step-active', i === index);
  });
  cpCurrentStep = index;
}

// ── CPR Timer ─────────────────────────────────────
function startCPRTimer() {
  if (sosTimer) return;
  sosTimer = setInterval(() => {
    sosSeconds++;
    const m = String(Math.floor(sosSeconds / 60)).padStart(2, '0');
    const s = String(sosSeconds % 60).padStart(2, '0');
    const el = document.getElementById('sosTimerDisplay');
    if (el) el.textContent = `${m}:${s}`;
  }, 1000);
  showToast('🫀 CPR timer started');
}

function stopCPRTimer() {
  clearInterval(sosTimer);
  sosTimer = null;
}

function resetCPRTimer() {
  stopCPRTimer();
  sosSeconds = 0;
  const el = document.getElementById('sosTimerDisplay');
  if (el) el.textContent = '00:00';
}