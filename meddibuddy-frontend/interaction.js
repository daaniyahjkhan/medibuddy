// ══════════════════════════════════════════════════
//  MEDICINE INTERACTION CHECKER  —  Gemini 1.5 Flash
// ══════════════════════════════════════════════════


const GROQ_KEY_IX = 'GROQ_API_KEY';

const ixState = { medicines: [] };

// ── Render page ───────────────────────────────────
function renderInteractionPage() {
  document.getElementById('interaction-container').innerHTML = `
    <div class="ix-wrap">

      <div class="card ix-input-card">
        <div class="ix-title">💊 Add Medicines to Check</div>
        <div class="ix-sub">Enter 2–6 medicines. AI will analyze every pair combination.</div>

        <div class="ix-add-row">
          <input class="form-input" id="ix-input" type="text"
            placeholder="Type medicine name and press Enter or Add…"
            onkeydown="if(event.key==='Enter') ixAdd()">
          <button class="btn btn-primary" onclick="ixAdd()">+ Add</button>
        </div>

        <div id="ix-chips" class="ix-chips"></div>
        <div id="ix-action" style="display:none;margin-top:16px;">
          <button class="btn btn-primary" style="width:100%;" onclick="ixCheck()">
            🔬 Check All Interactions
          </button>
        </div>
      </div>

      <div id="ix-result"></div>
    </div>`;

  ixRenderChips();
}

function ixAdd() {
  const input = document.getElementById('ix-input');
  const name  = input.value.trim();
  if (!name) return;
  if (ixState.medicines.map(m=>m.toLowerCase()).includes(name.toLowerCase())) {
    showToast('⚠️ Already added', true); return;
  }
  if (ixState.medicines.length >= 6) { showToast('⚠️ Max 6 medicines', true); return; }
  ixState.medicines.push(name);
  input.value = '';
  ixRenderChips();
}

function ixRemove(name) {
  ixState.medicines = ixState.medicines.filter(m => m !== name);
  document.getElementById('ix-result').innerHTML = '';
  ixRenderChips();
}

function ixRenderChips() {
  const chips  = document.getElementById('ix-chips');
  const action = document.getElementById('ix-action');
  if (!chips) return;

  chips.innerHTML = ixState.medicines.length
    ? ixState.medicines.map(m => `
        <div class="ix-chip">
          <span>💊 ${m}</span>
          <button class="ix-chip-x" onclick="ixRemove('${m}')">×</button>
        </div>`).join('')
    : `<div style="font-size:13px;color:var(--text-dim);padding:8px 0;">No medicines added yet</div>`;

  action.style.display = ixState.medicines.length >= 2 ? 'block' : 'none';
}

