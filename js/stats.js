/* ============================================================
   SECTION: STATS TAB (weekly volume, heatmap, stalls)
   ============================================================ */
function exToSplit(ex) {
  const splits = getSplits();
  for (const name of SPLIT_ORDER) {
    if (splits[name].exercises.includes(ex)) return name;
  }
  return null;
}

function setsInRange(fromISO, toISO) {
  /* per-split set counts for entries in [fromISO, toISO], current profile */
  const counts = {};
  SPLIT_ORDER.forEach(s => counts[s] = 0);
  entries.forEach(e => {
    if (e.date < fromISO || e.date > toISO) return;
    const split = exToSplit(e.exercise);
    if (!split) return;
    counts[split] += (e.setData ? e.setData.length : (e.sets || 0));
  });
  return counts;
}

function cardioInRange(fromISO, toISO) {
  let min = 0, vert = 0, n = 0;
  entries.forEach(e => {
    if (!e.cardio || e.date < fromISO || e.date > toISO) return;
    min += e.minutes || 0; vert += e.vert || 0; n++;
  });
  return { min: Math.round(min), vert: Math.round(vert), n };
}

function muscleSetsInRange(fromISO, toISO) {
  /* fractional sets per muscle group; both profiles (tags are profile-independent) */
  const out = {};
  VOL_GROUPS.forEach(g => out[g.key] = 0);
  entries.forEach(e => {
    if (e.date < fromISO || e.date > toISO) return;
    if (e.cardio) return; /* steady-state cardio isn't a hard set */
    const lib = libGet(e.exercise);
    if (!lib) return;
    const sets = e.setData ? e.setData.length : (e.sets || 0);
    const pIds = expandMuscles(lib.p), sIds = expandMuscles(lib.s);
    VOL_GROUPS.forEach(g => {
      if (pIds.some(id => g.ids.includes(id))) out[g.key] += sets;
      else if (sIds.some(id => g.ids.includes(id))) out[g.key] += sets * 0.5;
    });
  });
  Object.keys(out).forEach(k => out[k] = Math.round(out[k] * 10) / 10);
  return out;
}

function setStatsVolMode(m) { statsVolMode = m; saveUI(); render(); }

/* ---- weekly volume strip for the LOG tab ----
   shows BOTH deficits and surpluses, because at 90 sets/week the fix is
   reallocation, not addition */
function volStatus() {
  const cur = muscleSetsInRange(isoDaysAgo(6), new Date().toISOString().split('T')[0]);
  const targets = VOL_TARGETS[phase] || {};
  const under = [], over = [];
  VOL_GROUPS.forEach(g => {
    const band = targets[g.key];
    if (!band) return;
    const n = cur[g.key];
    if (g.key === 'obliques') { if (n > band[1]) over.push({ g, n, band }); return; }
    if (n < band[0]) under.push({ g, n, band, gap: band[0] - n });
    else if (n >= band[1]) over.push({ g, n, band });
  });
  under.sort((a, b) => b.gap - a.gap);
  return { under, over, cur };
}

