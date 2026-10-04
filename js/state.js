/* ============================================================
   SECTION: STATE
   ============================================================ */
let currentProfile = 'home';
/* phase history is the source of truth; `phase` / `phaseSince` are derived
   from the LAST segment so every existing call site keeps working. */
let phases = [];              /* [{phase, since}] sorted ascending by since */
let phase = 'bulk';
let phaseSince = new Date().toISOString().split('T')[0];
let bwLog = [];               /* [{date, w, mod}] dated weigh-ins, sorted ascending */
let bwTombstones = [];        /* [{date, mod}] of deleted weigh-ins — lets deletes sync */
let bwGoal = null;            /* target bodyweight for the chart goal line */
let editingBwDate = null;     /* which day's weigh-in the history tab is editing */
let logDateVal = null;        /* date currently chosen in the log form */
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
let alts = null;                /* per-profile curated alternates: {home:{ex:[...]}, gym:{...}} */
let altFor = null;              /* exercise whose alternate panel is open on the log tab */
let altEditFor = null;          /* exercise being curated in the manage overlay */
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

/* Epley, with reps clamped at E1RM_REP_CAP. Past ~12 reps the formula
   extrapolates rather than estimates, so e1RM saturates and VOLUME becomes
   the meaningful metric for high-rep work. */
function calcE1RM(w, r) {
  if (r <= 0) return 0;
  if (r === 1) return w;
  return Math.round(w * (1 + Math.min(r, E1RM_REP_CAP) / 30) * 10) / 10;
}

