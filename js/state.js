/* ============================================================
   SECTION: STATE
   ============================================================ */
let currentProfile = 'home';
let phase = 'bulk';
let phaseSince = new Date().toISOString().split('T')[0];
let tombstones = [];          /* {id, mod} of deleted entries — lets deletes sync */
let metaMod = 0;              /* last-touched timestamp for config/customs/phase/bw */
let syncCfg = { token: '', gistId: '', lastSync: 0 };
let syncBusy = false;
let entries = [];
let currentTab = 'log';
let filterSplit = 'All';
let selectedExercise = '';
let chartExercise = '';
let chartMetric = 'e1rm';
let bodyweight = null;
let numSets = 3;
let editingId = null;
let config = null;              /* per-profile split layout */
let customExercises = [];
let mapMode = 'exercise';       /* 'exercise' | 'split' */
let prefillFor = null;          /* which exercise the form is currently prefilled for */
let formVals = { weight: '', reps: {}, strain: false, note: '', incline: '', minutes: '', mph: '' };
let pinnedTip = null;
let chartTipData = [];
let pendingDelete = null;
let manageUnlocked = false;
let addingTo = null;            /* split currently in "add exercise" mode */
let addSearch = '';
let customFormOpen = false;
let customSel = { name: '', bw: false, cardio: false, p: new Set(), s: new Set() };
let statsVolMode = 'muscle';    /* 'muscle' | 'split' */
let historyFilterSplit = 'All';
let historyFilterExercise = 'All';

/* ============================================================
   SECTION: SMALL HELPERS
   ============================================================ */
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function expandMuscles(arr) {
  const out = [];
  (arr || []).forEach(t => {
    if (ALIAS[t]) ALIAS[t].forEach(id => { if (!out.includes(id)) out.push(id); });
    else if (MUSCLES[t] && !out.includes(t)) out.push(t);
  });
  return out;
}

function muscleNames(ids) {
  const left = new Set(ids);
  const names = [];
  PAIRS.forEach(([pair, label]) => {
    if (pair.every(id => left.has(id))) {
      names.push(label);
      pair.forEach(id => left.delete(id));
    }
  });
  left.forEach(id => names.push(MUSCLES[id] || id));
  return names;
}

function getLibrary() {
  return LIB.concat(customExercises);
}

function libGet(name) {
  return getLibrary().find(e => e.n === name) || null;
}

function isBWExercise(exercise) {
  const e = libGet(exercise);
  return !!(e && e.bw);
}

function isCardio(exercise) {
  const e = libGet(exercise);
  return !!(e && e.cardio);
}

function getCardioExercises() {
  return getLibrary().filter(e => e.cardio).map(e => e.n).sort((a, b) => a.localeCompare(b));
}

/* vertical climb in feet: distance × grade */
function calcVert(incline, minutes, mph) {
  return Math.round(mph * 5280 * (minutes / 60) * (incline / 100));
}

function cardioDetail(e) {
  return e.incline + '% · ' + e.mph + ' mph · ' + e.minutes + ' min';
}

function cardioMiles(e) {
  return Math.round(e.mph * (e.minutes / 60) * 100) / 100;
}

function calcE1RM(w, r) {
  if (r <= 0) return 0;
  if (r === 1) return w;
  return Math.round(w * (1 + r / 30) * 10) / 10;
}

function getAvgE1RM(entry) {
  if (entry.setData && entry.setData.length > 0) {
    const e1rms = entry.setData.map(s => calcE1RM(entry.weight, s.reps));
    return Math.round(e1rms.reduce((a, b) => a + b, 0) / e1rms.length * 10) / 10;
  }
  return calcE1RM(entry.weight, entry.reps || 0);
}

function getSetE1RMs(entry) {
  if (entry.setData) return entry.setData.map(s => calcE1RM(entry.weight, s.reps));
  return [calcE1RM(entry.weight, entry.reps || 0)];
}

function getTotalVolume(entry) {
  if (entry.setData) return entry.setData.reduce((sum, s) => sum + entry.weight * s.reps, 0);
  return entry.weight * (entry.reps || 0) * (entry.sets || 0);
}

function formatDate(d) {
  const dt = new Date(d + 'T12:00:00');
  return (dt.getMonth() + 1) + '/' + dt.getDate();
}

