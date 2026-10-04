/* ============================================================
   SECTION: GIST SYNC (merge by entry id, tombstoned deletes)
   ============================================================ */
const SYNC_FILE = 'lift-tracker-data.json';
const GH_API = 'https://api.github.com';

function ghHeaders() {
  return {
    'Authorization': 'Bearer ' + syncCfg.token,
    'Accept': 'application/vnd.github+json',
    'Content-Type': 'application/json'
  };
}

function openSync() {
  document.getElementById('syncOverlay').classList.add('open');
  renderSync('');
  /* async, so it fills in just after the panel paints */
  getSafety().then(snap => {
    const row = document.getElementById('safetyRow');
    if (!row || !snap) return;
    row.innerHTML = '<div style="margin-top:14px;padding-top:12px;border-top:1px solid rgba(255,255,255,0.08)">' +
      '<div class="map-hint" style="margin-bottom:8px">Snapshot from ' + esc(new Date(snap.at).toLocaleString()) +
      ' — ' + snap.payload.entries.length + ' entries' + (snap.reason ? ' (' + esc(snap.reason) + ')' : '') + '</div>' +
      '<button class="data-btn" style="border-color:rgba(232,184,58,0.35);color:rgba(232,184,58,0.85)"' +
      ' onclick="restoreSafety()">⟲ RESTORE SNAPSHOT</button></div>';
  });
}
function closeSync() {
  document.getElementById('syncOverlay').classList.remove('open');
}

function renderSync(status, isError) {
  const last = syncCfg.lastSync
    ? new Date(syncCfg.lastSync).toLocaleString()
    : 'never';
  document.getElementById('syncInner').innerHTML =
    '<div class="ov-head"><span class="ov-title">Device Sync</span>' +
    '<button class="ov-close" onclick="closeSync()">×</button></div>' +
    '<div class="ov-sub">syncs entries, splits, custom exercises, phase + bodyweight through a private GitHub Gist</div>' +
    '<div style="margin-bottom:16px"><label class="label">GITHUB TOKEN</label>' +
    '<input class="input" type="password" id="syncToken" placeholder="github_pat_… or ghp_…" value="' + esc(syncCfg.token) + '"' +
    ' onchange="syncCfg.token=this.value.trim();saveSyncCfg()" style="font-size:12px">' +
    '<div class="map-hint" style="margin-top:6px">github.com → Settings → Developer settings → Personal access tokens.<br>' +
    'Fine-grained: Account permissions → Gists → Read and write. Classic: check the <b>gist</b> scope.<br>' +
    'The token is stored only on this device.</div></div>' +
    '<div style="margin-bottom:20px"><label class="label">GIST ID (auto-filled on first sync)</label>' +
    '<input class="input" type="text" id="syncGist" placeholder="leave blank — found or created automatically" value="' + esc(syncCfg.gistId) + '"' +
    ' onchange="syncCfg.gistId=this.value.trim();saveSyncCfg()" style="font-size:12px"></div>' +
    '<button class="log-btn" onclick="syncNow()" ' + (syncBusy ? 'disabled' : '') + '>' +
    (syncBusy ? 'SYNCING…' : 'SYNC NOW') + '</button>' +
    '<div class="map-hint" style="margin-top:12px">Last sync: ' + esc(last) + '</div>' +
    '<div id="safetyRow"></div>' +
    (status ? '<div class="map-hint" style="margin-top:8px;color:' + (isError ? 'var(--red)' : 'var(--green)') + ';font-size:10px">' + esc(status) + '</div>' : '');
}

