// Zaslon TRENING: brez treninga seznam predlog, med treningom kartice vaj s serijami.
import * as store from '../store.js';
import {
  h, pageHeader, greeting, iconButton, iconEl, openSheet, actionSheet, confirmSheet, promptSheet, toast, undoToast,
  fmt, parseNum, fmtDay, fmtDateLong, fmtRelative, fmtClock, fmtDuration, plural, monthShort,
} from '../ui.js';
import { icon } from '../icons.js';
import { openSettings } from '../settings.js';
import { renderArchive, renderWorkoutDetail, repeatButton, workoutSub } from './archive.js';

export const BAND_INFO = {
  yellow: { name: 'Rumena' },
  green: { name: 'Zelena' },
  teal: { name: 'Turkizna' },
  'red-thin': { name: 'Rdeča tanka' },
  'red-thick': { name: 'Rdeča debela' },
  bw: { name: 'Brez elastike' },
};

const KIND_LABEL = { superset: 'Superset', dropset: 'Dropset', myoreps: 'Myoreps' };

/** Številke serij: dobijo jih normal, band, time, empty; stare vrste nosijo svoje ime. */
export function setLabels(sets) {
  let n = 0;
  return sets.map((s) => (KIND_LABEL[s.kind] ? KIND_LABEL[s.kind] : String(++n)));
}

/** Zapis serije za arhiv in "zadnjič". */
export function describeSet(s) {
  if (s.kind === 'empty') return '—';
  if (s.kind === 'time') return fmtClock(s.seconds);
  if (s.kind === 'band') return `${s.band ? BAND_INFO[s.band].name : '—'} × ${s.reps ?? '—'}`;
  if (s.weightKg == null) return `${s.reps ?? '—'} pon`;
  return `${fmt(s.weightKg, 2)} × ${s.reps ?? '—'}`;
}

export const screen = {
  id: 'trening',
  icon: 'dumbbell',
  label: 'Trening',
  render(root, ctx, params) {
    if (params[0] === 'arhiv' && params[1]) return renderWorkoutDetail(root, params[1]);
    if (params[0] === 'arhiv') return renderArchive(root);
    const draft = store.getDraft();
    return draft ? renderWorkout(root, ctx, draft) : renderHome(root, ctx);
  },
};

// ---------------------------------------------------------------------------
// Brez treninga
// ---------------------------------------------------------------------------

function renderHome(root, ctx) {
  // Najprej predloga, ki je nisi delala najdlje (njen gumb je v barvi); nikoli narejene na koncu.
  const templates = store.listTemplates().sort((a, b) => {
    if (a.lastDate && b.lastDate) return a.lastDate < b.lastDate ? -1 : 1;
    return a.lastDate ? -1 : b.lastDate ? 1 : 0;
  });
  const recent = store.listWorkouts().slice(0, 3);

  root.append(pageHeader({ title: greeting(), right: [iconButton('gear', 'Nastavitve', openSettings)] }));

  const startNew = async () => {
    const name = await promptSheet({
      title: 'Nov trening',
      placeholder: 'npr. Push, Legs, Upper',
      confirmLabel: 'Začni',
    });
    if (name == null) return;
    store.startWorkout(name || 'Trening');
    ctx.rerender();
  };

  const body = h('div', { class: 'content' });
  body.append(weekCard(), h('div', { class: 'fade-sep', 'aria-hidden': 'true' }));

  if (templates.length) {
    body.append(
      h('div', { class: 'section-head' },
        h('h2', { class: 'section-title' }, 'Začni trening'),
        h('div', { class: 'section-head__actions' },
          // Iz arhiva se trening ponovi z enim dotikom.
          h('a', { class: 'pill-btn pill-btn--quiet', href: '#/trening/arhiv' }, 'Arhiv'),
          h('button', { class: 'pill-btn', type: 'button', onclick: startNew }, iconEl('plus', 18), 'Nov'))),
      h('div', { class: 'list' }, templates.map((t, i) => templateRow(ctx, t, i === 0))),
    );
  } else {
    body.append(h('div', { class: 'empty' },
      h('span', { class: 'empty__icon', html: icon('dumbbell', 32) }),
      h('h2', null, 'Prvi trening'),
      h('p', null, 'Daj mu ime, na primer Push ali Legs. Vaje, ki jih dodaš, si aplikacija zapomni in jih naslednjič ponudi sama.'),
      h('button', { class: 'btn btn--primary btn--block', type: 'button', onclick: startNew }, iconEl('plus', 20), 'Nov trening')));
  }

  if (recent.length) {
    body.append(
      h('div', { class: 'section-head' },
        h('h2', { class: 'section-title' }, 'Zadnji treningi'),
        h('a', { class: 'link', href: '#/trening/arhiv' }, 'Vsi')),
      h('div', { class: 'list' }, recent.map((w) => h('div', { class: 'list-row-wrap' },
        h('a', { class: 'list-row', href: `#/trening/arhiv/${w.id}` },
          h('span', { class: 'list-row__main' },
            h('span', { class: 'list-row__title' }, w.name),
            h('span', { class: 'list-row__sub' }, `${fmtRelative(w.date)} · ${workoutSub(w)}`))),
        repeatButton(w)))));
  }

  root.append(body);
}

