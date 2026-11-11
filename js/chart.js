// Grafi v SVG. Brez knjižnic: dovolj sta črtni graf skozi čas in stolpci po tednih.
import { h, fmt, fmtDay, fmtDate, fmtDayMonth, fmtDayShort } from './ui.js';
import { shiftDay, todayIso } from './store.js';

const NS = 'http://www.w3.org/2000/svg';
function s(tag, attrs = {}, ...kids) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) el.setAttribute(k, v);
  for (const k of kids) if (k) el.append(k);
  return el;
}

export const PERIODS = [
  { id: '1m', label: '1 mes', days: 31 },
  { id: '3m', label: '3 mes', days: 92 },
  { id: '1y', label: 'Leto', days: 366 },
  { id: 'all', label: 'Vse', days: null },
];

export function filterPeriod(points, periodId) {
  const p = PERIODS.find((x) => x.id === periodId);
  if (!p || !p.days) return points;
  const from = shiftDay(todayIso(), -p.days);
  return points.filter((pt) => pt.date >= from);
}

/** Segmentni izbirnik obdobja. */
export function periodControl(current, onChange) {
  return h('div', { class: 'segmented', role: 'tablist' },
    PERIODS.map((p) => h('button', {
      class: `segmented__btn${p.id === current ? ' is-on' : ''}`,
      type: 'button', role: 'tab', 'aria-selected': String(p.id === current),
      onclick: () => onChange(p.id),
    }, p.label)));
}


const dayNum = (d) => Date.parse(d + 'T12:00:00') / 86400000;

/**
 * Črtni graf kot na osnutku statistike: zgoraj velika zadnja vrednost in sprememba
 * od prve točke ("↑ 13 kg od 2. oktobra"), spodaj črta s prelivom brez osi Y in
 * brez pik, svetleča pika na zadnji vrednosti, trije datumi. Dotik pokaže točko.
 * points: [{ date: 'YYYY-MM-DD', value }], najstarejši prvi.
 */
