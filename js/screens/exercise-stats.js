// Statistika ene vaje (#/napredek/vaja/<id>): rekord, serije, ponovitve, volumen,
// serije po treningih, ocena 1RM, zadnji treningi. Ni svoj zavihek: usmeri ga Napredek.
import * as store from '../store.js';
import {
  h, subHeader, iconButton, iconEl, actionSheet, confirmSheet, promptSheet, toast, undoToast,
  fmt, fmtClock, fmtRelative,
} from '../ui.js';
import { lineChart, filterPeriod } from '../chart.js';
import { describeSet, setLabels, BAND_INFO, renameExercise, mergeExercisePicker } from './training.js';

// Obdobje za ploščice in graf. id-ji so isti kot v chart.js, da filterPeriod velja za graf.
const PERIODS = [
  { id: '1m', label: '30 dni', days: 30, prev: 'od prejšnjih 30 dni' },
  { id: '3m', label: '3 mes.', days: 91, prev: 'od prejšnjih 3 mesecev' },
  { id: '1y', label: 'Leto', days: 365, prev: 'od prejšnjega leta' },
  { id: 'all', label: 'Vse', days: null, prev: null },
];
let period = '1m';

const MONTHS_GENITIVE = ['januarja', 'februarja', 'marca', 'aprila', 'maja', 'junija', 'julija', 'avgusta', 'septembra', 'oktobra', 'novembra', 'decembra'];
const HEAT_SESSIONS = 12;
const HEAT_ROWS = 6;

export function renderExerciseStats(root, ctx, id) {
  const ex = store.getExercise(id);
  if (!ex) {
    root.append(subHeader({ back: '#/napredek/vaje', title: 'Vaja' }));
    root.append(h('div', { class: 'content' }, h('p', { class: 'muted-note' }, 'Te vaje ni več.')));
    return;
  }
  const sessions = store.exerciseSessions(id);
  // Nazaj tja, od koder si prišla (trening, seznam vaj, Napredek, arhiv).
  const prev = document.body.dataset.prev || '';
  const back = prev.startsWith('#/') && !prev.includes('/vaja/') ? prev : '#/napredek/vaje';

  root.append(subHeader({
    back,
    eyebrow: 'Vaja',
    title: ex.name,
    sub: subtitle(sessions),
    right: [iconButton('more', `Možnosti za ${ex.name}`, () => exerciseMenu(ctx, ex))],
  }));

  const body = h('div', { class: 'content' });
  root.append(body);

  if (!sessions.length) {
    body.append(h('p', { class: 'muted-note' }, 'Ko to vajo shraniš v treningu, se tu pokaže njen napredek.'));
    return;
  }

  const kinds = new Set(sessions.flatMap((s) => s.sets.map((x) => x.kind)));
  const strength = sessions.some((s) => s.sets.some(store.countsForStrength));
  const kind = strength ? 'normal' : kinds.has('time') ? 'time' : kinds.has('band') ? 'band' : 'normal';

  body.append(h('div', { class: 'segmented', role: 'tablist' }, PERIODS.map((p) => h('button', {
    class: `segmented__btn${p.id === period ? ' is-on' : ''}`, type: 'button', role: 'tab',
    'aria-selected': String(p.id === period),
    onclick: () => { period = p.id; ctx.rerender(); },
  }, p.label))));

  body.append(tiles(ex, sessions, kind));
  body.append(heatCard(ex, sessions, kind));
  if (strength) body.append(oneRmCard(ex));
  body.append(sessionsCard(ex, sessions));
}