const WEEK_LETTERS = ['P', 'T', 'S', 'Č', 'P', 'S', 'N'];

/** Kartica tedna: število in trajanje treningov, niz tednov, dnevi s treningom. Dotik odpre Napredek. */
function weekCard() {
  const today = store.todayIso();
  const from = store.weekStart(today);
  const to = store.shiftDay(from, 6);
  const week = store.listWorkouts().filter((w) => { const d = store.dayOf(w.date); return d >= from && d <= to; });
  const n = week.length;
  const sec = week.reduce((sum, w) => sum + (w.durationSec || 0), 0);
  const days = new Set(week.map((w) => store.dayOf(w.date)));
  const streak = store.weekStreak();
  const trainings = plural(n, ['trening', 'treninga', 'treningi', 'treningov']);

  return h('a', { class: 'card card--glow week-card', href: '#/napredek', 'aria-label': `Ta teden ${n} ${trainings}. Odpri napredek.` },
    h('div', { class: 'week-card__top' },
      h('div', null,
        h('p', { class: 'week-card__label' }, 'Ta teden'),
        h('p', { class: 'week-card__big tabular' }, `${n} `, h('span', null, `${trainings}${sec ? ' · ' + fmtDuration(sec) : ''}`))),
      streak ? h('span', { class: 'streak-pill' }, iconEl('flame', 14), `${streak} ${plural(streak, ['teden', 'tedna', 'tedni', 'tednov'])}`) : null),
    h('div', { class: 'week-strip', 'aria-hidden': 'true' }, WEEK_LETTERS.map((letter, i) => {
      const d = store.shiftDay(from, i);
      const done = days.has(d);
      return h('div', { class: `week-day${done ? ' is-done' : ''}${d === today ? ' is-today' : ''}` },
        h('i', { html: done ? icon('check', 15) : null }, done ? null : String(Number(d.slice(8)))),
        letter);
    })));
}

/** Vrstica predloge: ime, kdaj zadnjič, prve vaje. Dotik začne trening. */
function templateRow(ctx, t, first) {
  const names = t.exerciseIds.map((id) => store.getExercise(id)).filter(Boolean).map((e) => e.name);
  const preview = names.length
    ? names.slice(0, 3).join(', ') + (names.length > 3 ? ` +${names.length - 3}` : '')
    : 'še brez vaj';
  const start = () => { store.startWorkout(t.name, t.id); ctx.rerender(); };
  return h('div', { class: 'tpl-row' },
    h('button', { class: 'tpl-row__main', type: 'button', onclick: start, 'aria-label': `Začni trening ${t.name}` },
      h('span', { class: 'tpl-row__top' },
        h('strong', null, t.name),
        h('small', null, t.lastDate ? fmtRelative(t.lastDate) : 'še ne')),
      h('span', { class: 'tpl-row__ex' }, preview)),
    iconButton('more', `Možnosti za ${t.name}`, () => actionSheet(t.name, [
      { label: 'Uredi predlogo', icon: 'note', hint: 'ime, vaje, vrstni red',
        onSelect: () => openTemplateEditor(ctx, t.id) },
      { label: 'Izbriši predlogo', icon: 'trash', danger: true, hint: 'zgodovina ostane',
        onSelect: async () => {
          if (await confirmSheet({ title: `Izbrišem predlogo "${t.name}"?`, message: 'Shranjeni treningi in grafi ostanejo. Izgine samo predloga.', confirmLabel: 'Izbriši', danger: true })) {
            const snap = store.snapshot();
            store.removeTemplate(t.id); ctx.rerender();
            undoToast('Predloga izbrisana', () => { store.restore(snap); ctx.rerender(); });
          }
        } },
    ])),
    h('button', {
      class: `play-btn${first ? ' play-btn--first' : ''}`, type: 'button',
      'aria-label': `Začni trening ${t.name}`, onclick: start, html: icon('play', 16),
    }));
}

// ---------------------------------------------------------------------------
// Trening v teku
// ---------------------------------------------------------------------------

