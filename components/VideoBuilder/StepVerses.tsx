"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import {
  SearchIcon,
  CheckIcon,
  ArrowIcon,
  AyahMarker,
  TimerIcon,
} from "./icons";
import { Bloom } from "@/components/Ornament/ornaments";
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
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current = null;
      }
      return;
    }
    const reciter = reciters.find((r) => r.identifier === reciterIdentifier);
    if (!reciter?.quranApiNo) return;
    const url = `https://the-quran-project.github.io/Quran-Audio/Data/${reciter.quranApiNo}/${surahNumber}_${hoveredAyah}.mp3`;
    const audio = new Audio(url);
    audio.volume = 0.3;
    previewAudioRef.current = audio;
    audio.play().catch(() => {});
    const timer = setTimeout(() => {
      audio.pause();
    }, 3000);
    return () => {
      clearTimeout(timer);
      audio.pause();
    };
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
    <div className="mx-auto max-w-4xl animate-step-in">
      <div className="mb-8 text-center">
        <h2 className="font-display text-3xl font-medium text-parchment sm:text-4xl">
          {locale === "ar"
            ? "اختر الآيات"
            : locale === "fr"
              ? "Choisir les versets"
              : "Select Verses"}
        </h2>
        <div className="mt-2 flex items-center justify-center gap-2 text-sm text-parchment-muted">
          <span
            className="font-medium text-gold/90"
            style={{ fontFamily: "'Amiri', serif" }}
          >
            {surah.name}
          </span>
          <span className="text-parchment-dim" aria-hidden="true">
            —
          </span>
          <span>
            {surah.numberOfAyahs}{" "}
            {locale === "ar" ? "آية" : locale === "fr" ? "versets" : "verses"}
          </span>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap items-center justify-center gap-2">
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
              className={`rounded-full border px-4 py-2.5 text-[13px] font-medium transition-all duration-200 ${
                active
                  ? "border-gold/55 bg-gold/15 text-gold lit-soft"
                  : "border-gold/15 bg-ink-soft/50 text-parchment-muted hover:border-gold/35 hover:bg-ink-soft/80 hover:text-gold"
              }`}
            >
              {preset.id === "full"
                ? locale === "ar"
                  ? "السورة كاملة"
                  : locale === "fr"
                    ? "Sourate complète"
                    : "Full Surah"
                : `${locale === "ar" ? "أول" : locale === "fr" ? "Premiers" : "First"} ${count}`}
            </button>
          );
        })}
        {selected.size > 0 && (
          <button
            onClick={() => onPreset("clear")}
            className="rounded-full border border-red-500/25 bg-red-500/5 px-4 py-1.5 text-[13px] text-red-400/90 transition-all hover:border-red-500/40 hover:bg-red-500/10"
          >
            {locale === "ar" ? "إلغاء" : locale === "fr" ? "Effacer" : "Clear"}
          </button>
        )}
      </div>

      {selected.size > 0 && (
        <div className="mb-5 animate-step-in text-center">
          <span className="inline-flex flex-wrap items-center justify-center gap-2.5 rounded-full border border-gold/30 bg-gold/[0.07] px-5 py-2 text-sm text-gold lit-soft">
            <Bloom className="h-3.5 w-3.5" petals={6} />
            <span className="font-medium">{selected.size}</span>
            <span className="text-parchment-muted">
              {locale === "ar"
                ? "آية مختارة"
                : locale === "fr"
                  ? "versets sélectionnés"
                  : "verses selected"}
            </span>
            {sortedSelected.length > 1 && (
              <span className="text-[13px] text-parchment-dim">
                ({sortedSelected[0]}–{sortedSelected[sortedSelected.length - 1]})
              </span>
            )}
            {reciterIdentifier &&
              (totalDurationSec !== null || durationLoading) && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/25 bg-gold/10 px-3 py-0.5 text-[13px] font-semibold text-gold">
                  <TimerIcon className="h-3 w-3" />
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

      <div className="group relative mx-auto mb-5 max-w-md">
        <SearchIcon className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gold/40 transition-colors group-focus-within:text-gold/80" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={
            locale === "ar"
              ? "ابحث في الآيات..."
              : locale === "fr"
                ? "Rechercher des versets..."
                : "Search verses..."
          }
          className="w-full rounded-xl border border-gold/20 bg-ink-soft/60 px-5 py-2.5 pl-10 text-sm text-parchment placeholder-parchment-dim outline-none transition-all focus:border-gold/55 focus:bg-ink-soft/90"
        />
      </div>

      <div className="panel overflow-hidden">
        {loading ? (
          <div className="custom-scrollbar max-h-[520px] overflow-y-auto">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="border-b border-gold/[0.06] px-5 py-4">
                <div className="flex items-start gap-3">
                  <div className="skeleton h-9 w-9 rounded-full" />
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
          <div className="custom-scrollbar max-h-[520px] overflow-y-auto">
            {visible.map((ayah) => {
              const sel = selected.has(ayah.numberInSurah);
              return (
                <div
                  key={ayah.numberInSurah}
                  role="button"
                  tabIndex={0}
                  aria-pressed={sel}
                  onClick={() => onToggle(ayah.numberInSurah)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ")
                      onToggle(ayah.numberInSurah);
                  }}
                  onMouseEnter={() => setHoveredAyah(ayah.numberInSurah)}
                  onMouseLeave={() => setHoveredAyah(null)}
                  className={`cursor-pointer border-b border-gold/[0.06] px-5 py-4 transition-all duration-300 ${
                    sel
                      ? "bg-gold/[0.07]"
                      : "hover:bg-ink-soft/60"
                  }`}
                >
                  <div className="flex items-start gap-3.5">
                    <AyahMarker
                      value={ayah.numberInSurah}
                      className="mt-0.5 h-9 w-9 shrink-0"
                      active={sel}
                    />
                    <div className="min-w-0 flex-1">
                      <p
                        dir="rtl"
                        lang="ar"
                        translate="no"
                        className={`text-base leading-[2] transition-colors duration-200 ${
                          sel ? "text-parchment" : "text-parchment/85"
                        }`}
                        style={{ fontFamily: "'Amiri', serif" }}
                      >
                        {ayah.text}
                      </p>
                      {showTranslation && ayah.translation && (
                        <p
                          className={`mt-1.5 text-[13px] leading-relaxed transition-colors duration-200 ${
                            sel
                              ? "text-parchment-muted"
                              : "text-parchment-dim"
                          }`}
                        >
                          {ayah.translation}
                        </p>
                      )}
                    </div>
                    <div
                      className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 transition-all duration-200 ${
                        sel
                          ? "border-gold/70 bg-gold/20"
                          : "border-gold/20 hover:border-gold/40"
                      }`}
                    >
                      {sel && <CheckIcon className="h-3.5 w-3.5 text-gold" />}
                    </div>
                  </div>
                </div>
              );
            })}
            {visibleCount < filtered.length && (
              <div ref={sentinelRef} className="flex justify-center py-4">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-gold/25 border-t-gold" />
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-10 flex justify-center gap-4">
        <button onClick={onBack} className="btn-ghost px-6 py-3 text-sm">
          <ArrowIcon className="h-4 w-4 rotate-180" />
          {locale === "ar" ? "رجوع" : locale === "fr" ? "Retour" : "Back"}
        </button>
        <button
          onClick={onNext}
          disabled={selected.size === 0}
          className="btn-primary px-8 py-3.5 text-sm"
        >
          {locale === "ar" ? "التالي" : locale === "fr" ? "Suivant" : "Next"}
          <ArrowIcon className="h-4 w-4 rtl:rotate-180" />
        </button>
      </div>
    </div>
  );
}
