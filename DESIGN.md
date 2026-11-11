---
name: Trening
description: Dark glass workout log on an accent gradient; the exercise card is the unit of work.
colors:
  ground: "#08090c"
  ground-top: "color-mix(accent-deep 35%, #0c0d12)"
  sheet: "#1c1a20 → #121116"
  card: "rgba(17,16,20,.72) + white 5.5% → 2% sheen"
  glass: "white 10% → 4.5%, border white 9%"
  seam: "rgba(255,255,255,.08)"
  seam-strong: "rgba(255,255,255,.14)"
  text: "#eef1f5"
  text-muted: "#9b9ea6"
  text-faint: "#80838b"
  danger-text: "#ff6b6b"
  danger-fill: "#b3261e"
  accent-red: "#c4261f"
  accent-red-deep: "#661714"
  accent-red-text: "#ff6f66"
  strava-orange: "#fc5200"
typography:
  title:
    fontFamily: "system-ui, -apple-system, SF Pro Text, Segoe UI, Roboto, sans-serif"
    fontSize: "32px"
    fontWeight: 750
    lineHeight: 1.15
    letterSpacing: "-0.03em"
  eyebrow:
    fontSize: "12px"
    fontWeight: 700
    letterSpacing: "0.08em"
    textTransform: uppercase
  stat:
    fontSize: "30px"
    fontWeight: 700
    letterSpacing: "-0.03em"
  section-title:
    fontSize: "19px"
    fontWeight: 700
    letterSpacing: "-0.015em"
  card-title:
    fontSize: "17px"
    fontWeight: 700
  body:
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.4
  set-value:
    fontSize: "18px"
    fontWeight: 600
rounded:
  sm: "12px"
  md: "16px"
  lg: "22px"
  xl: "24px"
  sheet: "28px"
  pill: "999px"
spacing:
  xs: "6px"
  sm: "10px"
  md: "16px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.md}"
    height: "50px (54px in the workout action bar)"
  button-glass:
    background: "{colors.glass}"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
  card:
    background: "{colors.card}"
    border: "white 7.5%"
    rounded: "{rounded.lg}"
  card-glow:
    background: "accent 34% radial glow from top-right corner over dark glass"
    rounded: "{rounded.lg}"
  exercise-card:
    background: "accent 26% radial glow from top-right corner over dark glass"
    rounded: "{rounded.xl}"
  set-input:
    background: "rgba(0,0,0,.34)"
    rounded: "{rounded.sm}"
    height: "46px"
  set-ref:
    background: "rgba(255,255,255,.04)"
    textColor: "white 55%"
    rounded: "{rounded.sm}"
    height: "46px"
  tabbar:
    background: "light glass capsule, blur 30px saturate 180%"
    rounded: "34px"
    height: "68px"
  tab-active:
    background: "lighter glass lens, white 24% border"
    textColor: "{colors.accent-text}"
---

# Design System: Trening

## Overview

A personal training log used one-handed between sets, then reviewed at home. Chosen by the owner from mockups in `osnutki/izbrano/` (2026-11-11): a dark, minimal, modern look. A gradient made from the accent colour glows at the top of every screen; content sits on dark glass cards; a floating light-glass capsule holds the four tabs. Numbers stay the loudest thing on screen. The accent is chosen per person (presets in `js/theme.js`, default red), and every rule here works for any preset. Mockups are made in red only until the other colours are revisited at the very end.

## Colors

### Accent (per user)

The accent is a role, not a hue. `js/theme.js` sets `--accent` (fill under white text, ≥ 4.5:1), `--accent-deep` (dark end of gradients), `--accent-text` (accent as text, lines, chart ink on dark, ≥ 6:1) and `--on-accent`. It also tints the Android status bar with a dark mix of `--accent-deep`.

### Ground

`body` carries the gradient: two radial glows (accent 42 % top right, accent-deep 70 % left) over a linear fade from a dark accent mix to `#08090c` by 640px. It does not scroll; content scrolls over it. A fixed fade at the bottom darkens whatever passes under the tab bar.

### Neutral

Glass and cards are white at low alpha over the ground, with 1px white seams (8 % / 14 %). Muted text `#9b9ea6`, faint `#80838b` (both ≥ 4.5:1 on the ground).

### Named Rules

- **The Role Rule.** Never write an accent hex in a component. Use the four variables or `color-mix()` of them.
- **The Fill/Text Split.** Filled accent surfaces use `--accent`; accent text, chart lines and icons use `--accent-text`.
- **Red is a signal, not a surface.** Accent fills only where they mean something: the primary action, done days, the first "start" button, records. Cards are dark glass with at most a corner glow; never a fully accent-filled card.

## Typography

