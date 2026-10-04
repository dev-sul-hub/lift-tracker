/* ============================================================
   SECTION: CHART TAB (tap-friendly tooltips, time-based x axis)
   ============================================================ */
function renderChart(c) {
  pinnedTip = null;
  if (chartExercise === BW_KEY) { renderBWChart(c); return; }
  const allExs = [...new Set([...getAllExercises(), ...getCardioExercises()])].sort((a, b) => a.localeCompare(b));
  const logged = [...new Set(entries.map(e => e.exercise))];
  const archived = logged.filter(ex => !allExs.includes(ex)).sort((a, b) => a.localeCompare(b));
  const cardio = isCardio(chartExercise);
  if (cardio && !['vert', 'duration', 'speed'].includes(chartMetric)) chartMetric = 'vert';
  if (!cardio && !['e1rm', 'volume', 'weight'].includes(chartMetric)) chartMetric = 'e1rm';
  let options = '<optgroup label="— BODY —"><option value="' + BW_KEY + '"' +
    (chartExercise === BW_KEY ? ' selected' : '') + '>BODYWEIGHT (' + bwLog.length + ')</option></optgroup>';
  options += allExs.map(ex => {
    const count = entries.filter(e => e.exercise === ex).length;
    return '<option value="' + esc(ex) + '"' + (ex === chartExercise ? ' selected' : '') + '>' +
      esc(ex) + (count > 0 ? ' (' + count + ')' : '') + '</option>';
  }).join('');
  if (archived.length) {
    options += '<optgroup label="— NOT IN CURRENT SPLITS —">' + archived.map(ex => {
      const count = entries.filter(e => e.exercise === ex).length;
      return '<option value="' + esc(ex) + '"' + (ex === chartExercise ? ' selected' : '') + '>' +
        esc(ex) + ' (' + count + ')</option>';
    }).join('') + '</optgroup>';
  }
  const color = getSplitColor(chartExercise);
  const splitName = getSplitName(chartExercise);
  let metricBtns = (cardio
    ? [{ key: 'vert', label: 'VERT FT' }, { key: 'duration', label: 'MINUTES' }, { key: 'speed', label: 'MPH' }]
    : [{ key: 'e1rm', label: 'e1RM' }, { key: 'volume', label: 'VOLUME' }, { key: 'weight', label: 'WEIGHT' }]
  ).map(m => {
    const a = chartMetric === m.key;
    return '<button class="metric-btn" onclick="setMetric(\'' + m.key + '\')" style="' +
      (a ? 'border-color:' + color + ';background:' + color + '15;color:' + color : '') +
      '">' + m.label + '</button>';
  }).join('');
  const data = entries.filter(e => e.exercise === chartExercise).sort((a, b) => a.date.localeCompare(b.date));
  let chartHTML = '', statsHTML = '';
  if (data.length > 0) {
    chartHTML = '<div class="chart-box">' + buildSVGChart(data, chartMetric, color) + '</div>';
    const latest = data[data.length - 1];
    if (cardio) {
      const prVert = Math.max(...data.map(e => e.vert || 0));
      statsHTML = '<div class="stats-grid">' +
        '<div class="stat-card"><div class="stat-label">PR VERT FT</div><div class="stat-value">' + prVert + '</div></div>' +
        '<div class="stat-card"><div class="stat-label">LATEST</div><div class="stat-value">' + latest.minutes + 'min @ ' + latest.incline + '%</div></div>' +
        '<div class="stat-card"><div class="stat-label">ENTRIES</div><div class="stat-value">' + data.length + '</div></div></div>';
    } else {
      const pr = Math.max(...data.map(e => e.e1rm));
      statsHTML = '<div class="stats-grid">' +
        '<div class="stat-card"><div class="stat-label">PR AVG e1RM</div><div class="stat-value">' + pr + ' lb</div></div>' +
        '<div class="stat-card"><div class="stat-label">LATEST</div><div class="stat-value">' + latest.weight + 'lb · ' + esc(setsShort(latest)) + '</div></div>' +
        '<div class="stat-card"><div class="stat-label">ENTRIES</div><div class="stat-value">' + data.length + '</div></div></div>';
    }
  } else {
    chartHTML = '<div class="empty">No data for ' + esc(chartExercise) + ' yet.<br><span style="font-size:11px">Log some sets to see your progress.</span></div>';
  }
  c.innerHTML =
    '<div style="margin-bottom:16px"><label class="label">EXERCISE</label>' +
    '<select class="select" onchange="chartPicked(this.value)">' + options + '</select></div>' +
    '<div class="metric-btns">' + metricBtns + '</div>' +
    (splitName ? '<div class="split-tag" style="background:' + color + '15;border:1px solid ' + color + '30;color:' + color + '">' + esc(splitName.toUpperCase()) + '</div>' : '') +
    chartHTML + statsHTML +
    (data.length ? '<div class="map-hint" style="margin-top:10px">Tap a point to pin its details · x-axis is real elapsed time, so gaps show as gaps</div>' : '');
}