function formatDateFull(d) {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const dt = new Date(d + 'T12:00:00');
  return months[dt.getMonth()] + ' ' + dt.getDate() + ', ' + dt.getFullYear();
}

function isoDaysAgo(n) {
  const dt = new Date();
  dt.setDate(dt.getDate() - n);
  return dt.toISOString().split('T')[0];
}

function setsDisplay(entry) {
  if (entry.setData) return entry.setData.map((s, i) => 'S' + (i + 1) + ': ' + s.reps).join('  ');
  return entry.reps + ' reps × ' + entry.sets + ' sets';
}

function setsShort(entry) {
  if (entry.setData) return entry.setData.map(s => s.reps).join('/');
  return entry.reps + '×' + entry.sets;
}

function migrateEntry(entry) {
  if (entry.cardio) {
    entry.strain = !!entry.strain;
    entry.note = entry.note || '';
    entry.phase = entry.phase || null;
    entry.mod = entry.mod || entry.id || Date.now();
    entry.vert = calcVert(entry.incline || 0, entry.minutes || 0, entry.mph || 0);
    return entry;
  }
  if (!entry.setData && entry.reps !== undefined && entry.sets !== undefined) {
    entry.setData = [];
    for (let i = 0; i < (entry.sets || 3); i++) entry.setData.push({ reps: entry.reps });
  }
  entry.strain = !!entry.strain;
  entry.note = entry.note || '';
  entry.phase = entry.phase || null;
  entry.mod = entry.mod || entry.id || Date.now();
  entry.e1rm = getAvgE1RM(entry);
  entry.volume = getTotalVolume(entry);
  return entry;
}

/* ---- toast (supports UNDO action) ---- */
let toastTimer = null;
function showToast(msg, opts) {
  opts = opts || {};
  const t = document.getElementById('toast');
  t.style.background = opts.color || 'var(--green)';
  t.innerHTML = esc(msg) + (opts.undo ? '<button class="undo-btn" onclick="undoDelete()">UNDO</button>' : '');
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), opts.duration || 2200);
}

/* ============================================================
   SECTION: SPLIT CONFIG (stored, editable)
   ============================================================ */
function defaultConfig() {
  const c = {};
  ['home', 'gym'].forEach(p => {
    c[p] = {};
    SPLIT_ORDER.forEach(s => { c[p][s] = (SEED[p][s] || []).slice(); });
  });
  return c;
}

function getSplits() {
  const out = {};
  SPLIT_ORDER.forEach(s => {
    out[s] = { color: SPLIT_COLORS[s], exercises: (config[currentProfile][s] || []) };
  });
  return out;
}

function getAllExercises() {
  const exs = [];
  Object.values(getSplits()).forEach(s => {
    s.exercises.forEach(ex => { if (!exs.includes(ex)) exs.push(ex); });
  });
  return exs.sort((a, b) => a.localeCompare(b));
}

function getExerciseSplit(exercise) {
  const splits = [];
  Object.entries(getSplits()).forEach(([name, data]) => {
    if (data.exercises.includes(exercise)) splits.push(name);
  });
  return splits;
}

function getSplitColor(exercise) {
  if (isCardio(exercise)) return CARDIO_COLOR;
  const splits = getExerciseSplit(exercise);
  if (splits.length > 0) return SPLIT_COLORS[splits[0]];
  for (const p of ['home', 'gym']) {
    for (const s of SPLIT_ORDER) {
      if ((config[p][s] || []).includes(exercise)) return SPLIT_COLORS[s];
    }
  }
  return '#e85d3a';
}

function getSplitName(exercise) {
  if (isCardio(exercise)) return 'Cardio';
  const splits = getExerciseSplit(exercise);
  if (splits.length > 0) return splits.join(' / ');
  for (const p of ['home', 'gym']) {
    const s = SPLIT_ORDER.filter(name => (config[p][name] || []).includes(exercise));
    if (s.length > 0) return s.join(' / ');
  }
  return '';
}

/* ============================================================
   SECTION: STORAGE
   ============================================================ */
const store = {
  async get(key) {
    if (window.storage && typeof window.storage.get === 'function') {
      try { const r = await window.storage.get(key); return r ? r.value : null; } catch (e) { return null; }
    }
    try { return localStorage.getItem(key); } catch (e) { return null; }
  },
  async set(key, value) {
    if (window.storage && typeof window.storage.set === 'function') {
      try { await window.storage.set(key, value); return; } catch (e) {}
    }
    try { localStorage.setItem(key, value); } catch (e) {}
  }
};

