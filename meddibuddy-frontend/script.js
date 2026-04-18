const state = {
  currentPage:  'analyze',
  lastAnalysis: null,
  currentLang:  'english',
  reminders:    [],
};

const firedToday = new Set();
const FLASK_URL  = 'http://localhost:5000';

document.addEventListener('click', () => new Audio().play().catch(() => {}), { once: true });


// ── Navigation ────────────────────────────────────────────────

function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + name).classList.add('active');
  document.querySelectorAll('.nav-tab').forEach((t, i) => {
    t.classList.toggle('active',
      ['analyze','medicines','shorts','bodymap','interaction','sos','reminders'][i] === name);
  });
  state.currentPage = name;
  if (name === 'medicines')   renderCommonMeds();
  if (name === 'shorts')      initShorts();
  if (name === 'bodymap')     renderBodyMap();
  if (name === 'interaction') renderInteractionPage();
  if (name === 'sos')         renderSOSPage();
  if (name === 'reminders')   renderReminders();
}


// ── Drag & Drop ───────────────────────────────────────────────

function handleDragOver(e) {
  e.preventDefault();
  e.stopPropagation();
  document.getElementById('uploadZone').classList.add('dragover');
}

function handleDragLeave(e) {
  e.stopPropagation();
  document.getElementById('uploadZone').classList.remove('dragover');
}

function handleDrop(e) {
  e.preventDefault();
  e.stopPropagation();
  document.getElementById('uploadZone').classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if (!file) return;

  const allowed = ['application/pdf','image/jpeg','image/jpg','image/png'];
  const ext = file.name.split('.').pop().toLowerCase();
  if (!allowed.includes(file.type) && !['pdf','jpg','jpeg','png'].includes(ext)) {
    showToast('⚠️ Please drop a PDF, JPG or PNG file', true);
    return;
  }
  // Use the same setSelectedFile defined in index.html
  setSelectedFile(file);
}

// handleFileSelect kept for backwards compat (called by input onchange in older HTML)
function handleFileSelect(input) {
  if (input.files && input.files[0]) setSelectedFile(input.files[0]);
}


// ── Sample data (offline demo) ────────────────────────────────

function loadSample() {
  document.getElementById('patientName').value     = 'Rahul Sharma';
  document.getElementById('patientAge').value      = '42';
  document.getElementById('patientGender').value   = 'Male';
  document.getElementById('reportType').value      = 'blood';
  document.getElementById('val-hgb').value         = '11.2';
  document.getElementById('val-wbc').value         = '11.8';
  document.getElementById('val-plt').value         = '340';
  document.getElementById('val-glucose').value     = '142';
  document.getElementById('val-cholesterol').value = '228';
  document.getElementById('val-creatinine').value  = '1.1';
  document.getElementById('val-tsh').value         = '2.3';
  document.getElementById('val-hba1c').value       = '7.1';
  document.getElementById('doctorNotes').value     =
    'Patient reports fatigue, increased thirst and urination. ' +
    'Family history of diabetes. Currently on Metformin 500mg, Atorvastatin 20mg.';

  // Make sure pills show blood selected
  document.querySelectorAll('.rtype-pill').forEach(p => p.classList.remove('active'));
  const bloodPill = [...document.querySelectorAll('.rtype-pill')]
    .find(p => p.textContent.includes('Blood'));
  if (bloodPill) bloodPill.classList.add('active');
  document.getElementById('reportTypeSelect').value = 'blood';

  showToast('📋 Sample loaded — running analysis...');

  showLoading(true);
  setTimeout(() => {
    const values   = readHiddenValues();
    const analysis = localAnalyze(
      values,
      document.getElementById('patientName').value,
      document.getElementById('patientAge').value,
      document.getElementById('patientGender').value,
      document.getElementById('doctorNotes').value
    );
    state.lastAnalysis = { ...analysis, _source: 'local' };
    state.currentLang  = 'english';
    showLoading(false);
    renderResults(analysis, 'Rahul Sharma', 'blood');
    showToast('✅ Sample report analyzed!');
  }, 900);
}

function readHiddenValues() {
  return {
    hemoglobin:  parseFloat(document.getElementById('val-hgb').value),
    wbc:         parseFloat(document.getElementById('val-wbc').value),
    platelets:   parseFloat(document.getElementById('val-plt').value),
    glucose:     parseFloat(document.getElementById('val-glucose').value),
    cholesterol: parseFloat(document.getElementById('val-cholesterol').value),
    creatinine:  parseFloat(document.getElementById('val-creatinine').value),
    tsh:         parseFloat(document.getElementById('val-tsh').value),
    hba1c:       parseFloat(document.getElementById('val-hba1c').value),
  };
}


// ── Analyse Report — POST to Flask /upload ────────────────────

