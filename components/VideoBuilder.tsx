"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useI18n } from "@/lib/i18n";
import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";

// ─── Types ─────────────────────────────────────────────────────────
interface Surah {
  number: number;
  name: string;
  englishName: string;
  englishNameTranslation: string;
  numberOfAyahs: number;
  revelationType: string;
}

interface Ayah {
  number: number;
  numberInSurah: number;
  text: string;
  audio?: string;
  audioSecondary?: string[];
  translation?: string;
  juz: number;
  page: number;
  sajda: boolean;
}

interface Reciter {
  identifier: string;
  name: string;
  englishName: string;
  language: string;
  format: string;
  type: string;
}

interface VideoSettings {
  background: "gradient" | "dark" | "nature" | "abstract";
  fontSize: "small" | "medium" | "large";
  showTranslation: boolean;
  translationLang: string;
  aspectRatio: "16:9" | "9:16" | "1:1";
}

// ─── API Configuration ───────────────────────────────────────────
const API_BASE = "https://api.alquran.cloud/v1";
const AUDIO_CDN = "https://cdn.islamic.network/quran/audio/128";

// ─── Backgrounds ───────────────────────────────────────────────────
const BACKGROUNDS = [
  {
    id: "gradient",
    label: "Golden Gradient",
    preview: "bg-gradient-to-br from-gold/20 via-ink to-verdant/10",
  },
  { id: "dark", label: "Midnight Ink", preview: "bg-ink-light" },
  {
    id: "nature",
    label: "Verdant Light",
    preview: "bg-gradient-to-b from-verdant/15 via-ink to-ink",
  },
  { id: "abstract", label: "Geometric", preview: "bg-ink" },
];

