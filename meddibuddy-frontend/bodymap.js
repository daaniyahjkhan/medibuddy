// ══════════════════════════════════════════════════
//  BODY MAP SYMPTOM CHECKER  —  Gemini 1.5 Flash
// ══════════════════════════════════════════════════

const GROQ_KEY_BM = 'GROQ_API_KEY';

const bodyParts = {
  head:     { label: 'Head & Face',        cx:100, cy:36,  symptoms: ['Headache','Dizziness','Blurred vision','Memory issues','Ringing in ears','Facial pain'] },
  throat:   { label: 'Throat & Neck',      cx:100, cy:72,  symptoms: ['Sore throat','Difficulty swallowing','Neck pain','Swollen glands','Stiff neck','Hoarseness'] },
  chest:    { label: 'Chest',              cx:100, cy:118, symptoms: ['Chest pain','Shortness of breath','Palpitations','Tightness','Persistent cough','Wheezing'] },
  abdomen:  { label: 'Abdomen',            cx:100, cy:170, symptoms: ['Stomach pain','Nausea','Bloating','Diarrhea','Constipation','Vomiting'] },
  pelvis:   { label: 'Pelvis & Lower Back',cx:100, cy:215, symptoms: ['Lower back pain','Hip pain','Urinary issues','Pelvic pain','Stiffness','Groin pain'] },
  leftArm:  { label: 'Left Arm',           cx:44,  cy:130, symptoms: ['Pain','Numbness','Weakness','Swelling','Tingling','Joint pain'] },
  rightArm: { label: 'Right Arm',          cx:156, cy:130, symptoms: ['Pain','Numbness','Weakness','Swelling','Tingling','Joint pain'] },
  leftLeg:  { label: 'Left Leg',           cx:78,  cy:300, symptoms: ['Pain','Swelling','Cramps','Numbness','Weakness','Stiffness'] },
  rightLeg: { label: 'Right Leg',          cx:122, cy:300, symptoms: ['Pain','Swelling','Cramps','Numbness','Weakness','Stiffness'] },
};

const bmState = { selected: null, symptoms: [], duration: '', severity: '' };

// ── Render page ───────────────────────────────────
function renderBodyMap() {
  document.getElementById('bodymap-container').innerHTML = `
    <div class="bm-wrap">

      <!-- LEFT — compact SVG body -->
      <div class="bm-left">
        <div class="bm-hint">👆 Tap a body part</div>
        <div class="bm-svg-wrap">
          <svg id="bmSvg" viewBox="0 0 200 380" xmlns="http://www.w3.org/2000/svg">

            <!-- HEAD -->
            <ellipse cx="100" cy="36" rx="26" ry="30"
              class="bmp" data-part="head" onclick="bmSelect('head')"
              fill="#152844" stroke="#38bdf8" stroke-width="1.5"/>
            <text x="100" y="39" class="bml" text-anchor="middle">Head</text>

            <!-- THROAT -->
            <rect x="88" y="66" width="24" height="16" rx="5"
              class="bmp" data-part="throat" onclick="bmSelect('throat')"
              fill="#152844" stroke="#38bdf8" stroke-width="1.5"/>
            <text x="100" y="77" class="bml" text-anchor="middle">Neck</text>

            <!-- LEFT ARM -->
            <rect x="22" y="84" width="30" height="90" rx="12"
              class="bmp" data-part="leftArm" onclick="bmSelect('leftArm')"
              fill="#152844" stroke="#38bdf8" stroke-width="1.5"/>
            <text x="37" y="132" class="bml" text-anchor="middle">L Arm</text>

            <!-- RIGHT ARM -->
            <rect x="148" y="84" width="30" height="90" rx="12"
              class="bmp" data-part="rightArm" onclick="bmSelect('rightArm')"
              fill="#152844" stroke="#38bdf8" stroke-width="1.5"/>
            <text x="163" y="132" class="bml" text-anchor="middle">R Arm</text>

            <!-- CHEST -->
            <rect x="54" y="82" width="92" height="70" rx="8"
              class="bmp" data-part="chest" onclick="bmSelect('chest')"
              fill="#152844" stroke="#38bdf8" stroke-width="1.5"/>
            <text x="100" y="120" class="bml" text-anchor="middle">Chest</text>

            <!-- ABDOMEN -->
            <rect x="54" y="152" width="92" height="52" rx="8"
              class="bmp" data-part="abdomen" onclick="bmSelect('abdomen')"
              fill="#152844" stroke="#38bdf8" stroke-width="1.5"/>
            <text x="100" y="181" class="bml" text-anchor="middle">Abdomen</text>

            <!-- PELVIS -->
            <rect x="54" y="204" width="92" height="36" rx="8"
              class="bmp" data-part="pelvis" onclick="bmSelect('pelvis')"
              fill="#152844" stroke="#38bdf8" stroke-width="1.5"/>
            <text x="100" y="226" class="bml" text-anchor="middle">Pelvis</text>

            <!-- LEFT LEG -->
            <rect x="54" y="240" width="40" height="120" rx="12"
              class="bmp" data-part="leftLeg" onclick="bmSelect('leftLeg')"
              fill="#152844" stroke="#38bdf8" stroke-width="1.5"/>
            <text x="74" y="304" class="bml" text-anchor="middle">L Leg</text>

            <!-- RIGHT LEG -->
            <rect x="106" y="240" width="40" height="120" rx="12"
              class="bmp" data-part="rightLeg" onclick="bmSelect('rightLeg')"
              fill="#152844" stroke="#38bdf8" stroke-width="1.5"/>
            <text x="126" y="304" class="bml" text-anchor="middle">R Leg</text>

          </svg>
        </div>
      </div>

      <!-- RIGHT — symptom panel -->
      <div class="bm-right">
        <div id="bm-panel" class="bm-panel">
          <div class="bm-prompt">
            <div style="font-size:40px;margin-bottom:10px;">🫀</div>
            <div style="font-family:'Fraunces',serif;font-size:17px;font-weight:700;color:var(--text);">Where does it hurt?</div>
            <div style="font-size:13px;color:var(--text-muted);margin-top:6px;">Tap any part of the body on the left</div>
          </div>
        </div>
      </div>

    </div>
    <div id="bm-result"></div>`;
}