export function lineChart(points, { unit = '', digits = 1, minSpan = 1, empty = 'Ni podatkov za to obdobje.' } = {}) {
  const wrap = h('div', { class: 'chart' });
  if (!points.length) {
    wrap.append(h('p', { class: 'chart__empty' }, empty));
    return wrap;
  }

  const W = 340, H = 150, L = 6, R = 10, T = 12, B = 26;
  const vals = points.map((p) => p.value);
  let lo = Math.min(...vals), hi = Math.max(...vals);
  if (hi - lo < minSpan) { const mid = (hi + lo) / 2; lo = mid - minSpan / 2; hi = mid + minSpan / 2; }
  const pad = (hi - lo) * 0.18;
  lo -= pad; hi += pad;

  const x0 = dayNum(points[0].date), x1 = dayNum(points[points.length - 1].date);
  const xs = (d) => (x1 === x0 ? L + (W - L - R) / 2 : L + ((dayNum(d) - x0) / (x1 - x0)) * (W - L - R));
  const ys = (v) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);

  const uid = Math.random().toString(36).slice(2, 7);
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart__svg', role: 'img', 'aria-label': `Graf, zadnja vrednost ${fmt(vals[vals.length - 1], digits)} ${unit}` });
  const defs = s('defs');
  defs.append(
    s('linearGradient', { id: 'ca' + uid, x1: 0, y1: 0, x2: 0, y2: 1 },
      s('stop', { offset: '0', style: 'stop-color: var(--accent); stop-opacity: 0.55' }),
      s('stop', { offset: '1', style: 'stop-color: var(--accent); stop-opacity: 0' })),
    s('filter', { id: 'cg' + uid, x: '-100%', y: '-100%', width: '300%', height: '300%' }, s('feGaussianBlur', { stdDeviation: 4 })));
  svg.append(defs);

  // Tri tihe črte mreže, brez številk.
  for (let i = 1; i <= 3; i++) {
    const y = T + ((H - T - B) * i) / 4;
    svg.append(s('line', { x1: 0, x2: W, y1: y, y2: y, class: 'chart__grid' }));
  }

  // Datumi: prvi, srednji, zadnji.
  const labelIdx = points.length > 2 ? [0, Math.floor((points.length - 1) / 2), points.length - 1] : points.map((_, i) => i);
  for (const i of [...new Set(labelIdx)]) {
    const p = points[i];
    const anchor = points.length === 1 ? 'middle' : i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle';
    const t = s('text', { x: xs(p.date), y: H - 6, class: 'chart__tick', 'text-anchor': anchor });
    t.textContent = fmtDayShort(p.date);
    svg.append(t);
  }

  const d = points.map((p, i) => `${i ? 'L' : 'M'}${xs(p.date).toFixed(1)},${ys(p.value).toFixed(1)}`).join(' ');
  if (points.length > 1) {
    const area = `${d} L${xs(points[points.length - 1].date).toFixed(1)},${H - B} L${xs(points[0].date).toFixed(1)},${H - B} Z`;
    svg.append(s('path', { d: area, fill: `url(#ca${uid})` }));
    svg.append(s('path', { d, class: 'chart__line' }));
  }
  const last = points[points.length - 1];
  svg.append(
    s('circle', { cx: xs(last.date), cy: ys(last.value), r: 8, class: 'chart__glow', filter: `url(#cg${uid})` }),
    s('circle', { cx: xs(last.date), cy: ys(last.value), r: 4.5, class: 'chart__end' }));

  // Dotik/vlečenje pokaže najbližjo točko.
  const cursor = s('g', { class: 'chart__cursor', visibility: 'hidden' },
    s('line', { y1: T, y2: H - B, class: 'chart__cursor-line' }),
    s('circle', { r: 5, class: 'chart__cursor-dot' }));
  svg.append(cursor);

  const value = h('p', { class: 'chart__value' });
  const note = h('p', { class: 'chart__note' });
  const setValue = (v) => { value.innerHTML = ''; value.append(fmt(v, digits), h('small', null, unit)); };
  const showLast = () => {
    setValue(last.value);
    note.innerHTML = '';
    if (points.length > 1) {
      const diff = last.value - points[0].value;
      const round = Number(fmt(Math.abs(diff), digits).replace(',', '.'));
      note.append(
        h('b', { class: diff < 0 ? 'is-down' : '' }, round ? `${diff > 0 ? '↑' : '↓'} ${fmt(Math.abs(diff), digits)} ${unit}` : 'enako'),
        ` od ${fmtDayMonth(points[0].date)}`);
    } else {
      note.append(fmtDate(last.date));
    }
  };
  showLast();
  const pick = (e) => {
    const r = svg.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    let best = points[0];
    for (const p of points) if (Math.abs(xs(p.date) - px) < Math.abs(xs(best.date) - px)) best = p;
    const cx = xs(best.date), cy = ys(best.value);
    cursor.setAttribute('visibility', 'visible');
    cursor.firstChild.setAttribute('x1', cx); cursor.firstChild.setAttribute('x2', cx);
    cursor.lastChild.setAttribute('cx', cx); cursor.lastChild.setAttribute('cy', cy);
    setValue(best.value);
    note.textContent = fmtDate(best.date);
  };
  svg.addEventListener('pointerdown', (e) => { svg.setPointerCapture(e.pointerId); pick(e); });
  svg.addEventListener('pointermove', (e) => { if (e.buttons || e.pointerType === 'mouse') pick(e); });
  const hide = () => { cursor.setAttribute('visibility', 'hidden'); showLast(); };
  svg.addEventListener('pointerup', hide);
  svg.addEventListener('pointerleave', hide);
  svg.addEventListener('pointercancel', hide);

  wrap.append(h('div', { class: 'chart__readout' }, value, note), svg);
  return wrap;
}

/**
 * Stolpci v slogu črtnega grafa: zgoraj velika vrednost zadnjega stolpca in povprečje,
 * spodaj mehki stolpci (zadnji svetel s sijem), štirje datumi. Dotik pokaže stolpec.
 * bars = [{ label: kratka oznaka pod stolpcem, title: daljši opis za dotik, value, highlight }]
 * current: opis zadnjega stolpca ("ta teden"), per: enota povprečja ("na teden").
 */