// ── Gemini call ───────────────────────────────────
async function ixCheck() {
  if (ixState.medicines.length < 2) { showToast('⚠️ Add at least 2 medicines', true); return; }

  document.getElementById('ix-result').innerHTML = `
    <div class="bm-loading"><div class="bm-spinner"></div><span>Checking interactions with Gemini…</span></div>`;

  // Build all unique pairs
  const meds  = ixState.medicines;
  const pairs = [];
  for (let i = 0; i < meds.length; i++)
    for (let j = i + 1; j < meds.length; j++)
      pairs.push([meds[i], meds[j]]);

  const prompt = `You are MediBuddy, a clinical pharmacology AI. Analyze drug interactions for these medicines: ${meds.join(', ')}.

Check every pair combination: ${pairs.map(p => p.join(' + ')).join('; ')}.

Respond ONLY with valid JSON, no markdown, no extra text:
{
  "overallRisk": "Dangerous|Moderate|Minor|Safe",
  "summary": "<2 sentence plain English overall summary>",
  "interactions": [
    {
      "pair": ["<medicine1>", "<medicine2>"],
      "severity": "Dangerous|Moderate|Minor",
      "effect": "<what happens when combined, plain English>",
      "mechanism": "<why it happens, simple 1 sentence>",
      "recommendation": "<exactly what the patient should do>"
    }
  ],
  "safePairs": ["<medicine1> + <medicine2>"],
  "generalTips": ["<practical tip for taking multiple medicines>"]
}

If a pair has no known interaction, do NOT include it in interactions array. Only include pairs with actual interactions.`;

  try {
    const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${GROQ_KEY_IX}`,
      },
      body: JSON.stringify({
        model:       'llama-3.1-8b-instant',
        temperature: 0.3,
        messages:    [{ role: 'user', content: prompt }],
      }),
    });
    const data = await resp.json();

    if (data.error) {
      document.getElementById('ix-result').innerHTML =
        `<div class="bm-error">❌ Groq Error: ${data.error.message}<br><small>Check your API key in interaction.js</small></div>`;
      return;
    }

    const raw    = data.choices[0].message.content.replace(/```json|```/g, '').trim();
    const result = JSON.parse(raw);
    ixRenderResult(result);
  } catch(e) {
    document.getElementById('ix-result').innerHTML =
      `<div class="bm-error">⚠️ Network error — check your internet connection.<br><small>${e.message}</small></div>`;
  }
}

// ── Render result ─────────────────────────────────
function ixRenderResult(r) {
  const riskColor = { Dangerous:'#f87171', Moderate:'#fb923c', Minor:'#fbbf24', Safe:'#34d399' };
  const riskBg    = { Dangerous:'rgba(248,113,113,0.08)', Moderate:'rgba(251,146,60,0.08)', Minor:'rgba(251,191,36,0.08)', Safe:'rgba(52,211,153,0.08)' };
  const riskIcon  = { Dangerous:'🚨', Moderate:'⚠️', Minor:'ℹ️', Safe:'✅' };
  const sevColor  = { Dangerous:'#f87171', Moderate:'#fb923c', Minor:'#fbbf24' };

  const c  = riskColor[r.overallRisk] || '#34d399';
  const bg = riskBg[r.overallRisk]    || 'rgba(52,211,153,0.08)';

  document.getElementById('ix-result').innerHTML = `
    <div class="card ix-result-card">

      <!-- Overall risk banner -->
      <div class="ix-banner" style="background:${bg};border-color:${c}30;">
        <div style="font-family:'Fraunces',serif;font-size:18px;font-weight:700;color:${c};">
          ${riskIcon[r.overallRisk] || '✅'} ${r.overallRisk} Risk
        </div>
        <div style="font-size:13px;color:var(--text-muted);margin-top:6px;line-height:1.6;">${r.summary}</div>
      </div>

      <!-- Medicines checked row -->
      <div class="ix-meds-row">
        ${ixState.medicines.map(m=>`<span class="ix-med-tag">💊 ${m}</span>`).join('')}
      </div>

      <!-- Pair interactions -->
      ${r.interactions?.length ? `
        <div class="ix-sec">⚡ Interactions Found (${r.interactions.length} pair${r.interactions.length>1?'s':''})</div>
        ${r.interactions.map(ix => {
          const sc = sevColor[ix.severity] || '#fbbf24';
          return `
            <div class="ix-card" style="border-color:${sc}25;">
              <div class="ix-card-header" style="background:${sc}08;">
                <div class="ix-pair">${ix.pair[0]} <span style="color:var(--text-dim);">+</span> ${ix.pair[1]}</div>
                <span class="ix-sev-badge" style="background:${sc}15;color:${sc};border-color:${sc}30;">${ix.severity}</span>
              </div>
              <div class="ix-card-body">
                <div class="ix-row"><span class="ix-label">⚡ Effect</span><span>${ix.effect}</span></div>
                <div class="ix-row"><span class="ix-label">🔬 Why</span><span>${ix.mechanism}</span></div>
                <div class="ix-row" style="color:var(--cyan);"><span class="ix-label">💡 Do this</span><span>${ix.recommendation}</span></div>
              </div>
            </div>`;
        }).join('')}
      ` : `
        <div style="padding:20px;text-align:center;color:var(--low);font-size:14px;">
          ✅ No significant interactions found between these medicines.
        </div>`}

      <!-- Safe pairs -->
      ${r.safePairs?.length ? `
        <div class="ix-sec">✅ Safe Combinations</div>
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px;">
          ${r.safePairs.map(p=>`<span style="padding:4px 12px;background:rgba(52,211,153,0.08);border:1px solid rgba(52,211,153,0.2);border-radius:20px;font-size:12px;color:var(--low);">${p}</span>`).join('')}
        </div>` : ''}

      <!-- General tips -->
      ${r.generalTips?.length ? `
        <div class="ix-sec">💡 General Tips</div>
        ${r.generalTips.map((t,i)=>`
          <div style="display:flex;gap:10px;margin-bottom:8px;font-size:13px;color:var(--text-muted);line-height:1.6;">
            <span style="min-width:22px;height:22px;background:rgba(0,229,192,0.12);color:var(--cyan);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0;">${i+1}</span>
            ${t}
          </div>`).join('')}
      ` : ''}

      <div style="margin-top:14px;padding:10px 12px;background:rgba(56,189,248,0.05);border:1px solid rgba(56,189,248,0.15);border-radius:10px;font-size:11px;color:var(--text-muted);">
        ⚕️ Always consult your doctor or pharmacist before changing your medicines.
      </div>
    </div>`;

  document.getElementById('ix-result').scrollIntoView({ behavior:'smooth', block:'start' });
}