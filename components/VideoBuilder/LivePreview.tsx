"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { Ayah, Surah } from "@/lib/quran";
import type { VideoSettings } from "@/lib/types";
import { renderFullFrame } from "@/lib/canva-utils";
import {
  getOutputResolution,
  getDeviceProfile,
} from "@/lib/device-profile";
import { ensureFontsReady } from "@/lib/fonts-ready";
import { CopyIcon, CheckIcon } from "./icons";

export type PlatformLike = {
  id: string;
  label: string;
  aspect: string;
};

interface Props {
  surah: Surah;
  ayahs: Ayah[];
  settings: VideoSettings;
  platform: PlatformLike;
  bgVideoRef: React.RefObject<HTMLVideoElement | null>;
  previewIdx: number;
  onPreviewIdx: (i: number) => void;
  locale: string;
  height?: number;
  showControls?: boolean;
  className?: string;
}

export function LivePreview({
  surah,
  ayahs,
  settings,
  platform,
  bgVideoRef,
  previewIdx,
  onPreviewIdx,
  locale,
  height = 480,
  showControls = true,
  className = "",
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const ayahRef = useRef<Ayah | null>(null);
  const settingsRef = useRef<VideoSettings>(settings);
  const surahRef = useRef<Surah>(surah);

  const prevAyahNum = useRef<number | null>(null);
  const previewStartRef = useRef(Date.now());
  if (ayahs[previewIdx]?.numberInSurah !== prevAyahNum.current) {
    prevAyahNum.current = ayahs[previewIdx]?.numberInSurah ?? null;
    previewStartRef.current = Date.now();
  }
  ayahRef.current = ayahs[previewIdx] ?? ayahs[0] ?? null;
  settingsRef.current = settings;
  surahRef.current = surah;

  const [encW, encH] = getOutputResolution(
    platform.aspect,
    getDeviceProfile().isLowPower,
  );
  const dispH = height;
  const dispW = Math.round(height * (encW / encH));

  const ar = locale === "ar";

  useEffect(() => {
    const videoEl = bgVideoRef.current;
    if (!videoEl) return;
    const needsVideo =
      settings.background === "upload" ||
      settings.background === "library" ||
      settings.background === "pexels";
    if (needsVideo && videoEl.paused) {
      videoEl.play().catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.background, settings.videoUrl, settings.uploadedVideoUrl]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = encW;
    canvas.height = encH;

    let alive = true;
    let paused = false;
    let fontsReady = false;
    let fontsKey = "";
    let lastDrawTime = 0;
    let lastSig = "";
    const PREVIEW_FRAME_MS = 1000 / 30;

    const onVisibility = () => {
      paused = document.hidden;
      if (!paused) {
        previewStartRef.current = Date.now();
        lastDrawTime = 0;
        animRef.current = requestAnimationFrame(draw);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    const draw = (now: number) => {
      if (!alive || paused) return;
      if (now - lastDrawTime < PREVIEW_FRAME_MS) {
        animRef.current = requestAnimationFrame(draw);
        return;
      }
      lastDrawTime = now;

      const videoEl = bgVideoRef.current;
      const s = settingsRef.current;
      const ayah = ayahRef.current;
      const sr = surahRef.current;

      // Load (only) the fonts the current selection needs; re-trigger when
      // the user switches font family mid-preview.
      const key = `${s.fontFamily}|${s.translationFontFamily}`;
      if (key !== fontsKey) {
        fontsKey = key;
        fontsReady = false;
        ensureFontsReady(s).then(() => {
          if (alive && fontsKey === key) fontsReady = true;
        });
      }
      if (!fontsReady) {
        ctx.fillStyle = "#0b0e1a";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        animRef.current = requestAnimationFrame(draw);
        return;
      }

      const useVideoBg =
        (s.background === "upload" ||
          s.background === "library" ||
          s.background === "pexels") &&
        videoEl !== null;

      const animP =
        s.textAnimation === "none"
          ? 1
          : Math.min(1, (Date.now() - previewStartRef.current) / 500);

      // Idle skip: with a static (non-video) background, once the entrance
      // animation has settled the frame is pixel-identical every tick — so
      // don't repaint (and don't wake the compositor) unless an input
      // actually changed. Video backgrounds always repaint.
      if (!useVideoBg) {
        const sig = `${key}|${ayah?.number ?? -1}|${sr.number}|${animP >= 1 ? 1 : animP.toFixed(2)}|${JSON.stringify(s)}`;
        if (sig === lastSig) {
          animRef.current = requestAnimationFrame(draw);
          return;
        }
        lastSig = sig;
      } else {
        lastSig = "";
      }

      renderFullFrame(
        ctx,
        canvas,
        ayah,
        sr,
        s,
        useVideoBg ? videoEl : null,
        animP,
      );

      animRef.current = requestAnimationFrame(draw);
    };

    requestAnimationFrame(draw);

    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", onVisibility);
      cancelAnimationFrame(animRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [encW, encH]);

  const [copied, setCopied] = useState(false);
  const handleCopyVerse = useCallback(() => {
    const ayah = ayahs[previewIdx];
    if (!ayah) return;
    const text = `${ayah.text}\n\n— ${surah.englishName} ${surah.number}:${ayah.numberInSurah}`;
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {});
  }, [ayahs, previewIdx, surah]);

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <div className="mb-2 flex items-center gap-2 text-[13px]">
        <span className="font-medium uppercase tracking-widest text-gold/60">
          {platform.label}
        </span>
        <span className="text-parchment-dim/60">·</span>
        <span className="text-parchment-dim">{platform.aspect}</span>
        <span className="text-parchment-dim/60">·</span>
        <span className="text-parchment-dim">
          {encW}×{encH}
        </span>
      </div>

      <div
        className="relative max-w-full overflow-hidden rounded-xl border border-gold/30 lit"
        style={{ width: dispW, height: dispH }}
      >
        <canvas
          ref={canvasRef}
          style={{
            display: "block",
            width: dispW,
            height: dispH,
            imageRendering: "auto",
          }}
        />

        <div className="absolute left-3 top-3 z-10 flex items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ember" />
          <span className="text-xs font-medium uppercase tracking-wider text-parchment/85">
            {ar ? "مباشر" : "Live"}
          </span>
        </div>

        {[
          "top-2 left-2 border-t-2 border-l-2",
          "top-2 right-2 border-t-2 border-r-2",
          "bottom-2 left-2 border-b-2 border-l-2",
          "bottom-2 right-2 border-b-2 border-r-2",
        ].map((cls, i) => (
          <div
            key={i}
            className={`pointer-events-none absolute z-10 h-5 w-5 border-gold/30 ${cls}`}
          />
        ))}
      </div>

      {showControls && ayahs.length > 1 && (
        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={() => onPreviewIdx(Math.max(0, previewIdx - 1))}
            disabled={previewIdx === 0}
            className="h-7 w-7 rounded-full border border-gold/25 text-gold/70 transition hover:bg-gold/10 active:scale-90 disabled:opacity-30"
            title={ar ? "السابقة" : "Previous"}
            aria-label={ar ? "الآية السابقة" : "Previous ayah"}
          >
            ‹
          </button>
          <span className="px-2 text-[13px] text-parchment-muted">
            {ar
              ? `${previewIdx + 1} / ${ayahs.length}`
              : `Ayah ${previewIdx + 1} / ${ayahs.length}`}
          </span>
          <button
            onClick={() =>
              onPreviewIdx(Math.min(ayahs.length - 1, previewIdx + 1))
            }
            disabled={previewIdx === ayahs.length - 1}
            className="h-7 w-7 rounded-full border border-gold/25 text-gold/70 transition hover:bg-gold/10 active:scale-90 disabled:opacity-30"
            title={ar ? "التالية" : "Next"}
            aria-label={ar ? "الآية التالية" : "Next ayah"}
          >
            ›
          </button>
          <button
            onClick={handleCopyVerse}
            className="ml-1 flex h-7 items-center gap-1 rounded-full border border-gold/25 px-2.5 text-[13px] text-gold/70 transition hover:bg-gold/10 active:scale-95"
            title={ar ? "نسخ النص" : "Copy verse text"}
          >
            {copied ? (
              <CheckIcon className="h-3 w-3" />
            ) : (
              <CopyIcon className="h-3 w-3" />
            )}
            <span className="hidden sm:inline">
              {copied ? (ar ? "نُسخ" : "Copied") : ar ? "نسخ" : "Copy"}
            </span>
          </button>
        </div>
      )}

      {showControls && (
        <div
          className="mt-3 flex flex-wrap justify-center gap-1"
          style={{ maxWidth: dispW }}
        >
          {[
            settings.textGlow && (ar ? "توهج" : "Glow"),
            settings.textOutline && (ar ? "حدود" : "Outline"),
            settings.textShadow && (ar ? "ظل" : "Shadow"),
            settings.textAnimation !== "none" &&
              (ar ? "ظهور تدريجي" : "Fade In"),
            settings.frameStyle &&
              settings.frameStyle !== "none" &&
              (ar ? "إطار" : `Frame: ${settings.frameStyle}`),
            settings.showWatermark &&
              settings.watermarkText &&
              `© ${settings.watermarkText}`,
          ]
            .filter(Boolean)
            .map((label, i) => (
              <span
                key={i}
                className="rounded-full border border-gold/15 bg-gold/10 px-2 py-0.5 text-xs text-gold/70"
              >
                {label as string}
              </span>
            ))}
        </div>
      )}
    </div>
  );
}