/* true when any set ran past the cap, so the UI can say e1RM is pinned */
function isCapped(entry) {
  const sd = entry && entry.setData;
  if (!sd) return ((entry && entry.reps) || 0) > E1RM_REP_CAP;
  return sd.some(x => (x.reps || 0) > E1RM_REP_CAP);
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
    if (!entry.phaseLocked) delete entry.phaseLocked;
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
  if (!entry.phaseLocked) delete entry.phaseLocked;
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
   SECTION: EXERCISE ALTERNATES
   Equipment is occupied at 5am, so every exercise needs fallbacks.
   Curated lists win; otherwise they're ranked from the muscle tags.
   A swap is a one-tap JUMP, not an alias — the entry saves under the
   exercise actually performed, so e1RM charts and volume stay honest.
   ============================================================ */

function defaultAlts() { return { home: {}, gym: {} }; }

/* the lead primary tag is what the exercise is FOR — plain tag overlap
   ranks Machine Shoulder Press above Pec Deck as an incline-press sub */
function leadMuscles(ex) {
  const lib = libGet(ex);
  if (!lib) return [];
  return expandMuscles((lib.p || []).slice(0, 1));
}

/* the volume group a muscle id rolls up into — soleus and gastrocnemius are
   disjoint tags but the same trainable group, so calves find nothing without this */
function volGroupOf(id) {
  const g = VOL_GROUPS.find(x => x.ids.includes(id));
  return g ? g.key : null;
}

function altScore(a, b, strict) {
  const la = libGet(a), lb = libGet(b);
  if (!la || !lb) return 0;
  const pa = expandMuscles(la.p), pb = expandMuscles(lb.p);
  if (!pa.length || !pb.length) return 0;
  if (strict === 'group') {
    /* coarsest tier: same volume group for the lead muscle */
    const ga = leadMuscles(a).map(volGroupOf).filter(Boolean);
    const gb = leadMuscles(b).map(volGroupOf).filter(Boolean);
    if (!ga.some(k => gb.includes(k))) return 0;
    return 0.4;   /* above the 0.3 floor, below any real tag match */
  }
  if (strict) {
    const ma = leadMuscles(a), mb = leadMuscles(b);
    if (!ma.some(id => mb.includes(id)) && !mb.some(id => ma.includes(id))) return 0;
  }
  const inter = pa.filter(x => pb.includes(x)).length;
  const uni = new Set(pa.concat(pb)).size;
  const sa = expandMuscles(la.s), sb = expandMuscles(lb.s);
  const si = sa.filter(x => sb.includes(x)).length;
  const su = new Set(sa.concat(sb)).size;
  return Math.round((inter / uni + 0.15 * (su ? si / su : 0)) * 1000) / 1000;
}

/* ranked candidates: things already in this profile's splits come first,
   because those are demonstrably available where you train */
function autoAlts(ex, limit) {
  const lib = libGet(ex);
  if (!lib || lib.cardio) return [];
  const inProfile = new Set(getAllExercises());
  const pool = getLibrary().filter(e => e.n !== ex && !e.cardio && (e.p || []).length);
  const rank = strict => pool
    .map(e => ({ n: e.n, s: altScore(ex, e.n, strict), inP: inProfile.has(e.n) ? 1 : 0 }))
    .filter(x => x.s > 0.3)
    .sort((a, b) => (b.inP - a.inP) || (b.s - a.s));
  let out = rank(true);                 /* lead primary muscle must match */
  if (!out.length) out = rank(false);   /* any primary overlap */
  if (!out.length) out = rank('group'); /* same volume group (calves) */
  return out.slice(0, limit || 8);
}

/* curated list if one exists, otherwise the auto ranking */
function getAlts(ex) {
  const cur = alts && alts[currentProfile] && alts[currentProfile][ex];
  if (Array.isArray(cur)) return cur.filter(n => libGet(n));
  return autoAlts(ex, 5).map(x => x.n);
}

function isAltCurated(ex) {
  return !!(alts && alts[currentProfile] && Array.isArray(alts[currentProfile][ex]));
}

async function setAlts(ex, list) {
  if (!alts) alts = defaultAlts();
  if (!alts[currentProfile]) alts[currentProfile] = {};
  if (list === null) delete alts[currentProfile][ex];
  else alts[currentProfile][ex] = list;
  await saveAlts(); await bumpMeta();
}

async function saveAlts() {
  try { await store.set('lift-tracker-alts', JSON.stringify(alts || defaultAlts())); } catch (e) {}
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
    const al = await store.get('lift-tracker-alts');
    if (al) {
      const parsed = JSON.parse(al);
      if (parsed && typeof parsed === 'object') alts = { home: parsed.home || {}, gym: parsed.gym || {} };
    }
  } catch (e) {}
  if (!alts) alts = defaultAlts();
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
      if (parsed) {
        if (PHASE_META[parsed.phase]) { phase = parsed.phase; phaseSince = parsed.since || phaseSince; }
        if (Array.isArray(parsed.phases) && parsed.phases.filter(validSeg).length) {
          phases = parsed.phases;
        } else if (PHASE_META[parsed.phase]) {
          /* upgrading from the single-phase format: rebuild the history from
             whatever entry tags survived, then append the stored current phase */
          const inf = inferPhasesFromEntries();
          phases = inf.length ? inf : [];
          const last = phases[phases.length - 1];
          if (!last || parsed.since > last.since) phases.push({ phase: parsed.phase, since: parsed.since || isoToday() });
        }
      }
    }
  } catch (e) {}
  normalizePhases();
  try {
    const bl = await store.get('lift-tracker-bw-log');
    if (bl) { const p = JSON.parse(bl); if (Array.isArray(p)) bwLog = p.filter(r => r && r.date && r.w > 0); }
  } catch (e) {}
  try {
    const bt = await store.get('lift-tracker-bw-tombstones');
    if (bt) { const p = JSON.parse(bt); if (Array.isArray(p)) bwTombstones = p; }
  } catch (e) {}
  try {
    const bg = await store.get('lift-tracker-bw-goal');
    if (bg) bwGoal = parseFloat(bg) || null;
  } catch (e) {}
  sortBwLog();
  /* seed the log from the legacy scalar so the chart isn't empty on upgrade */
  if (!bwLog.length && bodyweight > 0) {
    const lastEntry = entries.length ? entries[entries.length - 1].date : isoToday();
    bwLog = [{ date: lastEntry, w: bodyweight, mod: Date.now() }];
    await saveBwLog();
  }
  bodyweight = latestBw();
  /* regenerate entry tags from the history — repairs anything the old
     restamp logic cleared, and is a no-op once they already agree */
  await restampEntries();
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

/* date currently selected in the log form */
function logDate() {
  const el = document.getElementById('dateInput');
  if (el && el.value) return el.value;
  return logDateVal || isoToday();
}

async function logDateChanged(el) {
  const v = el.value;
  if (!v) { el.value = logDate(); return; }
  captureFormVals();
  logDateVal = v;
  render();
}

/* bodyweight entered on the log tab is a weigh-in for the form's DATE,
   not just "now" — so backfilling a missed morning works */