function renderWorkout(root, ctx, draft) {
  const started = new Date(draft.startedAt);
  const editing = !!draft.editingId;
  const lastCtx = store.lastContext(draft);

  // --- glava ---
  // Pri urejanju shranjenega treninga štoparica ne teče; pokaže se shranjeno trajanje.
  const timer = h('span', { class: 'chip chip--static chip--live' }, iconEl('timer', 16), h('strong', { class: 'tabular' }, ''));
  const tick = () => {
    const sec = (Date.now() - started.getTime()) / 1000;
    timer.lastChild.textContent = sec >= 0 && sec < 12 * 3600 ? fmtClock(sec) : '—';
  };
  let interval = null;
  if (editing) timer.lastChild.textContent = draft.durationSec ? fmtDuration(draft.durationSec) : '—';
  else { tick(); interval = setInterval(tick, 1000); }

  const dateInput = h('input', {
    type: 'date', class: 'chip__overlay', 'aria-label': 'Datum treninga',
    value: store.dayOf(started), max: store.todayIso(),
    onchange: (e) => {
      if (!e.target.value) return;
      const [y, m, d] = e.target.value.split('-').map(Number);
      store.updateDraft((dr) => {
        const t = new Date(dr.startedAt);
        t.setFullYear(y, m - 1, d);
        dr.startedAt = t.toISOString();
      });
      ctx.rerender();
    },
  });

  const rename = async () => {
    const name = await promptSheet({ title: 'Ime treninga', value: draft.name, confirmLabel: 'Shrani' });
    if (name) { store.updateDraft((d) => { d.name = name; }); ctx.rerender(); }
  };

  root.append(pageHeader({
    eyebrow: editing ? 'Urejaš shranjen trening' : 'Trening v teku',
    live: !editing,
    titleEl: h('button', { class: 'title-btn', type: 'button', onclick: rename, 'aria-label': `Preimenuj trening ${draft.name}` },
      h('h1', null, draft.name), iconEl('note', 18)),
    right: [iconButton('gear', 'Nastavitve', openSettings)],
  }));

  // Koliko serij je vpisanih: šteje se sproti, med tipkanjem.
  const countOf = () => {
    let filled = 0, total = 0;
    for (const e of store.getDraft().exercises) {
      for (const s of e.sets) {
        if (s.kind === 'empty') continue;
        total++;
        if (s.weightKg != null || s.reps != null || s.seconds != null || s.band) filled++;
      }
    }
    return { filled, total };
  };
  const count = h('span', { class: 'chip chip--static' }, h('strong', { class: 'tabular' }, ''), h('small', { class: 'tabular' }, ''));
  const refreshCount = () => {
    const { filled, total } = countOf();
    count.firstChild.textContent = String(filled);
    count.lastChild.textContent = `/ ${total} ${plural(total, ['serija', 'seriji', 'serije', 'serij'])}`;
  };
  refreshCount();

  const body = h('div', { class: 'content content--workout' });
  body.addEventListener('input', refreshCount);
  body.append(h('div', { class: 'meta-row' },
    timer,
    h('label', { class: 'chip' }, iconEl('calendar', 16),
      h('span', null, `${fmtDateLong(started).split(',')[0]}, ${started.getDate()}. ${monthShort(started.getMonth())}`), dateInput),
    count),
  h('div', { class: 'fade-sep', 'aria-hidden': 'true' }));

  // --- vaje ---
  if (!draft.exercises.length) {
    body.append(h('div', { class: 'empty empty--compact' },
      h('p', null, 'Dodaj prvo vajo. Iz zgodovine bo prinesla, kaj si naredila zadnjič.')));
  }
  draft.exercises.forEach((entry, idx) => {
    const card = exerciseCard(ctx, entry, idx, draft.exercises.length, lastCtx);
    body.append(card);
  });

  body.append(h('button', {
    class: 'btn btn--dashed btn--block', type: 'button',
    onclick: () => pickExercise({
      title: 'Dodaj vajo',
      exclude: draft.exercises.map((e) => e.exerciseId),
      onPick: (ex) => {
        const sets = store.emptySetsLike(store.lastSetsFor(ex.id, store.lastContext(draft)));
        store.updateDraft((d) => d.exercises.push({ exerciseId: ex.id, note: '', sets }));
        ctx.rerender({ scrollTo: `.ex-card[data-idx="${draft.exercises.length}"]` });
      },
    }),
  }, iconEl('plus', 20), 'Dodaj vajo'));

  root.append(body);

  // --- spodnja dejanja ---
  const hasData = () => store.getDraft().exercises.some((e) => e.sets.some((s) =>
    s.kind === 'empty' || s.weightKg != null || s.reps != null || s.seconds != null || s.band));
  const finish = async () => {
    if (editing) {
      if (!hasData()) {
        toast('Trening brez serij ne more ostati. Izbrišeš ga v arhivu.');
        return;
      }
      const id = draft.editingId;
      store.saveWorkout();
      toast('Spremembe shranjene');
      location.hash = `#/trening/arhiv/${id}`;
      return;
    }
    if (!hasData()) {
      const ok = await confirmSheet({ title: 'Ni vpisane nobene serije', message: 'Shranim samo predlogo z vajami? V zgodovino ne gre nič.', confirmLabel: 'Shrani predlogo' });
      if (!ok) return;
    }
    const w = store.saveWorkout();
    toast(w ? 'Trening shranjen' : 'Predloga shranjena');
    ctx.rerender();
  };
  const discard = async () => {
    if (editing) {
      if (await confirmSheet({ title: 'Prekličem urejanje?', message: 'Spremembe se ne shranijo. Trening ostane, kot je bil.', confirmLabel: 'Prekliči urejanje', danger: true })) {
        const id = draft.editingId;
        store.discardDraft();
        location.hash = `#/trening/arhiv/${id}`;
      }
      return;
    }
    if (await confirmSheet({ title: 'Zavržem trening?', message: 'Vpisane serije tega treninga se izgubijo. Predloga ostane, kot je bila.', confirmLabel: 'Zavrži', danger: true })) {
      const snap = store.snapshot();
      store.discardDraft();
      ctx.rerender();
      undoToast('Trening zavržen', () => { store.restore(snap); ctx.rerender(); });
    }
  };
  root.append(h('div', { class: 'action-bar' },
    h('button', { class: 'btn btn--ghost', type: 'button', onclick: discard }, editing ? 'Prekliči' : 'Zavrži'),
    h('button', { class: 'btn btn--primary', type: 'button', onclick: finish }, editing ? 'Shrani spremembe' : 'Končaj trening')));

  return () => { if (interval) clearInterval(interval); };
}

