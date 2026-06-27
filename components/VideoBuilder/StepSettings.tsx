"use client";
/**
 * StepSettings.tsx  —  Step 3: reciter + video settings
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
} from "./icons";
import {
  PLATFORMS,
  TEXT_POSITIONS,
  TEXT_COLORS,
  ANIMATED_BG,
} from "@/lib/quran";
import type { Reciter } from "@/lib/quran";
import type { StorageVideo } from "@/lib/storage-client";
import { FONTS, VideoSettings } from "@/lib/types";

interface Props {
  settings: VideoSettings;
  onChange: <K extends keyof VideoSettings>(k: K, v: VideoSettings[K]) => void;
  reciters: Reciter[];
  recitersLoading: boolean;
  selectedReciter: Reciter | null;
  onSelectReciter: (r: Reciter) => void;
  // Audio preview
  audioPlaying: boolean;
  audioLoading: boolean;
  audioError: string | null;
  onToggleAudio: () => void;
  canPreviewAudio: boolean;
  // Storage videos
  storageVideos: StorageVideo[];
  videosLoading: boolean;
  // Upload
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  uploadError: string | null;
  // Nav
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

  return (
    <div className="animate-fade-up max-w-6xl mx-auto">
      {/* Header */}
      <div className="text-center mb-10">
        <IslamicDivider className="mb-4" />
        <h2 className="font-display text-3xl font-medium text-parchment sm:text-4xl">
          {locale === "ar" ? "القارئ والإعدادات" : "Reciter & Settings"}
        </h2>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* ── Col 1: Reciter ────────────────────────────────── */}
        <div className="kufic-frame p-5 rounded-sm space-y-4">
          <div className="flex items-center gap-2">
            <GeometricRosette className="h-4 w-4 text-gold/40" />
            <h3 className="text-sm uppercase tracking-wider text-gold/60">
              {locale === "ar" ? "القارئ" : "Reciter"}
            </h3>
          </div>

          {recitersLoading ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : (
            <div className="space-y-2 max-h-[340px] overflow-y-auto custom-scrollbar pr-1">
              {reciters.map((r) => {
                const active = selectedReciter?.identifier === r.identifier;
                return (
                  <button
                    key={r.identifier}
                    onClick={() => onSelectReciter(r)}
                    className={`flex w-full items-center gap-3 rounded-sm border p-3 text-left transition-all ${
                      active
                        ? "border-gold/40 bg-gold/10 ring-1 ring-gold/30"
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
                      <p className="text-xs text-parchment-muted truncate">
                        {r.name}
                      </p>
                    </div>
                    {active && (
                      <CheckIcon className="h-5 w-5 text-gold shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Audio preview */}
          {canPreviewAudio && (
            <div className="rounded-sm border border-gold/15 bg-ink-light/30 p-3">
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
                        : locale === "ar"
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
        </div>

        {/* ── Col 2: Video settings ─────────────────────────── */}
        <div className="kufic-frame p-5 rounded-sm space-y-5">
          <div className="flex items-center gap-2">
            <CrescentMoonIcon className="h-4 w-4 text-gold/40" />
            <h3 className="text-sm uppercase tracking-wider text-gold/60">
              {locale === "ar" ? "إعدادات الفيديو" : "Video Settings"}
            </h3>
          </div>

          {/* Platform */}
          <Field label={locale === "ar" ? "المنصة" : "Platform"}>
            <div className="grid grid-cols-2 gap-2">
              {PLATFORMS.map((p) => (
                <ToggleBtn
                  key={p.id}
                  active={settings.platform === p.id}
                  onClick={() => onChange("platform", p.id)}
                >
                  {p.label}{" "}
                  <span className="text-[10px] opacity-50">{p.aspect}</span>
                </ToggleBtn>
              ))}
            </div>
          </Field>

          {/* Animated backgrounds */}
          <Field label={locale === "ar" ? "الخلفية" : "Background"}>
            <div className="grid grid-cols-3 gap-2">
              {ANIMATED_BG.filter(
                (b) => b.id !== "upload" && b.id !== "library",
              ).map((bg) => (
                <ToggleBtn
                  key={bg.id}
                  active={settings.background === bg.id}
                  onClick={() => onChange("background", bg.id)}
                >
                  {bg.label}
                </ToggleBtn>
              ))}
              <ToggleBtn
                active={settings.background === "upload"}
                onClick={() => {
                  onChange("background", "upload");
                  fileRef.current?.click();
                }}
              >
                {locale === "ar" ? "رفع ↑" : "Upload ↑"}
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
            {settings.background === "upload" && settings.uploadedVideoUrl && (
              <p className="text-xs text-verdant/70 mt-1">✓ Video loaded</p>
            )}
          </Field>

          {/* Video library */}
          <Field label={locale === "ar" ? "مكتبة الخلفيات" : "Video Library"}>
            {videosLoading ? (
              <div className="flex justify-center py-6">
                <Spinner className="h-5 w-5 text-gold" />
              </div>
            ) : storageVideos.length === 0 ? (
              <p className="text-xs text-parchment-muted/40 py-4 text-center">
                {locale === "ar" ? "لا توجد فيديوهات" : "No videos found in storage"}
              </p>
            ) : (
              <div className="max-h-[320px] overflow-y-auto custom-scrollbar pr-1">
                <div className="grid grid-cols-3 gap-2">
                  {storageVideos.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => {
                        onChange("background", "library");
                        onChange("videoUrl", v.url);
                        onChange("videoThumb", "");
                      }}
                      className={`relative rounded-sm overflow-hidden border-2 transition-all duration-200 aspect-video bg-ink-light group ${
                        settings.videoUrl === v.url
                          ? "border-gold ring-2 ring-gold/40 shadow-lg shadow-gold/10"
                          : "border-gold/10 hover:border-gold/30 hover:ring-1 hover:ring-gold/20"
                      }`}
                    >
                      <video
                        src={v.url}
                        muted
                        playsInline
                        preload="metadata"
                        crossOrigin="anonymous"
                        className="w-full h-full object-cover"
                        onLoadedData={(e) => { e.currentTarget.currentTime = 1; }}
                        onMouseEnter={(e) => e.currentTarget.play().catch(() => {})}
                        onMouseLeave={(e) => { e.currentTarget.pause(); e.currentTarget.currentTime = 1; }}
                      />
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
                        <div className="h-8 w-8 rounded-full bg-gold/30 backdrop-blur-sm flex items-center justify-center">
                          <PlayIcon className="h-4 w-4 text-parchment" />
                        </div>
                      </div>
                      {settings.videoUrl === v.url && (
                        <div className="absolute inset-0 bg-gold/20 flex items-center justify-center">
                          <div className="h-7 w-7 rounded-full bg-gold flex items-center justify-center shadow-lg">
                            <CheckIcon className="h-4 w-4 text-ink" />
                          </div>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </Field>

          {/* Selected video preview */}
          {settings.videoUrl && (
            <div className="rounded-sm border border-gold/25 bg-ink/50 overflow-hidden">
              <div className="flex items-center justify-between px-3 py-1.5 border-b border-gold/10">
                <span className="text-[10px] text-gold/50 font-medium">
                  {locale === "ar" ? "معاينة" : "Preview"}
                </span>
                <button
                  onClick={() => { onChange("videoUrl", null); onChange("videoThumb", null); }}
                  className="text-[10px] text-parchment-muted/40 hover:text-red-400 transition-colors"
                >
                  {locale === "ar" ? "إزالة" : "Remove"}
                </button>
              </div>
              <VideoPreviewPlayer url={settings.videoUrl} />
            </div>
          )}

          {/* Darkness overlay */}
          <Field
            label={
              locale === "ar"
                ? "تعتيم الخلفية"
                : `Background Darkness: ${settings.bgOverlay}%`
            }
          >
            <input
              type="range"
              min={0}
              max={80}
              value={settings.bgOverlay}
              onChange={(e) => onChange("bgOverlay", parseInt(e.target.value))}
              className="w-full h-2 appearance-none rounded-full bg-gold/20 accent-gold cursor-pointer"
            />
          </Field>

          {/* Translation language */}
          <Field
            label={locale === "ar" ? "لغة الترجمة" : "Translation Language"}
          >
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

          {/* Toggles */}
          {[
            {
              key: "showTranslation" as const,
              label: locale === "ar" ? "إظهار الترجمة" : "Show Translation",
            },
            {
              key: "showSurahName" as const,
              label: locale === "ar" ? "اسم السورة" : "Surah Name Badge",
            },
            {
              key: "showVerseNumber" as const,
              label: locale === "ar" ? "رقم الآية" : "Verse Number",
            },
            {
              key: "textShadow" as const,
              label: locale === "ar" ? "ظل النص" : "Text Shadow",
            },
          ].map(({ key, label }) => (
            <SwitchRow
              key={key}
              label={label}
              value={!!settings[key]}
              onToggle={() => toggle(key)}
            />
          ))}
        </div>

        {/* ── Col 3: Text style ─────────────────────────────── */}
        <div className="kufic-frame p-5 rounded-sm space-y-5">
          <div className="flex items-center gap-2">
            <IslamicStarIcon className="h-4 w-4 text-gold/40" />
            <h3 className="text-sm uppercase tracking-wider text-gold/60">
              {locale === "ar" ? "تنسيق النص" : "Text Style"}
            </h3>
          </div>

          {/* Font size */}
          <Field label={locale === "ar" ? "حجم النص" : "Font Size"}>
            <div className="flex gap-2">
              {(["small", "medium", "large"] as const).map((sz) => (
                <ToggleBtn
                  key={sz}
                  active={settings.fontSize === sz}
                  onClick={() => onChange("fontSize", sz)}
                >
                  <span className="capitalize">{sz}</span>
                </ToggleBtn>
              ))}
            </div>
          </Field>

          {/* Arabic font */}
          <Field label={locale === "ar" ? "الخط العربي" : "Arabic Font"}>
            <div className="grid grid-cols-2 gap-1.5">
              {FONTS.map((f) => (
                <ToggleBtn
                  key={f.id}
                  active={settings.fontFamily === f.family}
                  onClick={() => onChange("fontFamily", f.family)}
                >
                  <span style={{ fontFamily: f.family }}>{f.name}</span>
                </ToggleBtn>
              ))}
            </div>
          </Field>

          {/* Text color */}
          <Field label={locale === "ar" ? "لون النص" : "Text Color"}>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {TEXT_COLORS.map((c) => (
                <button
                  key={c.id}
                  onClick={() => onChange("textColor", c.value)}
                  className={`flex items-center gap-1.5 rounded-sm border px-2 py-1.5 text-[11px] transition-all ${settings.textColor === c.value ? "border-gold/40 bg-gold/15 text-gold ring-1 ring-gold/30" : "border-gold/10 text-parchment-muted hover:border-gold/25"}`}
                >
                  <span
                    className="h-3 w-3 rounded-full border border-parchment/20"
                    style={{ backgroundColor: c.value }}
                  />
                  {c.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={settings.textColor}
                onChange={(e) => onChange("textColor", e.target.value)}
                className="h-7 w-10 rounded cursor-pointer border border-gold/20 bg-transparent"
              />
              <span className="text-[10px] text-parchment-muted/60 font-mono">
                {settings.textColor}
              </span>
            </div>
          </Field>

          {/* Text opacity */}
          <Field
            label={
              locale === "ar"
                ? "شفافية النص"
                : `Text Opacity: ${settings.textOpacity}%`
            }
          >
            <input
              type="range"
              min={30}
              max={100}
              value={settings.textOpacity}
              onChange={(e) =>
                onChange("textOpacity", parseInt(e.target.value))
              }
              className="w-full h-2 appearance-none rounded-full bg-gold/20 accent-gold cursor-pointer"
            />
          </Field>

          {/* Text position */}
          <Field label={locale === "ar" ? "موضع النص" : "Text Position"}>
            <div className="grid grid-cols-3 gap-1.5">
              {TEXT_POSITIONS.map((pos) => (
                <ToggleBtn
                  key={pos.id}
                  active={settings.textPosition === pos.id}
                  onClick={() => onChange("textPosition", pos.id)}
                >
                  {pos.label}
                </ToggleBtn>
              ))}
            </div>
          </Field>

          {/* Translation style */}
          <div className="border-t border-gold/10 pt-4 space-y-3">
            <p className="text-xs text-parchment-muted uppercase tracking-wider">
              {locale === "ar" ? "إعدادات الترجمة" : "Translation Style"}
            </p>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={settings.translationColor}
                onChange={(e) => onChange("translationColor", e.target.value)}
                className="h-6 w-8 rounded cursor-pointer border border-gold/20 bg-transparent"
              />
              <span className="text-xs text-parchment-muted">
                {locale === "ar" ? "اللون" : "Color"}
              </span>
              <span className="text-[10px] text-parchment-muted/50 font-mono">
                {settings.translationColor}
              </span>
            </div>
            <Field
              label={
                locale === "ar"
                  ? `شفافية: ${settings.translationOpacity}%`
                  : `Opacity: ${settings.translationOpacity}%`
              }
            >
              <input
                type="range"
                min={20}
                max={100}
                value={settings.translationOpacity}
                onChange={(e) =>
                  onChange("translationOpacity", parseInt(e.target.value))
                }
                className="w-full h-2 appearance-none rounded-full bg-gold/20 accent-gold cursor-pointer"
              />
            </Field>
            <Field label={locale === "ar" ? "خط الترجمة" : "Translation Font"}>
              <div className="grid grid-cols-2 gap-1.5">
                {FONTS.map((f) => (
                  <ToggleBtn
                    key={f.id}
                    active={settings.translationFontFamily === f.family}
                    onClick={() => onChange("translationFontFamily", f.family)}
                  >
                    <span style={{ fontFamily: f.family }}>{f.name}</span>
                  </ToggleBtn>
                ))}
              </div>
            </Field>
          </div>
        </div>
      </div>

      {/* Nav */}
      <div className="mt-10 flex justify-center gap-4">
        <button
          onClick={onBack}
          className="rounded-full border border-parchment/20 px-6 py-3 text-sm text-parchment hover:border-gold/40 hover:text-gold flex items-center gap-2 transition"
        >
          <IslamicStarIcon className="h-3 w-3 rotate-180" />{" "}
          {locale === "ar" ? "رجوع" : "Back"}
        </button>
        <button
          onClick={onNext}
          disabled={!selectedReciter}
          className="group relative overflow-hidden rounded-full bg-gold px-8 py-3.5 text-sm font-semibold text-ink hover:-translate-y-0.5 hover:shadow-xl hover:shadow-gold/20 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none transition-all duration-200 flex items-center gap-2"
        >
          <span className="absolute inset-0 -translate-x-full bg-parchment/30 transition-transform duration-700 group-hover:translate-x-full" />
          <span className="relative flex items-center gap-2">
            {locale === "ar" ? "معاينة وإنتاج" : "Preview & Generate"}
            <IslamicStarIcon className="h-4 w-4 transition-transform group-hover:rotate-45" />
          </span>
        </button>
      </div>
    </div>
  );
}

/* ── Small sub-components ──────────────────────────────────────── */

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
      className={`flex-1 rounded-sm border py-2 px-2 text-xs transition-all text-center ${
        active
          ? "border-gold/40 bg-gold/15 text-gold ring-1 ring-gold/30"
          : "border-gold/10 text-parchment-muted hover:border-gold/25"
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
      className="flex items-center gap-3 cursor-pointer"
      onClick={onToggle}
    >
      <div
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${value ? "bg-gold/40" : "bg-parchment/10"}`}
      >
        <div
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-parchment transition-transform ${value ? "translate-x-4" : "translate-x-0.5"}`}
        />
      </div>
      <span className="text-sm text-parchment-muted">{label}</span>
    </label>
  );
}

function VideoPreviewPlayer({ url }: { url: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    setPlaying(false);
    setProgress(0);
  }, [url]);

  const togglePlay = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) {
      el.play().then(() => setPlaying(true)).catch(() => {});
    } else {
      el.pause();
      setPlaying(false);
    }
  }, []);

  const handleTimeUpdate = useCallback(() => {
    const el = videoRef.current;
    if (el && el.duration) {
      setProgress((el.currentTime / el.duration) * 100);
    }
  }, []);

  return (
    <div className="relative group">
      <video
        ref={videoRef}
        src={url}
        muted
        loop
        playsInline
        className="w-full aspect-video object-cover"
        onTimeUpdate={handleTimeUpdate}
        onEnded={() => setPlaying(false)}
      />
      <div
        className="absolute inset-0 flex items-center justify-center cursor-pointer bg-black/20 group-hover:bg-black/30 transition-colors"
        onClick={togglePlay}
      >
        <div className="h-10 w-10 rounded-full bg-gold/30 backdrop-blur-sm flex items-center justify-center hover:bg-gold/50 transition-colors">
          {playing ? (
            <PauseIcon className="h-5 w-5 text-parchment" />
          ) : (
            <PlayIcon className="h-5 w-5 text-parchment ml-0.5" />
          )}
        </div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/30">
        <div
          className="h-full bg-gold/80 transition-all duration-200"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
