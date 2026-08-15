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
  /* scalar state: newer side wins wholesale */
  if ((remote.metaMod || 0) > metaMod) {
    if (remote.config && remote.config.home && remote.config.gym) config = remote.config;
    if (Array.isArray(remote.customExercises)) customExercises = remote.customExercises;
    if (remote.phase && PHASE_META[remote.phase.phase]) {
      phase = remote.phase.phase;
      phaseSince = remote.phase.since || phaseSince;
    }
    if (remote.bodyweight) bodyweight = remote.bodyweight;
    metaMod = remote.metaMod;
  }
  return { pulled, deleted };
}

async function persistAll() {
  await saveData(); await saveTombstones(); await saveConfig(); await saveCustoms(); await savePhase();
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
    config, customExercises,
    phase: { phase, since: phaseSince },
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
      entries = data.entries.map(migrateEntry).sort((a, b) => a.date.localeCompare(b.date));
      if (data.bodyweight) { bodyweight = data.bodyweight; await store.set('lift-tracker-bodyweight', String(bodyweight)); }
      if (data.config && data.config.home && data.config.gym) { config = data.config; await saveConfig(); }
      if (Array.isArray(data.customExercises)) { customExercises = data.customExercises; await saveCustoms(); }
      if (data.phase && PHASE_META[data.phase.phase]) {
        phase = data.phase.phase; phaseSince = data.phase.since || phaseSince;
        await savePhase(); updatePhaseUI();
      }
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
  if (!confirm('Delete all entries? This cannot be undone and will propagate to synced devices. (Splits and custom exercises are kept.)')) return;
  const now = Date.now();
  entries.forEach(e => tombstones.push({ id: e.id, mod: now }));
  entries = [];
  await saveTombstones(); await saveData();
  updateHeader(); showToast('All data cleared'); render();
}
