# AGENTS.md

## Commands

```bash
npm run dev      # Dev server (localhost:3000)
npm run build    # Production build — this is the ONLY verification step
npm run lint     # ESLint
```

There is **no test framework**. Verify changes with `npx next build`. If it compiles and type-checks, ship it.

## Architecture

Next.js 15 (App Router) + React 19 + Tailwind. Single-page app with one dynamic route (`/create`) and one API route (`/api/storage`).

**All video generation is client-side** — no server-side FFmpeg, no backend processing. The browser encodes H.264 MP4 via the WebCodecs API inside a Web Worker.

### Video pipeline (`lib/`)

```
generate-video.ts          Orchestrator: audio fetch → decode → overlay render → worker handoff
  └─ encode.worker.ts      Web Worker: mediabunny MP4 mux + H.264/AAC encode (CanvasSource + AudioSampleSource)
  └─ webcodecs-muxer.ts    Audio decode + resample only (AudioContext + OfflineAudioContext)
  └─ canva-utils.ts        Canvas drawing: text, backgrounds, frame decorations, text wrapping
  └─ fonts-ready.ts        ensureFontsReady() — MUST be awaited before canvas rendering
  └─ quran.ts              Quran Foundation API (api.quran.com/api/v4) — public, no auth
  └─ types.ts              VideoSettings, DEFAULT_SETTINGS, PRESETS, Draft persistence helpers
```

### UI (`components/VideoBuilder/`)

4-step wizard: `StepSurah → StepVerses → StepSettings → StepGenerate`. Orchestrated by `VideoBuilder.tsx` which holds all state (settings, selections, generation progress).

### Key invariants

- **Fonts:** `ensureFontsReady()` must be called before any canvas `fillText`/`drawAyahFrame`. Without it, mobile renders with fallback fonts. Used in both `generate-video.ts` (pre-render) and `StepGenerate.tsx` (live preview).
- **Worker transfer:** `ImageBitmap` arrays and `ArrayBuffer` (audio) are **transferred** to the worker, not cloned. They become unusable on the main thread after `postMessage`. The worker calls `.close()` on them during finalize.
- **Frame allocation:** `buildSegments()` uses cumulative time tracking (not per-verse rounding) to prevent audio/video drift on long surahs. Don't switch back to independent per-verse `Math.round`.
- **`LEAD_IN_SEC = 0`:** Text and audio start at the exact same timestamp. Don't add pre-roll silence.
- **Verse transitions:** Crossfade — old verse alpha decreases while new verse alpha increases, alphas sum to ~1. Never fade both to zero (that creates the "dark gap" bug).
- **Video backgrounds (ordered playlist):** settings hold `videoUrls: string[]` (index 0 plays first). Upload mode = exactly one file. Library/Pexels = multi-select (tap toggles, tap again removes; chips show play order + a ⓪→①… numeric order badge on thumbnails). Pipeline: main thread fetches **all** raw bytes (parallel, drop failures; hard-error only if a requested bg yields 0 bytes), the worker decodes **each video in parallel** (`maxBgFrames` split across the playlist), then composes them end-to-end with a ~0.33s crossfade at each seam; if the output outlives the playlist, the LAST video loops. Legacy scalar `videoUrl` is the fallback for old drafts — never remove it. Text-overlay bitmaps stay transparent; worker draws decoded video + `bgOverlay` darkness beneath.
- **Frame doubling:** Renders 30 unique frames/sec, submits each twice to the encoder for 60fps output. H.264 P-frames make duplicates nearly free. Don't try to render 60 unique frames — it doubles encode time for zero visual gain.
- **`bgVideoRef` not in rAF deps:** The preview's `useEffect` intentionally excludes `bgVideoRef` and settings from the dependency array. The rAF loop reads ref values instead. Adding them restarts the loop and causes preview stutter.

### Performance tiers

`getDeviceProfile()` detects mobile/low-power and scales output:
- **Desktop:** 1080p @ 60fps, 6 Mbps, `latencyMode: "realtime"`
- **Low-power mobile:** 720p @ 30fps, ~2 Mbps, `bitrateScale: 0.7`

### Length estimator

`estimateTotalDurationSec()` in `lib/generate-video.ts` decodes every selected ayah's real audio (concurrent + cache-aware) and sums it with `verseSpacing` — shown as the accurate "Length ≈ m:ss" readout on the Verses step (once a reciter is picked) and used on the Settings step as the duration hint for sizing the background playlist. Cancelled/re-run on selection change.

### Draft persistence

State auto-saves to `localStorage` under `midhkar-draft` (24h expiry). `loadDraft()`/`saveDraft()`/`clearDraft()` live in `lib/types.ts`. "Start Over" clears the draft.

## External APIs

- **Quran data:** `api.quran.com/api/v4` (Quran Foundation). Public content endpoints, **no OAuth2 needed**. Used for chapters, verses (Uthmani text), translations.
- **Per-ayah audio:** `the-quran-project.github.io/Quran-Audio/Data/` (primary) + `everyayah.com/data/` (fallback). Both are Quran Foundation CDNs.
- **Translation resource IDs:** `20` = English (Saheeh International), `31` = French (Muhammad Hamidullah). Old IDs `131`/`136` were wrong — fetched zero translations and produced missing subtitles.

## Environment

`.env.local` (optional — only needed for background video library feature):

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_BUCKET=videos
```

Without Supabase credentials, the app works fine with color/gradient backgrounds. The `/api/storage` route returns a 500 but the UI handles it gracefully.

## Conventions

- **Path alias:** `@/*` → project root (e.g., `@/lib/types`)
- **`"use client"`** at the top of: all `components/VideoBuilder/*.tsx`, `lib/generate-video.ts`, `lib/i18n.tsx`. The worker file does NOT have it (it has `/// <reference lib="webworker" />` instead).
- **i18n:** `en` / `fr` / `ar`. Locale stored in `localStorage` as `midhkar-locale`. Arabic sets `dir="rtl"` on `<html>`. All UI strings are inline ternaries (`ar ? "عربي" : "English"`), not a translation file.
- **Tailwind colors:** Custom palette via CSS variables in `globals.css` — `ink`, `parchment`, `gold`, `verdant`. Use `rgb(var(--gold) / <alpha>)` pattern, not hex.
- **Arabic text in HTML:** Add `translate="no"` to Quranic text containers (per Quran Foundation recommendation).
- **No comments** unless explicitly requested by the user.

## Gotchas

- **WebCodecs support:** Requires Chrome/Edge 94+ or Safari 18+. Firefox has no `VideoEncoder`. The UI shows a warning if unsupported. Don't remove the `isWebCodecsSupported()` check.
- **`next.config.js` has no COOP/COEP headers** — WebCodecs doesn't need them. Don't add them unless re-enabling ffmpeg.wasm.
- **`mediabunny`** is the MP4 muxer (replaces the old `mp4-muxer`). Uses `CanvasSource` + `AudioSampleSource` abstractions. Don't swap for raw WebCodecs without rewriting the entire worker.
- **Audio sample rate is 48kHz mono.** If you change `SAMPLE_RATE` in `webcodecs-muxer.ts`, the worker's audio encoding assumes the same rate.
- **Deploy target:** Vercel free tier. No server-side video processing possible (10s function timeout). Keep everything client-side.
