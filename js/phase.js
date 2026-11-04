/* ============================================================
   SECTION: PHASE HISTORY & WEIGHT OVERLAY

   Two things live here because they're edited together: the phase
   timeline (an ordered list of {phase, since} segments that entry
   tags are DERIVED from) and the dated bodyweight log.

   Nothing in here mutates `phases` or `bwLog` directly on the way
   in — edits land in `phaseDraft` and are committed as a batch, so
   a half-finished edit can be abandoned with CANCEL.
   ============================================================ */

let phaseDraft = null;      /* working copy of `phases` while the overlay is open */
let phaseDirty = false;     /* draft differs from committed state */
let bwAddOpen = false;      /* the "add a weigh-in" row is showing */
let bwEditDate = null;      /* which logged day is being edited in the list */

function openPhaseHistory() {
  if (typeof captureFormVals === 'function') captureFormVals();
  phaseDraft = phases.map(s => ({ phase: s.phase, since: s.since }));
  phaseDirty = false;
  bwAddOpen = false;
  bwEditDate = null;
  document.getElementById('phaseOverlay').classList.add('open');
  renderPhaseHistory();
}

function closePhaseHistory() {
  if (phaseDirty && !confirm('Discard unsaved phase changes?')) return;
  document.getElementById('phaseOverlay').classList.remove('open');
  phaseDraft = null;
  phaseDirty = false;
  updatePhaseUI();
  render();
}

/* ---- phase segment editing (draft only) -------------------------------- */

function phaseDraftSet(i, field, value) {
  if (!phaseDraft || !phaseDraft[i]) return;
  phaseDraft[i][field] = value;
  phaseDirty = true;
  renderPhaseHistory();
}

function phaseDraftAdd() {
  if (!phaseDraft) return;
  const last = phaseDraft[phaseDraft.length - 1];
  /* default the new segment to today, or a day after the last one if that's later */
  let since = isoToday();
  if (last && last.since >= since) {
    const d = new Date(last.since + 'T12:00:00');
    d.setDate(d.getDate() + 1);
    since = d.toISOString().split('T')[0];
  }
  const next = last && last.phase === 'cut' ? 'leangain' : 'cut';
  phaseDraft.push({ phase: next, since });
  phaseDirty = true;
  renderPhaseHistory();
}

function phaseDraftDel(i) {
  if (!phaseDraft) return;
  if (phaseDraft.length <= 1) {
    showToast('At least one phase segment is required', { color: 'var(--amber)' });
    return;
  }
  phaseDraft.splice(i, 1);
  phaseDirty = true;
  renderPhaseHistory();
}

/* rebuild the draft from surviving entry tags — recovery for a backup
   that carries correct per-entry phases but lost the history array */
function phaseDraftInfer() {
  const inf = inferPhasesFromEntries();
  if (!inf.length) {
    showToast('No phase-tagged entries to infer from', { color: 'var(--amber)' });
    return;
  }
  phaseDraft = inf;
  phaseDirty = true;
  showToast('Inferred ' + inf.length + ' segment' + (inf.length === 1 ? '' : 's') + ' — review, then SAVE', { duration: 3200 });
  renderPhaseHistory();
}

/* validate, commit, re-derive every entry tag */
async function phaseDraftSave() {
  if (!phaseDraft || !phaseDraft.length) return;
  const today = isoToday();
  for (const s of phaseDraft) {
    if (!PHASE_META[s.phase]) { showToast('Pick a phase for every segment', { color: 'var(--red)' }); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s.since)) { showToast('Every segment needs a start date', { color: 'var(--red)' }); return; }
    if (s.since > today) { showToast('A segment cannot start in the future', { color: 'var(--red)' }); return; }
  }
  const sorted = phaseDraft.slice().sort((a, b) => a.since.localeCompare(b.since));
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].since === sorted[i - 1].since) {
      showToast('Two segments share ' + formatDateFull(sorted[i].since), { color: 'var(--red)' });
      return;
    }
  }
  phases = sorted.map(s => ({ phase: s.phase, since: s.since }));
  normalizePhases();
  await savePhase();
  await bumpMeta();
  const n = await restampEntries();
  phaseDraft = phases.map(s => ({ phase: s.phase, since: s.since }));
  phaseDirty = false;
  updatePhaseUI();
  showToast('Saved ' + phases.length + ' segment' + (phases.length === 1 ? '' : 's') +
    (n ? ' · ' + n + ' entries re-tagged' : ' · tags already correct'),
    { color: PHASE_META[phase].color, duration: 3000 });
  renderPhaseHistory();
}

/* ---- bodyweight goal --------------------------------------------------- */

