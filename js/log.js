/* ============================================================
   SECTION: MUSCLE MAP
   ============================================================ */
function getMapMuscles() {
  const p = new Set(), s = new Set();
  const splitView = (mapMode === 'split' && filterSplit !== 'All' && filterSplit !== 'Cardio');
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
/* prefer the current profile — Pull-up, Leg Extension and Arnold Press live in
   both splits at completely different loads. Legacy entries carry no profile,
   so they stay eligible as a fallback. */
function getLastEntry(exercise) {
  const all = entries.filter(e => e.exercise === exercise).sort((a, b) => a.date.localeCompare(b.date));
  if (!all.length) return null;
  const mine = all.filter(e => e.profile === currentProfile);
  if (mine.length) return mine[mine.length - 1];
  const untagged = all.filter(e => !e.profile);
  if (untagged.length) return untagged[untagged.length - 1];
  return all[all.length - 1];
}

function getLastLogged(exercise) {
  const last = getLastEntry(exercise);
  if (!last) return '<div class="last-logged"><div class="last-logged-label">LAST LOGGED</div><div style="font-size:11px;color:rgba(255,255,255,0.2)">No previous entries</div></div>';
  const color = getSplitColor(exercise);
  const headline = last.cardio
    ? last.vert + ' vert ft'
    : last.weight + ' lb · avg e1RM: ' + last.e1rm + (isCapped(last) ? '*' : '');
  const subline = last.cardio ? cardioDetail(last) + ' · ' + cardioMiles(last) + ' mi' : setsDisplay(last);
  return '<div class="last-logged" style="border-color:' + color + '20">' +
    '<div class="last-logged-label">LAST LOGGED — ' + formatDateFull(last.date) +
      '</div>' +
    '<div class="last-logged-weight" style="color:' + color + '">' + headline + '</div>' +
    '<div class="last-logged-sets">' + esc(subline) + '</div>' +
    (isCapped(last) ? '<div class="bw-note" style="color:rgba(255,255,255,0.3)">* over ' + E1RM_REP_CAP +
      ' reps — e1RM is pinned, track VOLUME instead</div>' : '') +
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
  ['incline', 'minutes', 'mph'].forEach(k => {
    const el = document.getElementById('c-' + k);
    if (el) formVals[k] = el.value;
  });
  const n = document.getElementById('noteInput');
  if (n) formVals.note = n.value;
}

/* RIR chips — tapping the active one clears it, so skipping is one tap
   and never blocks a log. "—" is the explicit no-answer. */
function rirBtns() {
  let html = '<button class="num-sets-btn' + (formVals.rir == null ? ' active' : '') +
    '" onclick="setFormRir(null)" title="not recorded">—</button>';
  RIR_CHOICES.forEach(v => {
    const on = formVals.rir === v;
    html += '<button class="num-sets-btn' + (on ? ' active' : '') + '" onclick="setFormRir(' + v + ')"' +
      (on ? ' style="border-color:' + RIR_COLOR + ';background:' + RIR_COLOR + '22;color:' + RIR_COLOR + '"' : '') +
      '>' + v + (v === 5 ? '+' : '') + '</button>';
  });
  return html;
}

function setFormRir(v) {
  captureFormVals();
  formVals.rir = (formVals.rir === v) ? null : v;
  render();
}

function applyPrefill() {
  /* on exercise change: prefill from last session of that exercise */
  if (prefillFor === selectedExercise) return;
  prefillFor = selectedExercise;
  formVals = { weight: '', reps: {}, strain: false, note: '', incline: '', minutes: '', mph: '', rir: null };  /* strain retained for schema only */
  const last = getLastEntry(selectedExercise);
  if (!last) return;
  if (last.cardio) {
    formVals.incline = String(last.incline);
    formVals.minutes = String(last.minutes);
    formVals.mph = String(last.mph);
  } else if (last.setData) {
    numSets = Math.min(5, Math.max(1, last.setData.length));
    if (!isBWExercise(selectedExercise)) formVals.weight = String(last.weight);
    last.setData.forEach((s, i) => { formVals.reps[i + 1] = String(s.reps); });
    /* weight and reps prefill because they're a plan; RIR does not,
       because it's an observation — a carried-forward default would be
       accepted unthinkingly and the whole series would read 3. */
  }
}

function renderLog(c) {
  applyPrefill();
  const isBW = isBWExercise(selectedExercise);
  const cardio = isCardio(selectedExercise);
  const today = isoToday();
  const formDate = (logDateVal && logDateVal <= today) ? logDateVal : today;
  const bwForDate = bodyweightOn(formDate);
  const bwShown = bwForDate != null ? bwForDate : (bodyweight || '');
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
  {
    const a = filterSplit === 'Cardio';
    splitBtns += '<button class="split-btn' + (a ? ' active' : '') + '" onclick="setFilter(\'Cardio\')" style="' +
      (a ? 'border-color:' + CARDIO_COLOR + ';background:' + CARDIO_COLOR + '15;color:' + CARDIO_COLOR : '') +
      '">CARDIO</button>';
  }
  splitBtns += '<button class="gear-btn" onclick="openManage()">⚙ EDIT SPLITS</button>';

  const filtered = getFilteredExercises();
  let options = filtered.map(ex =>
    '<option value="' + esc(ex) + '"' + (ex === selectedExercise ? ' selected' : '') + '>' + esc(ex) + '</option>'
  ).join('');
  /* swapped into an alternate that isn't in any split — keep it selectable */
  if (selectedExercise && !filtered.includes(selectedExercise)) {
    options = '<optgroup label="— SWAPPED IN (NOT IN SPLITS) —">' +
      '<option value="' + esc(selectedExercise) + '" selected>' + esc(selectedExercise) + '</option>' +
      '</optgroup>' + options;
  }

  let setsBtns = '';
  for (let i = 1; i <= 5; i++) {
    setsBtns += '<button class="num-sets-btn' + (numSets === i ? ' active' : '') +
      '" onclick="setNumSets(' + i + ')">' + i + '</button>';
  }

  let setInputs = '';
  for (let i = 1; i <= numSets; i++) {
    /* (RIR chips are built by rirBtns(), below the sets row) */
    const v = formVals.reps[i] || '';
    setInputs += '<div class="set-row">' +
      '<span class="set-label">SET ' + i + '</span>' +
      '<input class="set-input" type="number" id="reps-' + i + '" placeholder="10" value="' + esc(v) + '" oninput="updatePreview()">' +
      '<span class="set-e1rm" id="e1rm-' + i + '"></span></div>';
  }

  c.innerHTML =
    renderVolStrip() +
    '<div style="margin-bottom:20px">' +
      '<label class="label">EXERCISE</label>' +
      '<div class="split-filters">' + splitBtns + '</div>' +
      '<div style="display:flex;gap:8px;align-items:stretch">' +
        '<select class="select" style="flex:1;margin:0" onchange="setExercise(this.value)">' + options + '</select>' +
        (cardio ? '' : '<button class="data-btn" style="margin:0;white-space:nowrap" onclick="toggleAltPanel()"' +
          ' title="swap for an available alternative">⇄ ALT</button>') +
      '</div>' +
      renderAltPanel() +
      (selectedExercise && !cardio && !getAllExercises().includes(selectedExercise)
        ? '<div class="map-hint" style="margin-top:6px;color:rgba(232,184,58,0.7)">' +
          'Swapped in — ' + esc(selectedExercise) + ' is not in your splits. Logs normally; add it via ⚙ EDIT SPLITS to keep it.</div>'
        : '') +
    '</div>' +
    renderMuscleMap() +
    getLastLogged(selectedExercise) +
    (cardio
      ? '<div style="margin-bottom:20px"><div style="display:flex;gap:10px">' +
          '<div style="flex:1"><label class="label">INCLINE %</label>' +
            '<input class="input" type="number" step="0.5" min="0" id="c-incline" placeholder="15" value="' + esc(formVals.incline) + '" oninput="updatePreview()"></div>' +
          '<div style="flex:1"><label class="label">MINUTES</label>' +
            '<input class="input" type="number" step="1" min="0" id="c-minutes" placeholder="5" value="' + esc(formVals.minutes) + '" oninput="updatePreview()"></div>' +
          '<div style="flex:1"><label class="label">SPEED (MPH)</label>' +
            '<input class="input" type="number" step="0.1" min="0" id="c-mph" placeholder="3.4" value="' + esc(formVals.mph) + '" oninput="updatePreview()"></div>' +
        '</div></div>'
      : '<div style="margin-bottom:20px">' +
          '<label class="label">BODYWEIGHT (lb) — ' + formatDateFull(formDate) + '</label>' +
          '<input class="input" type="number" step="0.1" value="' + bwShown + '" id="bwInput" placeholder="enter bodyweight"' +
            ' onchange="bwChanged(this)" style="font-size:13px;padding:10px 12px">' +
          (bwForDate == null && bodyweight
            ? '<div class="bw-note" style="color:rgba(232,184,58,0.7)">no weigh-in for this date — showing last known ' + bodyweight + ' lb</div>'
            : '') +
          (isBW ? '<div class="bw-note">↑ This exercise will use bodyweight for e1RM</div>' : '') +
        '</div>' +
        '<div style="margin-bottom:20px">' +
          '<label class="label">WEIGHT (lb)</label>' +
          '<input class="input" type="number" id="weightInput" placeholder="' + (isBW ? (bwShown || 'set bodyweight above') : '60') + '"' +
            (isBW ? ' value="' + bwShown + '" readonly style="opacity:0.5"' : ' value="' + esc(formVals.weight) + '"') +
            ' oninput="updatePreview()">' +
        '</div>' +
        '<div style="margin-bottom:6px"><label class="label">SETS</label><div class="num-sets-row">' + setsBtns + '</div></div>' +
        '<div style="margin-bottom:6px"><label class="label">RIR — LAST SET <span style="opacity:0.45">(optional)</span></label>' +
          '<div class="num-sets-row">' + rirBtns() + '</div></div>' +
        '<div class="sets-container"><label class="label">REPS PER SET</label>' + setInputs + '</div>') +
    '<div class="strain-row">' +
      '<input class="input note-input" type="text" id="noteInput" placeholder="note (optional)" maxlength="200"' +
        ' value="' + esc(formVals.note) + '" oninput="formVals.note=this.value" style="width:100%">' +
    '</div>' +
    '<div style="margin-bottom:20px">' +
      '<label class="label">DATE</label>' +
      '<input class="input" type="date" id="dateInput" value="' + formDate + '" max="' + today + '"' +
        ' onchange="logDateChanged(this)">' +
    '</div>' +
    '<div class="preview-box" id="previewBox" style="display:none">' +
      '<div class="preview-label" id="previewCaption">PREVIEW — AVG ACROSS SETS</div>' +
      '<div class="preview-row">' +
        '<div><div class="preview-metric-label" id="previewM1Label">AVG e1RM</div>' +
          '<div class="preview-value" style="color:' + (cardio ? CARDIO_COLOR : 'var(--accent)') + '" id="previewE1rm">—</div></div>' +
        '<div style="text-align:right"><div class="preview-metric-label" id="previewM2Label">TOTAL VOLUME</div>' +
          '<div class="preview-value" style="color:rgba(255,255,255,0.6)" id="previewVol">—</div></div>' +
      '</div>' +
    '</div>' +
    '<button class="log-btn" id="logBtn" onclick="addEntry()" disabled' + (cardio ? ' style="background:' + CARDIO_COLOR + '"' : '') + '>' +
    (cardio ? 'LOG CARDIO' : 'LOG EXERCISE') + '</button>';
  updatePreview();
}

/* ---- alternates panel: the machine is taken, swap in one tap ---- */
function toggleAltPanel() {
  captureFormVals();
  altFor = (altFor === selectedExercise) ? null : selectedExercise;
  render();
}

function renderAltPanel() {
  if (altFor !== selectedExercise || isCardio(selectedExercise)) return '';
  const list = getAlts(selectedExercise);
  const curated = isAltCurated(selectedExercise);
  const inProfile = new Set(getAllExercises());
  if (!list.length) {
    return '<div class="add-panel"><div class="map-hint" style="margin:0">' +
      'No alternates for ' + esc(selectedExercise) + ' yet — add some under ⚙ EDIT SPLITS.</div></div>';
  }
  return '<div class="add-panel">' +
    '<div class="edit-label">SWAP ' + esc(selectedExercise.toUpperCase()) + ' FOR' +
      (curated ? '' : ' <span style="color:var(--dim);letter-spacing:0">(auto-matched)</span>') + '</div>' +
    '<div class="lib-list">' + list.map(n => {
      const lib = libGet(n);
      const here = inProfile.has(n);
      return '<div class="lib-row" data-ex="' + esc(n) + '" onclick="swapToAlt(this)">' +
        '<span class="lib-name">' + esc(n) +
          (here ? '' : ' <span style="color:rgba(232,184,58,0.6);font-size:8px">NOT IN SPLITS</span>') + '</span>' +
        '<span class="lib-m">' + esc(lib ? muscleNames(expandMuscles(lib.p)).slice(0, 2).join(', ') : '') + '</span></div>';
    }).join('') + '</div>' +
    '<div class="map-hint">Logs under the exercise you actually do, so e1RM and volume stay correct.</div>' +
    '<button class="link-btn" style="color:var(--dim)" onclick="altFor=null;render()">cancel</button></div>';
}

function swapToAlt(el) {
  const ex = el.dataset.ex;
  altFor = null;
  /* keep the split filter as-is — the picker now carries off-split selections */
  setExercise(ex);
  showToast('Swapped to ' + ex);
}

function getFilteredExercises() {
  if (filterSplit === 'Cardio') return getCardioExercises();
  if (filterSplit === 'All')
    return [...new Set([...getAllExercises(), ...getCardioExercises()])].sort((a, b) => a.localeCompare(b));
  /* specific split keeps the user's stored order (superset pairing) */
  return getSplits()[filterSplit].exercises.slice();
}

function setFilter(f) {
  captureFormVals();
  const changed = f !== filterSplit;
  filterSplit = f;
  mapMode = (f !== 'All' && f !== 'Cardio') ? 'split' : 'exercise';
  const filtered = getFilteredExercises();
  /* only reassign when the filter actually changed, so re-tapping the active
     filter doesn't throw away a swapped-in alternate */
  if (changed && !filtered.includes(selectedExercise) && filtered.length > 0) selectedExercise = filtered[0];
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

function updatePreview() {
  const box = document.getElementById('previewBox');
  const btn = document.getElementById('logBtn');
  if (!box || !btn) return;
  if (isCardio(selectedExercise)) {
    const inc = parseFloat(document.getElementById('c-incline')?.value);
    const min = parseFloat(document.getElementById('c-minutes')?.value);
    const mph = parseFloat(document.getElementById('c-mph')?.value);
    const ok = !isNaN(inc) && inc >= 0 && min > 0 && mph > 0;
    if (ok) {
      const vert = calcVert(inc, min, mph);
      const mi = Math.round(mph * (min / 60) * 100) / 100;
      box.style.display = 'block';
      document.getElementById('previewCaption').textContent = 'PREVIEW';
      document.getElementById('previewM1Label').textContent = 'VERTICAL FEET';
      document.getElementById('previewM2Label').textContent = 'DISTANCE';
      document.getElementById('previewE1rm').textContent = vert + ' ft';
      document.getElementById('previewVol').textContent = mi + ' mi';
      btn.disabled = false;
    } else { box.style.display = 'none'; btn.disabled = true; }
    return;
  }
  const w = parseFloat(document.getElementById('weightInput')?.value);
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
  const d = document.getElementById('dateInput').value;
  if (!d) return;
  if (isCardio(selectedExercise)) {
    const inc = parseFloat(document.getElementById('c-incline')?.value);
    const min = parseFloat(document.getElementById('c-minutes')?.value);
    const mph = parseFloat(document.getElementById('c-mph')?.value);
    if (isNaN(inc) || inc < 0 || !(min > 0) || !(mph > 0)) return;
    const note = (document.getElementById('noteInput')?.value || '').trim();
    const entry = {
      id: Date.now(), exercise: selectedExercise, cardio: true,
      incline: inc, minutes: min, mph: mph,
      date: d, strain: false, note, phase: phaseForDate(d),
      profile: currentProfile, mod: Date.now()
    };
    entry.vert = calcVert(inc, min, mph);
    const prev = entries.filter(e => e.exercise === selectedExercise && e.cardio);
    const prevMaxVert = prev.length ? Math.max(...prev.map(e => e.vert || 0)) : null;
    entries.push(entry);
    entries.sort((a, b) => a.date.localeCompare(b.date));
    await saveData(); updateHeader();
    if (prevMaxVert !== null && entry.vert > prevMaxVert) {
      showToast('CARDIO PR — ' + selectedExercise + ' · ' + entry.vert + ' vert ft', { color: CARDIO_COLOR, duration: 3200 });
    } else {
      showToast('Logged ' + selectedExercise + ' · ' + entry.vert + ' vert ft');
    }
    prefillFor = null;
    render();
    return;
  }
  let w = parseFloat(document.getElementById('weightInput').value);
  if (isBWExercise(selectedExercise)) {
    const bwOnDate = bodyweightOn(d);
    if (bwOnDate > 0) w = bwOnDate;
  }
  if (!w) return;
  const setData = [];
  for (let i = 1; i <= numSets; i++) {
    const r = parseInt(document.getElementById('reps-' + i).value);
    if (!r) return;
    setData.push({ reps: r });
  }
  const note = (document.getElementById('noteInput')?.value || '').trim();
  const entry = { id: Date.now(), exercise: selectedExercise, weight: w, setData, date: d,
    strain: false, note, phase: phaseForDate(d), profile: currentProfile, mod: Date.now() };
  if (formVals.rir != null) entry.rir = formVals.rir;
  entry.e1rm = getAvgE1RM(entry);          /* raw — RIR is context, never folded in */
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
