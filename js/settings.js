// Nastavitve (zobnik): barva poudarka, varnostna kopija, uvoz iz stare aplikacije.
import * as store from './store.js';
import { ACCENTS, currentAccent, setAccent } from './theme.js';
import { h, openSheet, iconEl, confirmSheet, toast, fmtDate, parseNum } from './ui.js';
import { icon } from './icons.js';

export function openSettings() {
  let changed = false;
  openSheet({
    title: 'Nastavitve',
    tall: true,
    // Spremenjena višina vpliva na kalorije korakov: zaslon se ob zaprtju na novo izriše.
    onClose: () => { if (changed) window.dispatchEvent(new Event('app:rerender')); },
    body: () => {
      const wrap = h('div', { class: 'stack stack--loose' });

      // --- barva ---
      const swatches = h('div', { class: 'swatches', role: 'radiogroup', 'aria-label': 'Barva poudarka' });
      const renderSwatches = () => {
        swatches.innerHTML = '';
        const cur = currentAccent().id;
        for (const a of ACCENTS) {
          swatches.append(h('button', {
            class: `swatch${a.id === cur ? ' is-on' : ''}`, type: 'button', role: 'radio',
            'aria-checked': String(a.id === cur), 'aria-label': a.name,
            style: { '--sw': a.fill, '--sw-on': a.on },
            onclick: () => { setAccent(a.id); renderSwatches(); },
          }, h('span', { class: 'swatch__dot', html: a.id === cur ? icon('check', 18) : '' }), h('span', { class: 'swatch__name' }, a.name)));
        }
      };
      renderSwatches();
      wrap.append(h('section', null, h('h3', { class: 'settings-title' }, 'Barva'), swatches));

      // --- telo ---
      const height = h('input', {
        class: 'field field--num', type: 'text', inputmode: 'numeric', autocomplete: 'off',
        placeholder: 'npr. 168', 'aria-label': 'Višina v centimetrih',
      });
      const cur = store.getSettings().heightCm;
      if (cur) height.value = String(cur);
      height.addEventListener('change', () => {
        if (!height.value.trim()) { store.setSetting('heightCm', null); changed = true; return; }
        const v = parseNum(height.value);
        if (v == null || v < 100 || v > 230) { toast('Višina v centimetrih, med 100 in 230'); return; }
        store.setSetting('heightCm', Math.round(v));
        height.value = String(Math.round(v));
        changed = true;
        toast('Višina shranjena');
      });
      wrap.append(h('section', null,
        h('h3', { class: 'settings-title' }, 'Telo'),
        h('label', { class: 'form-field' },
          h('span', { class: 'form-field__label' }, 'Višina'),
          h('span', { class: 'form-field__wrap' }, height, h('span', { class: 'form-field__unit' }, 'cm'))),
        h('p', { class: 'hint', style: { marginTop: '8px' } }, 'Neobvezno: iz višine se oceni, koliko kilometrov prehodiš s koraki. Kalorije iz korakov potrebujejo samo težo.')));

      // --- kopija ---
      const s = store.summary();
      const fileInput = h('input', { type: 'file', accept: 'application/json,.json', hidden: true });
      fileInput.addEventListener('change', () => importFile(fileInput));
      wrap.append(h('section', null,
        h('h3', { class: 'settings-title' }, 'Varnostna kopija'),
        h('p', { class: 'sheet__text' }, `Podatki so samo na tem telefonu: ${s.workouts} treningov, ${s.cardio} cardio vnosov, ${s.bodyweight} tehtanj. Kopija ne nastane sama; naredi jo občasno in jo shrani na varno.`),
        h('div', { class: 'action-list' },
          h('button', { class: 'action', type: 'button', onclick: exportBackup },
            iconEl('download', 20), h('span', { class: 'action__label' }, 'Izvozi kopijo'), h('span', { class: 'action__hint' }, '.json')),
          h('button', { class: 'action', type: 'button', onclick: () => fileInput.click() },
            iconEl('upload', 20), h('span', { class: 'action__label' }, 'Uvozi kopijo'), h('span', { class: 'action__hint' }, 'tudi iz stare aplikacije'))),
        fileInput));

      // Ali brskalnik sme podatke pobrisati sam (Safari: če ni na začetnem zaslonu).
      const storageLine = h('p', { class: 'fineprint' });
      storageStatus().then((t) => { storageLine.textContent = t; });

      wrap.append(h('p', { class: 'fineprint' }, store.lastBackupDay() ? `Zadnja kopija: ${fmtDate(store.lastBackupDay())}` : 'Kopija še ni bila narejena.'),
      storageLine,
      h('p', { class: 'fineprint' }, 'Različica 0.3 · podatki ne zapustijo naprave'));
      return wrap;
    },
  });
}

async function storageStatus() {
  const installed = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  let persisted = false;
  try { persisted = !!(navigator.storage && navigator.storage.persisted && await navigator.storage.persisted()); } catch { /* ni podprto */ }
  if (persisted) return 'Shramba: zaščitena, brskalnik podatkov ne briše sam.';
  if (installed) return 'Shramba: aplikacija je na začetnem zaslonu, podatki so varni pred samodejnim brisanjem.';
  return 'Shramba: ni zaščitena. Dodaj aplikacijo na začetni zaslon (Deli → Dodaj na začetni zaslon), sicer jo brskalnik lahko po nekaj tednih neuporabe pobriše.';
}

/** Izvozi kopijo (deljenje na telefonu, prenos drugje). Vrne true, če je uspelo. */
export async function exportBackup() {
  const name = `trening-kopija-${store.todayIso()}.json`;
  const text = store.exportJson();
  const file = new File([text], name, { type: 'application/json' });
  // Na telefonu je deljenje (Datoteke, Drive, e-pošta) prijaznejše od prenosa.
  if (navigator.canShare && navigator.canShare({ files: [file] }) && matchMedia('(pointer: coarse)').matches) {
    try { await navigator.share({ files: [file], title: name }); store.markBackupDone(); return true; } catch (e) { if (e.name === 'AbortError') return false; }
  }
  const url = URL.createObjectURL(file);
  const a = h('a', { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  store.markBackupDone();
  toast('Kopija prenesena');
  return true;
}

async function importFile(input) {
  const f = input.files && input.files[0];
  input.value = '';
  if (!f) return;
  let result;
  try {
    result = store.readBackup(await f.text());
  } catch (e) {
    toast(e.message === 'not-json' ? 'To ni datoteka JSON' : 'Ta datoteka ni kopija treningov');
    return;
  }
  const cur = store.summary();
  const c = result.counts;
  const ok = await confirmSheet({
    title: result.legacy ? 'Uvozim kopijo stare aplikacije?' : 'Uvozim kopijo?',
    message: `Kopija: ${c.workouts} treningov, ${c.exercises} vaj, ${c.cardio} cardio, ${c.bodyweight} tehtanj.\nNa telefonu zdaj: ${cur.workouts} treningov, ${cur.cardio} cardio.\nTrenutni podatki bodo zamenjani.${result.legacy ? ' Prehrana iz stare aplikacije se ne prikazuje, ostane pa shranjena.' : ''}`,
    confirmLabel: 'Uvozi in zamenjaj',
    danger: true,
  });
  if (!ok) return;
  store.applyBackup(result.data);
  location.reload();
}

export { fmtDate };
