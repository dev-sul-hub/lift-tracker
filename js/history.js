/* ============================================================
   SECTION: HISTORY TAB (grouped by day, filters, undo delete)
   ============================================================ */
function renderHistory(c) {
  if (entries.length === 0) { c.innerHTML = '<div class="empty">No entries yet. Start logging!</div>'; return; }
  const splits = getSplits();
  /* filters */
  let fBtns = '<button class="split-btn' + (historyFilterSplit === 'All' ? ' active' : '') +
    '" onclick="setHistFilter(\'All\')" style="' + (historyFilterSplit === 'All' ?
    'border-color:rgba(255,255,255,0.4);background:rgba(255,255,255,0.08);color:#fff' : '') + '">ALL</button>';
  Object.entries(splits).forEach(([name, data]) => {
    const a = historyFilterSplit === name;
    fBtns += '<button class="split-btn' + (a ? ' active' : '') +
      '" onclick="setHistFilter(\'' + name + '\')" style="' +
      (a ? 'border-color:' + data.color + ';background:' + data.color + '15;color:' + data.color : '') +
      '">' + name.toUpperCase() + '</button>';
  });
  {
    const a = historyFilterSplit === 'Cardio';
    fBtns += '<button class="split-btn' + (a ? ' active' : '') +
      '" onclick="setHistFilter(\'Cardio\')" style="' +
      (a ? 'border-color:' + CARDIO_COLOR + ';background:' + CARDIO_COLOR + '15;color:' + CARDIO_COLOR : '') +
      '">CARDIO</button>';
  }
  const loggedExs = [...new Set(entries.map(e => e.exercise))].sort((a, b) => a.localeCompare(b));
  let exOpts = '<option value="All">ALL EXERCISES</option>' + loggedExs.map(ex =>
    '<option value="' + esc(ex) + '"' + (historyFilterExercise === ex ? ' selected' : '') + '>' + esc(ex) + '</option>').join('');

  /* filter entries */
  let list = entries.slice();
  if (historyFilterSplit === 'Cardio') {
    list = list.filter(e => e.cardio);
  } else if (historyFilterSplit !== 'All') {
    const inSplit = new Set(splits[historyFilterSplit].exercises);
    list = list.filter(e => inSplit.has(e.exercise));
  }
  if (historyFilterExercise !== 'All') list = list.filter(e => e.exercise === historyFilterExercise);

  /* group by date desc */
  const groups = {};
  list.forEach(e => { (groups[e.date] = groups[e.date] || []).push(e); });
  /* unfiltered view also shows days that only have a weigh-in */
  const unfiltered = (historyFilterSplit === 'All' && historyFilterExercise === 'All');
  if (unfiltered) bwLog.forEach(r => { groups[r.date] = groups[r.date] || []; });
  const dates = Object.keys(groups).sort((a, b) => b.localeCompare(a));

  let html = '<div class="hist-filters"><div class="split-filters">' + fBtns + '</div>' +
    '<select class="select" style="margin-bottom:8px" onchange="historyFilterExercise=this.value;render()">' + exOpts + '</select></div>';

  if (!dates.length) html += '<div class="empty">No entries match these filters.</div>';

  dates.forEach(date => {
    const dayEntries = groups[date];
    const daySplits = [...new Set(dayEntries.filter(e => !e.cardio).map(e => exToSplit(e.exercise)).filter(Boolean))];
    if (dayEntries.some(e => e.cardio)) daySplits.push('Cardio');
    const totalSets = dayEntries.reduce((s, e) => s + (e.setData ? e.setData.length : 0), 0);
    const cardioMin = Math.round(dayEntries.reduce((s, e) => s + (e.cardio ? (e.minutes || 0) : 0), 0));
    const meta = dayEntries.length
      ? (daySplits.length ? daySplits.join(' / ').toUpperCase() + ' · ' : '') +
        dayEntries.length + ' EXERCISES · ' + totalSets + ' SETS' +
        (cardioMin ? ' · ' + cardioMin + ' MIN CARDIO' : '')
      : 'WEIGH-IN ONLY';
    html += '<div class="day-head"><span class="day-date">' + formatDateFull(date) + '</span>' +
      '<span class="day-meta">' + meta + ' · ' + bwDayTag(date) + '</span></div>';
    if (editingBwDate === date) html += renderDayBodyweight(date);
    dayEntries.forEach(entry => { html += renderHistoryEntry(entry); });
  });
  c.innerHTML = html;
}

