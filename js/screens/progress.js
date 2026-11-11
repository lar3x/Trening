// Zaslon NAPREDEK: koledar, moč po vaji, cardio po tednih; arhiv treningov in vaj.
import * as store from '../store.js';
import {
  h, header, iconButton, iconEl, openSheet, actionSheet, confirmSheet, promptSheet, toast,
  fmt, fmtDay, fmtDate, fmtDateLong, fmtRelative, fmtDuration, plural, monthName, fmtDayShort, fmtDayMonth,
} from '../ui.js';
import { lineChart, barChart, periodControl, filterPeriod } from '../chart.js';
import { openSettings } from '../settings.js';
import { backHeader } from './archive.js';
import { renderExerciseStats } from './exercise-stats.js';

let period = '3m';
let exerciseId = null;
let cardioMetric = 'durationSec';

export const screen = {
  id: 'napredek',
  icon: 'chart',
  label: 'Napredek',
  render(root, ctx, params) {
    // Stare povezave na arhiv vodijo na novo mesto pod TRENING.
    if (params[0] === 'arhiv') { location.replace('#/trening/' + params.map(encodeURIComponent).join('/')); return; }
    if (params[0] === 'vaje') return renderExercises(root, ctx);
    if (params[0] === 'vaja' && params[1]) return renderExerciseStats(root, ctx, params[1]);
    return renderOverview(root, ctx);
  },
};

// ---------------------------------------------------------------------------

function renderOverview(root, ctx) {
  root.append(header('chart', 'Napredek', iconButton('gear', 'Nastavitve', openSettings)));
  const body = h('div', { class: 'content' });

  body.append(calendarCard(ctx));

  // En izbirnik obdobja za vse grafe na zaslonu.
  body.append(h('div', { class: 'section-head section-head--sticky' },
    h('h2', { class: 'section-title' }, 'Obdobje'),
    periodControl(period, (p) => { period = p; ctx.rerender(); })));

  body.append(strengthCard(ctx));
  body.append(cardioCard(ctx));

  body.append(h('div', { class: 'list' },
    h('a', { class: 'list-row', href: '#/trening/arhiv' },
      iconEl('calendar', 20),
      h('span', { class: 'list-row__main' }, h('span', { class: 'list-row__title' }, 'Arhiv treningov'),
        h('span', { class: 'list-row__sub' }, `${store.listWorkouts().length} shranjenih`)),
      iconEl('chevron', 20)),
    h('a', { class: 'list-row', href: '#/napredek/vaje' },
      iconEl('dumbbell', 20),
      h('span', { class: 'list-row__main' }, h('span', { class: 'list-row__title' }, 'Vaje in rekordi'),
        h('span', { class: 'list-row__sub' }, `${store.listExercises().length} vaj`)),
      iconEl('chevron', 20))));

  root.append(body);
}

const MONTHS_LOC = ['januarju', 'februarju', 'marcu', 'aprilu', 'maju', 'juniju', 'juliju', 'avgustu', 'septembru', 'oktobru', 'novembru', 'decembru'];
let monthOffset = 0;   // 0 = ta mesec, -1 = prejšnji …

/**
 * Koledar meseca: rdeč krog = dan s treningom (povezava na trening v arhivu),
 * obroč = cardio, obris = danes. Zgoraj niz tednov ter treningi in cardio v mesecu.
 */
