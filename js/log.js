/* ============================================================
   SECTION: MUSCLE MAP
   ============================================================ */
function getMapMuscles() {
  const p = new Set(), s = new Set();
  const splitView = (mapMode === 'split' && filterSplit !== 'All');
  if (splitView) {
    (getSplits()[filterSplit].exercises || []).forEach(ex => {
      const lib = libGet(ex);
      if (!lib) return;
      expandMuscles(lib.p).forEach(id => p.add(id));
      expandMuscles(lib.s).forEach(id => s.add(id));
    });
  } else {
    const lib = libGet(selectedExercise);
    if (lib) {
      expandMuscles(lib.p).forEach(id => p.add(id));
      expandMuscles(lib.s).forEach(id => s.add(id));
    }
  }
  s.forEach(id => { if (p.has(id)) s.delete(id); });
  return { p, s, splitView };
}

function renderMuscleMap() {
  const { p, s, splitView } = getMapMuscles();
  const title = splitView
    ? 'MUSCLES — ' + filterSplit.toUpperCase() + ' SESSION'
    : 'MUSCLES — ' + (selectedExercise ? selectedExercise.toUpperCase() : 'EXERCISE');
  const modeBtns =
    '<button class="map-mode-btn' + (splitView ? ' active' : '') + '" onclick="setMapMode(\'split\')">SPLIT</button>' +
    '<button class="map-mode-btn' + (!splitView ? ' active' : '') + '" onclick="setMapMode(\'exercise\')">EXERCISE</button>';
  const noData = (p.size === 0 && s.size === 0);
  const body = '<div class="map-body">' +
    '<div class="muscle-readout" style="margin-top:0">' +
      (p.size ? '<div class="readout-row"><span class="readout-label" style="color:var(--accent)">PRIMARY</span>' +
        muscleNames([...p]).map(n => '<span class="chip p">' + esc(n) + '</span>').join('') + '</div>' : '') +
      (s.size ? '<div class="readout-row"><span class="readout-label" style="color:var(--amber)">SECONDARY</span>' +
        muscleNames([...s]).map(n => '<span class="chip s">' + esc(n) + '</span>').join('') + '</div>' : '') +
      (noData ? '<div class="map-hint" style="margin-top:0">No muscle data for this exercise — recreate it via EDIT SPLITS to tag muscles.</div>' : '') +
      (mapMode === 'split' && filterSplit === 'All' ? '<div class="map-hint">Pick a split filter above to see the full session view.</div>' : '') +
    '</div>' +
  '</div>';
  return '<div class="map-card">' +
    '<div class="map-head"><span class="map-title">' + esc(title) + '</span>' + modeBtns + '</div>' +
    body + '</div>';
}

function setMapMode(m) { mapMode = m; captureFormVals(); render(); }

/* ============================================================
   SECTION: LOG TAB
   ============================================================ */
function getLastEntry(exercise) {
  const exEntries = entries.filter(e => e.exercise === exercise).sort((a, b) => a.date.localeCompare(b.date));
  return exEntries.length ? exEntries[exEntries.length - 1] : null;
}

function getLastLogged(exercise) {
  const last = getLastEntry(exercise);
  if (!last) return '<div class="last-logged"><div class="last-logged-label">LAST LOGGED</div><div style="font-size:11px;color:rgba(255,255,255,0.2)">No previous entries</div></div>';
  const color = getSplitColor(exercise);
  return '<div class="last-logged" style="border-color:' + color + '20">' +
    '<div class="last-logged-label">LAST LOGGED — ' + formatDateFull(last.date) +
      (last.strain ? ' &nbsp;<span class="strain-tag">STRAIN</span>' : '') + '</div>' +
    '<div class="last-logged-weight" style="color:' + color + '">' + last.weight + ' lb · avg e1RM: ' + last.e1rm + '</div>' +
    '<div class="last-logged-sets">' + esc(setsDisplay(last)) + '</div>' +
    (last.note ? '<div class="history-note">' + esc(last.note) + '</div>' : '') +
  '</div>';
}

/* capture current form inputs so re-renders (map toggles, set-count changes) don't wipe typing */
function captureFormVals() {
  if (currentTab !== 'log') return;
  const w = document.getElementById('weightInput');
  if (w) formVals.weight = w.value;
  for (let i = 1; i <= 5; i++) {
    const el = document.getElementById('reps-' + i);
    if (el) formVals.reps[i] = el.value;
  }
  const n = document.getElementById('noteInput');
  if (n) formVals.note = n.value;
}

