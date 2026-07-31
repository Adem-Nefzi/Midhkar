"use client";

/**
 * StepGenerate.tsx — Step 4: live preview + generation
 *
 * Preview fixes (unchanged):
 *  - Canvas renders at FULL ENCODE resolution then CSS-scaled down.
 *  - bgVideoRef is NOT in the useEffect dependency array.
 *  - renderFullFrame() from generate-video.ts is used for pixel accuracy.
 *
 * Share fixes (unchanged):
 *  - Web Share API with fallback clipboard copy + visible "Copied!" toast.
 *  - window.open() calls pass "noopener,noreferrer".
 *  - Share text computed once via useMemo.
 *
 * Celebration improvements:
 *  - 🎆 Multi-stage fireworks: 6 staggered radial bursts with particle
 *    trails, gravity physics, and glow halos. Plus ambient falling embers.
 *  - Duration extended to ~8s for a more satisfying celebration.
 *  - 🔊 3-note chime unchanged (synthesized Web Audio API).
 *  - Mute toggle preserved.
 *  - All effects fire exactly once per successful generation.
 *
 * UI/UX improvements:
 *  - Cleaner result card layout with better visual hierarchy.
 *  - Share buttons grouped with clearer labels and feedback.
 *  - Action buttons organized into primary/secondary tiers.
 *  - Progress waveform uses deterministic heights (no SSR mismatch).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { renderFullFrame, getDeviceProfile } from "@/lib/generate-video";
import { ensureFontsReady } from "@/lib/fonts-ready";

type PlatformLike = {
  id: string;
  label: string;
  aspect: string;
  fontSize: string;
};

/* ── Encode dimensions — always 1080p ─────────────────────── */
const ENCODE_DIMS: Record<string, [number, number]> = {
  "9:16": [1080, 1920],
  "16:9": [1920, 1080],
  "1:1": [1080, 1080],
};

/* ── Preview display height (canvas is scaled via CSS) ──────── */
const PREVIEW_H = 480;

const SHARE_SITE_URL = "https://midhkar.com";

/* ── Fireworks palette — expanded gold/parchment theme ─────── */
const CONFETTI_COLORS = [
  "#d4af37",
  "#f5f0e8",
  "#e5c76b",
  "#50c878",
  "#ffbf00",
  "#ffd700",
  "#fff8e7",
  "#c9a227",
];

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

/* ── Enhanced fireworks / confetti overlay ───────────────────
   Multi-stage particle system with:
   - Radial burst particles with motion trails and glow halos
   - Ambient falling embers that drift and twinkle
   - 6 staggered bursts across the viewport for full coverage
   - ~8 second total duration
   Respects prefers-reduced-motion. ─────────────────────────── */