function setMetric(m) { chartMetric = m; render(); }

function buildSVGChart(data, metric, color) {
  const W = 620, H = 360;
  const pad = { top: 90, right: 30, bottom: 40, left: 55 };
  const cw = W - pad.left - pad.right, ch = H - pad.top - pad.bottom;
  const cardio = data.length > 0 && !!data[0].cardio;
  const values = data.map(d => cardio
    ? (metric === 'vert' ? (d.vert || 0) : metric === 'duration' ? d.minutes : d.mph)
    : (metric === 'e1rm' ? d.e1rm : metric === 'volume' ? d.volume : d.weight));
  let minV = Math.min(...values), maxV = Math.max(...values);
  if (minV === maxV) { minV -= 10; maxV += 10; }
  const rv = maxV - minV, pv = rv * 0.1; minV -= pv; maxV += pv;
  /* positions are proportional to elapsed time, not array index */
  const ts = data.map(d => new Date(d.date + 'T12:00:00').getTime());
  const t0 = ts[0], tSpan = Math.max(1, ts[ts.length - 1] - t0);
  const xs = data.map((d, i) => data.length === 1 ? pad.left + cw / 2 : pad.left + ((ts[i] - t0) / tSpan) * cw);
  function x(i) { return xs[i]; }
  function y(v) { return pad.top + ch - ((v - minV) / (maxV - minV)) * ch; }
  let gridSVG = '';
  for (let i = 0; i <= 5; i++) {
    const gy = pad.top + (i / 5) * ch;
    const raw = maxV - (i / 5) * (maxV - minV);
    const gv = (maxV - minV) < 10 ? Math.round(raw * 10) / 10 : Math.round(raw);
    gridSVG += '<line x1="' + pad.left + '" y1="' + gy + '" x2="' + (W - pad.right) + '" y2="' + gy + '" stroke="rgba(255,255,255,0.06)" stroke-dasharray="3,3"/>';
    gridSVG += '<text x="' + (pad.left - 8) + '" y="' + (gy + 3) + '" fill="rgba(255,255,255,0.3)" font-size="10" text-anchor="end">' + gv.toLocaleString() + '</text>';
  }
  let xlabels = '';
  let lastLabelX = -999;
  data.forEach((d, i) => {
    const px = x(i);
    if (px - lastLabelX < 48 && i !== data.length - 1) return;
    if (i === data.length - 1 && px - lastLabelX < 30) return;
    lastLabelX = px;
    xlabels += '<text x="' + px.toFixed(1) + '" y="' + (H - pad.bottom + 20) + '" fill="rgba(255,255,255,0.3)" font-size="10" text-anchor="middle">' + formatDate(d.date) + '</text>';
  });
  let path = '';
  data.forEach((d, i) => { path += (i === 0 ? 'M' : 'L') + x(i).toFixed(1) + ',' + y(values[i]).toFixed(1); });
  const area = path + ' L' + x(data.length - 1).toFixed(1) + ',' + (pad.top + ch) + ' L' + x(0).toFixed(1) + ',' + (pad.top + ch) + ' Z';
  let dots = '';
  data.forEach((d, i) => {
    dots += '<circle cx="' + x(i).toFixed(1) + '" cy="' + y(values[i]).toFixed(1) + '" r="4" fill="' + color + '"/>';
  });
  let prLine = '';
  if (metric === 'e1rm' || metric === 'vert') {
    const pr = Math.max(...values), pry = y(pr);
    prLine = '<line x1="' + pad.left + '" y1="' + pry + '" x2="' + (W - pad.right) + '" y2="' + pry + '" stroke="rgba(46,204,113,0.4)" stroke-dasharray="4,4"/>' +
      '<text x="' + (W - pad.right + 4) + '" y="' + (pry + 3) + '" fill="rgba(46,204,113,0.6)" font-size="9">' + (metric === 'vert' ? 'PR Vert: ' : 'PR Avg: ') + pr + '</text>';
  }
  chartTipData = data.map((d, i) => {
    const val = values[i];
    if (cardio) {
      const ml = metric === 'vert' ? 'Vert: ' + (d.vert || 0) + ' ft' : metric === 'duration' ? 'Duration: ' + d.minutes + ' min' : 'Speed: ' + d.mph + ' mph';
      return {
        date: formatDateFull(d.date),
        detail: cardioDetail(d),
        value: ml,
        sets: (d.vert || 0) + ' vert ft · ' + cardioMiles(d) + ' mi',
        cx: x(i), cy: y(val)
      };
    }
    const ml = metric === 'e1rm' ? 'Avg e1RM: ' + d.e1rm : metric === 'volume' ? 'Vol: ' + d.volume.toLocaleString() : 'Weight: ' + d.weight;
    return {
      date: formatDateFull(d.date),
      detail: d.weight + 'lb · ' + setsShort(d) + (isCapped(d) ? ' · e1RM capped' : ''),
      value: ml,
      sets: getSetE1RMs(d).map((e, j) => 'S' + (j + 1) + ':' + e).join('  '),
      cx: x(i), cy: y(val)
    };
  });
  let hoverAreas = '';
  data.forEach((d, i) => {
    const left = i === 0 ? pad.left : (xs[i - 1] + xs[i]) / 2;
    const right = i === data.length - 1 ? (W - pad.right) : (xs[i] + xs[i + 1]) / 2;
    const w = Math.max(10, right - left);
    hoverAreas += '<rect x="' + (right - left < 10 ? xs[i] - 5 : left).toFixed(1) + '" y="' + pad.top +
      '" width="' + w.toFixed(1) + '" height="' + ch + '" fill="transparent" style="cursor:pointer"' +
      ' onclick="tipToggle(event,' + i + ')" onmouseenter="tipHover(event,' + i + ')" onmouseleave="tipLeave()"/>';
  });
  return '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" style="display:block;max-width:' + W + 'px;overflow:visible">' +
    '<defs><linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">' +
    '<stop offset="0%" stop-color="' + color + '" stop-opacity="0.15"/><stop offset="100%" stop-color="' + color + '" stop-opacity="0.01"/>' +
    '</linearGradient></defs>' +
    gridSVG + xlabels +
    '<path d="' + area + '" fill="url(#areaGrad)"/>' +
    '<path d="' + path + '" fill="none" stroke="' + color + '" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>' +
    prLine + dots + hoverAreas +
    '<g id="tooltip" style="display:none;pointer-events:none">' +
    '<rect id="tipBg" rx="5" fill="#1a1a1c" stroke="rgba(255,255,255,0.15)" stroke-width="1"/>' +
    '<text id="tipLine1" fill="#fff" font-size="10" font-weight="600"></text>' +
    '<text id="tipLine2" fill="rgba(255,255,255,0.5)" font-size="9"></text>' +
    '<text id="tipLine3" fill="' + color + '" font-size="11" font-weight="700"></text>' +
    '<text id="tipLine4" fill="rgba(255,255,255,0.35)" font-size="9"></text>' +
    '<circle id="tipDot" r="6" fill="#fff" stroke="' + color + '" stroke-width="2"/>' +
    '</g></svg>';
}

