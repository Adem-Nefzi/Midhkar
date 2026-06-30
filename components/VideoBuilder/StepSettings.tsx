"use client";
/**
 * StepSettings.tsx  —  Step 3: Platform → Reciter → Customise
 *
 * UX changes:
 *  - Platform selection is now MANDATORY and lives at the very top as
 *    large visual cards. "Next" is disabled until a platform is chosen.
 *  - New customisation options: 8 Arabic fonts, 6 Latin fonts, text glow,
 *    text outline, frame decoration styles, verse spacing, solid/gradient bg,
 *    bg gradient controls, overlay style presets, and more.
 *  - Layout: platform picker full-width → then 3-col grid for the rest.
 */

import { useRef, useState, useEffect, useCallback } from "react";
import {
  GeometricRosette,
  CrescentMoonIcon,
  IslamicStarIcon,
  IslamicDivider,
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
import { PLATFORMS, TEXT_POSITIONS, ANIMATED_BG } from "@/lib/quran";
import type { Reciter } from "@/lib/quran";
import type { StorageVideo } from "@/lib/storage-client";
import {
  ARABIC_FONTS,
  LATIN_FONTS,
  PLATFORM_META,
  VideoSettings,
} from "@/lib/types";
import type { PlatformId } from "@/lib/types";

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

/* ── Background colour presets ───────────────────────────────── */
const BG_COLOR_PRESETS = [
  { label: "Deep Night", from: "#09090f", to: "#1a0e00" },
  { label: "Midnight", from: "#0d0d1a", to: "#0a0a0a" },
  { label: "Forest", from: "#0a1a0e", to: "#050d07" },
  { label: "Ocean", from: "#050d1a", to: "#0a0514" },
  { label: "Dusk", from: "#1a0a14", to: "#0d0709" },
  { label: "Sahara", from: "#1a1205", to: "#090907" },
];

/* ── Overlay presets ─────────────────────────────────────────── */
const OVERLAY_PRESETS = [
  { id: "none", label: "None", icon: "○" },
  { id: "linear", label: "Linear", icon: "▽" },
  { id: "radial", label: "Radial", icon: "◎" },
] as const;

/* ── Frame decoration options ────────────────────────────────── */
const FRAME_STYLES = [
  { id: "none", label: "None", preview: "○" },
  { id: "corners", label: "Corners", preview: "⌐" },
  { id: "full", label: "Full", preview: "□" },
  { id: "arch", label: "Arch", preview: "⌒" },
] as const;

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
  storageVideos: StorageVideo[];
  videosLoading: boolean;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  uploadError: string | null;
  onBack: () => void;
  onNext: () => void;
  locale: string;
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
  storageVideos,
  videosLoading,
  onFileUpload,
  uploadError,
  onBack,
  onNext,
  locale,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const toggle = (k: keyof VideoSettings) => onChange(k, !settings[k] as any);

  const platformChosen = !!settings.platform;
  const canProceed = platformChosen && !!selectedReciter;

  /* ── Tabs for the customise panel ────────────────────────── */
  const [tab, setTab] = useState<"video" | "text" | "effects">("video");

  const ar = locale === "ar";

  return (
    <div className="animate-fade-up max-w-6xl mx-auto space-y-8">
      {/* ══ Header ══════════════════════════════════════════════ */}
      <div className="text-center">
        <IslamicDivider className="mb-4" />
        <h2 className="font-display text-3xl font-medium text-parchment sm:text-4xl">
          {ar ? "القارئ والإعدادات" : "Reciter & Settings"}
        </h2>
        <p className="mt-2 text-parchment-muted text-sm">
          {ar
            ? "اختر المنصة أولاً ثم القارئ والتخصيصات"
            : "Choose your platform first, then pick a reciter and customise"}
        </p>
      </div>

      {/* ══ 1. Platform Picker (MANDATORY) ══════════════════════ */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <div className="h-px flex-1 bg-gold/10" />
          <span className="text-xs font-semibold uppercase tracking-widest text-gold/50 flex items-center gap-1.5">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-gold text-ink text-[10px] font-bold">
              1
            </span>
            {ar ? "اختر المنصة" : "Choose Platform"}
            {!platformChosen && (
              <span className="ml-1 rounded-full bg-gold/15 px-2 py-0.5 text-gold text-[9px] animate-pulse-gold">
                {ar ? "مطلوب" : "required"}
              </span>
            )}
          </span>
          <div className="h-px flex-1 bg-gold/10" />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {(
            Object.entries(PLATFORM_META) as [
              PlatformId,
              (typeof PLATFORM_META)[PlatformId],
            ][]
          ).map(([id, meta]) => {
            const active = settings.platform === id;
            // Visual ratio indicator
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
                className={`platform-card${active ? " active" : ""}`}
              >
                {/* Aspect ratio silhouette */}
                <div
                  className="relative flex items-center justify-center"
                  style={{ height: 56 }}
                >
                  <div
                    className={`rounded-sm border-2 flex items-center justify-center text-[10px] transition-all ${
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
                      {id === "youtube" ? <YoutubeLogo className="h-5 w-5" /> :
                       id === "instagram" ? <InstagramLogo className="h-5 w-5" /> :
                       id === "tiktok" ? <TikTokLogo className="h-5 w-5" /> :
                       id === "facebook" ? <FacebookLogo className="h-5 w-5" /> :
                       <LandscapeLogo className="h-5 w-5" />}
                    </span>
                  </div>
                  {active && (
                    <div className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-gold flex items-center justify-center shadow-lg shadow-gold/30">
                      <CheckIcon className="h-2.5 w-2.5 text-ink" />
                    </div>
                  )}
                </div>
                <div className="text-center">
                  <p
                    className={`text-xs font-semibold leading-tight ${active ? "text-gold" : "text-parchment"}`}
                  >
                    {meta.label}
                  </p>
                  <p className="text-[10px] text-parchment-muted/50 mt-0.5">
                    {meta.dims}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {!platformChosen && (
          <p className="text-center text-xs text-gold/40 mt-3">
            {ar ? "← اختر منصة للمتابعة" : "← Pick a platform to continue"}
          </p>
        )}
      </section>

      {/* ══ 2. Reciter + Customise (shown after platform chosen) */}
      <div
        className={`grid gap-6 lg:grid-cols-3 transition-all duration-300 ${!platformChosen ? "opacity-40 pointer-events-none select-none" : ""}`}
      >
        {/* ── Col 1: Reciter ────────────────────────────────── */}
        <div className="kufic-frame p-5 rounded-sm space-y-4">
          <SectionHead
            icon={<GeometricRosette className="h-4 w-4 text-gold/40" />}
            step={2}
            label={ar ? "القارئ" : "Reciter"}
          />

          {recitersLoading ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : (
            <div className="space-y-2 max-h-[360px] overflow-y-auto custom-scrollbar pr-1">
              {reciters.map((r) => {
                const active = selectedReciter?.identifier === r.identifier;
                return (
                  <button
                    key={r.identifier}
                    onClick={() => onSelectReciter(r)}
                    className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-all ${
                      active
                        ? "border-gold/40 bg-gold/10 ring-1 ring-gold/25"
                        : "border-gold/10 hover:border-gold/25 hover:bg-ink-light/40"
                    }`}
                  >
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${active ? "border-gold/40 bg-gold/20" : "border-gold/15 bg-gold/5"}`}
                    >
                      <svg
                        className="h-4 w-4 text-gold"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                        />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-parchment truncate">
                        {r.englishName}
                      </p>
                      <p
                        className="text-xs text-parchment-muted truncate"
                        style={{ fontFamily: "'Amiri', serif" }}
                      >
                        {r.name}
                      </p>
                    </div>
                    {active && (
                      <CheckIcon className="h-4 w-4 text-gold shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Audio preview */}
          {canPreviewAudio && (
            <div className="rounded-lg border border-gold/15 bg-ink-light/30 p-3">
              <div className="flex items-center gap-3">
                <button
                  onClick={onToggleAudio}
                  disabled={audioLoading}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-gold/20 text-gold hover:bg-gold/30 disabled:opacity-50 transition"
                >
                  {audioLoading ? (
                    <Spinner className="h-4 w-4" />
                  ) : audioPlaying ? (
                    <PauseIcon />
                  ) : (
                    <PlayIcon />
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-parchment-muted truncate">
                    {audioError ||
                      (audioPlaying
                        ? `▶ ${selectedReciter?.englishName}`
                        : ar
                          ? "معاينة الصوت"
                          : "Preview audio")}
                  </p>
                  <div className="mt-1 h-1 rounded-full bg-gold/10 overflow-hidden">
                    <div
                      className={`h-full rounded-full bg-gold/40 ${audioPlaying ? "animate-pulse w-full" : "w-0"}`}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Reciter required hint */}
          {!selectedReciter && (
            <p className="text-center text-[11px] text-gold/40 mt-1">
              {ar ? "اختر قارئاً للمتابعة" : "Select a reciter to continue"}
            </p>
          )}
        </div>

        {/* ── Col 2 & 3: Tabbed customisation panel ─────────── */}
        <div className="lg:col-span-2 kufic-frame p-5 rounded-sm space-y-4">
          <SectionHead
            icon={<CrescentMoonIcon className="h-4 w-4 text-gold/40" />}
            step={3}
            label={ar ? "التخصيص" : "Customise"}
          />

          {/* Tabs */}
          <div className="flex gap-1 rounded-lg bg-ink-light/30 p-1">
            {(
              [
                { id: "video", label: ar ? "الفيديو" : "Video" },
                { id: "text", label: ar ? "النص" : "Text" },
                { id: "effects", label: ar ? "التأثيرات" : "Effects" },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex-1 rounded-md py-2 text-xs font-medium transition-all ${
                  tab === t.id
                    ? "bg-gold/15 text-gold shadow-sm border border-gold/20"
                    : "text-parchment-muted hover:text-parchment"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* ── TAB: Video ─────────────────────────────────── */}
          {tab === "video" && (
            <div className="space-y-5 animate-fade-up">
              {/* Background source */}
              <Field label={ar ? "نوع الخلفية" : "Background"}>
                <div className="grid grid-cols-3 gap-2">
                  <ToggleBtn
                    active={settings.background === "color"}
                    onClick={() => onChange("background", "color")}
                  >
                    🎨 {ar ? "لون" : "Color"}
                  </ToggleBtn>
                  <ToggleBtn
                    active={settings.background === "upload"}
                    onClick={() => {
                      onChange("background", "upload");
                      fileRef.current?.click();
                    }}
                  >
                    📁 {ar ? "فيديو" : "Video"}
                  </ToggleBtn>
                  <ToggleBtn
                    active={settings.background === "library"}
                    onClick={() => onChange("background", "library")}
                  >
                    🗂 {ar ? "مكتبة" : "Library"}
                  </ToggleBtn>
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={onFileUpload}
                />
                {uploadError && (
                  <p className="text-xs text-red-400 mt-1">{uploadError}</p>
                )}
                {settings.background === "upload" &&
                  settings.uploadedVideoUrl && (
                    <p className="text-xs text-verdant/70 mt-1">
                      ✓ {ar ? "تم تحميل الفيديو" : "Video loaded"}
                    </p>
                  )}
              </Field>

              {/* Solid / gradient colour bg */}
              {settings.background === "color" && (
                <div className="space-y-3 rounded-lg border border-gold/10 bg-ink-light/20 p-4">
                  <p className="text-xs text-parchment-muted uppercase tracking-wider mb-2">
                    {ar ? "إعدادات اللون" : "Color Settings"}
                  </p>

                  {/* Presets */}
                  <div className="grid grid-cols-3 gap-2">
                    {BG_COLOR_PRESETS.map((p) => (
                      <button
                        key={p.label}
                        onClick={() => {
                          onChange("bgColor", p.from);
                          onChange("bgColorSecondary", p.to);
                        }}
                        className={`rounded-md border px-2 py-2 text-[11px] text-center transition-all ${
                          settings.bgColor === p.from
                            ? "border-gold/40 text-gold bg-gold/10"
                            : "border-gold/10 text-parchment-muted hover:border-gold/20"
                        }`}
                        style={{
                          background: `linear-gradient(135deg, ${p.from}, ${p.to})`,
                        }}
                      >
                        <span className="text-parchment/80 drop-shadow">
                          {p.label}
                        </span>
                      </button>
                    ))}
                  </div>

                  {/* Custom pickers */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-parchment-muted/60 block mb-1">
                        {ar ? "اللون الأول" : "From color"}
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={settings.bgColor}
                          onChange={(e) => onChange("bgColor", e.target.value)}
                          className="h-8 w-10 rounded cursor-pointer border border-gold/20 bg-transparent"
                        />
                        <span className="text-[10px] text-parchment-muted/50 font-mono">
                          {settings.bgColor}
                        </span>
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] text-parchment-muted/60 block mb-1">
                        {ar ? "اللون الثاني" : "To color"}
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={settings.bgColorSecondary}
                          onChange={(e) =>
                            onChange("bgColorSecondary", e.target.value)
                          }
                          className="h-8 w-10 rounded cursor-pointer border border-gold/20 bg-transparent"
                        />
                        <span className="text-[10px] text-parchment-muted/50 font-mono">
                          {settings.bgColorSecondary}
                        </span>
                      </div>
                    </div>
                  </div>

                  <Field
                    label={`${ar ? "زاوية التدرج" : "Gradient angle"}: ${settings.bgGradientAngle}°`}
                  >
                    <input
                      type="range"
                      min={0}
                      max={360}
                      value={settings.bgGradientAngle}
                      onChange={(e) =>
                        onChange("bgGradientAngle", parseInt(e.target.value))
                      }
                      className="slider"
                    />
                  </Field>

                  {/* Live preview strip */}
                  <div
                    className="h-8 rounded-md border border-gold/10"
                    style={{
                      background: `linear-gradient(${settings.bgGradientAngle}deg, ${settings.bgColor}, ${settings.bgColorSecondary})`,
                    }}
                  />
                </div>
              )}

              {/* Video library */}
              {settings.background === "library" && (
                <div className="space-y-2">
                  {videosLoading ? (
                    <div className="flex justify-center py-6">
                      <Spinner className="h-5 w-5 text-gold" />
                    </div>
                  ) : storageVideos.length === 0 ? (
                    <p className="text-xs text-parchment-muted/40 py-4 text-center">
                      {ar ? "لا توجد فيديوهات" : "No videos in library"}
                    </p>
                  ) : (
                    <div className="max-h-48 overflow-y-auto custom-scrollbar">
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                        {storageVideos.map((v) => (
                          <button
                            key={v.id}
                            onClick={() => {
                              onChange("background", "library");
                              onChange("videoUrl", v.url);
                              onChange("videoThumb", "");
                            }}
                            className={`relative rounded-md overflow-hidden border-2 transition-all aspect-video bg-ink-light group ${
                              settings.videoUrl === v.url
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
                            {settings.videoUrl === v.url && (
                              <div className="absolute inset-0 bg-gold/20 flex items-center justify-center">
                                <CheckIcon className="h-4 w-4 text-gold" />
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {settings.videoUrl && (
                    <div className="flex items-center justify-between px-1">
                      <span className="text-[10px] text-gold/40">
                        ✓ {ar ? "فيديو محدد" : "Video selected"}
                      </span>
                      <button
                        onClick={() => {
                          onChange("videoUrl", null);
                          onChange("videoThumb", null);
                        }}
                        className="text-[10px] text-red-400/60 hover:text-red-400 transition"
                      >
                        {ar ? "إزالة" : "Remove"}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Overlay style */}
              <Field label={ar ? "نوع التظليل" : "Overlay Style"}>
                <div className="grid grid-cols-3 gap-2">
                  {OVERLAY_PRESETS.map((o) => (
                    <ToggleBtn
                      key={o.id}
                      active={settings.overlayStyle === o.id}
                      onClick={() => onChange("overlayStyle", o.id)}
                    >
                      <span className="text-base">{o.icon}</span>
                      <span className="block text-[10px] mt-0.5">
                        {o.label}
                      </span>
                    </ToggleBtn>
                  ))}
                </div>
              </Field>

              {/* Background darkness */}
              <Field
                label={`${ar ? "تعتيم" : "Darkness"}: ${settings.bgOverlay}%`}
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
              <Field label={ar ? "إطار الفيديو" : "Frame Decoration"}>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {FRAME_STYLES.map((f) => (
                    <ToggleBtn
                      key={f.id}
                      active={settings.frameStyle === f.id}
                      onClick={() => onChange("frameStyle", f.id)}
                    >
                      <span className="text-lg">{f.preview}</span>
                      <span className="block text-[10px] mt-0.5">
                        {f.label}
                      </span>
                    </ToggleBtn>
                  ))}
                </div>
              </Field>

              {/* Verse spacing */}
              <Field
                label={`${ar ? "صمت بين الآيات" : "Pause between verses"}: ${settings.verseSpacing}s`}
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
                <p className="text-[10px] text-parchment-muted/40 mt-1">
                  {ar
                    ? "ثواني إضافية بعد كل آية"
                    : "Extra seconds of silence after each ayah"}
                </p>
              </Field>

              {/* Toggles */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                {(
                  [
                    {
                      key: "showSurahName",
                      label: ar ? "اسم السورة" : "Surah Badge",
                    },
                    {
                      key: "showVerseNumber",
                      label: ar ? "رقم الآية" : "Verse No.",
                    },
                    {
                      key: "showTranslation",
                      label: ar ? "الترجمة" : "Translation",
                    },
                    {
                      key: "showWatermark",
                      label: ar ? "علامة مائية" : "Watermark",
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
                <Field label={ar ? "لغة الترجمة" : "Translation Language"}>
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
                <Field label={ar ? "نص العلامة المائية" : "Watermark Text"}>
                  <input
                    type="text"
                    value={settings.watermarkText}
                    onChange={(e) => onChange("watermarkText", e.target.value)}
                    placeholder="@midhkar"
                    className="w-full rounded-lg border border-gold/20 bg-ink-light/40 px-3 py-2 text-sm text-parchment placeholder-parchment-muted/30 outline-none focus:border-gold/40 focus:ring-1 focus:ring-gold/20 transition"
                  />
                </Field>
              )}
            </div>
          )}

          {/* ── TAB: Text ──────────────────────────────────── */}
          {tab === "text" && (
            <div className="space-y-5 animate-fade-up">
              {/* Font size */}
              <Field label={ar ? "حجم النص" : "Font Size"}>
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
              <Field label={ar ? "الخط العربي" : "Arabic Font"}>
                <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto custom-scrollbar pr-1">
                  {ARABIC_FONTS.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => onChange("fontFamily", f.family)}
                      className={`font-card${settings.fontFamily === f.family ? " active" : ""}`}
                    >
                      <p
                        className="text-lg leading-tight text-parchment"
                        style={{ fontFamily: f.family }}
                      >
                        بِسْمِ اللّٰهِ
                      </p>
                      <p className="text-[10px] text-parchment-muted/60 mt-1">
                        {f.name}
                      </p>
                    </button>
                  ))}
                </div>
              </Field>

              {/* Text position */}
              <Field label={ar ? "موضع النص" : "Text Position"}>
                <div className="grid grid-cols-3 gap-2">
                  {TEXT_POSITIONS.map((pos) => (
                    <ToggleBtn
                      key={pos.id}
                      active={settings.textPosition === pos.id}
                      onClick={() => onChange("textPosition", pos.id)}
                    >
                      {pos.id === "top"
                        ? "⬆ "
                        : pos.id === "center"
                          ? "◉ "
                          : "⬇ "}
                      {pos.label}
                    </ToggleBtn>
                  ))}
                </div>
              </Field>

              {/* Text colour */}
              <Field label={ar ? "لون النص" : "Text Color"}>
                <div className="flex flex-wrap gap-2 mb-3">
                  {TEXT_COLORS.map((c) => (
                    <button
                      key={c.id}
                      title={c.label}
                      onClick={() => onChange("textColor", c.value)}
                      className={`color-swatch${settings.textColor === c.value ? " active" : ""}`}
                      style={{ backgroundColor: c.value }}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={settings.textColor}
                    onChange={(e) => onChange("textColor", e.target.value)}
                    className="h-7 w-10 rounded cursor-pointer border border-gold/20 bg-transparent"
                  />
                  <span className="text-[10px] text-parchment-muted/50 font-mono">
                    {settings.textColor}
                  </span>
                </div>
              </Field>

              {/* Text opacity */}
              <Field
                label={`${ar ? "شفافية النص" : "Text Opacity"}: ${settings.textOpacity}%`}
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
                <div className="border-t border-gold/10 pt-4 space-y-4">
                  <p className="text-xs text-parchment-muted uppercase tracking-wider">
                    {ar ? "إعدادات الترجمة" : "Translation Style"}
                  </p>

                  <Field label={ar ? "خط الترجمة" : "Translation Font"}>
                    <div className="grid grid-cols-2 gap-2">
                      {LATIN_FONTS.map((f) => (
                        <button
                          key={f.id}
                          onClick={() =>
                            onChange("translationFontFamily", f.family)
                          }
                          className={`font-card${settings.translationFontFamily === f.family ? " active" : ""}`}
                        >
                          <p
                            className="text-sm text-parchment"
                            style={{ fontFamily: f.family }}
                          >
                            In the name
                          </p>
                          <p className="text-[10px] text-parchment-muted/60 mt-0.5">
                            {f.name}
                          </p>
                        </button>
                      ))}
                    </div>
                  </Field>

                  <Field label={ar ? "لون الترجمة" : "Translation Color"}>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={settings.translationColor}
                        onChange={(e) =>
                          onChange("translationColor", e.target.value)
                        }
                        className="h-7 w-10 rounded cursor-pointer border border-gold/20 bg-transparent"
                      />
                      <span className="text-[10px] text-parchment-muted/50 font-mono">
                        {settings.translationColor}
                      </span>
                    </div>
                  </Field>

                  <Field
                    label={`${ar ? "شفافية الترجمة" : "Translation Opacity"}: ${settings.translationOpacity}%`}
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
            <div className="space-y-5 animate-fade-up">
              <p className="text-xs text-parchment-muted/50">
                {ar
                  ? "تأثيرات بصرية تُطبَّق على النص والخلفية"
                  : "Visual effects applied to text and background"}
              </p>

              {/* Text effects grid */}
              <Field label={ar ? "تأثيرات النص" : "Text Effects"}>
                <div className="grid grid-cols-2 gap-3">
                  {(
                    [
                      {
                        key: "textShadow",
                        label: ar ? "ظل النص" : "Text Shadow",
                        emoji: "🌑",
                      },
                      {
                        key: "textGlow",
                        label: ar ? "توهج ذهبي" : "Golden Glow",
                        emoji: "✨",
                      },
                      {
                        key: "textOutline",
                        label: ar ? "حدود النص" : "Text Outline",
                        emoji: "◻",
                      },
                      {
                        key: "textAnimation" as const,
                        label: ar ? "ظهور تدريجي" : "Fade In",
                        emoji: "🌅",
                      },
                    ] as const
                  ).map(({ key, label, emoji }) => (
                    <button
                      key={key}
                      onClick={() =>
                        key === "textAnimation"
                          ? onChange("textAnimation", settings.textAnimation === "fade" ? "none" : "fade")
                          : toggle(key)
                      }
                      className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-all ${
                        key === "textAnimation"
                          ? settings.textAnimation !== "none"
                            ? "border-gold/40 bg-gold/10 ring-1 ring-gold/20"
                            : "border-gold/10 hover:border-gold/20 bg-ink-light/20"
                          : settings[key]
                            ? "border-gold/40 bg-gold/10 ring-1 ring-gold/20"
                            : "border-gold/10 hover:border-gold/20 bg-ink-light/20"
                      }`}
                    >
                      <span className="text-xl">{emoji}</span>
                      <div>
                        <p className="text-xs font-medium text-parchment">
                          {label}
                        </p>
                        <p className="text-[10px] text-parchment-muted/40">
                          {key === "textAnimation"
                            ? settings.textAnimation !== "none"
                              ? ar ? "مفعّل" : "On"
                              : ar ? "معطّل" : "Off"
                            : settings[key]
                              ? ar ? "مفعّل" : "On"
                              : ar ? "معطّل" : "Off"}
                        </p>
                      </div>
                      <div className="ml-auto">
                        <div
                          className={`toggle-track${key === "textAnimation" ? settings.textAnimation !== "none" ? " on" : "" : settings[key] ? " on" : ""}`}
                        >
                          <div className="toggle-thumb" />
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </Field>

              {/* Text glow colour hint */}
              {settings.textGlow && (
                <div className="rounded-lg border border-gold/15 bg-gold/5 p-3 text-xs text-parchment-muted/60">
                  💡{" "}
                  {ar
                    ? "يُضاف هالة ذهبية حول الخط العربي."
                    : "A soft golden halo is added around the Arabic text."}
                </div>
              )}

              {/* More visual toggles */}
              <Field label={ar ? "إعدادات إضافية" : "More Options"}>
                <div className="space-y-2">
                  {(
                    [
                      {
                        key: "showSurahName",
                        label: ar ? "شارة السورة" : "Surah Name Badge",
                        emoji: "🏷",
                      },
                      {
                        key: "showVerseNumber",
                        label: ar ? "رقم الآية" : "Verse Number",
                        emoji: "#",
                      },
                    ] as const
                  ).map(({ key, label, emoji }) => (
                    <SwitchRow
                      key={key}
                      label={`${emoji} ${label}`}
                      value={!!settings[key]}
                      onToggle={() => toggle(key)}
                    />
                  ))}
                </div>
              </Field>

              {/* Fun tips */}
              <div className="rounded-lg border border-gold/10 bg-ink-light/20 p-4 space-y-2">
                <p className="text-xs font-semibold text-gold/60 uppercase tracking-wider">
                  {ar ? "نصائح" : "Tips"}
                </p>
                {[
                  ar
                    ? "توهج + ظل = تأثير إسلامي كلاسيكي"
                    : "Glow + Shadow = classic Islamic aesthetic",
                  ar
                    ? "إيقاف التظليل مع خلفية داكنة = نظيف ومبهر"
                    : "No overlay + dark gradient bg = clean & striking",
                  ar
                    ? "إطار الأقواس يناسب منصة يوتيوب"
                    : "Arch frame works great for YouTube Shorts",
                ].map((tip, i) => (
                  <p
                    key={i}
                    className="text-[11px] text-parchment-muted/50 flex items-start gap-1.5"
                  >
                    <span className="text-gold/30 mt-px">◆</span> {tip}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ══ Navigation ══════════════════════════════════════════ */}
      <div className="flex justify-center gap-4 flex-wrap">
        <button
          onClick={onBack}
          className="rounded-full border border-parchment/20 px-6 py-3 text-sm text-parchment hover:border-gold/40 hover:text-gold flex items-center gap-2 transition"
        >
          <IslamicStarIcon className="h-3 w-3 rotate-180" />
          {ar ? "رجوع" : "Back"}
        </button>

        <button
          onClick={onNext}
          disabled={!canProceed}
          className="group relative overflow-hidden rounded-full bg-gold px-8 py-3.5 text-sm font-semibold text-ink hover:-translate-y-0.5 hover:shadow-xl hover:shadow-gold/20 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:translate-y-0 transition-all duration-200 flex items-center gap-2"
        >
          <span className="absolute inset-0 -translate-x-full bg-parchment/30 transition-transform duration-700 group-hover:translate-x-full" />
          <span className="relative flex items-center gap-2">
            {ar ? "معاينة وإنتاج" : "Preview & Generate"}
            <IslamicStarIcon className="h-4 w-4 transition-transform group-hover:rotate-45" />
          </span>
        </button>
      </div>

      {/* Hint when partially filled */}
      {!canProceed && (platformChosen || selectedReciter) && (
        <p className="text-center text-xs text-parchment-muted/40">
          {!platformChosen
            ? ar
              ? "اختر منصة أولاً"
              : "Choose a platform first"
            : ar
              ? "اختر قارئاً للمتابعة"
              : "Select a reciter to continue"}
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
    <div className="flex items-center gap-2 mb-1">
      {icon}
      <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-gold/20 text-gold text-[9px] font-bold">
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
      <label className="text-xs text-parchment-muted mb-2 block uppercase tracking-wider">
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
      className={`flex-1 rounded-lg border py-2.5 px-2 text-xs transition-all text-center ${
        active
          ? "border-gold/40 bg-gold/15 text-gold ring-1 ring-gold/25 shadow-sm shadow-gold/10"
          : "border-gold/10 text-parchment-muted hover:border-gold/25 hover:bg-ink-light/30"
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
      className="flex items-center gap-3 cursor-pointer group"
      onClick={onToggle}
    >
      <div className={`toggle-track${value ? " on" : ""}`}>
        <div className="toggle-thumb" />
      </div>
      <span className="text-sm text-parchment-muted group-hover:text-parchment transition-colors">
        {label}
      </span>
    </label>
  );
}
