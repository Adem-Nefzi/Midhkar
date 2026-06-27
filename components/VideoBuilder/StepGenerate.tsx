"use client";
/**
 * StepGenerate.tsx  —  Step 4: live preview + generation
 */

import { useEffect, useRef } from "react";
import {
  IslamicDivider,
  IslamicStarIcon,
  KuficBorder,
  DownloadIcon,
  CrescentMoonIcon,
} from "./icons";
import { PLATFORMS } from "@/lib/quran";
import type { Ayah, Surah, Reciter } from "@/lib/quran";
import { GenLog, VideoSettings } from "@/lib/types";
import { drawAyahFrame, drawBackground } from "@/lib/canva-utils";

interface Props {
  surah: Surah;
  reciter: Reciter;
  ayahs: Ayah[]; // selected ayahs in order
  sortedNums: number[]; // sorted selected verse numbers
  settings: VideoSettings;
  platform: (typeof PLATFORMS)[0];
  bgVideoRef: React.RefObject<HTMLVideoElement | null>;
  // Preview nav
  previewIdx: number;
  onPreviewIdx: (i: number) => void;
  // Generation
  isGenerating: boolean;
  genLogs: GenLog[];
  resultVideoUrl: string | null;
  onGenerate: () => void;
  onCancel: () => void;
  onReset: () => void; // clear result, keep settings
  onStartOver: () => void; // go back to step 1
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

  // Canvas preview dimensions (display size, not encode size)
  const PREV_DIMS: Record<string, [number, number]> = {
    "9:16": [320, 568],
    "16:9": [480, 270],
    "1:1": [360, 360],
  };
  const [pw, ph] = PREV_DIMS[platform.aspect] ?? [320, 568];

  // Live canvas re-render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const ayah = ayahs[previewIdx] ?? ayahs[0] ?? null;
    let alive = true;