// ─── Component ─────────────────────────────────────────────────────
export function VideoBuilder() {
  const { t, locale } = useI18n();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Data states
  const [allSurahs, setAllSurahs] = useState<Surah[]>([]);
  const [surahsLoading, setSurahsLoading] = useState(true);
  const [reciters, setReciters] = useState<Reciter[]>([]);
  const [recitersLoading, setRecitersLoading] = useState(true);
  const [selectedSurah, setSelectedSurah] = useState<Surah | null>(null);
  const [ayahs, setAyahs] = useState<Ayah[]>([]);
  const [ayahsLoading, setAyahsLoading] = useState(false);
  const [startVerse, setStartVerse] = useState(1);
  const [endVerse, setEndVerse] = useState(1);
  const [selectedReciter, setSelectedReciter] = useState<Reciter | null>(null);
  const [settings, setSettings] = useState<VideoSettings>({
    background: "gradient",
    fontSize: "medium",
    showTranslation: true,
    translationLang: locale === "ar" ? "ar" : locale === "fr" ? "fr" : "en",
    aspectRatio: "9:16",
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [generatedVideo, setGeneratedVideo] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Fetch all 114 surahs
  useEffect(() => {
    fetch(`${API_BASE}/surah`)
      .then((r) => r.json())
      .then((data) => {
        if (data.code === 200) setAllSurahs(data.data);
      })
      .catch(console.error)
      .finally(() => setSurahsLoading(false));
  }, []);

  // Fetch reciters
  useEffect(() => {
    fetch(`${API_BASE}/edition?format=audio&language=ar&type=versebyverse`)
      .then((r) => r.json())
      .then((data) => {
        if (data.code === 200) {
          const unique = data.data.filter(
            (r: Reciter) => !r.identifier.endsWith("-2"),
          );
          setReciters(unique);
        }
      })
      .catch(console.error)
      .finally(() => setRecitersLoading(false));
  }, []);

  // Fetch ayahs when surah selected
  useEffect(() => {
    if (!selectedSurah) {
      setAyahs([]);
      return;
    }
    setAyahsLoading(true);
    setAyahs([]);

    const transId =
      settings.translationLang === "fr"
        ? "fr.hamidullah"
        : settings.translationLang === "en"
          ? "en.sahih"
          : "quran-uthmani";

    // Fetch Arabic text
    fetch(`${API_BASE}/surah/${selectedSurah.number}/quran-uthmani`)
      .then((r) => r.json())
      .then((data) => {
        if (data.code === 200) {
          const baseAyahs = data.data.ayahs.map((a: any) => ({
            number: a.number,
            numberInSurah: a.numberInSurah,
            text: a.text,
            juz: a.juz,
            page: a.page,
            sajda: a.sajda,
          }));
          setAyahs(baseAyahs);

          // Fetch translation separately
          if (settings.translationLang !== "ar") {
            fetch(`${API_BASE}/surah/${selectedSurah.number}/${transId}`)
              .then((r) => r.json())
              .then((transData) => {
                if (transData.code === 200) {
                  setAyahs((prev) =>
                    prev.map((ayah, idx) => ({
                      ...ayah,
                      translation: transData.data.ayahs[idx]?.text || "",
                    })),
                  );
                }
              })
              .catch(console.error);
          }
        }
      })
      .catch(console.error)
      .finally(() => setAyahsLoading(false));
  }, [selectedSurah, settings.translationLang]);

  // Fetch audio URLs when reciter selected
  useEffect(() => {
    if (!selectedSurah || !selectedReciter || ayahs.length === 0) return;
    fetch(
      `${API_BASE}/surah/${selectedSurah.number}/${selectedReciter.identifier}`,
    )
      .then((r) => r.json())
      .then((data) => {
        if (data.code === 200) {
          setAyahs((prev) =>
            prev.map((ayah) => {
              const audioAyah = data.data.ayahs.find(
                (a: any) => a.numberInSurah === ayah.numberInSurah,
              );
              return {
                ...ayah,
                audio:
                  audioAyah?.audio ||
                  `${AUDIO_CDN}/${selectedReciter.identifier}/${ayah.number}.mp3`,
                audioSecondary: audioAyah?.audioSecondary || [],
              };
            }),
          );
        }
      })
      .catch(console.error);
  }, [selectedSurah, selectedReciter, ayahs.length]);

  const filteredSurahs = useMemo(() => {
    if (!searchQuery.trim()) return allSurahs;
    const q = searchQuery.toLowerCase();
    return allSurahs.filter(
      (s) =>
        s.englishName.toLowerCase().includes(q) ||
        s.englishNameTranslation.toLowerCase().includes(q) ||
        s.name.includes(searchQuery) ||
        s.number.toString().includes(searchQuery),
    );
  }, [allSurahs, searchQuery]);

  const handleSurahSelect = (surah: Surah) => {
    setSelectedSurah(surah);
    setStartVerse(1);
    setEndVerse(Math.min(3, surah.numberOfAyahs));
    setGeneratedVideo(null);
    setAudioPlaying(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
  };

  const handleGenerate = useCallback(async () => {
    if (!selectedSurah || !selectedReciter) return;
    setIsGenerating(true);
    setProgress(0);
    setGeneratedVideo(null);
    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          clearInterval(interval);
          return 100;
        }
        return p + Math.random() * 12 + 3;
      });
    }, 600);
    await new Promise((resolve) => setTimeout(resolve, 5000));
    clearInterval(interval);
    setProgress(100);
    setIsGenerating(false);
    setGeneratedVideo(
      `/api/videos/${selectedSurah.number}_${startVerse}-${endVerse}_${selectedReciter.identifier}.mp4`,
    );
  }, [selectedSurah, selectedReciter, startVerse, endVerse]);

  const toggleAudio = async () => {
    if (!selectedReciter || !selectedSurah) return;
    if (audioPlaying) {
      if (audioRef.current) audioRef.current.pause();
      setAudioPlaying(false);
      return;
    }
    setAudioLoading(true);
    setAudioError(null);
    const previewAyah = startVerse || 1;
    const globalAyahNum =
      allSurahs
        .slice(0, selectedSurah.number - 1)
        .reduce((acc, s) => acc + s.numberOfAyahs, 0) + previewAyah;
    const audioUrl = `${AUDIO_CDN}/${selectedReciter.identifier}/${globalAyahNum}.mp3`;
    try {
      if (!audioRef.current) audioRef.current = new Audio();
      audioRef.current.src = audioUrl;
      audioRef.current.onerror = () => {
        setAudioError(
          locale === "ar"
            ? "معاينة الصوت غير متوفرة"
            : locale === "fr"
              ? "Aperçu audio indisponible"
              : "Audio preview unavailable",
        );
        setAudioLoading(false);
      };
      audioRef.current.oncanplaythrough = () => {
        setAudioLoading(false);
        audioRef.current!.play().catch(() => {});
        setAudioPlaying(true);
      };
      audioRef.current.onended = () => setAudioPlaying(false);
      audioRef.current.load();
    } catch {
      setAudioError("Failed to load audio");
      setAudioLoading(false);
    }
  };

  // ─── Step 1: Surah Selection ────────────────────────────────────
  const SurahStep = () => (
    <div className="animate-fade-up">
      <div className="text-center mb-10">
        <div className="flex items-center justify-center gap-4 mb-4">
          <div className="h-px w-12 bg-gradient-to-r from-transparent to-gold/40" />
          <svg
            className="h-4 w-4 text-gold/50"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5Z" />
          </svg>
          <div className="h-px w-12 bg-gradient-to-l from-transparent to-gold/40" />
        </div>
        <h2 className="font-display text-3xl font-medium text-parchment sm:text-4xl">
          {locale === "ar"
            ? "اختر السورة"
            : locale === "fr"
              ? "Choisir une sourate"
              : "Choose a Surah"}
        </h2>
        <p className="mt-3 text-parchment-muted">
          {locale === "ar"
            ? "اختر من القرآن الكريم"
            : locale === "fr"
              ? "Sélectionnez dans le Saint Coran"
              : "Select from the Holy Qur\'an"}
        </p>
      </div>

      <div className="relative max-w-md mx-auto mb-8">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={
            locale === "ar"
              ? "ابحث عن سورة..."
              : locale === "fr"
                ? "Rechercher une sourate..."
                : "Search for a surah..."
          }
          className="w-full rounded-full border border-gold/20 bg-ink-light/50 px-5 py-3 pl-12 text-sm text-parchment placeholder-parchment-muted/50 outline-none transition focus:border-gold/40 focus:ring-1 focus:ring-gold/20"
        />
        <svg
          className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gold/40"
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

      {surahsLoading && (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gold/30 border-t-gold" />
        </div>
      )}

      {!surahsLoading && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 max-w-5xl mx-auto">
          {filteredSurahs.map((surah) => (
            <button
              key={surah.number}
              onClick={() => handleSurahSelect(surah)}
              className={`group relative rounded-sm border p-5 text-left transition-all duration-300 hover:-translate-y-0.5 ${
                selectedSurah?.number === surah.number
                  ? "border-gold/40 bg-gold/10 shadow-lg shadow-gold/5"
                  : "border-gold/10 bg-ink-light/30 hover:border-gold/25 hover:bg-ink-light/50"
              }`}
            >
              <div className="absolute top-0 left-0 h-3 w-3 border-t border-l border-gold/20" />
              <div className="absolute top-0 right-0 h-3 w-3 border-t border-r border-gold/20" />
              <div className="absolute bottom-0 left-0 h-3 w-3 border-b border-l border-gold/20" />
              <div className="absolute bottom-0 right-0 h-3 w-3 border-b border-r border-gold/20" />
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gold/10 text-xs text-gold/80 font-medium">
                      {surah.number}
                    </span>
                    <span className="text-[10px] uppercase tracking-wider text-parchment-muted/50">
                      {surah.revelationType === "Meccan"
                        ? locale === "ar"
                          ? "مكية"
                          : locale === "fr"
                            ? "Mecquoise"
                            : "Meccan"
                        : locale === "ar"
                          ? "مدنية"
                          : locale === "fr"
                            ? "Médinoise"
                            : "Medinan"}
                    </span>
                  </div>
                  <h3
                    className="mt-2 text-lg font-medium text-parchment truncate"
                    style={{
                      fontFamily: "\'Amiri\', \'Scheherazade New\', serif",
                    }}
                  >
                    {surah.name}
                  </h3>
                  <p className="text-xs text-parchment-muted mt-1">
                    {surah.englishName}
                  </p>
                  <p className="text-[10px] text-parchment-muted/40 mt-0.5">
                    {surah.englishNameTranslation}
                  </p>
                </div>
                <div className="text-right ml-3">
                  <span className="text-xs text-parchment-muted/60 block">
                    {surah.numberOfAyahs}
                  </span>
                  <span className="text-[10px] text-parchment-muted/40">
                    {locale === "ar" ? "آية" : "verses"}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {filteredSurahs.length === 0 && !surahsLoading && (
        <div className="text-center py-12 text-parchment-muted">
          {locale === "ar"
            ? "لا توجد نتائج"
            : locale === "fr"
              ? "Aucun résultat"
              : "No results found"}
        </div>
      )}

      {selectedSurah && (
        <div className="mt-8 flex justify-center">
          <button
            onClick={() => setStep(2)}
            className="group relative cursor-pointer overflow-hidden rounded-full bg-gold px-8 py-3.5 text-sm font-semibold text-ink transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-gold/20"
          >
            <span className="absolute inset-0 -translate-x-full bg-parchment/30 transition-transform duration-700 group-hover:translate-x-full" />
            <span className="relative flex items-center gap-2">
              {locale === "ar"
                ? "التالي"
                : locale === "fr"
                  ? "Suivant"
                  : "Next"}
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
                  d="M17 8l4 4m0 0l-4 4m4-4H3"
                />
              </svg>
            </span>
          </button>
        </div>
      )}
    </div>
  );

  // ─── Step 2: Verse Selection (Professional List View) ──────────
  const VerseStep = () => {
    if (!selectedSurah) return null;
    const selectedCount = endVerse - startVerse + 1;
    return (
      <div className="animate-fade-up max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-4 mb-4">
            <div className="h-px w-12 bg-gradient-to-r from-transparent to-gold/40" />
            <svg
              className="h-4 w-4 text-gold/50"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5Z" />
            </svg>
            <div className="h-px w-12 bg-gradient-to-l from-transparent to-gold/40" />
          </div>
          <h2 className="font-display text-3xl font-medium text-parchment sm:text-4xl">
            {locale === "ar"
              ? "اختر الآيات"
              : locale === "fr"
                ? "Choisir les versets"
                : "Select Verses"}
          </h2>
          <p className="mt-3 text-parchment-muted">
            {selectedSurah.name} — {selectedSurah.numberOfAyahs}{" "}
            {locale === "ar" ? "آية" : "verses"}
          </p>
        </div>

        {/* Quick Range Selectors */}
        <div className="mb-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              setStartVerse(1);
              setEndVerse(Math.min(3, selectedSurah.numberOfAyahs));
            }}
            className="rounded-full border border-gold/20 bg-ink-light/30 px-4 py-1.5 text-xs text-parchment-muted transition hover:border-gold/40 hover:text-gold"
          >
            {locale === "ar"
              ? "أول 3 آيات"
              : locale === "fr"
                ? "Premiers 3 versets"
                : "First 3 verses"}
          </button>
          <button
            onClick={() => {
              setStartVerse(1);
              setEndVerse(selectedSurah.numberOfAyahs);
            }}
            className="rounded-full border border-gold/20 bg-ink-light/30 px-4 py-1.5 text-xs text-parchment-muted transition hover:border-gold/40 hover:text-gold"
          >
            {locale === "ar"
              ? "السورة كاملة"
              : locale === "fr"
                ? "Sourate entière"
                : "Full surah"}
          </button>
          {selectedSurah.numberOfAyahs > 10 && (
            <button
              onClick={() => {
                const mid = Math.floor(selectedSurah.numberOfAyahs / 2);
                setStartVerse(Math.max(1, mid - 2));
                setEndVerse(Math.min(selectedSurah.numberOfAyahs, mid + 2));
              }}
              className="rounded-full border border-gold/20 bg-ink-light/30 px-4 py-1.5 text-xs text-parchment-muted transition hover:border-gold/40 hover:text-gold"
            >
              {locale === "ar"
                ? "منتصف السورة"
                : locale === "fr"
                  ? "Milieu"
                  : "Middle"}
            </button>
          )}
        </div>

        {/* Range Controls */}
        <div className="rounded-sm border border-gold/15 bg-ink-light/30 p-6 mb-6">
          <div className="space-y-5">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm text-parchment-muted">
                  {locale === "ar"
                    ? "من الآية"
                    : locale === "fr"
                      ? "Du verset"
                      : "From verse"}
                </label>
                <span className="text-sm font-medium text-gold">
                  {startVerse}
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={selectedSurah.numberOfAyahs}
                value={startVerse}
                onChange={(e) => {
                  const v = parseInt(e.target.value);
                  setStartVerse(v);
                  if (v > endVerse) setEndVerse(v);
                }}
                className="w-full h-2 appearance-none rounded-full bg-gold/20 accent-gold outline-none cursor-pointer"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm text-parchment-muted">
                  {locale === "ar"
                    ? "إلى الآية"
                    : locale === "fr"
                      ? "Au verset"
                      : "To verse"}
                </label>
                <span className="text-sm font-medium text-gold">
                  {endVerse}
                </span>
              </div>
              <input
                type="range"
                min={startVerse}
                max={selectedSurah.numberOfAyahs}
                value={endVerse}
                onChange={(e) => setEndVerse(parseInt(e.target.value))}
                className="w-full h-2 appearance-none rounded-full bg-gold/20 accent-gold outline-none cursor-pointer"
              />
            </div>
            <div className="flex items-center justify-center gap-2 rounded-full border border-gold/20 bg-gold/5 px-4 py-2 text-sm text-gold/80">
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                />
              </svg>
              {selectedCount}{" "}
              {locale === "ar"
                ? "آيات مختارة"
                : locale === "fr"
                  ? "versets sélectionnés"
                  : "verses selected"}
            </div>
          </div>
        </div>

        {/* Ayah List Preview */}
        <div className="rounded-sm border border-gold/15 bg-ink-light/20 overflow-hidden">
          <div className="border-b border-gold/10 px-4 py-3 flex items-center justify-between">
            <h3 className="text-sm font-medium text-parchment">
              {locale === "ar"
                ? "معاينة الآيات"
                : locale === "fr"
                  ? "Aperçu des versets"
                  : "Verse Preview"}
            </h3>
            <span className="text-xs text-parchment-muted">
              {ayahsLoading
                ? "Loading..."
                : `${ayahs.length} ${locale === "ar" ? "آية محملة" : "loaded"}`}
            </span>
          </div>
          {ayahsLoading ? (
            <div className="flex justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-gold/30 border-t-gold" />
            </div>
          ) : (
            <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
              {ayahs.map((ayah) => {
                const isInRange =
                  ayah.numberInSurah >= startVerse &&
                  ayah.numberInSurah <= endVerse;
                return (
                  <div
                    key={ayah.numberInSurah}
                    onClick={() => {
                      if (!isInRange) {
                        setStartVerse(ayah.numberInSurah);
                        setEndVerse(
                          Math.min(
                            ayah.numberInSurah + 2,
                            selectedSurah.numberOfAyahs,
                          ),
                        );
                      }
                    }}
                    className={`border-b border-gold/5 px-4 py-3 transition cursor-pointer ${isInRange ? "bg-gold/5 border-l-2 border-l-gold/40" : "hover:bg-ink-light/40 border-l-2 border-l-transparent opacity-50"}`}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-medium ${isInRange ? "bg-gold/20 text-gold" : "bg-parchment/5 text-parchment-muted"}`}
                      >
                        {ayah.numberInSurah}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p
                          className="text-sm text-parchment leading-relaxed"
                          style={{
                            fontFamily:
                              "\'Amiri\', \'Scheherazade New\', serif",
                          }}
                          dir="rtl"
                        >
                          {ayah.text}
                        </p>
                        {settings.showTranslation && ayah.translation && (
                          <p className="mt-1.5 text-xs text-parchment-muted/60 leading-relaxed">
                            {ayah.translation}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-8 flex justify-center gap-4">
          <button
            onClick={() => setStep(1)}
            className="cursor-pointer rounded-full border border-parchment/20 px-6 py-3 text-sm text-parchment transition hover:border-gold/40 hover:text-gold"
          >
            {locale === "ar" ? "رجوع" : locale === "fr" ? "Retour" : "Back"}
          </button>
          <button
            onClick={() => setStep(3)}
            className="group relative cursor-pointer overflow-hidden rounded-full bg-gold px-8 py-3.5 text-sm font-semibold text-ink transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-gold/20"
          >
            <span className="absolute inset-0 -translate-x-full bg-parchment/30 transition-transform duration-700 group-hover:translate-x-full" />
            <span className="relative flex items-center gap-2">
              {locale === "ar"
                ? "التالي"
                : locale === "fr"
                  ? "Suivant"
                  : "Next"}
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
                  d="M17 8l4 4m0 0l-4 4m4-4H3"
                />
              </svg>
            </span>
          </button>
        </div>
      </div>
    );
  };

  // ─── Step 3: Reciter & Settings ─────────────────────────────────
  const SettingsStep = () => (
    <div className="animate-fade-up max-w-4xl mx-auto">
      <div className="text-center mb-10">
        <div className="flex items-center justify-center gap-4 mb-4">
          <div className="h-px w-12 bg-gradient-to-r from-transparent to-gold/40" />
          <svg
            className="h-4 w-4 text-gold/50"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5Z" />
          </svg>
          <div className="h-px w-12 bg-gradient-to-l from-transparent to-gold/40" />
        </div>
        <h2 className="font-display text-3xl font-medium text-parchment sm:text-4xl">
          {locale === "ar"
            ? "القارئ والإعدادات"
            : locale === "fr"
              ? "Récitateur et paramètres"
              : "Reciter & Settings"}
        </h2>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Reciter Selection */}
        <div>
          <h3 className="text-sm uppercase tracking-wider text-gold/60 mb-4">
            {locale === "ar"
              ? "اختر القارئ"
              : locale === "fr"
                ? "Choisir le récitateur"
                : "Choose Reciter"}
          </h3>
          {recitersLoading ? (
            <div className="flex justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-gold/30 border-t-gold" />
            </div>
          ) : (
            <div className="space-y-2 max-h-[420px] overflow-y-auto custom-scrollbar pr-1">
              {reciters.map((reciter) => (
                <button
                  key={reciter.identifier}
                  onClick={() => {
                    setSelectedReciter(reciter);
                    setAudioPlaying(false);
                    setAudioError(null);
                  }}
                  className={`group flex w-full items-center gap-4 rounded-sm border p-4 text-left transition-all ${selectedReciter?.identifier === reciter.identifier ? "border-gold/40 bg-gold/10 shadow-md shadow-gold/5" : "border-gold/10 bg-ink-light/20 hover:border-gold/25 hover:bg-ink-light/40"}`}
                >
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-colors ${selectedReciter?.identifier === reciter.identifier ? "border-gold/40 bg-gold/20" : "border-gold/15 bg-gold/5"}`}
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
                      {reciter.englishName}
                    </p>
                    <p className="text-xs text-parchment-muted truncate">
                      {reciter.name}
                    </p>
                  </div>
                  {selectedReciter?.identifier === reciter.identifier && (
                    <svg
                      className="h-5 w-5 text-gold shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Audio Preview */}
          {selectedReciter && selectedSurah && (
            <div className="mt-4 rounded-sm border border-gold/15 bg-ink-light/30 p-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={toggleAudio}
                  disabled={audioLoading}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-gold/20 text-gold transition hover:bg-gold/30 disabled:opacity-50"
                >
                  {audioLoading ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-gold/30 border-t-gold" />
                  ) : audioPlaying ? (
                    <svg
                      className="h-4 w-4"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <rect x="6" y="4" width="4" height="16" />
                      <rect x="14" y="4" width="4" height="16" />
                    </svg>
                  ) : (
                    <svg
                      className="h-4 w-4"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  )}
                </button>
                <div className="flex-1">
                  <p className="text-xs text-parchment-muted mb-1">
                    {audioError ||
                      (audioPlaying
                        ? `${selectedReciter.englishName} — ${selectedSurah.englishName} ${startVerse}`
                        : locale === "ar"
                          ? "اضغط للمعاينة"
                          : locale === "fr"
                            ? "Cliquez pour pré-écouter"
                            : "Click to preview")}
                  </p>
                  <div className="h-1.5 rounded-full bg-gold/10 overflow-hidden">
                    <div
                      className={`h-full rounded-full bg-gold/40 transition-all ${audioPlaying ? "animate-pulse w-full" : "w-0"}`}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Settings */}
        <div>
          <h3 className="text-sm uppercase tracking-wider text-gold/60 mb-4">
            {locale === "ar"
              ? "إعدادات الفيديو"
              : locale === "fr"
                ? "Paramètres vidéo"
                : "Video Settings"}
          </h3>
          <div className="space-y-5">
            {/* Background */}
            <div>
              <label className="text-sm text-parchment-muted mb-2 block">
                {locale === "ar"
                  ? "الخلفية"
                  : locale === "fr"
                    ? "Arrière-plan"
                    : "Background"}
              </label>
              <div className="grid grid-cols-2 gap-2">
                {BACKGROUNDS.map((bg) => (
                  <button
                    key={bg.id}
                    onClick={() =>
                      setSettings((s) => ({ ...s, background: bg.id as any }))
                    }
                    className={`relative rounded-sm border p-3 text-left transition-all ${settings.background === bg.id ? "border-gold/40 bg-gold/10" : "border-gold/10 hover:border-gold/25"}`}
                  >
                    <div
                      className={`h-8 w-full rounded-sm ${bg.preview} mb-2`}
                    />
                    <span className="text-xs text-parchment-muted">
                      {bg.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Font Size */}
            <div>
              <label className="text-sm text-parchment-muted mb-2 block">
                {locale === "ar"
                  ? "حجم الخط"
                  : locale === "fr"
                    ? "Taille du texte"
                    : "Font Size"}
              </label>
              <div className="flex gap-2">
                {(["small", "medium", "large"] as const).map((size) => (
                  <button
                    key={size}
                    onClick={() =>
                      setSettings((s) => ({ ...s, fontSize: size }))
                    }
                    className={`flex-1 rounded-sm border py-2 text-xs transition-all ${settings.fontSize === size ? "border-gold/40 bg-gold/15 text-gold" : "border-gold/10 text-parchment-muted hover:border-gold/25"}`}
                  >
                    {size === "small"
                      ? locale === "ar"
                        ? "صغير"
                        : "S"
                      : size === "medium"
                        ? locale === "ar"
                          ? "متوسط"
                          : "M"
                        : locale === "ar"
                          ? "كبير"
                          : "L"}
                  </button>
                ))}
              </div>
            </div>

            {/* Aspect Ratio */}
            <div>
              <label className="text-sm text-parchment-muted mb-2 block">
                {locale === "ar"
                  ? "نسبة العرض"
                  : locale === "fr"
                    ? "Format"
                    : "Aspect Ratio"}
              </label>
              <div className="flex gap-2">
                {(["16:9", "9:16", "1:1"] as const).map((ratio) => (
                  <button
                    key={ratio}
                    onClick={() =>
                      setSettings((s) => ({ ...s, aspectRatio: ratio }))
                    }
                    className={`flex-1 rounded-sm border py-2 text-xs transition-all ${settings.aspectRatio === ratio ? "border-gold/40 bg-gold/15 text-gold" : "border-gold/10 text-parchment-muted hover:border-gold/25"}`}
                  >
                    {ratio}
                  </button>
                ))}
              </div>
            </div>

            {/* Translation Language */}
            <div>
              <label className="text-sm text-parchment-muted mb-2 block">
                {locale === "ar"
                  ? "لغة الترجمة"
                  : locale === "fr"
                    ? "Langue de traduction"
                    : "Translation Language"}
              </label>
              <div className="flex gap-2">
                {[
                  {
                    id: "en",
                    label: locale === "ar" ? "الإنجليزية" : "English",
                  },
                  {
                    id: "fr",
                    label: locale === "ar" ? "الفرنسية" : "Français",
                  },
                  { id: "ar", label: locale === "ar" ? "العربية" : "Arabic" },
                ].map((lang) => (
                  <button
                    key={lang.id}
                    onClick={() => {
                      setSettings((s) => ({ ...s, translationLang: lang.id }));
                      if (selectedSurah) {
                        setAyahsLoading(true);
                        const transId =
                          lang.id === "fr"
                            ? "fr.hamidullah"
                            : lang.id === "en"
                              ? "en.sahih"
                              : "quran-uthmani";
                        fetch(
                          `${API_BASE}/surah/${selectedSurah.number}/${transId}`,
                        )
                          .then((r) => r.json())
                          .then((data) => {
                            if (data.code === 200) {
                              setAyahs((prev) =>
                                prev.map((ayah, idx) => ({
                                  ...ayah,
                                  translation:
                                    lang.id === "ar"
                                      ? undefined
                                      : data.data.ayahs[idx]?.text || "",
                                })),
                              );
                            }
                          })
                          .catch(console.error)
                          .finally(() => setAyahsLoading(false));
                      }
                    }}
                    className={`flex-1 rounded-sm border py-2 text-xs transition-all ${settings.translationLang === lang.id ? "border-gold/40 bg-gold/15 text-gold" : "border-gold/10 text-parchment-muted hover:border-gold/25"}`}
                  >
                    {lang.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Translation toggle */}
            <label
              className="flex items-center gap-3 cursor-pointer"
              onClick={() =>
                setSettings((s) => ({
                  ...s,
                  showTranslation: !s.showTranslation,
                }))
              }
            >
              <div
                className={`relative h-5 w-9 rounded-full transition-colors ${settings.showTranslation ? "bg-gold/40" : "bg-parchment/10"}`}
              >
                <div
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-parchment transition-transform ${settings.showTranslation ? "translate-x-4" : "translate-x-0.5"}`}
                />
              </div>
              <span className="text-sm text-parchment-muted">
                {locale === "ar"
                  ? "إظهار الترجمة"
                  : locale === "fr"
                    ? "Afficher la traduction"
                    : "Show Translation"}
              </span>
            </label>
          </div>
        </div>
      </div>

      <div className="mt-10 flex justify-center gap-4">
        <button
          onClick={() => setStep(2)}
          className="cursor-pointer rounded-full border border-parchment/20 px-6 py-3 text-sm text-parchment transition hover:border-gold/40 hover:text-gold"
        >
          {locale === "ar" ? "رجوع" : locale === "fr" ? "Retour" : "Back"}
        </button>
        <SignedIn>
          <button
            onClick={() => setStep(4)}
            disabled={!selectedReciter}
            className="group relative cursor-pointer overflow-hidden rounded-full bg-gold px-8 py-3.5 text-sm font-semibold text-ink transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-gold/20 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span className="absolute inset-0 -translate-x-full bg-parchment/30 transition-transform duration-700 group-hover:translate-x-full" />
            <span className="relative flex items-center gap-2">
              {locale === "ar"
                ? "معاينة"
                : locale === "fr"
                  ? "Aperçu"
                  : "Preview"}
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
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                />
              </svg>
            </span>
          </button>
        </SignedIn>
        <SignedOut>
          <SignInButton mode="modal">
            <button className="group relative cursor-pointer overflow-hidden rounded-full border-2 border-gold/40 bg-gold/10 px-8 py-3.5 text-sm font-semibold text-gold transition-all hover:bg-gold/20 hover:border-gold/60">
              <span className="relative flex items-center gap-2">
                {locale === "ar"
                  ? "سجل الدخول للمتابعة"
                  : locale === "fr"
                    ? "Connectez-vous pour continuer"
                    : "Sign in to continue"}
              </span>
            </button>
          </SignInButton>
        </SignedOut>
      </div>
    </div>
  );

  // ─── Step 4: Preview & Generate ───────────────────────────────────
  const PreviewStep = () => {
    if (!selectedSurah || !selectedReciter) return null;
    const bgPreview =
      BACKGROUNDS.find((b) => b.id === settings.background)?.preview ||
      "bg-ink";
    const selectedAyahs = ayahs.filter(
      (a) => a.numberInSurah >= startVerse && a.numberInSurah <= endVerse,
    );
    const firstAyah = selectedAyahs[0];
    return (
      <div className="animate-fade-up max-w-3xl mx-auto">
        <div className="text-center mb-10">
          <div className="flex items-center justify-center gap-4 mb-4">
            <div className="h-px w-12 bg-gradient-to-r from-transparent to-gold/40" />
            <svg
              className="h-4 w-4 text-gold/50"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5Z" />
            </svg>
            <div className="h-px w-12 bg-gradient-to-l from-transparent to-gold/40" />
          </div>
          <h2 className="font-display text-3xl font-medium text-parchment sm:text-4xl">
            {locale === "ar"
              ? "معاينة"
              : locale === "fr"
                ? "Aperçu"
                : "Preview"}
          </h2>
        </div>

        <div
          className="relative mx-auto overflow-hidden rounded-sm border-2 border-gold/20 shadow-2xl shadow-gold/5"
          style={{
            aspectRatio:
              settings.aspectRatio === "9:16"
                ? "9/16"
                : settings.aspectRatio === "1:1"
                  ? "1/1"
                  : "16/9",
            maxHeight: "520px",
          }}
        >
          <div className={`absolute inset-0 ${bgPreview}`} />
          {settings.background === "abstract" && (
            <div className="absolute inset-0 opacity-[0.08]">
              <svg className="h-full w-full">
                <defs>
                  <pattern
                    id="preview-girih"
                    x="0"
                    y="0"
                    width="60"
                    height="60"
                    patternUnits="userSpaceOnUse"
                  >
                    <path
                      d="M30,0 L33,27 L60,30 L33,33 L30,60 L27,33 L0,30 L27,27 Z"
                      fill="none"
                      stroke="#d4af37"
                      strokeWidth="0.5"
                    />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#preview-girih)" />
              </svg>
            </div>
          )}
          <div className="absolute left-1/2 top-1/2 h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold/[0.08] blur-[50px]" />
          <div className="relative z-10 flex h-full flex-col items-center justify-center p-6 text-center">
            <p className="text-xs text-gold/40 mb-2 uppercase tracking-widest">
              {selectedSurah.englishName}
            </p>
            {firstAyah && (
              <p
                className={`text-gold drop-shadow-lg leading-relaxed ${settings.fontSize === "small" ? "text-lg" : settings.fontSize === "medium" ? "text-xl" : "text-2xl"}`}
                style={{
                  fontFamily: "\'Amiri\', \'Scheherazade New\', serif",
                  textShadow: "0 0 30px rgba(212,175,55,0.2)",
                }}
                dir="rtl"
              >
                {firstAyah.text.length > 120
                  ? firstAyah.text.substring(0, 120) + "..."
                  : firstAyah.text}
              </p>
            )}
            <div className="my-3 flex items-center gap-3">
              <div className="h-px w-8 bg-gradient-to-r from-transparent to-gold/40" />
              <svg
                className="h-3 w-3 text-gold/50"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5Z" />
              </svg>
              <div className="h-px w-8 bg-gradient-to-l from-transparent to-gold/40" />
            </div>
            <p
              className={`text-parchment/90 ${settings.fontSize === "small" ? "text-xs" : settings.fontSize === "medium" ? "text-sm" : "text-base"}`}
            >
              {selectedSurah.name} —{" "}
              {locale === "ar"
                ? `الآيات ${startVerse} إلى ${endVerse}`
                : `Verses ${startVerse} to ${endVerse}`}
            </p>
            {settings.showTranslation && firstAyah?.translation && (
              <p className="mt-3 text-xs text-parchment/50 max-w-xs leading-relaxed">
                {firstAyah.translation.length > 150
                  ? firstAyah.translation.substring(0, 150) + "..."
                  : firstAyah.translation}
              </p>
            )}
            <div className="mt-4 flex items-center gap-2 text-xs text-gold/50">
              <svg
                className="h-3 w-3"
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
              {selectedReciter.englishName}
            </div>
          </div>
          <div className="absolute top-2 left-2 h-4 w-4 border-t border-l border-gold/30" />
          <div className="absolute top-2 right-2 h-4 w-4 border-t border-r border-gold/30" />
          <div className="absolute bottom-2 left-2 h-4 w-4 border-b border-l border-gold/30" />
          <div className="absolute bottom-2 right-2 h-4 w-4 border-b border-r border-gold/30" />
        </div>

        {/* Summary */}
        <div className="mt-6 rounded-sm border border-gold/15 bg-ink-light/30 p-5">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-parchment-muted">
                {locale === "ar" ? "السورة" : "Surah"}:
              </span>
              <span className="ml-2 text-parchment">{selectedSurah.name}</span>
            </div>
            <div>
              <span className="text-parchment-muted">
                {locale === "ar" ? "الآيات" : "Verses"}:
              </span>
              <span className="ml-2 text-parchment">
                {startVerse} — {endVerse}
              </span>
            </div>
            <div>
              <span className="text-parchment-muted">
                {locale === "ar" ? "القارئ" : "Reciter"}:
              </span>
              <span className="ml-2 text-parchment">
                {selectedReciter.englishName}
              </span>
            </div>
            <div>
              <span className="text-parchment-muted">
                {locale === "ar" ? "المدة المتوقعة" : "Est. Duration"}:
              </span>
              <span className="ml-2 text-parchment">
                ~{Math.max(8, (endVerse - startVerse + 1) * 6)}s
              </span>
            </div>
          </div>
        </div>

        <div className="mt-8 flex justify-center gap-4">
          <button
            onClick={() => setStep(3)}
            className="cursor-pointer rounded-full border border-parchment/20 px-6 py-3 text-sm text-parchment transition hover:border-gold/40 hover:text-gold"
          >
            {locale === "ar" ? "رجوع" : locale === "fr" ? "Retour" : "Back"}
          </button>
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="group relative cursor-pointer overflow-hidden rounded-full bg-gold px-10 py-3.5 text-sm font-semibold text-ink transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-gold/20 disabled:opacity-60"
          >
            <span className="absolute inset-0 -translate-x-full bg-parchment/30 transition-transform duration-700 group-hover:translate-x-full" />
            <span className="relative flex items-center gap-2">
              {isGenerating ? (
                <>
                  <svg
                    className="h-4 w-4 animate-spin"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  {Math.round(progress)}%
                </>
              ) : (
                <>
                  {locale === "ar"
                    ? "إنشاء الفيديو"
                    : locale === "fr"
                      ? "Créer la vidéo"
                      : "Generate Video"}
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
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                </>
              )}
            </span>
          </button>
        </div>

        {isGenerating && (
          <div className="mt-6 max-w-md mx-auto">
            <div className="h-2 rounded-full bg-gold/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-gold to-gold-soft transition-all duration-300"
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
            <p className="mt-2 text-center text-xs text-parchment-muted">
              {locale === "ar"
                ? "جاري إنشاء الفيديو..."
                : locale === "fr"
                  ? "Création de la vidéo..."
                  : "Generating your video..."}
            </p>
          </div>
        )}

        {generatedVideo && !isGenerating && (
          <div className="mt-8 animate-fade-up rounded-sm border-2 border-gold/30 bg-gold/5 p-8 text-center">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gold/20">
                <svg
                  className="h-6 w-6 text-gold"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
            </div>
            <h3 className="text-lg font-medium text-parchment mb-2">
              {locale === "ar"
                ? "تم إنشاء الفيديو!"
                : locale === "fr"
                  ? "Vidéo créée !"
                  : "Video Ready!"}
            </h3>
            <p className="text-sm text-parchment-muted mb-6">
              {locale === "ar"
                ? "الفيديو جاهز للتحميل"
                : locale === "fr"
                  ? "Votre vidéo est prête à être téléchargée"
                  : "Your video is ready for download"}
            </p>
            <div className="flex justify-center gap-3">
              <a
                href={generatedVideo}
                download
                className="inline-flex items-center gap-2 rounded-full bg-gold px-6 py-2.5 text-sm font-medium text-ink transition hover:bg-gold-soft"
              >
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
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
                {locale === "ar"
                  ? "تحميل"
                  : locale === "fr"
                    ? "Télécharger"
                    : "Download"}
              </a>
              <button
                onClick={() => {
                  setStep(1);
                  setGeneratedVideo(null);
                  setSelectedSurah(null);
                  setSelectedReciter(null);
                  setAyahs([]);
                  setStartVerse(1);
                  setEndVerse(1);
                }}
                className="inline-flex items-center gap-2 rounded-full border border-gold/30 px-6 py-2.5 text-sm text-gold transition hover:bg-gold/10"
              >
                {locale === "ar"
                  ? "إنشاء جديد"
                  : locale === "fr"
                    ? "Nouveau"
                    : "Create New"}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ─── Step Indicator ───────────────────────────────────────────────
  const StepIndicator = () => {
    const steps = [
      {
        num: 1,
        label:
          locale === "ar" ? "السورة" : locale === "fr" ? "Sourate" : "Surah",
      },
      {
        num: 2,
        label:
          locale === "ar" ? "الآيات" : locale === "fr" ? "Versets" : "Verses",
      },
      {
        num: 3,
        label:
          locale === "ar"
            ? "الإعدادات"
            : locale === "fr"
              ? "Paramètres"
              : "Settings",
      },
      {
        num: 4,
        label:
          locale === "ar" ? "المعاينة" : locale === "fr" ? "Aperçu" : "Preview",
      },
    ];
    return (
      <div className="mb-12 flex items-center justify-center gap-2">
        {steps.map((s, i) => (
          <div key={s.num} className="flex items-center gap-2">
            <div className="flex flex-col items-center">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold transition-all ${step >= s.num ? "border-gold/40 bg-gold/15 text-gold" : "border-gold/10 bg-ink-light/30 text-parchment-muted"}`}
              >
                {step > s.num ? (
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
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                ) : (
                  s.num
                )}
              </div>
              <span
                className={`mt-1 text-[10px] ${step >= s.num ? "text-gold/60" : "text-parchment-muted/40"}`}
              >
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={`h-px w-8 sm:w-12 ${step > s.num ? "bg-gold/30" : "bg-gold/10"}`}
              />
            )}
          </div>
        ))}
      </div>
    );
  };

  // ─── Main Render ──────────────────────────────────────────────────
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="absolute left-1/2 top-0 h-[500px] w-[700px] -translate-x-1/2 bg-gold/[0.02] blur-[100px]" />
      <div className="absolute inset-0 opacity-[0.02]">
        <svg className="h-full w-full">
          <defs>
            <pattern
              id="create-girih"
              x="0"
              y="0"
              width="60"
              height="60"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M30,0 L33,27 L60,30 L33,33 L30,60 L27,33 L0,30 L27,27 Z"
                fill="none"
                stroke="#d4af37"
                strokeWidth="0.3"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#create-girih)" />
        </svg>
      </div>
      <div className="relative z-10 mx-auto max-w-5xl px-6 py-24 sm:py-32">
        <div className="text-center mb-10">
          <div className="flex items-center justify-center gap-4 mb-4">
            <div className="h-px w-16 bg-gradient-to-r from-transparent to-gold/40" />
            <svg
              className="h-5 w-5 text-gold/50"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
            >
              <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5Z" />
            </svg>
            <div className="h-px w-16 bg-gradient-to-l from-transparent to-gold/40" />
          </div>
          <h1 className="font-display text-4xl font-medium text-parchment sm:text-5xl">
            {locale === "ar"
              ? "منشئ الفيديو"
              : locale === "fr"
                ? "Créateur de Vidéo"
                : "Video Builder"}
          </h1>
          <p className="mt-3 text-parchment-muted max-w-md mx-auto">
            {locale === "ar"
              ? "اختر سورة، وقارئاً، واصنع فيديو قرآني في ثوانٍ"
              : locale === "fr"
                ? "Choisissez une sourate, un récitateur, et créez une vidéo coranique en secondes"
                : "Choose a surah, a reciter, and create a Quranic video in seconds"}
          </p>
        </div>
        <StepIndicator />
        {step === 1 && <SurahStep />}
        {step === 2 && <VerseStep />}
        {step === 3 && <SettingsStep />}
        {step === 4 && <PreviewStep />}
      </div>
    </div>
  );
}
