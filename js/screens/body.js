// Zaslon TELO: telesna teža in meritve (obseg pasu, roke …), en vnos na dan, graf.
import * as store from '../store.js';
import {
  h, header, iconButton, iconEl, actionSheet, confirmSheet, promptSheet, openSheet, toast, undoToast,
  fmt, parseNum, fmtDate, fmtDateLong, fmtRelative, fmtDayShort, fmtDayMonth,
} from '../ui.js';
import { lineChart, barChart, periodControl, filterPeriod, PERIODS } from '../chart.js';
import { openSettings } from '../settings.js';

const WEIGHT = 'weight';
const STEPS = 'steps';
let selected = WEIGHT;
let period = '3m';

export const screen = {
  id: 'telo',
  icon: 'scale',
  label: 'Telo',
  render(root, ctx, params) {
    // #/telo/koraki odpre korake naravnost (za obvestila ali bližnjico).
    // Pot se takoj vrne na #/telo, sicer bi vsak nov izris spet izbral korake.
    if (params && params[0] === 'koraki') { selected = STEPS; history.replaceState(null, '', '#/telo'); }
    const measurements = store.listMeasurements();
    if (selected !== WEIGHT && selected !== STEPS && !store.getMeasurement(selected)) selected = WEIGHT;
    const m = selected === WEIGHT || selected === STEPS ? null : store.getMeasurement(selected);
    const unit = m ? m.unit : 'kg';
    const entries = m
      ? store.listMeasurementEntries(m.id).map((e) => ({ id: e.id, date: e.date, value: e.value }))
      : store.listBodyweight().map((e) => ({ id: e.id, date: e.date, value: e.weightKg }));

    root.append(header('scale', 'Telo', iconButton('gear', 'Nastavitve', openSettings)));
    const body = h('div', { class: 'content' });

    // --- izbira, kaj merimo ---
    const chip = (id, label) => h('button', {
      class: `chip${selected === id ? ' is-on' : ''}`, type: 'button', 'aria-pressed': String(selected === id),
      onclick: () => { selected = id; ctx.rerender(); },
    }, label);
    body.append(h('div', { class: 'chips chips--scroll' },
      chip(WEIGHT, 'Teža'),
      chip(STEPS, 'Koraki'),
      measurements.map((x) => chip(x.id, x.name)),
      h('button', { class: 'chip chip--add', type: 'button', onclick: () => newMeasurement(ctx) }, iconEl('plus', 16), 'Meritev')));

    if (selected === STEPS) {
      renderSteps(body, ctx);
      root.append(body);
      return;
    }

    // --- vnos ---
    const today = store.todayIso();
    const todays = entries.find((e) => e.date === today);
    const input = h('input', {
      class: 'big-input', type: 'text', inputmode: 'decimal', autocomplete: 'off',
      placeholder: entries.length ? fmt(entries[entries.length - 1].value, 1) : '0',
      'aria-label': `${m ? m.name : 'Telesna teža'} v ${unit}`,
    });
    if (todays) input.value = fmt(todays.value, 2);
    const date = h('input', { class: 'field', type: 'date', value: today, max: today, 'aria-label': 'Datum' });
    date.addEventListener('change', () => {
      const e = entries.find((x) => x.date === date.value);
      input.value = e ? fmt(e.value, 2) : '';
    });
    const save = () => {
      const v = parseNum(input.value);
      if (v == null) { toast('Vpiši številko'); return; }
      const ok = m ? store.setMeasurementEntry(m.id, date.value || today, v) : store.setBodyweight(date.value || today, v);
      if (!ok) { toast('Ta številka ne gre'); return; }
      toast('Shranjeno');
      ctx.rerender();
    };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); });

    body.append(h('div', { class: 'card card--pad entry-card' },
      h('div', { class: 'entry-card__row' },
        h('label', { class: 'big-field' }, input, h('span', { class: 'big-field__unit' }, unit)),
        h('button', { class: 'btn btn--primary', type: 'button', onclick: save }, 'Shrani')),
      date,
      h('p', { class: 'hint' }, 'En vnos na dan. Ponoven vpis istega dne prejšnjega popravi.')));

    // Graf sam pokaže zadnjo vrednost in spremembo od začetka obdobja.
    const shown = filterPeriod(entries, period);
    body.append(h('div', { class: 'card card--chart' },
      h('h2', { class: 'card-title chart__title' }, m ? m.name : 'Telesna teža'),
      lineChart(shown, { unit, digits: 1, minSpan: unit === 'kg' ? 2 : 2, empty: entries.length ? 'V tem obdobju ni vnosov.' : 'Graf se pokaže po prvem vnosu.' }),
      periodControl(period, (p) => { period = p; ctx.rerender(); })));

    // --- pretekli vnosi ---
    if (entries.length) {
      body.append(h('div', { class: 'section-head' },
        h('h2', { class: 'section-title' }, 'Vnosi'),
        m ? h('button', { class: 'link', type: 'button', onclick: () => measurementMenu(ctx, m) }, 'Uredi meritev') : null));
      const list = h('div', { class: 'list' });
      const recent = [...entries].reverse();
      const renderRows = (n) => {
        list.innerHTML = '';
        recent.slice(0, n).forEach((e, i) => {
          const prev = recent[i + 1];
          const d = prev ? e.value - prev.value : null;
          list.append(h('button', {
            class: 'list-row list-row--compact', type: 'button',
            onclick: async () => {
              if (await confirmSheet({ title: 'Izbrišem vnos?', message: `${fmtDate(e.date)}: ${fmt(e.value, 2)} ${unit}`, confirmLabel: 'Izbriši', danger: true })) {
                const snap = store.snapshot();
                m ? store.removeMeasurementEntry(e.id) : store.removeBodyweight(e.id);
                ctx.rerender();
                undoToast('Vnos izbrisan', () => { store.restore(snap); ctx.rerender(); });
              }
            },
          },
          h('span', { class: 'list-row__title tabular' }, `${fmt(e.value, 2)} ${unit}`),
          d != null && d !== 0 ? h('span', { class: 'delta tabular' }, `${d > 0 ? '+' : '−'}${fmt(Math.abs(d), 1)}`) : h('span'),
          h('span', { class: 'list-row__sub' }, fmtRelative(e.date))));
        });
        if (recent.length > n) {
          list.append(h('button', { class: 'list-more', type: 'button', onclick: () => renderRows(recent.length) }, `Pokaži vse (${recent.length})`));
        }
      };
      renderRows(8);
      body.append(list);
    }

    root.append(body);
  },
};