function setHistFilter(f) { historyFilterSplit = f; historyFilterExercise = 'All'; render(); }

/* compact weigh-in readout for the day header: value opens an editor,
   absence offers to add one — one line instead of a row per day */
function bwDayTag(date) {
  const rec = bwLog.find(r => r.date === date);
  if (rec) {
    return '<a href="javascript:void(0)" onclick="editingBwDate=\'' + date + '\';render()"' +
      ' style="color:' + BW_COLOR + ';text-decoration:none;font-weight:600">' + rec.w + ' LB</a>';
  }
  return '<a href="javascript:void(0)" onclick="editingBwDate=\'' + date + '\';render()"' +
    ' style="color:rgba(255,255,255,0.22);text-decoration:none">+ WEIGH-IN</a>';
}

/* ---- inline editor, shown only for the day being edited ---- */
function renderDayBodyweight(date) {
  const rec = bwLog.find(r => r.date === date);
  if (editingBwDate === date) {
    return '<div class="history-entry" style="border-color:' + BW_COLOR + '35">' +
      '<div style="flex:1">' +
        '<div class="history-name" style="color:' + BW_COLOR + '">BODYWEIGHT' +
          '<span class="history-tag" style="background:' + BW_COLOR + '20;color:' + BW_COLOR + '">WEIGH-IN</span></div>' +
        '<div style="margin-top:8px;display:flex;gap:8px;align-items:center">' +
          '<input class="edit-input" id="hist-bw-' + date + '" type="number" step="0.1" style="width:96px"' +
            ' value="' + (rec ? rec.w : '') + '" placeholder="lb">' +
          '<button class="save-btn" style="padding:6px 12px;font-size:10px" onclick="histBwSave(\'' + date + '\')">SAVE</button>' +
          '<button class="cancel-btn" style="padding:6px 12px;font-size:10px" onclick="editingBwDate=null;render()">CANCEL</button>' +
          (rec ? '<button class="del-btn" onclick="histBwDelete(\'' + date + '\')">×</button>' : '') +
        '</div></div></div>';
  }
  return '';
}

async function histBwSave(date) {
  const w = parseFloat(document.getElementById('hist-bw-' + date)?.value);
  if (!(w > 0)) { showToast('Enter a weight', { color: 'var(--red)' }); return; }
  const n = await setBodyweightOn(date, w);
  editingBwDate = null;
  showToast(w + ' lb on ' + formatDateFull(date) +
    (n ? ' — ' + n + ' bodyweight ' + (n === 1 ? 'entry' : 'entries') + ' recalculated' : ''),
    { duration: n ? 3200 : 2200 });
  updateHeader(); render();
}

async function histBwDelete(date) {
  const n = await deleteBodyweightOn(date);
  editingBwDate = null;
  showToast('Removed weigh-in for ' + formatDateFull(date) + (n ? ' — ' + n + ' recalculated' : ''),
    { color: 'var(--amber)', duration: n ? 3200 : 2200 });
  updateHeader(); render();
}

/* PHASE select for the edit forms — AUTO derives from phase history,
   anything else pins the tag so restamping leaves it alone */
function phaseSelectHTML(entry) {
  const auto = !entry.phaseLocked;
  const derived = phaseForDate(entry.date);
  const autoLabel = 'AUTO' + (derived && PHASE_META[derived] ? ' — ' + PHASE_META[derived].label : ' — untagged');
  return '<select class="edit-input" id="edit-phase" style="width:220px;font-size:11px">' +
    '<option value="__auto__"' + (auto ? ' selected' : '') + '>' + autoLabel + '</option>' +
    Object.entries(PHASE_META).map(([k, m]) =>
      '<option value="' + k + '"' + (!auto && entry.phase === k ? ' selected' : '') + '>' + m.label + ' (pinned)</option>').join('') +
    '</select>';
}

/* apply the PHASE select back onto an entry */
function applyPhaseSelect(entry) {
  const v = document.getElementById('edit-phase')?.value;
  if (!v || v === '__auto__') {
    delete entry.phaseLocked;
    entry.phase = phaseForDate(entry.date);
  } else if (PHASE_META[v]) {
    entry.phase = v;
    entry.phaseLocked = true;
  }
}

