"use client";
/**
 * StepSettings.tsx  —  Step 3: reciter + video settings
 */

import { useRef } from "react";
import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
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
import { IMAGEKIT_CATEGORIES } from "@/lib/imagekit-client";
import type { Reciter } from "@/lib/quran";
import type { ImageKitFile } from "@/lib/imagekit-client";
import { FONTS, VideoSettings } from "@/lib/types";

interface Props {
  settings: VideoSettings;
  onChange: <K extends keyof VideoSettings>(k: K, v: VideoSettings[K]) => void;
  reciters: Reciter[];
  recitersLoading: boolean;
  selectedReciter: Reciter | null;
  onSelectReciter: (r: Reciter) => void;
  ffmpegReady: boolean;
  // Audio preview
  audioPlaying: boolean;
  audioLoading: boolean;
  audioError: string | null;
  onToggleAudio: () => void;
  canPreviewAudio: boolean;
  // ImageKit
  ikVideos: ImageKitFile[];
  ikLoading: boolean;
  ikCategory: string;
  onIkCategory: (cat: string) => void;
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
  ffmpegReady,
  audioPlaying,
  audioLoading,
  audioError,
  onToggleAudio,
  canPreviewAudio,
  ikVideos,
  ikLoading,
  ikCategory,
  onIkCategory,
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
        {ffmpegReady && (
          <p className="mt-2 text-xs text-verdant/70 flex items-center justify-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-verdant animate-pulse inline-block" />
            {locale === "ar" ? "محرك الفيديو جاهز" : "Video encoder ready"}
          </p>
        )}
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
                (b) => b.id !== "upload" && b.id !== "imagekit",
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

          {/* ImageKit library */}
          <Field label={locale === "ar" ? "مكتبة الخلفيات" : "Video Library"}>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {IMAGEKIT_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => {
                    onIkCategory(cat.id);
                    onChange("background", "imagekit");
                  }}
                  className={`rounded-full border px-3 py-1 text-[11px] transition ${
                    ikCategory === cat.id
                      ? "border-gold/40 bg-gold/15 text-gold"
                      : "border-gold/10 text-parchment-muted hover:border-gold/25"
                  }`}
                >
                  {cat.icon} {cat.label}
                </button>
              ))}
            </div>
            {ikLoading ? (
              <div className="flex justify-center py-3">
                <Spinner className="h-4 w-4" />
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-1.5">
                {ikVideos.slice(0, 6).map((v) => (
                  <button
                    key={v.fileId}
                    onClick={() => {
                      onChange("background", "imagekit");
                      onChange("imageKitUrl", v.url);
                      onChange("imageKitThumb", v.thumbnail);
                    }}
                    className={`relative rounded-sm overflow-hidden border transition-all aspect-video bg-ink-light ${
                      settings.imageKitUrl === v.url
                        ? "border-gold ring-1 ring-gold/40"
                        : "border-gold/10 hover:border-gold/30"
                    }`}
                  >
                    {v.thumbnail && (
                      <img
                        src={v.thumbnail}
                        alt=""
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    )}
                    {settings.imageKitUrl === v.url && (
                      <div className="absolute inset-0 bg-gold/15 flex items-center justify-center">
                        <CheckIcon className="h-4 w-4 text-gold" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </Field>

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
              key: "showBasmalah" as const,
              label: locale === "ar" ? "بسملة في البداية" : "Bismillah Intro",
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
        <SignedIn>
          <button
            onClick={onNext}
            disabled={!selectedReciter}
            className="rounded-full bg-gold px-8 py-3.5 text-sm font-semibold text-ink hover:-translate-y-0.5 hover:shadow-lg hover:shadow-gold/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2"
          >
            {locale === "ar" ? "معاينة وإنتاج" : "Preview & Generate"}
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
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
              />
            </svg>
          </button>
        </SignedIn>
        <SignedOut>
          <SignInButton mode="modal">
            <button className="rounded-full border-2 border-gold/40 bg-gold/10 px-8 py-3.5 text-sm font-semibold text-gold hover:bg-gold/20 flex items-center gap-2">
              <CrescentMoonIcon className="h-4 w-4" />
              {locale === "ar" ? "سجل الدخول للمتابعة" : "Sign in to continue"}
            </button>
          </SignInButton>
        </SignedOut>
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