// ── Select body part ──────────────────────────────
function bmSelect(part) {
  bmState.selected = part;
  bmState.symptoms = [];

  // Update SVG highlights
  document.querySelectorAll('.bmp').forEach(el => {
    const isActive = el.dataset.part === part;
    el.style.fill          = isActive ? 'rgba(0,229,192,0.25)' : '#152844';
    el.style.stroke        = isActive ? '#00e5c0' : '#38bdf8';
    el.style.strokeWidth   = isActive ? '2.5' : '1.5';
    el.style.filter        = isActive ? 'drop-shadow(0 0 6px rgba(0,229,192,0.5))' : '';
  });

  const info = bodyParts[part];
  document.getElementById('bm-panel').innerHTML = `
    <div class="bm-part-title">📍 ${info.label}</div>
    <div class="bm-sub">Select all that apply:</div>
    <div class="bm-sym-grid">
      ${info.symptoms.map(s => `
        <button class="bm-sym" onclick="bmToggleSym(this,'${s}')">${s}</button>
      `).join('')}
    </div>
    <div class="bm-fields">
      <div class="bm-field">
        <label class="form-label">Duration</label>
        <select class="form-select" id="bm-dur">
          <option value="">Select…</option>
          <option>Less than a day</option>
          <option>1–3 days</option>
          <option>4–7 days</option>
          <option>1–2 weeks</option>
          <option>More than 2 weeks</option>
        </select>
      </div>
      <div class="bm-field">
        <label class="form-label">Severity (1–10)</label>
        <select class="form-select" id="bm-sev">
          <option value="">Select…</option>
          ${[1,2,3,4,5,6,7,8,9,10].map(n=>`<option>${n}</option>`).join('')}
        </select>
      </div>
    </div>
    <button class="btn btn-primary" style="width:100%;margin-top:12px;" onclick="bmAnalyze()">
      🔍 Analyze Symptoms
    </button>`;
};

function bmToggleSym(btn, sym) {
  const idx = bmState.symptoms.indexOf(sym);
  if (idx === -1) { bmState.symptoms.push(sym);    btn.classList.add('bm-sym-on'); }
  else            { bmState.symptoms.splice(idx,1); btn.classList.remove('bm-sym-on'); }
}