async function loadData() {
  try {
    const raw = await store.get('lift-tracker-entries');
    if (raw) entries = JSON.parse(raw).map(migrateEntry);
  } catch (e) {}
  try {
    const bw = await store.get('lift-tracker-bodyweight');
    if (bw) bodyweight = parseFloat(bw) || null;
  } catch (e) {}
  try {
    const prof = await store.get('lift-tracker-profile');
    if (prof === 'home' || prof === 'gym') currentProfile = prof;
  } catch (e) {}
  try {
    const cfg = await store.get('lift-tracker-config-v2');
    if (cfg) {
      const parsed = JSON.parse(cfg);
      if (parsed && parsed.home && parsed.gym) config = parsed;
    }
  } catch (e) {}
  if (!config) config = defaultConfig();
  try {
    const cus = await store.get('lift-tracker-custom-ex');
    if (cus) {
      const parsed = JSON.parse(cus);
      if (Array.isArray(parsed)) customExercises = parsed;
    }
  } catch (e) {}
  try {
    const tb = await store.get('lift-tracker-tombstones');
    if (tb) { const p = JSON.parse(tb); if (Array.isArray(p)) tombstones = p; }
  } catch (e) {}
  try {
    const mm = await store.get('lift-tracker-metamod');
    if (mm) metaMod = parseInt(mm) || 0;
  } catch (e) {}
  try {
    const sc = await store.get('lift-tracker-sync');
    if (sc) { const p = JSON.parse(sc); if (p) syncCfg = Object.assign(syncCfg, p); }
  } catch (e) {}
  try {
    const ph = await store.get('lift-tracker-phase');
    if (ph) {
      const parsed = JSON.parse(ph);
      if (parsed && PHASE_META[parsed.phase]) { phase = parsed.phase; phaseSince = parsed.since || phaseSince; }
    }
  } catch (e) {}
  try {
    const ui = await store.get('lift-tracker-ui');
    if (ui) {
      const parsed = JSON.parse(ui);
      if (parsed && (parsed.statsVolMode === 'split' || parsed.statsVolMode === 'muscle')) statsVolMode = parsed.statsVolMode;
    }
  } catch (e) {}
  initProfile();
  document.getElementById('verLabel').textContent = 'v' + APP_VERSION;
  updateHeader();
  updateToggleUI();
  updatePhaseUI();
  render();
  /* PWA: ask the browser not to evict our data, register offline worker */
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}
  try {
    if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
      navigator.serviceWorker.register('./sw.js');
    }
  } catch (e) {}
}

async function saveData() {
  try { await store.set('lift-tracker-entries', JSON.stringify(entries)); } catch (e) {}
}
async function saveConfig() {
  try { await store.set('lift-tracker-config-v2', JSON.stringify(config)); } catch (e) {}
}
async function saveCustoms() {
  try { await store.set('lift-tracker-custom-ex', JSON.stringify(customExercises)); } catch (e) {}
}
async function saveUI() {
  try { await store.set('lift-tracker-ui', JSON.stringify({ statsVolMode })); } catch (e) {}
}
async function saveBodyweight(w) {
  if (!w || isNaN(w) || w <= 0) return;
  bodyweight = w;
  try { await store.set('lift-tracker-bodyweight', String(w)); } catch (e) {}
}

function bwChanged(el) {
  const w = parseFloat(el.value);
  if (!w || w <= 0) { el.value = bodyweight || ''; return; }  /* keep previous value, never a hardcoded default */
  saveBodyweight(w); bumpMeta();
  render();
}

function initProfile() {
  const exs = [...new Set([...getAllExercises(), ...getCardioExercises()])];
  if (!exs.includes(selectedExercise)) selectedExercise = exs[0] || '';
  if (!exs.includes(chartExercise)) chartExercise = exs[0] || '';
  filterSplit = 'All';
  prefillFor = null;
}

async function toggleProfile() {
  currentProfile = currentProfile === 'home' ? 'gym' : 'home';
  try { await store.set('lift-tracker-profile', currentProfile); } catch (e) {}
  initProfile();
  updateToggleUI();
  updateHeader();
  render();
}