async function bwChanged(el) {
  const d = logDate();
  const w = parseFloat(el.value);
  if (!w || w <= 0) { el.value = bodyweightOn(d) || bodyweight || ''; return; }
  const n = await setBodyweightOn(d, w);
  showToast(w + ' lb on ' + formatDateFull(d) +
    (n ? ' — ' + n + ' bodyweight ' + (n === 1 ? 'entry' : 'entries') + ' recalculated' : ''),
    { duration: n ? 3200 : 2200 });
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
/* one-slot pre-destruction snapshot — CLEAR ALL and IMPORT both wipe
   entries, and there was no way back */
async function saveSafety(reason) {
  try {
    await store.set('lift-tracker-safety', JSON.stringify({
      at: Date.now(), reason: reason || '', payload: buildSyncPayload()
    }));
  } catch (e) {}
}

async function getSafety() {
  try {
    const raw = await store.get('lift-tracker-safety');
    if (!raw) return null;
    const p = JSON.parse(raw);
    return (p && p.payload && Array.isArray(p.payload.entries)) ? p : null;
  } catch (e) { return null; }
}

async function saveSyncCfg() {
  try { await store.set('lift-tracker-sync', JSON.stringify(syncCfg)); } catch (e) {}
}

/* ---- phase history ------------------------------------------------------
   Entry phase tags are DERIVED from this history, never inferred from a
   single current phase. That makes restamping idempotent: re-entering a
   phase you've been in before can no longer erase the earlier stretch. */

function isoToday() { return new Date().toISOString().split('T')[0]; }
function validSeg(s) {
  return !!(s && PHASE_META[s.phase] && typeof s.since === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s.since));
}

/* drop junk, sort, and collapse runs of the same phase to their earliest start */
function normalizePhases() {
  phases = (phases || []).filter(validSeg).sort((a, b) => a.since.localeCompare(b.since));
  const out = [];
  phases.forEach(s => {
    const prev = out[out.length - 1];
    if (prev && prev.since === s.since) { out[out.length - 1] = { phase: s.phase, since: s.since }; return; }
    if (prev && prev.phase === s.phase) return;   /* same phase continuing — keep earlier start */
    out.push({ phase: s.phase, since: s.since });
  });
  phases = out;
  if (!phases.length) phases = [{ phase: phase || 'bulk', since: phaseSince || isoToday() }];
  const last = phases[phases.length - 1];
  phase = last.phase;
  phaseSince = last.since;
}

/* phase in effect on a given date, or null if it predates all history */
function phaseForDate(d) {
  let out = null;
  for (let i = 0; i < phases.length; i++) {
    if (phases[i].since <= d) out = phases[i].phase; else break;
  }
  return out;
}

/* rebuild the history from surviving per-entry tags — recovery path for
   backups that carry correct entry tags but no history */
function inferPhasesFromEntries() {
  const tagged = entries.filter(e => e.phase && PHASE_META[e.phase])
    .slice().sort((a, b) => a.date.localeCompare(b.date));
  const out = [];
  tagged.forEach(e => {
    const prev = out[out.length - 1];
    if (!prev || prev.phase !== e.phase) out.push({ phase: e.phase, since: e.date });
  });
  return out;
}

async function savePhase() {
  /* `phase`/`since` stay in the payload so older builds and older backups
     still read something sensible — storage key is unchanged. */
  try {
    await store.set('lift-tracker-phase', JSON.stringify({ phase, since: phaseSince, phases }));
  } catch (e) {}
}

async function setPhase(p) {
  if (!PHASE_META[p]) return;
  const today = isoToday();
  if (phase === p && phaseSince === today) return;
  const i = phases.findIndex(s => s.since === today);
  if (i >= 0) phases[i] = { phase: p, since: today };
  else phases.push({ phase: p, since: today });
  normalizePhases();
  await savePhase(); await bumpMeta();
  const n = await restampEntries();
  updatePhaseUI();
  showToast('Phase: ' + PHASE_META[p].label + ' — ' + PHASE_META[p].blurb +
    (n ? ' · ' + n + ' re-tagged' : ''), { color: PHASE_META[p].color, duration: 2800 });
  render();
}

/* derive every entry's phase from the history; locked entries are left alone */
async function restampEntries() {
  let n = 0;
  entries.forEach(e => {
    if (e.phaseLocked) return;
    const p = phaseForDate(e.date);
    if (e.phase !== p) { e.phase = p; e.mod = Date.now(); n++; }
  });
  if (n > 0) await saveData();
  return n;
}