function renderHistoryEntry(entry) {
  const color = getSplitColor(entry.exercise);
  const split = getSplitName(entry.exercise);
  if (editingId === entry.id && entry.cardio) {
    return '<div class="edit-form">' +
      '<div class="edit-form-name">' + esc(entry.exercise) +
        '<span class="history-tag" style="background:' + CARDIO_COLOR + '20;color:' + CARDIO_COLOR + '">CARDIO</span></div>' +
      '<div class="edit-row">' +
        '<div><div class="edit-label">INCLINE %</div><input class="edit-input" type="number" step="0.5" id="edit-c-incline" value="' + entry.incline + '" style="width:90px"></div>' +
        '<div><div class="edit-label">MINUTES</div><input class="edit-input" type="number" step="1" id="edit-c-minutes" value="' + entry.minutes + '" style="width:90px"></div>' +
        '<div><div class="edit-label">MPH</div><input class="edit-input" type="number" step="0.1" id="edit-c-mph" value="' + entry.mph + '" style="width:90px"></div>' +
      '</div>' +
      '<div style="margin:12px 0"><div class="edit-label">DATE</div>' +
        '<input class="edit-input" type="date" id="edit-date" value="' + entry.date + '" style="width:180px;font-size:11px"></div>' +
      '<div style="margin-bottom:12px"><div class="edit-label">NOTE</div>' +
        '<input class="edit-input" type="text" id="edit-note" maxlength="200" value="' + esc(entry.note || '') + '"></div>' +
      '<div style="margin-bottom:12px"><div class="edit-label">PHASE</div>' +
        phaseSelectHTML(entry) + '</div>' +
      '<div class="edit-actions">' +
        '<button class="save-btn" onclick="saveEdit(' + entry.id + ')">SAVE</button>' +
        '<button class="cancel-btn" onclick="cancelEdit()">CANCEL</button></div></div>';
  }
  if (editingId === entry.id) {
    const sd = entry.setData || [{ reps: 0 }];
    let editSets = '';
    sd.forEach((s, i) => {
      editSets += '<div class="edit-row"><span style="font-size:10px;color:var(--dim);min-width:40px">SET ' + (i + 1) + '</span>' +
        '<input class="edit-input" type="number" id="edit-reps-' + i + '" value="' + s.reps + '" style="width:80px"></div>';
    });
    return '<div class="edit-form">' +
      '<div class="edit-form-name">' + esc(entry.exercise) +
        (split ? '<span class="history-tag" style="background:' + color + '20;color:' + color + '">' + esc(split.toUpperCase()) + '</span>' : '') + '</div>' +
      '<div style="margin-bottom:12px"><div class="edit-label">WEIGHT</div>' +
        '<input class="edit-input" type="number" id="edit-weight" value="' + entry.weight + '" style="width:120px"></div>' +
      '<div style="margin-bottom:12px">' + editSets + '</div>' +
      '<div style="margin-bottom:12px"><div class="edit-label">DATE</div>' +
        '<input class="edit-input" type="date" id="edit-date" value="' + entry.date + '" style="width:180px;font-size:11px"></div>' +
        '<div><div class="edit-label">RIR — LAST SET</div>' +
          '<select class="edit-input" id="edit-rir" style="width:120px;font-size:11px">' +
            '<option value=""' + (entry.rir == null ? ' selected' : '') + '>— none</option>' +
            RIR_CHOICES.map(function (v) {
              return '<option value="' + v + '"' + (entry.rir === v ? ' selected' : '') + '>' + v + (v === 5 ? '+' : '') + '</option>';
            }).join('') +
          '</select></div>' +
      '<div style="margin-bottom:12px"><div class="edit-label">NOTE</div>' +
        '<input class="edit-input" type="text" id="edit-note" maxlength="200" value="' + esc(entry.note || '') + '"></div>' +
      '<div style="margin-bottom:12px"><div class="edit-label">PHASE</div>' +
        phaseSelectHTML(entry) + '</div>' +
      '<div class="edit-actions">' +
        '<button class="save-btn" onclick="saveEdit(' + entry.id + ')">SAVE</button>' +
        '<button class="cancel-btn" onclick="cancelEdit()">CANCEL</button></div></div>';
  }
  return '<div class="history-entry"><div style="flex:1">' +
    '<div class="history-name">' + esc(entry.exercise) +
      (split ? '<span class="history-tag" style="background:' + color + '20;color:' + color + '">' + esc(split.toUpperCase()) + '</span>' : '') +

      (entry.phase && PHASE_META[entry.phase] ? '<span class="history-tag" style="background:' + PHASE_META[entry.phase].color + '15;color:' + PHASE_META[entry.phase].color + '">' + PHASE_META[entry.phase].label + '</span>' : '') + '</div>' +
    (entry.cardio
      ? '<div class="history-detail">' + esc(cardioDetail(entry)) + '</div>' +
        '<div class="history-sets">' + (entry.vert || 0) + ' vert ft · ' + cardioMiles(entry) + ' mi</div>'
      : '<div class="history-detail">' + entry.weight + 'lb · avg e1RM: ' + entry.e1rm +
        (entry.rir != null ? ' <span style="color:' + RIR_COLOR + '">· RIR ' + entry.rir + '</span>' : '') +
        (isCapped(entry) ? ' <span style="color:rgba(255,255,255,0.3);font-size:9px">(capped)</span>' : '') + '</div>' +
        '<div class="history-sets">' + esc(setsDisplay(entry)) + '</div>') +
    (entry.note ? '<div class="history-note">' + esc(entry.note) + '</div>' : '') + '</div>' +
    '<div class="entry-actions">' +
      '<button class="edit-btn" onclick="startEdit(' + entry.id + ')">edit</button>' +
      '<button class="del-btn" onclick="deleteEntry(' + entry.id + ')">×</button></div></div>';
}