function updateToggleUI() {
  const track = document.getElementById('profileToggle');
  const lHome = document.getElementById('label-home');
  const lGym = document.getElementById('label-gym');
  if (currentProfile === 'gym') {
    track.classList.add('gym'); lGym.classList.add('active'); lHome.classList.remove('active');
  } else {
    track.classList.remove('gym'); lHome.classList.add('active'); lGym.classList.remove('active');
  }
}

async function saveTombstones() {
  try { await store.set('lift-tracker-tombstones', JSON.stringify(tombstones.slice(-500))); } catch (e) {}
}
async function bumpMeta() {
  metaMod = Date.now();
  try { await store.set('lift-tracker-metamod', String(metaMod)); } catch (e) {}
}
async function saveSyncCfg() {
  try { await store.set('lift-tracker-sync', JSON.stringify(syncCfg)); } catch (e) {}
}

async function savePhase() {
  try { await store.set('lift-tracker-phase', JSON.stringify({ phase, since: phaseSince })); } catch (e) {}
}

async function setPhase(p) {
  if (!PHASE_META[p] || p === phase) return;
  phase = p;
  phaseSince = new Date().toISOString().split('T')[0];
  await savePhase(); await bumpMeta();
  await restampEntries();
  updatePhaseUI();
  showToast('Phase: ' + PHASE_META[p].label + ' — ' + PHASE_META[p].blurb, { color: PHASE_META[p].color, duration: 2800 });
  render();
}

/* re-tag entries after a phase or start-date change:
   on/after the start date → current phase; before it and wrongly carrying
   the current phase → cleared (unknown) */
async function restampEntries() {
  let n = 0;
  entries.forEach(e => {
    if (e.date >= phaseSince) {
      if (e.phase !== phase) { e.phase = phase; n++; }
    } else if (e.phase === phase) {
      e.phase = null; n++;
    }
  });
  if (n > 0) await saveData();
  return n;
}

async function phaseSinceChanged(el) {
  const v = el.value;
  const today = new Date().toISOString().split('T')[0];
  if (!v || v > today) { el.value = phaseSince; return; }
  phaseSince = v;
  await savePhase(); await bumpMeta();
  const n = await restampEntries();
  updatePhaseUI();
  showToast(PHASE_META[phase].label + ' since ' + formatDateFull(v) + (n ? ' — ' + n + ' entries re-tagged' : ''), { color: PHASE_META[phase].color, duration: 3000 });
  render();
}

function updatePhaseUI() {
  const row = document.getElementById('phaseRow');
  if (!row) return;
  let html = '<span style="font-size:9px;letter-spacing:2px;color:var(--dim);align-self:center">PHASE</span>';
  Object.entries(PHASE_META).forEach(([key, m]) => {
    const a = phase === key;
    html += '<button class="phase-btn' + (a ? ' active' : '') + '" onclick="setPhase(\'' + key + '\')" style="' +
      (a ? 'border-color:' + m.color + ';background:' + m.color + '18;color:' + m.color : '') +
      '">' + m.label + '</button>';
  });
  html += '<span class="phase-since">since <input type="date" value="' + phaseSince + '" max="' +
    new Date().toISOString().split('T')[0] + '" onchange="phaseSinceChanged(this)" title="edit phase start date"></span>';
  row.innerHTML = html;
}

/* best avg e1RM for an exercise before the current phase started */
function prePhaseBaseline(ex) {
  const before = entries.filter(e => e.exercise === ex && e.date < phaseSince);
  return before.length ? Math.max(...before.map(e => e.e1rm)) : null;
}

function updateHeader() {
  const profileExs = getAllExercises();
  const profileEntries = entries.filter(e => profileExs.includes(e.exercise));
  const exSet = new Set(profileEntries.map(e => e.exercise));
  document.getElementById('headerStats').textContent =
    profileEntries.length + ' entries · ' + exSet.size + ' exercises · ' + (currentProfile === 'home' ? 'Home' : 'Gym');
}

function switchTab(tab) {
  currentTab = tab;
  pinnedTip = null;
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.add('active');
  render();
}

function render() {
  const c = document.getElementById('content');
  if (currentTab === 'log') renderLog(c);
  else if (currentTab === 'chart') renderChart(c);
  else if (currentTab === 'stats') renderStats(c);
  else renderHistory(c);
}