async function analyzeReport(file) {
  if (!file) return;

  const reportType = document.getElementById('reportTypeSelect')?.value || 'auto';

  showLoading(true);

  const msgs = [
    'Uploading your report...',
    'Extracting text and values...',
    'Running AI analysis...',
    'Identifying abnormalities...',
    'Generating recommendations...',
    'Translating summary...',
  ];
  let mi = 0;
  const msgTimer = setInterval(() => {
    const el = document.getElementById('loadingSubText');
    if (el) el.textContent = msgs[Math.min(mi++, msgs.length - 1)];
  }, 1800);

  try {
    const formData = new FormData();
    formData.append('file', file);
    if (reportType !== 'auto') formData.append('report_type', reportType);

    const resp = await fetch(`${FLASK_URL}/upload`, {
      method: 'POST',
      body:   formData,
    });

    clearInterval(msgTimer);
    const data = await resp.json();

    if (!resp.ok) {
      showLoading(false);
      showToast(`⚠️ ${data.error || 'Analysis failed'}`, true);
      renderError(data.error || 'Analysis failed');
      return;
    }

    showLoading(false);
    const detectedType = detectReportType(data, reportType);
    state.lastAnalysis = { ...data, _source: 'flask', _reportType: detectedType };
    state.currentLang  = 'english';
    renderFlaskResults(data, detectedType);
    showToast('✅ Report analyzed successfully!');

  } catch (err) {
    clearInterval(msgTimer);
    showLoading(false);
    console.error('Flask error:', err);
    showToast('⚠️ Cannot reach Flask server. Is it running on port 5000?', true);
    renderError(
      'Could not connect to the MediBuddy server.<br>' +
      'Make sure Flask is running: <code style="color:var(--cyan)">python app.py</code>'
    );
  }
}

function detectReportType(data, userSelected) {
  if (userSelected && userSelected !== 'auto') return userSelected;
  const text = ((data.key_findings || '') + ' ' + (data.diagnosis || '')).toLowerCase();
  const bloodKw = ['hemoglobin','hgb','wbc','platelet','glucose','cholesterol',
                   'creatinine','hba1c','rbc','tsh','ferritin','sodium','potassium',
                   'bilirubin','urea','mcv','mch','rdw'];
  return bloodKw.filter(k => text.includes(k)).length >= 2 ? 'blood' : 'general';
}


// ── Render Flask results ──────────────────────────────────────