/* merge remote payload into local state; returns summary counts */
function mergeSync(remote) {
  let pulled = 0, deleted = 0;
  const local = new Map(entries.map(e => [e.id, e]));
  (remote.entries || []).forEach(re => {
    migrateEntry(re);
    const le = local.get(re.id);
    if (!le) { local.set(re.id, re); pulled++; }
    else if ((re.mod || 0) > (le.mod || 0)) { local.set(re.id, re); pulled++; }
  });
  const tomb = new Map(tombstones.map(t => [t.id, t.mod]));
  (remote.tombstones || []).forEach(t => {
    if (!tomb.has(t.id) || t.mod > tomb.get(t.id)) tomb.set(t.id, t.mod);
  });
  tomb.forEach((mod, id) => {
    const e = local.get(id);
    if (e && mod >= (e.mod || 0)) { local.delete(id); deleted++; }
  });
  entries = [...local.values()].sort((a, b) => a.date.localeCompare(b.date));
  tombstones = [...tomb.entries()].map(([id, mod]) => ({ id, mod })).slice(-500);
  /* weigh-ins: per-date merge, newest mod wins, tombstoned deletes */
  const bwLocal = new Map(bwLog.map(r => [r.date, r]));
  (remote.bwLog || []).forEach(rr => {
    if (!rr || !rr.date || !(rr.w > 0)) return;
    const l = bwLocal.get(rr.date);
    if (!l || (rr.mod || 0) > (l.mod || 0)) bwLocal.set(rr.date, rr);
  });
  const bwTomb = new Map(bwTombstones.map(t => [t.date, t.mod]));
  (remote.bwTombstones || []).forEach(t => {
    if (!t || !t.date) return;
    if (!bwTomb.has(t.date) || t.mod > bwTomb.get(t.date)) bwTomb.set(t.date, t.mod);
  });
  bwTomb.forEach((mod, date) => {
    const r = bwLocal.get(date);
    if (r && mod >= (r.mod || 0)) bwLocal.delete(date);
  });
  bwLog = [...bwLocal.values()].sort((a, b) => a.date.localeCompare(b.date));
  bwTombstones = [...bwTomb.entries()].map(([date, mod]) => ({ date, mod })).slice(-300);
  bodyweight = latestBw();
  /* scalar state: newer side wins wholesale */
  if ((remote.metaMod || 0) > metaMod) {
    if (remote.config && remote.config.home && remote.config.gym) config = remote.config;
    if (remote.alts && typeof remote.alts === 'object') alts = { home: remote.alts.home || {}, gym: remote.alts.gym || {} };
    if (Array.isArray(remote.customExercises)) customExercises = remote.customExercises;
    if (remote.phase) {
      if (Array.isArray(remote.phase.phases) && remote.phase.phases.filter(validSeg).length) {
        phases = remote.phase.phases;
      } else if (PHASE_META[remote.phase.phase]) {
        phases = [{ phase: remote.phase.phase, since: remote.phase.since || phaseSince }];
      }
      normalizePhases();
    }
    if (remote.bwGoal !== undefined) bwGoal = remote.bwGoal > 0 ? remote.bwGoal : null;
    if (!bwLog.length && remote.bodyweight) bodyweight = remote.bodyweight;
    metaMod = remote.metaMod;
  }
  return { pulled, deleted };
}

async function persistAll() {
  await saveData(); await saveTombstones(); await saveConfig(); await saveCustoms(); await savePhase();
  await saveBwLog(); await saveBwTombstones(); await saveBwGoal(); await saveAlts();
  try { if (bodyweight) await store.set('lift-tracker-bodyweight', String(bodyweight)); } catch (e) {}
  try { await store.set('lift-tracker-metamod', String(metaMod)); } catch (e) {}
}

async function findExistingGist() {
  const r = await fetch(GH_API + '/gists?per_page=100', { headers: ghHeaders() });
  if (!r.ok) return null;
  const gists = await r.json();
  const hit = gists.find(g => g.files && g.files[SYNC_FILE]);
  return hit ? hit.id : null;
}

