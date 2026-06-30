"use client";
/**
 * StepGenerate.tsx  —  Step 4: live preview + generation
 *
 * Preview fixes:
 *  - Canvas renders at FULL ENCODE resolution (e.g. 720×1280) then is
 *    CSS-scaled down to fit the preview box. This means font sizes, padding,
 *    positions and all proportions are 100% identical to the final video.
 *  - bgVideoRef is NOT in the useEffect dependency array — the ref value
 *    is read inside the rAF loop instead, so the loop never restarts due
 *    to the video element. This eliminates the stutter.
 *  - The video element is played once on mount and never re-played inside
 *    the loop, so there's no fight between play() calls.
 *  - renderFullFrame() from generate-video.ts is used — same code path
 *    as the encoder, so the preview is pixel-accurate.
 */

import { useEffect, useRef } from "react";
import {
  IslamicDivider,
  IslamicStarIcon,
  KuficBorder,
  DownloadIcon,
  CrescentMoonIcon,
  InstagramLogo,
  TikTokLogo,
  FacebookLogo,
} from "./icons";
import { TwitterIcon } from "./share-icons";
import { PLATFORM_META } from "@/lib/types";
import type { PlatformId } from "@/lib/types";
import type { Ayah, Surah, Reciter } from "@/lib/quran";
import type { GenLog, VideoSettings } from "@/lib/types";
import { renderFullFrame } from "@/lib/generate-video";

type PlatformLike = {
  id: string;
  label: string;
  aspect: string;
  fontSize: string;
};

/* ── Encode dimensions (must match generate-video.ts) ─────── */
const ENCODE_DIMS: Record<string, [number, number]> = {
  "9:16": [720, 1280],
  "16:9": [1280, 720],
  "1:1": [1080, 1080],
};

/* ── Preview display height (canvas is scaled via CSS) ──────── */
const PREVIEW_H = 480; // px — canvas is always this tall in the UI

interface Props {
  surah: Surah;
  reciter: Reciter;
  ayahs: Ayah[];
  sortedNums: number[];
  settings: VideoSettings;
  platform: PlatformLike;
  bgVideoRef: React.RefObject<HTMLVideoElement | null>;
  previewIdx: number;
  onPreviewIdx: (i: number) => void;
  isGenerating: boolean;
  genLogs: GenLog[];
  resultVideoUrl: string | null;
  onGenerate: () => void;
  onCancel: () => void;
  onReset: () => void;
  onStartOver: () => void;
  onBack: () => void;
  locale: string;
}