// ---------------------------------------------------------------------------
// Koraki: ena številka na dan, prilepljena iz bližnjice ali vpisana na roko
// ---------------------------------------------------------------------------

// Vedno s piko pri tisočicah (8.432); toLocaleString bi štirimestna števila pustil brez.
const fmtSteps = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

function renderSteps(body, ctx) {
  const entries = store.listSteps();
  const today = store.todayIso();
  const kcalOf = (e) => store.stepsEnergy(e.steps, e.date);

  const saveParsed = (p) => {
    if (!store.setSteps(p.day, p.steps)) { toast('Ta številka ne gre'); return; }
    const en = store.stepsEnergy(p.steps, p.day);
    toast(`Vpisano: ${fmtSteps(p.steps)} korakov${en ? ` ≈ ${en.kcal} kcal` : ''}, ${p.day === today ? 'danes' : fmtWeekday(p.day)}`);
    ctx.rerender();
  };

  // vpis: številka iz aplikacije Zdravje, prepisana na roko
  const todays = entries.find((e) => e.date === today);
  const input = h('input', {
    class: 'big-input', type: 'text', inputmode: 'numeric', autocomplete: 'off',
    placeholder: entries.length ? fmtSteps(entries[entries.length - 1].steps) : '0', 'aria-label': 'Koraki',
  });
  if (todays) input.value = String(todays.steps);
  const date = h('input', { class: 'field', type: 'date', value: today, max: today, 'aria-label': 'Datum' });
  date.addEventListener('change', () => {
    const e = entries.find((x) => x.date === date.value);
    input.value = e ? String(e.steps) : '';
  });
  const save = () => {
    const p = store.parseStepsText(input.value);
    if (!p) { toast('Vpiši številko'); return; }
    saveParsed({ day: date.value || today, steps: p.steps });
  };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); });
  body.append(h('div', { class: 'card card--pad entry-card' },
    h('div', { class: 'entry-card__row' },
      h('label', { class: 'big-field' }, input, h('span', { class: 'big-field__unit' }, 'korakov')),
      h('button', { class: 'btn btn--primary', type: 'button', onclick: save }, 'Shrani')),
    date,
    h('p', { class: 'hint' }, 'Številko prepiši iz aplikacije Zdravje. En vnos na dan; nov vpis istega dne prejšnjega popravi.')));

  // zadnjih 14 dni
  const byDay = new Map(entries.map((e) => [e.date, e.steps]));
  // Poudarjen je zadnji dan z vpisom (danes še ni nujno vpisan).
  const from14 = store.shiftDay(today, -13);
  const lastDay = entries.length && entries[entries.length - 1].date >= from14 ? entries[entries.length - 1].date : today;
  const bars = [];
  for (let i = 13; i >= 0; i--) {
    const d = store.shiftDay(today, -i);
    bars.push({ label: fmtDayShort(d), title: i === 0 ? 'danes' : i === 1 ? 'včeraj' : fmtDayMonth(d), value: byDay.get(d) || 0, highlight: d === lastDay });
  }
  body.append(h('div', { class: 'card card--chart' },
    h('h2', { class: 'card-title chart__title' }, 'Koraki, zadnjih 14 dni'),
    barChart(bars, {
      unit: 'korakov', format: fmtSteps, current: 'danes', per: 'na dan', avgNonZero: true,
      empty: entries.length ? 'V zadnjih 14 dneh ni vnosov.' : 'Graf se pokaže po prvem vnosu.',
    })));

  // kalorije iz korakov (ocena; ne prišteje se k cardiu, da hoja s Strave ni dvakrat)
  const missing = store.stepsEnergyMissing();
  if (missing) {
    body.append(h('button', {
      class: 'strava-row', type: 'button',
      onclick: () => { selected = WEIGHT; ctx.rerender(); },
    },
    h('span', { class: 'ring' }, iconEl('flame', 16)),
    h('span', { class: 'list-row__main' },
      h('span', { class: 'list-row__title' }, 'Kalorije iz korakov'),
      h('span', { class: 'list-row__sub' }, 'Vpiši svojo težo pod "Teža".'))));
  } else if (entries.length) {
    const last = entries[entries.length - 1];
    const lastEn = kcalOf(last);
    const week = entries.filter((e) => e.date > store.shiftDay(today, -7)).map(kcalOf).filter(Boolean);
    const avg = week.length ? week.reduce((n, e) => n + e.kcal, 0) / week.length : 0;
    body.append(h('section', { class: 'card card--glow card--pad' },
      h('div', { class: 'card-head' },
        h('div', { class: 'card-head__title' }, h('span', { class: 'ring' }, iconEl('flame', 16)), h('h2', { class: 'card-title' }, 'Kalorije iz korakov'))),
      h('div', { class: 'cal-stats cal-stats--2' },
        h('div', { class: 'cal-stat cal-stat--hi' },
          h('b', { class: 'tabular' }, lastEn ? `${lastEn.kcal} kcal` : '—'),
          h('span', null, `${last.date === today ? 'danes' : fmtRelative(last.date)}${lastEn && lastEn.km ? ` · ${fmt(lastEn.km, 1)} km` : ''}`)),
        h('div', { class: 'cal-stat' },
          h('b', { class: 'tabular' }, `${fmt(avg, 0)} kcal`),
          h('span', null, 'povprečje 7 dni'))),
      h('p', { class: 'hint' }, `Ocena: 1000 korakov ≈ 40 kcal pri 70 kg, za tvojo težo sorazmerno. Razdalja se pokaže, če v nastavitvah vpišeš višino. Ne prišteje se k cardiu, da hoja s Strave ni štela dvakrat.`)));
  }

  if (entries.length) {
    body.append(h('h2', { class: 'section-title' }, 'Vnosi'));
    const list = h('div', { class: 'list' });
    const recent = [...entries].reverse();
    const renderRows = (n) => {
      list.innerHTML = '';
      recent.slice(0, n).forEach((e) => {
        const en = kcalOf(e);
        list.append(h('button', {
          class: 'list-row list-row--compact', type: 'button',
          onclick: async () => {
            if (await confirmSheet({ title: 'Izbrišem vnos?', message: `${fmtDate(e.date)}: ${fmtSteps(e.steps)} korakov`, confirmLabel: 'Izbriši', danger: true })) {
              const snap = store.snapshot();
              store.removeSteps(e.id);
              ctx.rerender();
              undoToast('Vnos izbrisan', () => { store.restore(snap); ctx.rerender(); });
            }
          },
        },
        h('span', { class: 'list-row__title tabular' }, `${fmtSteps(e.steps)}`),
        h('span', { class: 'delta tabular' }, en ? `≈ ${en.kcal} kcal` : ''),
        h('span', { class: 'list-row__sub' }, fmtRelative(e.date))));
      });
      if (recent.length > n) list.append(h('button', { class: 'list-more', type: 'button', onclick: () => renderRows(recent.length) }, `Pokaži vse (${recent.length})`));
    };
    renderRows(8);
    body.append(list);
  }
}

