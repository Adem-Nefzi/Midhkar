# AGENTS.md

## Commands

```bash
npm run dev      # Dev server (localhost:3000)
npm run build    # Production build — this is the ONLY verification step
npm run lint     # ESLint
```

There is **no test framework**. Verify changes with `npx next build`. If it compiles and type-checks, ship it.

## Architecture

Next.js 15 (App Router) + React 19 + Tailwind. Single-page app with one dynamic route (`/create`) and two API routes (`/api/pexels/search`, `/api/storage`).

**All video generation is client-side** — no server-side FFmpeg, no backend processing. The browser encodes H.264 MP4 via the WebCodecs API inside a Web Worker.

### Video pipeline (`lib/`)

```
generate-video.ts          Orchestrator: audio fetch → decode → overlay render → worker handoff
  └─ encode.worker.ts      Web Worker: mediabunny MP4 mux + H.264/AAC encode (CanvasSource + AudioSampleSource)
  └─ webcodecs-muxer.ts    Audio decode + resample only (AudioContext + OfflineAudioContext)
  └─ canva-utils.ts        Canvas drawing: text, backgrounds, frame decorations, text wrapping,
                           renderFullFrame/drawOverlayStyle/drawWatermark (shared with hero + preview)
  └─ device-profile.ts     getDeviceProfile/getOutputResolution/getVideoBitrate — single source of truth
  └─ fonts-ready.ts        ensureFontsReady() — MUST be awaited before canvas rendering
  └─ quran.ts              Quran Foundation API (api.quran.com/api/v4) — public, no auth
  └─ video-meta.ts         Video duration probe w/ TTL cache + in-flight dedupe
  └─ pexels-client.ts      Pexels API client (abortable)
  └─ rate-limit.ts         Server-only token-bucket limiters for API routes
  └─ types.ts              VideoSettings, DEFAULT_SETTINGS, PLATFORM_META (no hardcoded dims)
```

Keep `device-profile.ts` tiny and dependency-free: the landing hero and pickers import it. Anything that only needs canvas drawing imports `canva-utils.ts` — never import `generate-video.ts` from the landing bundle (it drags in the whole pipeline).

### UI (`components/VideoBuilder/`)

4-step wizard: `StepSurah → StepVerses → StepSettings → StepGenerate`. Orchestrated by `VideoBuilder.tsx` which holds all state (settings, selections, generation progress). `settings/library-search.tsx` holds the Pexels Library search UI (split out of StepSettings).

### Key invariants