function renderFlaskResults(data, reportType) {
  const concern    = (data.concern_level || 'low').toLowerCase();
  const scoreColor = concern === 'low' ? '#34d399' : concern === 'medium' ? '#fb923c' : '#f87171';
  const scoreNum   = concern === 'low' ? 85 : concern === 'medium' ? 58 : 32;
  const container  = document.getElementById('reportResults');

  const concernLabel = concern.charAt(0).toUpperCase() + concern.slice(1);
  const concernBadge = `<span class="concern-badge concern-${concern}">${concernLabel}</span>`;

  const alertHTML = concern === 'high'
    ? `<div class="alert alert-danger"><span class="alert-icon">🚨</span><span>High concern detected. Please consult a doctor soon.</span></div>`
    : concern === 'medium'
    ? `<div class="alert alert-warning"><span class="alert-icon">⚠️</span><span>Some values need attention. Follow up with your healthcare provider.</span></div>`
    : `<div class="alert alert-info"><span class="alert-icon">ℹ️</span><span>Overall results look mostly normal. Keep up the healthy habits!</span></div>`;

  const translations  = data.translations || {};
  const hasTranslations = !!(translations.hindi || translations.telugu);

  const bloodFindingsTab = reportType === 'blood'
    ? `<button class="content-tab" onclick="switchTab(this,'ftab-findings')">🔬 Key Findings</button>` : '';

  const translationsTab = hasTranslations
    ? `<button class="content-tab" onclick="switchTab(this,'ftab-translate')">🌐 Translations</button>` : '';

  const bloodFindingsPanel = reportType === 'blood' ? `
    <div id="ftab-findings" style="display:none;">
      <div class="section-title" style="font-size:15px;margin-bottom:14px;">🔬 Key Findings</div>
      <div style="background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:16px 18px;">
        ${formatFlaskBullets(data.key_findings)}
      </div>
    </div>` : '';

  const translationsPanel = hasTranslations ? `
    <div id="ftab-translate" style="display:none;">
      <div class="lang-switcher" style="margin-bottom:16px;">
        <button class="lang-btn active" id="tl-btn-hi" onclick="switchTranslation('hindi')">🇮🇳 हिंदी</button>
        <button class="lang-btn"        id="tl-btn-te" onclick="switchTranslation('telugu')">తెలుగు</button>
      </div>
      <div class="summary-card">
        <div class="summary-text" id="translationText" style="font-size:15px;line-height:2;">
          ${translations.hindi || ''}
        </div>
      </div>
    </div>` : '';

  container.innerHTML = `
    <div class="fade-in">
      ${alertHTML}
      <div class="card" style="margin-bottom:20px;">
        <div class="result-header">
          <div>
            <div class="result-patient-name">Medical Report Analysis</div>
            <div class="result-meta">Analyzed by MediBuddy AI · Gemini</div>
          </div>
          <div class="score-block">
            <div class="score-number" style="color:${scoreColor};">${scoreNum}</div>
            <div class="score-label">Health Score</div>
            <div style="margin-top:8px;">${concernBadge}</div>
          </div>
        </div>

        <div class="content-tabs">
          <button class="content-tab active" onclick="switchTab(this,'ftab-overview')">📋 Overview</button>
          ${bloodFindingsTab}
          <button class="content-tab" onclick="switchTab(this,'ftab-reco')">💡 Advice</button>
          ${translationsTab}
        </div>

        <!-- Overview -->
        <div id="ftab-overview">
          <div class="two-col" style="margin-bottom:20px;">
            <div>
              <div class="section-title" style="font-size:15px;">👤 Patient Profile</div>
              <div class="summary-card">
                <div class="summary-text" style="font-size:14px;">${data.patient_profile || 'Not available.'}</div>
              </div>
            </div>
            <div>
              <div class="section-title" style="font-size:15px;">🧬 Diagnosis</div>
              <div class="summary-card">
                <div class="summary-text" style="font-size:14px;">${data.diagnosis || 'Not available.'}</div>
              </div>
            </div>
          </div>
          <div class="section-title" style="font-size:15px;">💬 Simple Explanation</div>
          <div class="summary-card">
            <div class="summary-text">${data.simple_explanation || 'Not available.'}</div>
          </div>
        </div>

        ${bloodFindingsPanel}

        <!-- Advice -->
        <div id="ftab-reco" style="display:none;">
          <div class="two-col">
            <div>
              <div class="section-title" style="font-size:15px;">🔍 Key Findings</div>
              ${formatFlaskBullets(data.key_findings)}
            </div>
            <div>
              <div class="section-title" style="font-size:15px;">💡 Recommendations</div>
              ${formatFlaskRecommendations(data.recommendations)}
            </div>
          </div>
        </div>

        ${translationsPanel}
      </div>
    </div>`;

  container.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Split text into styled bullet rows
function formatFlaskBullets(text) {
  if (!text) return `<p style="color:var(--text-muted);font-size:13px;">Not available.</p>`;

  const sentences = text
    .replace(/\b(Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|vs|etc|approx|dept|fig|govt|max|min|no|vol)\.\s+/g, '$1__DOT__ ')
    .split(/(?<=[.!?])\s+/)
    .map(s => s.replace(/__DOT__/g, '.').trim())
    .filter(s => s.length > 5);

  if (sentences.length <= 1)
    return `<p style="font-size:13px;color:var(--text-muted);line-height:1.7;">${text}</p>`;

  return sentences.map(s => {
    const isHigh = /\bhigh\b|\babnormal\b|\belevated\b|\bexceeds\b/i.test(s);
    const isLow  = /\blow\b|\bdeficient\b|\bbelow\b|\breduced\b/i.test(s);
    const isTip  = /^(ensure|avoid|consider|consult|drink|eat|take|follow|increase|decrease|monitor|exercise|rest|limit|try|make sure)/i.test(s);

    let dotBg = 'var(--surface3)', dotColor = 'var(--text-dim)', dotChar = '·', textColor = 'var(--text-muted)';
    if (isHigh) { dotBg = 'rgba(248,113,113,0.15)'; dotColor = 'var(--high)';   dotChar = '↑'; textColor = 'var(--text)'; }
    else if (isLow)  { dotBg = 'rgba(251,146,60,0.15)';  dotColor = 'var(--medium)'; dotChar = '↓'; textColor = 'var(--text)'; }
    else if (isTip)  { dotBg = 'rgba(52,211,153,0.15)';  dotColor = 'var(--low)';    dotChar = '✓'; textColor = 'var(--text)'; }

    return `
      <div style="display:flex;gap:10px;align-items:flex-start;padding:8px 0;border-bottom:1px solid var(--border);">
        <span style="flex-shrink:0;width:22px;height:22px;border-radius:50%;
                     background:${dotBg};color:${dotColor};
                     font-size:11px;font-weight:700;
                     display:flex;align-items:center;justify-content:center;margin-top:1px;">${dotChar}</span>
        <span style="font-size:13px;color:${textColor};line-height:1.65;">${s}</span>
      </div>`;
  }).join('');
}

function formatFlaskRecommendations(text) {
  if (!text) return `<p style="color:var(--text-muted);font-size:13px;">Not available.</p>`;
  const items = text
    .replace(/\b(Mr|Mrs|Ms|Dr|Prof)\.\s+/g, '$1__DOT__ ')
    .split(/(?<=[.!?])\s+/)
    .map(s => s.replace(/__DOT__/g, '.').trim())
    .filter(s => s.length > 5);
  return items.map((r, i) => `
    <div style="display:flex;gap:10px;margin-bottom:12px;font-size:13px;">
      <span style="color:var(--cyan);font-weight:700;min-width:20px;">${i + 1}.</span>
      <span style="color:var(--text-muted);line-height:1.65;">${r}</span>
    </div>`).join('');
}

function switchTranslation(lang) {
  const data = state.lastAnalysis;
  if (!data || !data.translations) return;
  document.getElementById('tl-btn-hi').classList.toggle('active', lang === 'hindi');
  document.getElementById('tl-btn-te').classList.toggle('active', lang === 'telugu');
  document.getElementById('translationText').textContent = data.translations[lang] || '';
}

function renderError(msg) {
  document.getElementById('reportResults').innerHTML = `
    <div class="alert alert-danger" style="margin-top:20px;">
      <span class="alert-icon">🚨</span><span>${msg}</span>
    </div>`;
}


// ── Local / offline fallback (used by sample) ─────────────────

function localAnalyze(values, name, age, gender, notes) {
  const params = [], alerts = [];
  let abnCount = 0;

  const defs = [
    { key:'hemoglobin',  name:'Hemoglobin',       unit:'g/dL',    mR:[13.5,17.5], fR:[12,15.5],  label:'Normal: 12–17.5 g/dL',   explain:'Carries oxygen in red blood cells.' },
    { key:'wbc',         name:'WBC Count',         unit:'×10³/μL', mR:[4.5,11],    fR:[4.5,11],   label:'Normal: 4.5–11 ×10³/μL', explain:'White blood cells that fight infections.' },
    { key:'platelets',   name:'Platelets',         unit:'×10³/μL', mR:[150,400],   fR:[150,400],  label:'Normal: 150–400 ×10³/μL',explain:'Help blood clot after injury.' },
    { key:'glucose',     name:'Blood Glucose',     unit:'mg/dL',   mR:[70,100],    fR:[70,100],   label:'Normal fasting: 70–100',  explain:'Blood sugar — key diabetes indicator.' },
    { key:'cholesterol', name:'Total Cholesterol', unit:'mg/dL',   mR:[0,200],     fR:[0,200],    label:'Normal: <200 mg/dL',      explain:'High levels increase heart disease risk.' },
    { key:'creatinine',  name:'Creatinine',        unit:'mg/dL',   mR:[0.7,1.2],   fR:[0.5,1.0],  label:'Normal: 0.7–1.2 mg/dL',  explain:'Kidney waste — reflects kidney health.' },
    { key:'tsh',         name:'TSH',               unit:'μIU/mL',  mR:[0.4,4.0],   fR:[0.4,4.0],  label:'Normal: 0.4–4.0 μIU/mL', explain:'Controls thyroid / metabolism.' },
    { key:'hba1c',       name:'HbA1c',             unit:'%',       mR:[0,5.7],     fR:[0,5.7],    label:'Normal: <5.7%',           explain:'Average blood sugar over 3 months.' },
  ];

  const isFemale = (gender || '').toLowerCase() === 'female';
  defs.forEach(d => {
    const v = values[d.key];
    if (isNaN(v)) return;
    const [lo, hi] = isFemale ? d.fR : d.mR;
    let status = 'Normal', concern = 'Low';
    if (v > hi)      { status = 'High'; concern = v > hi * 1.2 ? 'High' : 'Medium'; abnCount++; }
    else if (v < lo) { status = 'Low';  concern = v < lo * 0.8 ? 'High' : 'Medium'; abnCount++; }
    if (concern === 'High')
      alerts.push({ level: 'High', message: `${d.name} is significantly ${status.toLowerCase()} (${v} ${d.unit}).` });
    params.push({ name: d.name, value: v, unit: d.unit, normalRange: d.label, status, concern, explanation: d.explain });
  });

  const total          = params.length;
  const healthScore    = Math.max(30, total ? Math.round(((total - abnCount) / total) * 100) : 80);
  const highN          = params.filter(p => p.concern === 'High').length;
  const overallConcern = highN >= 2 ? 'High' : highN >= 1 ? 'Medium' : 'Low';
  const ga = values.glucose > 100, ca = values.cholesterol > 200, ha = values.hba1c > 5.7;

  const medicines = [];
  if (notes?.toLowerCase().includes('metformin'))
    medicines.push({ name:'Metformin',    purpose:'Controls blood sugar in type 2 diabetes.',   sideEffects:['Nausea','Diarrhea','Stomach upset'] });
  if (notes?.toLowerCase().includes('atorvastatin'))
    medicines.push({ name:'Atorvastatin', purpose:'Lowers LDL cholesterol, reduces heart risk.', sideEffects:['Muscle pain','Liver changes','Headache'] });

  const eng = `${name}'s report shows ${abnCount} abnormal value(s) out of ${total} tested. ${ha ? 'HbA1c indicates elevated blood sugar. ' : ''}${ca ? 'Cholesterol is above the recommended range. ' : ''}Please consult your doctor.`;
  return {
    healthScore, overallConcern, parameters: params,
    summary: {
      english: eng,
      hindi: `${name} की रिपोर्ट में ${total} में से ${abnCount} असामान्य मान पाए गए। ${ha ? 'HbA1c बढ़ा हुआ है। ' : ''}${ca ? 'कोलेस्ट्रॉल अधिक है। ' : ''}कृपया अपने डॉक्टर से मिलें।`,
    },
    keyFindings: [
      abnCount > 0 ? `${abnCount} of ${total} values are outside normal range` : 'All values within normal range',
      ga ? 'Blood sugar elevated — diabetes screening recommended' : 'Blood sugar levels normal',
      ca ? 'Cholesterol high — dietary changes may help' : 'Cholesterol levels look good',
    ],
    recommendations: [
      'Schedule a follow-up with your physician within 2 weeks',
      ha ? 'Monitor blood sugar daily; consider a diabetic diet' : 'Maintain balanced diet and regular exercise',
      ca ? 'Reduce saturated fat and increase physical activity' : 'Continue current healthy lifestyle habits',
    ],
    alerts, medicines,
  };
}


// ── Render local/sample results (with param table) ────────────

function renderResults(analysis, name, reportType) {
  const container  = document.getElementById('reportResults');
  const scoreColor = analysis.healthScore >= 75 ? '#34d399' : analysis.healthScore >= 50 ? '#fb923c' : '#f87171';
  const showTable  = reportType === 'blood';

  const alertsHTML = (analysis.alerts || []).map(a => {
    const cls  = a.level === 'High' ? 'alert-danger' : a.level === 'Medium' ? 'alert-warning' : 'alert-info';
    const icon = a.level === 'High' ? '🚨' : a.level === 'Medium' ? '⚠️' : 'ℹ️';
    return `<div class="alert ${cls}"><span class="alert-icon">${icon}</span><span>${a.message}</span></div>`;
  }).join('');

  const paramsRows = showTable ? (analysis.parameters || []).map(p => {
    const barColor = p.status === 'Normal' ? '#34d399' : p.status === 'High' ? '#f87171' : '#fb923c';
    const valClass = p.status === 'Normal' ? 'normal' : p.status === 'High' ? 'abnormal-high' : 'abnormal-low';
    const pct      = p.status === 'Normal' ? 50 : p.status === 'High' ? 82 : 18;
    return `<tr>
      <td><span class="param-name">${p.name}</span></td>
      <td><span class="param-value ${valClass}">${p.value} ${p.unit}</span></td>
      <td><span class="param-range">${p.normalRange}</span></td>
      <td><div class="range-bar"><div class="range-fill" style="width:${pct}%;background:${barColor};"></div></div></td>
      <td><span class="concern-badge concern-${p.concern.toLowerCase()}">${p.concern}</span></td>
      <td style="font-size:12px;color:var(--text-muted);max-width:180px;">${p.explanation}</td>
    </tr>`;
  }).join('') : '';

  const medsHTML = (analysis.medicines || []).map(m => `
    <div class="medicine-card">
      <div class="medicine-header">
        <div class="medicine-icon" style="background:rgba(56,189,248,0.1);">💊</div>
        <div>
          <div class="medicine-name">${m.name}</div>
          <div class="medicine-type">From your prescription</div>
        </div>
      </div>
      <div class="medicine-body">
        <div class="medicine-detail"><span class="medicine-detail-label">Purpose:</span><span>${m.purpose}</span></div>
        <div class="medicine-detail" style="flex-direction:column;gap:6px;">
          <span class="medicine-detail-label">Side Effects:</span>
          <div class="side-effects-list">${(m.sideEffects||[]).map(s=>`<span class="side-effect-tag">${s}</span>`).join('')}</div>
        </div>
      </div>
    </div>`).join('');

  const concernBadge = `<span class="concern-badge concern-${(analysis.overallConcern||'low').toLowerCase()}">${analysis.overallConcern||'Low'}</span>`;
  const firstTabActive = showTable ? 'active' : '';
  const summaryTabActive = showTable ? '' : 'active';

  container.innerHTML = `
    <div class="fade-in">
      ${alertsHTML}
      <div class="card" style="margin-bottom:20px;">
        <div class="result-header">
          <div>
            <div class="result-patient-name">${name}'s Lab Report</div>
            <div class="result-meta">Analyzed by MediBuddy AI (Sample / Offline)</div>
          </div>
          <div class="score-block">
            <div class="score-number" style="color:${scoreColor};">${analysis.healthScore}</div>
            <div class="score-label">Health Score</div>
            <div style="margin-top:8px;">${concernBadge}</div>
          </div>
        </div>

        <div class="content-tabs">
          ${showTable ? `<button class="content-tab active" onclick="switchTab(this,'tab-params')">📊 Parameters</button>` : ''}
          <button class="content-tab ${summaryTabActive}" onclick="switchTab(this,'tab-summary')">📝 Summary</button>
          ${analysis.medicines?.length ? `<button class="content-tab" onclick="switchTab(this,'tab-meds')">💊 Medicines</button>` : ''}
        </div>

        ${showTable ? `
        <div id="tab-params">
          <div style="overflow-x:auto;">
            <table class="param-table">
              <thead><tr>
                <th>Parameter</th><th>Your Value</th><th>Normal Range</th>
                <th>Bar</th><th>Concern</th><th>What it means</th>
              </tr></thead>
              <tbody>${paramsRows}</tbody>
            </table>
          </div>
        </div>` : ''}

        <div id="tab-summary" ${showTable ? 'style="display:none;"' : ''}>
          <div class="lang-switcher">
            <button class="lang-btn active" id="btn-en" onclick="switchLang('english')">🇬🇧 English</button>
            <button class="lang-btn"        id="btn-hi" onclick="switchLang('hindi')">🇮🇳 हिंदी</button>
          </div>
          <div class="summary-card">
            <div class="summary-text" id="summaryText">${(analysis.summary&&analysis.summary.english)||''}</div>
          </div>
        </div>

        <div id="tab-meds" style="display:none;">
          <div class="med-grid">
            ${medsHTML || '<div class="empty-state"><div class="empty-state-icon">💊</div><div>No medicines detected</div></div>'}
          </div>
        </div>
      </div>

      <div class="two-col">
        <div class="card">
          <div class="section-title" style="font-size:16px;">🔍 Key Findings</div>
          ${(analysis.keyFindings||[]).map(f=>`
            <div class="accordion-item">
              <div class="accordion-header" onclick="this.closest('.accordion-item').classList.toggle('open')">
                <span>${f}</span><span class="accordion-arrow">▼</span>
              </div>
              <div class="accordion-body">
                <div class="accordion-body-inner">Discuss this finding with your doctor for personalised guidance.</div>
              </div>
            </div>`).join('')}
        </div>
        <div class="card">
          <div class="section-title" style="font-size:16px;">💡 Recommendations</div>
          ${(analysis.recommendations||[]).map((r,i)=>`
            <div style="display:flex;gap:10px;margin-bottom:12px;font-size:13px;">
              <span style="color:var(--cyan);font-weight:700;min-width:20px;">${i+1}.</span>
              <span style="color:var(--text-muted);line-height:1.65;">${r}</span>
            </div>`).join('')}
        </div>
      </div>
    </div>`;

  container.scrollIntoView({ behavior: 'smooth', block: 'start' });
}


// ── Language / Tab switches ───────────────────────────────────

function switchLang(lang) {
  state.currentLang = lang;
  const a = state.lastAnalysis;
  if (!a || !a.summary) return;
  document.getElementById('btn-en').classList.toggle('active', lang === 'english');
  document.getElementById('btn-hi').classList.toggle('active', lang === 'hindi');
  document.getElementById('summaryText').textContent = a.summary[lang] || a.summary.english || '';
}

function switchTab(btn, tabId) {
  const card = btn.closest('.card');
  card.querySelectorAll('.content-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  card.querySelectorAll('[id^="tab-"],[id^="ftab-"]').forEach(t => t.style.display = 'none');
  const el = document.getElementById(tabId);
  if (el) el.style.display = 'block';
}


// ══════════════════════════════════════════════════════════════
//  MEDICINES
// ══════════════════════════════════════════════════════════════

const commonMedicines = [
  { name:'Metformin',     icon:'💊', color:'rgba(0,229,192,0.10)',   type:'Antidiabetic',            purpose:'Controls blood sugar in type 2 diabetes',            dose:'500–2000 mg/day', timing:'With meals',             sideEffects:['Nausea','Diarrhea','Stomach upset','Metallic taste'] },
  { name:'Atorvastatin',  icon:'💊', color:'rgba(56,189,248,0.10)',  type:'Statin',                  purpose:'Lowers LDL cholesterol, reduces cardiovascular risk', dose:'10–80 mg/day',    timing:'Any time, once daily',   sideEffects:['Muscle pain','Liver enzyme changes','Headache'] },
  { name:'Amlodipine',    icon:'💊', color:'rgba(248,113,113,0.10)', type:'Calcium Channel Blocker', purpose:'Treats high blood pressure and chest pain',           dose:'5–10 mg/day',     timing:'Once daily',             sideEffects:['Swollen ankles','Flushing','Dizziness'] },
  { name:'Omeprazole',    icon:'💊', color:'rgba(251,146,60,0.10)',  type:'Proton Pump Inhibitor',   purpose:'Reduces stomach acid; treats acid reflux and ulcers', dose:'20–40 mg/day',    timing:'30 min before meal',     sideEffects:['Headache','Diarrhea','Low magnesium (long-term)'] },
  { name:'Levothyroxine', icon:'💊', color:'rgba(167,139,250,0.10)', type:'Thyroid Hormone',         purpose:'Replaces thyroid hormone in hypothyroidism',          dose:'Varies by TSH',   timing:'Morning, empty stomach', sideEffects:['Palpitations if overdosed','Anxiety','Weight change'] },
  { name:'Aspirin',       icon:'💊', color:'rgba(248,113,113,0.08)', type:'Antiplatelet/Analgesic',  purpose:'Prevents blood clots; relieves pain and fever',       dose:'75–325 mg/day',   timing:'With food',              sideEffects:['GI upset','Bleeding risk','Tinnitus (high doses)'] },
];

let commonMedsRendered = false;

function renderCommonMeds() {
  if (commonMedsRendered) return;
  const c = document.getElementById('commonMeds');
  if (c) { c.innerHTML = commonMedicines.map(buildMedCard).join(''); commonMedsRendered = true; }
}

function buildMedCard(m) {
  const sideEffects = Array.isArray(m.sideEffects)
    ? m.sideEffects
    : (m.common_side_effects || '').split('|').map(s => s.trim()).filter(Boolean);

  return `
    <div class="medicine-card">
      <div class="medicine-header">
        <div class="medicine-icon" style="background:${m.color||'rgba(0,229,192,0.1)'};">${m.icon||'💊'}</div>
        <div>
          <div class="medicine-name">${m.name||m.medicine_name||''}</div>
          <div class="medicine-type">${m.type||m.medicine_class||''}</div>
        </div>
      </div>
      <div class="medicine-body">
        <div class="medicine-detail">
          <span class="medicine-detail-label">Purpose:</span>
          <span style="color:var(--text);font-size:13px;">${m.purpose||m.common_uses||''}</span>
        </div>
        ${(m.dose||m.how_to_take) ? `
        <div class="medicine-detail">
          <span class="medicine-detail-label">${m.dose?'Dosage:':'How to take:'}</span>
          <span style="font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--cyan);">${m.dose||m.how_to_take}</span>
        </div>` : ''}
        ${m.timing ? `
        <div class="medicine-detail">
          <span class="medicine-detail-label">Timing:</span>
          <span style="font-size:13px;color:var(--text-muted);">${m.timing}</span>
        </div>` : ''}
        ${m.warnings ? `
        <div class="medicine-detail">
          <span class="medicine-detail-label" style="color:var(--medium);">⚠️ Warnings:</span>
          <span style="font-size:12px;color:var(--medium);">${m.warnings}</span>
        </div>` : ''}
        <div class="medicine-detail" style="flex-direction:column;gap:6px;">
          <span class="medicine-detail-label">Side Effects:</span>
          <div class="side-effects-list">
            ${sideEffects.map(s=>`<span class="side-effect-tag">${s}</span>`).join('')}
          </div>
        </div>
        ${m.serious_side_effects ? `
        <div class="medicine-detail" style="flex-direction:column;gap:6px;margin-top:6px;">
          <span class="medicine-detail-label" style="color:var(--high);">🚨 Serious:</span>
          <div class="side-effects-list">
            ${m.serious_side_effects.split('|').map(s=>`<span class="side-effect-tag">${s.trim()}</span>`).join('')}
          </div>
        </div>` : ''}
        ${m.simple_explanation ? `
        <div style="margin-top:10px;padding:10px 12px;background:var(--surface2);border-radius:8px;
                    border:1px solid var(--border);font-size:12px;color:var(--text-muted);line-height:1.6;">
          💬 ${m.simple_explanation}
        </div>` : ''}
      </div>
    </div>`;
}

async function searchMedicine() {
  const query = document.getElementById('medSearchInput').value.trim();
  if (!query) { showToast('⚠️ Enter a medicine name', true); return; }

  // Check local list first
  const local = commonMedicines.find(m => m.name.toLowerCase().includes(query.toLowerCase()));
  if (local) {
    document.getElementById('medicineResults').innerHTML =
      `<div class="section-title">Result for "${query}"</div>
       <div class="med-grid">${buildMedCard(local)}</div>`;
    return;
  }

  // Call Flask /medicine
  showLoading(true);
  try {
    const resp = await fetch(`${FLASK_URL}/medicine`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ name: query }),
    });
    const data = await resp.json();
    showLoading(false);

    if (!resp.ok || data.error) {
      showToast(`⚠️ ${data.error || 'Could not find medicine info'}`, true);
      return;
    }
    document.getElementById('medicineResults').innerHTML =
      `<div class="section-title">Result for "${query}"</div>
       <div class="med-grid">${buildMedCard(data)}</div>`;
    showToast(`💊 Found info for ${data.medicine_name || query}!`);

  } catch {
    showLoading(false);
    showToast('⚠️ Cannot reach Flask server. Is it running?', true);
  }
}