function fmtWeekday(day) {
  return `${fmtDateLong(day).split(',')[0]} ${fmtDate(day).slice(0, -5)}`;
}

async function newMeasurement(ctx) {
  const name = await promptSheet({ title: 'Nova meritev', placeholder: 'npr. Pas, Boki, Roka', confirmLabel: 'Naprej' });
  if (!name) return;
  openSheet({
    title: `Enota za "${name}"`,
    body: (close) => h('div', { class: 'action-list' },
      [['cm', 'Centimetri (obseg)'], ['kg', 'Kilogrami'], ['%', 'Odstotek (npr. maščoba)']].map(([u, label]) =>
        h('button', { class: 'action', type: 'button', onclick: () => {
          const m = store.createMeasurement(name, u);
          selected = m.id;
          close();
          ctx.rerender();
        } }, h('span', { class: 'action__label' }, label), h('span', { class: 'action__hint' }, u)))),
  });
}

function measurementMenu(ctx, m) {
  actionSheet(m.name, [
    { label: 'Izbriši meritev in vse vnose', icon: 'trash', danger: true, onSelect: async () => {
      if (await confirmSheet({ title: `Izbrišem "${m.name}"?`, message: 'Izbrisani bodo tudi vsi vnosi te meritve.', confirmLabel: 'Izbriši', danger: true })) {
        const snap = store.snapshot();
        store.removeMeasurement(m.id);
        selected = WEIGHT;
        ctx.rerender();
        undoToast(`${m.name} izbrisana`, () => { store.restore(snap); selected = m.id; ctx.rerender(); });
      }
    } },
  ]);
}

export { PERIODS };
