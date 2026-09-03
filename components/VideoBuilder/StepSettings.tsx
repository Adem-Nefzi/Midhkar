"use client";
/**
 * StepSettings.tsx — Step 3: Platform → Reciter → Customise
 *
 * Revision (Night Garden):
 *  - Background sources reduced to two rich cards: Upload + Library
 *    (Library = curated Pexels search, renamed from "Online").
 *  - Pattern & Color backgrounds removed; Quick Themes removed.
 *  - Supabase storage library disabled (commented out, restorable).
 *  - Video tab leads with the background choice, then overlay, frame,
 *    spacing and toggles. Text/Effects tabs unchanged in capability.
 */

import { useRef, useState, useCallback } from "react";
import {
  MicIcon,
  FilmIcon,
  TypeIcon,
  SparklesIcon,
  PaletteIcon,
  UploadIcon,
  LibraryIcon,
  ResetIcon,
  ArrowIcon,
  Spinner,
  CheckIcon,
  PlayIcon,
  PauseIcon,
  YoutubeLogo,
  InstagramLogo,
  TikTokLogo,
  FacebookLogo,
  LandscapeLogo,
} from "./icons";
import { TEXT_POSITIONS } from "@/lib/quran";
import type { Reciter } from "@/lib/quran";
/* ── Supabase Library (disabled — restore by uncommenting) ──────
import type { StorageVideo } from "@/lib/storage-client";
──────────────────────────────────────────────────────────────── */
import {
  ARABIC_FONTS,
  LATIN_FONTS,
  PLATFORM_META,
  DEFAULT_SETTINGS,
  VideoSettings,
} from "@/lib/types";
import type { PlatformId } from "@/lib/types";
import {
  getOutputResolution,
  getDeviceProfile,
} from "@/lib/device-profile";
import { LibrarySearch } from "./settings/library-search";

/* ── Text colour palette ─────────────────────────────────────── */
const TEXT_COLORS = [
  { id: "gold", label: "Gold", value: "#d4af37" },
  { id: "parchment", label: "Parchment", value: "#f5f0e8" },
  { id: "white", label: "White", value: "#ffffff" },
  { id: "cream", label: "Cream", value: "#faf5eb" },
  { id: "amber", label: "Amber", value: "#ffbf00" },
  { id: "light-gold", label: "Lt. Gold", value: "#e5c76b" },
  { id: "emerald", label: "Emerald", value: "#50c878" },
  { id: "silver", label: "Silver", value: "#c0c0c0" },
  { id: "rose", label: "Rose Gold", value: "#e0bfb8" },
  { id: "ivory", label: "Ivory", value: "#fffff0" },
  { id: "sky", label: "Sky", value: "#87ceeb" },
  { id: "lavender", label: "Lavender", value: "#e6e6fa" },
];

/* ── Overlay presets ─────────────────────────────────────────── */
const OverlayGlyph = ({ kind }: { kind: "none" | "linear" | "radial" }) => (
  <svg viewBox="0 0 24 24" className="mx-auto h-5 w-5" aria-hidden="true">
    <rect
      x="4"
      y="4"
      width="16"
      height="16"
      rx="2"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
    />
    {kind === "linear" && (
      <path d="M4 14h16v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4z" fill="currentColor" opacity="0.45" />
    )}
    {kind === "radial" && (
      <circle cx="12" cy="12" r="4.5" fill="currentColor" opacity="0.45" />
    )}
  </svg>
);

const OVERLAY_PRESETS = [
  { id: "none", label: "None" },
  { id: "linear", label: "Linear" },
  { id: "radial", label: "Radial" },
] as const;