// ══════════════════════════════════════════════════════════════
//  REMINDERS
// ══════════════════════════════════════════════════════════════

function addReminder() {
  const name = document.getElementById('rem-name').value.trim();
  const dose = document.getElementById('rem-dose').value.trim();
  const time = document.getElementById('rem-time').value;
  const freq = document.getElementById('rem-freq').value;
  if (!name) { showToast('⚠️ Enter a medicine name', true); return; }

  state.reminders.push({ id: Date.now(), name, dose, time, freq, active: true, ringing: false });

  fetch('http://localhost:3000/add-reminder', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, dose, time }),
  }).catch(() => {});

  document.getElementById('rem-name').value = '';
  document.getElementById('rem-dose').value = '';
  requestNotifPermission();
  renderReminders();
  showToast(`⏰ Reminder set for ${name}!`);
}

function renderReminders() {
  const c = document.getElementById('remindersList');
  if (!c) return;
  if (!state.reminders.length) {
    c.innerHTML = `<div class="empty-state">
      <div class="empty-state-icon">⏰</div>
      <div class="empty-state-title">No Reminders Yet</div>
      <div class="empty-state-sub">Add medicines above to get started</div>
    </div>`;
    return;
  }
  c.innerHTML = state.reminders.map(r => `
    <div class="reminder-card" style="flex-wrap:wrap;">
      <div class="reminder-time">${formatTime(r.time)}</div>
      <div class="reminder-info">
        <div class="reminder-name">${r.name}${r.dose?' — '+r.dose:''}</div>
        <div class="reminder-dose">${r.freq}</div>
      </div>
      <button class="reminder-toggle ${r.active?'on':''}" onclick="toggleReminder(${r.id},this)"></button>
      <button class="btn btn-secondary" style="padding:6px 12px;font-size:12px;" onclick="deleteReminder(${r.id})">🗑</button>
      ${r.ringing ? `
        <div style="width:100%;margin-top:12px;padding:12px 14px;
                    background:rgba(248,113,113,0.08);border:1px solid rgba(248,113,113,0.25);
                    border-radius:12px;display:flex;align-items:center;
                    justify-content:space-between;flex-wrap:wrap;gap:10px;">
          <span style="font-size:13px;color:var(--high);font-weight:600;">🔔 Time to take ${r.name}!</span>
          <button onclick="markAsTaken(${r.id})"
            style="padding:7px 18px;border-radius:9px;border:none;background:#34d399;
                   color:#040c16;font-size:13px;font-weight:700;cursor:pointer;">✅ Mark as Taken</button>
        </div>` : ''}
      <div style="width:100%;display:flex;margin-top:12px;padding-top:12px;border-top:1px solid var(--border);">
        <button onclick="sendWhatsApp(${r.id})"
          style="margin-left:auto;display:inline-flex;align-items:center;gap:7px;
                 padding:7px 16px;border-radius:9px;border:none;
                 background:linear-gradient(135deg,#25D366,#128C7E);
                 color:white;font-size:12px;font-weight:600;cursor:pointer;">
          📲 Send via WhatsApp
        </button>
      </div>
    </div>`).join('');
}