async function bwGoalSave(el) {
  const v = parseFloat(el.value);
  bwGoal = v > 0 ? Math.round(v * 10) / 10 : null;
  await saveBwGoal();
  await bumpMeta();
  showToast(bwGoal ? 'Goal set to ' + bwGoal + ' lb' : 'Goal cleared');
  renderPhaseHistory();
}

/* ---- weigh-in list ----------------------------------------------------- */

function bwToggleAdd() {
  bwAddOpen = !bwAddOpen;
  bwEditDate = null;
  renderPhaseHistory();
}

async function bwAddSave() {
  const d = document.getElementById('bwAddDate').value;
  const w = parseFloat(document.getElementById('bwAddWeight').value);
  if (!d || !(w > 0)) { showToast('Need a date and a weight', { color: 'var(--red)' }); return; }
  const n = await setBodyweightOn(d, w);
  bwAddOpen = false;
  showToast('Logged ' + w + ' lb on ' + formatDateFull(d) + (n ? ' · ' + n + ' entries recalculated' : ''), { duration: 2800 });
  renderPhaseHistory();
}

async function bwRowSave(date) {
  const w = parseFloat(document.getElementById('bwRow-' + date).value);
  if (!(w > 0)) { showToast('Enter a weight', { color: 'var(--red)' }); return; }
  const n = await setBodyweightOn(date, w);
  bwEditDate = null;
  showToast('Updated ' + formatDateFull(date) + (n ? ' · ' + n + ' entries recalculated' : ''));
  renderPhaseHistory();
}

async function bwRowDel(date) {
  if (!confirm('Delete the weigh-in for ' + formatDateFull(date) + '?')) return;
  const n = await deleteBodyweightOn(date);
  bwEditDate = null;
  showToast('Deleted ' + formatDateFull(date) + (n ? ' · ' + n + ' entries recalculated' : ''));
  renderPhaseHistory();
}

/* ---- render ------------------------------------------------------------ */