/** Zapisek za to vajo samo v tem treningu (npr. "rama me je bolela"). */
async function editSessionNote(ctx, idx, entry, name) {
  const note = await promptSheet({
    title: `Zapisek za danes · ${name}`,
    value: entry.note || '',
    placeholder: 'npr. rama me je bolela',
    multiline: true,
    confirmLabel: 'Shrani',
  });
  if (note == null) return;
  store.updateDraft((d) => { d.exercises[idx].note = note.trim(); });
  ctx.rerender();
}

function exerciseCard(ctx, entry, idx, total, lastCtx) {
  const ex = store.getExercise(entry.exerciseId);
  const name = ex ? ex.name : 'Neznana vaja';
  const lastEntry = store.lastEntryFor(entry.exerciseId, lastCtx);
  const last = lastEntry ? lastEntry.sets : [];
  const lastDate = lastEntry ? lastEntry.date : null;

  const menu = () => actionSheet(name, [
    ex && { label: 'Statistika vaje', icon: 'chart', hint: 'trening ostane odprt',
      onSelect: () => { location.hash = `#/napredek/vaja/${ex.id}`; } },
    { label: entry.note ? 'Uredi zapisek za ta trening' : 'Zapisek za ta trening', icon: 'note', hint: 'samo danes',
      onSelect: () => editSessionNote(ctx, idx, entry, name) },
    { label: ex && ex.note ? 'Uredi splošni zapisek vaje' : 'Splošni zapisek vaje', icon: 'note', hint: 'vedno',
      onSelect: async () => {
        const note = await promptSheet({ title: `Splošni zapisek · ${name}`, value: ex.note, placeholder: 'npr. sedež 4, širok oprijem', multiline: true, confirmLabel: 'Shrani' });
        if (note != null) { store.updateExercise(ex.id, { note }); ctx.rerender(); }
      } },
    { label: ex && ex.usesBodyweight ? 'Vaja z lastno težo: DA' : 'Vaja z lastno težo: NE', icon: 'scale',
      hint: 'graf moči prišteje telesno težo',
      onSelect: () => { store.updateExercise(ex.id, { usesBodyweight: !ex.usesBodyweight }); toast(!ex.usesBodyweight ? 'Označeno: lastna teža' : 'Ni več vaja z lastno težo'); ctx.rerender(); } },
    ex && { label: 'Preimenuj vajo', icon: 'note', hint: 'ali združi z drugo', onSelect: async () => {
      await renameExercise(ex);
      ctx.rerender();
    } },
    idx > 0 && { label: 'Premakni gor', icon: 'up', onSelect: () => { move(idx, -1); ctx.rerender(); } },
    idx < total - 1 && { label: 'Premakni dol', icon: 'down', onSelect: () => { move(idx, 1); ctx.rerender(); } },
    { label: 'Odstrani iz treninga', icon: 'trash', danger: true, onSelect: () => {
      const snap = store.snapshot();
      store.updateDraft((d) => d.exercises.splice(idx, 1)); ctx.rerender();
      undoToast(`${name} odstranjena`, () => { store.restore(snap); ctx.rerender(); });
    } },
  ]);

  const card = h('section', { class: 'ex-card', dataset: { idx } });
  const grip = h('button', {
    class: 'icon-btn icon-btn--on-accent ex-card__grip', type: 'button',
    'aria-label': `Premakni ${name} (drži in povleci)`,
  }, iconEl('grip', 20));
  if (total > 1) enableDrag(grip, card, ctx);
  card.append(h('div', { class: `ex-card__head${total > 1 ? ' has-grip' : ''}` },
    total > 1 ? grip : null,
    h('h3', null, name),
    iconButton('more', `Možnosti za ${name}`, menu, 'icon-btn--on-accent')));

  if (ex && ex.note) card.append(h('p', { class: 'ex-card__note' }, iconEl('note', 12), ex.note));
  if (entry.note) {
    card.append(h('button', {
      class: 'ex-card__session-note', type: 'button', 'aria-label': `Uredi zapisek za ta trening: ${entry.note}`,
      onclick: () => editSessionNote(ctx, idx, entry, name),
    }, iconEl('note', 14), h('span', null, entry.note)));
  }
  // Serije od zadnjič stojijo desno v vsaki vrstici; tu ostane samo zapisek od zadnjič.
  if (lastEntry && lastEntry.note) {
    card.append(h('p', { class: 'ex-card__last ex-card__last-note' },
      h('span', null, `Zadnjič ${fmtDay(lastDate)}: `), `„${lastEntry.note}“`));
  }

  const labels = setLabels(entry.sets);
  const rows = h('div', { class: 'sets' });
  entry.sets.forEach((s, i) => rows.append(setRow(ctx, entry, idx, i, s, labels[i], last[i])));
  card.append(rows);

  const addSet = (kind) => {
    store.updateDraft((d) => d.exercises[idx].sets.push(store.newSet(kind)));
    ctx.rerender({ focus: `[data-ex="${idx}"][data-set="${entry.sets.length}"] input` });
  };
  const lastKind = entry.sets.length ? entry.sets[entry.sets.length - 1].kind : 'normal';
  const defaultKind = store.SET_KINDS.includes(lastKind) && lastKind !== 'empty' ? lastKind : 'normal';
  card.append(h('div', { class: 'ex-card__foot' },
    h('button', { class: 'btn btn--soft', type: 'button', onclick: () => addSet(defaultKind) }, iconEl('plus', 18), 'Serija'),
    h('button', {
      class: 'btn btn--soft btn--quiet', type: 'button',
      onclick: () => actionSheet('Vrsta serije', [
        { label: 'Navaden set', hint: 'kg × ponovitve', icon: 'dumbbell', onSelect: () => addSet('normal') },
        { label: 'Elastika', hint: 'barva × ponovitve', icon: 'band', onSelect: () => addSet('band') },
        { label: 'Čas', hint: 'minute : sekunde', icon: 'timer', onSelect: () => addSet('time') },
        { label: 'Prazen set', hint: 'samo oznaka', icon: 'more', onSelect: () => addSet('empty') },
      ]),
    }, 'Vrsta …'),
    entry.note ? null : h('button', {
      class: 'btn btn--soft btn--quiet btn--icon', type: 'button',
      'aria-label': `Zapisek za ta trening pri ${name}`,
      onclick: () => editSessionNote(ctx, idx, entry, name),
    }, iconEl('note', 18))));
  return card;
}

