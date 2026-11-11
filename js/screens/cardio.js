// Zaslon CARDIO: vnos aktivnosti (vrsta, trajanje, razdalja, kalorije) in zgodovina.
import * as store from '../store.js';
import {
  h, header, iconButton, iconEl, openSheet, actionSheet, confirmSheet, toast, undoToast,
  fmt, parseNum, fmtDuration, fmtPace, fmtRelative, monthName,
} from '../ui.js';
import { openSettings } from '../settings.js';

// Ponudijo se samo, dokler zgodovina ne pove, kaj delaš ti.
const STARTER_TYPES = ['Tek', 'Kolo', 'Hoja', 'Stairmaster'];
let historyLimit = 20;

export const screen = {
  id: 'cardio',
  icon: 'pulse',
  label: 'Cardio',
  render(root, ctx) {
    root.append(header('pulse', 'Cardio', iconButton('gear', 'Nastavitve', openSettings)));
    const body = h('div', { class: 'content' });

    body.append(weekSummary());

    body.append(h('h2', { class: 'section-title' }, 'Nov vnos'));
    body.append(h('div', { class: 'card card--pad' }, cardioForm({
      initial: null,
      submitLabel: 'Shrani',
      onSubmit: (entry) => {
        if (!store.addCardio(entry)) { toast('Vpiši vsaj trajanje, razdaljo ali kalorije'); return false; }
        toast('Cardio shranjen');
        ctx.rerender();
        return true;
      },
    })));

    body.append(history(ctx));
    root.append(body);
  },
};

function weekSummary() {
  const today = store.todayIso();
  const from = store.weekStart(today);
  const t = store.cardioTotals(from, today);
  const stat = (value, label) => h('div', { class: 'stat' }, h('strong', { class: 'tabular' }, value), h('span', null, label));
  return h('div', { class: 'card card--glow summary' },
    h('p', { class: 'summary__title' }, 'Ta teden'),
    h('div', { class: 'summary__stats' },
      stat(t.count ? String(t.count) : '0', t.count === 1 ? 'aktivnost' : 'aktivnosti'),
      stat(t.distanceKm ? fmt(t.distanceKm, 1) : '0', 'km'),
      stat(t.durationSec ? fmtDuration(t.durationSec) : '0 min', 'čas'),
      stat(t.kcal ? fmt(t.kcal, 0) : '0', 'kcal')));
}

/** Obrazec za nov vnos ali popravek. onSubmit vrne true, če je vnos sprejet. */
export function cardioForm({ initial, submitLabel, onSubmit }) {
  const known = store.cardioTypes();
  const types = [...known, ...STARTER_TYPES.filter((s) => !known.some((k) => store.normalizeName(k) === store.normalizeName(s)))].slice(0, 8);
  let type = initial ? initial.type : (known[0] || STARTER_TYPES[0]);

  const typeInput = h('input', { class: 'field', type: 'text', placeholder: 'Vrsta aktivnosti', autocomplete: 'off', value: type });
  const chips = h('div', { class: 'chips chips--scroll' });
  const renderChips = () => {
    chips.innerHTML = '';
    for (const t of types) {
      const on = store.normalizeName(t) === store.normalizeName(typeInput.value);
      chips.append(h('button', {
        class: `chip${on ? ' is-on' : ''}`, type: 'button', 'aria-pressed': String(on),
        onclick: () => { typeInput.value = t; renderChips(); },
      }, t));
    }
  };
  typeInput.addEventListener('input', renderChips);
  renderChips();

  const field = (label, unit, mode, value) => {
    const input = h('input', { class: 'field field--num', type: 'text', inputmode: mode, autocomplete: 'off', placeholder: '0' });
    if (value != null) input.value = fmt(value, 2);
    return { input, el: h('label', { class: 'form-field' }, h('span', { class: 'form-field__label' }, label),
      h('span', { class: 'form-field__wrap' }, input, h('span', { class: 'form-field__unit' }, unit))) };
  };
  const dur = field('Trajanje', 'min', 'decimal', initial && initial.durationSec != null ? initial.durationSec / 60 : null);
  const dist = field('Razdalja', 'km', 'decimal', initial ? initial.distanceKm : null);
  const kcal = field('Kalorije', 'kcal', 'numeric', initial ? initial.kcal : null);
  const date = h('input', { class: 'field', type: 'date', value: initial ? initial.date : store.todayIso(), max: store.todayIso() });

  const submit = () => {
    const minutes = parseNum(dur.input.value);
    const ok = onSubmit({
      type: typeInput.value.trim() || 'Cardio',
      durationSec: minutes != null ? Math.round(minutes * 60) : null,
      distanceKm: parseNum(dist.input.value),
      kcal: parseNum(kcal.input.value),
      date: date.value || store.todayIso(),
    });
    if (ok && !initial) { dur.input.value = ''; dist.input.value = ''; kcal.input.value = ''; }
  };

  return h('div', { class: 'stack' },
    h('div', { class: 'stack stack--tight' }, chips, typeInput),
    h('div', { class: 'form-grid' }, dur.el, dist.el, kcal.el,
      h('label', { class: 'form-field' }, h('span', { class: 'form-field__label' }, 'Datum'), date)),
    h('button', { class: 'btn btn--primary btn--block', type: 'button', onclick: submit }, submitLabel));
}