function startEdit(id) { editingId = id; render(); }
function cancelEdit() { editingId = null; render(); }

async function saveEdit(id) {
  const idx = entries.findIndex(e => e.id === id);
  if (idx === -1) return;
  const entry = entries[idx];
  if (entry.cardio) {
    const inc = parseFloat(document.getElementById('edit-c-incline')?.value);
    const min = parseFloat(document.getElementById('edit-c-minutes')?.value);
    const mph = parseFloat(document.getElementById('edit-c-mph')?.value);
    const d2 = document.getElementById('edit-date')?.value;
    if (isNaN(inc) || inc < 0 || !(min > 0) || !(mph > 0) || !d2) return;
    entry.incline = inc; entry.minutes = min; entry.mph = mph; entry.date = d2;
    entry.vert = calcVert(inc, min, mph);
    entry.note = (document.getElementById('edit-note')?.value || '').trim();
    applyPhaseSelect(entry);
    entry.mod = Date.now();
    entries.sort((a, b) => a.date.localeCompare(b.date));
    editingId = null;
    await saveData(); updateHeader();
    showToast('Entry updated'); render();
    return;
  }
  const w = parseFloat(document.getElementById('edit-weight').value);
  const d = document.getElementById('edit-date').value;
  if (!w || !d) return;
  const sd = entry.setData || [{ reps: 0 }];
  const newSetData = [];
  for (let i = 0; i < sd.length; i++) {
    const r = parseInt(document.getElementById('edit-reps-' + i)?.value);
    if (!r) return;
    newSetData.push({ reps: r });
  }
  entry.weight = w; entry.date = d; entry.setData = newSetData;
  entry.note = (document.getElementById('edit-note')?.value || '').trim();
  const rv = document.getElementById('edit-rir')?.value;
  if (rv === '' || rv == null) delete entry.rir; else entry.rir = parseInt(rv);
  applyPhaseSelect(entry);
  entry.e1rm = getAvgE1RM(entry); entry.volume = getTotalVolume(entry);
  entry.mod = Date.now();
  entries.sort((a, b) => a.date.localeCompare(b.date));
  editingId = null;
  await saveData(); updateHeader();
  showToast('Entry updated'); render();
}

/* delete with 5s undo window */
async function deleteEntry(id) {
  await finalizePendingDelete();
  const idx = entries.findIndex(e => e.id === id);
  if (idx === -1) return;
  const entry = entries[idx];
  entries.splice(idx, 1);
  tombstones.push({ id: entry.id, mod: Date.now() });
  await saveTombstones();
  await saveData(); updateHeader(); render();
  pendingDelete = { entry, timer: setTimeout(() => { pendingDelete = null; }, 5200) };
  showToast('Deleted ' + entry.exercise, { undo: true, duration: 5000, color: 'var(--amber)' });
}

async function undoDelete() {
  if (!pendingDelete) return;
  clearTimeout(pendingDelete.timer);
  pendingDelete.entry.mod = Date.now();
  tombstones = tombstones.filter(t => t.id !== pendingDelete.entry.id);
  await saveTombstones();
  entries.push(pendingDelete.entry);
  entries.sort((a, b) => a.date.localeCompare(b.date));
  pendingDelete = null;
  await saveData(); updateHeader();
  document.getElementById('toast').classList.remove('show');
  showToast('Entry restored');
  render();
}

async function finalizePendingDelete() {
  if (pendingDelete) { clearTimeout(pendingDelete.timer); pendingDelete = null; }
}