/* ── Frame decoration options ────────────────────────────────── */
const FrameGlyph = ({ kind }: { kind: "none" | "corners" | "full" | "arch" }) => (
  <svg viewBox="0 0 24 24" className="mx-auto h-5 w-5" aria-hidden="true">
    {kind === "none" && (
      <rect x="5" y="5" width="14" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.4" strokeDasharray="2.5 2.5" />
    )}
    {kind === "corners" && (
      <path d="M5 9V5h4M15 5h4v4M19 15v4h-4M9 19H5v-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    )}
    {kind === "full" && (
      <rect x="5" y="5" width="14" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
    )}
    {kind === "arch" && (
      <path d="M6 19v-7a6 6 0 0112 0v7" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    )}
  </svg>
);

const FRAME_STYLES = [
  { id: "none", label: "None" },
  { id: "corners", label: "Corners" },
  { id: "full", label: "Full" },
  { id: "arch", label: "Arch" },
] as const;

/* ── Keys reset by the "↺ Reset" button. Deliberately excludes
   platform, background source, and any uploaded media — those are
   the user's structural choices, not "look & feel" tweaks. ────── */
const RESETTABLE_KEYS: (keyof VideoSettings)[] = [
  "fontFamily",
  "textColor",
  "textOpacity",
  "textPosition",
  "translationFontFamily",
  "translationColor",
  "translationOpacity",
  "showSurahName",
  "showVerseNumber",
  "showTranslation",
  "textShadow",
  "bgOverlay",
  "fontSize",
  "overlayStyle",
  "showWatermark",
  "watermarkText",
  "textGlow",
  "textOutline",
  "frameStyle",
  "verseSpacing",
  "textAnimation",
  "transitionStyle",
];

/* ────────────────────────────────────────────────────────────── */

interface Props {
  settings: VideoSettings;
  onChange: <K extends keyof VideoSettings>(k: K, v: VideoSettings[K]) => void;
  reciters: Reciter[];
  recitersLoading: boolean;
  selectedReciter: Reciter | null;
  onSelectReciter: (r: Reciter) => void;
  audioPlaying: boolean;
  audioLoading: boolean;
  audioError: string | null;
  onToggleAudio: () => void;
  canPreviewAudio: boolean;
  /* ── Supabase Library (disabled — restore by uncommenting) ──
  storageVideos: StorageVideo[];
  videosLoading: boolean;
  ──────────────────────────────────────────────────────────── */
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  uploadError: string | null;
  onBack: () => void;
  onNext: () => void;
  locale: string;
  totalDurationSec: number | null;
}

export function StepSettings({
  settings,
  onChange,
  reciters,
  recitersLoading,
  selectedReciter,
  onSelectReciter,
  audioPlaying,
  audioLoading,
  audioError,
  onToggleAudio,
  canPreviewAudio,
  /* ── Supabase Library (disabled) ──
  storageVideos,
  videosLoading,
  ────────────────────────────────── */
  onFileUpload,
  uploadError,
  onBack,
  onNext,
  locale,
  totalDurationSec,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const toggle = (k: keyof VideoSettings) => onChange(k, !settings[k] as any);

  const ar = locale === "ar";
  const fr = locale === "fr";
  const L = (o: { en: string; fr: string; ar: string }) =>
    ar ? o.ar : fr ? o.fr : o.en;

  /* ── Background-video playlist (ordered; index 0 plays first) ── */
  const playlist: string[] = settings.videoUrls ?? [];
  const isPlSelected = (url: string) => playlist.includes(url);
  const togglePlaylist = (url: string) => {
    onChange(
      "videoUrls",
      isPlSelected(url) ? playlist.filter((u) => u !== url) : [...playlist, url],
    );
  };
  const removeFromPlaylist = (url: string) =>
    onChange("videoUrls", playlist.filter((u) => u !== url));
  const clearPlaylist = () => onChange("videoUrls", []);

  const platformChosen = !!settings.platform;
  const canProceed = platformChosen && !!selectedReciter;

  /* ── Tabs for the customise panel ────────────────────────── */
  const [tab, setTab] = useState<"video" | "text" | "effects">("video");

  /* ── Toast (↺ reset feedback) ────────────────────────────── */
  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((msg: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast(msg);
    toastTimerRef.current = setTimeout(() => setToast(null), 2200);
  }, []);

  const handleResetCustomization = useCallback(() => {
    RESETTABLE_KEYS.forEach((k) => {
      (onChange as any)(k, DEFAULT_SETTINGS[k]);
    });
    showToast(ar ? "تمت إعادة الضبط" : fr ? "Réinitialisé" : "Reset to defaults");
  }, [onChange, ar, fr, showToast]);

  const uploadedName = settings.uploadedVideoFile?.name ?? null;

  return (
    <div className="animate-step-in mx-auto max-w-6xl space-y-10">
      {/* ══ Header ══════════════════════════════════════════════ */}
      <div className="text-center">
        <h2 className="font-display text-3xl font-medium text-parchment sm:text-4xl">
          {L({ en: "Reciter & Settings", fr: "Récitant & réglages", ar: "القارئ والإعدادات" })}
        </h2>
        <p className="mt-2 text-sm text-parchment-muted">
          {L({
            en: "Choose your platform first, then pick a reciter and customise",
            fr: "Choisissez d'abord la plateforme, puis le récitateur et le style",
            ar: "اختر المنصة أولا ثم القارئ والتخصيصات",
          })}
        </p>

        {(platformChosen || selectedReciter) && (
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            {platformChosen && (
              <span className="flex items-center gap-1.5 rounded-full border border-gold/20 bg-gold/[0.06] px-3 py-1 text-[13px] text-parchment-muted">
                <FilmIcon className="h-3 w-3 text-gold/70" />
                {PLATFORM_META[settings.platform as PlatformId]?.label ??
                  settings.platform}
              </span>
            )}
            {selectedReciter && (
              <span className="flex items-center gap-1.5 rounded-full border border-gold/20 bg-gold/[0.06] px-3 py-1 text-[13px] text-parchment-muted">
                <MicIcon className="h-3 w-3 shrink-0 text-gold/70" />
                {selectedReciter.englishName}
              </span>
            )}
          </div>
        )}
      </div>

      {/* ══ 1. Platform Picker (MANDATORY) ══════════════════════ */}
      <section>
        <div className="mb-4 flex items-center gap-3">
          <div className="h-px flex-1 bg-gold/10" />
          <span className="flex items-center gap-1.5 text-[13px] font-semibold uppercase tracking-widest text-gold/50">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-gold text-[13px] font-bold text-ink">
              1
            </span>
            {L({ en: "Choose Platform", fr: "Choisir la plateforme", ar: "اختر المنصة" })}
            {!platformChosen && (
              <span className="ml-1 rounded-full bg-gold/15 px-2 py-0.5 text-xs text-gold">
                {L({ en: "required", fr: "requis", ar: "مطلوب" })}
              </span>
            )}
          </span>
          <div className="h-px flex-1 bg-gold/10" />
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" data-tour="platform-cards">
          {(
            Object.entries(PLATFORM_META) as [
              PlatformId,
              (typeof PLATFORM_META)[PlatformId],
            ][]
          ).map(([id, meta]) => {
            const active = settings.platform === id;
            const [encW, encH] = getOutputResolution(
              meta.aspect,
              getDeviceProfile().isLowPower,
            );
            const dimsLabel = `${encW}×${encH}`;
            const [w, h] =
              meta.aspect === "9:16"
                ? [27, 48]
                : meta.aspect === "16:9"
                  ? [48, 27]
                  : [38, 38];
            return (
              <button
                key={id}
                onClick={() => onChange("platform", id)}
                className={`platform-card${active ? " active" : ""} transition-transform duration-200 hover:-translate-y-0.5 active:scale-95`}
              >
                <div
                  className="relative flex items-center justify-center"
                  style={{ height: 56 }}
                >
                  <div
                    className={`flex items-center justify-center rounded-sm border-2 text-[13px] transition-all ${
                      active
                        ? "border-gold bg-gold/20 text-gold"
                        : "border-gold/25 bg-gold/5 text-gold/40"
                    }`}
                    style={{ width: w, height: h }}
                  >
                    <span
                      style={{
                        color: meta.color,
                        opacity: active ? 1 : 0.5,
                      }}
                    >
                      {id === "youtube" ? (
                        <YoutubeLogo className="h-5 w-5" />
                      ) : id === "instagram" ? (
                        <InstagramLogo className="h-5 w-5" />
                      ) : id === "tiktok" ? (
                        <TikTokLogo className="h-5 w-5" />
                      ) : id === "facebook" ? (
                        <FacebookLogo className="h-5 w-5" />
                      ) : (
                        <LandscapeLogo className="h-5 w-5" />
                      )}
                    </span>
                  </div>
                  {active && (
                    <div className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-gold shadow-lg shadow-gold/30">
                      <CheckIcon className="h-2.5 w-2.5 text-ink" />
                    </div>
                  )}
                </div>
                <div className="text-center">
                  <p
                    className={`text-[13px] font-semibold leading-tight ${active ? "text-gold" : "text-parchment"}`}
                  >
                    {meta.label}
                  </p>
                  <p className="mt-0.5 text-[13px] text-parchment-muted/50">
                    {dimsLabel}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {!platformChosen && (
          <p className="mt-3 text-center text-[13px] text-gold/40">
            {L({ en: "← Pick a platform to continue", fr: "← Choisissez une plateforme pour continuer", ar: "← اختر منصة للمتابعة" })}
          </p>
        )}
      </section>

      {/* ══ 2. Reciter + Customise (shown after platform chosen) */}
      <div
        className={`grid gap-6 transition-all duration-300 lg:grid-cols-3 ${!platformChosen ? "pointer-events-none select-none opacity-40" : ""}`}
      >
        {/* ── Col 1: Reciter ────────────────────────────────── */}
        <div className="panel space-y-4 p-5" data-tour="reciter-panel">
          <SectionHead
            icon={<MicIcon className="h-4 w-4 text-gold/60" />}
            step={2}
            label={L({ en: "Reciter", fr: "Récitant", ar: "القارئ" })}
          />

          {recitersLoading ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : (
            <div className="space-y-2">
              {reciters.map((r) => {
                const active = selectedReciter?.identifier === r.identifier;
                return (
                  <button
                    key={r.identifier}
                    onClick={() => onSelectReciter(r)}
                    className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all duration-300 ${
                      active
                        ? "border-gold/50 bg-gold/10 lit-soft"
                        : "border-gold/10 hover:border-gold/30 hover:bg-ink-soft/60"
                    }`}
                  >
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${active ? "border-gold/50 bg-gold/20" : "border-gold/15 bg-gold/5"}`}
                    >
                      <MicIcon className="h-4 w-4 text-gold" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-snug text-parchment">
                        {r.englishName}
                      </p>
                      <p
                        className="text-[13px] leading-snug text-parchment-muted"
                        style={{ fontFamily: "'Amiri', serif" }}
                      >
                        {r.name}
                      </p>
                    </div>
                    {active && (
                      <CheckIcon className="h-4 w-4 shrink-0 text-gold" />
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Audio preview */}
          {canPreviewAudio && (
            <div className="rounded-xl border border-gold/20 bg-ink-soft/50 p-3">
              <div className="flex items-center gap-3">
                <button
                  onClick={onToggleAudio}
                  disabled={audioLoading}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-gold/20 text-gold transition hover:bg-gold/30 active:scale-90 disabled:opacity-50"
                  aria-label={
                    audioPlaying
                      ? L({ en: "Pause audio preview", fr: "Mettre en pause", ar: "إيقاف المعاينة" })
                      : L({ en: "Play audio preview", fr: "Écouter un extrait", ar: "تشغيل المعاينة" })
                  }
                >
                  {audioLoading ? (
                    <Spinner className="h-4 w-4" />
                  ) : audioPlaying ? (
                    <PauseIcon />
                  ) : (
                    <PlayIcon />
                  )}
                </button>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] text-parchment-muted">
                    {audioError ||
                      (audioPlaying
                        ? selectedReciter?.englishName
                        : L({ en: "Preview audio", fr: "Extrait audio", ar: "معاينة الصوت" }))}
                  </p>
                  <div className="mt-1.5 flex h-3 items-end gap-0.5">
                    {audioPlaying ? (
                      [0, 1, 2, 3, 4].map((i) => (
                        <span
                          key={i}
                          className="w-1 animate-pulse rounded-full bg-gold/60"
                          style={{
                            height: `${30 + (i % 3) * 25}%`,
                            animationDelay: `${i * 120}ms`,
                            animationDuration: "900ms",
                          }}
                        />
                      ))
                    ) : (
                      <div className="h-1 w-full rounded-full bg-gold/10" />
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {!selectedReciter && (
            <p className="mt-1 text-center text-[13px] text-gold/40">
              {L({ en: "Select a reciter to continue", fr: "Choisissez un récitant pour continuer", ar: "اختر قارئا للمتابعة" })}
            </p>
          )}
        </div>

        {/* ── Col 2 & 3: Tabbed customisation panel ─────────── */}
        <div className="panel space-y-4 p-5 lg:col-span-2" data-tour="customise-panel">
          <div className="flex items-center justify-between">
            <SectionHead
              icon={<PaletteIcon className="h-4 w-4 text-gold/60" />}
              step={3}
              label={L({ en: "Customise", fr: "Personnaliser", ar: "التخصيص" })}
            />
            <button
              onClick={handleResetCustomization}
              className="flex items-center gap-1.5 rounded-full px-2 py-1 text-[13px] text-parchment-dim transition hover:bg-gold/5 hover:text-gold active:scale-95"
              title={L({ en: "Reset all customisation", fr: "Tout réinitialiser", ar: "إعادة تعيين كل التخصيصات" })}
            >
              <ResetIcon className="h-3 w-3" />
              {L({ en: "Reset", fr: "Réinitialiser", ar: "إعادة تعيين" })}
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 rounded-xl bg-ink-soft/50 p-1">
            {(
              [
                {
                  id: "video",
                  label: L({ en: "Video", fr: "Vidéo", ar: "الفيديو" }),
                  icon: <FilmIcon className="h-3.5 w-3.5" />,
                },
                {
                  id: "text",
                  label: L({ en: "Text", fr: "Texte", ar: "النص" }),
                  icon: <TypeIcon className="h-3.5 w-3.5" />,
                },
                {
                  id: "effects",
                  label: L({ en: "Effects", fr: "Effets", ar: "التأثيرات" }),
                  icon: <SparklesIcon className="h-3.5 w-3.5" />,
                },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2.5 text-[13px] font-medium transition-all ${
                  tab === t.id
                    ? "border border-gold/25 bg-gold/15 text-gold"
                    : "text-parchment-muted hover:text-parchment"
                }`}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>

          {/* Toast */}
          {toast && (
            <div className="animate-step-in rounded-xl border border-gold/30 bg-gold/10 px-3 py-2 text-center text-[13px] text-gold">
              {toast}
            </div>
          )}

          {/* ── TAB: Video ─────────────────────────────────── */}
          {tab === "video" && (
            <div className="animate-step-in space-y-5">
              {/* Background source — two rich cards */}
              <Field label={L({ en: "Background", fr: "Arrière-plan", ar: "نوع الخلفية" })}>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {/* Upload */}
                  <button
                    onClick={() => fileRef.current?.click()}
                    className={`group relative flex items-center gap-4 rounded-2xl border p-4 text-left transition-all duration-300 active:scale-[0.98] ${
                      settings.background === "upload"
                        ? "border-gold/55 bg-gold/[0.08] lit-soft"
                        : "border-gold/15 bg-ink-light/40 hover:-translate-y-0.5 hover:border-gold/35 hover:bg-ink-light/70"
                    }`}
                  >
                    <span
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border transition-colors ${
                        settings.background === "upload"
                          ? "border-gold/60 bg-gold/20 text-gold"
                          : "border-gold/20 bg-gold/[0.06] text-gold/70 group-hover:border-gold/40"
                      }`}
                    >
                      <UploadIcon className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-parchment">
                        {L({ en: "Upload your own", fr: "Votre propre vidéo", ar: "ارفع فيديو خاصا" })}
                      </span>
                      <span className="mt-0.5 block truncate text-[13px] text-parchment-dim">
                        {settings.background === "upload" && uploadedName
                          ? uploadedName
                          : L({ en: "MP4 or MOV · up to 150MB", fr: "MP4 ou MOV · 150 Mo max", ar: "MP4 أو MOV حتى 150 م.ب" })}
                      </span>
                    </span>
                    {settings.background === "upload" && (
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gold shadow-[0_4px_10px_-2px_rgb(var(--gold)/0.6)]">
                        <CheckIcon className="h-3 w-3 text-ink" />
                      </span>
                    )}
                  </button>

                  {/* Library (Pexels) */}
                  <button
                    onClick={() => onChange("background", "pexels")}
                    className={`group relative flex items-center gap-4 rounded-2xl border p-4 text-left transition-all duration-300 active:scale-[0.98] ${
                      settings.background === "pexels"
                        ? "border-gold/55 bg-gold/[0.08] lit-soft"
                        : "border-gold/15 bg-ink-light/40 hover:-translate-y-0.5 hover:border-gold/35 hover:bg-ink-light/70"
                    }`}
                  >
                    <span
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border transition-colors ${
                        settings.background === "pexels"
                          ? "border-gold/60 bg-gold/20 text-gold"
                          : "border-gold/20 bg-gold/[0.06] text-gold/70 group-hover:border-gold/40"
                      }`}
                    >
                      <LibraryIcon className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-parchment">
                        {L({ en: "Library", fr: "Bibliothèque", ar: "المكتبة" })}
                      </span>
                      <span className="mt-0.5 block truncate text-[13px] text-parchment-dim">
                        {playlist.length > 0
                          ? L({ en: `${playlist.length} clip${playlist.length > 1 ? "s" : ""} selected`, fr: `${playlist.length} clip${playlist.length > 1 ? "s" : ""} sélectionné${playlist.length > 1 ? "s" : ""}`, ar: `${playlist.length} مقطع محدد` })
                          : L({ en: "Curated cinematic clips", fr: "Clips cinématiques choisis", ar: "مقاطع سينمائية مختارة" })}
                      </span>
                    </span>
                    {settings.background === "pexels" && (
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gold shadow-[0_4px_10px_-2px_rgb(var(--gold)/0.6)]">
                        <CheckIcon className="h-3 w-3 text-ink" />
                      </span>
                    )}
                  </button>
                </div>

                <input
                  ref={fileRef}
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={onFileUpload}
                />
                {uploadError && (
                  <p className="mt-2 text-[13px] text-red-400">{uploadError}</p>
                )}
                {settings.background === "upload" &&
                  settings.uploadedVideoUrl && (
                    <p className="mt-2 flex items-center gap-1 text-[13px] text-verdant">
                      <CheckIcon className="h-3 w-3" />
                      {L({ en: "Video loaded", fr: "Vidéo chargée", ar: "تم تحميل الفيديو" })}
                    </p>
                  )}
              </Field>

              {/* Library search (Pexels) */}
              {settings.background === "pexels" && (
                <LibrarySearch
                  ar={ar}
                  fr={fr}
                  selected={playlist}
                  onSelect={(url) => togglePlaylist(url)}
                  onRemove={removeFromPlaylist}
                  onClear={clearPlaylist}
                  totalSec={totalDurationSec}
                  locale={locale}
                />
              )}

              {/* ══ Supabase Library (disabled — restore by uncommenting) ══
              {settings.background === "library" && (
                <div className="space-y-2">
                  {videosLoading ? (
                    <div className="flex justify-center py-6">
                      <Spinner className="h-5 w-5 text-gold" />
                    </div>
                  ) : storageVideos.length === 0 ? (
                    <p className="text-[13px] text-parchment-muted/40 py-4 text-center">
                      {ar ? "لا توجد فيديوهات" : "No videos in library"}
                    </p>
                  ) : (
                    <div className="max-h-48 overflow-y-auto custom-scrollbar">
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                        {storageVideos.map((v) => {
                          const idx = playlist.indexOf(v.url);
                          const sel = idx !== -1;
                          return (
                            <button
                              key={v.id}
                              onClick={() => togglePlaylist(v.url)}
                              className={`relative rounded-md overflow-hidden border-2 transition-all aspect-video bg-ink-soft group ${
                                sel
                                  ? "border-gold ring-2 ring-gold/30"
                                  : "border-gold/10 hover:border-gold/30"
                              }`}
                            >
                              <video
                                src={v.url}
                                muted
                                playsInline
                                preload="metadata"
                                className="w-full h-full object-cover"
                                onLoadedData={(e) => {
                                  e.currentTarget.currentTime = 1;
                                }}
                                onMouseEnter={(e) =>
                                  e.currentTarget.play().catch(() => {})
                                }
                                onMouseLeave={(e) => {
                                  e.currentTarget.pause();
                                  e.currentTarget.currentTime = 1;
                                }}
                              />
                              <DurationBadge videoRef={v.url} />
                              {sel && (
                                <>
                                  <div className="absolute inset-0 bg-gold/10" />
                                  <span className="absolute top-1.5 left-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-gold text-[13px] font-bold text-ink shadow">
                                    {idx + 1}
                                  </span>
                                </>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
              ══════════════════════════════════════════════════════════ */}

              {/* Overlay style */}
              <Field label={L({ en: "Overlay Style", fr: "Style de voile", ar: "نوع التظليل" })}>
                <div className="grid grid-cols-3 gap-2">
                  {OVERLAY_PRESETS.map((o) => (
                    <ToggleBtn
                      key={o.id}
                      active={settings.overlayStyle === o.id}
                      onClick={() => onChange("overlayStyle", o.id)}
                    >
                      <OverlayGlyph kind={o.id} />
                      <span className="mt-0.5 block text-[13px]">
                        {o.label}
                      </span>
                    </ToggleBtn>
                  ))}
                </div>
              </Field>

              {/* Background darkness */}
              <Field
                label={`${L({ en: "Darkness", fr: "Obscurité", ar: "تعتيم" })}: ${settings.bgOverlay}%`}
              >
                <input
                  type="range"
                  min={0}
                  max={80}
                  value={settings.bgOverlay}
                  onChange={(e) =>
                    onChange("bgOverlay", parseInt(e.target.value))
                  }
                  className="slider"
                />
              </Field>

              {/* Frame decoration */}
              <Field label={L({ en: "Frame Decoration", fr: "Cadre décoratif", ar: "إطار الفيديو" })}>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {FRAME_STYLES.map((f) => (
                    <ToggleBtn
                      key={f.id}
                      active={settings.frameStyle === f.id}
                      onClick={() => onChange("frameStyle", f.id)}
                    >
                      <FrameGlyph kind={f.id} />
                      <span className="mt-0.5 block text-[13px]">
                        {f.label}
                      </span>
                    </ToggleBtn>
                  ))}
                </div>
              </Field>

              {/* Verse spacing */}
              <Field
                label={`${L({ en: "Pause between verses", fr: "Pause entre versets", ar: "صمت بين الآيات" })}: ${settings.verseSpacing}s`}
              >
                <input
                  type="range"
                  min={0}
                  max={3}
                  step={0.5}
                  value={settings.verseSpacing}
                  onChange={(e) =>
                    onChange("verseSpacing", parseFloat(e.target.value))
                  }
                  className="slider"
                />
                <p className="mt-1 text-[13px] text-parchment-muted/40">
                  {L({
                    en: "Extra seconds of silence after each ayah",
                    fr: "Secondes de silence après chaque ayah",
                    ar: "ثواني إضافية بعد كل آية",
                  })}
                </p>
              </Field>

              {/* Toggles */}
              <div className="grid grid-cols-1 gap-2 pt-1 sm:grid-cols-2">
                {(
                  [
                    {
                      key: "showSurahName",
                      label: L({ en: "Surah Badge", fr: "Badge sourate", ar: "اسم السورة" }),
                    },
                    {
                      key: "showVerseNumber",
                      label: L({ en: "Verse No.", fr: "N° de verset", ar: "رقم الآية" }),
                    },
                    {
                      key: "showTranslation",
                      label: L({ en: "Translation", fr: "Traduction", ar: "الترجمة" }),
                    },
                    {
                      key: "showWatermark",
                      label: L({ en: "Watermark", fr: "Filigrane", ar: "علامة مائية" }),
                    },
                  ] as const
                ).map(({ key, label }) => (
                  <SwitchRow
                    key={key}
                    label={label}
                    value={!!settings[key]}
                    onToggle={() => toggle(key)}
                  />
                ))}
              </div>

              {/* Translation language (only visible when translation enabled) */}
              {settings.showTranslation && (
                <Field label={L({ en: "Translation Language", fr: "Langue de traduction", ar: "لغة الترجمة" })}>
                  <div className="flex gap-2">
                    {[
                      { id: "en", label: "English" },
                      { id: "fr", label: "Français" },
                      { id: "ar", label: "عربي" },
                    ].map((lang) => (
                      <ToggleBtn
                        key={lang.id}
                        active={settings.translationLang === lang.id}
                        onClick={() => onChange("translationLang", lang.id)}
                      >
                        {lang.label}
                      </ToggleBtn>
                    ))}
                  </div>
                </Field>
              )}

              {/* Watermark text */}
              {settings.showWatermark && (
                <Field label={L({ en: "Watermark Text", fr: "Texte du filigrane", ar: "نص العلامة المائية" })}>
                  <input
                    type="text"
                    value={settings.watermarkText}
                    onChange={(e) => onChange("watermarkText", e.target.value)}
                    placeholder="@midhkar"
                    className="w-full rounded-lg border border-gold/20 bg-ink-soft/40 px-3 py-2 text-sm text-parchment placeholder-parchment-dim outline-none transition focus:border-gold/40 focus:ring-1 focus:ring-gold/20"
                  />
                </Field>
              )}
            </div>
          )}

          {/* ── TAB: Text ──────────────────────────────────── */}
          {tab === "text" && (
            <div className="animate-step-in space-y-5">
              {/* Font size */}
              <Field label={L({ en: "Font Size", fr: "Taille du texte", ar: "حجم النص" })}>
                <div className="grid grid-cols-3 gap-2">
                  {(["small", "medium", "large"] as const).map((sz) => (
                    <ToggleBtn
                      key={sz}
                      active={settings.fontSize === sz}
                      onClick={() => onChange("fontSize", sz)}
                    >
                      <span className="capitalize">
                        {sz === "small"
                          ? ar
                            ? "صغير"
                            : "S"
                          : sz === "medium"
                            ? ar
                              ? "متوسط"
                              : "M"
                            : ar
                              ? "كبير"
                              : "L"}
                      </span>
                    </ToggleBtn>
                  ))}
                </div>
              </Field>

              {/* Arabic font */}
              <Field label={L({ en: "Arabic Font", fr: "Police arabe", ar: "الخط العربي" })}>
                <div className="custom-scrollbar grid max-h-56 grid-cols-2 gap-2 overflow-y-auto pr-1">
                  {ARABIC_FONTS.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => onChange("fontFamily", f.family)}
                      className={`font-card${settings.fontFamily === f.family ? " active" : ""} transition-transform duration-200 hover:-translate-y-0.5 active:scale-95`}
                    >
                      <p
                        className="text-lg leading-tight text-parchment"
                        style={{ fontFamily: f.family }}
                      >
                        بِسْمِ اللّٰهِ
                      </p>
                      <p className="mt-1 text-[13px] text-parchment-muted/60">
                        {f.name}
                      </p>
                    </button>
                  ))}
                </div>
              </Field>

              {/* Text position */}
              <Field label={L({ en: "Text Position", fr: "Position du texte", ar: "موضع النص" })}>
                <div className="grid grid-cols-3 gap-2">
                  {TEXT_POSITIONS.map((pos) => (
                    <ToggleBtn
                      key={pos.id}
                      active={settings.textPosition === pos.id}
                      onClick={() => onChange("textPosition", pos.id)}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        className="mx-auto h-5 w-5"
                        aria-hidden="true"
                      >
                        <rect
                          x="4"
                          y="4"
                          width="16"
                          height="16"
                          rx="2"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.2"
                          opacity="0.5"
                        />
                        <rect
                          x="7"
                          y={
                            pos.id === "top"
                              ? 7
                              : pos.id === "center"
                                ? 11
                                : 15
                          }
                          width="10"
                          height="2"
                          rx="1"
                          fill="currentColor"
                        />
                      </svg>
                      <span className="mt-0.5 block text-[13px]">
                        {pos.label}
                      </span>
                    </ToggleBtn>
                  ))}
                </div>
              </Field>

              {/* Text colour */}
              <Field label={L({ en: "Text Color", fr: "Couleur du texte", ar: "لون النص" })}>
                <div className="mb-3 flex flex-wrap gap-2">
                  {TEXT_COLORS.map((c) => (
                    <button
                      key={c.id}
                      title={c.label}
                      onClick={() => onChange("textColor", c.value)}
                      className={`color-swatch${settings.textColor === c.value ? " active" : ""} transition-transform duration-150 hover:scale-125 active:scale-90`}
                      style={{ backgroundColor: c.value }}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={settings.textColor}
                    onChange={(e) => onChange("textColor", e.target.value)}
                    className="h-7 w-10 cursor-pointer rounded border border-gold/20 bg-transparent"
                  />
                  <span className="font-mono text-[13px] text-parchment-muted/50">
                    {settings.textColor}
                  </span>
                </div>
              </Field>

              {/* Text opacity */}
              <Field
                label={`${L({ en: "Text Opacity", fr: "Opacité du texte", ar: "شفافية النص" })}: ${settings.textOpacity}%`}
              >
                <input
                  type="range"
                  min={30}
                  max={100}
                  value={settings.textOpacity}
                  onChange={(e) =>
                    onChange("textOpacity", parseInt(e.target.value))
                  }
                  className="slider"
                />
              </Field>

              {/* Translation section */}
              {settings.showTranslation && (
                <div className="space-y-4 border-t border-gold/10 pt-4">
                  <p className="text-[13px] uppercase tracking-wider text-parchment-muted">
                    {L({ en: "Translation Style", fr: "Style de traduction", ar: "إعدادات الترجمة" })}
                  </p>

                  <Field label={L({ en: "Translation Font", fr: "Police de traduction", ar: "خط الترجمة" })}>
                    <div className="grid grid-cols-2 gap-2">
                      {LATIN_FONTS.map((f) => (
                        <button
                          key={f.id}
                          onClick={() =>
                            onChange("translationFontFamily", f.family)
                          }
                          className={`font-card${settings.translationFontFamily === f.family ? " active" : ""} transition-transform duration-200 hover:-translate-y-0.5 active:scale-95`}
                        >
                          <p
                            className="text-sm text-parchment"
                            style={{ fontFamily: f.family }}
                          >
                            In the name
                          </p>
                          <p className="mt-0.5 text-[13px] text-parchment-muted/60">
                            {f.name}
                          </p>
                        </button>
                      ))}
                    </div>
                  </Field>

                  <Field label={L({ en: "Translation Color", fr: "Couleur de traduction", ar: "لون الترجمة" })}>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={settings.translationColor}
                        onChange={(e) =>
                          onChange("translationColor", e.target.value)
                        }
                        className="h-7 w-10 cursor-pointer rounded border border-gold/20 bg-transparent"
                      />
                      <span className="font-mono text-[13px] text-parchment-muted/50">
                        {settings.translationColor}
                      </span>
                    </div>
                  </Field>

                  <Field
                    label={`${L({ en: "Translation Opacity", fr: "Opacité de traduction", ar: "شفافية الترجمة" })}: ${settings.translationOpacity}%`}
                  >
                    <input
                      type="range"
                      min={20}
                      max={100}
                      value={settings.translationOpacity}
                      onChange={(e) =>
                        onChange("translationOpacity", parseInt(e.target.value))
                      }
                      className="slider"
                    />
                  </Field>
                </div>
              )}
            </div>
          )}

          {/* ── TAB: Effects ───────────────────────────────── */}
          {tab === "effects" && (
            <div className="animate-step-in space-y-5">
              <p className="text-[13px] text-parchment-muted/50">
                {L({
                  en: "Visual effects applied to text and background",
                  fr: "Effets visuels appliqués au texte et au fond",
                  ar: "تأثيرات بصرية تُطبَّع على النص والخلفية",
                })}
              </p>

              {/* Text effects grid */}
              <Field label={L({ en: "Text Effects", fr: "Effets de texte", ar: "تأثيرات النص" })}>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {(
                    [
                      {
                        key: "textShadow",
                        label: L({ en: "Text Shadow", fr: "Ombre du texte", ar: "ظل النص" }),
                        icon: (
                          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                            <path d="M7 17h10M9 13h6" strokeLinecap="round" opacity="0.5" />
                            <path d="M6 9h12" strokeLinecap="round" />
                          </svg>
                        ),
                      },
                      {
                        key: "textGlow",
                        label: L({ en: "Golden Glow", fr: "Halo doré", ar: "توهج ذهبي" }),
                        icon: <SparklesIcon className="h-5 w-5" />,
                      },
                      {
                        key: "textOutline",
                        label: L({ en: "Text Outline", fr: "Contour du texte", ar: "حدود النص" }),
                        icon: (
                          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                            <rect x="5" y="5" width="14" height="14" rx="2" />
                          </svg>
                        ),
                      },
                      {
                        key: "textAnimation" as const,
                        label: L({ en: "Fade In", fr: "Fondu d'entrée", ar: "ظهور تدريجي" }),
                        icon: (
                          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                            <path d="M12 3v3M5.6 5.6l2.1 2.1M3 12h3M18.4 5.6l-2.1 2.1M21 12h-3" strokeLinecap="round" />
                            <path d="M7 17a5 5 0 0110 0" strokeLinecap="round" />
                          </svg>
                        ),
                      },
                    ] as const
                  ).map(({ key, label, icon }) => (
                    <button
                      key={key}
                      onClick={() =>
                        key === "textAnimation"
                          ? onChange(
                              "textAnimation",
                              settings.textAnimation === "fade"
                                ? "none"
                                : "fade",
                            )
                          : toggle(key)
                      }
                      className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-all active:scale-95 ${
                        key === "textAnimation"
                          ? settings.textAnimation !== "none"
                            ? "border-gold/50 bg-gold/10 lit-soft"
                            : "border-gold/10 bg-ink-soft/40 hover:border-gold/30"
                          : settings[key]
                            ? "border-gold/50 bg-gold/10 lit-soft"
                            : "border-gold/10 bg-ink-soft/40 hover:border-gold/30"
                      }`}
                    >
                      <span className="text-gold">{icon}</span>
                      <div>
                        <p className="text-[13px] font-medium text-parchment">
                          {label}
                        </p>
                        <p className="text-[13px] text-parchment-dim">
                          {key === "textAnimation"
                            ? settings.textAnimation !== "none"
                              ? L({ en: "On", fr: "Activé", ar: "مفعّل" })
                              : L({ en: "Off", fr: "Désactivé", ar: "معطّل" })
                            : settings[key]
                              ? L({ en: "On", fr: "Activé", ar: "مفعّل" })
                              : L({ en: "Off", fr: "Désactivé", ar: "معطّل" })}
                        </p>
                      </div>
                      <div className="ml-auto">
                        <div
                          className={`toggle-track${key === "textAnimation" ? (settings.textAnimation !== "none" ? " on" : "") : settings[key] ? " on" : ""}`}
                        >
                          <div className="toggle-thumb" />
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </Field>

              {/* Transition style */}
              <Field label={L({ en: "Verse Transition", fr: "Transition entre versets", ar: "انتقال بين الآيات" })}>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { id: "none" as const, label: L({ en: "None", fr: "Aucune", ar: "بدون" }) },
                    { id: "fade" as const, label: "Fade" },
                    { id: "slide" as const, label: "Slide" },
                    { id: "scale" as const, label: "Scale" },
                  ].map((t) => (
                    <ToggleBtn
                      key={t.id}
                      active={settings.transitionStyle === t.id}
                      onClick={() => onChange("transitionStyle", t.id)}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        className="mx-auto h-5 w-5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.4"
                        aria-hidden="true"
                      >
                        {t.id === "none" && (
                          <path d="M5 12h14" strokeLinecap="round" opacity="0.5" />
                        )}
                        {t.id === "fade" && (
                          <>
                            <circle cx="9" cy="12" r="4" opacity="0.4" />
                            <circle cx="15" cy="12" r="4" />
                          </>
                        )}
                        {t.id === "slide" && (
                          <path d="M4 12h13m0 0l-3.5-3.5M17 12l-3.5 3.5" strokeLinecap="round" strokeLinejoin="round" />
                        )}
                        {t.id === "scale" && (
                          <>
                            <rect x="9" y="9" width="6" height="6" rx="1" opacity="0.4" />
                            <path d="M4 8V4h4M20 8V4h-4M4 16v4h4M20 16v4h-4" strokeLinecap="round" />
                          </>
                        )}
                      </svg>
                      <span className="mt-0.5 block text-[13px]">
                        {t.label}
                      </span>
                    </ToggleBtn>
                  ))}
                </div>
              </Field>

              {/* Text glow colour hint */}
              {settings.textGlow && (
                <div className="rounded-xl border border-gold/20 bg-gold/5 p-3 text-[13px] text-parchment-muted">
                  {L({
                    en: "A soft golden halo is added around the Arabic text.",
                    fr: "Un halo doré est ajouté autour du texte arabe.",
                    ar: "يُضاف هالة ذهبية حول الخط العربي.",
                  })}
                </div>
              )}

              {/* Tips */}
              <div className="space-y-2 rounded-xl border border-gold/15 bg-ink-soft/40 p-4">
                <p className="text-[13px] font-semibold uppercase tracking-wider text-gold/70">
                  {L({ en: "Tips", fr: "Conseils", ar: "نصائح" })}
                </p>
                {[
                  L({
                    en: "Glow + Shadow = classic Islamic aesthetic",
                    fr: "Halo + ombre = esthétique islamique classique",
                    ar: "توهج + ظل = تأثير إسلامي كلاسيكي",
                  }),
                  L({
                    en: "Low darkness + bright footage = clean & striking",
                    fr: "Voile léger + footage lumineux = net et frappant",
                    ar: "تعتيم خفيف مع فيديو مشرق = نظيف ومبهر",
                  }),
                  L({
                    en: "Arch frame works great for YouTube Shorts",
                    fr: "Le cadre en arche convient bien aux YouTube Shorts",
                    ar: "إطار الأقواس يناسب منصة يوتيوب",
                  }),
                ].map((tip, i) => (
                  <p
                    key={i}
                    className="flex items-start gap-2 text-[13px] text-parchment-muted"
                  >
                    <span
                      className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-gold/50"
                      aria-hidden="true"
                    />
                    {tip}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ══ Navigation ══════════════════════════════════════════ */}
      {canProceed && (
        <p className="animate-step-in text-center text-[13px] text-gold/70">
          {L({
            en: "All set — let's create something beautiful!",
            fr: "Tout est prêt — créons quelque chose de magnifique !",
            ar: "كل شيء جاهز — لنبدع!",
          })}
        </p>
      )}

      <div className="flex flex-wrap justify-center gap-4">
        <button onClick={onBack} className="btn-ghost px-6 py-3 text-sm">
          <ArrowIcon className="h-4 w-4 rotate-180" />
          {L({ en: "Back", fr: "Retour", ar: "رجوع" })}
        </button>

        <button
          onClick={onNext}
          disabled={!canProceed}
          className="btn-primary px-8 py-3.5 text-sm"
        >
          {L({ en: "Preview & Generate", fr: "Aperçu & génération", ar: "معاينة وإنتاج" })}
          <ArrowIcon className="h-4 w-4 rtl:rotate-180" />
        </button>
      </div>

      {/* Hint when partially filled */}
      {!canProceed && (platformChosen || selectedReciter) && (
        <p className="text-center text-[13px] text-parchment-muted/40">
          {!platformChosen
            ? L({ en: "Choose a platform first", fr: "Choisissez d'abord une plateforme", ar: "اختر منصة أولا" })
            : L({ en: "Select a reciter to continue", fr: "Choisissez un récitant pour continuer", ar: "اختر قارئا للمتابعة" })}
        </p>
      )}
    </div>
  );
}

/* ── Shared mini-components ──────────────────────────────────── */

function SectionHead({
  icon,
  step,
  label,
}: {
  icon: React.ReactNode;
  step: number;
  label: string;
}) {
  return (
    <div className="mb-1 flex items-center gap-2">
      {icon}
      <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-gold/20 text-xs font-bold text-gold">
        {step}
      </span>
      <h3 className="text-sm uppercase tracking-wider text-gold/60">{label}</h3>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-2 block text-[13px] uppercase tracking-wider text-parchment-muted">
        {label}
      </label>
      {children}
    </div>
  );
}

function ToggleBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded-lg border px-2 py-2.5 text-center text-[13px] transition-all hover:-translate-y-0.5 active:scale-95 ${
        active
          ? "border-gold/40 bg-gold/15 text-gold shadow-sm shadow-gold/10 ring-1 ring-gold/25"
          : "border-gold/10 text-parchment-muted hover:border-gold/25 hover:bg-ink-soft/30"
      }`}
    >
      {children}
    </button>
  );
}

function SwitchRow({
  label,
  value,
  onToggle,
}: {
  label: string;
  value: boolean;
  onToggle: () => void;
}) {
  return (
    <label
      className="group flex cursor-pointer items-center gap-3"
      onClick={onToggle}
    >
      <div className={`toggle-track${value ? " on" : ""}`}>
        <div className="toggle-thumb" />
      </div>
      <span className="text-sm text-parchment-muted transition-colors group-hover:text-parchment">
        {label}
      </span>
    </label>
  );
}

/* ══ Supabase Library (disabled — restore by uncommenting) ══════
function DurationBadge({ videoRef }: { videoRef: string }) {
  const [duration, setDuration] = useState<number | null>(
    () => getCachedVideoDuration(videoRef),
  );

  useEffect(() => {
    if (!videoRef) return;
    const cached = getCachedVideoDuration(videoRef);
    if (cached !== null) { setDuration(cached); return; }
    let alive = true;
    fetchVideoDuration(videoRef).then((d) => {
      if (alive && d !== null) setDuration(d);
    });
    return () => { alive = false; };
  }, [videoRef]);

  if (duration === null) return null;

  const mins = Math.floor(duration / 60);
  const secs = Math.round(duration % 60);
  const label = `${mins}:${secs.toString().padStart(2, "0")}`;

  return (
    <span className="absolute bottom-1.5 right-1.5 rounded bg-black/70 backdrop-blur-sm px-1.5 py-0.5 text-xs font-medium text-parchment/90 pointer-events-none">
      {label}
    </span>
  );
}
══════════════════════════════════════════════════════════════ */
