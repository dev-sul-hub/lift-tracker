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
  const loggedExs = [...new Set(entries.map(e => e.exercise))].sort((a, b) => a.localeCompare(b));
  let exOpts = '<option value="All">ALL EXERCISES</option>' + loggedExs.map(ex =>
    '<option value="' + esc(ex) + '"' + (historyFilterExercise === ex ? ' selected' : '') + '>' + esc(ex) + '</option>').join('');

  /* filter entries */
  let list = entries.slice();
  if (historyFilterSplit !== 'All') {
    const inSplit = new Set(splits[historyFilterSplit].exercises);
    list = list.filter(e => inSplit.has(e.exercise));
  }
  if (historyFilterExercise !== 'All') list = list.filter(e => e.exercise === historyFilterExercise);

  /* group by date desc */
  const groups = {};
  list.forEach(e => { (groups[e.date] = groups[e.date] || []).push(e); });
  const dates = Object.keys(groups).sort((a, b) => b.localeCompare(a));

  let html = '<div class="hist-filters"><div class="split-filters">' + fBtns + '</div>' +
    '<select class="select" style="margin-bottom:8px" onchange="historyFilterExercise=this.value;render()">' + exOpts + '</select></div>';

  if (!dates.length) html += '<div class="empty">No entries match these filters.</div>';

  dates.forEach(date => {
    const dayEntries = groups[date];
    const daySplits = [...new Set(dayEntries.map(e => exToSplit(e.exercise)).filter(Boolean))];
    const totalSets = dayEntries.reduce((s, e) => s + (e.setData ? e.setData.length : 0), 0);
    html += '<div class="day-head"><span class="day-date">' + formatDateFull(date) + '</span>' +
      '<span class="day-meta">' + (daySplits.length ? daySplits.join(' / ').toUpperCase() + ' · ' : '') +
      dayEntries.length + ' EXERCISES · ' + totalSets + ' SETS</span></div>';
    dayEntries.forEach(entry => { html += renderHistoryEntry(entry); });
  });
  c.innerHTML = html;
}

function setHistFilter(f) { historyFilterSplit = f; historyFilterExercise = 'All'; render(); }

function renderHistoryEntry(entry) {
  const color = getSplitColor(entry.exercise);
  const split = getSplitName(entry.exercise);
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
      '<div style="margin-bottom:12px"><div class="edit-label">NOTE</div>' +
        '<input class="edit-input" type="text" id="edit-note" maxlength="200" value="' + esc(entry.note || '') + '"></div>' +
      '<div style="margin-bottom:12px"><div class="edit-label">PHASE</div>' +
        '<select class="edit-input" id="edit-phase" style="width:180px;font-size:11px">' +
          '<option value=""' + (!entry.phase ? ' selected' : '') + '>—</option>' +
          Object.entries(PHASE_META).map(([k, m]) =>
            '<option value="' + k + '"' + (entry.phase === k ? ' selected' : '') + '>' + m.label + '</option>').join('') +
        '</select></div>' +
      '<button class="strain-btn' + (entry.strain ? ' on' : '') + '" id="edit-strain" onclick="this.classList.toggle(\'on\')">' +
        'STRAIN</button>' +
      '<div class="edit-actions">' +
        '<button class="save-btn" onclick="saveEdit(' + entry.id + ')">SAVE</button>' +
        '<button class="cancel-btn" onclick="cancelEdit()">CANCEL</button></div></div>';
  }
  return '<div class="history-entry"><div style="flex:1">' +
    '<div class="history-name">' + esc(entry.exercise) +
      (split ? '<span class="history-tag" style="background:' + color + '20;color:' + color + '">' + esc(split.toUpperCase()) + '</span>' : '') +
      (entry.strain ? '<span class="strain-tag">STRAIN</span>' : '') +
      (entry.phase && PHASE_META[entry.phase] ? '<span class="history-tag" style="background:' + PHASE_META[entry.phase].color + '15;color:' + PHASE_META[entry.phase].color + '">' + PHASE_META[entry.phase].label + '</span>' : '') + '</div>' +
    '<div class="history-detail">' + entry.weight + 'lb · avg e1RM: ' + entry.e1rm + '</div>' +
    '<div class="history-sets">' + esc(setsDisplay(entry)) + '</div>' +
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
  entry.phase = document.getElementById('edit-phase')?.value || null;
  entry.strain = document.getElementById('edit-strain')?.classList.contains('on') || false;
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