function renderVolStrip() {
  const { under, over, cur } = volStatus();
  /* nothing logged in the window: 11 zero chips is noise, say it plainly */
  const total = VOL_GROUPS.reduce((s, g) => s + (cur[g.key] || 0), 0);
  if (total === 0) {
    const last = entries.length ? entries[entries.length - 1].date : null;
    return '<div class="vol-strip" style="border:1px solid rgba(255,255,255,0.08);border-radius:6px;' +
      'padding:8px 10px;margin-bottom:14px;font-size:10px;letter-spacing:0.5px;color:var(--dim);cursor:pointer"' +
      ' onclick="switchTab(\'stats\')">NO SETS IN THE LAST 7 DAYS' +
      (last ? ' · LAST LOGGED ' + formatDateFull(last).toUpperCase() : '') + '</div>';
  }
  if (!under.length && !over.length) {
    return '<div class="vol-strip" style="border:1px solid rgba(46,204,113,0.25);background:rgba(46,204,113,0.06);' +
      'border-radius:6px;padding:8px 10px;margin-bottom:14px;font-size:10px;letter-spacing:0.5px;color:var(--green)"' +
      ' onclick="switchTab(\'stats\')">✓ ALL MUSCLE GROUPS IN TARGET BAND — LAST 7 DAYS</div>';
  }
  const chip = (x, color) => '<span style="display:inline-block;margin:2px 6px 2px 0;padding:2px 6px;border-radius:4px;' +
    'background:' + color + '18;color:' + color + ';font-size:10px;white-space:nowrap">' +
    x.g.label + ' ' + x.n + '/' + x.band[0] + '–' + x.band[1] + '</span>';
  let html = '<div class="vol-strip" style="border:1px solid rgba(255,255,255,0.08);border-radius:6px;' +
    'padding:8px 10px;margin-bottom:14px;cursor:pointer" onclick="switchTab(\'stats\')">';
  if (under.length) {
    html += '<div style="margin-bottom:' + (over.length ? '6px' : '0') + '">' +
      '<span style="font-size:9px;letter-spacing:1.5px;color:var(--amber);margin-right:6px">UNDER</span>' +
      under.slice(0, 5).map(x => chip(x, '#e8b83a')).join('') +
      (under.length > 5 ? '<span style="font-size:9px;color:var(--dim)">+' + (under.length - 5) + ' more</span>' : '') +
      '</div>';
  }
  if (over.length) {
    html += '<div><span style="font-size:9px;letter-spacing:1.5px;color:#3a8ee8;margin-right:6px">AT/OVER</span>' +
      over.slice(0, 5).map(x => chip(x, '#3a8ee8')).join('') + '</div>';
  }
  html += '<div style="font-size:9px;color:rgba(255,255,255,0.3);margin-top:6px;letter-spacing:0.5px">' +
    'LAST 7 DAYS · ' + (PHASE_META[phase] || {}).label + ' TARGETS · TAP FOR DETAIL</div></div>';
  return html;
}