export function StepGenerate({
  surah,
  reciter,
  ayahs,
  sortedNums,
  settings,
  platform,
  bgVideoRef,
  previewIdx,
  onPreviewIdx,
  isGenerating,
  genLogs,
  resultVideoUrl,
  onGenerate,
  onCancel,
  onReset,
  onStartOver,
  onBack,
  locale,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const genStartRef = useRef<number>(0);
  // Keep a stable ref to the current ayah so the rAF loop can read it
  // without being in the dependency array
  const ayahRef = useRef<Ayah | null>(null);
  const settingsRef = useRef<VideoSettings>(settings);
  const platformRef = useRef<PlatformLike>(platform);
  const surahRef = useRef<Surah>(surah);

  // Keep refs in sync with props on every render
  const prevAyahNum = useRef<number | null>(null);
  const previewStartRef = useRef(Date.now());
  if (ayahs[previewIdx]?.numberInSurah !== prevAyahNum.current) {
    prevAyahNum.current = ayahs[previewIdx]?.numberInSurah ?? null;
    previewStartRef.current = Date.now();
  }
  ayahRef.current = ayahs[previewIdx] ?? ayahs[0] ?? null;
  settingsRef.current = settings;
  platformRef.current = platform;
  surahRef.current = surah;

  /* ── Full encode dimensions ──────────────────────────────── */
  const [encW, encH] = ENCODE_DIMS[platform.aspect] ?? [720, 1280];
  // CSS display size — keep height fixed, width follows aspect ratio
  const dispH = PREVIEW_H;
  const dispW = Math.round(PREVIEW_H * (encW / encH));

  /* ── Start background video on mount, never restart ─────── */
  useEffect(() => {
    const videoEl = bgVideoRef.current;
    if (!videoEl) return;
    const needsVideo =
      settings.background === "upload" || settings.background === "library";
    if (needsVideo && videoEl.paused) {
      videoEl.play().catch(() => {});
    }
    // intentionally NOT in deps — we only want to trigger play() once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.background, settings.videoUrl, settings.uploadedVideoUrl]);

  /* ── Track generation start time for ETA ──────────────────── */
  const prevGeneratingRef = useRef(false);
  useEffect(() => {
    if (isGenerating && !prevGeneratingRef.current) {
      genStartRef.current = Date.now();
    }
    prevGeneratingRef.current = isGenerating;
  }, [isGenerating]);

  /* ── rAF render loop ─────────────────────────────────────── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas to FULL encode resolution
    canvas.width = encW;
    canvas.height = encH;

    let alive = true;
    let paused = false;

    const onVisibility = () => {
      paused = document.hidden;
      if (!paused) {
        previewStartRef.current = Date.now();
        animRef.current = requestAnimationFrame(draw);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    const draw = () => {
      if (!alive || paused) return;

      // Read current values from refs — no dependency on them so loop
      // never restarts due to settings/ayah/platform changes
      const videoEl = bgVideoRef.current;
      const s = settingsRef.current;
      const p = platformRef.current;
      const ayah = ayahRef.current;
      const sr = surahRef.current;

      const useVideoBg =
        (s.background === "upload" || s.background === "library") &&
        videoEl !== null;

      const animP = s.textAnimation === "none" ? 1 : Math.min(1, (Date.now() - previewStartRef.current) / 500);
      renderFullFrame(
        ctx,
        canvas,
        ayah,
        sr,
        s,
        p as any,
        useVideoBg ? videoEl : null,
        undefined,
        animP,
      );

      animRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", onVisibility);
      cancelAnimationFrame(animRef.current);
    };
    // Only restart the loop if the canvas encode dimensions change
    // (i.e. the user switches platform aspect ratio)
  }, [encW, encH]);

  /* ── Derived ─────────────────────────────────────────────── */
  const lastLog = genLogs[genLogs.length - 1];
  const progress = lastLog?.pct ?? 0;
  const elapsedMs = isGenerating ? Date.now() - genStartRef.current : 0;
  const estRemainingSec = progress > 2
    ? Math.round((elapsedMs / progress) * (100 - progress) / 1000)
    : 0;
  const estDur = sortedNums.length * 6;
  const fileName = `${surah.englishName}_${sortedNums[0]}-${sortedNums[sortedNums.length - 1]}.mp4`;
  const platformLabel =
    PLATFORM_META[platform.id as PlatformId]?.label ?? platform.label;
  const ar = locale === "ar";

  return (
    <div className="animate-fade-up max-w-5xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <IslamicDivider className="mb-4" />
        <h2 className="font-display text-3xl font-medium text-parchment sm:text-4xl">
          {ar ? "معاينة وإنتاج" : "Preview & Generate"}
        </h2>
        <p className="mt-2 text-parchment-muted text-sm">
          {ar
            ? "المعاينة مطابقة تماماً للفيديو النهائي"
            : "Preview is pixel-accurate — what you see is what you get"}
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-8 items-start justify-center">
        {/* ── Canvas preview ──────────────────────────────── */}
        <div className="flex flex-col items-center shrink-0">
          {/* Platform label */}
          <div className="mb-2 flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-widest text-gold/50 font-medium">
              {platformLabel}
            </span>
            <span className="text-[10px] text-parchment-muted/30">·</span>
            <span className="text-[10px] text-parchment-muted/40">
              {platform.aspect}
            </span>
            <span className="text-[10px] text-parchment-muted/30">·</span>
            <span className="text-[10px] text-parchment-muted/30">
              {encW}×{encH}
            </span>
          </div>

          {/* Canvas wrapper — CSS scales the full-res canvas down */}
          <div
            className="relative rounded-sm border-2 border-gold/25 shadow-2xl shadow-gold/5 overflow-hidden max-w-full"
            style={{ width: dispW, height: dispH }}
          >
            <KuficBorder />

            {/*
              The canvas is rendered at full encode size (e.g. 720×1280)
              but CSS-scaled to (dispW × dispH). This means every pixel,
              font size, and position is identical to the final video.
            */}
            <canvas
              ref={canvasRef}
              style={{
                display: "block",
                width: dispW,
                height: dispH,
                imageRendering: "auto",
              }}
            />

            {/* LIVE badge */}
            <div className="absolute top-3 left-3 flex items-center gap-1 rounded-full bg-black/50 backdrop-blur-sm px-2 py-0.5 z-10">
              <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" />
              <span className="text-[9px] text-white/80 font-medium uppercase tracking-wider">
                Live
              </span>
            </div>

            {/* Corner ornaments */}
            {[
              "top-2 left-2 border-t-2 border-l-2",
              "top-2 right-2 border-t-2 border-r-2",
              "bottom-2 left-2 border-b-2 border-l-2",
              "bottom-2 right-2 border-b-2 border-r-2",
            ].map((cls, i) => (
              <div
                key={i}
                className={`absolute h-5 w-5 border-gold/25 pointer-events-none z-10 ${cls}`}
              />
            ))}
          </div>

          {/* Ayah switcher */}
          {ayahs.length > 1 && (
            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={() => onPreviewIdx(Math.max(0, previewIdx - 1))}
                disabled={previewIdx === 0}
                className="h-7 w-7 rounded-full border border-gold/20 text-gold/60 hover:bg-gold/10 disabled:opacity-30 transition text-sm"
              >
                ‹
              </button>
              <span className="text-xs text-parchment-muted px-2">
                {ar
                  ? `${previewIdx + 1} / ${ayahs.length}`
                  : `Ayah ${previewIdx + 1} / ${ayahs.length}`}
              </span>
              <button
                onClick={() =>
                  onPreviewIdx(Math.min(ayahs.length - 1, previewIdx + 1))
                }
                disabled={previewIdx === ayahs.length - 1}
                className="h-7 w-7 rounded-full border border-gold/20 text-gold/60 hover:bg-gold/10 disabled:opacity-30 transition text-sm"
              >
                ›
              </button>
            </div>
          )}

          {/* Active effects pills */}
          <div
            className="mt-3 flex flex-wrap justify-center gap-1"
            style={{ maxWidth: dispW }}
          >
            {[
              settings.textGlow && (ar ? "توهج" : "Glow"),
              settings.textOutline && (ar ? "حدود" : "Outline"),
              settings.textShadow && (ar ? "ظل" : "Shadow"),
              settings.textAnimation !== "none" && (ar ? "ظهور تدريجي" : "Fade In"),
              settings.frameStyle &&
                settings.frameStyle !== "none" &&
                (ar ? `إطار` : `Frame: ${settings.frameStyle}`),
              settings.showWatermark &&
                settings.watermarkText &&
                `© ${settings.watermarkText}`,
            ]
              .filter(Boolean)
              .map((label, i) => (
                <span
                  key={i}
                  className="rounded-full bg-gold/10 border border-gold/15 px-2 py-0.5 text-[9px] text-gold/60"
                >
                  {label as string}
                </span>
              ))}
          </div>
        </div>

        {/* ── Summary card ─────────────────────────────── */}
        <div className="flex-1 space-y-4 min-w-0">
          <div className="rounded-sm border border-gold/15 bg-ink-light/20 p-5 kufic-frame">
            <h3 className="text-xs font-medium text-gold/50 uppercase tracking-wider mb-4">
              {ar ? "ملخص" : "Summary"}
            </h3>
            <div className="space-y-2.5">
              {(
                [
                  [
                    ar ? "السورة" : "Surah",
                    `${surah.name} (${surah.englishName})`,
                  ],
                  [
                    ar ? "الآيات" : "Verses",
                    `${sortedNums[0]}–${sortedNums[sortedNums.length - 1]} (${sortedNums.length})`,
                  ],
                  [ar ? "القارئ" : "Reciter", reciter.englishName],
                  [
                    ar ? "المنصة" : "Platform",
                    `${platformLabel} · ${platform.aspect}`,
                  ],
                  [ar ? "الدقة" : "Resolution", `${encW}×${encH}`],
                  [ar ? "الجودة" : "Output", "H.264 MP4 + AAC"],
                  [ar ? "المدة التقريبية" : "Est. Duration", `~${estDur}s`],
                ] as [string, string][]
              ).map(([label, value]) => (
                <div key={label} className="flex gap-3">
                  <span className="text-parchment-muted text-xs w-32 shrink-0">
                    {label}:
                  </span>
                  <span className="text-parchment text-xs">{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Encoder note */}
          <div className="rounded-sm border border-gold/10 bg-gold/[0.03] p-4 text-xs text-parchment-muted/70 space-y-1.5">
            <div className="flex items-center gap-1.5 text-gold/40 mb-1">
              <IslamicStarIcon className="h-3 w-3" />
              <span className="uppercase tracking-wider font-medium">
                {ar ? "ملاحظة" : "Note"}
              </span>
            </div>
            <p>
              {ar
                ? "يستخدم WebCodecs API — تشفير بالمعالج الرسومي، بدون تحميل إضافي."
                : "Native WebCodecs API — GPU-accelerated H.264, no extra downloads."}
            </p>
            {typeof VideoEncoder === "undefined" && (
              <p className="text-red-400/80 mt-1">
                {ar
                  ? "⚠️ متصفحك لا يدعم WebCodecs. استخدم Chrome أو Edge 94+."
                  : "⚠️ WebCodecs not supported. Use Chrome or Edge 94+."}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Action buttons ───────────────────────────────── */}
      <div className="mt-10 flex justify-center gap-4 flex-wrap">
        <button
          onClick={onBack}
          disabled={isGenerating}
          className="rounded-full border border-parchment/20 px-6 py-3 text-sm text-parchment hover:border-gold/40 hover:text-gold flex items-center gap-2 disabled:opacity-40 transition"
        >
          <IslamicStarIcon className="h-3 w-3 rotate-180" />
          {ar ? "رجوع" : "Back"}
        </button>

        {!isGenerating ? (
          <button
            onClick={onGenerate}
            className="group relative overflow-hidden rounded-full bg-gold px-10 py-3.5 text-sm font-semibold text-ink hover:-translate-y-0.5 hover:shadow-lg hover:shadow-gold/20 transition-all flex items-center gap-2"
          >
            <span className="absolute inset-0 -translate-x-full bg-parchment/30 transition-transform duration-700 group-hover:translate-x-full" />
            <span className="relative flex items-center gap-2">
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 10l4.553-2.069A1 1 0 0121 8.882v6.236a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
              {ar ? "إنتاج الفيديو مع الصوت" : "Generate Video with Audio"}
            </span>
          </button>
        ) : (
          <button
            onClick={onCancel}
            className="rounded-full border-2 border-red-500/40 bg-red-500/10 px-8 py-3.5 text-sm font-semibold text-red-400 hover:bg-red-500/20 transition flex items-center gap-2"
          >
            <svg
              className="h-4 w-4 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            {ar ? "إيقاف" : "Cancel"}
          </button>
        )}
      </div>

      {/* ── Progress ─────────────────────────────────────── */}
      {(isGenerating || (genLogs.length > 0 && !resultVideoUrl)) && (
        <div className="mt-6 max-w-lg mx-auto space-y-3">
          {/* Progress bar */}
          <div className="h-2 rounded-full bg-gold/10 overflow-hidden mb-1">
            <div
              className="h-full rounded-full bg-gradient-to-r from-gold/70 to-gold transition-all duration-500"
              style={{ width: `${Math.max(2, progress)}%` }}
            />
          </div>

          {/* ETA */}
          {estRemainingSec > 0 && (
            <p className="text-center text-[10px] text-parchment-muted/50">
              {ar
                ? `~${estRemainingSec}ث متبقية`
                : `~${estRemainingSec}s remaining`}
            </p>
          )}

          {/* Waveform bars */}
          <div className="flex items-end justify-center gap-[3px] h-10">
            {Array.from({ length: 24 }).map((_, i) => {
              const height = 20 + Math.sin(Date.now() / 300 + i * 0.8) * 10 + Math.sin(Date.now() / 500 + i * 1.3) * 6;
              return (
                <div
                  key={i}
                  className="w-[3px] rounded-full bg-gold/40 transition-all"
                  style={{
                    height: `${Math.max(4, height)}px`,
                    animation: isGenerating ? `pulse-wave 1.2s ease-in-out infinite` : "none",
                    animationDelay: `${i * 0.1}s`,
                  }}
                />
              );
            })}
          </div>

          {/* Log messages */}
          <div className="space-y-1">
            {genLogs.slice(-4).map((log, i, arr) => (
              <p
                key={i}
                className={`text-xs text-center transition-opacity ${
                  i === arr.length - 1
                    ? "text-gold/80 opacity-100"
                    : "text-parchment-muted/40 opacity-50"
                }`}
              >
                {log.msg}
                {i === arr.length - 1 && log.pct > 0 ? ` (${log.pct}%)` : ""}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* ── Result ───────────────────────────────────────── */}
      {resultVideoUrl && !isGenerating && (
        <div className="mt-10 rounded-sm border-2 border-gold/30 bg-gold/5 p-8 text-center kufic-frame animate-fade-up">
          <div className="flex items-center justify-center gap-3 mb-5">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gold/20 ring-4 ring-gold/10">
              <svg
                className="h-7 w-7 text-gold"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
          </div>
          <h3 className="text-xl font-medium text-parchment mb-1">
            {ar ? "الفيديو جاهز! 🎉" : "Video Ready! 🎉"}
          </h3>
          <p className="text-sm text-parchment-muted mb-6">
            {ar
              ? "تم إنشاء ملف MP4 يحتوي على الصوت والصورة المتزامنة"
              : "Your MP4 file with synchronized audio has been generated"}
          </p>
          <video
            src={resultVideoUrl}
            controls
            className="mx-auto rounded-sm mb-6 border border-gold/20 max-h-72 w-full max-w-md"
          />
          {/* Share buttons */}
          <div className="flex justify-center gap-2 mb-3">
            <span className="text-[10px] text-parchment-muted/40 self-center mr-1 uppercase tracking-wider">
              {ar ? "مشاركة" : "Share"}
            </span>
            <button
              onClick={() => {
                const text = ar
                  ? `شاهد فيديو ${surah.englishName} ${sortedNums[0]}–${sortedNums[sortedNums.length - 1]} من midhkar`
                  : `Check out ${surah.englishName} ${sortedNums[0]}–${sortedNums[sortedNums.length - 1]} on midhkar`;
                navigator.clipboard.writeText(text + " https://midhkar.com");
              }}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-pink-600/20 text-pink-400 hover:bg-pink-600/30 transition"
              title="Instagram"
            >
              <InstagramLogo className="h-4 w-4" />
            </button>
            <button
              onClick={() => {
                const text = ar
                  ? `شاهد فيديو ${surah.englishName} ${sortedNums[0]}–${sortedNums[sortedNums.length - 1]} من midhkar`
                  : `Check out ${surah.englishName} ${sortedNums[0]}–${sortedNums[sortedNums.length - 1]} on midhkar`;
                navigator.clipboard.writeText(text + " https://midhkar.com");
              }}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-800/40 text-parchment hover:bg-gray-800/60 transition"
              title="TikTok"
            >
              <TikTokLogo className="h-4 w-4" />
            </button>
            <button
              onClick={() => {
                const text = ar
                  ? `شاهد فيديو ${surah.englishName} ${sortedNums[0]}–${sortedNums[sortedNums.length - 1]} من midhkar`
                  : `Check out ${surah.englishName} ${sortedNums[0]}–${sortedNums[sortedNums.length - 1]} on midhkar`;
                window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent("https://midhkar.com")}&quote=${encodeURIComponent(text)}`, "_blank");
              }}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 transition"
              title="Facebook"
            >
              <FacebookLogo className="h-4 w-4" />
            </button>
            <button
              onClick={() => {
                const text = ar
                  ? `شاهد فيديو ${surah.englishName} ${sortedNums[0]}–${sortedNums[sortedNums.length - 1]} من midhkar`
                  : `Check out ${surah.englishName} ${sortedNums[0]}–${sortedNums[sortedNums.length - 1]} on midhkar`;
                window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text + " https://midhkar.com")}`, "_blank");
              }}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-parchment hover:bg-white/20 transition"
              title="X"
            >
              <TwitterIcon className="h-4 w-4" />
            </button>
          </div>

          <div className="flex justify-center gap-3 flex-wrap">
            <a
              href={resultVideoUrl}
              download={fileName}
              className="inline-flex items-center gap-2 rounded-full bg-gold px-6 py-2.5 text-sm font-medium text-ink hover:bg-gold-soft transition"
            >
              <DownloadIcon className="h-4 w-4" />
              {ar ? "تحميل MP4" : "Download MP4"}
            </a>
            <button
              onClick={onReset}
              className="inline-flex items-center gap-2 rounded-full border border-gold/30 px-6 py-2.5 text-sm text-gold hover:bg-gold/10 transition"
            >
              <IslamicStarIcon className="h-4 w-4" />
              {ar ? "إنتاج نسخة أخرى" : "Generate Another"}
            </button>
            <button
              onClick={onStartOver}
              className="inline-flex items-center gap-2 rounded-full border border-parchment/20 px-6 py-2.5 text-sm text-parchment hover:border-gold/40 hover:text-gold transition"
            >
              <CrescentMoonIcon className="h-4 w-4" />
              {ar ? "بداية جديدة" : "Start Over"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