function toggleReminder(id, btn) {
  const r = state.reminders.find(r => r.id === id);
  if (r) { r.active = !r.active; btn.classList.toggle('on', r.active); }
}
function deleteReminder(id) {
  state.reminders = state.reminders.filter(r => r.id !== id);
  renderReminders();
}
function markAsTaken(id) {
  const r = state.reminders.find(r => r.id === id);
  if (!r) return;
  r.ringing = false; stopAlarm();
  firedToday.add(`${r.id}-${new Date().toDateString()}`);
  renderReminders();
  showToast(`✅ ${r.name} marked as taken!`);
}
function formatTime(t) {
  if (!t) return '—';
  const [h, m] = t.split(':').map(Number);
  return `${h%12||12}:${String(m).padStart(2,'0')} ${h>=12?'PM':'AM'}`;
}
function sendWhatsApp(id) {
  const r = state.reminders.find(r => r.id === id);
  if (!r) return;
  const msg = `🩺 *MediBuddy Reminder*\n\n💊 *${r.name}*${r.dose?` (${r.dose})`:''}\n⏰ *${formatTime(r.time)}*\n🔁 *${r.freq}*\n\nStay healthy! 💙`;
  window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  showToast('📲 Opening WhatsApp…');
}


// ══════════════════════════════════════════════════════════════
//  ALARM
// ══════════════════════════════════════════════════════════════

