/**
 * Custom responsive SVG clinical charts (Weight & BMI trend + Vital sparklines)
 * Supports Bilingual (zh / en) and Dual Unit Systems (Metric kg/cm <-> US lbs/ft-in).
 */
import { formatDisplayDate, formatWeightValue, pickText, t } from './i18n.js';

export function computeBmi(weightKg, heightCm, lang = 'zh') {
  if (!weightKg || !heightCm) return null;
  const m = heightCm / 100;
  const bmi = weightKg / (m * m);
  const dict = t(lang).bmiLabels;
  // Standard clinical thresholds (Asian reference for ZH, US standard for EN)
  const overCutoff = lang === 'en' ? 25.0 : 24.0;
  const obeseCutoff = lang === 'en' ? 30.0 : 28.0;
  let label = dict.normal;
  let tone = 'good';
  if (bmi < 18.5) {
    label = dict.under;
    tone = 'warn';
  } else if (bmi >= obeseCutoff) {
    label = dict.obese;
    tone = 'alert';
  } else if (bmi >= overCutoff) {
    label = dict.over;
    tone = 'warn';
  }
  return { value: Number(bmi.toFixed(1)), label, tone };
}

export function filterWeightsByRange(weights, rangeDays = 90) {
  const sorted = [...(weights || [])].sort((a, b) => a.date.localeCompare(b.date));
  if (!sorted.length || rangeDays === 'all') return sorted;
  const latestMs = new Date(sorted[sorted.length - 1].date + 'T00:00:00').getTime();
  const cutoff = latestMs - rangeDays * 86400 * 1000;
  const filtered = sorted.filter((w) => new Date(w.date + 'T00:00:00').getTime() >= cutoff);
  return filtered.length >= 2 ? filtered : sorted.slice(-Math.min(sorted.length, 4));
}

export function summarizeWeightStats(weights, heightCm, lang = 'zh') {
  if (!weights || !weights.length) return null;
  const sorted = [...weights].sort((a, b) => a.date.localeCompare(b.date));
  const first = sorted[0];
  const latest = sorted[sorted.length - 1];
  const deltaKg = Number((latest.weightKg - first.weightKg).toFixed(1));
  const deltaPct = first.weightKg ? Number(((deltaKg / first.weightKg) * 100).toFixed(1)) : 0;
  const bmi = computeBmi(latest.weightKg, heightCm, lang);
  const significantLoss = deltaPct <= -5;
  return {
    first,
    latest,
    deltaKg,
    deltaPct,
    bmi,
    significantLoss
  };
}