One system sans (SF Pro on iPhone), tabular numerals for every number a user compares. Screen title 32/750 under a 12px uppercase eyebrow (today's date, or "Trening v teku" in accent with a glowing dot). Section titles 19/700 in sentence case. Stat numbers 30/700. Set values 18/600 (15 when longer than four characters, e.g. "102,5").

## Layout

Single column, 560px measure centered on wide screens, 16px gutter. The header scrolls away with the content (no sticky bar). Sub-screens (archive, workout detail, exercise stats) put a round glass back button above the title. The tab bar floats 8px above the safe area; the workout's Zavrži / Končaj trening pair floats 12px above it.

## Elevation & Depth

Depth comes from glass: a white sheen gradient, a 1px white top highlight (`inset 0 1px 0`) and soft dark drop shadows on things that float (tab bar, action bar, sheets, toast). Coloured glow is allowed only as the accent corner glow of glass cards and a soft shadow under accent fills.

## Shapes

Radii 12 (set boxes), 16 (buttons, fields), 22 (cards), 24 (exercise cards), 28 (sheet top), pill (chips, header buttons, segmented control, tab bar). Header icon buttons are 44px glass circles. Icons: SVG on a 24px grid, stroke 2, round caps (`js/icons.js`).

## Components

### Home
Greeting by time of day. Week card (glow card): "Ta teden", count and total duration, streak pill, seven day circles (accent with a check on training days, accent ring today). A divider that fades at both ends. "Začni trening" with glass pills "Arhiv" and "+ Nov". Templates as a borderless list: name, when last done, first three exercises; a round play button, accent on the template not done for the longest. Then "Zadnji treningi" with "Ponovi".

### Exercise card (signature)
Dark glass with an accent corner glow. Head: grip (when more than one exercise), name, ⋯ menu (includes "Statistika vaje"). Set rows exactly as in the old app, no checkmarks:
`Set N · [kg] kg × [pon] │ [kg] × [pon]`. The right side is last time's set in faint boxes; tapping a box copies that value into today's set. Time sets show one last-time box (m:ss), band sets draw the band loop in its colour. A set counts when it has numbers in it; the header chip shows filled / total sets.

### Napredek calendar
Glow card with three small stats (weeks in a row highlighted, trainings and cardio in the shown month), the month title with round glass prev/next buttons (next disabled on the current month), and a month grid starting Monday: accent-filled circle = training day (a link to that workout), accent ring = cardio, white outline = today, future days dimmed.

### Line chart
As in the stats mockup: big last value with a small unit, under it "↑ 13 kg od 2. oktobra" (accent when up, muted when down), then the line with an accent area fade, three dashed grid lines, no Y labels, no point dots, a glowing white dot on the last value, three dates ("2. okt"). Touching the chart shows the nearest point's value and date.

### Bar chart
Same readout as the line chart (big value of the highlighted bar, "ta teden · povprečje … na teden"). Bars are soft rounded columns on faint full-height tracks, in a 50 % accent mix; the highlighted bar (this week, or the last day with steps) uses an accent-text → accent gradient with a soft glow. Four date labels, no value labels; touching shows a bar.

### Exercise stats (`#/napredek/vaja/<id>`)
Period segmented control (30 dni / 3 mes. / Leto / Vse); four tiles with ring icons (Rekord with accent glow, Serije, Ponovitve or Skupni čas, Volumen / Najdaljši čas / Zadnja elastika) and a delta to the previous equal period; a heatmap of sets (rows) by the last 12 sessions (columns), brighter = heavier, glowing = record; the 1RM line chart; the last five sessions as set pills.

### Buttons
Primary: accent fill with a soft accent shadow. Default/secondary/ghost: glass. Soft: accent 16 % tint with accent text (in-card "+ Serija"). Dashed: transparent with a dashed seam ("Dodaj vajo"). Every pressable scales slightly on press in 140ms.

### Inputs / Fields
White 6 % fill, white 10 % border; on focus the border turns `--accent-text` with a 4px accent ring. Set inputs are darker wells (black 34 %).

### Navigation
Light glass capsule (68px, radius 34) with four tabs, icon over an 11.5px label. The active tab is a lighter glass lens with the icon and label in `--accent-text`.

### Bottom sheet
Dark sheet with a faint accent glow, radius 28. Rises with `cubic-bezier(0.32, 0.72, 0, 1)` in 300ms, closes in 200ms, dismisses by drag or flick. Destructive actions sit last, separated, in danger red.

## Do's and Don'ts

### Do:
- Keep every interactive target at least 44px.
- Show last time's numbers next to every set (right-hand column), never as placeholders.
- Put destructive actions behind a confirm sheet that says what disappears and what stays.

### Don't:
- Don't fill whole cards with the accent, and don't add a second accent colour.
- Don't put checkmarks or arrows into set rows.
- Don't use gradient text or side-stripe borders.
- Don't animate tab switches or list re-renders; motion is for sheets, toasts and press feedback.
