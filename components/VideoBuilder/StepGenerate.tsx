"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { m, AnimatePresence } from "motion/react";
import {
  DownloadIcon,
  CheckIcon,
  ArrowIcon,
  VideoCameraIcon,
  CopyIcon,
  InstagramLogo,
  TikTokLogo,
  FacebookLogo,
  Shamsa,
  AudioWaveIcon,
} from "./icons";
import { TwitterIcon } from "./share-icons";
import { PLATFORM_META } from "@/lib/types";
import type { PlatformId } from "@/lib/types";
import type { Ayah, Surah, Reciter } from "@/lib/quran";
import type { GenLog, VideoSettings } from "@/lib/types";
import { getDeviceProfile, getOutputResolution } from "@/lib/device-profile";
import { LivePreview } from "./LivePreview";
import type { PlatformLike } from "./LivePreview";
import { Bloom } from "@/components/Ornament/ornaments";

const SHARE_SITE_URL = "https://midhkar.vercel.app";

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
  const genStartRef = useRef<number>(0);

  const prevGeneratingRef = useRef(false);
  useEffect(() => {
    if (isGenerating && !prevGeneratingRef.current) {
      genStartRef.current = Date.now();
    }
    prevGeneratingRef.current = isGenerating;
  }, [isGenerating]);

  const [webCodecsSupported, setWebCodecsSupported] = useState<boolean | null>(
    null,
  );
  useEffect(() => {
    setWebCodecsSupported(typeof VideoEncoder !== "undefined");
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isGenerating || resultVideoUrl) return;
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;
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
  }, [
    previewIdx,
    ayahs.length,
    isGenerating,
    resultVideoUrl,
    onPreviewIdx,
    onGenerate,
  ]);

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
  const fr = locale === "fr";
  const deviceProfile = getDeviceProfile();
  const [encW, encH] = getOutputResolution(
    platform.aspect,
    deviceProfile.isLowPower,
  );

  const shareText = useMemo(() => {
    const range = `${sortedNums[0]}–${sortedNums[sortedNums.length - 1]}`;
    return ar
      ? `شاهد فيديو ${surah.englishName} ${range} من midhkar`
      : `Check out ${surah.englishName} ${range} on midhkar`;
  }, [ar, surah.englishName, sortedNums]);

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

  /* ── Completion: one warm bloom + soft chime ─────────────── */
  const [bloom, setBloom] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const ensureAudioContext = useCallback(() => {
    if (typeof window === "undefined") return;
    if (!audioCtxRef.current) {
      const AudioCtor = (window.AudioContext ||
        (window as any).webkitAudioContext) as
        | typeof AudioContext
        | undefined;
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
        gain.gain.linearRampToValueAtTime(0.12, startTime + 0.02);
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
      const reducedMotion = window.matchMedia?.(
        "(prefers-reduced-motion: reduce)",
      )?.matches;
      if (!reducedMotion) {
        setBloom(true);
        setTimeout(() => setBloom(false), 1600);
      }
      playChime();
    }
    prevResultRef.current = resultVideoUrl;
  }, [resultVideoUrl, playChime]);

  useEffect(() => {
    return () => {
      audioCtxRef.current?.close().catch(() => {});
    };
  }, []);

  return (
    <div className="animate-step-in mx-auto max-w-5xl">
      {bloom && (
        <div
          className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center"
          aria-hidden="true"
        >
          <div
            className="h-[60vmin] w-[60vmin] rounded-full"
            style={{
              background:
                "radial-gradient(circle, rgba(235,176,84,0.5) 0%, rgba(212,175,55,0.22) 40%, transparent 70%)",
              animation: "night-bloom 1.5s cubic-bezier(0.22,1,0.36,1) both",
            }}
          />
        </div>
      )}

      <div className="mb-8 text-center">
        <h2 className="font-display text-3xl font-medium text-parchment sm:text-4xl">
          {ar
            ? "معاينة وإنتاج"
            : fr
              ? "Aperçu & génération"
              : "Preview & Generate"}
        </h2>
        <p className="mt-2 text-sm text-parchment-muted">
          {ar
            ? "المعاينة مطابقة تماما للفيديو النهائي"
            : fr
              ? "L'aperçu est fidèle au pixel près au résultat final"
              : "Preview is pixel-accurate — what you see is what you get"}
        </p>
      </div>

      <div className="flex flex-col items-start justify-center gap-8 lg:flex-row">
        <LivePreview
          surah={surah}
          ayahs={ayahs}
          settings={settings}
          platform={platform}
          bgVideoRef={bgVideoRef}
          previewIdx={previewIdx}
          onPreviewIdx={onPreviewIdx}
          locale={locale}
          className="shrink-0"
        />

        <div className="min-w-0 flex-1 space-y-4">
          <div className="panel p-5">
            <h3 className="mb-4 text-[13px] font-medium uppercase tracking-wider text-gold/70">
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
                  [
                    ar ? "معدل الإطارات" : "Frame Rate",
                    `${deviceProfile.isLowPower ? 30 : 60} fps`,
                  ],
                  [ar ? "الجودة" : "Output", "H.264 MP4 + AAC"],
                  [ar ? "المدة التقريبية" : "Est. Duration", `~${estDur}s`],
                ] as [string, string][]
              ).map(([label, value]) => (
                <div key={label} className="flex gap-3">
                  <span className="w-32 shrink-0 text-[13px] text-parchment-muted">
                    {label}:
                  </span>
                  <span className="text-[13px] text-parchment">{value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="panel-inset space-y-1.5 p-4 text-[13px] text-parchment-muted">
            <div className="mb-1 flex items-center justify-between gap-1.5 text-gold/60">
              <span className="flex items-center gap-1.5 font-medium uppercase tracking-wider">
                <AudioWaveIcon className="h-3.5 w-3.5" />
                {ar ? "ملاحظة" : "Note"}
              </span>
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1 text-[13px] text-parchment-dim">
                  <kbd className="rounded border border-gold/20 bg-ink-raise/60 px-1 py-0.5">
                    ←
                  </kbd>
                  <kbd className="rounded border border-gold/20 bg-ink-raise/60 px-1 py-0.5">
                    →
                  </kbd>
                  <span className="hidden sm:inline">
                    {ar ? "للتنقل" : "navigate"}
                  </span>
                  <span className="mx-1 text-gold/20">·</span>
                  <kbd className="rounded border border-gold/20 bg-ink-raise/60 px-1 py-0.5">
                    Space
                  </kbd>
                  <span className="hidden sm:inline">
                    {ar ? "إنتاج" : "generate"}
                  </span>
                </span>
                <button
                  onClick={() => setSoundEnabled((v) => !v)}
                  className={`transition active:scale-90 ${soundEnabled ? "text-gold/70 hover:text-gold" : "text-parchment-dim hover:text-parchment-muted"}`}
                  title={
                    soundEnabled
                      ? ar
                        ? "كتم صوت الإشعار"
                        : "Mute completion sound"
                      : ar
                        ? "تفعيل صوت الإشعار"
                        : "Unmute completion sound"
                  }
                  aria-pressed={soundEnabled}
                >
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M11 5L6 9H3v6h3l5 4V5z" />
                    {soundEnabled ? (
                      <path d="M15.5 8.5a5 5 0 010 7M18 6a8.5 8.5 0 010 12" />
                    ) : (
                      <path d="M16 9l5 6M21 9l-5 6" />
                    )}
                  </svg>
                </button>
              </div>
            </div>
            <p>
              {ar
                ? "يستخدم WebCodecs API — تشفير بالمعالج الرسومي، بدون تحميل إضافي."
                : "Native WebCodecs API — GPU-accelerated H.264, no extra downloads."}
            </p>
            {webCodecsSupported === false && (
              <p className="mt-1 text-red-400/90">
                {ar
                  ? "متصفحك لا يدعم WebCodecs. استخدم Chrome أو Edge 94+."
                  : "WebCodecs not supported. Use Chrome or Edge 94+."}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-10 flex flex-wrap justify-center gap-4">
        <button
          onClick={onBack}
          disabled={isGenerating}
          className="btn-ghost px-6 py-3 text-sm disabled:opacity-40"
        >
          <ArrowIcon className="h-4 w-4 rotate-180" />
          {ar ? "رجوع" : fr ? "Retour" : "Back"}
        </button>

        {!isGenerating ? (
          <button
            onClick={handleGenerateClick}
            className="btn-primary px-10 py-3.5 text-sm"
          >
            <VideoCameraIcon className="h-4 w-4" />
            {ar
              ? "إنتاج الفيديو مع الصوت"
              : fr
                ? "Générer la vidéo avec audio"
                : "Generate Video with Audio"}
          </button>
        ) : (
          <button
            onClick={onCancel}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-500/40 bg-red-500/10 px-8 py-3.5 text-sm font-semibold text-red-400 transition hover:bg-red-500/20 active:scale-95"
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
            {ar ? "إيقاف" : fr ? "Annuler" : "Cancel"}
          </button>
        )}
      </div>

      {(isGenerating || (genLogs.length > 0 && !resultVideoUrl)) && (
        <div className="mx-auto mt-6 max-w-lg space-y-3">
          <div className="relative mb-1">
            <div className="h-2 overflow-hidden rounded-full bg-ink-raise/70">
              <div
                className="relative h-full overflow-hidden rounded-full bg-gradient-to-r from-verdant/70 via-gold/70 to-gold-soft transition-all duration-500"
                style={{ width: `${Math.max(2, progress)}%` }}
              >
                {isGenerating && (
                  <div className="progress-sweep absolute inset-0" aria-hidden="true" />
                )}
              </div>
            </div>
            <span
              className="absolute top-1/2 -translate-y-1/2"
              style={{ insetInlineStart: `calc(${Math.max(2, progress)}% - 9px)` }}
              aria-hidden="true"
            >
              <Bloom className="h-[18px] w-[18px] drop-shadow-[0_0_6px_rgb(var(--gold)/0.6)]" petals={8} />
            </span>
          </div>

          {estRemainingSec > 0 && (
            <p className="text-center text-[13px] text-parchment-dim">
              {ar
                ? `~${estRemainingSec}ث متبقية`
                : `~${estRemainingSec}s remaining`}
            </p>
          )}

          <div className="flex h-10 items-end justify-center gap-[3px]">
            {Array.from({ length: 24 }).map((_, i) => {
              const baseHeight = 14 + ((i * 7) % 5) * 4;
              return (
                <div
                  key={i}
                  className="w-[3px] rounded-full bg-gold/45 transition-all"
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
            <AnimatePresence initial={false}>
              {genLogs.slice(-4).map((log, i, arr) => (
                <m.p
                  key={log.id}
                  className={`text-center text-[13px] ${
                    i === arr.length - 1
                      ? "text-gold/90 opacity-100"
                      : "text-parchment-dim opacity-60"
                  }`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: i === arr.length - 1 ? 1 : 0.6, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                >
                  {log.msg}
                  {i === arr.length - 1 && log.pct > 0 ? ` (${log.pct}%)` : ""}
                </m.p>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {resultVideoUrl && !isGenerating && (
        <div className="panel-lit relative mt-10 overflow-hidden p-8 text-center animate-step-in">
          <div
            className="garden-light left-1/2 top-0 h-64 w-[36rem] -translate-x-1/2 -translate-y-1/2"
            aria-hidden="true"
          />
          <div className="relative">
            <div className="mb-5 flex items-center justify-center">
              <div className="relative flex h-16 w-16 items-center justify-center">
                <Bloom className="absolute inset-0 h-full w-full animate-spin-slow" petals={8} />
                <div className="relative flex h-9 w-9 items-center justify-center rounded-full border border-gold/40 bg-ink text-gold">
                  <CheckIcon className="h-5 w-5" />
                </div>
              </div>
            </div>

            <h3 className="mb-1 text-2xl font-medium text-parchment">
              {ar ? "الفيديو جاهز" : fr ? "Vidéo prête" : "Video Ready"}
            </h3>
            <p className="mb-6 text-sm text-parchment-muted">
              {ar
                ? "تم إنشاء ملف MP4 يحتوي على الصوت والصورة المتزامنة"
                : fr
                  ? "Votre fichier MP4 avec audio synchronisé a été généré"
                  : "Your MP4 file with synchronized audio has been generated"}
            </p>

            <video
              src={resultVideoUrl}
              controls
              className="mx-auto mb-8 max-h-72 w-full max-w-md rounded-xl border border-gold/20"
            />

            <div className="mb-8">
              <p className="mb-3 text-[13px] uppercase tracking-wider text-parchment-dim">
                {ar ? "مشاركة" : "Share"}
              </p>

              <div className="flex flex-wrap justify-center gap-3">
                <div className="relative">
                  <button
                    onClick={() => shareOrCopy("instagram")}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-pink-600/20 text-pink-400 transition hover:bg-pink-600/30 active:scale-90"
                    title="Instagram"
                    aria-label="Share to Instagram"
                  >
                    <InstagramLogo className="h-4 w-4" />
                  </button>
                  {copiedPlatform === "instagram" && (
                    <span className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/85 px-2.5 py-1 text-[13px] font-medium text-white">
                      {ar ? "تم النسخ!" : "Copied!"}
                    </span>
                  )}
                </div>

                <div className="relative">
                  <button
                    onClick={() => shareOrCopy("tiktok")}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-parchment/10 text-parchment transition hover:bg-parchment/20 active:scale-90"
                    title="TikTok"
                    aria-label="Share to TikTok"
                  >
                    <TikTokLogo className="h-4 w-4" />
                  </button>
                  {copiedPlatform === "tiktok" && (
                    <span className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/85 px-2.5 py-1 text-[13px] font-medium text-white">
                      {ar ? "تم النسخ!" : "Copied!"}
                    </span>
                  )}
                </div>

                <button
                  onClick={() => {
                    window.open(
                      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(SHARE_SITE_URL)}&quote=${encodeURIComponent(shareText)}`,
                      "_blank",
                      "noopener,noreferrer",
                    );
                  }}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600/20 text-blue-400 transition hover:bg-blue-600/30 active:scale-90"
                  title="Facebook"
                  aria-label="Share to Facebook"
                >
                  <FacebookLogo className="h-4 w-4" />
                </button>

                <button
                  onClick={() => {
                    window.open(
                      `https://twitter.com/intent/tweet?text=${encodeURIComponent(`${shareText} ${SHARE_SITE_URL}`)}`,
                      "_blank",
                      "noopener,noreferrer",
                    );
                  }}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-parchment/10 text-parchment transition hover:bg-parchment/20 active:scale-90"
                  title="X"
                  aria-label="Share to X"
                >
                  <TwitterIcon className="h-4 w-4" />
                </button>

                <div className="relative">
                  <button
                    onClick={() => shareOrCopy("clipboard")}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-gold/15 text-gold transition hover:bg-gold/25 active:scale-90"
                    title={ar ? "نسخ الرابط" : "Copy link"}
                    aria-label={ar ? "نسخ الرابط" : "Copy link"}
                  >
                    <CopyIcon className="h-4 w-4" />
                  </button>
                  {copiedPlatform === "clipboard" && (
                    <span className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/85 px-2.5 py-1 text-[13px] font-medium text-white">
                      {ar ? "تم النسخ!" : "Copied!"}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-col justify-center gap-3 sm:flex-row">
              <a
                href={resultVideoUrl}
                download={fileName}
                className="btn-primary px-8 py-3 text-sm"
              >
                <DownloadIcon className="h-4 w-4" />
                {ar ? "تحميل MP4" : fr ? "Télécharger MP4" : "Download MP4"}
              </a>

              <button onClick={onReset} className="btn-ghost px-8 py-3 text-sm">
                <Shamsa className="h-4 w-4" />
                {ar
                  ? "إنتاج نسخة أخرى"
                  : fr
                    ? "Générer une autre"
                    : "Generate Another"}
              </button>

              <button
                onClick={onStartOver}
                className="btn-ghost px-8 py-3 text-sm"
              >
                {ar ? "بداية جديدة" : fr ? "Recommencer" : "Start Over"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