    const draw = () => {
      if (!alive) return;
      drawBackground(
        ctx,
        canvas.width,
        canvas.height,
        settings.background,
        bgVideoRef.current,
        settings.bgOverlay,
      );
      drawAyahFrame(ctx, canvas, ayah, surah, settings, platform);
      animRef.current = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      alive = false;
      cancelAnimationFrame(animRef.current);
    };
  }, [settings, previewIdx, ayahs, surah, platform, bgVideoRef]);

  const lastLog = genLogs[genLogs.length - 1];
  const progress = lastLog?.pct ?? 0;
  const estDur = sortedNums.length * 6;
  const fileName = `${surah.englishName}_${sortedNums[0]}-${sortedNums[sortedNums.length - 1]}.mp4`;

  return (
    <div className="animate-fade-up max-w-5xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <IslamicDivider className="mb-4" />
        <h2 className="font-display text-3xl font-medium text-parchment sm:text-4xl">
          {locale === "ar" ? "معاينة وإنتاج" : "Preview & Generate"}
        </h2>
        <p className="mt-2 text-parchment-muted text-sm">
          {locale === "ar"
            ? "معاينة حية — الصوت يُدمج تلقائياً أثناء الإنتاج"
            : "Live preview — audio is merged automatically during generation"}
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-8 items-start justify-center">
        {/* ── Canvas preview ──────────────────────────────────── */}
        <div className="flex flex-col items-center shrink-0">
          <div
            className="relative rounded-sm border-2 border-gold/25 shadow-2xl shadow-gold/5 overflow-hidden"
            style={{ width: pw, height: ph }}
          >
            <KuficBorder />
            <canvas
              ref={canvasRef}
              width={pw}
              height={ph}
              style={{ display: "block", width: "100%", height: "100%" }}
            />
            {/* Corner ornaments */}
            <div className="absolute top-2 left-2 h-5 w-5 border-t-2 border-l-2 border-gold/25 pointer-events-none" />
            <div className="absolute top-2 right-2 h-5 w-5 border-t-2 border-r-2 border-gold/25 pointer-events-none" />
            <div className="absolute bottom-2 left-2 h-5 w-5 border-b-2 border-l-2 border-gold/25 pointer-events-none" />
            <div className="absolute bottom-2 right-2 h-5 w-5 border-b-2 border-r-2 border-gold/25 pointer-events-none" />
          </div>

          {/* Ayah switcher */}
          {ayahs.length > 1 && (
            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={() => onPreviewIdx(Math.max(0, previewIdx - 1))}
                disabled={previewIdx === 0}
                className="h-7 w-7 rounded-full border border-gold/20 text-gold/60 hover:bg-gold/10 disabled:opacity-30 transition text-xs"
              >
                ‹
              </button>
              <span className="text-xs text-parchment-muted px-2">
                {locale === "ar"
                  ? `${previewIdx + 1} / ${ayahs.length}`
                  : `Ayah ${previewIdx + 1} / ${ayahs.length}`}
              </span>
              <button
                onClick={() =>
                  onPreviewIdx(Math.min(ayahs.length - 1, previewIdx + 1))
                }
                disabled={previewIdx === ayahs.length - 1}
                className="h-7 w-7 rounded-full border border-gold/20 text-gold/60 hover:bg-gold/10 disabled:opacity-30 transition text-xs"
              >
                ›
              </button>
            </div>
          )}
        </div>

        {/* ── Summary + info ──────────────────────────────────── */}
        <div className="flex-1 space-y-4 min-w-0">
          <div className="rounded-sm border border-gold/15 bg-ink-light/20 p-5 kufic-frame">
            <h3 className="text-xs font-medium text-gold/50 uppercase tracking-wider mb-4">
              {locale === "ar" ? "ملخص" : "Summary"}
            </h3>
            <div className="space-y-2.5">
              {[
                [
                  locale === "ar" ? "السورة" : "Surah",
                  `${surah.name} (${surah.englishName})`,
                ],
                [
                  locale === "ar" ? "الآيات" : "Verses",
                  `${sortedNums[0]}–${sortedNums[sortedNums.length - 1]} (${sortedNums.length})`,
                ],
                [locale === "ar" ? "القارئ" : "Reciter", reciter.englishName],
                [
                  locale === "ar" ? "المنصة" : "Platform",
                  `${platform.label} · ${platform.aspect}`,
                ],
                [
                  locale === "ar" ? "الجودة" : "Output",
                  "H.264 MP4 + AAC audio",
                ],
                [
                  locale === "ar" ? "المدة التقريبية" : "Est. Duration",
                  `~${estDur}s`,
                ],
              ].map(([label, value]) => (
                <div key={label} className="flex gap-3">
                  <span className="text-parchment-muted text-xs w-28 shrink-0">
                    {label}:
                  </span>
                  <span className="text-parchment text-xs">{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Encoder status note */}
          <div className="rounded-sm border border-gold/10 bg-gold/[0.03] p-4 text-xs text-parchment-muted/70 space-y-1.5">
            <div className="flex items-center gap-1.5 text-gold/40 mb-1">
              <IslamicStarIcon className="h-3 w-3" />
              <span className="uppercase tracking-wider font-medium">
                {locale === "ar" ? "ملاحظة" : "Note"}
              </span>
            </div>
            <p>
              {locale === "ar"
                ? "يستخدم FFmpeg.wasm لدمج الصوت والصورة مباشرةً في المتصفح."
                : "FFmpeg.wasm merges audio & video directly in your browser. First load downloads the encoder (~10 MB)."}
            </p>
          </div>
        </div>
      </div>

      {/* ── Action buttons ────────────────────────────────────── */}
      <div className="mt-10 flex justify-center gap-4 flex-wrap">
        <button
          onClick={onBack}
          disabled={isGenerating}
          className="rounded-full border border-parchment/20 px-6 py-3 text-sm text-parchment hover:border-gold/40 hover:text-gold flex items-center gap-2 disabled:opacity-40 transition"
        >
          <IslamicStarIcon className="h-3 w-3 rotate-180" />
          {locale === "ar" ? "رجوع" : "Back"}
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
              {locale === "ar"
                ? "إنتاج الفيديو مع الصوت"
                : "Generate Video with Audio"}
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
            {locale === "ar" ? "إيقاف" : "Cancel"}
          </button>
        )}
      </div>

      {/* ── Progress ─────────────────────────────────────────── */}
      {(isGenerating || (genLogs.length > 0 && !resultVideoUrl)) && (
        <div className="mt-6 max-w-lg mx-auto">
          <div className="h-2 rounded-full bg-gold/10 overflow-hidden mb-3">
            <div
              className="h-full rounded-full bg-gradient-to-r from-gold/70 to-gold transition-all duration-500"
              style={{ width: `${Math.max(2, progress)}%` }}
            />
          </div>
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

      {/* ── Result ───────────────────────────────────────────── */}
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
            {locale === "ar"
              ? "الفيديو جاهز مع الصوت! 🎉"
              : "Video with Audio Ready! 🎉"}
          </h3>
          <p className="text-sm text-parchment-muted mb-6">
            {locale === "ar"
              ? "تم إنشاء ملف MP4 يحتوي على الصوت والصورة المتزامنة"
              : "Your MP4 file with synchronized audio has been generated"}
          </p>

          {/* Inline playback */}
          <video
            src={resultVideoUrl}
            controls
            className="mx-auto rounded-sm mb-6 border border-gold/20 max-h-72 w-full max-w-md"
          />

          {/* Actions */}
          <div className="flex justify-center gap-3 flex-wrap">
            <a
              href={resultVideoUrl}
              download={fileName}
              className="inline-flex items-center gap-2 rounded-full bg-gold px-6 py-2.5 text-sm font-medium text-ink hover:bg-gold-soft transition"
            >
              <DownloadIcon className="h-4 w-4" />
              {locale === "ar" ? "تحميل MP4" : "Download MP4"}
            </a>
            <button
              onClick={onReset}
              className="inline-flex items-center gap-2 rounded-full border border-gold/30 px-6 py-2.5 text-sm text-gold hover:bg-gold/10 transition"
            >
              <IslamicStarIcon className="h-4 w-4" />
              {locale === "ar" ? "إنتاج نسخة أخرى" : "Generate Another"}
            </button>
            <button
              onClick={onStartOver}
              className="inline-flex items-center gap-2 rounded-full border border-parchment/20 px-6 py-2.5 text-sm text-parchment hover:border-gold/40 hover:text-gold transition"
            >
              <CrescentMoonIcon className="h-4 w-4" />
              {locale === "ar" ? "بداية جديدة" : "Start Over"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