/** "v treningu Legs · 24-krat od marca" */
function subtitle(sessions) {
  if (!sessions.length) return 'še ni v zgodovini';
  const names = new Map();
  for (const s of sessions) names.set(s.name, (names.get(s.name) || 0) + 1);
  const top = [...names.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const first = new Date(sessions[sessions.length - 1].date);
  const since = MONTHS_GENITIVE[first.getMonth()] + (first.getFullYear() !== new Date().getFullYear() ? ` ${first.getFullYear()}` : '');
  return `v treningu ${top} · ${sessions.length}-krat od ${since}`;
}

// ---------------------------------------------------------------------------
// Ploščice
// ---------------------------------------------------------------------------

function tiles(ex, sessions, kind) {
  const p = PERIODS.find((x) => x.id === period);
  const today = store.todayIso();
  const from = p.days ? store.shiftDay(today, -(p.days - 1)) : null;
  const cur = store.exerciseTotals(ex.id, from, today);
  const prev = p.days ? store.exerciseTotals(ex.id, store.shiftDay(from, -p.days), store.shiftDay(from, -1)) : null;

  // Razlika do prejšnjega enako dolgega obdobja; pri "Vse" je ni.
  const delta = (c, pv, show) => {
    if (!prev) return sub(null, 'od začetka');
    const d = c - pv;
    if (!d) return sub(h('b', { class: 'is-down' }, 'enako'), p.prev);
    return sub(h('b', { class: d < 0 ? 'is-down' : '' }, iconEl(d > 0 ? 'up' : 'down', 12), show(Math.abs(d), d)), p.prev);
  };

  const list = [recordTile(ex, sessions, kind)];
  list.push(tile('layers', 'Serije', String(cur.sets), delta(cur.sets, prev && prev.sets, (v) => String(v))));
  if (kind === 'time') {
    list.push(tile('clock', 'Skupni čas', cur.seconds ? fmtClock(cur.seconds) : '0:00', delta(cur.seconds, prev && prev.seconds, (v) => fmtClock(v))));
  } else {
    list.push(tile('repeat', 'Ponovitve', String(cur.reps), delta(cur.reps, prev && prev.reps, (v) => String(v))));
  }

  if (kind === 'time') {
    list.push(tile('timer', 'Najdaljši čas', cur.maxSeconds ? fmtClock(cur.maxSeconds) : '—',
      delta(cur.maxSeconds, prev && prev.maxSeconds, (v) => fmtClock(v))));
  } else if (kind === 'band') {
    const last = sessions[0].sets.filter((x) => x.kind === 'band' && x.band).pop();
    list.push(tile('band', 'Zadnja elastika', last ? BAND_INFO[last.band].name : '—', sub(null, fmtRelative(sessions[0].date))));
  } else {
    const vol = (kg) => (kg >= 1000 ? [fmt(kg / 1000, 1), h('small', null, 't')] : [fmt(kg, 0), h('small', null, 'kg')]);
    list.push(tile('dumbbell', 'Volumen', vol(cur.volumeKg),
      delta(cur.volumeKg, prev && prev.volumeKg, (v) => (prev.volumeKg ? `${fmt((v / prev.volumeKg) * 100, 1)} %` : (v >= 1000 ? `${fmt(v / 1000, 1)} t` : `${fmt(v, 0)} kg`)))));
  }
  return h('div', { class: 'stat-tiles' }, list);
}

function recordTile(ex, sessions, kind) {
  if (kind === 'time') {
    const best = store.exerciseTotals(ex.id).maxSeconds;
    return tile('trophy', 'Rekord', best ? fmtClock(best) : '—', sub(null, 'najdaljši čas'), true);
  }
  if (kind === 'band') {
    let best = null;
    for (const s of sessions) for (const x of s.sets) if (x.kind === 'band' && x.reps > 0 && (!best || x.reps > best.reps)) best = { ...x, date: s.date };
    return tile('trophy', 'Rekord', best ? ['×', ` ${best.reps}`] : '—',
      sub(best ? h('b', null, fmtRelative(best.date)) : null, best && best.band ? BAND_INFO[best.band].name : 'največ ponovitev'), true);
  }
  const pr = store.personalRecord(ex.id);
  const { points } = store.strengthSeries(ex.id);
  const best1rm = points.length ? Math.max(...points.map((pt) => pt.value)) : null;
  if (!pr) return tile('trophy', 'Rekord', '—', sub(null, 'še ni serije s težo'), true);
  return tile('trophy', 'Rekord', [`${fmt(pr.weightKg, 2)} kg`, h('small', null, `× ${pr.reps}`)],
    sub(h('b', null, fmtRelative(pr.date)), best1rm ? `ocena 1RM ${fmt(best1rm, 0)} kg` : ''), true);
}

function tile(iconName, title, value, subEl, hi = false) {
  return h('div', { class: `card stat-tile${hi ? ' stat-tile--hi' : ''}` },
    h('div', { class: 'stat-tile__head' }, h('span', { class: 'ring' }, iconEl(iconName, 16)), title),
    h('div', { class: 'stat-tile__val' }, value),
    subEl);
}

function sub(strong, text) {
  return h('div', { class: 'stat-tile__sub' }, strong, text ? h('span', null, text) : null);
}

// ---------------------------------------------------------------------------
// Serije po treningih: vrstica je serija, stolpec eden od zadnjih treningov
// ---------------------------------------------------------------------------

function heatCard(ex, sessions, kind) {
  const shown = sessions.slice(0, HEAT_SESSIONS).reverse();
  const records = store.recordSetKeys(ex.id);
  // Kako težka je serija: pri navadni ocena 1RM, pri času sekunde, pri elastiki ponovitve.
  const weightOf = (x) => {
    if (kind === 'normal') return store.countsForStrength(x) ? store.estimate1RM(x.weightKg || 0, x.reps) : null;
    if (kind === 'time') return x.kind === 'time' && x.seconds > 0 ? x.seconds : null;
    return x.reps > 0 ? x.reps : null;
  };
  const vals = shown.flatMap((s) => s.sets.map(weightOf)).filter((v) => v != null);
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const level = (v) => (v == null ? 0 : hi === lo ? 2 : 1 + Math.min(2, Math.floor(((v - lo) / (hi - lo)) * 3)));

  const rows = Math.min(HEAT_ROWS, Math.max(...shown.map((s) => s.sets.length)));
  const grid = h('div', { class: 'heat', style: { gridTemplateColumns: `24px repeat(${shown.length}, minmax(0, 1fr))` }, role: 'img',
    'aria-label': `Serije zadnjih ${shown.length} treningov; svetlejše so težje` });
  for (let r = 0; r < rows; r++) {
    grid.append(h('span', { class: 'heat__rl' }, `S${r + 1}`));
    for (const s of shown) {
      const x = s.sets[r];
      const lv = x && records.has(`${s.workoutId}:${r}`) ? 4 : x ? level(weightOf(x)) : 0;
      grid.append(h('span', { class: `heat__c lv${lv}`, title: x ? describeSet(x) : '' }));
    }
  }
  grid.append(h('span'));
  for (const s of shown) grid.append(h('span', { class: 'heat__x' }, String(new Date(s.date).getDate())));

  return h('section', { class: 'card card--pad' },
    h('div', { class: 'card-head' },
      h('div', { class: 'card-head__title' }, h('span', { class: 'ring' }, iconEl('grid', 16)), h('h2', { class: 'card-title' }, 'Serije po treningih'))),
    h('div', { class: 'heat-legend' },
      h('span', null, h('i', { class: 'lv1' }), 'Lažje'),
      h('span', null, h('i', { class: 'lv2' }), 'Srednje'),
      h('span', null, h('i', { class: 'lv3' }), 'Težje'),
      kind === 'normal' ? h('span', null, h('i', { class: 'lv4' }), 'Rekord') : null),
    grid);
}

// ---------------------------------------------------------------------------
// Ocena 1RM skozi čas
// ---------------------------------------------------------------------------

function oneRmCard(ex) {
  const { points, needsBodyweight } = store.strengthSeries(ex.id);
  const shown = filterPeriod(points, period);
  const card = h('section', { class: 'card card--chart' },
    h('div', { class: 'card-head' },
      h('div', { class: 'card-head__title' }, h('span', { class: 'ring' }, iconEl('chart', 16)), h('h2', { class: 'card-title' }, 'Ocena 1RM'))));
  if (needsBodyweight && !points.length) {
    card.append(h('p', { class: 'hint' }, 'To je vaja z lastno težo. Vpiši telesno težo na zaslonu Telo, da se graf lahko izriše.'));
    return card;
  }
  card.append(lineChart(shown, { unit: 'kg', digits: 1, minSpan: 4, empty: 'V tem obdobju te vaje ni bilo.' }));
  return card;
}

// ---------------------------------------------------------------------------
// Zadnji treningi s to vajo
// ---------------------------------------------------------------------------

function sessionsCard(ex, sessions) {
  const records = store.recordSetKeys(ex.id);
  const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
  return h('section', { class: 'card card--pad' },
    h('div', { class: 'card-head' },
      h('div', { class: 'card-head__title' }, h('span', { class: 'ring' }, iconEl('clock', 16)), h('h2', { class: 'card-title' }, 'Zadnji treningi')),
      h('a', { class: 'pill-btn pill-btn--quiet', href: '#/trening/arhiv' }, 'Arhiv')),
    h('div', null, sessions.slice(0, 5).map((s) => {
      const labels = setLabels(s.sets);
      const hasRecord = s.sets.some((_, i) => records.has(`${s.workoutId}:${i}`));
      return h('a', { class: 'session', href: `#/trening/arhiv/${s.workoutId}`, style: { display: 'block' } },
        h('div', { class: 'session__top' }, cap(fmtRelative(s.date)), h('small', null, `· ${s.name}`),
          hasRecord ? h('span', { class: 'rec-badge' }, iconEl('trophy', 12), 'Rekord') : null),
        h('div', { class: 'read-sets' }, s.sets.map((x, i) => h('span', { class: `read-set${records.has(`${s.workoutId}:${i}`) ? ' is-pr' : ''}` },
          h('span', { class: 'set-label' }, labels[i]), h('span', { class: 'tabular' }, describeSet(x))))));
    })));
}

// ---------------------------------------------------------------------------

function exerciseMenu(ctx, ex) {
  actionSheet(ex.name, [
    { label: 'Preimenuj', icon: 'note', onSelect: async () => {
      const page = `#/napredek/vaja/${ex.id}`;
      const keep = await renameExercise(ex, page);
      if (keep && keep !== ex.id) location.hash = `#/napredek/vaja/${keep}`;
      else ctx.rerender();
    } },
    { label: 'Združi z drugo vajo', icon: 'layers', hint: 'dvojnik z drugim imenom',
      onSelect: () => mergeExercisePicker(ex, `#/napredek/vaja/${ex.id}`, (into) => { location.hash = `#/napredek/vaja/${into.id}`; }) },
    { label: ex.usesBodyweight ? 'Vaja z lastno težo: DA' : 'Vaja z lastno težo: NE', icon: 'scale',
      hint: 'graf moči prišteje telesno težo',
      onSelect: () => { store.updateExercise(ex.id, { usesBodyweight: !ex.usesBodyweight }); ctx.rerender(); } },
    { label: 'Izbriši vajo povsod', icon: 'trash', danger: true, onSelect: async () => {
      if (await confirmSheet({ title: `Izbrišem "${ex.name}"?`, message: 'Vaja izgine iz vseh treningov, predlog in grafov. Takoj zatem lahko še razveljaviš.', confirmLabel: 'Izbriši povsod', danger: true })) {
        const snap = store.snapshot();
        store.removeExercise(ex.id);
        location.hash = '#/napredek/vaje';
        undoToast(`${ex.name} izbrisana`, () => { store.restore(snap); location.hash = `#/napredek/vaja/${ex.id}`; });
      }
    } },
  ]);
}
