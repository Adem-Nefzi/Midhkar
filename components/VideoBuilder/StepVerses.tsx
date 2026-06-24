"use client";
/**
 * StepVerses.tsx  —  Step 2: select ayahs
 */

import { useState, useMemo } from "react";
import {
  IslamicDivider,
  CrescentMoonIcon,
  GeometricRosette,
  IslamicStarIcon,
} from "./icons";
import { VERSE_PRESETS } from "@/lib/quran";
import type { Surah, Ayah } from "@/lib/quran";

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
}: Props) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!query.trim()) return ayahs;
    return ayahs.filter(
      (a) =>
        a.text.includes(query) ||
        String(a.numberInSurah).includes(query) ||
        a.translation?.toLowerCase().includes(query.toLowerCase()),
    );
  }, [ayahs, query]);

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
        <div className="mt-2 flex items-center justify-center gap-2 text-parchment-muted">
          <CrescentMoonIcon className="h-3 w-3 text-gold/30" />
          <span>
            {surah.name} — {surah.numberOfAyahs}{" "}
            {locale === "ar" ? "آية" : "verses"}
          </span>
        </div>
      </div>

      {/* Presets */}
      <div className="flex flex-wrap items-center gap-2 mb-4 justify-center">
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
              className={`rounded-full border px-4 py-1.5 text-xs transition ${
                active
                  ? "border-gold/40 bg-gold/15 text-gold ring-1 ring-gold/30"
                  : "border-gold/20 bg-ink-light/30 text-parchment-muted hover:border-gold/40 hover:text-gold"
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
            className="rounded-full border border-red-900/40 bg-red-900/10 px-4 py-1.5 text-xs text-red-400 hover:bg-red-900/20"
          >
            {locale === "ar" ? "إلغاء" : "Clear"}
          </button>
        )}
      </div>

      {/* Selection badge */}
      {selected.size > 0 && (
        <div className="text-center mb-4">
          <span className="inline-flex items-center gap-2 rounded-full border border-gold/20 bg-gold/5 px-4 py-1.5 text-sm text-gold/80">
            <GeometricRosette className="h-4 w-4" />
            {selected.size} {locale === "ar" ? "آية مختارة" : "verses selected"}
            {sortedSelected.length > 1 && (
              <span className="text-parchment-muted/60 text-xs">
                ({sortedSelected[0]}–{sortedSelected[sortedSelected.length - 1]}
                )
              </span>
            )}
          </span>
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-md mx-auto mb-4">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={locale === "ar" ? "ابحث في الآيات…" : "Search verses…"}
          className="w-full rounded-full border border-gold/20 bg-ink-light/50 px-5 py-2 pl-10 text-sm text-parchment placeholder-parchment-muted/50 outline-none focus:border-gold/40"
        />
        <svg
          className="absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gold/40"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </div>

      {/* Verse list */}
      <div className="rounded-sm border border-gold/15 bg-ink-light/20 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-gold/30 border-t-gold" />
          </div>
        ) : (
          <div className="max-h-[520px] overflow-y-auto custom-scrollbar">
            {filtered.map((ayah) => {
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
                  className={`border-b border-gold/5 px-4 py-3.5 cursor-pointer transition ${
                    sel
                      ? "bg-gold/[0.06] border-l-2 border-l-gold"
                      : "hover:bg-ink-light/40 border-l-2 border-l-transparent"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-medium transition ${
                        sel
                          ? "bg-gold/25 text-gold ring-1 ring-gold/40"
                          : "bg-parchment/8 text-parchment-muted"
                      }`}
                    >
                      {ayah.numberInSurah}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-sm text-parchment leading-relaxed"
                        style={{ fontFamily: "'Amiri', serif" }}
                        dir="rtl"
                      >
                        {ayah.text}
                      </p>
                      {showTranslation && ayah.translation && (
                        <p className="mt-1 text-xs text-parchment-muted/60 leading-relaxed">
                          {ayah.translation}
                        </p>
                      )}
                    </div>
                    <div
                      className={`shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition mt-1 ${sel ? "border-gold bg-gold/20" : "border-gold/20"}`}
                    >
                      {sel && (
                        <svg
                          className="h-3 w-3 text-gold"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={3}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Nav */}
      <div className="mt-8 flex justify-center gap-4">
        <button
          onClick={onBack}
          className="rounded-full border border-parchment/20 px-6 py-3 text-sm text-parchment hover:border-gold/40 hover:text-gold flex items-center gap-2 transition"
        >
          <IslamicStarIcon className="h-3 w-3 rotate-180" />
          {locale === "ar" ? "رجوع" : "Back"}
        </button>
        <button
          onClick={onNext}
          disabled={selected.size === 0}
          className="rounded-full bg-gold px-8 py-3.5 text-sm font-semibold text-ink hover:-translate-y-0.5 hover:shadow-lg hover:shadow-gold/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2"
        >
          {locale === "ar" ? "التالي" : "Next"}{" "}
          <IslamicStarIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