function calendarCard(ctx) {
  const today = store.todayIso();
  const now = new Date(today + 'T12:00:00');
  const first = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1, 12);
  const y = first.getFullYear(), m = first.getMonth();
  const days = new Date(y, m + 1, 0).getDate();
  const iso = (d) => store.dayOf(new Date(y, m, d, 12));
  const from = iso(1), to = iso(days);

  // Prvi trening vsakega dne (za povezavo) in število treningov v mesecu.
  const byDay = new Map();
  let trainings = 0;
  for (const w of [...store.listWorkouts()].reverse()) {
    const d = store.dayOf(w.date);
    if (d < from || d > to) continue;
    trainings++;
    if (!byDay.has(d)) byDay.set(d, w.id);
  }
  const { cardio } = store.activityDays();
  const cardioCount = store.cardioTotals(from, to).count;
  const streak = store.weekStreak();

  const stat = (value, label, hi = false) => h('div', { class: `cal-stat${hi ? ' cal-stat--hi' : ''}` },
    h('b', { class: 'tabular' }, String(value)), h('span', null, label));

  const grid = h('div', { class: 'mcal' },
    ['P', 'T', 'S', 'Č', 'P', 'S', 'N'].map((x) => h('span', { class: 'mcal__wd', 'aria-hidden': 'true' }, x)));
  const lead = (first.getDay() + 6) % 7;
  for (let i = 0; i < lead; i++) grid.append(h('span', { class: 'mcal__d is-out', 'aria-hidden': 'true' }));
  for (let d = 1; d <= days; d++) {
    const k = iso(d);
    const wid = byDay.get(k);
    const c = cardio.has(k);
    const cls = `mcal__d${wid ? ' is-train' : ''}${c ? ' is-cardio' : ''}${k === today ? ' is-today' : ''}${k > today ? ' is-future' : ''}`;
    const label = `${d}. ${MONTHS_LOC[m].replace(/u$/, 'a')}${wid ? ', trening' : ''}${c ? ', cardio' : ''}`;
    grid.append(wid
      ? h('a', { class: cls, href: `#/trening/arhiv/${wid}`, 'aria-label': `${label}, odpri trening` }, String(d))
      : h('span', { class: cls, 'aria-label': label }, String(d)));
  }

  const go = (delta) => { monthOffset += delta; ctx.rerender(); };
  const title = `${monthName(m).charAt(0).toUpperCase()}${monthName(m).slice(1)} ${y}`;
  return h('section', { class: 'card card--glow card--pad cal-card' },
    h('div', { class: 'cal-stats' },
      stat(streak, `${plural(streak, ['teden', 'tedna', 'tedni', 'tednov'])} zapored`, true),
      stat(trainings, `${plural(trainings, ['trening', 'treninga', 'treningi', 'treningov'])} v ${MONTHS_LOC[m]}`),
      stat(cardioCount, `cardio v ${MONTHS_LOC[m]}`)),
    h('div', { class: 'month-head' },
      h('h3', null, title),
      h('div', { class: 'month-head__nav' },
        h('button', { class: 'month-head__btn', type: 'button', 'aria-label': 'Prejšnji mesec', onclick: () => go(-1) }, iconEl('back', 18)),
        h('button', { class: 'month-head__btn', type: 'button', 'aria-label': 'Naslednji mesec', disabled: monthOffset >= 0 ? true : null, onclick: () => go(1) }, iconEl('chevron', 18)))),
    grid,
    h('div', { class: 'cal-legend' },
      h('span', null, h('i', { class: 'is-train' }), 'trening'),
      h('span', null, h('i', { class: 'is-cardio' }), 'cardio'),
      h('span', null, h('i', { class: 'is-today' }), 'danes')));
}

function strengthCard(ctx) {
  const trained = store.trainedExercises();
  const card = h('section', { class: 'card card--pad' });
  const head = h('div', { class: 'card-head' },
    h('div', { class: 'card-head__title' }, h('span', { class: 'ring' }, iconEl('chart', 16)), h('h2', { class: 'card-title' }, 'Moč')));
  card.append(head);
  if (!trained.length) {
    card.append(h('p', { class: 'hint' }, 'Ko shraniš prvi trening, tu izbereš vajo in vidiš, kako raste ocena največje teže (1RM).'));
    return card;
  }
  if (!exerciseId || !trained.some((e) => e.id === exerciseId)) {
    // Najpogostejša vaja, ki ima graf (elastika in čas ga nimata).
    const bySessions = [...trained].sort((a, b) => b.sessions - a.sessions);
    exerciseId = (bySessions.find((e) => store.strengthSeries(e.id).points.length) || bySessions[0]).id;
  }
  const ex = store.getExercise(exerciseId);
  head.append(h('a', { class: 'pill-btn pill-btn--quiet', href: `#/napredek/vaja/${ex.id}` }, 'Podrobno'));

  card.append(h('button', {
    class: 'select', type: 'button', 'aria-haspopup': 'dialog',
    onclick: () => pickExercise(ctx, trained),
  }, h('span', null, ex.name), iconEl('down', 18)));

  const { points, needsBodyweight } = store.strengthSeries(exerciseId);
  const pr = store.personalRecord(exerciseId);
  if (pr) {
    card.append(h('div', { class: 'pr' },
      iconEl('trophy', 20),
      h('span', null, 'Rekord ', h('strong', { class: 'tabular' }, `${fmt(pr.weightKg, 2)} kg × ${pr.reps}`)),
      h('span', { class: 'pr__date' }, fmtDay(pr.date))));
  }
  if (needsBodyweight && !points.length) {
    card.append(h('p', { class: 'hint' }, 'To je vaja z lastno težo. Vpiši telesno težo na zaslonu Telo, da se graf lahko izriše.'));
    return card;
  }
  const shown = filterPeriod(points, period);
  card.append(lineChart(shown, { unit: 'kg', digits: 1, minSpan: 4, empty: 'V tem obdobju te vaje ni bilo.' }));
  card.append(h('p', { class: 'hint' }, 'Ocena 1RM iz najboljše serije na trening. Štejejo samo navadni seti.'));
  return card;
}