function renderPhaseHistory() {
  const inner = document.getElementById('phaseInner');
  if (!inner || !phaseDraft) return;
  const today = isoToday();

  let html = '<div class="ov-head"><span class="ov-title">Phase History &amp; Weight</span>' +
    '<button class="ov-close" onclick="closePhaseHistory()">&times;</button></div>' +
    '<div class="ov-sub">Entry tags are derived from this timeline — editing it re-tags history, it never erases it</div>';

  /* --- phase segments --- */
  html += '<div class="ov-bar"><span style="font-size:9px;color:rgba(255,255,255,0.25);letter-spacing:1px">' +
    'PHASE TIMELINE' + (phaseDirty ? ' — UNSAVED' : '') + '</span>' +
    '<button class="data-btn" onclick="phaseDraftAdd()">+ SEGMENT</button></div>';

  const sortedDraft = phaseDraft
    .map((s, i) => ({ s, i }))
    .sort((a, b) => a.s.since.localeCompare(b.s.since));

  sortedDraft.forEach(({ s, i }, pos) => {
    const m = PHASE_META[s.phase] || { label: '—', color: 'var(--dim)' };
    const next = sortedDraft[pos + 1];
    const until = next ? formatDate(next.s.since) : 'now';
    const opts = Object.entries(PHASE_META).map(([k, v]) =>
      '<option value="' + k + '"' + (k === s.phase ? ' selected' : '') + '>' + v.label + '</option>').join('');
    html += '<div class="edit-row" style="align-items:center;gap:8px;border-left:3px solid ' + m.color + ';padding-left:8px">' +
      '<select class="edit-input" style="flex:0 0 104px;color:' + m.color + '" ' +
        'onchange="phaseDraftSet(' + i + ',\'phase\',this.value)">' + opts + '</select>' +
      '<input class="edit-input" type="date" style="flex:1" value="' + s.since + '" max="' + today + '" ' +
        'onchange="phaseDraftSet(' + i + ',\'since\',this.value)">' +
      '<span style="font-size:10px;color:var(--dim);flex:0 0 52px;text-align:right">→ ' + until + '</span>' +
      '<button class="del-btn" onclick="phaseDraftDel(' + i + ')" title="remove this segment">&times;</button>' +
    '</div>';
  });

  html += '<div class="edit-actions" style="margin:10px 0 4px">' +
    '<button class="save-btn" onclick="phaseDraftSave()">SAVE &amp; RE-TAG</button>' +
    '<button class="cancel-btn" onclick="phaseDraftInfer()" title="rebuild the timeline from per-entry phase tags">INFER FROM ENTRIES</button>' +
    '</div>' +
    '<div class="bw-note">Re-tagging is idempotent: every entry takes the phase in effect on its own date. ' +
    'Entries edited to a pinned phase on the HISTORY tab are left alone.</div>';

  /* --- bodyweight --- */
  const roll = bwLog.length ? bwRolling(14) : [];
  const cur = roll.length ? roll[roll.length - 1] : null;

  html += '<div class="ov-bar" style="margin-top:18px"><span style="font-size:9px;color:rgba(255,255,255,0.25);letter-spacing:1px">BODYWEIGHT</span>' +
    '<button class="data-btn" onclick="bwToggleAdd()">' + (bwAddOpen ? 'CANCEL' : '+ WEIGH-IN') + '</button></div>';

  html += '<div class="stats-grid" style="margin-bottom:10px">' +
    '<div class="stat-card"><div class="stat-label">LATEST</div><div class="stat-value">' +
      (bwLog.length ? latestBw() + ' lb' : '—') + '</div></div>' +
    '<div class="stat-card"><div class="stat-label">14D AVG</div><div class="stat-value">' +
      (cur ? cur.w + ' lb' : '—') + '</div></div>' +
    '<div class="stat-card"><div class="stat-label">WEIGH-INS</div><div class="stat-value">' + bwLog.length + '</div></div>' +
    '</div>';

  html += '<div class="edit-row" style="align-items:center;gap:8px">' +
    '<span class="edit-label" style="flex:0 0 auto">GOAL</span>' +
    '<input class="edit-input" type="number" step="0.1" inputmode="decimal" style="flex:1" ' +
      'value="' + (bwGoal == null ? '' : bwGoal) + '" placeholder="target lb" onchange="bwGoalSave(this)">' +
    (bwGoal && cur ? '<span style="font-size:10px;color:var(--dim)">' +
      (Math.round((cur.w - bwGoal) * 10) / 10) + ' lb to go</span>' : '') +
    '</div>';

  if (bwAddOpen) {
    html += '<div class="edit-row" style="align-items:center;gap:8px;margin-top:6px">' +
      '<input class="edit-input" type="date" id="bwAddDate" style="flex:1" value="' + today + '" max="' + today + '">' +
      '<input class="edit-input" type="number" step="0.1" inputmode="decimal" id="bwAddWeight" style="flex:0 0 90px" placeholder="lb">' +
      '<button class="save-btn" style="padding:6px 12px;font-size:10px" onclick="bwAddSave()">ADD</button>' +
      '</div>';
  }

  if (!bwLog.length) {
    html += '<div class="empty" style="margin-top:10px">No weigh-ins logged yet.</div>';
  } else {
    html += '<div style="margin-top:10px;max-height:260px;overflow-y:auto">';
    bwLog.slice().reverse().forEach(r => {
      const p = phaseForDate(r.date);
      const m = p ? PHASE_META[p] : null;
      if (bwEditDate === r.date) {
        html += '<div class="edit-row" style="align-items:center;gap:8px">' +
          '<span style="flex:1;font-size:11px">' + formatDateFull(r.date) + '</span>' +
          '<input class="edit-input" type="number" step="0.1" inputmode="decimal" id="bwRow-' + r.date + '" style="flex:0 0 90px" value="' + r.w + '">' +
          '<button class="save-btn" style="padding:6px 10px;font-size:10px" onclick="bwRowSave(\'' + r.date + '\')">SAVE</button>' +
          '<button class="cancel-btn" style="padding:6px 10px;font-size:10px" onclick="bwEditDate=null;renderPhaseHistory()">&times;</button>' +
          '</div>';
      } else {
        html += '<div class="edit-row" style="align-items:center;gap:8px">' +
          (m ? '<span style="flex:0 0 6px;height:18px;border-radius:2px;background:' + m.color + '" title="' + m.label + '"></span>' : '<span style="flex:0 0 6px"></span>') +
          '<span style="flex:1;font-size:11px">' + formatDateFull(r.date) + '</span>' +
          '<span style="flex:0 0 60px;text-align:right;font-size:12px;font-weight:600">' + r.w + ' lb</span>' +
          '<button class="edit-btn" style="padding:4px 10px;font-size:10px" onclick="bwEditDate=\'' + r.date + '\';renderPhaseHistory()">EDIT</button>' +
          '<button class="del-btn" onclick="bwRowDel(\'' + r.date + '\')">&times;</button>' +
          '</div>';
      }
    });
    html += '</div>';
    html += '<div class="bw-note">Editing a weigh-in recalculates bodyweight-loaded exercises (pull-ups, dips) from that date forward. ' +
      'Days before your first weigh-in keep whatever weight they were logged at.</div>';
  }

  inner.innerHTML = html;
}
