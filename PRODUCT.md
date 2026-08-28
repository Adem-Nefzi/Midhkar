# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: Muslims who want to share Qur'an verses as short social videos — students, teachers, da'ees, parents, and content creators — who have no video-editing skills and no time. Situation: they hear or memorize an ayah and want it posted on Instagram Reels, TikTok, YouTube Shorts, or Facebook within the minute, with proper recitation and text that does justice to the words. Secondary: Quran classes and halaqat needing visual aids.

## Product Purpose

Give the Qur'an a voice worth sharing. Midhkar turns a surah, a reciter, and a few verses into a professional, perfectly synchronized short video — entirely in the browser, free forever, no watermark, no account. Success is measured in videos shared: every one is intended as sadaqah jariyah (ongoing charity) for its creator.

## Positioning

The video is rendered on the visitor's own device by the browser's WebCodecs engine — nothing is uploaded, no server processes anything, no account exists to create. Combined with per-ayah recitation audio from curated, licensed qaris and pixel-accurate live preview, a neighboring product that phones home or paywalls exports could not truthfully copy this: private by architecture, free by conviction.

## Operating Context

- Used on desktop and on phones (the audience posts to mobile-first platforms); low-power devices get a reduced quality tier automatically.
- Output targets: 9:16 (Reels/TikTok/Shorts), 1:1 (Facebook), 16:9 (widescreen).
- Workflow: choose surah → select verses (presets: first 3/5/10, full) → pick platform + reciter + look → preview → generate → download/share.
- No accounts, no drafts: each visit starts fresh (auto-save was removed by user decision; legacy localStorage keys are wiped on mount).
- UI fully trilingual: English, French, Arabic; Arabic switches the whole document to RTL.
- External data: Qur'an text/translations/audio from Quran Foundation public APIs; background video library via optional Supabase bucket; online background search via Pexels.

## Capabilities and Constraints

Capabilities: all 114 surahs with Uthmani text and translations (en/fr/ar); curated reciters with per-ayah audio (primary + fallback CDN); verse search, topic discovery, and hover audio preview; accurate length estimation from decoded audio; backgrounds as user upload (≤150MB) or Library (curated Pexels search) — with an ordered multi-video playlist and coverage math, degrading gracefully to a built-in dark gradient when nothing is selected; 8 Arabic fonts, 9 Latin translation fonts; text color/opacity/size/position; effects (shadow, golden glow, outline, fade-in, verse transitions, frame decorations, overlay styles); watermark option; live pixel-accurate canvas preview; H.264 MP4 + AAC export at up to 1080p60.

Constraints (hard): everything client-side — Vercel free tier, no server-side processing, 10s function timeout; WebCodecs requires Chrome/Edge 94+ or Safari 18+ (no Firefox — UI must warn, not crash); audio fixed at 48kHz mono; no test framework — `next build` is the verification step; the VideoSettings shape is long-lived (legacy scalar `videoUrl` must keep working).

## Brand Commitments

- Name: **Midhkar** (مذكار), from the root ذ-ك-ر (remembrance/reminder); the Qur'an itself is "the Reminder".
- Tagline: "Give the Qur'an a voice worth sharing."
- Voice: dignified, warm, sincere; Qur'anic quotations are real and referenced, never paraphrased or invented.
- **Palette pinned by the user: night ink + gold + parchment.** Durable visual identity; redesigns execute it rigorously, never replace it.
- **Anti-target named by the user: the generic Islamic-website look** — carpeted dark-gold ornamentation. Ornament must earn its place.
- Free forever, no watermark, no account, no ads, no data selling.
- Arabic/Quranic text containers carry `translate="no"` (Quran Foundation recommendation).

## Evidence on Hand

- README.md: full feature list, "who it's for" table, real Qur'an/hadith quotations with references — usable copy, all verifiable.
- Live API content: 114 surahs, verses, translations, reciter list (real data, fetched at runtime).
- `public/icon.svg` is the only brand asset. **`public/og-image.png` is referenced in metadata but does not exist** — must be authored or the reference removed; never faked.
- Absences future work must not fabricate: no testimonials, no user counts, no press, no partners, no download numbers.

## Product Principles

1. **The verse is the hero.** Every screen exists to make the ayah look and sound beautiful; the tool itself recedes behind the content it serves.
2. **Under a minute, or we failed.** Speed and absence of friction (no account, no cost, no watermark) are the core promise — design must make the next action obvious at every step.
3. **Reverent, not decorative.** Ornament is placed with intention and restraint; dignity beats spectacle. No gimmicks where the words should speak.
4. **Private by architecture.** Everything happens in the visitor's browser; the design may say so plainly because it is structurally true.
5. **For the whole ummah.** English, French, and Arabic with true RTL parity — never an afterthought; low-power phones are first-class citizens.

## Accessibility & Inclusion

- Full RTL layout parity for Arabic (dir flips on `<html>`); UI must never break when mirrored.
- Qur'anic text marked `translate="no"` and given proper line-height for harakat.
- `prefers-reduced-motion` must disable ambient and celebratory motion.
- Must remain usable on low-power mobile devices (heavy blur/backdrop effects are a performance hazard for the primary audience).
