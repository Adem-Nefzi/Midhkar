"use client";
/**
 * StepSurah.tsx  —  Step 1: choose a surah
 *
 * Redesigned with:
 *  - Revelation-type filter tabs (All / Meccan / Medinan)
 *  - Quick-select popular surahs row
 *  - Selected surah summary card
 *  - Polished card grid with better hierarchy
 *  - Keyboard-friendly search
 */

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import {
  IslamicDivider,
  GeometricRosette,
  KuficBorder,
  IslamicStarIcon,
  SearchIcon,
  CrescentMoonIcon,
  CheckIcon,
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

const POPULAR_NUMBERS = [1, 2, 18, 36, 55, 67];

const FILTER_TABS = [
  { id: "all", labelEn: "All", labelAr: "الكل" },
  { id: "Meccan", labelEn: "Meccan", labelAr: "مكية" },
  { id: "Medinan", labelEn: "Medinan", labelAr: "مدنية" },
] as const;

export function StepSurah({
  surahs,
  loading,
  selected,
  onSelect,
  onNext,
  locale,
}: Props) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [hoveredSurah, setHoveredSurah] = useState<Surah | null>(null);
  const [hoverPos, setHoverPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const searchRef = useRef<HTMLInputElement>(null);
  const hoverCardRef = useRef<HTMLDivElement>(null);

  const handleSurahHover = useCallback((surah: Surah | null, e?: React.MouseEvent) => {
    setHoveredSurah(surah);
    if (surah && e) {
      const rect = e.currentTarget.getBoundingClientRect();
      const cardWidth = 380;
      const cardHeight = 70;
      let top = rect.bottom + 8;
      let left = rect.left + rect.width / 2 - cardWidth / 2;
      if (top + cardHeight > window.innerHeight - 16) {
        top = rect.top - cardHeight - 8;
      }
      if (top < 16) {
        top = 16;
      }
      left = Math.max(16, Math.min(left, window.innerWidth - cardWidth - 16));
      setHoverPos({ top, left });
    }
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const filtered = useMemo(() => {
    let list = surahs;
    if (filter !== "all") {
      list = list.filter((s) => s.revelationType === filter);
    }
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (s) =>
          s.englishName.toLowerCase().includes(q) ||
          s.name.includes(query) ||
          String(s.number) === q ||
          s.englishNameTranslation.toLowerCase().includes(q),
      );
    }
    return list;
  }, [surahs, query, filter]);

  const popular = useMemo(
    () => surahs.filter((s) => POPULAR_NUMBERS.includes(s.number)),
    [surahs],
  );

  return (
    <div className="animate-fade-up">
      {/* Header */}
      <div className="text-center mb-8">
        <IslamicDivider className="mb-4" />
        <h2 className="font-display text-3xl font-medium text-parchment sm:text-4xl">
          {locale === "ar"
            ? "اختر السورة"
            : locale === "fr"
              ? "Choisir une sourate"
              : "Choose a Surah"}
        </h2>
        <p className="mt-2 text-parchment-muted text-sm">
          {locale === "ar"
            ? "اختر من القرآن الكريم"
            : "Select from the Holy Qur'an"}
        </p>
      </div>

      {/* Selected surah summary */}
      {selected && (
        <div className="max-w-lg mx-auto mb-8 animate-fade-up">
          <div className="relative rounded-sm border-2 border-gold/30 bg-gold/[0.06] p-5 kufic-frame">
            <KuficBorder />
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gold/15 ring-2 ring-gold/30">
                <span className="text-lg font-semibold text-gold font-display">
                  {selected.number}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <h3
                  className="text-xl font-medium text-parchment truncate"
                  style={{ fontFamily: "'Amiri', serif" }}
                >
                  {selected.name}
                </h3>
                <p className="text-sm text-parchment-muted truncate">
                  {selected.englishName} — {selected.englishNameTranslation}
                </p>
                <div className="mt-1 flex items-center gap-3 text-xs text-parchment-muted/60">
                  <span className="flex items-center gap-1">
                    <CrescentMoonIcon className="h-3 w-3 text-gold/30" />
                    {selected.revelationType === "Meccan"
                      ? locale === "ar" ? "مكية" : "Meccan"
                      : locale === "ar" ? "مدنية" : "Medinan"}
                  </span>
                  <span>·</span>
                  <span>
                    {selected.numberOfAyahs}{" "}
                    {locale === "ar" ? "آية" : "verses"}
                  </span>
                </div>
              </div>
              <CheckIcon className="h-6 w-6 text-gold shrink-0" />
            </div>
          </div>
        </div>
      )}

      {/* Quick select — popular surahs */}
      {!query && filter === "all" && (
        <div className="max-w-4xl mx-auto mb-6">
          <p className="text-[10px] uppercase tracking-[0.2em] text-gold/40 font-medium mb-3 text-center">
            {locale === "ar" ? "سورة شائعة" : "Popular Surahs"}
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {popular.map((s) => {
              const isActive = selected?.number === s.number;
              return (
                <button
                  key={s.number}
                  onClick={() => onSelect(s)}
                  className={`group relative rounded-full border px-4 py-2.5 text-xs transition-all duration-200 hover:-translate-y-0.5 ${
                    isActive
                      ? "border-gold/50 bg-gold/15 text-gold shadow-sm shadow-gold/10"
                      : "border-gold/15 bg-ink-light/30 text-parchment-muted hover:border-gold/30 hover:text-parchment hover:bg-ink-light/50"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span
                      className="font-medium"
                      style={{ fontFamily: "'Amiri', serif" }}
                    >
                      {s.name}
                    </span>
                    <span className="text-parchment-muted/40">
                      {s.englishName}
                    </span>
                  </span>
                  {isActive && (
                    <span className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-gold flex items-center justify-center">
                      <CheckIcon className="h-2 w-2 text-ink" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Search + filters */}
      <div className="max-w-2xl mx-auto mb-6 flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1 group">
          <SearchIcon className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gold/30 group-focus-within:text-gold/60 transition-colors" />
          <input
            ref={searchRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              locale === "ar"
                ? "ابحث بالاسم أو الرقم..."
                : "Search by name, English, or number..."
            }
            className="w-full rounded-sm border border-gold/20 bg-ink-light/40 px-4 py-3 pl-10 pr-4 sm:pr-16 text-sm text-parchment placeholder-parchment-muted/40 outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/20 focus:bg-ink-light/60 transition-all"
          />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:inline-flex items-center gap-0.5 rounded border border-gold/15 bg-ink/50 px-1.5 py-0.5 text-[10px] text-parchment-muted/40 font-mono">
            ⌘K
          </kbd>
        </div>

        {/* Filter tabs */}
        <div className="flex rounded-sm border border-gold/15 bg-ink-light/30 p-0.5">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`relative rounded-sm px-4 py-2 text-xs font-medium transition-all duration-200 ${
                filter === tab.id
                  ? "bg-gold/15 text-gold shadow-sm"
                  : "text-parchment-muted/60 hover:text-parchment hover:bg-ink-light/40"
              }`}
            >
              {locale === "ar" ? tab.labelAr : tab.labelEn}
              {filter === tab.id && (
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 w-4 rounded-full bg-gold/50" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Result count */}
      <div className="max-w-5xl mx-auto mb-3 flex items-center justify-between px-1">
        <span className="text-[11px] text-parchment-muted/40">
          {filtered.length}{" "}
          {locale === "ar" ? "سورة" : "surahs"}
          {filter !== "all" && (
            <span className="ml-1">
              ({locale === "ar"
                ? filter === "Meccan" ? "مكية" : "مدنية"
                : filter})
            </span>
          )}
        </span>
        {selected && (
          <span className="text-[11px] text-gold/50 flex items-center gap-1">
            <CheckIcon className="h-3 w-3" />
            {selected.englishName}
          </span>
        )}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-gold/30 border-t-gold" />
            <span className="text-xs text-parchment-muted/40">
              {locale === "ar" ? "جاري التحميل..." : "Loading surahs..."}
            </span>
          </div>
        </div>
      ) : (
        <>
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 max-w-5xl mx-auto">
            {filtered.map((surah) => {
              const isSelected = selected?.number === surah.number;
              return (
                <button
                  key={surah.number}
                  onClick={() => onSelect(surah)}
                  onMouseEnter={(e) => handleSurahHover(surah, e)}
                  onMouseLeave={() => handleSurahHover(null)}
                  className={`group relative rounded-sm border p-4 text-left transition-all duration-200 hover:-translate-y-0.5 ${
                    isSelected
                      ? "border-gold/50 bg-gold/[0.08] ring-1 ring-gold/25 shadow-lg shadow-gold/5"
                      : "border-gold/[0.08] bg-ink-light/20 hover:border-gold/20 hover:bg-ink-light/40 hover:shadow-md hover:shadow-gold/[0.03]"
                  }`}
                >
                  <KuficBorder />
                  <div className="flex items-start gap-3">
                    {/* Number badge */}
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-all duration-200 ${
                        isSelected
                          ? "bg-gold/20 text-gold ring-1 ring-gold/30"
                          : "bg-gold/[0.06] text-gold/50 group-hover:bg-gold/10 group-hover:text-gold/70"
                      }`}
                    >
                      {surah.number}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3
                          className="text-base font-medium text-parchment truncate"
                          style={{ fontFamily: "'Amiri', serif" }}
                        >
                          {surah.name}
                        </h3>
                        {isSelected && (
                          <CheckIcon className="h-4 w-4 text-gold shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-parchment-muted truncate mt-0.5">
                        {surah.englishName}
                      </p>
                      <div className="mt-1.5 flex items-center gap-2">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] uppercase tracking-wider font-medium ${
                            surah.revelationType === "Meccan"
                              ? "bg-verdant/10 text-verdant/60"
                              : "bg-azure/10 text-azure/60"
                          }`}
                        >
                          {surah.revelationType === "Meccan"
                            ? locale === "ar" ? "مكية" : "Meccan"
                            : locale === "ar" ? "مدنية" : "Medinan"}
                        </span>
                        <span className="text-[10px] text-parchment-muted/30">
                          {surah.numberOfAyahs}{" "}
                          {locale === "ar" ? "آية" : "ayah"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Hover glow effect */}
                  <div
                    className={`absolute inset-0 rounded-sm transition-opacity duration-300 pointer-events-none ${
                      isSelected
                        ? "opacity-100 bg-gradient-to-br from-gold/[0.04] to-transparent"
                        : "opacity-0 group-hover:opacity-100 bg-gradient-to-br from-gold/[0.02] to-transparent"
                    }`}
                  />
                </button>
              );
            })}

            {filtered.length === 0 && (
              <div className="col-span-3 text-center py-16">
                <GeometricRosette className="h-10 w-10 mx-auto mb-4 text-gold/15" />
                <p className="text-parchment-muted text-sm">
                  {locale === "ar" ? "لا توجد نتائج" : "No results found"}
                </p>
                <p className="text-parchment-muted/40 text-xs mt-1">
                  {locale === "ar"
                    ? "جرب البحث بكلمات مختلفة"
                    : "Try a different search term"}
                </p>
              </div>
            )}
          </div>

          {/* Next button */}
          {selected && (
            <div className="mt-10 flex justify-center animate-fade-up">
              <button
                onClick={onNext}
                className="group relative overflow-hidden rounded-full bg-gold px-10 py-3.5 text-sm font-semibold text-ink transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-gold/20"
              >
                <span className="absolute inset-0 -translate-x-full bg-parchment/30 transition-transform duration-700 group-hover:translate-x-full" />
                <span className="relative flex items-center gap-2">
                  {locale === "ar" ? "التالي — اختيار الآيات" : "Next — Select Verses"}
                  <IslamicStarIcon className="h-4 w-4 transition-transform group-hover:rotate-45" />
                </span>
              </button>
            </div>
          )}
        </>
      )}

      {hoveredSurah && (
        <div
          ref={hoverCardRef}
          className="fixed z-50 animate-fade-up pointer-events-none"
          style={{ top: hoverPos.top, left: hoverPos.left }}
        >
          <div className="rounded-sm border border-gold/30 bg-ink/95 backdrop-blur-xl px-6 py-3 shadow-xl shadow-gold/10 flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gold/15 text-sm font-semibold text-gold">
              {hoveredSurah.number}
            </div>
            <div>
              <p className="text-sm font-medium text-parchment" style={{ fontFamily: "'Amiri', serif" }}>{hoveredSurah.name}</p>
              <p className="text-xs text-parchment-muted">{hoveredSurah.englishName} — {hoveredSurah.englishNameTranslation}</p>
            </div>
            <span className={`text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full ${hoveredSurah.revelationType === "Meccan" ? "bg-verdant/10 text-verdant/60" : "bg-azure/10 text-azure/60"}`}>
              {hoveredSurah.revelationType === "Meccan" ? (locale === "ar" ? "مكية" : "Meccan") : (locale === "ar" ? "مدنية" : "Medinan")}
            </span>
            <span className="text-xs text-parchment-muted/60">{hoveredSurah.numberOfAyahs} {locale === "ar" ? "آية" : "verses"}</span>
          </div>
        </div>
      )}
    </div>
  );
}