- **Fonts:** `ensureFontsReady(settings)` loads ONLY the font families the current settings use (selective, cached per family-set) and must be called before any canvas `fillText`/`drawAyahFrame`. Without it, mobile renders with fallback fonts. Used in `generate-video.ts` (pre-render), `StepGenerate.tsx`/`LivePreview.tsx` (preview), and the landing hero (`DEFAULT_SETTINGS`).
- **Worker transfer:** overlay `ImageBitmap`s are **streamed** to the worker in batches (`overlays` messages, ~8 at a time) while rendering continues on the main thread — the `start` payload only carries counts (`overlayCount`, `maxTotalBgFrames`, `bgDurations`). Audio `ArrayBuffer` and background-video bytes are transferred with `start`. Transferred objects are unusable on the main thread afterwards; the worker `.close()`s each overlay once its frames are consumed.
- **Frame allocation:** `buildSegments()` uses cumulative time tracking (not per-verse rounding) to prevent audio/video drift on long surahs. Don't switch back to independent per-verse `Math.round`.
- **`LEAD_IN_SEC = 0`:** Text and audio start at the exact same timestamp. Don't add pre-roll silence.
- **Verse transitions:** Crossfade — old verse alpha decreases while new verse alpha increases, alphas sum to ~1. Never fade both to zero (that creates the "dark gap" bug).
- **Video backgrounds (ordered playlist):** settings hold `videoUrls: string[]` (index 0 plays first). Upload mode = exactly one file. Library (Pexels) = multi-select (tap toggles, tap again removes; chips show play order + a ⓪→①… numeric order badge on thumbnails). Pipeline: main thread fetches bytes **in playlist order** (stop early once untrimmed bytes provably cover the decode window); the worker decodes **each video** from a `BufferSource` via `sink.canvases(0, duration)` (mediabunny's presentation-order frame iterator — same path as uploads), splitting `maxBgFrames` across the playlist, then composes them end-to-end with a ~0.33s crossfade at each seam; if the output outlives the playlist, the LAST video loops. Frame budget per clip is allocated by `allocateBgBudget` — proportional to known clip durations (even split fallback, min 30 frames/clip), and each clip's slot uses its FULL decoded length so seam crossfades are always reachable. Legacy scalar `videoUrl` is kept for old settings — never remove it. Don't hand-roll timestamp stepping (`getCanvas(t)`) or wrap stream-bytes in `new Blob(...)` — that's what truncated clips to a few seconds. Text-overlay bitmaps stay transparent; worker draws decoded video + `bgOverlay` darkness beneath.
- **Background UI model:** StepSettings offers exactly two sources — **Upload** and **Library** (Pexels search; internal discriminator stays `"pexels"`, only labels say Library). Pattern/Color pickers and Quick Themes were **removed from the UI**; the pipeline branches for `"pattern"`/`"color"`/`"library"` remain in `canva-utils.ts` for robustness and the landing hero preview. `DEFAULT_SETTINGS.background = "pexels"`. **Graceful fallback:** if a video background has no source (empty playlist), `renderAyahOverlays` bakes the default dark gradient into the overlay bitmaps (`hasBgVideo`/`isStaticBg`) and `renderFullFrame` mirrors the same check — Generate never produces a black frame. Keep both in sync.
- **Supabase library disabled:** the Supabase video library UI/data paths are **commented out, not deleted** (markers: `Supabase Library (disabled — restore by uncommenting)` in `VideoBuilder.tsx` + `StepSettings.tsx`). `lib/storage-client.ts` and `/api/storage` remain. Restore by uncommenting.
- **Frame doubling:** Renders 30 unique frames/sec, submits each twice to the encoder for 60fps output. H.264 P-frames make duplicates nearly free. Don't try to render 60 unique frames — it doubles encode time for zero visual gain.
- **`bgVideoRef` not in rAF deps:** The preview's `useEffect` intentionally excludes `bgVideoRef` and settings from the dependency array. The rAF loop reads ref values instead. Adding them restarts the loop and causes preview stutter.
- **Audio cache + AudioContext:** decoded ayah audio is cached in an LRU map (cap 300) in `generate-video.ts`; the cache is cleared only on reciter/surah change, NOT on verse toggles. AudioContexts are refcounted via `acquireAudioContext()`/`releaseAudioContext()` (`webcodecs-muxer.ts`) — every prefetch/estimate/generate path must release. Browsers cap live AudioContexts (~6); leaking them kills audio.
- **API hardening:** `/api/pexels/search` is rate-limited (per-IP token bucket + global hourly cap, `lib/rate-limit.ts`), result-cached 5 min, validates/normalizes all params, uses a 10s upstream timeout, and returns generic error messages (no key/stack leaks). `/api/storage` returns **404** unless `STORAGE_LIBRARY_ENABLED=true`. Don't weaken these when touching the routes.
- **Quran client resilience:** `lib/quran.ts` fetches have a 10s timeout, one retry, optional `AbortSignal`, and a sessionStorage cache. `fetchAyahs(surah, lang, signal)` returns verses WITH translations in one call — don't reintroduce a separate translation round-trip.
- **Translation is never truncated or dropped:** `measureTextBlock` (`lib/canva-utils.ts`) wraps the FULL translation at `maxW * 0.95` (using the frame's side space) and, when a block genuinely overflows, gently scales fonts down proportionally (max 3 steps, floors: Arabic ≥ 24px, translation ≥ 13px) so every line always renders. The text-block cache key includes the safe height — square and vertical frames never share a block. Don't reintroduce a character cap or `slice(...) + "..."`.

### Performance tiers

`getDeviceProfile()` (`lib/device-profile.ts`) detects mobile/low-power and scales output. `getOutputResolution(aspect, isLowPower)` is the single source of truth for encode dimensions — encoder, `LivePreview`, and the platform picker all read it, so displayed dims always match the real encode:
- **Desktop:** true 1080p (1920×1080 / 1080×1920 / 1080×1080) @ 60fps, 6 Mbps, `latencyMode: "realtime"`
- **Low-power mobile:** 720p-class (1280×720 / 720×1280; square stays 1080) @ 30fps, `bitrateScale: 0.7`
- Bitrate ladder by pixel count: ≥1080×1920 → 6 Mbps · ≥1080×1080 → 4.5 Mbps · ≥1280×720 → 3 Mbps · else 2.5 Mbps (× `bitrateScale`)

### Length estimator

`estimateTotalDurationSec()` in `lib/generate-video.ts` decodes every selected ayah's real audio (concurrent + cache-aware) and sums it with `verseSpacing` — shown as the accurate "Length ≈ m:ss" readout on the Verses step (once a reciter is picked) and used on the Settings step as the duration hint for sizing the background playlist. Cancelled/re-run on selection change.

### Serverless render pipeline (Vercel-native, server-side FFmpeg)

Generation runs **server-first inside the app's own Vercel functions** — no separate host, no user resources. `handleGenerate` in `VideoBuilder.tsx` always tries `/api/render/*` first; the in-browser WebCodecs pipeline runs ONLY as fallback (server failure or >10-min selection) or on browsers without WebCodecs (no fallback → cloud is their only path).

**Flow:** client measures per-ayah durations (`estimateAyahDurationsSec`), POSTs spec to `/api/render/plan` (validates, splits into verse-aligned ≤55s chunks — boundaries never split a crossfade window) → per-chunk `POST /api/render/chunk` (renders via `lib/server/render-chunk.ts`, idempotent — an existing chunk returns `cached:true`) → `/api/render/finalize` (lossless concat `-c copy` + `+faststart`) → `/api/render/download` streams the MP4, then DELETEs the job. Upload-mode bg videos go browser→Blob direct via `@vercel/blob/client` + `/api/render/upload-token` (functions cap request bodies at 4.5MB — never POST a video through a function). State = Vercel Blob paths only (`renders/<jobId>/spec.json|chunk-N.mp4|bg-input.mp4|final.mp4`) — serverless instances share nothing, so nothing lives in memory. `lib/server/render-store.ts` abstracts Blob (prod) vs disk (dev, `next dev` works with zero setup). Daily `/api/cron/cleanup` (vercel.json, Hobby-legal once/day) sweeps jobs >24h; the client already deletes after download.

**Renderer:** `lib/server/render-chunk.ts` is a port of the verified `render-service` pipeline (golden overlay parity 99.6%): same timing constants (cumulative segments, 8-frame verse crossfades alpha-sum-1, 10-frame bg seams, 30fps doubled to 60), same encode ladder (libx264 High + `x264-params ref=1:rc-lookahead=8:bframes=0` memory profile, bitrate by pixel count, AAC 128k mono 48k). Every chunk uses IDENTICAL stream parameters → concat is lossless. Chunk-local bookend fades: fade-in only on chunk 0, fade-out only on the last chunk, or seams visibly pulse. **When `lib/canva-utils.ts` changes, re-copy to BOTH `lib/server/server-canvas/canva-utils.ts` AND `render-service/src/canvas/canva-utils.ts`** (adapt imports to the local type shims). `next.config.js` keeps `@napi-rs/canvas`/`ffmpeg-static`/`ffprobe-static` in `serverExternalPackages` (webpack can't bundle native binaries — don't remove).

**Why chunked:** Hobby functions cap at 300s/1 vCPU/2GB. A ~55s-of-output chunk renders in ~120s at 1 vCPU, verified e2e on Windows dev (plan → 4 chunks → concat → valid 60fps H.264+AAC MP4, Arabic text pixel-verified). Client chunk POSTs are sequential + idempotent + sessionStorage-tracked (`midhkar-render-job` — render-job state ONLY, not wizard settings), so refresh-resume and retries are safe. Only env var: `BLOB_READ_WRITE_TOKEN` (auto-injected by connecting a Blob store in the dashboard). Without it, prod degrades to the browser pipeline and dev uses disk.

**Cancellation semantics (don't regress):** only a user click on Cancel shows "Cancelled." (`ctrl.signal.aborted` → AbortError). ANY other server-path failure (timeout, 5xx, upload fail, >10-min cap) falls through to the local WebCodecs pipeline with a log note — generation can never fully die. `render-service/` (the old standalone Docker service) stays in the repo unused; its DEPLOY.md guides are historical.

### Draft persistence — REMOVED

Auto-save/checkpoint was deleted per user request. No `midhkar-draft` / `midhkar-checkpoint` keys are written anymore; `VideoBuilder.tsx` wipes both legacy keys once on mount. Don't reintroduce auto-save without asking.

### Homepage atmosphere (`components/Home/atmosphere.tsx`)

Each landing section gets ONE unique ambient treatment (never repeated): Hero = star-rosette `PatternBackdrop` with bottom fade mask + `FallingPetals` + `BloomScatter` around the phone/ayah · How = drifting pollen `Motes` + girih band + bloom row · Features = giant Amiri calligraphic watermark ("الذِّكْر") with one breathing rose · QuranPreview = mihrab arch glow + arch pattern edges + vine blooms · Footer = closing-ayah band + living garden floor (`GardenBed`) + fireflies/petals over the illuminated border strip. `ThreadDivider` (gold hairline + shimmer) separates sections. All layers are `aria-hidden`, CSS-transform-based, and gated by the global `prefers-reduced-motion` block in `globals.css`. `lib/islamic-patterns.ts` + `PatternBackdrop.tsx` serve the homepage — they are NOT the (removed) video background picker.

**Footer ayah band:** the footer shows ONE ayah — 2:186 ("indeed I am near") — once, full-width, instead of any repeated bismillah. `FooterAyah` fetches it byte-exact via `fetchVerseByKey(2, 186, lang)`; `FALLBACK_AR/EN/FR` in `footer.tsx` are API-verified copies so the band never renders empty. Don't reintroduce a bismillah marquee (the `.marquee` CSS was deleted with it). `GardenBed` (`components/Ornament/ornaments.tsx`) renders the footer floor: deterministic grass blades swaying via `.grass-sway` (CSS vars `--grass-a/-d/-delay`), leaves and stemmed blooms that pop on scroll.

**Type ladder (readability floor):** no `text-[8px]`–`text-[11px]` anywhere. Smallest sizes are `text-xs` (12px, only where 13px doesn't fit) and `text-[13px]` for what used to be `text-xs`; `text-sm` and up unchanged. When adding UI, don't reach below `text-xs`.

**Parallax:** `useParallax(px, {scale, rotate, pointerDrift})` / `<Parallax px={…}>` in `atmosphere.tsx` — hand-rolled (passive scroll + rAF + IntersectionObserver gating, transform-only, zero React state) with lerp-smoothed spring-settled motion; optional depth scale/rotate and cursor drift (fine pointers only). Deliberately NOT motion's `useScroll`: the app boots `LazyMotion` with `domAnimation`, and `useScroll` would force `domMax` onto the landing bundle. Decorative layers only — never parallax readable text. Layers need vertical bleed (e.g. `-inset-y-16`) so translation never exposes an edge; layers with `pointerDrift` also need horizontal bleed (`-inset-x-3`+). Reduced-motion users get zero transforms. `ScrollThread` (home-content.tsx) is the 2px gold scroll-progress hairline — functional, kept under reduced motion, origin flips with RTL.

**Living hero preview:** the "What you'll share" phone cycles 4 ayahs (54:17 → 13:28 → 2:152 → 55:13) every 5s. Text + translation are fetched byte-exact from the Quran Foundation API (`fetchVerseByKey`) — never retype the Arabic. Two offscreen 1080×1920 canvases ping-pong with a 650ms rAF crossfade (bounded memory); cycling pauses offscreen/hidden tab; any fetch failure degrades to the static single-ayah render. The phone also pointer-tilts ≤3.5° on fine pointers. `data-ayah` on the canvas is the test hook.

### VideoBuilder backdrop — "The Atelier" (`studio-backdrop.tsx`)

The old full-bleed star pattern was distracting behind the dense picker UI. The atelier recedes: calm gradient center, girih pattern bands on the far left/right edges only (hidden below `lg`), one barely-there rotating studio seal (140s/turn, 5% opacity), a softer lamp, and living motes (`Motes count={16} dim={1} boost interactive` — two depth groups that drift toward the cursor). Keep the center quiet — ornament at the edges only.

Living layers (all `aria-hidden`, transform/opacity-only, reduced-motion safe): motes + `FallingPetals` live in **`fixed inset-0` wrappers** so they stay in view on tall picker pages (the backdrop itself spans full scroll height — absolute layers there scatter offscreen). `BloomScatter` blooms climb both edge bands (pop on scroll-in). `HoverBloom` buds sit in the bottom corners and open on hover — pure CSS transitions, `pointer-events-auto` on the bud only. `ScrollBloom` (Surah step only, `StudioBackdrop` takes `step`) is the right-edge rose that **blooms/grows scrolling down, closes/shrinks scrolling up**: hand-rolled rAF + lerp hook (passive scroll listener, idle-settle, no motion `useScroll`), wrapper scale/rotate + one CSS var `--bloom-open` (0..1) driving the bud→bloom crossfade via `.scroll-bloom-bud/-open/-glow` in `globals.css`. Desktop `lg+` only. Don't put React state in its scroll loop.

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

Without Supabase credentials, the app works fine — the default background source is the Pexels Library (no credentials needed), and an empty playlist degrades to the built-in dark gradient. `/api/storage` is hard-disabled: it returns **404** unless `STORAGE_LIBRARY_ENABLED=true` is set, and `lib/supabase.ts` builds its client lazily so importing it never throws at module load. To re-enable the Supabase library: set `STORAGE_LIBRARY_ENABLED=true`, restore the credentials, and uncomment the blocks marked `Supabase Library (disabled — restore by uncommenting)`.

**Vercel Blob (render pipeline):** create a free Blob store in the Vercel dashboard (Storage → Create → Blob → Connect to Project). `BLOB_READ_WRITE_TOKEN` is auto-injected in Production/Preview; `vercel env pull` brings it to `.env.local` for dev. Without it, dev renders use a local disk store and production degrades to the in-browser WebCodecs pipeline.

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
- **Deploy target:** Vercel free tier (Hobby). Server-side rendering runs in `/api/render/*` functions (300s `maxDuration`, fluid compute) — the "10s timeout / client-side only" era is over. Keep every render chunk ≤~55s of output so it fits the 300s cap.
