// Zagon: barva, usmerjanje po #/poti, spodnja vrstica, service worker.
// Nov zaslon = nova datoteka v js/screens/ + ena vrstica v SCREENS.
import { applyAccent } from './theme.js';
import { icon } from './icons.js';
import { h, closeAllSheets, openSheet, fmtDate } from './ui.js';
import * as store from './store.js';
import { exportBackup } from './settings.js';
import { screen as training } from './screens/training.js';
import { screen as cardio } from './screens/cardio.js';
import { screen as body } from './screens/body.js';
import { screen as progress } from './screens/progress.js';

const SCREENS = [training, cardio, body, progress];

const screenEl = document.getElementById('screen');
const tabbar = document.getElementById('tabbar');
let cleanup = null;
let current = null;

function parse() {
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  const s = SCREENS.find((x) => x.id === parts[0]) || SCREENS[0];
  return { s, params: parts.slice(1), key: parts.join('/') };
}

function render({ keepScroll = false, focus = null, scrollTo = null } = {}) {
  const { s, params, key } = parse();
  const top = keepScroll ? screenEl.scrollTop : 0;
  if (cleanup) { cleanup(); cleanup = null; }
  screenEl.innerHTML = '';
  screenEl.dataset.screen = s.id;
  const ctx = { rerender: (opts = {}) => render({ keepScroll: true, ...opts }) };
  const result = s.render(screenEl, ctx, params);
  if (typeof result === 'function') cleanup = result;
  screenEl.scrollTop = top;
  if (focus) { const el = screenEl.querySelector(focus); if (el) el.focus({ preventScroll: false }); }
  if (scrollTo) { const el = screenEl.querySelector(scrollTo); if (el) el.scrollIntoView({ block: 'start', behavior: 'smooth' }); }
  if (current !== key) {
    current = key;
    for (const b of tabbar.children) {
      const on = b.dataset.id === s.id;
      b.classList.toggle('is-active', on);
      if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    }
  }
}

function buildTabbar() {
  for (const s of SCREENS) {
    tabbar.append(h('a', {
      class: 'tab', href: `#/${s.id}`, dataset: { id: s.id }, 'aria-label': s.label,
      html: `${icon(s.icon, 26)}<span class="tab__label">${s.label}</span>`,
    }));
  }
}

applyAccent();
buildTabbar();
if (!location.hash) history.replaceState(null, '', '#/trening');
// Nastavitve (npr. višina) javijo spremembo, ki vpliva na prikaz.
window.addEventListener('app:rerender', () => render({ keepScroll: true }));
window.addEventListener('hashchange', (e) => {
  // Podzasloni (npr. statistika vaje) vedo, kam vodi "nazaj".
  document.body.dataset.prev = new URL(e.oldURL).hash;
  closeAllSheets();
  render();
});
render();

// Ob vrnitvi v aplikacijo (zaklenjen telefon v telovadnici) osveži prikaz.
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && !document.body.classList.contains('has-sheet') && !document.activeElement.matches('input, textarea')) render({ keepScroll: true }); });

// Opomnik za varnostno kopijo: na 30 dni, ob zagonu, nikoli sredi treninga.
function backupReminder() {
  if (store.getDraft() || !store.backupReminderDue()) return;
  const last = store.lastBackupDay();
  openSheet({
    title: 'Čas za varnostno kopijo',
    onClose: () => { if (store.backupReminderDue()) store.snoozeBackupReminder(); },
    body: (close) => h('div', { class: 'stack' },
      h('p', { class: 'sheet__text' }, `Podatki so samo na tem telefonu. ${last ? `Zadnja kopija je bila ${fmtDate(last)}.` : 'Kopije še nisi naredila.'} Shrani jo na Drive, v Datoteke ali pošlji po e-pošti.`),
      h('div', { class: 'btn-row' },
        h('button', { class: 'btn btn--ghost', type: 'button', onclick: () => { store.snoozeBackupReminder(); close(); } }, 'Kasneje'),
        h('button', { class: 'btn btn--primary', type: 'button', onclick: async () => { if (await exportBackup()) close(); } }, 'Izvozi zdaj'))),
  });
}
setTimeout(backupReminder, 800);

// Shranjevanje ni uspelo (poln pomnilnik, zasebni način): glasno, ne samo v konzolo.
let saveWarningOpen = false;
store.onSaveError(() => {
  if (saveWarningOpen) return;
  saveWarningOpen = true;
  openSheet({
    title: 'Shranjevanje ni uspelo',
    onClose: () => { saveWarningOpen = false; },
    body: (close) => h('div', { class: 'stack' },
      h('p', { class: 'sheet__text' }, 'Zadnja sprememba ni shranjena na telefon in se ob zaprtju aplikacije izgubi. Najverjetneje je pomnilnik brskalnika poln ali pa je odprta v zasebnem načinu. Takoj izvozi kopijo.'),
      h('button', { class: 'btn btn--primary btn--block', type: 'button', onclick: async () => { if (await exportBackup()) close(); } }, 'Izvozi kopijo')),
  });
});

// Brskalnik naj podatkov ne briše sam, ko mu zmanjka prostora ali aplikacije dolgo ne odpreš.
if (navigator.storage && navigator.storage.persist) {
  navigator.storage.persisted().then((p) => p || navigator.storage.persist()).catch(() => {});
}

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