function pickExercise(ctx, trained) {
  openSheet({
    title: 'Izberi vajo',
    tall: true,
    body: (close) => h('div', { class: 'picker-list' }, trained.map((e) => h('button', {
      class: `picker-row${e.id === exerciseId ? ' is-on' : ''}`, type: 'button',
      onclick: () => { exerciseId = e.id; close(); ctx.rerender(); },
    }, h('span', { class: 'picker-row__name' }, e.name),
    h('span', { class: 'picker-row__sub' }, `${e.sessions} ${plural(e.sessions, ['trening', 'treninga', 'treningi', 'treningov'])}`)))),
  });
}

function cardioCard(ctx) {
  const card = h('section', { class: 'card card--pad' });
  const metrics = [['durationSec', 'Čas'], ['distanceKm', 'km'], ['kcal', 'kcal']];
  card.append(h('div', { class: 'card-head' },
    h('div', { class: 'card-head__title' }, h('span', { class: 'ring' }, iconEl('pulse', 16)), h('h2', { class: 'card-title' }, 'Cardio')),
    h('div', { class: 'segmented segmented--small' }, metrics.map(([id, label]) => h('button', {
      class: `segmented__btn${cardioMetric === id ? ' is-on' : ''}`, type: 'button', 'aria-pressed': String(cardioMetric === id),
      onclick: () => { cardioMetric = id; ctx.rerender(); },
    }, label)))));

  const weeksByPeriod = { '1m': 5, '3m': 13, '1y': 26, all: 26 };
  const n = weeksByPeriod[period] || 13;
  const today = store.todayIso();
  const thisWeek = store.weekStart(today);
  const weeks = [];
  for (let i = n - 1; i >= 0; i--) {
    const from = store.shiftDay(thisWeek, -7 * i);
    weeks.push({ i, from, t: store.cardioTotals(from, store.shiftDay(from, 6)) });
  }
  // Če izbrana mera v obdobju nima podatkov (npr. stari vnosi imajo samo kcal), vzemi tisto, ki jih ima.
  const has = (m) => weeks.some((w) => w.t[m] > 0);
  if (!has(cardioMetric)) {
    const alt = metrics.map(([id]) => id).find(has);
    if (alt) {
      cardioMetric = alt;
      card.querySelectorAll('.segmented__btn').forEach((b, k) => {
        const on = metrics[k][0] === alt;
        b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', String(on));
      });
    }
  }
  const bars = weeks.map(({ i, from, t }) => ({
    label: fmtDayShort(from),
    title: i === 0 ? 'ta teden' : `teden od ${fmtDayMonth(from)}`,
    value: cardioMetric === 'durationSec' ? Math.round(t.durationSec / 60) : t[cardioMetric],
    highlight: i === 0,
  }));
  card.append(barChart(bars, {
    unit: cardioMetric === 'durationSec' ? 'min' : cardioMetric === 'distanceKm' ? 'km' : 'kcal',
    digits: cardioMetric === 'distanceKm' ? 1 : 0,
    current: 'ta teden',
    per: 'na teden',
    empty: 'Še ni vnosov cardia v tem obdobju.',
  }));
  return card;
}

// ---------------------------------------------------------------------------
// Vaje in rekordi
// ---------------------------------------------------------------------------

function renderExercises(root, ctx) {
  root.append(backHeader('Vaje in rekordi', '#/napredek'));
  const body = h('div', { class: 'content' });
  const list = store.listExercises();
  if (!list.length) {
    body.append(h('p', { class: 'muted-note' }, 'Vaje se dodajo med treningom.'));
  } else {
    // Dotik vaje odpre njeno statistiko; preimenovanje in brisanje sta v njenem meniju ⋯.
    body.append(h('div', { class: 'list' }, list.map((ex) => {
      const pr = store.personalRecord(ex.id);
      const last = store.lastDateFor(ex.id);
      return h('a', { class: 'list-row', href: `#/napredek/vaja/${ex.id}` },
        h('span', { class: 'list-row__main' },
          h('span', { class: 'list-row__title' }, ex.name),
          h('span', { class: 'list-row__sub' }, last ? `zadnjič ${fmtRelative(last)}` : 'še ni v zgodovini')),
        pr ? h('span', { class: 'pr-chip tabular' }, `${fmt(pr.weightKg, 2)} × ${pr.reps}`) : null,
        iconEl('chevron', 18));
    })));
  }
  root.append(body);
}