// ---------------------------------------------------------------------------
// Premikanje vaj z vlečenjem (prenešeno iz stare aplikacije)
// ---------------------------------------------------------------------------
// Vgrajeni drag-and-drop na telefonu ne dela, zato tečejo pointer dogodki.
// Med vlečenjem se premika samo slika; zaporedje se zapiše, ko prst spustiš.

const SCROLL_EDGE = 90;   // px: pas ob robu, kjer se stran sama pomika
const SCROLL_SPEED = 16;  // px na sličico pri samem robu

function enableDrag(handle, card, ctx) {
  handle.addEventListener('pointerdown', (event) => {
    if (event.button > 0) return;
    startDrag(event, card, ctx);
  });
}

function startDrag(event, card, ctx) {
  const list = card.parentElement;
  const cards = [...list.querySelectorAll(':scope > .ex-card')];
  const from = cards.indexOf(card);
  if (from < 0 || cards.length < 2) return;
  event.preventDefault();

  const rects = cards.map((n) => n.getBoundingClientRect());
  const gap = Math.max(0, rects[1].top - rects[0].bottom);
  const step = rects[from].height + gap;
  const scroller = document.getElementById('screen');
  const startScroll = scroller.scrollTop;
  const startY = event.clientY;
  let pointerY = event.clientY;
  let to = from;
  let frame = 0;

  card.classList.add('is-dragging');
  list.classList.add('is-reordering');
  if (navigator.vibrate) navigator.vibrate(8);

  const middle = (r) => r.top + r.height / 2;
  const update = () => {
    const shift = pointerY - startY + (scroller.scrollTop - startScroll);
    card.style.transform = `translateY(${shift}px)`;
    const center = middle(rects[from]) + shift;
    let next = from;
    while (next > 0 && center < middle(rects[next - 1])) next--;
    while (next < rects.length - 1 && center > middle(rects[next + 1])) next++;
    if (next === to) return;
    to = next;
    cards.forEach((n, i) => {
      if (i === from) return;
      let off = 0;
      if (to > from && i > from && i <= to) off = -step;
      if (to < from && i >= to && i < from) off = step;
      n.style.transform = off ? `translateY(${off}px)` : '';
    });
  };

  // Bližje robu je prst, hitreje se stran pomika.
  const tick = () => {
    frame = requestAnimationFrame(tick);
    const box = scroller.getBoundingClientRect();
    const bottom = Math.min(box.bottom, window.innerHeight) - 140; // nad spodnjimi gumbi
    let delta = 0;
    if (pointerY > bottom - SCROLL_EDGE) delta = SCROLL_SPEED * Math.min(1, (pointerY - (bottom - SCROLL_EDGE)) / SCROLL_EDGE);
    else if (pointerY < box.top + SCROLL_EDGE) delta = -SCROLL_SPEED * Math.min(1, (box.top + SCROLL_EDGE - pointerY) / SCROLL_EDGE);
    if (!delta) return;
    const before = scroller.scrollTop;
    scroller.scrollTop = before + delta;
    if (scroller.scrollTop !== before) update();
  };

  const move = (e) => { pointerY = e.clientY; update(); };
  const end = () => {
    cancelAnimationFrame(frame);
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', end);
    window.removeEventListener('pointercancel', end);
    cards.forEach((n) => { n.style.transform = ''; });
    card.classList.remove('is-dragging');
    list.classList.remove('is-reordering');
    if (to === from) return;
    store.updateDraft((d) => {
      const [x] = d.exercises.splice(from, 1);
      d.exercises.splice(to, 0, x);
    });
    ctx.rerender();
  };

  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', end);
  window.addEventListener('pointercancel', end);
  frame = requestAnimationFrame(tick);
}

