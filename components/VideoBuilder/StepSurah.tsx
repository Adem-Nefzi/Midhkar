"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import {
  GeometricRosette,
  SearchIcon,
  CheckIcon,
  AyahMarker,
  IslamicDivider,
} from "./icons";
import type { Surah } from "@/lib/quran";

interface Props {
  surahs: Surah[];
  loading: boolean;
  selected: Surah | null;
  onSelect: (s: Surah) => void;
  locale: string;
}

const POPULAR_NUMBERS = [1, 2, 18, 36, 55, 67, 78, 112];

type FilterId = "all" | "Meccan" | "Medinan" | "short" | "long";

const FILTER_TABS: { id: FilterId; en: string; fr: string; ar: string }[] = [
  { id: "all", en: "All", fr: "Toutes", ar: "الكل" },
  { id: "Meccan", en: "Meccan", fr: "Mecquoise", ar: "مكية" },
  { id: "Medinan", en: "Medinan", fr: "Médinoise", ar: "مدنية" },
  { id: "short", en: "Short", fr: "Courtes", ar: "قصيرة" },
  { id: "long", en: "Long", fr: "Longues", ar: "طويلة" },
];

const SHORT_MAX = 30;
const LONG_MIN = 100;

export function StepSurah({
  surahs,
  loading,
  selected,
  onSelect,
  locale,
}: Props) {
  const ar = locale === "ar";
  const fr = locale === "fr";
  const L = (o: { en: string; fr: string; ar: string }) =>
    ar ? o.ar : fr ? o.fr : o.en;

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterId>("all");
  const searchRef = useRef<HTMLInputElement>(null);

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
    if (filter === "Meccan" || filter === "Medinan") {
      list = list.filter((s) => s.revelationType === filter);
    } else if (filter === "short") {
      list = list.filter((s) => s.numberOfAyahs <= SHORT_MAX);
    } else if (filter === "long") {
      list = list.filter((s) => s.numberOfAyahs >= LONG_MIN);
    }
    if (query.trim()) {
      const q = query.toLowerCase().trim();
      list = list.filter(
        (s) =>
          s.englishName.toLowerCase().includes(q) ||
          s.name.includes(query.trim()) ||
          String(s.number) === q ||
          s.englishNameTranslation.toLowerCase().includes(q),
      );
    }
    return list;
  }, [surahs, query, filter]);

  const [visibleCount, setVisibleCount] = useState(48);
  const visible = useMemo(
    () => filtered.slice(0, visibleCount),
    [filtered, visibleCount],
  );

  useEffect(() => {
    setVisibleCount(48);
  }, [filter, query]);

  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && visibleCount < filtered.length) {
          setVisibleCount((c) => Math.min(c + 48, filtered.length));
        }
      },
      { rootMargin: "300px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [visibleCount, filtered.length]);

  const popular = useMemo(
    () =>
      POPULAR_NUMBERS.map((n) => surahs.find((s) => s.number === n)).filter(
        (s): s is Surah => Boolean(s),
      ),
    [surahs],
  );

  const revelationLabel = (s: Surah) =>
    s.revelationType === "Meccan"
      ? L({ en: "Meccan", fr: "Mecquoise", ar: "مكية" })
      : L({ en: "Medinan", fr: "Médinoise", ar: "مدنية" });

  return (
    <div className="animate-step-in">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="mb-8 text-center">
        <p
          className="mb-2 text-2xl text-gold/80"
          style={{ fontFamily: "'Amiri', serif" }}
          lang="ar"
          dir="rtl"
          translate="no"
        >
          بِسْمِ اللّٰهَ الرَّحْمٰنِ الرَّحِيْمِ
        </p>
        <h2 className="font-display text-3xl font-medium text-parchment sm:text-4xl">
          {L({ en: "Choose a Surah", fr: "Choisir une sourate", ar: "اختر السورة" })}
        </h2>
        <p className="mt-2 text-sm text-parchment-muted">
          {L({
            en: "Select from the Holy Qur'an — 114 chapters",
            fr: "Choisissez parmi les 114 sourates du Saint Coran",
            ar: "اختر من القرآن الكريم — ١١٤ سورة",
          })}
        </p>
        <IslamicDivider className="mx-auto mt-4 w-40 text-gold/40" />
      </div>

      {/* ── Search + filters ───────────────────────────────────── */}
      <div className="mx-auto mb-6 max-w-3xl space-y-3" data-tour="surah-search">
        <div className="group relative">
          <SearchIcon className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gold/40 transition-colors group-focus-within:text-gold/80" />
          <input
            ref={searchRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={L({
              en: "Search by name, meaning, or number…",
              fr: "Rechercher par nom, signification ou numéro…",
              ar: "ابحث بالاسم أو المعنى أو الرقم…",
            })}
            className="w-full rounded-2xl border border-gold/20 bg-ink-light/60 px-4 py-3.5 pl-11 pr-16 text-sm text-parchment placeholder-parchment-dim outline-none transition-all focus:border-gold/55 focus:bg-ink-light/90 focus:ring-2 focus:ring-gold/15"
          />
          <kbd className="absolute right-4 top-1/2 hidden -translate-y-1/2 items-center gap-0.5 rounded border border-gold/20 bg-ink/60 px-1.5 py-0.5 font-mono text-[13px] text-parchment-dim sm:inline-flex">
            ⌘K
          </kbd>
        </div>

        <div className="flex flex-wrap justify-center gap-1.5">
          {FILTER_TABS.map((tab) => {
            const active = filter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id)}
                aria-pressed={active}
                className={`rounded-full border px-4 py-2 text-[13px] font-medium transition-all duration-200 active:scale-95 ${
                  active
                    ? "border-gold/50 bg-gold/15 text-gold shadow-sm shadow-gold/10"
                    : "border-gold/15 bg-ink-light/40 text-parchment-muted hover:border-gold/30 hover:text-parchment"
                }`}
              >
                {L(tab)}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Popular rail ───────────────────────────────────────── */}
      {!query && filter === "all" && popular.length > 0 && (
        <div className="mx-auto mb-8 max-w-5xl" data-tour="surah-popular">
          <p className="mb-3 text-center text-[13px] font-medium uppercase tracking-[0.25em] text-gold/60">
            {L({ en: "Often recited", fr: "Souvent récitées", ar: "كثيرا ما تُتلى" })}
          </p>
          <div className="flex snap-x gap-2 overflow-x-auto pb-2 [mask-image:linear-gradient(to_right,transparent,black_5%,black_95%,transparent)] [scrollbar-width:thin]">
            {popular.map((s) => {
              const isActive = selected?.number === s.number;
              return (
                <button
                  key={s.number}
                  onClick={() => onSelect(s)}
                  className={`relative flex shrink-0 snap-start items-center gap-3 rounded-2xl border px-4 py-3 transition-all duration-200 active:scale-95 ${
                    isActive
                      ? "select-bloom border-gold/55 bg-gold/15 lit-soft"
                      : "border-gold/15 bg-ink-light/40 hover:border-gold/35 hover:bg-ink-light/70"
                  }`}
                >
                  <AyahMarker value={s.number} className="h-8 w-8" active={isActive} />
                  <span className="text-left">
                    <span
                      className="block text-base leading-tight text-parchment"
                      style={{ fontFamily: "'Amiri', serif" }}
                      lang="ar"
                      dir="rtl"
                      translate="no"
                    >
                      {s.name}
                    </span>
                    <span className="block text-[13px] text-parchment-dim">
                      {s.englishName}
                    </span>
                  </span>
                  {isActive && (
                    <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-gold">
                      <CheckIcon className="h-2.5 w-2.5 text-ink" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Result meta ────────────────────────────────────────── */}
      <div className="mx-auto mb-3 flex max-w-5xl items-center justify-between px-1">
        <span className="text-[13px] text-parchment-dim">
          {filtered.length} {L({ en: "surahs", fr: "sourates", ar: "سورة" })}
        </span>
        {selected && (
          <span className="flex items-center gap-1 text-[13px] text-gold/70">
            <CheckIcon className="h-3 w-3" />
            {selected.englishName}
          </span>
        )}
      </div>

      {/* ── The illuminated index ──────────────────────────────── */}
      <div data-tour="surah-index">
      {loading ? (
        <div className="mx-auto grid max-w-5xl gap-2 sm:gap-3 lg:grid-cols-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="panel rounded-2xl p-3 sm:p-4">
              <div className="flex items-center gap-3">
                <div className="skeleton h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-5 w-28" />
                  <div className="skeleton h-3 w-40" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="mx-auto grid max-w-5xl gap-2 sm:gap-3 lg:grid-cols-2">
            {visible.map((surah) => {
              const isSelected = selected?.number === surah.number;
              return (
                <button
                  key={surah.number}
                  onClick={() => onSelect(surah)}
                  aria-pressed={isSelected}
                  className={`group relative overflow-hidden rounded-2xl border p-3 text-left transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/50 sm:p-4 ${
                    isSelected
                      ? "select-bloom border-gold/55 bg-gold/[0.08] lit-soft"
                      : "border-gold/10 bg-ink-light/40 hover:-translate-y-0.5 hover:border-gold/30 hover:bg-ink-light/70"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <AyahMarker
                      value={surah.number}
                      className="h-10 w-10 shrink-0 sm:h-11 sm:w-11"
                      active={isSelected}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <h3
                          className="truncate text-lg font-medium leading-tight text-parchment"
                          style={{ fontFamily: "'Amiri', serif" }}
                          lang="ar"
                          dir="rtl"
                          translate="no"
                        >
                          {surah.name}
                        </h3>
                        {isSelected ? (
                          <CheckIcon className="h-4 w-4 shrink-0 text-gold" />
                        ) : (
                          <span className="hidden shrink-0 text-[13px] text-parchment-dim sm:block">
                            {surah.numberOfAyahs}{" "}
                            {L({ en: "ayahs", fr: "versets", ar: "آية" })}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-[13px] font-medium text-parchment-muted">
                        {surah.englishName}
                        <span className="text-parchment-dim">
                          {" "}
                          · {surah.englishNameTranslation}
                        </span>
                      </p>
                      <div className="mt-1.5 hidden items-center gap-2 sm:flex">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium uppercase tracking-wider ${
                            surah.revelationType === "Meccan"
                              ? "bg-verdant/15 text-verdant"
                              : "bg-azure/15 text-azure-soft"
                          }`}
                        >
                          {revelationLabel(surah)}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}

            {filtered.length === 0 && (
              <div className="col-span-full py-16 text-center">
                <GeometricRosette className="mx-auto mb-4 h-10 w-10 text-gold/20" />
                <p className="text-sm text-parchment-muted">
                  {L({ en: "No results found", fr: "Aucun résultat", ar: "لا توجد نتائج" })}
                </p>
                <p className="mt-1 text-[13px] text-parchment-dim">
                  {L({
                    en: "Try a different search term",
                    fr: "Essayez un autre terme",
                    ar: "جرب البحث بكلمات مختلفة",
                  })}
                </p>
              </div>
            )}
          </div>

          {visibleCount < filtered.length && (
            <div ref={sentinelRef} className="flex justify-center py-6">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-gold/25 border-t-gold" />
            </div>
          )}
        </>
      )}
      </div>
    </div>
  );
}