function applyPrefill() {
  /* on exercise change: prefill from last session of that exercise */
  if (prefillFor === selectedExercise) return;
  prefillFor = selectedExercise;
  formVals = { weight: '', reps: {}, strain: false, note: '' };
  const last = getLastEntry(selectedExercise);
  if (last && last.setData) {
    numSets = Math.min(5, Math.max(1, last.setData.length));
    if (!isBWExercise(selectedExercise)) formVals.weight = String(last.weight);
    last.setData.forEach((s, i) => { formVals.reps[i + 1] = String(s.reps); });
  }
}

function renderLog(c) {
  applyPrefill();
  const isBW = isBWExercise(selectedExercise);
  const today = new Date().toISOString().split('T')[0];
  const splits = getSplits();

  let splitBtns = '<button class="split-btn' + (filterSplit === 'All' ? ' active' : '') +
    '" onclick="setFilter(\'All\')" style="' + (filterSplit === 'All' ?
    'border-color:rgba(255,255,255,0.4);background:rgba(255,255,255,0.08);color:#fff' : '') +
    '">ALL</button>';
  Object.entries(splits).forEach(([name, data]) => {
    const a = filterSplit === name;
    splitBtns += '<button class="split-btn' + (a ? ' active' : '') +
      '" onclick="setFilter(\'' + name + '\')" style="' +
      (a ? 'border-color:' + data.color + ';background:' + data.color + '15;color:' + data.color : '') +
      '">' + name.toUpperCase() + '</button>';
  });
  splitBtns += '<button class="gear-btn" onclick="openManage()">⚙ EDIT SPLITS</button>';

  let options = getFilteredExercises().map(ex =>
    '<option value="' + esc(ex) + '"' + (ex === selectedExercise ? ' selected' : '') + '>' + esc(ex) + '</option>'
  ).join('');

  let setsBtns = '';
  for (let i = 1; i <= 5; i++) {
    setsBtns += '<button class="num-sets-btn' + (numSets === i ? ' active' : '') +
      '" onclick="setNumSets(' + i + ')">' + i + '</button>';
  }

  let setInputs = '';
  for (let i = 1; i <= numSets; i++) {
    const v = formVals.reps[i] || '';
    setInputs += '<div class="set-row">' +
      '<span class="set-label">SET ' + i + '</span>' +
      '<input class="set-input" type="number" id="reps-' + i + '" placeholder="10" value="' + esc(v) + '" oninput="updatePreview()">' +
      '<span class="set-e1rm" id="e1rm-' + i + '"></span></div>';
  }

  c.innerHTML =
    '<div style="margin-bottom:20px">' +
      '<label class="label">EXERCISE</label>' +
      '<div class="split-filters">' + splitBtns + '</div>' +
      '<select class="select" onchange="setExercise(this.value)">' + options + '</select>' +
    '</div>' +
    renderMuscleMap() +
    getLastLogged(selectedExercise) +
    '<div style="margin-bottom:20px">' +
      '<label class="label">BODYWEIGHT (lb)</label>' +
      '<input class="input" type="number" value="' + (bodyweight || '') + '" id="bwInput" placeholder="enter bodyweight"' +
        ' onchange="bwChanged(this)" style="font-size:13px;padding:10px 12px">' +
      (isBW ? '<div class="bw-note">↑ This exercise will use bodyweight for e1RM</div>' : '') +
    '</div>' +
    '<div style="margin-bottom:20px">' +
      '<label class="label">WEIGHT (lb)</label>' +
      '<input class="input" type="number" id="weightInput" placeholder="' + (isBW ? (bodyweight || 'set bodyweight above') : '60') + '"' +
        (isBW ? ' value="' + (bodyweight || '') + '" readonly style="opacity:0.5"' : ' value="' + esc(formVals.weight) + '"') +
        ' oninput="updatePreview()">' +
    '</div>' +
    '<div style="margin-bottom:6px"><label class="label">SETS</label><div class="num-sets-row">' + setsBtns + '</div></div>' +
    '<div class="sets-container"><label class="label">REPS PER SET</label>' + setInputs + '</div>' +
    '<div class="strain-row">' +
      '<button class="strain-btn' + (formVals.strain ? ' on' : '') + '" onclick="toggleStrain()">' +
        (formVals.strain ? '⚠ STRAIN FELT' : 'FELT STRAIN?') + '</button>' +
      '<input class="input note-input" type="text" id="noteInput" placeholder="note (optional)" maxlength="200"' +
        ' value="' + esc(formVals.note) + '" oninput="formVals.note=this.value">' +
    '</div>' +
    '<div style="margin-bottom:20px">' +
      '<label class="label">DATE</label>' +
      '<input class="input" type="date" id="dateInput" value="' + today + '">' +
    '</div>' +
    '<div class="preview-box" id="previewBox" style="display:none">' +
      '<div class="preview-label">PREVIEW — AVG ACROSS SETS</div>' +
      '<div class="preview-row">' +
        '<div><div class="preview-metric-label">AVG e1RM</div>' +
          '<div class="preview-value" style="color:var(--accent)" id="previewE1rm">—</div></div>' +
        '<div style="text-align:right"><div class="preview-metric-label">TOTAL VOLUME</div>' +
          '<div class="preview-value" style="color:rgba(255,255,255,0.6)" id="previewVol">—</div></div>' +
      '</div>' +
    '</div>' +
    '<button class="log-btn" id="logBtn" onclick="addEntry()" disabled>LOG EXERCISE</button>';
  updatePreview();
}