export function describeCardio(c) {
  const parts = [];
  if (c.distanceKm) parts.push(`${fmt(c.distanceKm, 2)} km`);
  if (c.durationSec) parts.push(fmtDuration(c.durationSec));
  if (c.kcal) parts.push(`${fmt(c.kcal, 0)} kcal`);
  const pace = fmtPace(c.durationSec, c.distanceKm);
  if (pace && /tek|run|hoja|walk/i.test(c.type)) parts.push(pace);
  return parts.join(' · ');
}

function history(ctx) {
  const list = store.listCardio();
  const wrap = h('div');
  if (!list.length) {
    wrap.append(h('p', { class: 'muted-note' }, 'Tu se bodo zbirale tvoje aktivnosti.'));
    return wrap;
  }
  wrap.append(h('h2', { class: 'section-title' }, 'Zgodovina'));
  let month = null, group = null;
  for (const c of list.slice(0, historyLimit)) {
    const m = c.date.slice(0, 7);
    if (m !== month) {
      month = m;
      const [y, mm] = m.split('-').map(Number);
      wrap.append(h('p', { class: 'group-label' }, `${monthName(mm - 1)} ${y}`));
      group = h('div', { class: 'list' });
      wrap.append(group);
    }
    group.append(h('button', {
      class: 'list-row', type: 'button',
      onclick: () => actionSheet(`${c.type}, ${fmtRelative(c.date)}`, [
        { label: 'Uredi', icon: 'note', onSelect: () => editCardio(ctx, c) },
        { label: 'Izbriši', icon: 'trash', danger: true, onSelect: async () => {
          if (await confirmSheet({ title: 'Izbrišem vnos?', message: `${c.type}, ${fmtRelative(c.date)}: ${describeCardio(c)}`, confirmLabel: 'Izbriši', danger: true })) {
            const snap = store.snapshot();
            store.removeCardio(c.id); ctx.rerender();
            undoToast('Vnos izbrisan', () => { store.restore(snap); ctx.rerender(); });
          }
        } },
      ]),
    },
    h('span', { class: 'list-row__main' },
      h('span', { class: 'list-row__title' }, c.type, c.source === 'strava' ? h('span', { class: 'badge' }, 'Strava') : null),
      h('span', { class: 'list-row__sub' }, `${fmtRelative(c.date)} · ${describeCardio(c) || 'brez podatkov'}`))));
  }
  if (list.length > historyLimit) {
    wrap.append(h('button', { class: 'btn btn--ghost btn--block', type: 'button', style: { marginTop: '12px' },
      onclick: () => { historyLimit += 40; ctx.rerender(); } }, `Pokaži starejše (${list.length - historyLimit})`));
  }
  return wrap;
}

function editCardio(ctx, c) {
  openSheet({
    title: 'Uredi cardio',
    body: (close) => cardioForm({
      initial: c,
      submitLabel: 'Shrani spremembe',
      onSubmit: (entry) => {
        if (entry.durationSec == null && entry.distanceKm == null && entry.kcal == null) { toast('Vpiši vsaj eno številko'); return false; }
        store.updateCardio(c.id, entry);
        close();
        ctx.rerender();
        return true;
      },
    }),
  });
}
