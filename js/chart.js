/* ============================================================
   SECTION: CHART TAB (tap-friendly tooltips, strain markers)
   ============================================================ */
function renderChart(c) {
  pinnedTip = null;
  const allExs = getAllExercises();
  const logged = [...new Set(entries.map(e => e.exercise))];
  const archived = logged.filter(ex => !allExs.includes(ex)).sort((a, b) => a.localeCompare(b));
  let options = allExs.map(ex => {
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
  let metricBtns = [
    { key: 'e1rm', label: 'e1RM' }, { key: 'volume', label: 'VOLUME' }, { key: 'weight', label: 'WEIGHT' }
  ].map(m => {
    const a = chartMetric === m.key;
    return '<button class="metric-btn" onclick="setMetric(\'' + m.key + '\')" style="' +
      (a ? 'border-color:' + color + ';background:' + color + '15;color:' + color : '') +
      '">' + m.label + '</button>';
  }).join('');
  const data = entries.filter(e => e.exercise === chartExercise).sort((a, b) => a.date.localeCompare(b.date));
  let chartHTML = '', statsHTML = '';
  if (data.length > 0) {
    chartHTML = '<div class="chart-box">' + buildSVGChart(data, chartMetric, color) + '</div>';
    const pr = Math.max(...data.map(e => e.e1rm));
    const latest = data[data.length - 1];
    statsHTML = '<div class="stats-grid">' +
      '<div class="stat-card"><div class="stat-label">PR AVG e1RM</div><div class="stat-value">' + pr + ' lb</div></div>' +
      '<div class="stat-card"><div class="stat-label">LATEST</div><div class="stat-value">' + latest.weight + 'lb · ' + esc(setsShort(latest)) + '</div></div>' +
      '<div class="stat-card"><div class="stat-label">ENTRIES</div><div class="stat-value">' + data.length + '</div></div></div>';
  } else {
    chartHTML = '<div class="empty">No data for ' + esc(chartExercise) + ' yet.<br><span style="font-size:11px">Log some sets to see your progress.</span></div>';
  }
  c.innerHTML =
    '<div style="margin-bottom:16px"><label class="label">EXERCISE</label>' +
    '<select class="select" onchange="chartExercise=this.value;selectedExercise=this.value;render()">' + options + '</select></div>' +
    '<div class="metric-btns">' + metricBtns + '</div>' +
    (splitName ? '<div class="split-tag" style="background:' + color + '15;border:1px solid ' + color + '30;color:' + color + '">' + esc(splitName.toUpperCase()) + '</div>' : '') +
    chartHTML + statsHTML +
    (data.length ? '<div class="map-hint" style="margin-top:10px">Tap a point to pin its details · red ring = strain flagged</div>' : '');
}

function setMetric(m) { chartMetric = m; render(); }

function buildSVGChart(data, metric, color) {
  const W = 620, H = 360;
  const pad = { top: 90, right: 30, bottom: 40, left: 55 };
  const cw = W - pad.left - pad.right, ch = H - pad.top - pad.bottom;
  const values = data.map(d => metric === 'e1rm' ? d.e1rm : metric === 'volume' ? d.volume : d.weight);
  let minV = Math.min(...values), maxV = Math.max(...values);
  if (minV === maxV) { minV -= 10; maxV += 10; }
  const rv = maxV - minV, pv = rv * 0.1; minV -= pv; maxV += pv;
  function x(i) { return pad.left + (data.length === 1 ? cw / 2 : (i / (data.length - 1)) * cw); }
  function y(v) { return pad.top + ch - ((v - minV) / (maxV - minV)) * ch; }
  let gridSVG = '';
  for (let i = 0; i <= 5; i++) {
    const gy = pad.top + (i / 5) * ch;
    const gv = Math.round(maxV - (i / 5) * (maxV - minV));
    gridSVG += '<line x1="' + pad.left + '" y1="' + gy + '" x2="' + (W - pad.right) + '" y2="' + gy + '" stroke="rgba(255,255,255,0.06)" stroke-dasharray="3,3"/>';
    gridSVG += '<text x="' + (pad.left - 8) + '" y="' + (gy + 3) + '" fill="rgba(255,255,255,0.3)" font-size="10" text-anchor="end">' + gv.toLocaleString() + '</text>';
  }
  let xlabels = '';
  const step = Math.max(1, Math.ceil(data.length / 12));
  data.forEach((d, i) => {
    if (i % step === 0 || i === data.length - 1)
      xlabels += '<text x="' + x(i) + '" y="' + (H - pad.bottom + 20) + '" fill="rgba(255,255,255,0.3)" font-size="10" text-anchor="middle">' + formatDate(d.date) + '</text>';
  });
  let path = '';
  data.forEach((d, i) => { path += (i === 0 ? 'M' : 'L') + x(i).toFixed(1) + ',' + y(values[i]).toFixed(1); });
  const area = path + ' L' + x(data.length - 1).toFixed(1) + ',' + (pad.top + ch) + ' L' + x(0).toFixed(1) + ',' + (pad.top + ch) + ' Z';
  let dots = '';
  data.forEach((d, i) => {
    dots += '<circle cx="' + x(i).toFixed(1) + '" cy="' + y(values[i]).toFixed(1) + '" r="4" fill="' + color + '"/>';
    if (d.strain) dots += '<circle cx="' + x(i).toFixed(1) + '" cy="' + y(values[i]).toFixed(1) + '" r="7" fill="none" stroke="var(--red)" stroke-width="1.5"/>';
  });
  let prLine = '';
  if (metric === 'e1rm') {
    const pr = Math.max(...values), pry = y(pr);
    prLine = '<line x1="' + pad.left + '" y1="' + pry + '" x2="' + (W - pad.right) + '" y2="' + pry + '" stroke="rgba(46,204,113,0.4)" stroke-dasharray="4,4"/>' +
      '<text x="' + (W - pad.right + 4) + '" y="' + (pry + 3) + '" fill="rgba(46,204,113,0.6)" font-size="9">PR Avg: ' + pr + '</text>';
  }
  chartTipData = data.map((d, i) => {
    const val = values[i];
    const ml = metric === 'e1rm' ? 'Avg e1RM: ' + d.e1rm : metric === 'volume' ? 'Vol: ' + d.volume.toLocaleString() : 'Weight: ' + d.weight;
    return {
      date: formatDateFull(d.date),
      detail: d.weight + 'lb · ' + setsShort(d) + (d.strain ? ' · STRAIN' : ''),
      value: ml,
      sets: getSetE1RMs(d).map((e, j) => 'S' + (j + 1) + ':' + e).join('  '),
      cx: x(i), cy: y(val)
    };
  });
  let hoverAreas = '';
  data.forEach((d, i) => {
    const halfW = data.length === 1 ? cw / 2 : cw / (data.length - 1) / 2;
    hoverAreas += '<rect x="' + (x(i) - halfW) + '" y="' + pad.top + '" width="' + (halfW * 2) + '" height="' + ch + '" fill="transparent" style="cursor:pointer"' +
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