export function renderWeightChartSvg(weights, heightCm, selectedIdx = null, lang = 'zh', unitSystem = 'metric') {
  if (!weights || weights.length === 0) {
    return `<div class="empty-box">${lang === 'en' ? 'No weight entries yet' : '暂无体重记录，请解锁后添加'}</div>`;
  }
  const sorted = [...weights].sort((a, b) => a.date.localeCompare(b.date));
  const activeIdx = selectedIdx !== null && selectedIdx < sorted.length ? selectedIdx : sorted.length - 1;

  const W = 340;
  const H = 166;
  const padL = 40;
  const padR = 14;
  const padT = 18;
  const padB = 28;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const displayPoints = sorted.map((d) => ({
    ...d,
    dispVal: formatWeightValue(d.weightKg, unitSystem).rawNum
  }));

  const vals = displayPoints.map((d) => d.dispVal);
  const rawMin = Math.min(...vals);
  const rawMax = Math.max(...vals);
  const spread = Math.max(rawMax - rawMin, unitSystem === 'us' ? 4 : 2);
  const minY = Math.floor((rawMin - spread * 0.22) * 2) / 2;
  const maxY = Math.ceil((rawMax + spread * 0.22) * 2) / 2;
  const rangeY = Math.max(maxY - minY, 1);

  const coords = displayPoints.map((d, i) => {
    const x = displayPoints.length === 1 ? padL + plotW / 2 : padL + (i / (displayPoints.length - 1)) * plotW;
    const y = padT + (1 - (d.dispVal - minY) / rangeY) * plotH;
    return { x, y, ...d };
  });

  const gridLines = [0, 0.5, 1].map((tStep) => {
    const val = (minY + (1 - tStep) * rangeY).toFixed(1);
    const y = padT + tStep * plotH;
    return `
      <line x1="${padL}" y1="${y.toFixed(1)}" x2="${W - padR}" y2="${y.toFixed(1)}" stroke="#E2E8F0" stroke-dasharray="3 3" stroke-width="1"/>
      <text x="${padL - 6}" y="${(y + 3.5).toFixed(1)}" text-anchor="end" font-size="10" fill="#64748B" class="tabular">${val}</text>
    `;
  });

  const linePts = coords.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const areaPath =
    coords.length > 1
      ? `M${coords[0].x.toFixed(1)},${(padT + plotH).toFixed(1)} ` +
        coords.map((p) => `L${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') +
        ` L${coords[coords.length - 1].x.toFixed(1)},${(padT + plotH).toFixed(1)} Z`
      : '';

  const tickIndices =
    coords.length <= 2
      ? coords.map((_, i) => i)
      : [0, Math.floor((coords.length - 1) / 2), coords.length - 1];

  const xLabels = tickIndices.map((idx) => {
    const p = coords[idx];
    const shortDate = lang === 'en' ? `${p.date.slice(5, 7)}/${p.date.slice(8, 10)}` : p.date.slice(5);
    const anchor = idx === 0 ? 'start' : idx === coords.length - 1 ? 'end' : 'middle';
    return `<text x="${p.x.toFixed(1)}" y="${H - 6}" text-anchor="${anchor}" font-size="10" fill="#64748B" class="tabular">${shortDate}</text>`;
  });

  const activePt = coords[activeIdx];
  const activeBmi = computeBmi(activePt.weightKg, heightCm, lang);
  const unitLabel = unitSystem === 'us' ? 'lbs' : 'kg';
  const noteTxt = pickText(activePt, 'note', lang);

  const dots = coords.map((p, i) => {
    const isActive = i === activeIdx;
    return `
      <g class="chart-point" data-weight-idx="${i}" style="cursor:pointer;">
        <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="12" fill="transparent"/>
        ${isActive ? `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="6.5" fill="#0F62FE" fill-opacity="0.18"/>` : ''}
        <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${isActive ? 4.2 : 3}" fill="${isActive ? '#0F62FE' : '#FFFFFF'}" stroke="#0F62FE" stroke-width="${isActive ? 2 : 1.8}"/>
      </g>
    `;
  });

  return `
    <div class="chart-tooltip-bar">
      <span class="tabular"><strong>${formatDisplayDate(activePt.date, lang)}</strong> · <strong>${activePt.dispVal.toFixed(1)} ${unitLabel}</strong>${activeBmi ? ` · BMI ${activeBmi.value}` : ''}</span>
      ${noteTxt ? `<span class="chart-note-pill">${escapeHtml(noteTxt)}</span>` : `<span class="muted-xs">${lang === 'en' ? 'Tap point for details' : '点击数据点查看详情'}</span>`}
    </div>
    <svg viewBox="0 0 ${W} ${H}" class="weight-svg" role="img" aria-label="Weight Trend Chart">
      <defs>
        <linearGradient id="wtGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#0F62FE" stop-opacity="0.22"/>
          <stop offset="100%" stop-color="#0F62FE" stop-opacity="0.01"/>
        </linearGradient>
      </defs>
      ${gridLines.join('')}
      ${areaPath ? `<path d="${areaPath}" fill="url(#wtGrad)"/>` : ''}
      ${coords.length > 1 ? `<polyline fill="none" stroke="#0F62FE" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" points="${linePts}"/>` : ''}
      <line x1="${activePt.x.toFixed(1)}" y1="${padT}" x2="${activePt.x.toFixed(1)}" y2="${padT + plotH}" stroke="#93C5FD" stroke-dasharray="2 2" stroke-width="1"/>
      ${xLabels.join('')}
      ${dots.join('')}
    </svg>
  `;
}

export function renderVitalSparkline(items, type) {
  const sorted = [...(items || [])].sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length < 2) return '';
  const W = 120;
  const H = 34;
  const pad = 4;

  const vals1 = sorted.map((d) => Number(d.value1));
  const vals2 = type === 'bp' ? sorted.map((d) => Number(d.value2)) : [];
  const all = [...vals1, ...vals2].filter((n) => !Number.isNaN(n));
  const min = Math.min(...all);
  const max = Math.max(...all);
  const range = Math.max(max - min, 1);

  const toPoints = (arr) =>
    arr
      .map((v, i) => {
        const x = pad + (i / (arr.length - 1)) * (W - pad * 2);
        const y = pad + (1 - (v - min) / range) * (H - pad * 2);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');

  const color1 = type === 'hr' ? '#E11D48' : type === 'glucose' ? '#D97706' : type === 'temp' ? '#059669' : '#0F62FE';
  const line1 = toPoints(vals1);
  const line2 = type === 'bp' ? toPoints(vals2) : '';

  return `
    <svg viewBox="0 0 ${W} ${H}" class="sparkline-svg" aria-hidden="true">
      ${line2 ? `<polyline fill="none" stroke="#93C5FD" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" points="${line2}"/>` : ''}
      <polyline fill="none" stroke="${color1}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" points="${line1}"/>
    </svg>
  `;
}

export function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