function tipToggle(evt, i) {
  evt.stopPropagation();
  if (pinnedTip === i) { pinnedTip = null; hideTip(); }
  else { pinnedTip = i; showTipAt(evt.target.closest('svg'), i); }
}
function tipHover(evt, i) { if (pinnedTip === null) showTipAt(evt.target.closest('svg'), i); }
function tipLeave() { if (pinnedTip === null) hideTip(); }

function showTipAt(svg, i) {
  const d = chartTipData[i];
  if (!svg || !d) return;
  const tip = svg.querySelector('#tooltip');
  tip.style.display = 'block';
  svg.querySelector('#tipLine1').textContent = d.date;
  svg.querySelector('#tipLine2').textContent = d.detail;
  svg.querySelector('#tipLine3').textContent = d.value;
  svg.querySelector('#tipLine4').textContent = d.sets;
  const tw = 210, th = 72;
  let tx = d.cx - tw / 2;
  if (tx < 10) tx = 10; if (tx + tw > 610) tx = 610 - tw;
  let ty = d.cy - th - 16;
  if (ty < 5) ty = d.cy + 16;
  svg.querySelector('#tipBg').setAttribute('x', tx);
  svg.querySelector('#tipBg').setAttribute('y', ty);
  svg.querySelector('#tipBg').setAttribute('width', tw);
  svg.querySelector('#tipBg').setAttribute('height', th);
  ['tipLine1','tipLine2','tipLine3','tipLine4'].forEach((id, j) => {
    const el = svg.querySelector('#' + id);
    el.setAttribute('x', tx + 10);
    el.setAttribute('y', ty + [16, 30, 46, 62][j]);
  });
  svg.querySelector('#tipDot').setAttribute('cx', d.cx);
  svg.querySelector('#tipDot').setAttribute('cy', d.cy);
}