function renderStats(c) {
  const today = new Date().toISOString().split('T')[0];
  const pmv = PHASE_META[phase];
  const volToggle =
    '<button class="map-mode-btn' + (statsVolMode === 'muscle' ? ' active' : '') + '" onclick="setStatsVolMode(\'muscle\')">MUSCLE</button> ' +
    '<button class="map-mode-btn' + (statsVolMode === 'split' ? ' active' : '') + '" onclick="setStatsVolMode(\'split\')">SPLIT</button>';
  let volHTML = '', volTitle = '', volSub = '';

  if (statsVolMode === 'muscle') {
    volTitle = 'WEEKLY VOLUME — FRACTIONAL SETS PER MUSCLE';
    volSub = 'targets: <span style="color:' + pmv.color + '">' + pmv.label + '</span> phase · primary set = 1, secondary = ½ · last 7 days vs previous in parentheses · both profiles · shaded zone = target band';
    const cur = muscleSetsInRange(isoDaysAgo(6), today);
    const prev = muscleSetsInRange(isoDaysAgo(13), isoDaysAgo(7));
    const targets = VOL_TARGETS[phase];
    const scaleMax = Math.max(
      ...VOL_GROUPS.map(g => cur[g.key]),
      ...VOL_GROUPS.map(g => (targets[g.key] ? targets[g.key][1] : 0)),
      10) * 1.08;
    VOL_GROUPS.forEach(g => {
      const n = cur[g.key], p = prev[g.key], diff = Math.round((n - p) * 10) / 10;
      const band = targets[g.key];
      let color = 'rgba(255,255,255,0.28)', note = '';
      if (band) {
        const [lo, hi] = band;
        if (g.key === 'obliques') {
          if (n > hi) { color = 'var(--amber)'; note = 'over cap'; }
          else { color = 'var(--green)'; note = ''; }
        } else if (n < lo) { color = 'var(--amber)'; note = 'under'; }
        else if (n > hi) { color = '#3a8ee8'; note = 'over'; }
        else { color = 'var(--green)'; note = ''; }
      }
      const w = Math.min(100, Math.round((n / scaleMax) * 100));
      const bandDiv = band
        ? '<div class="vol-band" style="left:' + Math.round((band[0] / scaleMax) * 100) + '%;width:' +
          Math.max(1, Math.round(((band[1] - band[0]) / scaleMax) * 100)) + '%"></div>'
        : '';
      const diffStr = diff === 0 ? '±0' : (diff > 0 ? '+' + diff : String(diff));
      volHTML += '<div class="vol-row">' +
        '<span class="vol-name" style="color:' + (band ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.3)') + '">' + g.label + '</span>' +
        '<div class="vol-bar-wrap">' + bandDiv + '<div class="vol-bar" style="width:' + w + '%;background:' + color + '"></div></div>' +
        '<span class="vol-count">' + n + (band ? ' / ' + band[0] + '–' + band[1] : '') +
        ' <span style="color:rgba(255,255,255,0.25)">(' + diffStr + ')</span>' +
        (note ? '<br><span style="font-size:8px;color:' + color + ';letter-spacing:1px">' + note.toUpperCase() + '</span>' : '') +
        '</span></div>';
    });
  } else {
    volTitle = 'WEEKLY VOLUME — SETS PER SPLIT';
    volSub = 'last 7 days vs previous in parentheses · ' + (currentProfile === 'home' ? 'Home' : 'Gym') + ' profile mapping';
    const cur = setsInRange(isoDaysAgo(6), today);
    const prev = setsInRange(isoDaysAgo(13), isoDaysAgo(7));
    const maxSets = Math.max(1, ...SPLIT_ORDER.map(s => cur[s]));
    SPLIT_ORDER.forEach(s => {
      const n = cur[s], p = prev[s], diff = n - p;
      const w = Math.round((n / maxSets) * 100);
      const diffStr = diff === 0 ? '±0' : (diff > 0 ? '+' + diff : String(diff));
      volHTML += '<div class="vol-row">' +
        '<span class="vol-name" style="color:' + SPLIT_COLORS[s] + '">' + s.toUpperCase() + '</span>' +
        '<div class="vol-bar-wrap"><div class="vol-bar" style="width:' + w + '%;background:' + SPLIT_COLORS[s] + '"></div></div>' +
        '<span class="vol-count">' + n + ' sets <span style="color:rgba(255,255,255,0.25)">(' + diffStr + ')</span></span></div>';
    });
  }

  /* ---- consistency heatmap (last 17 weeks, all profiles) ---- */
  const dayMap = {};
  entries.forEach(e => {
    const d = dayMap[e.date] = dayMap[e.date] || { exs: new Set(), phases: {}, splits: new Set() };
    d.exs.add(e.exercise);
    if (e.phase) d.phases[e.phase] = (d.phases[e.phase] || 0) + 1;
    if (e.cardio) { d.splits.add('Cardio'); return; }
    const sp = exToSplit(e.exercise);
    if (sp) d.splits.add(sp);
  });
  function hexToRgba(hex, a) {
    const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
  }
  const end = new Date(); end.setHours(12, 0, 0, 0);
  const start = new Date(end); start.setDate(start.getDate() - 118);
  start.setDate(start.getDate() - start.getDay()); /* back to Sunday */
  const cell = 11, gap = 3;
  const days = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) days.push(new Date(d));
  const weeks = Math.ceil(days.length / 7);
  const hW = 30 + weeks * (cell + gap), hH = 20 + 7 * (cell + gap);
  let cells = '', monthLabels = '', lastMonth = -1;
  const monthsShort = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  days.forEach((d, i) => {
    const col = Math.floor(i / 7), row = d.getDay();
    const iso = d.toISOString().split('T')[0];
    const day = dayMap[iso];
    const n = day ? day.exs.size : 0;
    let fill = 'rgba(255,255,255,0.04)', tip = iso;
    if (n > 0) {
      /* color = dominant phase tag that day; opacity = exercise count */
      let dayPhase = null, best = 0;
      Object.entries(day.phases).forEach(([p, cnt]) => { if (cnt > best) { best = cnt; dayPhase = p; } });
      const baseHex = dayPhase && PHASE_META[dayPhase] ? PHASE_META[dayPhase].color : '#9aa0a6';
      const alpha = n === 1 ? 0.3 : n <= 3 ? 0.55 : n <= 5 ? 0.78 : 1;
      fill = hexToRgba(baseHex, alpha);
      const splitStr = day.splits.size ? [...day.splits].join(' / ') : null;
      tip = iso + ' · ' + n + ' exercise' + (n === 1 ? '' : 's') +
        (splitStr ? ' · ' + splitStr : '') +
        (dayPhase && PHASE_META[dayPhase] ? ' · ' + PHASE_META[dayPhase].label : '');
    }
    const cx = 30 + col * (cell + gap), cy = 20 + row * (cell + gap);
    cells += '<rect x="' + cx + '" y="' + cy + '" width="' + cell + '" height="' + cell + '" rx="2" fill="' + fill + '"><title>' + tip + '</title></rect>';
    if (row === 0 && d.getMonth() !== lastMonth) {
      lastMonth = d.getMonth();
      monthLabels += '<text x="' + cx + '" y="12" fill="rgba(255,255,255,0.3)" font-size="9">' + monthsShort[lastMonth] + '</text>';
    }
  });
  const dayLbls = [[1,'M'],[3,'W'],[5,'F']].map(([r, l]) =>
    '<text x="18" y="' + (20 + r * (cell + gap) + 9) + '" fill="rgba(255,255,255,0.25)" font-size="8" text-anchor="middle">' + l + '</text>').join('');
  const heatHTML = '<div class="heat-wrap"><svg viewBox="0 0 ' + hW + ' ' + hH + '" width="' + hW + '" height="' + hH + '" style="display:block">' +
    monthLabels + dayLbls + cells + '</svg></div>';

  /* ---- phase-aware watch (stall / retention / drift) ---- */
  const pm = PHASE_META[phase];
  let watchTitle = '', watchSub = '', stallHTML = '';

  if (phase === 'cut') {
    watchTitle = 'RETENTION WATCH';
    watchSub = 'cut since ' + formatDateFull(phaseSince) + ' · flags lifts more than 10% below their pre-cut best — some strength dip is normal in a deficit';
    let held = 0, total = 0;
    getAllExercises().forEach(ex => {
      if (isCardio(ex)) return;
      const data = entries.filter(e => e.exercise === ex).sort((a, b) => a.date.localeCompare(b.date));
      const inPhase = data.filter(e => e.date >= phaseSince);
      const baseline = prePhaseBaseline(ex);
      if (!inPhase.length || !baseline) return;
      total++;
      const bestRecent = Math.max(...inPhase.slice(-4).map(e => e.e1rm));
      if (bestRecent >= baseline * 0.9) { held++; return; }
      const pct = Math.round((1 - bestRecent / baseline) * 1000) / 10;
      stallHTML += '<div class="stall-row" style="border-color:rgba(232,184,58,0.25)">' +
        '<div class="stall-name">' + esc(ex) + '</div>' +
        '<div class="stall-detail">Down ' + pct + '% — best this cut ' + bestRecent + ' lb vs pre-cut best ' + baseline + ' lb' +
        '</div></div>';
    });
    if (total > 0) {
      stallHTML = '<div class="stats-sub" style="margin:0 0 12px;color:' + pm.color + '">' +
        held + ' of ' + total + ' lifts holding within 10% of pre-cut bests</div>' + stallHTML;
      if (held === total) stallHTML += '<div class="empty" style="padding:24px">All lifts holding. That\'s a successful cut.</div>';
    } else {
      stallHTML = '<div class="empty" style="padding:24px">No lifts with both pre-cut and in-cut data yet.</div>';
    }
  } else if (phase === 'maintain') {
    watchTitle = 'DRIFT WATCH';
    watchSub = 'maintenance since ' + formatDateFull(phaseSince) + ' · holding steady is the goal — flags only lifts more than 5% below their best';
    getAllExercises().forEach(ex => {
      if (isCardio(ex)) return;
      const data = entries.filter(e => e.exercise === ex).sort((a, b) => a.date.localeCompare(b.date));
      if (data.length < 5) return;
      const last4 = data.slice(-4);
      const best4 = Math.max(...last4.map(e => e.e1rm));
      const prVal = Math.max(...data.map(e => e.e1rm));
      if (best4 >= prVal * 0.95) return;
      const pct = Math.round((1 - best4 / prVal) * 1000) / 10;
      stallHTML += '<div class="stall-row">' +
        '<div class="stall-name">' + esc(ex) + '</div>' +
        '<div class="stall-detail">Down ' + pct + '% from PR ' + prVal + ' lb · recent best ' + best4 + ' lb' +
        '</div></div>';
    });
    if (!stallHTML) stallHTML = '<div class="empty" style="padding:24px">Everything within 5% of its best. Maintenance on track.</div>';
  } else {
    watchTitle = 'STALL WATCH';
    watchSub = (phase === 'leangain' ? 'lean gain since ' : 'bulking since ') + formatDateFull(phaseSince) + ' · exercises with 5+ sessions whose best recent e1RM hasn\'t beaten an older PR — informational, not a problem during a deliberate ramp-up';
    getAllExercises().forEach(ex => {
      if (isCardio(ex)) return;
      const data = entries.filter(e => e.exercise === ex).sort((a, b) => a.date.localeCompare(b.date));
      if (data.length < 5) return;
      const last4 = data.slice(-4), prior = data.slice(0, -4);
      const best4 = Math.max(...last4.map(e => e.e1rm));
      const bestPrior = Math.max(...prior.map(e => e.e1rm));
      if (best4 > bestPrior) return;
      const prVal = Math.max(...data.map(e => e.e1rm));
      const prEntry = data.find(e => e.e1rm === prVal);
      const since = data.length - 1 - data.indexOf(prEntry);
      stallHTML += '<div class="stall-row">' +
        '<div class="stall-name">' + esc(ex) + '</div>' +
        '<div class="stall-detail">No avg e1RM improvement in last 4 sessions · PR ' + prVal + ' lb on ' + formatDateFull(prEntry.date) +
        ' · ' + since + ' session' + (since === 1 ? '' : 's') + ' since' +
        '</div></div>';
    });
    if (!stallHTML) stallHTML = '<div class="empty" style="padding:24px">Nothing stalled. Keep going.</div>';
  }

  /* ---- weekly cardio (only if any cardio logged) ---- */
  let cardioHTML = '';
  if (entries.some(e => e.cardio)) {
    const cc = cardioInRange(isoDaysAgo(6), today);
    const cp = cardioInRange(isoDaysAgo(13), isoDaysAgo(7));
    const rows = [
      ['MINUTES', cc.min, cp.min, ' min'],
      ['VERT FT', cc.vert, cp.vert, ' ft']
    ];
    const maxRow = Math.max(1, cc.min, cc.vert / 40); /* rough shared scale: 40 ft ≈ 1 min of climbing */
    let rowsHTML = '';
    rows.forEach(([label, n, p, unit]) => {
      const scaled = label === 'VERT FT' ? n / 40 : n;
      const w = Math.min(100, Math.round((scaled / maxRow) * 100));
      const diff = n - p;
      const diffStr = diff === 0 ? '±0' : (diff > 0 ? '+' + diff : String(diff));
      rowsHTML += '<div class="vol-row">' +
        '<span class="vol-name" style="color:' + CARDIO_COLOR + '">' + label + '</span>' +
        '<div class="vol-bar-wrap"><div class="vol-bar" style="width:' + w + '%;background:' + CARDIO_COLOR + '"></div></div>' +
        '<span class="vol-count">' + n + unit + ' <span style="color:rgba(255,255,255,0.25)">(' + diffStr + ')</span></span></div>';
    });
    cardioHTML = '<div class="stats-section"><div class="stats-title">WEEKLY CARDIO — LAST 7 DAYS</div>' +
      '<div class="stats-sub">' + cc.n + ' session' + (cc.n === 1 ? '' : 's') + ' this week vs ' + cp.n + ' last · vs previous 7 days in parentheses</div>' +
      rowsHTML + '</div>';
  }

  c.innerHTML =
    '<div class="stats-section"><div class="stats-title" style="display:flex;align-items:center;gap:8px"><span style="flex:1">' + volTitle + '</span>' + volToggle + '</div>' +
    '<div class="stats-sub">' + volSub + '</div>' +
    volHTML + '</div>' +
    cardioHTML +
    '<div class="stats-section"><div class="stats-title">CONSISTENCY — LAST 17 WEEKS</div>' +
    '<div class="stats-sub">color = phase (' +
      Object.values(PHASE_META).map(m => '<span style="color:' + m.color + '">' + m.label.toLowerCase() + '</span>').join(' / ') +
      ' / <span style="color:#9aa0a6">untagged</span>) · brighter = more exercises · tap a cell for split + details · both profiles</div>' +
    heatHTML + '</div>' +
    '<div class="stats-section"><div class="stats-title">' + watchTitle +
    ' <span style="color:' + pm.color + ';font-weight:700">· ' + pm.label + '</span></div>' +
    '<div class="stats-sub">' + watchSub + '</div>' +
    stallHTML + '</div>';
}