async function syncNow() {
  if (syncBusy) return;
  syncCfg.token = (document.getElementById('syncToken')?.value || syncCfg.token).trim();
  syncCfg.gistId = (document.getElementById('syncGist')?.value || syncCfg.gistId).trim();
  await saveSyncCfg();
  if (!syncCfg.token) { renderSync('Token required — see the steps above.', true); return; }
  syncBusy = true;
  renderSync('Contacting GitHub…');
  try {
    /* discover or create the gist */
    if (!syncCfg.gistId) {
      renderSync('Looking for an existing sync gist…');
      const found = await findExistingGist();
      if (found) syncCfg.gistId = found;
      else {
        renderSync('Creating private sync gist…');
        const r = await fetch(GH_API + '/gists', {
          method: 'POST', headers: ghHeaders(),
          body: JSON.stringify({
            description: 'Lift Tracker sync data',
            public: false,
            files: { [SYNC_FILE]: { content: JSON.stringify(buildSyncPayload()) } }
          })
        });
        if (!r.ok) throw new Error('Could not create gist (HTTP ' + r.status + '). Check the token has gist read/write.');
        const g = await r.json();
        syncCfg.gistId = g.id;
        syncCfg.lastSync = Date.now();
        await saveSyncCfg();
        syncBusy = false;
        renderSync('Created sync gist and uploaded ' + entries.length + ' entries. Use the same token on your other device — it will find this gist automatically.');
        return;
      }
      await saveSyncCfg();
    }
    /* pull */
    renderSync('Pulling…');
    const r = await fetch(GH_API + '/gists/' + syncCfg.gistId, { headers: ghHeaders() });
    if (r.status === 404) throw new Error('Gist not found — clear the Gist ID field and sync again to recreate it.');
    if (!r.ok) throw new Error('Pull failed (HTTP ' + r.status + '). Check the token.');
    const g = await r.json();
    let remote = {};
    const f = g.files && g.files[SYNC_FILE];
    if (f) {
      let content = f.content;
      if (f.truncated && f.raw_url) content = await (await fetch(f.raw_url)).text();
      try { remote = JSON.parse(content) || {}; } catch (e) { remote = {}; }
    }
    /* merge + persist + push */
    const { pulled, deleted } = mergeSync(remote);
    await restampEntries();
    await persistAll();
    renderSync('Pushing…');
    const pr = await fetch(GH_API + '/gists/' + syncCfg.gistId, {
      method: 'PATCH', headers: ghHeaders(),
      body: JSON.stringify({ files: { [SYNC_FILE]: { content: JSON.stringify(buildSyncPayload()) } } })
    });
    if (!pr.ok) throw new Error('Push failed (HTTP ' + pr.status + ').');
    syncCfg.lastSync = Date.now();
    await saveSyncCfg();
    initProfile(); updateHeader(); updatePhaseUI(); render();
    syncBusy = false;
    renderSync('Synced — ' + pulled + ' pulled/updated, ' + deleted + ' deletions applied, ' + entries.length + ' entries total.');
  } catch (err) {
    syncBusy = false;
    renderSync(err.message || 'Sync failed — check connection and token.', true);
  }
}

/* ============================================================
   SECTION: EXPORT / IMPORT / CLEAR
   ============================================================ */
function buildSyncPayload() {
  return {
    version: APP_VERSION,
    exportDate: new Date().toISOString(),
    entries, tombstones, bodyweight,
    config, customExercises, alts,
    phase: { phase, since: phaseSince, phases },
    bwLog, bwTombstones, bwGoal,
    metaMod
  };
}