function useFireworks() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [active, setActive] = useState(false);
  const rafRef = useRef<number>(0);

  const fire = useCallback(() => {
    const reducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if (reducedMotion) return;
    setActive(true);
  }, []);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    type Particle = {
      x: number;
      y: number;
      vx: number;
      vy: number;
      color: string;
      size: number;
      life: number;
      maxLife: number;
      trail: { x: number; y: number }[];
      decay: number;
      type: "burst" | "ember";
    };

    let particles: Particle[] = [];
    let embers: Particle[] = [];

    const createBurst = (
      x: number,
      y: number,
      count: number,
      spread: number = 6,
    ) => {
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1.5 + Math.random() * spread;
        const color =
          CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)] ??
          CONFETTI_COLORS[0];
        const size = 2 + Math.random() * 3.5;

        particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 2.5,
          color,
          size,
          life: 1,
          maxLife: 1,
          trail: [],
          decay: 0.004 + Math.random() * 0.006,
          type: "burst",
        });
      }
    };

    const createEmbers = (count: number) => {
      const emberColors = ["#d4af37", "#e5c76b", "#ffbf00", "#ffd700"];
      for (let i = 0; i < count; i++) {
        embers.push({
          x: Math.random() * canvas.width,
          y: -10,
          vx: (Math.random() - 0.5) * 0.5,
          vy: 1 + Math.random() * 2,
          color:
            emberColors[Math.floor(Math.random() * emberColors.length)] ??
            emberColors[0],
          size: 1 + Math.random() * 2,
          life: 1,
          maxLife: 1,
          trail: [],
          decay: 0.002,
          type: "ember",
        });
      }
    };

    const w = canvas.width;
    const h = canvas.height;

    createBurst(w * 0.2, h * 0.25, 90, 7);
    const t1 = setTimeout(() => createBurst(w * 0.5, h * 0.2, 100, 7), 400);
    const t2 = setTimeout(() => createBurst(w * 0.8, h * 0.28, 90, 7), 800);
    const t3 = setTimeout(() => createBurst(w * 0.35, h * 0.35, 80, 6), 1200);
    const t4 = setTimeout(() => createBurst(w * 0.65, h * 0.32, 80, 6), 1600);
    const t5 = setTimeout(() => createBurst(w * 0.15, h * 0.4, 50, 4), 2000);
    const t6 = setTimeout(() => createBurst(w * 0.85, h * 0.38, 50, 4), 2200);

    const emberInterval = setInterval(() => {
      if (Date.now() - startedAt < 7000) {
        createEmbers(8);
      }
    }, 200);

    const startedAt = Date.now();
    const gravity = 0.08;
    const drag = 0.98;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Burst particles with trails and glow
      particles.forEach((p) => {
        // Skip dead particles to avoid negative radius in arc()
        if (p.life <= 0) return;

        p.trail.push({ x: p.x, y: p.y });
        if (p.trail.length > 6) p.trail.shift();

        p.vy += gravity;
        p.vx *= drag;
        p.x += p.vx;
        p.y += p.vy;
        p.life -= p.decay;

        const opacity = Math.max(p.life, 0);
        const coreRadius = Math.max(0, p.size * p.life);
        const haloRadius = Math.max(0, p.size * 3.5 * p.life);

        // Draw motion trail
        if (p.trail.length > 1) {
          ctx.beginPath();
          ctx.moveTo(p.trail[0].x, p.trail[0].y);
          for (let i = 1; i < p.trail.length; i++) {
            ctx.lineTo(p.trail[i].x, p.trail[i].y);
          }
          ctx.strokeStyle = p.color;
          ctx.globalAlpha = opacity * 0.25;
          ctx.lineWidth = p.size * 0.4;
          ctx.stroke();
        }

        // Draw particle core
        ctx.globalAlpha = opacity;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, coreRadius, 0, Math.PI * 2);
        ctx.fill();

        // Glow halo
        ctx.globalAlpha = opacity * 0.12;
        ctx.beginPath();
        ctx.arc(p.x, p.y, haloRadius, 0, Math.PI * 2);
        ctx.fill();
      });

      // Falling embers with gentle drift
      embers.forEach((p) => {
        if (p.life <= 0) return;

        p.x += p.vx + Math.sin(Date.now() * 0.003 + p.y * 0.01) * 0.3;
        p.y += p.vy;
        p.life -= p.decay;

        const opacity = Math.max(p.life, 0);
        ctx.globalAlpha = opacity;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(0, p.size), 0, Math.PI * 2);
        ctx.fill();
      });

      particles = particles.filter(
        (p) => p.life > 0 && p.y < canvas.height + 50,
      );
      embers = embers.filter((p) => p.life > 0 && p.y < canvas.height + 50);

      ctx.globalAlpha = 1;

      if (
        Date.now() - startedAt < 8000 ||
        particles.length > 0 ||
        embers.length > 0
      ) {
        rafRef.current = requestAnimationFrame(draw);
      } else {
        setActive(false);
      }
    };
    draw();

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      clearTimeout(t5);
      clearTimeout(t6);
      clearInterval(emberInterval);
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [active]);

  return { canvasRef, active, fire };
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
  const ayahRef = useRef<Ayah | null>(null);
  const settingsRef = useRef<VideoSettings>(settings);
  const platformRef = useRef<PlatformLike>(platform);
  const surahRef = useRef<Surah>(surah);

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

  /* ── Full encode dimensions — always 1080p on every device ── */
  const profile = useMemo(() => getDeviceProfile(), []);
  const [encW, encH] = useMemo(() => {
    return ENCODE_DIMS[platform.aspect] ?? [1080, 1920];
  }, [platform.aspect]);
  const dispH = PREVIEW_H;
  const dispW = Math.round(PREVIEW_H * (encW / encH));

  /* ── Start background video on mount, never restart ─────── */
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

  /* ── Track generation start time for ETA ──────────────────── */
  const prevGeneratingRef = useRef(false);
  useEffect(() => {
    if (isGenerating && !prevGeneratingRef.current) {
      genStartRef.current = Date.now();
    }
    prevGeneratingRef.current = isGenerating;
  }, [isGenerating]);

  /* ── WebCodecs support check — client-only ───────────────── */
  const [webCodecsSupported, setWebCodecsSupported] = useState<boolean | null>(
    null,
  );
  useEffect(() => {
    setWebCodecsSupported(typeof VideoEncoder !== "undefined");
  }, []);

  /* ── rAF render loop ─────────────────────────────────────── */
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
    let lastDrawTime = 0;
    const PREVIEW_FRAME_MS = 1000 / 30; // throttle to 30fps to save CPU

    // Ensure fonts are loaded before the first frame renders
    ensureFontsReady().then(() => { fontsReady = true; });

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
      // Throttle: skip frames that come faster than 30fps
      if (now - lastDrawTime < PREVIEW_FRAME_MS) {
        animRef.current = requestAnimationFrame(draw);
        return;
      }
      lastDrawTime = now;
      // Skip rendering until fonts are loaded (prevents fallback font flash)
      if (!fontsReady) {
        // Draw a dark background while waiting
        ctx.fillStyle = "#09090f";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        animRef.current = requestAnimationFrame(draw);
        return;
      }

      const videoEl = bgVideoRef.current;
      const s = settingsRef.current;
      const p = platformRef.current;
      const ayah = ayahRef.current;
      const sr = surahRef.current;

      const useVideoBg =
        (s.background === "upload" || s.background === "library" || s.background === "pexels") &&
        videoEl !== null;

      const animP =
        s.textAnimation === "none"
          ? 1
          : Math.min(1, (Date.now() - previewStartRef.current) / 500);
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

    requestAnimationFrame(draw);

    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", onVisibility);
      cancelAnimationFrame(animRef.current);
    };
  }, [encW, encH]);

  /* ── Keyboard shortcuts for ayah navigation ──────────────── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isGenerating || resultVideoUrl) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        onPreviewIdx(Math.max(0, previewIdx - 1));
      } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        onPreviewIdx(Math.min(ayahs.length - 1, previewIdx + 1));
      } else if (e.key === " " && !isGenerating) {
        e.preventDefault();
        onGenerate();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [previewIdx, ayahs.length, isGenerating, resultVideoUrl, onPreviewIdx, onGenerate]);

  /* ── Copy verse text to clipboard ───────────────────────── */
  const [copied, setCopied] = useState(false);
  const handleCopyVerse = useCallback(() => {
    const ayah = ayahs[previewIdx];
    if (!ayah) return;
    const text = `${ayah.text}\n\n— ${surah.englishName} ${surah.number}:${ayah.numberInSurah}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }, [ayahs, previewIdx, surah]);

  /* ── Derived ─────────────────────────────────────────────── */
  const lastLog = genLogs[genLogs.length - 1];
  const progress = lastLog?.pct ?? 0;
  const elapsedMs = isGenerating ? Date.now() - genStartRef.current : 0;
  const estRemainingSec =
    progress > 2
      ? Math.round(((elapsedMs / progress) * (100 - progress)) / 1000)
      : 0;
  const estDur = sortedNums.length * 6;
  const fileName = `${surah.englishName}_${sortedNums[0]}-${sortedNums[sortedNums.length - 1]}.mp4`;
  const platformLabel =
    PLATFORM_META[platform.id as PlatformId]?.label ?? platform.label;
  const ar = locale === "ar";
  const deviceProfile = getDeviceProfile();
  const fps = deviceProfile.isLowPower ? 30 : 60;

  /* ── Share text ──────────────────────────────────────────── */
  const shareText = useMemo(() => {
    const range = `${sortedNums[0]}–${sortedNums[sortedNums.length - 1]}`;
    return ar
      ? `شاهد فيديو ${surah.englishName} ${range} من midhkar`
      : `Check out ${surah.englishName} ${range} on midhkar`;
  }, [ar, surah.englishName, sortedNums]);

  /* ── Share / copy with visible feedback ─────────────────── */
  const [copiedPlatform, setCopiedPlatform] = useState<string | null>(null);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const shareOrCopy = async (platformId: string) => {
    const fullText = `${shareText} ${SHARE_SITE_URL}`;

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: "midhkar",
          text: shareText,
          url: SHARE_SITE_URL,
        });
        return;
      } catch (err: any) {
        if (err?.name === "AbortError") return;
      }
    }

    try {
      await navigator.clipboard.writeText(fullText);
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
      setCopiedPlatform(platformId);
      copiedTimerRef.current = setTimeout(() => setCopiedPlatform(null), 2000);
    } catch {
      /* silently fail */
    }
  };

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    };
  }, []);

  /* ── 🎆 Fireworks + 🔔 chime on completion ───────────────── */
  const {
    canvasRef: fireworksRef,
    active: fireworksActive,
    fire: fireFireworks,
  } = useFireworks();
  const audioCtxRef = useRef<AudioContext | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const ensureAudioContext = useCallback(() => {
    if (typeof window === "undefined") return;
    if (!audioCtxRef.current) {
      const AudioCtor = (window.AudioContext ||
        (window as any).webkitAudioContext) as typeof AudioContext | undefined;
      if (AudioCtor) {
        try {
          audioCtxRef.current = new AudioCtor();
        } catch {
          /* unsupported */
        }
      }
    }
    audioCtxRef.current?.resume().catch(() => {});
  }, []);

  const playChime = useCallback(() => {
    if (!soundEnabled) return;
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    try {
      const notes = [523.25, 659.25, 783.99];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        const startTime = ctx.currentTime + i * 0.12;
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.16, startTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.5);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(startTime);
        osc.stop(startTime + 0.55);
      });
    } catch {
      /* ignore */
    }
  }, [soundEnabled]);

  const handleGenerateClick = useCallback(() => {
    ensureAudioContext();
    onGenerate();
  }, [ensureAudioContext, onGenerate]);

  const prevResultRef = useRef<string | null>(null);
  useEffect(() => {
    if (resultVideoUrl && resultVideoUrl !== prevResultRef.current) {
      fireFireworks();
      playChime();
    }
    prevResultRef.current = resultVideoUrl;
  }, [resultVideoUrl, fireFireworks, playChime]);

  useEffect(() => {
    return () => {
      audioCtxRef.current?.close().catch(() => {});
    };
  }, []);

  return (
    <div className="animate-fade-up max-w-5xl mx-auto">
      {/* 🎆 Fireworks overlay */}
      {fireworksActive && (
        <canvas
          ref={fireworksRef}
          className="pointer-events-none fixed inset-0 z-50"
          aria-hidden="true"
        />
      )}

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

          <div
            className="relative rounded-sm border-2 border-gold/25 shadow-2xl shadow-gold/5 overflow-hidden max-w-full"
            style={{ width: dispW, height: dispH }}
          >
            <KuficBorder />

            <canvas
              ref={canvasRef}
              style={{
                display: "block",
                width: dispW,
                height: dispH,
                imageRendering: "auto",
              }}
            />

            <div className="absolute top-3 left-3 flex items-center gap-1 rounded-full bg-black/50 backdrop-blur-sm px-2 py-0.5 z-10">
              <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" />
              <span className="text-[9px] text-white/80 font-medium uppercase tracking-wider">
                Live
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
                className="h-7 w-7 rounded-full border border-gold/20 text-gold/60 hover:bg-gold/10 disabled:opacity-30 transition text-sm active:scale-90"
                title="Previous (←)"
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
                className="h-7 w-7 rounded-full border border-gold/20 text-gold/60 hover:bg-gold/10 disabled:opacity-30 transition text-sm active:scale-90"
                title="Next (→)"
              >
                ›
              </button>
              <button
                onClick={handleCopyVerse}
                className="ml-1 h-7 px-2.5 rounded-full border border-gold/20 text-gold/60 hover:bg-gold/10 transition text-[10px] flex items-center gap-1 active:scale-95"
                title={ar ? "نسخ النص" : "Copy verse text"}
              >
                {copied ? "✓" : "⧉"}
                <span className="hidden sm:inline">
                  {copied ? (ar ? "نُسخ" : "Copied") : (ar ? "نسخ" : "Copy")}
                </span>
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
              settings.textAnimation !== "none" &&
                (ar ? "ظهور تدريجي" : "Fade In"),
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
          <div className="gradient-border rounded-sm p-5 kufic-frame">
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
                   [ar ? "معدل الإطارات" : "Frame Rate", `${deviceProfile.isLowPower ? 30 : 60} fps`],
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

          {/* Encoder note + shortcuts */}
          <div className="rounded-sm border border-gold/10 bg-gold/[0.03] p-4 text-xs text-parchment-muted/70 space-y-1.5">
            <div className="flex items-center justify-between gap-1.5 text-gold/40 mb-1">
              <span className="flex items-center gap-1.5 uppercase tracking-wider font-medium">
                <IslamicStarIcon className="h-3 w-3" />
                {ar ? "ملاحظة" : "Note"}
              </span>
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1 text-[10px] text-parchment-muted/30">
                  <kbd className="px-1 py-0.5 rounded border border-gold/15 bg-ink-light/50">←</kbd>
                  <kbd className="px-1 py-0.5 rounded border border-gold/15 bg-ink-light/50">→</kbd>
                  <span className="hidden sm:inline">
                    {ar ? "للتنقل" : "navigate"}
                  </span>
                  <span className="mx-1 text-gold/10">·</span>
                  <kbd className="px-1 py-0.5 rounded border border-gold/15 bg-ink-light/50">Space</kbd>
                  <span className="hidden sm:inline">
                    {ar ? "إنتاج" : "generate"}
                  </span>
                </span>
                <button
                  onClick={() => setSoundEnabled((v) => !v)}
                  className="text-parchment-muted/40 hover:text-gold transition active:scale-90"
                  title={
                    soundEnabled
                      ? ar
                        ? "كتم صوت الإشعار"
                        : "Mute completion sound"
                      : ar
                        ? "تفعيل صوت الإشعار"
                        : "Unmute completion sound"
                  }
                >
                  {soundEnabled ? "🔊" : "🔇"}
                </button>
              </div>
            </div>
            <p>
              {ar
                ? "يستخدم WebCodecs API — تشفير بالمعالج الرسومي، بدون تحميل إضافي."
                : "Native WebCodecs API — GPU-accelerated H.264, no extra downloads."}
            </p>
            {webCodecsSupported === false && (
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
          className="rounded-full border border-parchment/20 px-6 py-3 text-sm text-parchment hover:border-gold/40 hover:text-gold flex items-center gap-2 disabled:opacity-40 transition active:scale-95"
        >
          <IslamicStarIcon className="h-3 w-3 rotate-180" />
          {ar ? "رجوع" : "Back"}
        </button>

        {!isGenerating ? (
          <button
            onClick={handleGenerateClick}
            className="group relative overflow-hidden rounded-full bg-gold px-10 py-3.5 text-sm font-semibold text-ink hover:-translate-y-0.5 hover:shadow-lg hover:shadow-gold/20 transition-all flex items-center gap-2 active:scale-95"
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
            className="rounded-full border-2 border-red-500/40 bg-red-500/10 px-8 py-3.5 text-sm font-semibold text-red-400 hover:bg-red-500/20 transition flex items-center gap-2 active:scale-95"
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
          <div className="h-2 rounded-full bg-gold/10 overflow-hidden mb-1">
            <div
              className="h-full rounded-full bg-gradient-to-r from-gold/70 to-gold transition-all duration-500"
              style={{ width: `${Math.max(2, progress)}%` }}
            />
          </div>

          {estRemainingSec > 0 && (
            <p className="text-center text-[10px] text-parchment-muted/50">
              {ar
                ? `~${estRemainingSec}ث متبقية`
                : `~${estRemainingSec}s remaining`}
            </p>
          )}

          <div className="flex items-end justify-center gap-[3px] h-10">
            {Array.from({ length: 24 }).map((_, i) => {
              const baseHeight = 14 + ((i * 7) % 5) * 4;
              return (
                <div
                  key={i}
                  className="w-[3px] rounded-full bg-gold/40 transition-all"
                  style={{
                    height: `${baseHeight}px`,
                    animationName: isGenerating ? "pulse-wave" : "none",
                    animationDuration: "1.2s",
                    animationTimingFunction: "ease-in-out",
                    animationIterationCount: "infinite",
                    animationDelay: `${i * 0.1}s`,
                  }}
                />
              );
            })}
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

      {/* ── Result ───────────────────────────────────────── */}
      {resultVideoUrl && !isGenerating && (
        <div className="mt-10 rounded-sm border-2 border-gold/30 bg-gold/5 p-8 text-center kufic-frame animate-fade-up">
          {/* Success icon */}
          <div className="flex items-center justify-center gap-3 mb-5">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gold/20 ring-4 ring-gold/10 animate-pulse">
              <svg
                className="h-8 w-8 text-gold"
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

          <h3 className="text-2xl font-medium text-parchment mb-1">
            {ar ? "الفيديو جاهز! 🎉" : "Video Ready! 🎉"}
          </h3>
          <p className="text-sm text-parchment-muted mb-6">
            {ar
              ? "تم إنشاء ملف MP4 يحتوي على الصوت والصورة المتزامنة"
              : "Your MP4 file with synchronized audio has been generated"}
          </p>

          {/* Video player */}
          <video
            src={resultVideoUrl}
            controls
            className="mx-auto rounded-sm mb-8 border border-gold/20 max-h-72 w-full max-w-md"
          />

          {/* Share section */}
          <div className="mb-8">
            <p className="text-[10px] uppercase tracking-wider text-parchment-muted/40 mb-3">
              {ar ? "مشاركة" : "Share"}
            </p>

            <div className="flex justify-center gap-3 flex-wrap">
              {/* Instagram */}
              <div className="relative">
                <button
                  onClick={() => shareOrCopy("instagram")}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-pink-600/20 text-pink-400 hover:bg-pink-600/30 transition active:scale-90"
                  title="Instagram"
                >
                  <InstagramLogo className="h-4 w-4" />
                </button>
                {copiedPlatform === "instagram" && (
                  <span className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/80 px-2.5 py-1 text-[10px] text-white font-medium">
                    {ar ? "تم النسخ!" : "Copied!"}
                  </span>
                )}
              </div>

              {/* TikTok */}
              <div className="relative">
                <button
                  onClick={() => shareOrCopy("tiktok")}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-800/40 text-parchment hover:bg-gray-800/60 transition active:scale-90"
                  title="TikTok"
                >
                  <TikTokLogo className="h-4 w-4" />
                </button>
                {copiedPlatform === "tiktok" && (
                  <span className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/80 px-2.5 py-1 text-[10px] text-white font-medium">
                    {ar ? "تم النسخ!" : "Copied!"}
                  </span>
                )}
              </div>

              {/* Facebook */}
              <button
                onClick={() => {
                  window.open(
                    `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(SHARE_SITE_URL)}&quote=${encodeURIComponent(shareText)}`,
                    "_blank",
                    "noopener,noreferrer",
                  );
                }}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 transition active:scale-90"
                title="Facebook"
              >
                <FacebookLogo className="h-4 w-4" />
              </button>

              {/* X / Twitter */}
              <button
                onClick={() => {
                  window.open(
                    `https://twitter.com/intent/tweet?text=${encodeURIComponent(`${shareText} ${SHARE_SITE_URL}`)}`,
                    "_blank",
                    "noopener,noreferrer",
                  );
                }}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-parchment hover:bg-white/20 transition active:scale-90"
                title="X"
              >
                <TwitterIcon className="h-4 w-4" />
              </button>

              {/* Copy link */}
              <div className="relative">
                <button
                  onClick={() => shareOrCopy("clipboard")}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-gold/15 text-gold hover:bg-gold/25 transition active:scale-90"
                  title={ar ? "نسخ الرابط" : "Copy link"}
                >
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
                      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                </button>
                {copiedPlatform === "clipboard" && (
                  <span className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/80 px-2.5 py-1 text-[10px] text-white font-medium">
                    {ar ? "تم النسخ!" : "Copied!"}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row justify-center gap-3">
            <a
              href={resultVideoUrl}
              download={fileName}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-gold px-8 py-3 text-sm font-semibold text-ink hover:bg-gold-soft transition active:scale-95"
            >
              <DownloadIcon className="h-4 w-4" />
              {ar ? "تحميل MP4" : "Download MP4"}
            </a>

            <button
              onClick={onReset}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-gold/30 px-8 py-3 text-sm font-medium text-gold hover:bg-gold/10 transition active:scale-95"
            >
              <IslamicStarIcon className="h-4 w-4" />
              {ar ? "إنتاج نسخة أخرى" : "Generate Another"}
            </button>

            <button
              onClick={onStartOver}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-parchment/20 px-8 py-3 text-sm text-parchment hover:border-gold/40 hover:text-gold transition active:scale-95"
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
