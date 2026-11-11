# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Installable PWA, plain static HTML/CSS/JS with ES modules, no build step (same approach as the previous app, confirmed: "PWA kot prej"). Hosted on the owner's own GitHub Pages (public repo; data never leaves the phone). Strava sync needs one small serverless function (e.g. Cloudflare Worker) to hold the Strava client secret — the only server piece.

## Users

Two people, each on their own phone with their own data: the owner (Android/iPhone household, uses Strava) and a second lifter who built the previous app. Primary scene: on the gym floor between sets, phone in one hand, often sweaty, short attention, logging the set they just did. Secondary scene: at home, looking back at progress.

## Product Purpose

A personal training log that makes progress visible. Log strength work (exercise, sets, reps, load), cardio and body weight/measurements quickly, then see whether strength, body and conditioning are moving in the right direction. Success: logging a set takes seconds and one thumb; the stats answer "am I getting stronger?" at a glance.

## Positioning

Not a coach and not a social network: a private notebook that knows your own history. The exercise list grows only from what you have logged, every set shows what you did last time, and Strava workouts arrive on their own so cardio doesn't need retyping.

## Operating Context

- Used in the gym, one-handed, between sets; also at home for review.
- Workouts are named freely (push / pull / legs / upper …); a template grows from the name.
- Strava already records runs/rides/walks for the owner; those are imported as cardio. Strength sessions recorded on Strava ("Weight Training") are skipped to avoid duplicates.
- Steps are optional: one manual daily number copied from the phone's health app. Strava activities never add steps, so nothing is counted twice.
- Successor to a previous PWA (`Fitnes-aplikacija`, data `schemaVersion 7`); its JSON backup must be importable.

## Capabilities and Constraints

- Sections: Trening, Cardio, Teža in meritve, Statistika. No nutrition (explicitly dropped).
- Set kinds: normal (load × reps), band (elastika colour × reps), time (mm:ss), empty (placeholder). No superset/dropset/myoreps.
- Cardio entry: activity type, duration, distance, kcal.
- Stats: estimated 1RM per exercise + PRs; body weight and measurements over time; cardio totals per week/month; calendar of training days and weekly streak.
- Data: localStorage on the device, single store module, versioned schema with migrations; manual JSON export/import.
- No accounts, no sync between devices, no exercise database, no goals or nagging.
- Accent colour chosen per user from a preset palette (one user wants red, the other blue).
- UI language Slovene; code identifiers English.
- Undecided: app name, logo and intro animation (owner will decide later).

## Brand Commitments

- Name and logo are intentionally undecided (owner decides later).
- Standing visual preference (chosen 2026-11-10 over bolder directions): the category-standard workout-tracker look, executed cleanly. Evolve the previous app's look rather than replace it: dark slate ground, screen icon + title at the top, exercise cards whose header carries the accent, "Set N" rows with weight × reps fields, square icon buttons in the bottom bar. Make it cleaner and more modern, not different.
- Quality reference named by the owner: the Built With Science (Jeremy Ethier) app.
- Accent is user-selectable from a preset palette; nothing in the UI may assume one fixed accent hue.

## Evidence on Hand

Previous app source and docs at `../Fitnes-aplikacija/` (data model, decisions). No real user data in this repo; never commit personal data — the repo is public.

## Product Principles

1. Fewest taps to a logged set. Large targets, minimal typing, one thumb.
2. Your history is the interface: "last time" beside every set, suggestions only from your own entries.
3. Record what happened, don't prescribe: no plans, goals or warnings.
4. Never count anything twice (Strava vs manual cardio, steps, strength sessions).
5. Data is precious: migrations never lose history; backup is one tap.

## Accessibility & Inclusion

Gym context: high contrast on dark, readable at arm's length, touch targets ≥ 44 px, respects reduced motion.
