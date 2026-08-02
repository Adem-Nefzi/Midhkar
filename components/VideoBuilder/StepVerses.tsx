"use client";
/**
 * StepVerses.tsx  —  Step 2: select ayahs
 */

import { useState, useMemo, useRef, useEffect } from "react";
import {
  IslamicDivider,
  CrescentMoonIcon,
  GeometricRosette,
  IslamicStarIcon,
  SearchIcon,
  Spinner,
  CheckIcon,
} from "./icons";
import { VERSE_PRESETS } from "@/lib/quran";
import type { Surah, Ayah, Reciter } from "@/lib/quran";

interface Props {
  surah: Surah;
  ayahs: Ayah[];
  loading: boolean;
  selected: Set<number>;
  showTranslation: boolean;
  onToggle: (num: number) => void;
  onPreset: (id: string) => void;
  onBack: () => void;
  onNext: () => void;
  locale: string;
  surahNumber: number;
  reciterIdentifier: string | null;
  reciters: Reciter[];
  totalDurationSec: number | null;
  durationLoading: boolean;
}

export function StepVerses({
  surah,
  ayahs,
  loading,
  selected,
  showTranslation,
  onToggle,
  onPreset,
  onBack,
  onNext,
  locale,
  surahNumber,
  reciterIdentifier,
  reciters,
  totalDurationSec,
  durationLoading,
}: Props) {
  const [query, setQuery] = useState("");
  const [hoveredAyah, setHoveredAyah] = useState<number | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  const fmtDur = (sec: number) => {
    const s = Math.round(sec);
    const m = Math.floor(s / 60);
    return `${m}:${String(s % 60).padStart(2, "0")}`;
  };

  useEffect(() => {
    if (hoveredAyah === null || !reciterIdentifier) {
      if (previewAudioRef.current) { previewAudioRef.current.pause(); previewAudioRef.current = null; }
      return;
    }
    const reciter = reciters.find(r => r.identifier === reciterIdentifier);
    if (!reciter?.quranApiNo) return;
    const url = `https://the-quran-project.github.io/Quran-Audio/Data/${reciter.quranApiNo}/${surahNumber}_${hoveredAyah}.mp3`;
    const audio = new Audio(url);
    audio.volume = 0.3;
    previewAudioRef.current = audio;
    audio.play().catch(() => {});
    const timer = setTimeout(() => { audio.pause(); }, 3000);
    return () => { clearTimeout(timer); audio.pause(); };
  }, [hoveredAyah, reciterIdentifier, surahNumber, reciters]);

  const filtered = useMemo(() => {
    if (!query.trim()) return ayahs;
    return ayahs.filter(
      (a) =>
        a.text.includes(query) ||
        String(a.numberInSurah).includes(query) ||
        a.translation?.toLowerCase().includes(query.toLowerCase()),
    );
  }, [ayahs, query]);

  // Virtualized: show first 50 ayahs, load more on scroll
  const [visibleCount, setVisibleCount] = useState(50);
  const visible = useMemo(
    () => filtered.slice(0, visibleCount),
    [filtered, visibleCount],
  );
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setVisibleCount(50);
  }, [query]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && visibleCount < filtered.length) {
          setVisibleCount((c) => Math.min(c + 50, filtered.length));
        }
      },
      { rootMargin: "200px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [visibleCount, filtered.length]);

  const sortedSelected = useMemo(
    () => Array.from(selected).sort((a, b) => a - b),
    [selected],
  );

  return (
    <div className="animate-fade-up max-w-4xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <IslamicDivider className="mb-4" />
        <h2 className="font-display text-3xl font-medium text-parchment sm:text-4xl">
          {locale === "ar" ? "اختر الآيات" : "Select Verses"}
        </h2>
        <div className="mt-2 flex items-center justify-center gap-2 text-sm text-parchment-muted">
          <CrescentMoonIcon className="h-3 w-3 text-gold/30" />
          <span className="font-medium" style={{ fontFamily: "'Amiri', serif" }}>
            {surah.name}
          </span>
          <span className="text-parchment-muted/30">—</span>
          <span>
            {surah.numberOfAyahs}{" "}
            {locale === "ar" ? "آية" : "verses"}
          </span>
        </div>
      </div>

      {/* Presets */}
      <div className="flex flex-wrap items-center gap-2 mb-5 justify-center">
        {VERSE_PRESETS.map((preset) => {
          const count =
            preset.id === "full"
              ? surah.numberOfAyahs
              : parseInt(preset.id.split("-")[1]) || 3;
          const active =
            preset.id === "full"
              ? selected.size === surah.numberOfAyahs
              : selected.size === Math.min(count, surah.numberOfAyahs);

          return (
            <button
              key={preset.id}
              onClick={() => onPreset(preset.id)}
              className={`rounded-full border px-4 py-2.5 text-xs font-medium transition-all duration-200 hover:-translate-y-px ${
                active
                  ? "border-gold/50 bg-gold/15 text-gold shadow-sm shadow-gold/10 ring-1 ring-gold/20"
                  : "border-gold/15 bg-ink-light/30 text-parchment-muted hover:border-gold/30 hover:text-gold hover:bg-ink-light/50"
              }`}
            >
              {preset.id === "full"
                ? locale === "ar"
                  ? "السورة كاملة"
                  : "Full Surah"
                : `${locale === "ar" ? "أول" : "First"} ${count}`}
            </button>
          );
        })}
        {selected.size > 0 && (
          <button
            onClick={() => onPreset("clear")}
            className="rounded-full border border-red-500/20 bg-red-500/5 px-4 py-1.5 text-xs text-red-400/80 hover:bg-red-500/10 hover:border-red-500/30 transition-all"
          >
            {locale === "ar" ? "إلغاء" : "Clear"}
          </button>
        )}
      </div>

      {/* Selection badge */}
      {selected.size > 0 && (
        <div className="text-center mb-5 animate-fade-up">
          <span className="inline-flex items-center gap-2.5 rounded-full border border-gold/25 bg-gold/[0.06] px-5 py-2 text-sm text-gold/90 shadow-sm shadow-gold/5">
            <GeometricRosette className="h-4 w-4 text-gold/60" />
            <span className="font-medium">{selected.size}</span>
            <span className="text-parchment-muted/60">
              {locale === "ar" ? "آية مختارة" : "verses selected"}
            </span>
            {sortedSelected.length > 1 && (
              <span className="text-parchment-muted/40 text-xs">
                ({sortedSelected[0]}–{sortedSelected[sortedSelected.length - 1]})
              </span>
            )}
            {reciterIdentifier &&
              (totalDurationSec !== null || durationLoading) && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/20 bg-gold/10 px-3 py-0.5 text-xs font-semibold text-gold">
                  <svg
                    className="h-3 w-3"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <circle cx="12" cy="12" r="10" />
                    <path strokeLinecap="round" d="M12 6v6l4 2" />
                  </svg>
                  {durationLoading
                    ? "…"
                    : totalDurationSec !== null
                      ? `${locale === "ar" ? "المدة" : locale === "fr" ? "Durée" : "Length"} ≈ ${fmtDur(totalDurationSec)}`
                      : ""}
                </span>
              )}
          </span>
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-md mx-auto mb-5 group">
        <SearchIcon
          className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gold/30 group-focus-within:text-gold/60 transition-colors"
        />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={locale === "ar" ? "ابحث في الآيات..." : "Search verses..."}
          className="w-full rounded-sm border border-gold/20 bg-ink-light/40 px-5 py-2.5 pl-10 text-sm text-parchment placeholder-parchment-muted/40 outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/20 focus:bg-ink-light/60 transition-all"
        />
      </div>

      {/* Verse list */}
      <div className="rounded-sm border border-gold/15 bg-ink-light/15 overflow-hidden shadow-lg shadow-black/10">
        {loading ? (
          <div className="max-h-[520px] overflow-y-auto custom-scrollbar">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="border-b border-gold/[0.04] px-5 py-4">
                <div className="flex items-start gap-3">
                  <div className="skeleton h-8 w-8 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <div className="skeleton h-4 w-3/4" />
                    <div className="skeleton h-3 w-1/2" />
                  </div>
                  <div className="skeleton h-6 w-6 rounded-md" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="max-h-[520px] overflow-y-auto custom-scrollbar">
            {visible.map((ayah) => {
              const sel = selected.has(ayah.numberInSurah);
              return (
                <div
                  key={ayah.numberInSurah}
                  role="button"
                  tabIndex={0}
                  onClick={() => onToggle(ayah.numberInSurah)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ")
                      onToggle(ayah.numberInSurah);
                  }}
                  onMouseEnter={() => setHoveredAyah(ayah.numberInSurah)}
                  onMouseLeave={() => setHoveredAyah(null)}
                  className={`border-b border-gold/[0.04] px-5 py-4 cursor-pointer transition-all duration-300 glow-hover ${
                    sel
                      ? "bg-gold/[0.06] border-l-[3px] border-l-gold/60"
                      : "hover:bg-ink-light/30 border-l-[3px] border-l-transparent hover:border-l-gold/15"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold transition-all duration-200 ${
                        sel
                          ? "bg-gold/20 text-gold ring-1 ring-gold/30 shadow-sm shadow-gold/10"
                          : "bg-parchment/[0.06] text-parchment-muted/50"
                      }`}
                    >
                      {ayah.numberInSurah}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm leading-[1.8] transition-colors duration-200 ${
                          sel ? "text-parchment" : "text-parchment/80"
                        }`}
                        style={{ fontFamily: "'Amiri', serif" }}
                        dir="rtl"
                      >
                        {ayah.text}
                      </p>
                      {showTranslation && ayah.translation && (
                        <p className={`mt-1.5 text-xs leading-relaxed transition-colors duration-200 ${
                          sel ? "text-parchment-muted/70" : "text-parchment-muted/40"
                        }`}>
                          {ayah.translation}
                        </p>
                      )}
                    </div>
                    <div
                      className={`shrink-0 w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all duration-200 mt-1 ${
                        sel
                          ? "border-gold/60 bg-gold/20 shadow-sm shadow-gold/10"
                          : "border-gold/15 hover:border-gold/30"
                      }`}
                    >
                      {sel && (
                        <CheckIcon className="h-3.5 w-3.5 text-gold" />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {visibleCount < filtered.length && (
              <div ref={sentinelRef} className="flex justify-center py-4">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-gold/20 border-t-gold" />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Nav */}
      <div className="mt-10 flex justify-center gap-4">
        <button
          onClick={onBack}
          className="rounded-full border border-parchment/20 px-6 py-3 text-sm text-parchment hover:border-gold/40 hover:text-gold flex items-center gap-2 transition-all duration-200"
        >
          <IslamicStarIcon className="h-3 w-3 rotate-180" />
          {locale === "ar" ? "رجوع" : "Back"}
        </button>
        <button
          onClick={onNext}
          disabled={selected.size === 0}
          className="group relative overflow-hidden rounded-full bg-gold px-8 py-3.5 text-sm font-semibold text-ink hover:-translate-y-0.5 hover:shadow-xl hover:shadow-gold/20 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none transition-all duration-200 flex items-center gap-2"
        >
          <span className="absolute inset-0 -translate-x-full bg-parchment/30 transition-transform duration-700 group-hover:translate-x-full" />
          <span className="relative flex items-center gap-2">
            {locale === "ar" ? "التالي" : "Next"}
            <IslamicStarIcon className="h-4 w-4 transition-transform group-hover:rotate-45" />
          </span>
        </button>
      </div>
    </div>
  );
}
