// Strava. Povezava potrebuje strežniški del (Cloudflare Worker), ki hrani skrivni
// ključ Strava API — ta ne sme biti v javni kodi. Dokler ga ni, okno pove, kaj manjka.
// Pravilo uvoza: vse aktivnosti razen treninga moči; nič se ne uvozi dvakrat.
import * as store from './store.js';
import { h, openSheet, toast } from './ui.js';

// Vrste, ki jih Strava uporablja za trening moči in jih preskočimo.
export const SKIP_TYPES = ['WeightTraining', 'Workout', 'Crossfit'];

// Strava sport_type → slovensko ime vrste v aplikaciji.
const TYPE_NAMES = {
  Run: 'Tek', TrailRun: 'Tek', VirtualRun: 'Tek',
  Ride: 'Kolo', VirtualRide: 'Kolo', MountainBikeRide: 'Kolo', GravelRide: 'Kolo', EBikeRide: 'Kolo',
  Walk: 'Hoja', Hike: 'Pohod', Swim: 'Plavanje', Rowing: 'Veslanje',
  StairStepper: 'Stairmaster', Elliptical: 'Eliptični trenažer', Yoga: 'Joga',
};

/** Pretvori aktivnost s Strave v vnos cardia ali vrne null, če se preskoči. */
export function fromStravaActivity(a) {
  const sport = a.sport_type || a.type;
  if (SKIP_TYPES.includes(sport)) return null;
  if (store.hasStravaActivity(a.id)) return null;
  return {
    type: TYPE_NAMES[sport] || sport || 'Cardio',
    date: store.dayOf(a.start_date_local ? a.start_date_local.slice(0, 19) : a.start_date),
    durationSec: a.moving_time ?? a.elapsed_time ?? null,
    distanceKm: a.distance ? Math.round(a.distance / 10) / 100 : null,
    kcal: a.calories ?? (a.kilojoules ? Math.round(a.kilojoules / 4.184) : null),
    source: 'strava',
    stravaId: a.id,
  };
}

export function openStrava() {
  const url = store.getSettings().stravaWorkerUrl;
  openSheet({
    title: 'Strava',
    body: () => h('div', { class: 'stack' },
      url
        ? h('p', { class: 'sheet__text' }, 'Povezava je nastavljena, uvoz pa še ni vklopljen v tej različici.')
        : h('p', { class: 'sheet__text' }, 'Povezava s Stravo še ni nastavljena. Potrebuje enkratno pripravo: aplikacijo na strava.com/settings/api in majhen brezplačen strežnik, ki varno hrani ključ.'),
      h('ul', { class: 'bullets' },
        h('li', null, 'Uvozijo se teki, kolo, hoja, plavanje …'),
        h('li', null, 'Trening moči (Weight Training) se preskoči, da ni podvojen.'),
        h('li', null, 'Vsaka aktivnost se uvozi samo enkrat.'),
        h('li', null, 'Koraki se s Strave ne štejejo.')),
      h('button', { class: 'btn btn--secondary btn--block', type: 'button', onclick: () => toast('Kmalu') }, 'Poveži s Stravo')),
  });
}