export function barChart(bars, { unit = '', digits = 0, empty = 'Ni podatkov.', current = '', per = '', avgNonZero = false, format = null } = {}) {
  const show = format || ((v) => fmt(v, digits));
  const wrap = h('div', { class: 'chart chart--bars' });
  const max = Math.max(0, ...bars.map((b) => b.value));
  if (!max) {
    wrap.append(h('p', { class: 'chart__empty' }, empty));
    return wrap;
  }
  const W = 340, H = 132, T = 6, B = 24;
  const gap = bars.length > 10 ? 6 : 10;
  const bw = (W - gap * (bars.length - 1)) / bars.length;
  const uid = Math.random().toString(36).slice(2, 7);
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart__svg', role: 'img', 'aria-label': `Stolpčni graf, ${current} ${show(bars[bars.length - 1].value)} ${unit}` });
  svg.append(s('defs', {},
    s('linearGradient', { id: 'bh' + uid, x1: 0, y1: 0, x2: 0, y2: 1 },
      s('stop', { offset: '0', style: 'stop-color: var(--accent-text)' }),
      s('stop', { offset: '1', style: 'stop-color: var(--accent)' })),
    s('filter', { id: 'bg' + uid, x: '-50%', y: '-50%', width: '200%', height: '200%' }, s('feGaussianBlur', { stdDeviation: 5 }))));

  const xs = (i) => i * (bw + gap);
  const r = Math.min(8, bw / 2);
  const rects = [];
  bars.forEach((b, i) => {
    const x = xs(i);
    svg.append(s('rect', { x, y: T, width: bw, height: H - T - B, rx: r, class: 'chart__track' }));
    if (!b.value) { rects.push(null); return; }
    const hgt = Math.max(r * 2, (b.value / max) * (H - T - B));
    const y = H - B - hgt;
    if (b.highlight) svg.append(s('rect', { x, y, width: bw, height: hgt, rx: r, class: 'chart__bar-glow', filter: `url(#bg${uid})` }));
    const rect = s('rect', { x, y, width: bw, height: hgt, rx: r, class: `chart__bar${b.highlight ? ' is-hi' : ''}`, style: b.highlight ? `fill: url(#bh${uid})` : null });
    svg.append(rect);
    rects.push(rect);
  });

  // Štiri oznake pod stolpci: prva, zadnja in dve vmes.
  const n = bars.length;
  const idx = n <= 4 ? bars.map((_, i) => i) : [0, Math.round((n - 1) / 3), Math.round((2 * (n - 1)) / 3), n - 1];
  for (const i of [...new Set(idx)]) {
    const t = s('text', { x: xs(i) + bw / 2, y: H - 6, class: 'chart__tick', 'text-anchor': i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle' });
    if (i === 0) t.setAttribute('x', xs(i));
    if (i === n - 1) t.setAttribute('x', xs(i) + bw);
    t.textContent = bars[i].label;
    svg.append(t);
  }

  const value = h('p', { class: 'chart__value' });
  const note = h('p', { class: 'chart__note' });
  // Pri korakih dan brez vpisa ni 0 korakov: takrat povprečje šteje samo dneve z vrednostjo.
  const counted = avgNonZero ? bars.filter((b) => b.value > 0) : bars;
  const avg = counted.reduce((sum, b) => sum + b.value, 0) / Math.max(1, counted.length);
  const setValue = (v) => { value.innerHTML = ''; value.append(show(v), h('small', null, unit)); };
  // Pokaže se poudarjeni stolpec (npr. zadnji dan z vpisom), sicer zadnji.
  let hi = n - 1;
  for (let i = n - 1; i >= 0; i--) if (bars[i].highlight) { hi = i; break; }
  const hiLabel = hi === n - 1 && current ? current : (bars[hi].title || bars[hi].label);
  const showLast = () => {
    rects.forEach((x) => x && x.classList.remove('is-picked'));
    setValue(bars[hi].value);
    note.innerHTML = '';
    note.append(hiLabel ? `${hiLabel} · ` : '', 'povprečje ', h('b', null, `${show(avg)} ${unit}`), per ? ` ${per}` : '');
  };
  showLast();
  const pick = (e) => {
    const box = svg.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * W;
    const i = Math.max(0, Math.min(n - 1, Math.floor(px / (bw + gap))));
    rects.forEach((x, k) => x && x.classList.toggle('is-picked', k === i));
    setValue(bars[i].value);
    note.textContent = bars[i].title || bars[i].label;
  };
  svg.addEventListener('pointerdown', (e) => { svg.setPointerCapture(e.pointerId); pick(e); });
  svg.addEventListener('pointermove', (e) => { if (e.buttons || e.pointerType === 'mouse') pick(e); });
  svg.addEventListener('pointerup', showLast);
  svg.addEventListener('pointerleave', showLast);
  svg.addEventListener('pointercancel', showLast);

  wrap.append(h('div', { class: 'chart__readout' }, value, note), svg);
  return wrap;
}