function move(idx, dir) {
  store.updateDraft((d) => {
    const [x] = d.exercises.splice(idx, 1);
    d.exercises.splice(idx + dir, 0, x);
  });
}

/**
 * Vrstica serije kot v stari aplikaciji:
 *   Set N · [kg] kg × [pon] │ [kg] × [pon]  ← zadnjič; dotik številke jo prepiše v današnjo serijo.
 * Kljukice ni: serija šteje, ko so v njej številke.
 */
function setRow(ctx, entry, exIdx, setIdx, s, label, prev) {
  const update = (patch) => store.updateDraft((d) => Object.assign(d.exercises[exIdx].sets[setIdx], patch));
  const copy = (patch) => {
    update(patch);
    if (navigator.vibrate) navigator.vibrate(8);
    ctx.rerender();
  };
  const row = h('div', { class: 'set-row', dataset: { ex: exIdx, set: setIdx } });

  const named = !!KIND_LABEL[s.kind];
  row.append(h('button', {
    class: `set-label${named ? ' set-label--named' : ''}`, type: 'button',
    'aria-label': `Serija ${label}, možnosti`,
    onclick: () => actionSheet(`Serija ${label}`, [
      { label: 'Odstrani serijo', icon: 'trash', danger: true, onSelect: () => {
        const snap = store.snapshot();
        store.updateDraft((d) => d.exercises[exIdx].sets.splice(setIdx, 1)); ctx.rerender();
        undoToast('Serija odstranjena', () => { store.restore(snap); ctx.rerender(); });
      } },
    ]),
  }, named ? label : `Set ${label}`));

  if (s.kind === 'empty') {
    row.append(h('span', { class: 'set-empty' }, 'Prazen set'));
    return row;
  }

  // Zadnjič se prepiše samo iz serije iste vrste (teža elastike ni teža).
  const prevSame = prev && prev.kind === s.kind ? prev : (prev && s.kind === 'normal' && KIND_LABEL[prev.kind] ? prev : null);
  const ref = (text, patch, what) => h('button', {
    class: 'set-ref', type: 'button',
    disabled: patch ? null : true,
    'aria-label': patch ? `Prepiši ${what} od zadnjič` : null,
    onclick: patch ? () => copy(patch) : null,
  }, text == null ? '–' : text);
  const vline = () => h('span', { class: 'set-vline', 'aria-hidden': 'true' });

  if (s.kind === 'time') {
    const mm = numInput({ value: s.seconds != null ? Math.floor(s.seconds / 60) : null, label: 'minute', mode: 'numeric' });
    const ss = numInput({ value: s.seconds != null ? s.seconds % 60 : null, label: 'sekunde', mode: 'numeric', pad: true });
    const sync = () => {
      const m = parseNum(mm.value), sec = parseNum(ss.value);
      update({ seconds: m == null && sec == null ? null : Math.round((m || 0) * 60 + (sec || 0)) });
    };
    mm.addEventListener('input', sync); ss.addEventListener('input', sync);
    const ps = prevSame && prevSame.seconds != null ? prevSame.seconds : null;
    const r = ref(ps != null ? fmtClock(ps) : null, ps != null ? { seconds: ps } : null, `čas ${fmtClock(ps)}`);
    r.classList.add('set-ref--wide');
    row.append(mm, h('span', { class: 'set-unit' }, ':'), ss, vline(), r);
    return row;
  }

  if (s.kind === 'band') {
    const bandBtn = h('button', {
      class: `band-pick${s.band ? ' band--' + s.band : ''}`, type: 'button',
      'aria-label': s.band ? `Elastika ${BAND_INFO[s.band].name}, zamenjaj` : 'Izberi elastiko',
      html: s.band ? bandIcon(s.band) : null,
      onclick: () => actionSheet('Elastika', [
        ...store.BANDS.map((b) => ({ label: BAND_INFO[b].name, onSelect: () => { update({ band: b }); ctx.rerender(); } })),
        s.band && { label: 'Počisti izbiro', icon: 'close', onSelect: () => { update({ band: null }); ctx.rerender(); } },
      ]),
    }, s.band ? null : 'izberi');
    const reps = numInput({ value: s.reps, label: 'ponovitve', mode: 'numeric' });
    reps.addEventListener('input', () => update({ reps: parseNum(reps.value) }));
    const pb = prevSame && prevSame.band ? prevSame.band : null;
    const pr = prevSame && prevSame.reps != null ? prevSame.reps : null;
    const rb = h('button', {
      class: `set-ref${pb ? ' band--' + pb : ''}`, type: 'button',
      disabled: pb ? null : true,
      'aria-label': pb ? `Prepiši elastiko ${BAND_INFO[pb].name} od zadnjič` : null,
      onclick: pb ? () => copy({ band: pb }) : null,
      html: pb ? bandIcon(pb) : '–',
    });
    row.append(bandBtn, h('span', { class: 'set-unit' }, '×'), reps, vline(),
      rb, h('span', { class: 'set-x' }, '×'), ref(pr, pr != null ? { reps: pr } : null, `ponovitve ${pr}`));
    return row;
  }

  // navadna serija in stare vrste
  const kg = numInput({ value: s.weightKg, label: 'kilogrami', mode: 'decimal' });
  const reps = numInput({ value: s.reps, label: 'ponovitve', mode: 'numeric' });
  kg.addEventListener('input', () => update({ weightKg: parseNum(kg.value) }));
  reps.addEventListener('input', () => update({ reps: parseNum(reps.value) }));
  const pw = prevSame && prevSame.weightKg != null ? prevSame.weightKg : null;
  const pr = prevSame && prevSame.reps != null ? prevSame.reps : null;
  row.append(kg, h('span', { class: 'set-unit' }, 'kg ×'), reps, vline(),
    ref(pw != null ? fmt(pw, 2) : null, pw != null ? { weightKg: pw } : null, `težo ${fmt(pw, 2)} kg`),
    h('span', { class: 'set-x' }, '×'),
    ref(pr, pr != null ? { reps: pr } : null, `ponovitve ${pr}`));
  return row;
}

