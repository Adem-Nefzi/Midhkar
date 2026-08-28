# DESIGN.md — Midhkar

Direction: **Laylat al-Qadr — The Night of Sharing** (seed `1dca363b`)

## World

A quiet street on Laylat al-Qadr. Night ink sky, lantern gold used only as
emitted light, parchment as lit paper. One light source per composition.
One living ambient element. Active states are bands of light, not pills.
Ornament is sparse and intentional — the product output is the hero.

## Tokens (`app/globals.css`, `tailwind.config.ts`)

| Token | Value | Role |
| --- | --- | --- |
| `--ink` | `11 14 26` | night sky base |
| `--ink-soft` | `21 27 48` | raised surface |
| `--ink-raise` | `32 39 66` | hover surface |
| `--gold` | `212 175 55` | lantern light (emitted, never fill) |
| `--gold-soft` | `229 199 107` | halo / hover gold |
| `--ember` | `235 176 84` | warm accent (live dot) |
| `--verdant` | `95 141 110` | success only |
| `--parchment` | `245 240 232` | lit paper / primary text |
| `--parchment-muted` | `178 173 165` | secondary text |
| `--parchment-dim` | `143 140 135` | tertiary text / placeholders |

Use `rgb(var(--token) / <alpha>)`. Never hex in components.

## Type

- Display: Fraunces (`font-display`) — headings, numerals. Max ~6rem.
- UI sans: Inter (`font-sans`) — deliberate, paired with Fraunces.
- Arabic: Amiri (`font-arabic`), Noto Naskh (`font-naskh`); video canvas
  additionally loads Scheherazade, Kufi, Cairo, Tajawal, Lateef, Reem Kufi,
  Lato, Playfair, Merriweather, Nunito, Poppins, JetBrains Mono via the
  Google Fonts import in `globals.css` — **required for video rendering,
  do not remove** (this is the intentional `overused-font` detector note).

## Surfaces & light

- `.night-sky` — page base: flat ink + faint radial gold at top.
- `.warm-glow` — the single light source; absolutely positioned, blurred.
- `.panel` — raised card: `ink-soft`, 1px gold/12 border, 16px radius,
  offset+blur shadow. `.panel-inset` for wells. `.panel-lit` for lit figures.
- `.lit` / `.lit-soft` — selected/active states as emitted light.
- `.light-band` — full-width active band (Grid-Horizon raise).
- `.string-lights` — dotted warm line (how-it-works connector).

## Components

- `.btn-primary` (gold, ink text), `.btn-ghost` (hairline), `.btn-icon`.
- `.toggle-track/.toggle-thumb` — ease-out-quart only, no bounce.
- `.skeleton` — shimmer wells for loading.
- `.ayah-marker` — verse address medallion (verse-as-address raise).
- Icons: stroke grammar in `components/VideoBuilder/icons.tsx`. No emoji,
  no Unicode glyph substitutes. `KuficBorder` intentionally returns null.

## Motion

Library: `motion` (Framer Motion), mounted once via `components/MotionProvider.tsx`
(`LazyMotion` + `domAnimation`, strict; `MotionConfig reducedMotion="user"`).
Use `m.*` elements — never `motion.*` (strict mode). Shared easings exported
from the provider: `EASE_OUT = [0.16, 1, 0.3, 1]` (expo-out), `EASE_SOFT`.

Authored focal moments (one per surface, not scattered):

- **Landing — hero ignition:** headline reveals through a clip-mask rise,
  the product canvas rises while the lantern glow ignites behind it, trust
  items stagger in as small lights (`hero.tsx`).
- **Landing — string lights:** the how-it-works connector draws itself as an
  SVG path on scroll; bulbs flicker on in sequence (`how.tsx`).
- **Studio — stations of light:** a `layoutId="station-bead"` glow ring
  travels between step stations; step content transitions directionally via
  `AnimatePresence mode="wait"` (320ms, exits faster than entrances).
- **Studio — generation:** progress bar carries a `progress-sweep` light
  band; log lines enter/exit via `AnimatePresence`; `night-bloom` finale.

Supporting motion:

- `whileInView` reveals (once, amount 0.35–0.5) replace the old `Reveal`.
- `Magnetic` pointer-spring wrapper for primary CTAs.
- `.track-glow` cursor-tracked radial light on feature rows (`usePointerVars`).
- `layoutId="locale-pill"` slides between locale buttons in the navbar.
- `.select-bloom` box-shadow pulse on card selection; marquee pauses on hover.
- Preview aside glides in (`x: 48 → 0`) when the first verse is selected.

Rules:

- All spatial motion disabled automatically under `prefers-reduced-motion`
  (`MotionConfig reducedMotion="user"`); CSS loops are gated in globals.
- No motion competes with encoding: the generation step's ambient loops are
  CSS-only and cheap; nothing drives rAF outside `LivePreview`.
- Exits are faster than entrances; routine feedback stays 100–300ms.
- `fade-up`, `step-in`, `lantern-breathe` (the one living ambient element),
  `night-bloom`, `pulse-wave`, `marquee`, `skeleton-slide` remain the CSS set.

## Rules

- No kickers/eyebrows above headings, no gradient text, no decorative
  glass/blur, no aurora, no noise overlays, no identical card grids.
- One light source per composition. Contrast ≥ 4.5 for text.
- Quranic text containers carry `translate="no"` and `dir="rtl" lang="ar"`.
- Studio: stations-of-light rail; persistent pixel-accurate `LivePreview`
  on desktop from verse selection onward (`renderFullFrame` shared with
  the encoder — never fork preview rendering).
- Completion: brief gold `night-bloom`, not fireworks. Mute toggle kept.

## Known detector notes

- `overused-font` (Inter): intentional — video-canvas requirement + UI pairing.
- Bounce easing: removed; use `cubic-bezier(0.25, 1, 0.5, 1)`.