function hideTip() { document.querySelectorAll('#tooltip').forEach(t => t.style.display = 'none'); }

/* exercise picker: the bodyweight series is chart-only, never the log target */
function chartPicked(v) {
  chartExercise = v;
  if (v !== BW_KEY) selectedExercise = v;
  render();
}

/* ============================================================
   SECTION: BODYWEIGHT CHART (trailing 14d average + goal line)
   ============================================================ */
function renderBWChart(c) {
  const allExs = [...new Set([...getAllExercises(), ...getCardioExercises()])].sort((a, b) => a.localeCompare(b));
  const options = '<optgroup label="— BODY —"><option value="' + BW_KEY + '" selected>BODYWEIGHT (' + bwLog.length + ')</option></optgroup>' +
    allExs.map(ex => {
      const count = entries.filter(e => e.exercise === ex).length;
      return '<option value="' + esc(ex) + '">' + esc(ex) + (count > 0 ? ' (' + count + ')' : '') + '</option>';
    }).join('');

  let body = '', stats = '';
  if (bwLog.length < 2) {
    body = '<div class="empty">Need at least two weigh-ins to plot a trend.' +
      '<br><span style="font-size:11px">Log bodyweight on the LOG tab, or add past days under PHASE → HISTORY.</span></div>';
  } else {
    const roll = bwRolling(14);
    body = '<div class="chart-box">' + buildBWSVGChart(bwLog, roll, bwGoal) + '</div>';
    const cur = roll[roll.length - 1];
    const prevIdx = roll.findIndex(x => x.date >= isoDaysAgo(13));
    const prev = prevIdx > 0 ? roll[prevIdx - 1] : null;
    const perWk = prev ? Math.round((cur.w - prev.w) / 2 * 100) / 100 : null;
    const lo = Math.min(...bwLog.map(r => r.w)), hi = Math.max(...bwLog.map(r => r.w));
    stats = '<div class="stats-grid">' +
      '<div class="stat-card"><div class="stat-label">LATEST</div><div class="stat-value">' + latestBw() + ' lb</div></div>' +
      '<div class="stat-card"><div class="stat-label">14D AVG</div><div class="stat-value">' + cur.w + ' lb</div></div>' +
      (perWk !== null
        ? '<div class="stat-card"><div class="stat-label">RATE</div><div class="stat-value" style="color:' +
            (Math.abs(perWk) < 0.15 ? 'var(--green)' : 'var(--amber)') + '">' + (perWk > 0 ? '+' : '') + perWk + ' lb/wk</div></div>'
        : '') +
      '<div class="stat-card"><div class="stat-label">RANGE</div><div class="stat-value">' + lo + '–' + hi + '</div></div>' +
      (bwGoal ? '<div class="stat-card"><div class="stat-label">TO GOAL</div><div class="stat-value">' +
        (Math.round((cur.w - bwGoal) * 10) / 10) + ' lb</div></div>' : '') +
      '</div>';
  }

  c.innerHTML =
    '<div style="margin-bottom:16px"><label class="label">EXERCISE</label>' +
    '<select class="select" onchange="chartPicked(this.value)">' + options + '</select></div>' +
    '<div class="split-tag" style="background:' + BW_COLOR + '15;border:1px solid ' + BW_COLOR + '30;color:' + BW_COLOR + '">BODYWEIGHT</div>' +
    body + stats +
    '<div class="map-hint" style="margin-top:10px">Solid line = trailing 14-day average, the number to steer by · ' +
      'faint dots = daily weigh-ins' + (bwGoal ? ' · dashed green = goal ' + bwGoal + ' lb' : ' · set a goal under PHASE → HISTORY') + '</div>' +
    '<div class="data-btns" style="margin-top:12px"><button class="data-btn" onclick="openPhaseHistory()">⏱ EDIT WEIGH-INS</button></div>';
}