/** Risba elastike: zanka v barvi elastike, debela rdeča z debelejšo črto. "BW" je brez elastike. */
function bandIcon(band) {
  if (band === 'bw') return '<span class="band-bw">BW</span>';
  return `<svg class="band-loop" viewBox="0 0 44 26" fill="none" stroke="currentColor" stroke-width="${band === 'red-thick' ? 6 : 3.5}" aria-hidden="true"><ellipse cx="22" cy="13" rx="14.5" ry="4" transform="rotate(-18 22 13)"/></svg>`;
}

/** Številsko polje. Prazno ostane prazno; številka od zadnjič stoji desno v vrstici. */
function numInput({ value, label, mode, pad = false }) {
  const show = (v) => (v == null ? '' : pad ? String(v).padStart(2, '0') : fmt(v, 2));
  const input = h('input', {
    class: 'set-input', type: 'text', inputmode: mode, autocomplete: 'off', enterkeyhint: 'next',
    'aria-label': label,
  });
  input.value = show(value);
  // "102,5" pri polni pisavi zadene ob rob ozke škatlice, zato se pisava pomanjša.
  const fit = () => input.classList.toggle('is-long', input.value.length > 4);
  fit();
  input.addEventListener('input', fit);
  input.addEventListener('focus', () => input.select());
  input.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const all = [...document.querySelectorAll('.set-input')];
    const next = all[all.indexOf(input) + 1];
    if (next) next.focus(); else input.blur();
  });
  return input;
}

// ---------------------------------------------------------------------------
// Izbira vaje
// ---------------------------------------------------------------------------

/**
 * Izbira vaje s spiskom in iskanjem. exclude: id-ji, ki jih ni na seznamu.
 * allowNew: ali lahko vpišeš novo vajo. onPick(ex) dobi izbrano vajo.
 */
export function pickExercise({ title, exclude = [], allowNew = true, onPick }) {
  const used = exclude;

  openSheet({
    title,
    tall: true,
    body: (close) => {
      const input = h('input', { class: 'field', type: 'search', placeholder: allowNew ? 'Išči ali vpiši novo vajo' : 'Išči vajo', autocomplete: 'off', enterkeyhint: 'done' });
      const list = h('div', { class: 'picker-list' });

      const add = (ex) => {
        if (!ex || used.includes(ex.id)) return;
        close();
        onPick(ex);
      };

      const renderList = () => {
        list.innerHTML = '';
        const q = input.value.trim();
        const found = store.searchExercises(q, used);
        const exact = q && store.findExerciseByName(q);
        if (allowNew && q && !exact) {
          list.append(h('button', { class: 'picker-row picker-row--new', type: 'button', onclick: () => add(store.createExercise(q)) },
            iconEl('plus', 20), h('span', null, 'Nova vaja: ', h('strong', null, q))));
        }
        for (const ex of found) {
          const ld = store.lastDateFor(ex.id);
          list.append(h('button', { class: 'picker-row', type: 'button', onclick: () => add(ex) },
            h('span', { class: 'picker-row__name' }, ex.name),
            h('span', { class: 'picker-row__sub' }, ld ? fmtRelative(ld) : 'še ne')));
        }
        if (!q && !found.length) {
          list.append(h('p', { class: 'picker-hint' }, 'Seznam vaj nastane iz tvojih vnosov. Vpiši ime prve vaje, npr. "BB bench press".'));
        }
      };
      input.addEventListener('input', renderList);
      input.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        const q = input.value.trim();
        if (q) add(store.findExerciseByName(q) || (allowNew ? store.createExercise(q) : null));
      });
      renderList();
      setTimeout(() => input.focus(), 320);
      return h('div', { class: 'picker' }, input, list);
    },
  });
}

