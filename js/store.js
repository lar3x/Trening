// Edina pot do podatkov. Noben zaslon ne kliče localStorage sam.
// Vse je en JSON objekt pod ključem KEY. Ob spremembi oblike se dvigne
// SCHEMA_VERSION in dopolni migrate(), sicer posodobitev pobriše zgodovino.

const KEY = 'gymapp';
export const SCHEMA_VERSION = 3;
// 2: vaja v treningu ima svoj zapisek (note); trening v teku zna urejati shranjenega (editingId).
// 3: koraki (stepsEntries), en vnos na dan.

export const SET_KINDS = ['normal', 'band', 'time', 'empty'];
// Vrste iz stare aplikacije. Ob uvozu ostanejo, kot so (zgodovina se ne
// spremeni), novih pa ni mogoče dodati.
export const LEGACY_KINDS = ['superset', 'dropset', 'myoreps'];
export const BANDS = ['yellow', 'green', 'teal', 'red-thin', 'red-thick', 'bw'];
export const UNITS = ['cm', 'kg', '%'];

// ---------- pomožne ----------

export function newId() {
  if (globalThis.crypto && crypto.randomUUID) return crypto.randomUUID();
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

function pad(n) { return String(n).padStart(2, '0'); }

/** Lokalni dan kot 'YYYY-MM-DD'. toISOString() bi vzel UTC in po polnoči zgrešil dan. */
export function dayOf(dateLike) {
  const d = dateLike instanceof Date ? dateLike : new Date(dateLike);
  if (isNaN(d)) return todayIso();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function todayIso() { return dayOf(new Date()); }

/** Primerjava imen brez velikih črk, šumnikov in odvečnih presledkov. */
export function normalizeName(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function num(v) {
  const n = typeof v === 'string' ? parseFloat(v.replace(',', '.')) : v;
  return Number.isFinite(n) ? n : null;
}
function str(v, fallback = '') { return typeof v === 'string' ? v : fallback; }
function arr(v) { return Array.isArray(v) ? v : []; }

const collator = new Intl.Collator('sl', { sensitivity: 'base' });
const byName = (a, b) => collator.compare(a.name, b.name);

// ---------- shramba ----------

function empty() {
  return {
    app: 'gymapp',
    schemaVersion: SCHEMA_VERSION,
    settings: { accent: 'red' },
    exercises: [],
    templates: [],
    workouts: [],
    bodyweightEntries: [],
    measurements: [],
    measurementEntries: [],
    cardioEntries: [],
    stepsEntries: [],
    draft: null,
    legacy: null,
  };
}

let data = load();

function load() {
  let raw = null;
  try {
    raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    return migrate(JSON.parse(raw));
  } catch {
    // Pokvarjenega zapisa ne prepišemo brez sledu: ostane pod drugim ključem.
    try { if (raw) localStorage.setItem(KEY + '-pokvarjeno', raw); } catch { /* ni prostora */ }
    return empty();
  }
}

let saveErrorHandler = null;
/** Zaslon se prijavi, da pokaže opozorilo, ko shranjevanje ne uspe. */
export function onSaveError(fn) { saveErrorHandler = fn; }

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    console.error('Shranjevanje ni uspelo', e);
    if (saveErrorHandler) saveErrorHandler(e);
    return false;
  }
}

/** Posnetek vseh podatkov pred brisanjem; restore() ga vrne ("Razveljavi"). */
export function snapshot() { return JSON.stringify(data); }
export function restore(snap) {
  data = JSON.parse(snap);
  persist();
}

// ---------- migracije in čiščenje ----------

function cleanSet(s) {
  s = s || {};
  let kind = str(s.kind);
  let band = s.band ?? null;
  if (band === 'red') band = 'red-thin';
  if (!kind) kind = band ? 'band' : 'normal';
  if (![...SET_KINDS, ...LEGACY_KINDS].includes(kind)) kind = 'normal';
  return {
    kind,
    weightKg: num(s.weightKg),
    reps: num(s.reps),
    band: kind === 'band' && BANDS.includes(band) ? band : null,
    seconds: kind === 'time' ? num(s.seconds) : null,
    done: !!s.done,
  };
}

function cleanWorkoutExercises(list) {
  return arr(list)
    .filter((e) => e && typeof e.exerciseId === 'string')
    .map((e) => ({ exerciseId: e.exerciseId, note: str(e.note), sets: arr(e.sets).map(cleanSet) }));
}

function migrate(d) {
  if (!d || typeof d !== 'object') return empty();
  // Kopija iz prejšnje aplikacije (Fitnes-aplikacija, schemaVersion do 7).
  if (d.app !== 'gymapp') return fromLegacy(d);

  const out = empty();
  out.settings = { ...out.settings, ...(d.settings || {}) };
  out.exercises = arr(d.exercises).map((e) => ({
    id: str(e.id) || newId(),
    name: str(e.name),
    note: str(e.note),
    usesBodyweight: !!e.usesBodyweight,
    createdAt: str(e.createdAt, new Date().toISOString()),
  }));
  out.templates = arr(d.templates).map((t) => ({
    id: str(t.id) || newId(),
    name: str(t.name),
    exerciseIds: arr(t.exerciseIds).filter((x) => typeof x === 'string'),
    updatedAt: str(t.updatedAt, new Date().toISOString()),
  }));
  out.workouts = arr(d.workouts).map((w) => ({
    id: str(w.id) || newId(),
    name: str(w.name),
    templateId: w.templateId ?? null,
    date: str(w.date, new Date().toISOString()),
    durationSec: num(w.durationSec),
    exercises: cleanWorkoutExercises(w.exercises),
  }));
  out.bodyweightEntries = arr(d.bodyweightEntries)
    .filter((b) => num(b.weightKg) != null)
    .map((b) => ({ id: str(b.id) || newId(), date: str(b.date), weightKg: num(b.weightKg) }));
  out.measurements = arr(d.measurements).map((m) => ({
    id: str(m.id) || newId(),
    name: str(m.name),
    unit: UNITS.includes(m.unit) ? m.unit : 'cm',
    createdAt: str(m.createdAt, new Date().toISOString()),
  }));
  out.measurementEntries = arr(d.measurementEntries)
    .filter((m) => num(m.value) != null)
    .map((m) => ({ id: str(m.id) || newId(), measurementId: str(m.measurementId), date: str(m.date), value: num(m.value) }));
  out.cardioEntries = arr(d.cardioEntries).map(cleanCardio);
  out.stepsEntries = arr(d.stepsEntries)
    .filter((x) => num(x.steps) != null && /^\d{4}-\d{2}-\d{2}$/.test(str(x.date)))
    .map((x) => ({ id: str(x.id) || newId(), date: x.date, steps: Math.round(num(x.steps)) }));
  out.draft = d.draft && typeof d.draft === 'object'
    ? {
        name: str(d.draft.name),
        templateId: d.draft.templateId ?? null,
        startedAt: str(d.draft.startedAt, new Date().toISOString()),
        exercises: cleanWorkoutExercises(d.draft.exercises),
        editingId: typeof d.draft.editingId === 'string' ? d.draft.editingId : null,
        repeatOf: typeof d.draft.repeatOf === 'string' ? d.draft.repeatOf : null,
        durationSec: num(d.draft.durationSec),
      }
    : null;
  out.legacy = d.legacy ?? null;
  return out;
}

function cleanCardio(c) {
  return {
    id: str(c.id) || newId(),
    date: str(c.date, todayIso()),
    type: str(c.type, 'Cardio') || 'Cardio',
    durationSec: num(c.durationSec),
    distanceKm: num(c.distanceKm),
    kcal: num(c.kcal),
    source: c.source === 'strava' ? 'strava' : 'manual',
    stravaId: c.stravaId ?? null,
  };
}

/** Pretvori zapis stare aplikacije (schemaVersion 1–7) v novo obliko. */
function fromLegacy(old) {
  if (!Array.isArray(old.workouts)) throw new Error('not-a-backup');
  const d = {
    app: 'gymapp',
    schemaVersion: SCHEMA_VERSION,
    // Stara aplikacija barve ni imela: null pomeni "obdrži trenutno".
    settings: { accent: null },
    exercises: old.exercises,
    templates: old.templates,
    workouts: old.workouts,
    bodyweightEntries: old.bodyweightEntries,
    measurements: arr(old.measurements).map((m) => ({ ...m, unit: m.unit || 'cm' })),
    measurementEntries: arr(old.measurementEntries).map((m) => ({ ...m, value: m.value ?? m.valueCm })),
    // Stari cardio je bil samo kcal na dan.
    cardioEntries: arr(old.cardioEntries).map((c) => ({ id: c.id, date: c.date, type: 'Cardio', kcal: c.kcal })),
    draft: old.draft,
    // Prehrane nova aplikacija nima; obroki ostanejo shranjeni, da se nič ne izgubi.
    legacy: arr(old.meals).length ? { meals: old.meals, importedAt: new Date().toISOString() } : null,
  };
  return migrate(d);
}

// ---------- nastavitve ----------

export function getSettings() { return { ...data.settings }; }
export function setSetting(key, value) {
  data.settings[key] = value;
  persist();
}

// ---------- vaje ----------

export function getExercise(id) { return data.exercises.find((e) => e.id === id) || null; }

export function listExercises() { return [...data.exercises].sort(byName); }

export function findExerciseByName(name) {
  const n = normalizeName(name);
  return data.exercises.find((e) => normalizeName(e.name) === n) || null;
}

export function searchExercises(query, excludeIds = []) {
  const q = normalizeName(query);
  const ex = new Set(excludeIds);
  const list = listExercises().filter((e) => !ex.has(e.id));
  if (!q) return list;
  const starts = [], contains = [];
  for (const e of list) {
    const n = normalizeName(e.name);
    if (n.startsWith(q)) starts.push(e);
    else if (n.includes(q)) contains.push(e);
  }
  return [...starts, ...contains];
}

export function createExercise(name) {
  const clean = String(name).trim().replace(/\s+/g, ' ');
  if (!clean) return null;
  const existing = findExerciseByName(clean);
  if (existing) return existing;
  const e = { id: newId(), name: clean, note: '', usesBodyweight: false, createdAt: new Date().toISOString() };
  data.exercises.push(e);
  persist();
  return e;
}

export function updateExercise(id, patch) {
  const e = getExercise(id);
  if (!e) return false;
  if ('name' in patch) {
    const clean = String(patch.name).trim().replace(/\s+/g, ' ');
    const other = findExerciseByName(clean);
    if (!clean || (other && other.id !== id)) return false;
    e.name = clean;
  }
  if ('note' in patch) e.note = String(patch.note);
  if ('usesBodyweight' in patch) e.usesBodyweight = !!patch.usesBodyweight;
  persist();
  return true;
}

/** Zbriše vajo iz vseh zapisov: register, predloge, zgodovina, trening v teku. */
export function removeExercise(id) {
  data.exercises = data.exercises.filter((e) => e.id !== id);
  for (const t of data.templates) t.exerciseIds = t.exerciseIds.filter((x) => x !== id);
  for (const w of data.workouts) w.exercises = w.exercises.filter((x) => x.exerciseId !== id);
  if (data.draft) data.draft.exercises = data.draft.exercises.filter((x) => x.exerciseId !== id);
  persist();
}

/**
 * Združi vajo fromId v intoId (dvojnika z različnima imenoma). Vsi treningi,
 * predloge in trening v teku dobijo intoId; če ima trening obe, se serije
 * združijo v eno vajo. Splošna zapiska se združita. fromId izgine.
 */
export function mergeExercises(fromId, intoId) {
  const from = getExercise(fromId), into = getExercise(intoId);
  if (!from || !into || fromId === intoId) return false;
  const fold = (list) => {
    const out = [];
    for (const e of list) {
      const id = e.exerciseId === fromId ? intoId : e.exerciseId;
      const same = id === intoId ? out.find((x) => x.exerciseId === intoId) : null;
      if (same) {
        same.sets = [...same.sets, ...e.sets];
        same.note = [same.note, e.note].filter(Boolean).join(' · ');
      } else out.push({ ...e, exerciseId: id });
    }
    return out;
  };
  for (const w of data.workouts) w.exercises = fold(w.exercises);
  if (data.draft) data.draft.exercises = fold(data.draft.exercises);
  for (const t of data.templates) t.exerciseIds = [...new Set(t.exerciseIds.map((x) => (x === fromId ? intoId : x)))];
  if (from.note && from.note !== into.note) into.note = [into.note, from.note].filter(Boolean).join('\n');
  data.exercises = data.exercises.filter((e) => e.id !== fromId);
  persist();
  return true;
}

// ---------- predloge ----------

export function getTemplate(id) { return data.templates.find((t) => t.id === id) || null; }

/**
 * Uredi predlogo brez treninga. name: novo ime (dobijo ga tudi pretekli treningi
 * s starim imenom, da "zadnjič" in arhiv ostaneta povezana); vrne false, če ime
 * že ima druga predloga. exerciseIds: nov seznam vaj v tem vrstnem redu.
 */
export function updateTemplate(id, { name = null, exerciseIds = null } = {}) {
  const t = getTemplate(id);
  if (!t) return false;
  if (name != null) {
    const clean = String(name).trim().replace(/\s+/g, ' ');
    const other = findTemplateByName(clean);
    if (!clean || (other && other.id !== id)) return false;
    const old = normalizeName(t.name);
    for (const w of data.workouts) if (normalizeName(w.name) === old) w.name = clean;
    if (data.draft && normalizeName(data.draft.name) === old) data.draft.name = clean;
    t.name = clean;
  }
  if (exerciseIds) t.exerciseIds = [...new Set(exerciseIds)].filter((x) => getExercise(x));
  t.updatedAt = new Date().toISOString();
  persist();
  return true;
}

export function listTemplates() {
  return data.templates.map((t) => {
    const last = latestWorkoutByName(t.name);
    return { ...t, count: t.exerciseIds.length, lastDate: last ? last.date : null };
  });
}

export function removeTemplate(id) {
  data.templates = data.templates.filter((t) => t.id !== id);
  persist();
}

function findTemplateByName(name) {
  const n = normalizeName(name);
  return data.templates.find((t) => normalizeName(t.name) === n) || null;
}

function latestWorkoutByName(name) {
  const n = normalizeName(name);
  let best = null;
  for (const w of data.workouts) {
    if (normalizeName(w.name) === n && (!best || w.date > best.date)) best = w;
  }
  return best;
}

export function workoutNameSuggestions() {
  const names = new Map();
  for (const t of data.templates) names.set(normalizeName(t.name), t.name);
  for (const w of data.workouts) if (!names.has(normalizeName(w.name))) names.set(normalizeName(w.name), w.name);
  return [...names.values()];
}

// ---------- trening v teku ----------

export function getDraft() { return data.draft; }

/** Začne trening. Iz predloge prinese vaje in toliko praznih serij, kot jih je bilo zadnjič. */
export function startWorkout(name, templateId = null) {
  const t = templateId ? data.templates.find((x) => x.id === templateId) : findTemplateByName(name);
  const exercises = [];
  if (t) {
    for (const exerciseId of t.exerciseIds) {
      if (!getExercise(exerciseId)) continue;
      exercises.push({ exerciseId, note: '', sets: emptySetsLike(lastSetsFor(exerciseId)) });
    }
  }
  data.draft = {
    name: String(name).trim() || (t ? t.name : 'Trening'),
    templateId: t ? t.id : null,
    startedAt: new Date().toISOString(),
    exercises,
    editingId: null,
    repeatOf: null,
    durationSec: null,
  };
  persist();
  return data.draft;
}

/** Prazne serije istih vrst in v istem številu kot podane (vsaj ena). */
export function emptySetsLike(sets) {
  return sets.length
    ? sets.map((s) => cleanSet({ kind: SET_KINDS.includes(s.kind) ? s.kind : 'normal' }))
    : [cleanSet({ kind: 'normal' })];
}

/**
 * Ponovi shranjen trening: iste vaje v istem vrstnem redu in prav toliko
 * serij istih vrst, prazne. "Zadnjič" ob serijah kaže prav ta trening.
 */
export function repeatWorkout(id) {
  if (data.draft) return null;
  const w = data.workouts.find((x) => x.id === id);
  if (!w) return null;
  const t = findTemplateByName(w.name);
  data.draft = {
    name: w.name,
    templateId: t ? t.id : null,
    startedAt: new Date().toISOString(),
    exercises: w.exercises
      .filter((e) => getExercise(e.exerciseId))
      .map((e) => ({ exerciseId: e.exerciseId, note: '', sets: emptySetsLike(e.sets) })),
    editingId: null,
    repeatOf: w.id,
    durationSec: null,
  };
  persist();
  return data.draft;
}

/** Odpre shranjen trening v urejevalniku. Shranjevanje ga prepiše na mestu. */
export function editWorkout(id) {
  if (data.draft) return null;
  const w = data.workouts.find((x) => x.id === id);
  if (!w) return null;
  data.draft = {
    name: w.name,
    templateId: w.templateId,
    startedAt: w.date,
    exercises: w.exercises.map((e) => ({ exerciseId: e.exerciseId, note: e.note, sets: e.sets.map((s) => ({ ...s, done: false })) })),
    editingId: w.id,
    repeatOf: null,
    durationSec: w.durationSec,
  };
  persist();
  return data.draft;
}

/** Vsaka sprememba treninga gre skozi to: telefon zna aplikacijo kadarkoli ubiti. */
export function updateDraft(mutator) {
  if (!data.draft) return;
  mutator(data.draft);
  persist();
}

export function discardDraft() {
  data.draft = null;
  persist();
}

export function newSet(kind = 'normal') { return cleanSet({ kind }); }

function setIsEmpty(s) {
  if (s.kind === 'empty') return false;
  if (s.kind === 'time') return s.seconds == null;
  if (s.kind === 'band') return s.reps == null && !s.band;
  return s.weightKg == null && s.reps == null;
}

/** Shrani trening v zgodovino in prepiše predlogo z istim imenom. */
export function saveWorkout() {
  const d = data.draft;
  if (!d) return null;
  const exercises = d.exercises
    .map((e) => ({ exerciseId: e.exerciseId, note: (e.note || '').trim(), sets: e.sets.filter((s) => !setIsEmpty(s)).map((s) => ({ ...s, done: false })) }))
    // Vaja z zapiskom ostane tudi brez serij ("rama me je bolela, izpustil").
    .filter((e) => e.sets.length > 0 || e.note);

  const started = new Date(d.startedAt);

  // Urejanje shranjenega: prepiše ga na mestu, predloge ne spreminja.
  // Brez serij ostane prejšnja različica (brisanje gre prek arhiva).
  if (d.editingId) {
    const w = data.workouts.find((x) => x.id === d.editingId);
    const ok = !!w && exercises.length > 0;
    if (ok) {
      w.name = d.name;
      w.date = isNaN(started) ? w.date : started.toISOString();
      w.exercises = exercises;
    }
    data.draft = null;
    persist();
    return ok ? w : null;
  }
  const elapsed = Math.round((Date.now() - started.getTime()) / 1000);
  const w = {
    id: newId(),
    name: d.name,
    templateId: null,
    date: isNaN(started) ? new Date().toISOString() : started.toISOString(),
    durationSec: elapsed > 0 && elapsed < 6 * 3600 ? elapsed : null,
    exercises,
  };

  // Predloga dobi vse vaje, tudi tiste brez serij: naslednjič naj se spet ponudijo.
  let t = findTemplateByName(d.name);
  if (!t) {
    t = { id: newId(), name: d.name, exerciseIds: [], updatedAt: '' };
    data.templates.push(t);
  }
  t.exerciseIds = d.exercises.map((e) => e.exerciseId);
  t.updatedAt = new Date().toISOString();
  w.templateId = t.id;

  if (exercises.length) data.workouts.push(w);
  data.draft = null;
  persist();
  return exercises.length ? w : null;
}

// ---------- zgodovina ----------

/**
 * Vaja iz zadnjega treninga (kjerkoli), v katerem je bila: { date, sets, note }.
 * before: samo treningi pred tem časom (pri urejanju starega treninga).
 * exclude: id treninga, ki se ne šteje (tisti, ki se ureja).
 * from: id treninga, ki ima prednost (pri ponovitvi treninga).
 */
export function lastEntryFor(exerciseId, { before = null, exclude = null, from = null } = {}) {
  if (from) {
    const w = data.workouts.find((x) => x.id === from);
    const e = w && w.exercises.find((x) => x.exerciseId === exerciseId);
    if (e && e.sets.length) return { date: w.date, sets: e.sets, note: e.note };
  }
  // Serije iz zadnjega treninga, kjer so bile; zapisek iz zadnjega, kjer je bila vaja
  // (lahko tudi brez serij: "rama me je bolela, izpustil").
  let best = null, latest = null;
  for (const w of data.workouts) {
    if (w.id === exclude || (before && w.date >= before)) continue;
    const e = w.exercises.find((x) => x.exerciseId === exerciseId);
    if (!e) continue;
    if (!latest || w.date > latest.date) latest = { date: w.date, note: e.note };
    if (e.sets.length && (!best || w.date > best.date)) best = { date: w.date, sets: e.sets };
  }
  if (best) return { ...best, note: latest.note };
  if (latest && latest.note) return { date: latest.date, sets: [], note: latest.note };
  return null;
}

/** Kje iskati "zadnjič" za trening v teku. */
export function lastContext(draft = data.draft) {
  if (!draft) return {};
  if (draft.editingId) return { before: draft.startedAt, exclude: draft.editingId };
  return { from: draft.repeatOf };
}

/** Serije iz zadnjega treninga (kjerkoli), v katerem je bila vaja. */
export function lastSetsFor(exerciseId, opts) {
  const e = lastEntryFor(exerciseId, opts);
  return e ? e.sets : [];
}

export function lastDateFor(exerciseId) {
  let best = null;
  for (const w of data.workouts) {
    if (w.exercises.some((x) => x.exerciseId === exerciseId) && (!best || w.date > best)) best = w.date;
  }
  return best;
}

export function listWorkouts(query = '') {
  const q = normalizeName(query);
  const list = [...data.workouts].sort((a, b) => (a.date < b.date ? 1 : -1));
  if (!q) return list;
  return list.filter((w) => {
    const d = new Date(w.date);
    const hay = normalizeName(`${w.name} ${dayOf(d)} ${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`);
    return hay.includes(q.replace(/\s/g, '')) || hay.includes(q);
  });
}

export function removeWorkout(id) {
  data.workouts = data.workouts.filter((w) => w.id !== id);
  persist();
}

// ---------- moč ----------

export function countsForStrength(s) { return s.kind === 'normal' && s.reps > 0; }

/** Ocena 1RM. Zapisana samo tukaj. */
export function estimate1RM(weightKg, reps) {
  if (!(reps > 0) || weightKg == null) return null;
  return weightKg * (1 + (Math.sqrt(reps) - 1) / 5);
}

export function bodyweightAt(day) {
  const list = listBodyweight();
  if (!list.length) return null;
  let found = null;
  for (const b of list) if (b.date <= day) found = b;
  return (found || list[0]).weightKg;
}

/** Vaje, ki so vsaj enkrat v zgodovini, s številom treningov. */
export function trainedExercises() {
  const counts = new Map();
  for (const w of data.workouts) for (const e of w.exercises) counts.set(e.exerciseId, (counts.get(e.exerciseId) || 0) + 1);
  return listExercises().filter((e) => counts.has(e.id)).map((e) => ({ ...e, sessions: counts.get(e.id) }));
}

/** Najboljša ocena 1RM po treningih, najstarejši prvi. */
export function strengthSeries(exerciseId) {
  const ex = getExercise(exerciseId);
  const points = [];
  let needsBodyweight = false;
  const sorted = [...data.workouts].sort((a, b) => (a.date < b.date ? -1 : 1));
  for (const w of sorted) {
    const e = w.exercises.find((x) => x.exerciseId === exerciseId);
    if (!e) continue;
    const day = dayOf(w.date);
    const bw = ex && ex.usesBodyweight ? bodyweightAt(day) : 0;
    if (ex && ex.usesBodyweight && bw == null) { needsBodyweight = true; continue; }
    let best = null, bestSet = null;
    for (const s of e.sets) {
      if (!countsForStrength(s)) continue;
      const v = estimate1RM((s.weightKg || 0) + bw, s.reps);
      if (v != null && (best == null || v > best)) { best = v; bestSet = s; }
    }
    if (best != null) points.push({ date: day, value: best, set: bestSet, workoutId: w.id });
  }
  return { points, needsBodyweight };
}

/** Najtežja serija v zgodovini (pri isti teži tista z več ponovitvami). */
export function personalRecord(exerciseId) {
  let best = null;
  for (const w of data.workouts) {
    const e = w.exercises.find((x) => x.exerciseId === exerciseId);
    if (!e) continue;
    for (const s of e.sets) {
      if (!countsForStrength(s) || s.weightKg == null) continue;
      if (!best || s.weightKg > best.weightKg || (s.weightKg === best.weightKg && s.reps > best.reps)) {
        best = { weightKg: s.weightKg, reps: s.reps, date: w.date };
      }
    }
  }
  return best;
}

// ---------- statistika ene vaje ----------

/** Treningi s to vajo (samo s serijami), najnovejši prvi: [{ workoutId, name, date, sets }]. */
export function exerciseSessions(exerciseId) {
  const out = [];
  for (const w of data.workouts) {
    const e = w.exercises.find((x) => x.exerciseId === exerciseId);
    if (e && e.sets.length) out.push({ workoutId: w.id, name: w.name, date: w.date, sets: e.sets });
  }
  return out.sort((a, b) => (a.date < b.date ? 1 : -1));
}

/**
 * Seštevki vaje med dnevoma (oba vključno, null = brez meje): treningi, serije,
 * ponovitve, volumen (kg × ponovitve, samo navadni seti) in najdaljši čas.
 */
export function exerciseTotals(exerciseId, fromDay = null, toDay = null) {
  const t = { sessions: 0, sets: 0, reps: 0, volumeKg: 0, seconds: 0, maxSeconds: 0 };
  for (const s of exerciseSessions(exerciseId)) {
    const d = dayOf(s.date);
    if ((fromDay && d < fromDay) || (toDay && d > toDay)) continue;
    t.sessions++;
    for (const x of s.sets) {
      if (x.kind === 'empty') continue;
      t.sets++;
      if (x.reps > 0) t.reps += x.reps;
      if (x.kind === 'normal' && x.reps > 0 && x.weightKg > 0) t.volumeKg += x.weightKg * x.reps;
      if (x.kind === 'time' && x.seconds > 0) {
        t.seconds += x.seconds;
        if (x.seconds > t.maxSeconds) t.maxSeconds = x.seconds;
      }
    }
  }
  return t;
}

/**
 * Serije, ki so ob svojem času presegle dotedanji rekord (isto pravilo kot
 * personalRecord). Vrne Set ključev `${workoutId}:${indeks serije}`.
 */
export function recordSetKeys(exerciseId) {
  const keys = new Set();
  let best = null;
  for (const s of exerciseSessions(exerciseId).reverse()) {
    s.sets.forEach((x, i) => {
      if (!countsForStrength(x) || x.weightKg == null) return;
      if (!best || x.weightKg > best.weightKg || (x.weightKg === best.weightKg && x.reps > best.reps)) {
        if (best) keys.add(`${s.workoutId}:${i}`);
        best = { weightKg: x.weightKg, reps: x.reps };
      }
    });
  }
  return keys;
}

// ---------- telesna teža ----------

export function listBodyweight() {
  return [...data.bodyweightEntries].sort((a, b) => (a.date < b.date ? -1 : 1));
}

/** En vnos na dan; ponoven vpis istega dne prepiše. */
export function setBodyweight(day, kg) {
  const v = num(kg);
  if (v == null || v <= 0) return false;
  const e = data.bodyweightEntries.find((b) => b.date === day);
  if (e) e.weightKg = v;
  else data.bodyweightEntries.push({ id: newId(), date: day, weightKg: v });
  persist();
  return true;
}

export function removeBodyweight(id) {
  data.bodyweightEntries = data.bodyweightEntries.filter((b) => b.id !== id);
  persist();
}

// ---------- koraki ----------
// Ena ročna številka na dan (iz Zdravja na telefonu). Strava korakov nikoli ne doda.

export function listSteps() {
  return [...data.stepsEntries].sort((a, b) => (a.date < b.date ? -1 : 1));
}

/** En vnos na dan; ponoven vpis istega dne prepiše (koraki čez dan rastejo). */
export function setSteps(day, steps) {
  const v = num(steps);
  if (v == null || v < 0 || v > 200000 || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const e = data.stepsEntries.find((x) => x.date === day);
  if (e) e.steps = Math.round(v);
  else data.stepsEntries.push({ id: newId(), date: day, steps: Math.round(v) });
  persist();
  return true;
}

// Kalorije na korak pri 70 kg za običajno hojo (pogost preprost izračun):
// 1000 korakov ≈ 40 kcal; za drugo težo sorazmerno.
const KCAL_PER_STEP_AT_70KG = 0.04;

/** Dolžina koraka v cm, ocenjena iz višine (0,414 × višina); brez višine null. */
export function strideCm() {
  const height = num(data.settings.heightCm);
  return height > 0 ? height * 0.414 : null;
}

/**
 * Ocena kalorij hoje iz korakov: koraki × 0,04 × (teža / 70).
 * Teža je zadnja vpisana do tega dne. Razdalja (km) je samo za prikaz in je
 * null, dokler ni v nastavitvah dolžine koraka ali višine.
 * Vrne { kcal, km } ali null, če ni vpisane teže.
 */
export function stepsEnergy(steps, day = todayIso()) {
  const weightKg = bodyweightAt(day);
  if (!(weightKg > 0) || !(steps > 0)) return null;
  const stride = strideCm();
  return {
    kcal: Math.round(steps * KCAL_PER_STEP_AT_70KG * (weightKg / 70)),
    km: stride > 0 ? (steps * stride) / 100000 : null,
  };
}

/** Kaj manjka za oceno kalorij iz korakov: 'weight' ali null. */
export function stepsEnergyMissing() {
  if (!data.bodyweightEntries.length) return 'weight';
  return null;
}

export function removeSteps(id) {
  data.stepsEntries = data.stepsEntries.filter((x) => x.id !== id);
  persist();
}

/**
 * Prebere korake iz vpisanega besedila, npr. "8432", "8.432", "8 432",
 * po želji z datumom ("2026-11-11 8432", "11. 11. 2026: 8.432").
 * Vrne { day, steps } ali null. Brez datuma je dan danes.
 */
export function parseStepsText(text) {
  let t = String(text || '').trim();
  if (!t) return null;
  let day = null;
  const iso = t.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  const sl = !iso && t.match(/(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/);
  if (iso) { day = `${iso[1]}-${pad(+iso[2])}-${pad(+iso[3])}`; t = t.replace(iso[0], ' '); }
  else if (sl) { day = `${sl[3]}-${pad(+sl[2])}-${pad(+sl[1])}`; t = t.replace(sl[0], ' '); }
  const m = t.match(/\d[\d.,\s  ']*/);
  if (!m) return null;
  // Decimalni del (",5" ali ".0") odreže; ostale pike, vejice in presledki so ločila tisočic.
  const digits = m[0].trim().replace(/[.,]\d{1,2}$/, '').replace(/\D/g, '');
  const steps = parseInt(digits, 10);
  if (!Number.isFinite(steps) || steps > 200000) return null;
  if (day && isNaN(new Date(day + 'T12:00:00'))) day = null;
  return { day: day || todayIso(), steps };
}

// ---------- meritve ----------

export function listMeasurements() { return [...data.measurements].sort(byName); }
export function getMeasurement(id) { return data.measurements.find((m) => m.id === id) || null; }

export function createMeasurement(name, unit = 'cm') {
  const clean = String(name).trim().replace(/\s+/g, ' ');
  if (!clean) return null;
  const n = normalizeName(clean);
  const existing = data.measurements.find((m) => normalizeName(m.name) === n);
  if (existing) return existing;
  const m = { id: newId(), name: clean, unit: UNITS.includes(unit) ? unit : 'cm', createdAt: new Date().toISOString() };
  data.measurements.push(m);
  persist();
  return m;
}

export function removeMeasurement(id) {
  data.measurements = data.measurements.filter((m) => m.id !== id);
  data.measurementEntries = data.measurementEntries.filter((e) => e.measurementId !== id);
  persist();
}

export function listMeasurementEntries(measurementId) {
  return data.measurementEntries
    .filter((e) => e.measurementId === measurementId)
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

export function setMeasurementEntry(measurementId, day, value) {
  const v = num(value);
  if (v == null) return false;
  const e = data.measurementEntries.find((x) => x.measurementId === measurementId && x.date === day);
  if (e) e.value = v;
  else data.measurementEntries.push({ id: newId(), measurementId, date: day, value: v });
  persist();
  return true;
}

export function removeMeasurementEntry(id) {
  data.measurementEntries = data.measurementEntries.filter((e) => e.id !== id);
  persist();
}

// ---------- cardio ----------

export function listCardio() {
  return [...data.cardioEntries].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

export function addCardio(entry) {
  const c = cleanCardio({ ...entry, id: newId() });
  if (c.durationSec == null && c.distanceKm == null && c.kcal == null) return null;
  data.cardioEntries.push(c);
  persist();
  return c;
}

export function updateCardio(id, patch) {
  const i = data.cardioEntries.findIndex((c) => c.id === id);
  if (i < 0) return false;
  data.cardioEntries[i] = cleanCardio({ ...data.cardioEntries[i], ...patch, id });
  persist();
  return true;
}

export function removeCardio(id) {
  data.cardioEntries = data.cardioEntries.filter((c) => c.id !== id);
  persist();
}

/** Vrste cardia iz zgodovine, najpogostejše prve. */
export function cardioTypes() {
  const counts = new Map();
  for (const c of data.cardioEntries) {
    const key = normalizeName(c.type);
    const cur = counts.get(key) || { name: c.type, n: 0 };
    cur.n++;
    counts.set(key, cur);
  }
  return [...counts.values()].sort((a, b) => b.n - a.n).map((x) => x.name);
}

/** Ali je aktivnost s Strave že uvožena (da se ne podvoji). */
export function hasStravaActivity(stravaId) {
  return data.cardioEntries.some((c) => c.stravaId != null && String(c.stravaId) === String(stravaId));
}

// ---------- koledar in povzetki ----------

/** Ponedeljek tedna, v katerem je dan. */
export function weekStart(day) {
  const d = new Date(day + 'T12:00:00');
  const wd = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - wd);
  return dayOf(d);
}

export function activityDays() {
  const training = new Set(data.workouts.map((w) => dayOf(w.date)));
  const cardio = new Set(data.cardioEntries.map((c) => c.date));
  return { training, cardio };
}

/** Zaporedni tedni (do vključno tega ali prejšnjega) z vsaj enim treningom ali cardiem. */
export function weekStreak() {
  const { training, cardio } = activityDays();
  const weeks = new Set([...training, ...cardio].map(weekStart));
  let w = weekStart(todayIso());
  let streak = 0;
  // Ta teden še teče: če še ni aktivnosti, se niz šteje od prejšnjega.
  if (!weeks.has(w)) w = shiftDay(w, -7);
  while (weeks.has(w)) { streak++; w = shiftDay(w, -7); }
  return streak;
}

export function shiftDay(day, delta) {
  const d = new Date(day + 'T12:00:00');
  d.setDate(d.getDate() + delta);
  return dayOf(d);
}

export function cardioTotals(fromDay, toDay) {
  const t = { count: 0, durationSec: 0, distanceKm: 0, kcal: 0 };
  for (const c of data.cardioEntries) {
    if (c.date < fromDay || c.date > toDay) continue;
    t.count++;
    t.durationSec += c.durationSec || 0;
    t.distanceKm += c.distanceKm || 0;
    t.kcal += c.kcal || 0;
  }
  return t;
}

export function workoutsBetween(fromDay, toDay) {
  return data.workouts.filter((w) => {
    const d = dayOf(w.date);
    return d >= fromDay && d <= toDay;
  }).length;
}

// ---------- varnostna kopija ----------

export function exportJson() { return JSON.stringify(data, null, 1); }

const BACKUP_EVERY_DAYS = 30;
const BACKUP_SNOOZE_DAYS = 3;

/** Kopija je narejena: naslednji opomnik čez 30 dni. */
export function markBackupDone() {
  data.settings.lastBackupAt = todayIso();
  data.settings.backupRemindOn = shiftDay(todayIso(), BACKUP_EVERY_DAYS);
  persist();
}

/** "Kasneje": opomnik se vrne čez nekaj dni. */
export function snoozeBackupReminder() {
  data.settings.backupRemindOn = shiftDay(todayIso(), BACKUP_SNOOZE_DAYS);
  persist();
}

/**
 * Ali je čas za opomnik. Štetje začne, ko je v aplikaciji prvi podatek,
 * da prazen telefon ne opominja za prazno kopijo.
 */
export function backupReminderDue() {
  const s = summary();
  if (!s.workouts && !s.cardio && !s.bodyweight && !s.steps) return false;
  if (!data.settings.backupRemindOn) {
    data.settings.backupRemindOn = shiftDay(todayIso(), BACKUP_EVERY_DAYS);
    persist();
    return false;
  }
  return todayIso() >= data.settings.backupRemindOn;
}

export function lastBackupDay() { return data.settings.lastBackupAt || null; }

export function summary(d = data) {
  return {
    workouts: d.workouts.length,
    exercises: d.exercises.length,
    cardio: d.cardioEntries.length,
    bodyweight: d.bodyweightEntries.length,
    steps: (d.stepsEntries || []).length,
  };
}

/** Prebere in preveri kopijo (nove ali stare aplikacije). Ne uveljavi je. */
export function readBackup(text) {
  let parsed;
  try { parsed = JSON.parse(text); } catch { throw new Error('not-json'); }
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.workouts)) throw new Error('not-a-backup');
  const d = migrate(parsed);
  return { data: d, counts: summary(d), legacy: parsed.app !== 'gymapp' };
}

export function applyBackup(d) {
  const accent = data.settings.accent;
  data = d;
  // Uvoz stare kopije nima barve; obdrži trenutno.
  if (!data.settings.accent) data.settings.accent = accent;
  persist();
}