function playAlarm() {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  function beep(freq, startAt, dur) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.frequency.value = freq; o.type = 'square';
    g.gain.setValueAtTime(0.4, ctx.currentTime + startAt);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startAt + dur);
    o.start(ctx.currentTime + startAt); o.stop(ctx.currentTime + startAt + dur);
  }
  for (let i = 0; i < 4; i++) { beep(880,i*2.5,0.2); beep(880,i*2.5+0.3,0.2); beep(880,i*2.5+0.6,0.4); }
  window.currentAlarmCtx = ctx;
  setTimeout(() => ctx.close(), 12000);
}
function stopAlarm() {
  if (window.currentAlarmCtx) { window.currentAlarmCtx.close(); window.currentAlarmCtx = null; }
}

async function requestNotifPermission() {
  if (!('Notification' in window) || Notification.permission !== 'default') return;
  if (await Notification.requestPermission() === 'granted') showToast('🔔 Notifications enabled!');
}
function fireReminder(r) {
  r.ringing = true; renderReminders();
  new Notification(`💊 Time for ${r.name}`, { body: `${r.freq} • MediBuddy`, tag: `med-${r.id}` });
  playAlarm();
  if (navigator.vibrate) navigator.vibrate([500,300,500,300,800]);
}
setInterval(() => {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const now = new Date();
  const hh = String(now.getHours()).padStart(2,'0');
  const mm = String(now.getMinutes()).padStart(2,'0');
  const today = now.toDateString();
  state.reminders.forEach(r => {
    if (!r.active || r.time !== `${hh}:${mm}`) return;
    const key = `${r.id}-${today}`;
    if (firedToday.has(key)) return;
    firedToday.add(key); fireReminder(r);
  });
}, 30000);


// ── Loading / Toast ───────────────────────────────────────────

function showLoading(show) {
  document.getElementById('loadingOverlay').classList.toggle('active', show);
  if (show) {
    const el = document.getElementById('loadingSubText');
    if (el) el.textContent = 'Uploading your report...';
  }
}
function showToast(msg, isError = false) {
  const toast = document.getElementById('toast');
  document.getElementById('toastMsg').textContent = msg;
  toast.className = 'toast show' + (isError ? '' : ' success');
  setTimeout(() => toast.classList.remove('show'), 3200);
}

// ── Init ──────────────────────────────────────────────────────
renderReminders();