// ---------------------------------------------------------------------------
// Preimenovanje in združevanje vaj (tudi iz statistike vaje)
// ---------------------------------------------------------------------------

/** Združi from v into in ponudi Razveljavi. back: kam se vrne razveljavitev. */
function mergeWithUndo(from, into, back = null) {
  const snap = store.snapshot();
  store.mergeExercises(from.id, into.id);
  undoToast(`Združeno v ${into.name}`, () => {
    store.restore(snap);
    if (back && location.hash !== back) location.hash = back;
    else window.dispatchEvent(new Event('app:rerender'));
  });
}

async function confirmMerge(from, into) {
  return confirmSheet({
    title: `Združim "${from.name}" v "${into.name}"?`,
    message: `Vsi treningi z vajo "${from.name}" dobijo vajo "${into.name}". Če sta obe v istem treningu, se serije zložijo skupaj. "${from.name}" izgine s seznama.`,
    confirmLabel: 'Združi',
  });
}

/**
 * Preimenuje vajo. Če ime že ima druga vaja, ponudi združitev.
 * Vrne id vaje, ki ostane (pri združitvi druga), ali null.
 */
export async function renameExercise(ex, back = null) {
  const n = await promptSheet({ title: 'Ime vaje', value: ex.name, confirmLabel: 'Shrani' });
  if (!n || n === ex.name) return null;
  if (store.updateExercise(ex.id, { name: n })) return ex.id;
  const other = store.findExerciseByName(n);
  if (!other || other.id === ex.id) return null;
  if (!(await confirmMerge(ex, other))) return null;
  mergeWithUndo(ex, other, back);
  return other.id;
}

/** Izbere drugo vajo in vanjo združi ex. after(into) se kliče po združitvi. */
export function mergeExercisePicker(ex, back, after) {
  pickExercise({
    title: `Združi "${ex.name}" z …`,
    exclude: [ex.id],
    allowNew: false,
    onPick: async (into) => {
      if (!(await confirmMerge(ex, into))) return;
      mergeWithUndo(ex, into, back);
      after(into);
    },
  });
}

// ---------------------------------------------------------------------------
// Urejanje predloge brez treninga
// ---------------------------------------------------------------------------

function openTemplateEditor(ctx, templateId) {
  openSheet({
    title: 'Uredi predlogo',
    tall: true,
    onClose: () => ctx.rerender(),
    body: () => {
      const wrap = h('div', { class: 'stack' });
      const draw = () => {
        wrap.replaceChildren();
        const t = store.getTemplate(templateId);
        if (!t) return;
        const ids = t.exerciseIds.filter((id) => store.getExercise(id));
        const save = (next) => { store.updateTemplate(t.id, { exerciseIds: next }); draw(); };
        const swap = (i, j) => { const n = [...ids]; [n[i], n[j]] = [n[j], n[i]]; save(n); };
        const rename = async () => {
          const n = await promptSheet({ title: 'Ime predloge', value: t.name, confirmLabel: 'Shrani' });
          if (n && n !== t.name && !store.updateTemplate(t.id, { name: n })) toast('To ime že ima druga predloga');
          draw();
        };
        wrap.append(
          h('div', { class: 'action-list' },
            h('button', { class: 'action', type: 'button', onclick: rename },
              iconEl('note', 20), h('span', { class: 'action__label' }, t.name), h('span', { class: 'action__hint' }, 'preimenuj'))),
          ids.length
            ? h('div', { class: 'tpl-edit' }, ids.map((id, i) => h('div', { class: 'tpl-edit__row' },
                h('span', { class: 'tpl-edit__name' }, store.getExercise(id).name),
                h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Premakni gor', disabled: i === 0, onclick: () => swap(i, i - 1), html: icon('up', 20) }),
                h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Premakni dol', disabled: i === ids.length - 1, onclick: () => swap(i, i + 1), html: icon('down', 20) }),
                h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Odstrani iz predloge', onclick: () => save(ids.filter((x) => x !== id)), html: icon('close', 20) }))))
            : h('p', { class: 'sheet__text' }, 'Predloga še nima vaj.'),
          h('button', {
            class: 'btn btn--dashed btn--block', type: 'button',
            onclick: () => pickExercise({ title: 'Dodaj vajo v predlogo', exclude: ids, onPick: (ex) => save([...ids, ex.id]) }),
          }, iconEl('plus', 20), 'Dodaj vajo'),
          h('p', { class: 'hint' }, 'Spremembe se shranijo sproti. Preimenovanje preimenuje tudi pretekle treninge s tem imenom.'));
      };
      draw();
      return wrap;
    },
  });
}