function buildBWSVGChart(rows, roll, goal) {
  const W = 620, H = 340;
  const pad = { top: 24, right: 30, bottom: 40, left: 55 };
  const cw = W - pad.left - pad.right, ch = H - pad.top - pad.bottom;
  const t0 = new Date(rows[0].date + 'T12:00:00').getTime();
  const t1 = new Date(rows[rows.length - 1].date + 'T12:00:00').getTime();
  const span = Math.max(1, t1 - t0);
  const pool = rows.map(r => r.w).concat(roll.map(r => r.w));
  if (goal > 0) pool.push(goal);
  let minV = Math.min(...pool), maxV = Math.max(...pool);
  if (minV === maxV) { minV -= 2; maxV += 2; }
  const pv = (maxV - minV) * 0.12; minV -= pv; maxV += pv;
  function x(d) { return pad.left + ((new Date(d + 'T12:00:00').getTime() - t0) / span) * cw; }
  function y(v) { return pad.top + ch - ((v - minV) / (maxV - minV)) * ch; }

  let grid = '';
  for (let i = 0; i <= 5; i++) {
    const gy = pad.top + (i / 5) * ch;
    const gv = Math.round((maxV - (i / 5) * (maxV - minV)) * 10) / 10;
    grid += '<line x1="' + pad.left + '" y1="' + gy + '" x2="' + (W - pad.right) + '" y2="' + gy +
      '" stroke="rgba(255,255,255,0.06)" stroke-dasharray="3,3"/>' +
      '<text x="' + (pad.left - 8) + '" y="' + (gy + 3) + '" fill="rgba(255,255,255,0.3)" font-size="10" text-anchor="end">' + gv + '</text>';
  }
  let xlabels = '';
  const step = Math.max(1, Math.ceil(rows.length / 10));
  rows.forEach((r, i) => {
    if (i % step === 0 || i === rows.length - 1)
      xlabels += '<text x="' + x(r.date).toFixed(1) + '" y="' + (H - pad.bottom + 20) +
        '" fill="rgba(255,255,255,0.3)" font-size="10" text-anchor="middle">' + formatDate(r.date) + '</text>';
  });

  const dots = rows.map(r =>
    '<circle cx="' + x(r.date).toFixed(1) + '" cy="' + y(r.w).toFixed(1) + '" r="2.5" fill="' + BW_COLOR + '" fill-opacity="0.38"><title>' +
    r.date + ' · ' + r.w + ' lb</title></circle>').join('');

  let line = '';
  roll.forEach((r, i) => { line += (i === 0 ? 'M' : 'L') + x(r.date).toFixed(1) + ',' + y(r.w).toFixed(1); });
  const area = line + ' L' + x(roll[roll.length - 1].date).toFixed(1) + ',' + (pad.top + ch) +
    ' L' + x(roll[0].date).toFixed(1) + ',' + (pad.top + ch) + ' Z';

  let goalLine = '';
  if (goal > 0 && goal >= minV && goal <= maxV) {
    const gy = y(goal);
    goalLine = '<line x1="' + pad.left + '" y1="' + gy + '" x2="' + (W - pad.right) + '" y2="' + gy +
      '" stroke="rgba(46,204,113,0.5)" stroke-dasharray="4,4"/>' +
      '<text x="' + (W - pad.right + 4) + '" y="' + (gy + 3) + '" fill="rgba(46,204,113,0.7)" font-size="9">' + goal + '</text>';
  }

  return '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" style="display:block;max-width:' + W + 'px;overflow:visible">' +
    '<defs><linearGradient id="bwGrad" x1="0" y1="0" x2="0" y2="1">' +
    '<stop offset="0%" stop-color="' + BW_COLOR + '" stop-opacity="0.16"/>' +
    '<stop offset="100%" stop-color="' + BW_COLOR + '" stop-opacity="0.01"/></linearGradient></defs>' +
    grid + xlabels +
    '<path d="' + area + '" fill="url(#bwGrad)"/>' +
    '<path d="' + line + '" fill="none" stroke="' + BW_COLOR + '" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>' +
    goalLine + dots + '</svg>';
}