/* editing the date on the header row moves the CURRENT segment's start */
async function phaseSinceChanged(el) {
  const v = el.value;
  if (!v || v > isoToday()) { el.value = phaseSince; return; }
  const prev = phases.length > 1 ? phases[phases.length - 2] : null;
  if (prev && v <= prev.since) {
    el.value = phaseSince;
    showToast('Start must be after ' + formatDateFull(prev.since) + ' — use PHASE HISTORY to reorder', { color: 'var(--amber)', duration: 3400 });
    return;
  }
  phases[phases.length - 1] = { phase: phase, since: v };
  normalizePhases();
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
    isoToday() + '" onchange="phaseSinceChanged(this)" title="edit the current phase start date"></span>';
  html += '<button class="data-btn" onclick="openPhaseHistory()" title="phase history + bodyweight">⏱ HISTORY</button>';
  row.innerHTML = html;
}

/* ---- dated bodyweight log ---------------------------------------------- */

function sortBwLog() { bwLog.sort((a, b) => a.date.localeCompare(b.date)); }

/* most recent weigh-in on or before a date; null if none */
function bodyweightOn(d) {
  let out = null;
  for (let i = 0; i < bwLog.length; i++) {
    if (bwLog[i].date <= d) out = bwLog[i].w; else break;
  }
  return out;
}

function latestBw() { return bwLog.length ? bwLog[bwLog.length - 1].w : (bodyweight || null); }

/* trailing n-day mean at each weigh-in — the signal to steer a slow build by */
function bwRolling(n) {
  return bwLog.map(r => {
    const from = new Date(r.date + 'T12:00:00');
    from.setDate(from.getDate() - (n - 1));
    const fromISO = from.toISOString().split('T')[0];
    const win = bwLog.filter(x => x.date >= fromISO && x.date <= r.date);
    return { date: r.date, w: Math.round(win.reduce((s, x) => s + x.w, 0) / win.length * 100) / 100, n: win.length };
  });
}

/* recompute bodyweight-loaded entries from the weigh-in log, forward of a date.
   Entries with no weigh-in on or before them are left frozen. */
async function recalcBWEntries(fromDate) {
  let n = 0;
  entries.forEach(e => {
    if (e.cardio || !isBWExercise(e.exercise)) return;
    if (fromDate && e.date < fromDate) return;
    const w = bodyweightOn(e.date);
    if (!(w > 0) || w === e.weight) return;
    e.weight = w;
    e.e1rm = getAvgE1RM(e);
    e.volume = getTotalVolume(e);
    e.mod = Date.now();
    n++;
  });
  if (n > 0) await saveData();
  return n;
}

async function setBodyweightOn(date, w) {
  if (!date || !(w > 0)) return 0;
  const i = bwLog.findIndex(r => r.date === date);
  if (i >= 0) bwLog[i] = { date, w, mod: Date.now() };
  else bwLog.push({ date, w, mod: Date.now() });
  sortBwLog();
  bwTombstones = bwTombstones.filter(t => t.date !== date);
  bodyweight = latestBw();
  await saveBwLog(); await saveBwTombstones();
  try { await store.set('lift-tracker-bodyweight', String(bodyweight)); } catch (e) {}
  await bumpMeta();
  return await recalcBWEntries(date);
}

async function deleteBodyweightOn(date) {
  const i = bwLog.findIndex(r => r.date === date);
  if (i < 0) return 0;
  bwLog.splice(i, 1);
  bwTombstones.push({ date, mod: Date.now() });
  sortBwLog();
  bodyweight = latestBw();
  await saveBwLog(); await saveBwTombstones();
  try { if (bodyweight) await store.set('lift-tracker-bodyweight', String(bodyweight)); } catch (e) {}
  await bumpMeta();
  return await recalcBWEntries(date);
}

async function saveBwLog() {
  try { await store.set('lift-tracker-bw-log', JSON.stringify(bwLog)); } catch (e) {}
}
async function saveBwTombstones() {
  try { await store.set('lift-tracker-bw-tombstones', JSON.stringify(bwTombstones.slice(-300))); } catch (e) {}
}
async function saveBwGoal() {
  try { await store.set('lift-tracker-bw-goal', bwGoal == null ? '' : String(bwGoal)); } catch (e) {}
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
