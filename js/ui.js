// Gradniki vmesnika: izdelava elementov, spodnje okno (sheet), potrditev, obvestilo,
// in oblikovanje števil/datumov v slovenščini.
import { icon } from './icons.js';

// ---------- elementi ----------

/** h('button', { class: 'btn', onclick }, 'Napis', otrok, [seznam]) */
export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k === 'style' && typeof v === 'object') {
        // CSS spremenljivke (--x) gredo samo prek setProperty.
        for (const [sk, sv] of Object.entries(v)) {
          if (sk.startsWith('--')) el.style.setProperty(sk, sv); else el.style[sk] = sv;
        }
      }
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'value') el.value = v;
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, v);
    }
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children) {
    if (c == null || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

export function iconEl(name, size) {
  const span = document.createElement('span');
  span.className = 'i';
  span.innerHTML = icon(name, size);
  return span;
}

export function iconButton(name, label, onclick, cls = '') {
  return h('button', { class: `icon-btn ${cls}`, type: 'button', 'aria-label': label, onclick, html: icon(name) });
}

/** Pozdrav po uri dneva. */
export function greeting(d = new Date()) {
  const hr = d.getHours();
  if (hr >= 5 && hr < 10) return 'Dobro jutro';
  if (hr >= 10 && hr < 18) return 'Dober dan';
  return 'Dober večer';
}

/**
 * Glava zaslona: nad velikim naslovom majhna vrstica (privzeto današnji datum),
 * desno okrogli stekleni gumbi. live: vrstica v barvi poudarka s piko (trening teče).
 */
export function pageHeader({ title, titleEl = null, eyebrow = fmtDateLong(new Date()), live = false, right = [] }) {
  return h('header', { class: 'topbar' },
    h('div', { class: 'topbar__title' },
      eyebrow ? h('p', { class: `topbar__eyebrow${live ? ' is-live' : ''}` }, eyebrow) : null,
      titleEl || h('h1', null, title)),
    h('div', { class: 'topbar__actions' }, right));
}

/** Podzaslon: zgoraj gumb nazaj (desno poljubni gumbi), pod njim naslov. */
export function subHeader({ back, title, eyebrow = null, sub = null, right = [] }) {
  return h('header', { class: 'topbar topbar--sub' },
    h('div', { class: 'topbar__nav' },
      h('a', { class: 'icon-btn', href: back, 'aria-label': 'Nazaj' }, iconEl('back', 22)),
      h('div', { class: 'topbar__actions' }, right)),
    h('div', { class: 'topbar__title' },
      eyebrow ? h('p', { class: 'topbar__eyebrow' }, eyebrow) : null,
      h('h1', null, title),
      sub ? h('p', { class: 'topbar__sub' }, sub) : null));
}

/** Glava glavnega zaslona (ikona ostane v podpisu zaradi starih klicev; vidna ni več). */
export function header(iconName, title, ...right) {
  return pageHeader({ title, right });
}

// ---------- spodnje okno ----------

const DRAWER = 'cubic-bezier(0.32, 0.72, 0, 1)';
let openCount = 0;
const openClosers = new Set();

/** Zapre vsa odprta okna (ob menjavi zaslona, tudi s sistemskim "nazaj"). */
export function closeAllSheets() { for (const c of [...openClosers]) c(); }

/**
 * Odpre okno, ki zraste od spodaj. body je element ali funkcija (close) => element.
 * Vrne { close, panel }.
 */
export function openSheet({ title, body, onClose, tall = false }) {
  // Tipkovnica na iOS ostane odprta za polje, ki ga ni več; zato blur.
  document.activeElement && document.activeElement.blur && document.activeElement.blur();

  const backdrop = h('div', { class: 'sheet-backdrop' });
  const panel = h('div', { class: `sheet${tall ? ' sheet--tall' : ''}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': title || '' });
  const grip = h('div', { class: 'sheet__grip' }, h('span'));
  const head = title
    ? h('div', { class: 'sheet__head' }, h('h2', null, title), iconButton('close', 'Zapri', () => close()))
    : null;
  const content = h('div', { class: 'sheet__body' });
  panel.append(grip);
  if (head) panel.append(head);
  panel.append(content);

  let closed = false;
  function close(result) {
    if (closed) return;
    closed = true;
    openCount--;
    openClosers.delete(close);
    document.removeEventListener('keydown', onKey);
    panel.style.transition = `transform 200ms ${DRAWER}`;
    panel.style.transform = 'translateY(100%)';
    backdrop.style.opacity = '0';
    setTimeout(() => { backdrop.remove(); panel.remove(); if (!openCount) document.body.classList.remove('has-sheet'); }, 210);
    onClose && onClose(result);
  }
  function onKey(e) { if (e.key === 'Escape') close(); }

  content.append(typeof body === 'function' ? body(close) : body);
  backdrop.addEventListener('click', () => close());
  document.addEventListener('keydown', onKey);

  openCount++;
  openClosers.add(close);
  document.body.classList.add('has-sheet');
  document.body.append(backdrop, panel);
  requestAnimationFrame(() => {
    backdrop.classList.add('is-open');
    panel.classList.add('is-open');
  });

  enableDragToDismiss(panel, [grip, head].filter(Boolean), close);
  return { close, panel };
}

/** Povleci navzdol za zaprtje; hiter poteg zadošča ne glede na razdaljo. */
function enableDragToDismiss(panel, handles, close) {
  let startY = 0, startT = 0, dy = 0, dragging = false, pid = null;
  for (const hdl of handles) {
    hdl.addEventListener('pointerdown', (e) => {
      if (dragging || e.target.closest('button')) return;
      dragging = true; pid = e.pointerId;
      startY = e.clientY; startT = performance.now(); dy = 0;
      hdl.setPointerCapture(pid);
      panel.style.transition = 'none';
    });
    hdl.addEventListener('pointermove', (e) => {
      if (!dragging || e.pointerId !== pid) return;
      dy = e.clientY - startY;
      // Navzgor z dušenjem: ne trda stena, ampak upor.
      const y = dy < 0 ? -Math.sqrt(-dy) * 2 : dy;
      panel.style.transform = `translateY(${y}px)`;
    });
    const end = (e) => {
      if (!dragging || e.pointerId !== pid) return;
      dragging = false;
      const v = Math.abs(dy) / Math.max(1, performance.now() - startT);
      if (dy > 120 || (dy > 10 && v > 0.11)) { close(); return; }
      panel.style.transition = `transform 240ms ${DRAWER}`;
      panel.style.transform = '';
    };
    hdl.addEventListener('pointerup', end);
    hdl.addEventListener('pointercancel', end);
  }
}

/** Seznam dejanj v oknu. actions: [{ label, icon, danger, onSelect, hint }] */
export function actionSheet(title, actions) {
  openSheet({
    title,
    body: (close) => h('div', { class: 'action-list' },
      actions.filter(Boolean).map((a) => h('button', {
        class: `action${a.danger ? ' action--danger' : ''}`,
        type: 'button',
        onclick: () => { close(); a.onSelect(); },
      },
      a.icon ? iconEl(a.icon, 20) : null,
      h('span', { class: 'action__label' }, a.label),
      a.hint ? h('span', { class: 'action__hint' }, a.hint) : null))),
  });
}

/** Potrditev. Vrne Promise<boolean>. */
export function confirmSheet({ title, message, confirmLabel = 'Potrdi', danger = false }) {
  return new Promise((resolve) => {
    let answered = false;
    openSheet({
      title,
      onClose: () => { if (!answered) resolve(false); },
      body: (close) => h('div', { class: 'stack' },
        message ? h('p', { class: 'sheet__text' }, message) : null,
        h('div', { class: 'btn-row' },
          h('button', { class: 'btn btn--ghost', type: 'button', onclick: () => close() }, 'Prekliči'),
          h('button', {
            class: `btn ${danger ? 'btn--danger' : 'btn--primary'}`, type: 'button',
            onclick: () => { answered = true; resolve(true); close(); },
          }, confirmLabel))),
    });
  });
}

/** Vnos besedila s predlogi. Vrne Promise<string|null>. */
export function promptSheet({ title, value = '', placeholder = '', confirmLabel = 'Potrdi', suggestions = [], multiline = false }) {
  return new Promise((resolve) => {
    let answered = false;
    openSheet({
      title,
      onClose: () => { if (!answered) resolve(null); },
      body: (close) => {
        const input = multiline
          ? h('textarea', { class: 'field', rows: 4, placeholder })
          : h('input', { class: 'field', type: 'text', placeholder, autocomplete: 'off', enterkeyhint: 'done' });
        input.value = value;
        const submit = () => { answered = true; resolve(input.value.trim()); close(); };
        if (!multiline) input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
        const chips = suggestions.length
          ? h('div', { class: 'chips' }, suggestions.map((s) => h('button', {
              class: 'chip', type: 'button', onclick: () => { input.value = s; submit(); },
            }, s)))
          : null;
        setTimeout(() => input.focus(), 300);
        return h('div', { class: 'stack' }, input, chips,
          h('button', { class: 'btn btn--primary btn--block', type: 'button', onclick: submit }, confirmLabel));
      },
    });
  });
}

// ---------- obvestilo ----------

let toastEl = null, toastTimer = null;
/** Kratko obvestilo. action: { label, run } doda gumb in obvestilo ostane dlje. */
export function toast(message, action = null) {
  if (!toastEl) {
    toastEl = h('div', { class: 'toast', role: 'status', 'aria-live': 'polite' });
    document.body.append(toastEl);
  }
  const hide = () => toastEl.classList.remove('is-on');
  toastEl.replaceChildren(h('span', null, message));
  if (action) {
    toastEl.append(h('button', {
      class: 'toast__action', type: 'button',
      onclick: () => { clearTimeout(toastTimer); hide(); action.run(); },
    }, action.label));
  }
  toastEl.classList.toggle('has-action', !!action);
  toastEl.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hide, action ? 7000 : 2200);
}

/** Obvestilo po brisanju: undo() vrne podatke (store.restore) in izriše zaslon. */
export function undoToast(message, undo) {
  toast(message, { label: 'Razveljavi', run: undo });
}

// ---------- števila in datumi ----------

const nf1 = new Intl.NumberFormat('sl-SI', { maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat('sl-SI', { maximumFractionDigits: 2 });
const nf0 = new Intl.NumberFormat('sl-SI', { maximumFractionDigits: 0 });

export function fmt(v, digits = 1) {
  if (v == null || !Number.isFinite(v)) return '—';
  return (digits === 0 ? nf0 : digits === 2 ? nf2 : nf1).format(v);
}

/** '42,5' ali '42.5' → 42.5; prazno → null */
export function parseNum(s) {
  if (s == null) return null;
  const t = String(s).trim().replace(',', '.');
  if (!t) return null;
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : null;
}

const WEEKDAYS = ['nedelja', 'ponedeljek', 'torek', 'sreda', 'četrtek', 'petek', 'sobota'];
const MONTHS = ['januar', 'februar', 'marec', 'april', 'maj', 'junij', 'julij', 'avgust', 'september', 'oktober', 'november', 'december'];
const MONTHS_SHORT = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'avg', 'sep', 'okt', 'nov', 'dec'];

function toDate(d) { return d instanceof Date ? d : new Date(d.length === 10 ? d + 'T12:00:00' : d); }

const MONTHS_GEN = ['januarja', 'februarja', 'marca', 'aprila', 'maja', 'junija', 'julija', 'avgusta', 'septembra', 'oktobra', 'novembra', 'decembra'];
/** '2. oktobra' */
export function fmtDayMonth(d) { const x = toDate(d); return `${x.getDate()}. ${MONTHS_GEN[x.getMonth()]}`; }
/** '2. okt' */
export function fmtDayShort(d) { const x = toDate(d); return `${x.getDate()}. ${MONTHS_SHORT[x.getMonth()]}`; }

/** '10. 11.' */
export function fmtDay(d) { const x = toDate(d); return `${x.getDate()}. ${x.getMonth() + 1}.`; }
/** '10. 11. 2026' */
export function fmtDate(d) { const x = toDate(d); return `${x.getDate()}. ${x.getMonth() + 1}. ${x.getFullYear()}`; }
/** 'torek, 10. november' */
export function fmtDateLong(d) { const x = toDate(d); return `${WEEKDAYS[x.getDay()]}, ${x.getDate()}. ${MONTHS[x.getMonth()]}`; }
export function weekdayShort(d) { return WEEKDAYS[toDate(d).getDay()].slice(0, 3); }
export function monthShort(i) { return MONTHS_SHORT[i]; }
export function monthName(i) { return MONTHS[i]; }

/** Relativno: 'danes', 'včeraj', 'pred 3 dnevi', sicer datum. */
export function fmtRelative(d) {
  const x = toDate(d);
  const a = new Date(); a.setHours(12, 0, 0, 0);
  const b = new Date(x); b.setHours(12, 0, 0, 0);
  const days = Math.round((a - b) / 86400000);
  if (days === 0) return 'danes';
  if (days === 1) return 'včeraj';
  if (days > 1 && days < 7) return `pred ${days} ${days === 2 ? 'dnevoma' : 'dnevi'}`;
  return x.getFullYear() === a.getFullYear() ? fmtDay(x) : fmtDate(x);
}

/** 3725 → '1:02:05'; 125 → '2:05' */
export function fmtClock(sec) {
  if (sec == null) return '—';
  sec = Math.max(0, Math.round(sec));
  const hh = Math.floor(sec / 3600), mm = Math.floor((sec % 3600) / 60), ss = sec % 60;
  const p = (n) => String(n).padStart(2, '0');
  return hh ? `${hh}:${p(mm)}:${p(ss)}` : `${mm}:${p(ss)}`;
}

/** 3725 → '1 h 2 min'; 2700 → '45 min' */
export function fmtDuration(sec) {
  if (sec == null) return '—';
  const m = Math.round(sec / 60);
  if (m < 60) return `${m} min`;
  const hh = Math.floor(m / 60), mm = m % 60;
  return mm ? `${hh} h ${mm} min` : `${hh} h`;
}

/** Tempo v min/km. */
export function fmtPace(sec, km) {
  if (!sec || !km) return null;
  const p = sec / km;
  return `${Math.floor(p / 60)}:${String(Math.round(p % 60)).padStart(2, '0')} /km`;
}

/** Sklanjanje: plural(3, ['vaja','vaji','vaje','vaj']) */
export function plural(n, forms) {
  const m = Math.abs(n) % 100;
  if (m === 1) return forms[0];
  if (m === 2) return forms[1];
  if (m === 3 || m === 4) return forms[2];
  return forms[3];
}