// ── Gemini call ───────────────────────────────────
async function bmAnalyze() {
  const dur = document.getElementById('bm-dur')?.value;
  const sev = document.getElementById('bm-sev')?.value;
  if (!bmState.symptoms.length) { showToast('⚠️ Pick at least one symptom', true); return; }
  if (!dur)                      { showToast('⚠️ Select duration', true); return; }
  if (!sev)                      { showToast('⚠️ Select severity', true); return; }

  document.getElementById('bm-result').innerHTML = `
    <div class="bm-loading"><div class="bm-spinner"></div><span>Analyzing with Gemini…</span></div>`;

  const prompt = `You are MediBuddy, an AI medical assistant. A patient reports:
Body area: ${bodyParts[bmState.selected].label}
Symptoms: ${bmState.symptoms.join(', ')}
Duration: ${dur}
Severity: ${sev}/10

Respond ONLY with valid JSON, no markdown, no extra text:
{
  "urgency": "Emergency|High|Medium|Low",
  "urgencyReason": "<one sentence>",
  "possibleConditions": [
    { "name": "<condition>", "likelihood": "Likely|Possible|Unlikely", "description": "<1 sentence>" }
  ],
  "redFlags": ["<sign that means go to ER immediately>"],
  "recommendations": ["<actionable step>"],
  "seeDoctor": "Immediately|Within 24 hours|Within a week|Monitor at home"
}`;

  try {
    const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${GROQ_KEY_BM}`,
      },
      body: JSON.stringify({
        model:       'llama-3.1-8b-instant',
        temperature: 0.3,
        messages:    [{ role: 'user', content: prompt }],
      }),
    });
    const data = await resp.json();

    if (data.error) {
      document.getElementById('bm-result').innerHTML =
        `<div class="bm-error">❌ Groq Error: ${data.error.message}<br><small>Check your API key in bodymap.js</small></div>`;
      return;
    }

    const raw    = data.choices[0].message.content.replace(/```json|```/g, '').trim();
    const result = JSON.parse(raw);
    bmRenderResult(result);
  } catch(e) {
    document.getElementById('bm-result').innerHTML =
      `<div class="bm-error">⚠️ Network error — check your internet connection.<br><small>${e.message}</small></div>`;
  }
}

// ── Render result ─────────────────────────────────
function bmRenderResult(r) {
  const colors = { Emergency:'#f87171', High:'#fb923c', Medium:'#fbbf24', Low:'#34d399' };
  const bgs    = { Emergency:'rgba(248,113,113,0.08)', High:'rgba(251,146,60,0.08)', Medium:'rgba(251,191,36,0.08)', Low:'rgba(52,211,153,0.08)' };
  const c      = colors[r.urgency] || '#34d399';
  const bg     = bgs[r.urgency]   || 'rgba(52,211,153,0.08)';

  document.getElementById('bm-result').innerHTML = `
    <div class="bm-result-card">
      <div class="bm-urgency-banner" style="background:${bg};border:1px solid ${c}30;">
        <div style="font-family:'Fraunces',serif;font-size:16px;font-weight:700;color:${c};">${r.urgency} Priority</div>
        <div style="font-size:13px;color:var(--text-muted);margin:4px 0 8px;">${r.urgencyReason}</div>
        <div style="font-size:13px;">🏥 See a doctor: <strong style="color:${c};">${r.seeDoctor}</strong></div>
      </div>

      <div class="bm-sec">🔍 Possible Conditions</div>
      ${(r.possibleConditions||[]).map(cd => {
        const lc = { Likely:'#f87171', Possible:'#fb923c', Unlikely:'#34d399' }[cd.likelihood] || '#34d399';
        return `<div class="bm-condition">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
            <span style="font-weight:600;font-size:14px;">${cd.name}</span>
            <span style="font-size:11px;font-weight:700;padding:2px 10px;border-radius:20px;background:${lc}15;color:${lc};border:1px solid ${lc}30;">${cd.likelihood}</span>
          </div>
          <div style="font-size:12px;color:var(--text-muted);">${cd.description}</div>
        </div>`;
      }).join('')}

      ${r.redFlags?.length ? `
        <div class="bm-sec" style="color:var(--high);">🚨 Go to ER if you notice:</div>
        ${r.redFlags.map(f=>`<div style="font-size:13px;color:var(--high);padding:5px 0;border-bottom:1px solid rgba(248,113,113,0.1);">⚠️ ${f}</div>`).join('')}
      ` : ''}

      <div class="bm-sec">💡 What to do now</div>
      ${(r.recommendations||[]).map((rec,i)=>`
        <div style="display:flex;gap:10px;margin-bottom:8px;font-size:13px;color:var(--text-muted);line-height:1.6;">
          <span style="min-width:22px;height:22px;background:rgba(0,229,192,0.12);color:var(--cyan);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0;">${i+1}</span>
          ${rec}
        </div>`).join('')}

      <div style="margin-top:14px;padding:10px 12px;background:rgba(56,189,248,0.05);border:1px solid rgba(56,189,248,0.15);border-radius:10px;font-size:11px;color:var(--text-muted);">
        ⚕️ AI-generated for awareness only. Always consult a qualified doctor for diagnosis and treatment.
      </div>
    </div>`;

  document.getElementById('bm-result').scrollIntoView({ behavior:'smooth', block:'start' });
}