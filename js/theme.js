// Barve poudarka. Vsaka ima štiri vloge, ker ena barva ne zna vsega:
//  fill  – ploskev gumba; bel (ali temen) napis na njej ima kontrast >= 4.5
//  deep  – temnejši konec preliva v glavi vaje
//  text  – barva kot besedilo na temni podlagi (kontrast >= 4.5)
//  on    – barva napisa na fill
import * as store from './store.js';

export const ACCENTS = [
  { id: 'blue',   name: 'Modra',      fill: '#2563eb', deep: '#1e3a8a', text: '#6ea8ff', on: '#ffffff' },
  { id: 'red',    name: 'Rdeča',      fill: '#c4261f', deep: '#661714', text: '#ff6f66', on: '#ffffff' },
  { id: 'teal',   name: 'Turkizna',   fill: '#0f7f74', deep: '#0b4943', text: '#3ddbc6', on: '#ffffff' },
  { id: 'green',  name: 'Zelena',     fill: '#1a7f3a', deep: '#0f4721', text: '#5ee08a', on: '#ffffff' },
  { id: 'orange', name: 'Oranžna',    fill: '#c2510c', deep: '#6e2d06', text: '#ff9a4d', on: '#ffffff' },
  { id: 'violet', name: 'Vijolična',  fill: '#7c3aed', deep: '#3f1d8a', text: '#b49bff', on: '#ffffff' },
  { id: 'pink',   name: 'Roza',       fill: '#be2468', deep: '#6b1239', text: '#ff7ab3', on: '#ffffff' },
  { id: 'yellow', name: 'Rumena',     fill: '#f0bf2c', deep: '#7a5a07', text: '#ffd45c', on: '#1a1400' },
];

// Privzeta barva, dokler si je lastnik ne izbere (index.html ima isto rezervo).
const DEFAULT_ACCENT = 'red';

export function currentAccent() {
  const id = store.getSettings().accent;
  return ACCENTS.find((a) => a.id === id) || ACCENTS.find((a) => a.id === DEFAULT_ACCENT);
}

export function applyAccent(a = currentAccent()) {
  const r = document.documentElement.style;
  r.setProperty('--accent', a.fill);
  r.setProperty('--accent-deep', a.deep);
  r.setProperty('--accent-text', a.text);
  r.setProperty('--on-accent', a.on);
  // Vrstica stanja (Android) dobi temen odtenek barve, s katerim se začne ozadje.
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', mixDark(a.deep));
}

/** '#661714' → temna mešanica s #0c0d12 (35 % barve), kot vrh ozadja v CSS. */
function mixDark(hex) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const base = [12, 13, 18];
  return '#' + c.map((v, i) => Math.round(v * 0.35 + base[i] * 0.65).toString(16).padStart(2, '0')).join('');
}

export function setAccent(id) {
  store.setSetting('accent', id);
  applyAccent();
}