function getFilteredExercises() {
  const splits = getSplits();
  if (filterSplit === 'All') return getAllExercises();
  /* specific split keeps the user's stored order (superset pairing) */
  return splits[filterSplit].exercises.slice();
}

function setFilter(f) {
  captureFormVals();
  filterSplit = f;
  if (f !== 'All') mapMode = 'split';
  const filtered = getFilteredExercises();
  if (!filtered.includes(selectedExercise) && filtered.length > 0) selectedExercise = filtered[0];
  chartExercise = selectedExercise;
  render();
}

function setExercise(ex) {
  selectedExercise = ex;
  chartExercise = ex;
  mapMode = 'exercise';
  render();
}

function setNumSets(n) { captureFormVals(); numSets = n; render(); }

function toggleStrain() { captureFormVals(); formVals.strain = !formVals.strain; render(); }

function updatePreview() {
  const w = parseFloat(document.getElementById('weightInput')?.value);
  const box = document.getElementById('previewBox');
  const btn = document.getElementById('logBtn');
  if (!box || !btn) return;
  let allFilled = !!w, totalVol = 0, e1rmSum = 0, setCount = 0;
  for (let i = 1; i <= numSets; i++) {
    const el = document.getElementById('reps-' + i);
    const e1rmEl = document.getElementById('e1rm-' + i);
    if (!el) continue;
    const r = parseInt(el.value);
    if (!r) { allFilled = false; if (e1rmEl) e1rmEl.textContent = ''; continue; }
    const e = calcE1RM(w || 0, r);
    if (e1rmEl) e1rmEl.textContent = 'e1RM: ' + e;
    e1rmSum += e; setCount++;
    totalVol += (w || 0) * r;
  }
  if (allFilled && w && setCount > 0) {
    const avgE1rm = Math.round(e1rmSum / setCount * 10) / 10;
    box.style.display = 'block';
    document.getElementById('previewE1rm').textContent = avgE1rm + ' lb';
    document.getElementById('previewVol').textContent = totalVol.toLocaleString() + ' lb';
    btn.disabled = false;
  } else { box.style.display = 'none'; btn.disabled = true; }
}

async function addEntry() {
  const w = parseFloat(document.getElementById('weightInput').value);
  const d = document.getElementById('dateInput').value;
  if (!w || !d) return;
  const setData = [];
  for (let i = 1; i <= numSets; i++) {
    const r = parseInt(document.getElementById('reps-' + i).value);
    if (!r) return;
    setData.push({ reps: r });
  }
  const note = (document.getElementById('noteInput')?.value || '').trim();
  const entry = { id: Date.now(), exercise: selectedExercise, weight: w, setData, date: d, strain: formVals.strain, note, phase, mod: Date.now() };
  entry.e1rm = getAvgE1RM(entry);
  entry.volume = getTotalVolume(entry);
  /* PR detection — against best avg e1RM before this entry */
  const prev = entries.filter(e => e.exercise === selectedExercise);
  const prevMax = prev.length ? Math.max(...prev.map(e => e.e1rm)) : null;
  entries.push(entry);
  entries.sort((a, b) => a.date.localeCompare(b.date));
  await saveData(); updateHeader();
  if (prevMax !== null && entry.e1rm > prevMax) {
    showToast(phase === 'cut'
      ? 'PR ON A CUT — ' + selectedExercise + ' · avg e1RM ' + entry.e1rm
      : 'NEW PR — ' + selectedExercise + ' · avg e1RM ' + entry.e1rm, { duration: 3200 });
  } else if (phase === 'cut') {
    const baseline = prePhaseBaseline(selectedExercise);
    if (baseline && entry.e1rm < baseline * 0.9) {
      const pct = Math.round((1 - entry.e1rm / baseline) * 1000) / 10;
      showToast('Logged — down ' + pct + '% from pre-cut best (' + baseline + ')', { color: 'var(--amber)', duration: 3600 });
    } else {
      showToast('Logged ' + selectedExercise + (baseline ? ' — holding' : ''));
    }
  } else {
    showToast('Logged ' + selectedExercise);
  }
  prefillFor = null; /* re-prefill from the entry just logged */
  render();
}
