// Arhiv treningov (pod zavihkom TRENING, #/trening/arhiv): seznam, podrobnosti,
// ponovi, uredi, izbriši. Ni svoj zavihek, zato ga ni v SCREENS.
import * as store from '../store.js';
import {
  h, iconEl, confirmSheet, toast, undoToast, subHeader,
  fmtDate, fmtDateLong, fmtDuration, plural, monthName,
} from '../ui.js';
import { describeSet, setLabels } from './training.js';

let archiveQuery = '';

/** Glava podzaslona: zgoraj okrogel gumb nazaj, pod njim velik naslov. */
export function backHeader(title, href, opts = {}) {
  return subHeader({ back: href, title, ...opts });
}

/** Ponovi trening: iste vaje, enako število serij. Gre na zaslon treninga. */
export function repeatFromArchive(w) {
  if (store.getDraft()) {
    toast('Najprej končaj ali zavrzi trening v teku');
    location.hash = '#/trening';
    return;
  }
  store.repeatWorkout(w.id);
  location.hash = '#/trening';
}

function editFromArchive(w) {
  if (store.getDraft()) {
    toast('Najprej končaj ali zavrzi trening v teku');
    location.hash = '#/trening';
    return;
  }
  store.editWorkout(w.id);
  location.hash = '#/trening';
}

export function workoutSub(w) {
  const sets = w.exercises.reduce((n, e) => n + e.sets.length, 0);
  return `${w.exercises.length} ${plural(w.exercises.length, ['vaja', 'vaji', 'vaje', 'vaj'])} · ${sets} ${plural(sets, ['serija', 'seriji', 'serije', 'serij'])}${w.durationSec ? ' · ' + fmtDuration(w.durationSec) : ''}`;
}

/** Gumb "Ponovi" na desni strani vrstice v seznamu. */
export function repeatButton(w) {
  return h('button', {
    class: 'repeat-btn', type: 'button', 'aria-label': `Ponovi trening ${w.name}`,
    onclick: () => repeatFromArchive(w),
  }, iconEl('repeat', 18), h('span', null, 'Ponovi'));
}

export function renderArchive(root) {
  root.append(backHeader('Arhiv treningov', '#/trening'));
  const body = h('div', { class: 'content' });
  const search = h('input', { class: 'field', type: 'search', placeholder: 'Išči po imenu ali datumu (npr. push, 3.11.)', value: archiveQuery, autocomplete: 'off' });
  const list = h('div');
  const renderList = () => {
    list.innerHTML = '';
    const ws = store.listWorkouts(archiveQuery);
    if (!ws.length) {
      list.append(h('p', { class: 'muted-note' }, archiveQuery ? 'Nič ne ustreza iskanju.' : 'Shranjeni treningi se bodo pokazali tukaj.'));
      return;
    }
    let month = null, group = null;
    for (const w of ws) {
      const d = new Date(w.date);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (key !== month) {
        month = key;
        list.append(h('p', { class: 'group-label' }, `${monthName(d.getMonth())} ${d.getFullYear()}`));
        group = h('div', { class: 'list' });
        list.append(group);
      }
      group.append(h('div', { class: 'list-row-wrap' },
        h('a', { class: 'list-row', href: `#/trening/arhiv/${w.id}` },
          h('span', { class: 'date-badge' }, h('strong', null, String(d.getDate())), h('span', null, fmtDateLong(d).slice(0, 3))),
          h('span', { class: 'list-row__main' },
            h('span', { class: 'list-row__title' }, w.name),
            h('span', { class: 'list-row__sub' }, workoutSub(w)))),
        repeatButton(w)));
    }
  };
  search.addEventListener('input', () => { archiveQuery = search.value; renderList(); });
  renderList();
  body.append(search, list);
  root.append(body);
}

export function renderWorkoutDetail(root, id) {
  const w = store.listWorkouts().find((x) => x.id === id);
  root.append(backHeader(w ? w.name : 'Trening', '#/trening/arhiv', w ? {
    eyebrow: `${fmtDateLong(w.date)} ${new Date(w.date).getFullYear()}`,
    sub: workoutSub(w),
  } : {}));
  const body = h('div', { class: 'content' });
  if (!w) {
    body.append(h('p', { class: 'muted-note' }, 'Tega treninga ni več.'));
    root.append(body);
    return;
  }

  body.append(h('div', { class: 'detail-actions' },
    h('button', { class: 'btn btn--primary', type: 'button', onclick: () => repeatFromArchive(w) }, iconEl('repeat', 20), 'Ponovi'),
    h('button', { class: 'btn btn--secondary', type: 'button', onclick: () => editFromArchive(w) }, iconEl('note', 18), 'Uredi')));

  for (const e of w.exercises) {
    const ex = store.getExercise(e.exerciseId);
    const labels = setLabels(e.sets);
    const records = ex ? store.recordSetKeys(ex.id) : new Set();
    body.append(h('section', { class: 'ex-card ex-card--read' },
      h('div', { class: 'ex-card__head' },
        ex ? h('a', { class: 'ex-card__title-link', href: `#/napredek/vaja/${ex.id}` }, h('h3', null, ex.name)) : h('h3', null, 'Izbrisana vaja')),
      e.note ? h('p', { class: 'ex-card__session-note' }, e.note) : null,
      h('div', { class: 'read-sets' }, e.sets.map((s, i) => h('div', { class: `read-set${records.has(`${w.id}:${i}`) ? ' is-pr' : ''}` },
        h('span', { class: 'set-label' }, labels[i]),
        h('span', { class: 'tabular' }, describeSet(s)))))));
  }
  body.append(h('button', {
    class: 'btn btn--danger-ghost btn--block', type: 'button',
    onclick: async () => {
      if (await confirmSheet({ title: 'Izbrišem trening?', message: `${w.name}, ${fmtDate(w.date)}. Izgine iz arhiva in grafov. Predloga in vaje ostanejo.`, confirmLabel: 'Izbriši', danger: true })) {
        const snap = store.snapshot();
        store.removeWorkout(w.id);
        location.hash = '#/trening/arhiv';
        undoToast('Trening izbrisan', () => { store.restore(snap); location.hash = `#/trening/arhiv/${w.id}`; });
      }
    },
  }, iconEl('trash', 18), 'Izbriši trening'));
  root.append(body);
}
