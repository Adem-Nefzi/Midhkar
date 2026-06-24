"use client";
/**
 * StepSurah.tsx  —  Step 1: choose a surah
 */

import { useState, useMemo } from "react";
import {
  IslamicDivider,
  GeometricRosette,
  KuficBorder,
  IslamicStarIcon,
} from "./icons";
import type { Surah } from "@/lib/quran";

interface Props {
  surahs: Surah[];
  loading: boolean;
  selected: Surah | null;
  onSelect: (s: Surah) => void;
  onNext: () => void;
  locale: string;
}

export function StepSurah({
  surahs,
  loading,
  selected,
  onSelect,
  onNext,
  locale,
}: Props) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!query.trim()) return surahs;
    const q = query.toLowerCase();
    return surahs.filter(
      (s) =>
        s.englishName.toLowerCase().includes(q) ||
        s.name.includes(query) ||
        String(s.number).includes(query),
    );
  }, [surahs, query]);

  return (
    <div className="animate-fade-up">
      {/* Header */}
      <div className="text-center mb-10">
        <IslamicDivider className="mb-4" />
        <h2 className="font-display text-3xl font-medium text-parchment sm:text-4xl">
          {locale === "ar"
            ? "اختر السورة"
            : locale === "fr"
              ? "Choisir une sourate"
              : "Choose a Surah"}
        </h2>
        <p className="mt-2 text-parchment-muted">
          {locale === "ar"
            ? "اختر من القرآن الكريم"
            : "Select from the Holy Qur'an"}
        </p>
      </div>

      {/* Search */}
      <div className="relative max-w-md mx-auto mb-8">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={locale === "ar" ? "ابحث…" : "Search surahs…"}
          className="w-full rounded-full border border-gold/20 bg-ink-light/50 px-5 py-3 pl-10 text-sm text-parchment placeholder-parchment-muted/50 outline-none focus:border-gold/40 focus:ring-1 focus:ring-gold/20"
        />
        <svg
          className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gold/40"
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

      {/* Grid */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gold/30 border-t-gold" />
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 max-w-5xl mx-auto">
            {filtered.map((surah) => (
              <button
                key={surah.number}
                onClick={() => onSelect(surah)}
                className={`group relative rounded-sm border p-4 text-left transition-all hover:-translate-y-0.5 ${
                  selected?.number === surah.number
                    ? "border-gold/40 bg-gold/10 ring-1 ring-gold/30"
                    : "border-gold/10 bg-ink-light/30 hover:border-gold/25 hover:bg-ink-light/50"
                }`}
              >
                <KuficBorder />
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gold/10 text-xs text-gold/80 font-medium">
                        {surah.number}
                      </span>
                      <span className="text-[10px] uppercase tracking-wider text-parchment-muted/50">
                        {surah.revelationType === "Meccan"
                          ? locale === "ar"
                            ? "مكية"
                            : "Meccan"
                          : locale === "ar"
                            ? "مدنية"
                            : "Medinan"}
                      </span>
                    </div>
                    <h3
                      className="text-lg font-medium text-parchment"
                      style={{ fontFamily: "'Amiri', serif" }}
                    >
                      {surah.name}
                    </h3>
                    <p className="text-xs text-parchment-muted mt-0.5">
                      {surah.englishName}
                    </p>
                    <p className="text-[10px] text-parchment-muted/40">
                      {surah.englishNameTranslation}
                    </p>
                  </div>
                  <div className="text-right ml-3 shrink-0">
                    <span className="text-xs text-parchment-muted/60">
                      {surah.numberOfAyahs}
                    </span>
                    <span className="block text-[10px] text-parchment-muted/40">
                      {locale === "ar" ? "آية" : "verses"}
                    </span>
                  </div>
                </div>
              </button>
            ))}

            {filtered.length === 0 && (
              <div className="col-span-3 text-center py-12 text-parchment-muted">
                <GeometricRosette className="h-8 w-8 mx-auto mb-3 text-gold/20" />
                {locale === "ar" ? "لا توجد نتائج" : "No results found"}
              </div>
            )}
          </div>

          {selected && (
            <div className="mt-8 flex justify-center">
              <button
                onClick={onNext}
                className="group relative overflow-hidden rounded-full bg-gold px-8 py-3.5 text-sm font-semibold text-ink transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-gold/20"
              >
                <span className="absolute inset-0 -translate-x-full bg-parchment/30 transition-transform duration-700 group-hover:translate-x-full" />
                <span className="relative flex items-center gap-2">
                  {locale === "ar" ? "التالي" : "Next"}{" "}
                  <IslamicStarIcon className="h-4 w-4" />
                </span>
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