async function exportData() {
  const json = JSON.stringify(buildSyncPayload(), null, 2);
  const name = 'lift-tracker-backup-' + new Date().toISOString().split('T')[0] + '.json';
  /* phone: share sheet (save to Drive, etc.) — fallback: plain download */
  try {
    const file = new File([json], name, { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Lift Tracker backup' });
      showToast('Data exported (v' + APP_VERSION + ')');
      return;
    }
  } catch (e) { if (e && e.name === 'AbortError') return; }
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
  showToast('Data exported (v' + APP_VERSION + ')');
}

async function importData(event) {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (data.entries && Array.isArray(data.entries)) {
      await saveSafety('before import of ' + (file.name || 'a backup'));
      entries = data.entries.map(migrateEntry).sort((a, b) => a.date.localeCompare(b.date));
      if (data.bodyweight) { bodyweight = data.bodyweight; await store.set('lift-tracker-bodyweight', String(bodyweight)); }
      if (data.config && data.config.home && data.config.gym) { config = data.config; await saveConfig(); }
      if (Array.isArray(data.customExercises)) { customExercises = data.customExercises; await saveCustoms(); }
      if (data.alts && typeof data.alts === 'object') { alts = { home: data.alts.home || {}, gym: data.alts.gym || {} }; await saveAlts(); }
      if (data.phase) {
        if (Array.isArray(data.phase.phases) && data.phase.phases.filter(validSeg).length) {
          phases = data.phase.phases;
        } else if (PHASE_META[data.phase.phase]) {
          /* legacy backup: rebuild segments from the entry tags it carries,
             then append its stored current phase if it starts later */
          const inf = inferPhasesFromEntries();
          phases = inf.length ? inf : [];
          const last = phases[phases.length - 1];
          const since = data.phase.since || isoToday();
          if (!last || since > last.since) phases.push({ phase: data.phase.phase, since });
        }
        normalizePhases();
        await savePhase(); updatePhaseUI();
      }
      if (Array.isArray(data.bwLog)) {
        bwLog = data.bwLog.filter(r => r && r.date && r.w > 0);
        sortBwLog(); await saveBwLog();
      } else if (data.bodyweight > 0 && !bwLog.length) {
        const d = entries.length ? entries[entries.length - 1].date : isoToday();
        bwLog = [{ date: d, w: data.bodyweight, mod: Date.now() }];
        await saveBwLog();
      }
      if (Array.isArray(data.bwTombstones)) { bwTombstones = data.bwTombstones; await saveBwTombstones(); }
      if (data.bwGoal !== undefined) { bwGoal = data.bwGoal > 0 ? data.bwGoal : null; await saveBwGoal(); }
      bodyweight = latestBw();
      await restampEntries();
      tombstones = Array.isArray(data.tombstones) ? data.tombstones : [];
      await saveTombstones(); await bumpMeta();
      await saveData();
      initProfile();
      updateHeader(); render();
      showToast('Imported ' + entries.length + ' entries' + (data.version ? ' (backup v' + data.version + ')' : ' (v1 backup)'));
    } else { showToast('Invalid file format', { color: 'var(--red)' }); }
  } catch (e) { showToast('Import failed', { color: 'var(--red)' }); console.error(e); }
  event.target.value = '';
}

async function clearAllData() {
  if (!confirm('Delete all ' + entries.length + ' entries? This propagates to synced devices.\n\n' +
    'A local snapshot is kept — RESTORE SNAPSHOT appears in the SYNC panel afterwards. ' +
    '(Splits, alternates and custom exercises are kept either way.)')) return;
  await saveSafety('before CLEAR ALL of ' + entries.length + ' entries');
  const now = Date.now();
  entries.forEach(e => tombstones.push({ id: e.id, mod: now }));
  entries = [];
  await saveTombstones(); await saveData();
  updateHeader();
  showToast('All data cleared — snapshot kept, see SYNC to restore', { color: 'var(--amber)', duration: 4200 });
  render();
}

/* ---- restore the pre-destruction snapshot ---- */
async function restoreSafety() {
  const snap = await getSafety();
  if (!snap) { showToast('No snapshot available', { color: 'var(--red)' }); return; }
  const p = snap.payload;
  if (!confirm('Restore the snapshot taken ' + new Date(snap.at).toLocaleString() + '?\n\n' +
    p.entries.length + ' entries will replace the current ' + entries.length + '.')) return;
  entries = p.entries.map(migrateEntry).sort((a, b) => a.date.localeCompare(b.date));
  /* drop tombstones for restored ids, or the next sync deletes them again */
  const ids = new Set(entries.map(e => e.id));
  tombstones = (p.tombstones || []).filter(t => !ids.has(t.id));
  if (p.config && p.config.home && p.config.gym) config = p.config;
  if (p.alts) alts = { home: p.alts.home || {}, gym: p.alts.gym || {} };
  if (Array.isArray(p.customExercises)) customExercises = p.customExercises;
  if (Array.isArray(p.bwLog)) bwLog = p.bwLog;
  if (p.bwGoal !== undefined) bwGoal = p.bwGoal > 0 ? p.bwGoal : null;
  if (p.phase && Array.isArray(p.phase.phases) && p.phase.phases.filter(validSeg).length) phases = p.phase.phases;
  normalizePhases();
  sortBwLog(); bodyweight = latestBw();
  await restampEntries();
  await persistAll(); await bumpMeta();
  initProfile(); updateHeader(); updatePhaseUI(); render();
  showToast('Restored ' + entries.length + ' entries — SYNC to push to your other device', { duration: 4000 });
  renderSync('Restored from snapshot. Sync now to propagate.');
}
