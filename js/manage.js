/* ============================================================
   SECTION: MANAGE SPLITS OVERLAY
   ============================================================ */
function openManage() {
  captureFormVals();
  manageUnlocked = false; addingTo = null; addSearch = ''; customFormOpen = false;
  resetCustomForm();
  document.getElementById('manageOverlay').classList.add('open');
  renderManage();
}

function closeManage() {
  document.getElementById('manageOverlay').classList.remove('open');
  initProfile();
  updateHeader();
  render();
}

function toggleLock() {
  manageUnlocked = !manageUnlocked;
  renderManage();
}

function resetCustomForm() {
  customSel = { name: '', bw: false, cardio: false, p: new Set(), s: new Set() };
}

function libSummary(libEx) {
  if (!libEx) return '';
  const pN = muscleNames(expandMuscles(libEx.p));
  return pN.slice(0, 3).join(', ');
}

function renderManage() {
  const splits = getSplits();
  let html = '<div class="ov-head"><span class="ov-title">Edit Splits</span>' +
    '<button class="ov-close" onclick="closeManage()">×</button></div>' +
    '<div class="ov-sub">' + (currentProfile === 'home' ? 'HOME' : 'GYM') + ' PROFILE · removing an exercise never touches logged history</div>' +
    '<div class="ov-bar"><span style="font-size:9px;color:rgba(255,255,255,0.25);letter-spacing:1px">' +
      (manageUnlocked ? 'EDIT MODE — reorder / remove enabled' : 'locked — tap to enable reorder / remove') + '</span>' +
    '<button class="lock-btn' + (manageUnlocked ? ' unlocked' : '') + '" onclick="toggleLock()">' +
      (manageUnlocked ? '🔓 UNLOCKED' : '🔒 LOCKED') + '</button></div>';

  SPLIT_ORDER.forEach(name => {
    const data = splits[name];
    html += '<div class="m-split"><div class="m-split-head">' +
      '<span class="m-split-name" style="color:' + data.color + '">' + name.toUpperCase() + '</span>' +
      '<span class="m-count">' + data.exercises.length + ' EXERCISES</span></div>';
    data.exercises.forEach((ex, i) => {
      const lib = libGet(ex);
      html += '<div class="m-ex-row"><div class="m-ex-name">' + esc(ex) +
        (lib ? '<span class="m-ex-m">' + esc(libSummary(lib)) + (lib.bw ? ' · BW' : '') + '</span>'
             : '<span class="m-ex-m" style="color:rgba(232,184,58,0.5)">no muscle data</span>') + '</div>';
      if (manageUnlocked) {
        html += '<button class="m-arrow" ' + (i === 0 ? 'disabled' : '') + ' data-split="' + esc(name) + '" data-i="' + i + '" onclick="moveEx(this,-1)">↑</button>' +
          '<button class="m-arrow" ' + (i === data.exercises.length - 1 ? 'disabled' : '') + ' data-split="' + esc(name) + '" data-i="' + i + '" onclick="moveEx(this,1)">↓</button>' +
          '<button class="m-del" data-split="' + esc(name) + '" data-i="' + i + '" onclick="removeEx(this)">×</button>';
      }
      html += '</div>';
    });
    if (addingTo === name) {
      html += renderAddPanel(name);
    } else {
      html += '<button class="m-add-btn" data-split="' + esc(name) + '" onclick="openAdd(this)">+ ADD EXERCISE</button>';
    }
    html += '</div>';
  });
  document.getElementById('manageInner').innerHTML = html;
  const s = document.getElementById('addSearchInput');
  if (s) { s.focus(); s.setSelectionRange(s.value.length, s.value.length); }
}

function renderAddPanel(splitName) {
  const inSplit = new Set(getSplits()[splitName].exercises);
  let html = '<div class="add-panel">';
  if (!customFormOpen) {
    const q = addSearch.trim().toLowerCase();
    const matches = getLibrary()
      .filter(e => !inSplit.has(e.n))
      .filter(e => !q || e.n.toLowerCase().includes(q))
      .sort((a, b) => a.n.localeCompare(b.n));
    html += '<div class="edit-label">ADD TO ' + esc(splitName.toUpperCase()) + '</div>' +
      '<input class="input" type="text" id="addSearchInput" placeholder="search library (' + getLibrary().length + ' exercises)"' +
      ' value="' + esc(addSearch) + '" oninput="addSearch=this.value;renderManage()" style="font-size:13px;padding:10px 12px">' +
      '<div class="lib-list">' +
      (matches.length ? matches.map(e =>
        '<div class="lib-row" data-ex="' + esc(e.n) + '" onclick="addFromLib(this)">' +
        '<span class="lib-name">' + esc(e.n) + (e.bw ? ' <span style="color:#3a8ee8;font-size:8px">BW</span>' : '') + (e.cardio ? ' <span style="color:' + CARDIO_COLOR + ';font-size:8px">CARDIO</span>' : '') + '</span>' +
        '<span class="lib-m">' + esc(libSummary(e)) + '</span></div>').join('')
        : '<div class="empty" style="padding:20px">No matches.</div>') +
      '</div>' +
      '<button class="link-btn" onclick="customFormOpen=true;renderManage()">+ create custom exercise</button> ' +
      '<button class="link-btn" style="color:var(--dim)" onclick="closeAdd()">cancel</button>';
  } else {
    html += '<div class="edit-label">CUSTOM EXERCISE → ' + esc(splitName.toUpperCase()) + '</div>' +
      '<input class="input" type="text" id="customName" placeholder="exercise name" maxlength="60"' +
      ' value="' + esc(customSel.name) + '" oninput="customSel.name=this.value" style="font-size:13px;padding:10px 12px;margin-bottom:10px">' +
      '<button class="strain-btn' + (customSel.bw ? ' on' : '') + '" style="border-color:' + (customSel.bw ? '#3a8ee8' : 'rgba(255,255,255,0.1)') + ';color:' + (customSel.bw ? '#3a8ee8' : 'var(--dim)') + ';background:' + (customSel.bw ? 'rgba(58,142,232,0.08)' : 'transparent') + '"' +
      ' onclick="customSel.bw=!customSel.bw;renderManage()">' + (customSel.bw ? '✓ BODYWEIGHT EXERCISE' : 'BODYWEIGHT EXERCISE?') + '</button> ' +
      '<button class="strain-btn' + (customSel.cardio ? ' on' : '') + '" style="border-color:' + (customSel.cardio ? CARDIO_COLOR : 'rgba(255,255,255,0.1)') + ';color:' + (customSel.cardio ? CARDIO_COLOR : 'var(--dim)') + ';background:' + (customSel.cardio ? CARDIO_COLOR + '15' : 'transparent') + '"' +
      ' onclick="customSel.cardio=!customSel.cardio;renderManage()">' + (customSel.cardio ? '✓ CARDIO (incline · min · mph)' : 'CARDIO EXERCISE?') + '</button>' +
      '<div class="edit-label" style="margin-top:14px;color:var(--accent)">PRIMARY MUSCLES' + (customSel.cardio ? ' (optional for cardio)' : ' (required)') + '</div>' +
      '<div class="chip-select">' + CHIP_TAGS.map(([label, tag]) =>
        '<button class="chip-btn' + (customSel.p.has(tag) ? ' sel-p' : '') + '" data-tag="' + tag + '" onclick="toggleChip(this,\'p\')">' + label + '</button>').join('') + '</div>' +
      '<div class="edit-label" style="color:var(--amber)">SECONDARY MUSCLES (optional)</div>' +
      '<div class="chip-select">' + CHIP_TAGS.map(([label, tag]) =>
        '<button class="chip-btn' + (customSel.s.has(tag) ? ' sel-s' : '') + '" data-tag="' + tag + '" onclick="toggleChip(this,\'s\')">' + label + '</button>').join('') + '</div>' +
      '<div class="edit-actions">' +
        '<button class="save-btn" data-split="' + esc(splitName) + '" onclick="saveCustom(this)">SAVE + ADD</button>' +
        '<button class="cancel-btn" onclick="customFormOpen=false;renderManage()">BACK</button></div>';
  }
  html += '</div>';
  return html;
}

function openAdd(el) {
  addingTo = el.dataset.split;
  addSearch = '';
  customFormOpen = false;
  renderManage();
}

function closeAdd() {
  addingTo = null; addSearch = ''; customFormOpen = false;
  renderManage();
}

async function addFromLib(el) {
  const ex = el.dataset.ex;
  if (!addingTo) return;
  config[currentProfile][addingTo].push(ex);
  await saveConfig(); await bumpMeta();
  showToast('Added ' + ex + ' to ' + addingTo);
  renderManage();
}

function toggleChip(el, kind) {
  const tag = el.dataset.tag;
  const set = kind === 'p' ? customSel.p : customSel.s;
  const other = kind === 'p' ? customSel.s : customSel.p;
  if (set.has(tag)) set.delete(tag);
  else { set.add(tag); other.delete(tag); }
  const name = document.getElementById('customName');
  if (name) customSel.name = name.value;
  renderManage();
}

async function saveCustom(el) {
  const splitName = el.dataset.split;
  const name = (document.getElementById('customName')?.value || '').trim();
  if (!name) { showToast('Name required', { color: 'var(--red)' }); return; }
  if (customSel.p.size === 0 && !customSel.cardio) { showToast('Pick at least one primary muscle', { color: 'var(--red)' }); return; }
  if (getLibrary().some(e => e.n.toLowerCase() === name.toLowerCase())) {
    showToast('That exercise already exists in the library', { color: 'var(--red)' }); return;
  }
  const ex = { n: name, p: [...customSel.p], s: [...customSel.s], custom: 1 };
  if (customSel.bw) ex.bw = 1;
  if (customSel.cardio) ex.cardio = 1;
  customExercises.push(ex);
  config[currentProfile][splitName].push(name);
  await saveCustoms(); await saveConfig(); await bumpMeta();
  showToast('Created ' + name);
  resetCustomForm();
  customFormOpen = false;
  renderManage();
}

async function moveEx(el, dir) {
  const split = el.dataset.split, i = parseInt(el.dataset.i);
  const arr = config[currentProfile][split];
  const j = i + dir;
  if (j < 0 || j >= arr.length) return;
  [arr[i], arr[j]] = [arr[j], arr[i]];
  await saveConfig(); await bumpMeta();
  renderManage();
}

async function removeEx(el) {
  const split = el.dataset.split, i = parseInt(el.dataset.i);
  const ex = config[currentProfile][split][i];
  config[currentProfile][split].splice(i, 1);
  await saveConfig(); await bumpMeta();
  showToast('Removed ' + ex + ' from ' + split + ' — history kept');
  renderManage();
}
