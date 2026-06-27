"use client";
/**
 * VideoBuilder.tsx  —  Orchestrator
 *
 * This component owns all shared state and passes slices down to each step.
 * Each step component (StepSurah, StepVerses, StepSettings, StepGenerate)
 * is a pure presentational component that receives only what it needs.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useI18n } from "@/lib/i18n";

import {
  fetchSurahs,
  fetchReciters,
  fetchAyahs,
  fetchTranslation,
  getQuranApiAudioUrl,
  getEveryayahAudioUrl,
  PLATFORMS,
} from "@/lib/quran";
import { fetchStorageVideos } from "@/lib/storage-client";
import type { Surah, Ayah, Reciter } from "@/lib/quran";
import type { StorageVideo } from "@/lib/storage-client";
import { DEFAULT_SETTINGS, GenLog, VideoSettings } from "@/lib/types";
import { generateVideo } from "@/lib/generate-video";
import { CrescentMoonIcon, IslamicStarIcon } from "./icons";
import { StepSurah } from "./StepSurah";
import { StepVerses } from "./StepVerses";
import { StepGenerate } from "./StepGenerate";
import { StepSettings } from "./StepSettings";



/* ═══════════════════════════════════════════════════════════════
   STEP INDICATOR
═══════════════════════════════════════════════════════════════ */

function StepIndicator({ step, locale }: { step: number; locale: string }) {
  const steps = [
    { num: 1, label: locale === "ar" ? "السورة"    : "Surah" },
    { num: 2, label: locale === "ar" ? "الآيات"    : "Verses" },
    { num: 3, label: locale === "ar" ? "الإعدادات" : "Settings" },
    { num: 4, label: locale === "ar" ? "الإنتاج"   : "Generate" },
  ];
  return (
    <nav className="mb-12 flex items-center justify-center gap-2" aria-label="Progress">
      {steps.map((s, i) => (
        <div key={s.num} className="flex items-center gap-2">
          <div className="flex flex-col items-center">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold transition-all ${
                step >= s.num
                  ? "border-gold/40 bg-gold/15 text-gold"
                  : "border-gold/10 bg-ink-light/30 text-parchment-muted"
              }`}
              aria-current={step === s.num ? "step" : undefined}
            >
              {step > s.num ? (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : s.num}
            </div>
            <span className={`mt-1 text-[10px] ${step >= s.num ? "text-gold/60" : "text-parchment-muted/40"}`}>
              {s.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className={`w-8 sm:w-12 h-px ${step > s.num ? "bg-gold/30" : "bg-gold/10"}`} />
          )}
        </div>
      ))}
    </nav>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════ */

export function VideoBuilder() {
  const { locale } = useI18n();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  /* ── Quran data ─────────────────────────────────────────────── */
  const [surahs,          setSurahs]          = useState<Surah[]>([]);
  const [surahsLoading,   setSurahsLoading]   = useState(true);
  const [reciters,        setReciters]        = useState<Reciter[]>([]);
  const [recitersLoading, setRecitersLoading] = useState(true);
  const [selectedSurah,   setSelectedSurah]   = useState<Surah | null>(null);
  const [ayahs,           setAyahs]           = useState<Ayah[]>([]);
  const [ayahsLoading,    setAyahsLoading]    = useState(false);
  const [selectedNums,    setSelectedNums]    = useState<Set<number>>(new Set());
  const [selectedReciter, setSelectedReciter] = useState<Reciter | null>(null);

  /* ── Storage Videos ──────────────────────────────────────── */
  const [videos, setVideos]               = useState<StorageVideo[]>([]);
  const [videosLoading, setVideosLoading] = useState(false);

  /* ── Settings ──────────────────────────────────────────────── */
  const [settings, setSettings] = useState<VideoSettings>({
    ...DEFAULT_SETTINGS,
    translationLang: locale === "ar" ? "ar" : locale === "fr" ? "fr" : "en",
  });

  /* ── Generation ─────────────────────────────────────────────── */
  const [isGenerating,   setIsGenerating]   = useState(false);
  const [genLogs,        setGenLogs]        = useState<GenLog[]>([]);
  const [resultVideoUrl, setResultVideoUrl] = useState<string | null>(null);
  const abortRef    = useRef<AbortController | null>(null);
  const bgVideoRef     = useRef<HTMLVideoElement>(null);
  const bgVideoBytesRef = useRef<Uint8Array | null>(null);

  /* ── Audio preview ─────────────────────────────────────────── */
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioError,   setAudioError]   = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  /* ── Preview ayah index ─────────────────────────────────────── */
  const [previewIdx, setPreviewIdx] = useState(0);

  /* ── Derived ────────────────────────────────────────────────── */
  const sortedNums = useMemo(
    () => Array.from(selectedNums).sort((a, b) => a - b),
    [selectedNums],
  );
  const selectedAyahsData = useMemo(
    () => ayahs.filter((a) => selectedNums.has(a.numberInSurah)),
    [ayahs, selectedNums],
  );
  const selectedPlatform = useMemo(
    () => PLATFORMS.find((p) => p.id === settings.platform) || PLATFORMS[0],
    [settings.platform],
  );

  /* ── Load data ──────────────────────────────────────────────── */
  useEffect(() => {
    fetchSurahs().then(setSurahs).catch(console.error).finally(() => setSurahsLoading(false));
    fetchReciters().then(setReciters).catch(console.error).finally(() => setRecitersLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedSurah) { setAyahs([]); return; }
    setAyahsLoading(true);
    const { number: num } = selectedSurah;
    const lang = settings.translationLang;
    fetchAyahs(num).then((base) => {
      setAyahs(base);
      if (lang !== "ar") {
        fetchTranslation(num, lang)
          .then((map) => setAyahs((prev) => prev.map((a) => ({ ...a, translation: map.get(a.numberInSurah) || "" }))))
          .catch(console.error);
      }
    }).catch(console.error).finally(() => setAyahsLoading(false));
  }, [selectedSurah, settings.translationLang]);

  useEffect(() => {
    setVideosLoading(true);
    fetchStorageVideos().then(setVideos).catch(() => setVideos([])).finally(() => setVideosLoading(false));
  }, []);
  /* ── Handlers ───────────────────────────────────────────────── */
  const stopAudio = useCallback(() => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    setAudioPlaying(false);
    setAudioError(null);
  }, []);

  const handleSurahSelect = useCallback((surah: Surah) => {
    setSelectedSurah(surah);
    setSelectedNums(new Set());
    setResultVideoUrl(null);
    stopAudio();
  }, [stopAudio]);

  const handleToggleVerse = useCallback((num: number) => {
    setSelectedNums((prev) => {
      const n = new Set(prev);
      n.has(num) ? n.delete(num) : n.add(num);
      return n;
    });
  }, []);

  const handlePreset = useCallback((id: string) => {
    if (id === "clear") { setSelectedNums(new Set()); return; }
    if (!selectedSurah) return;
    const total = selectedSurah.numberOfAyahs;
    const nums  = new Set<number>();
    if (id === "full") {
      for (let i = 1; i <= total; i++) nums.add(i);
    } else {
      const count = parseInt(id.split("-")[1]) || 3;
      for (let i = 1; i <= Math.min(count, total); i++) nums.add(i);
    }
    setSelectedNums(nums);
  }, [selectedSurah]);

  const handleChangeSetting = useCallback(<K extends keyof VideoSettings>(k: K, v: VideoSettings[K]) => {
    setSettings((s) => ({ ...s, [k]: v }));
  }, []);

  const handleSelectReciter = useCallback((r: Reciter) => {
    setSelectedReciter(r);
    stopAudio();
  }, [stopAudio]);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("video/")) return;
    if (file.size > 150 * 1024 * 1024) return;
    // Read bytes eagerly into a ref — avoids blob: URL fetch issues
    const buf = await file.arrayBuffer();
    bgVideoBytesRef.current = new Uint8Array(buf);
    setSettings((s) => ({
      ...s,
      background: "upload",
      uploadedVideoUrl: URL.createObjectURL(file),
      uploadedVideoFile: file,
    }));
  }, []);

  const handleToggleAudio = useCallback(async () => {
    if (!selectedReciter || !selectedSurah || sortedNums.length === 0) return;
    if (audioPlaying) { stopAudio(); return; }

    setAudioLoading(true);
    setAudioError(null);
    const firstAyah = ayahs.find((a) => a.numberInSurah === sortedNums[0]);
    if (!firstAyah) { setAudioLoading(false); return; }

    const urls: string[] = [];
    if (selectedReciter.source === "quranapi" && selectedReciter.quranApiNo) {
      urls.push(getQuranApiAudioUrl(selectedReciter.quranApiNo, selectedSurah.number, firstAyah.numberInSurah));
      const ev = getEveryayahAudioUrl(selectedReciter.quranApiNo, selectedSurah.number, firstAyah.numberInSurah);
      if (ev) urls.push(ev);
    }
    if (!urls.length) { setAudioError("No audio available"); setAudioLoading(false); return; }

    const audio = new Audio();
    audioRef.current = audio;
    audio.crossOrigin = "anonymous";
    audio.onended = () => setAudioPlaying(false);

    const tryUrl = (i: number) => {
      if (i >= urls.length) { setAudioError("Audio unavailable for this reciter"); setAudioLoading(false); return; }
      audio.src     = urls[i];
      audio.onerror = () => tryUrl(i + 1);
      audio.oncanplay = () => {
        audio.play()
          .then(() => { setAudioPlaying(true); setAudioLoading(false); })
          .catch(() => tryUrl(i + 1));
      };
    };
    tryUrl(0);
  }, [selectedReciter, selectedSurah, sortedNums, ayahs, audioPlaying, stopAudio]);

  /* ── Video generation ───────────────────────────────────────── */
  const handleGenerate = useCallback(async () => {
    if (!selectedSurah || !selectedReciter || selectedAyahsData.length === 0) return;

    setIsGenerating(true);
    setGenLogs([{ msg: "Starting…", pct: 0 }]);
    setResultVideoUrl(null);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    // Start background video if needed
    const bgEl = bgVideoRef.current;
    if (bgEl) {
      const src =
        settings.background === "library" ? settings.videoUrl
        : settings.background === "upload"  ? settings.uploadedVideoUrl
        : null;
      if (src) {
        bgEl.src = src;
        bgEl.muted = true;
        bgEl.loop  = true;
        bgEl.play().catch(() => { /* autoplay blocked is fine */ });
      }
    }

    try {
      const blob = await generateVideo({
        ayahs:          selectedAyahsData,
        surah:          selectedSurah,
        reciter:        selectedReciter,
        settings,
        platform:       selectedPlatform,
        bgVideoEl:      bgEl,
        bgVideoBytes:   bgVideoBytesRef.current,
        onLog:     (log) => setGenLogs((prev) => [...prev.slice(-6), log]),
        signal:    ctrl.signal,
      });
      setResultVideoUrl(URL.createObjectURL(blob));
      setGenLogs((prev) => [...prev, { msg: "✅ Done!", pct: 100 }]);
    } catch (err: any) {
      if (err?.name === "AbortError") {
        setGenLogs((prev) => [...prev, { msg: "Cancelled.", pct: 0 }]);
      } else {
        console.error("[VideoBuilder] generation error:", err);
        setGenLogs((prev) => [...prev, { msg: `❌ Error: ${err?.message ?? String(err)}`, pct: 0 }]);
      }
    } finally {
      setIsGenerating(false);
      abortRef.current = null;
    }
  }, [selectedSurah, selectedReciter, selectedAyahsData, settings, selectedPlatform]);

  const handleStartOver = useCallback(() => {
    setStep(1);
    setSelectedSurah(null);
    setSelectedReciter(null);
    setAyahs([]);
    setSelectedNums(new Set());
    setResultVideoUrl(null);
    setGenLogs([]);
    stopAudio();
  }, [stopAudio]);

  /* ═══════════════════════════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════════════════════════ */
  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Ambient background */}
      <div className="absolute left-1/2 top-0 h-[500px] w-[700px] -translate-x-1/2 bg-gold/[0.025] blur-[100px]" aria-hidden="true" />
      <div className="absolute inset-0 opacity-[0.02]" aria-hidden="true">
        <svg className="h-full w-full">
          <defs>
            <pattern id="bg-girih" x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse">
              <path d="M30,0 L33,27 L60,30 L33,33 L30,60 L27,33 L0,30 L27,27 Z" fill="none" stroke="#d4af37" strokeWidth="0.3" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#bg-girih)" />
        </svg>
      </div>

      {/* Hidden background video (captured on frame render) */}
      <video ref={bgVideoRef} className="hidden" muted loop playsInline crossOrigin="anonymous" />

      <div className="relative z-10 mx-auto max-w-6xl px-6 py-24 sm:py-32">
        {/* Page header */}
        <div className="text-center mb-10">
          <div className="flex items-center justify-center gap-4 mb-4">
            <div className="h-px w-16 bg-gradient-to-r from-transparent to-gold/40" />
            <div className="flex items-center gap-2">
              <CrescentMoonIcon className="h-5 w-5 text-gold/30" />
              <IslamicStarIcon  className="h-5 w-5 text-gold/50" />
              <CrescentMoonIcon className="h-5 w-5 text-gold/30" />
            </div>
            <div className="h-px w-16 bg-gradient-to-l from-transparent to-gold/40" />
          </div>
          <h1 className="font-display text-4xl font-medium text-parchment sm:text-5xl">
            {locale === "ar" ? "منشئ الفيديو القرآني" : "Quran Video Studio"}
          </h1>
          <p className="mt-3 text-parchment-muted max-w-md mx-auto text-sm">
            {locale === "ar"
              ? "اختر سورة وقارئاً واصنع فيديو قرآني احترافي مع الصوت الكامل"
              : "Choose a surah and reciter — generate a professional Quran video with full synchronized audio"}
          </p>
        </div>

        <StepIndicator step={step} locale={locale} />

        {step === 1 && (
          <StepSurah
            surahs={surahs}
            loading={surahsLoading}
            selected={selectedSurah}
            onSelect={handleSurahSelect}
            onNext={() => setStep(2)}
            locale={locale}
          />
        )}

        {step === 2 && selectedSurah && (
          <StepVerses
            surah={selectedSurah}
            ayahs={ayahs}
            loading={ayahsLoading}
            selected={selectedNums}
            showTranslation={settings.showTranslation}
            onToggle={handleToggleVerse}
            onPreset={handlePreset}
            onBack={() => setStep(1)}
            onNext={() => setStep(3)}
            locale={locale}
            surahNumber={selectedSurah.number}
            reciterIdentifier={selectedReciter?.identifier ?? null}
            reciters={reciters}
          />
        )}

        {step === 3 && (
          <StepSettings
            settings={settings}
            onChange={handleChangeSetting}
            reciters={reciters}
            recitersLoading={recitersLoading}
            selectedReciter={selectedReciter}
            onSelectReciter={handleSelectReciter}
            audioPlaying={audioPlaying}
            audioLoading={audioLoading}
            audioError={audioError}
            onToggleAudio={handleToggleAudio}
            canPreviewAudio={!!(selectedReciter && selectedSurah && sortedNums.length > 0)}
            storageVideos={videos}
            videosLoading={videosLoading}
            onFileUpload={handleFileUpload}
            uploadError={null}
            onBack={() => setStep(2)}
            onNext={() => setStep(4)}
            locale={locale}
          />
        )}

        {step === 4 && selectedSurah && selectedReciter && (
          <StepGenerate
            surah={selectedSurah}
            reciter={selectedReciter}
            ayahs={selectedAyahsData}
            sortedNums={sortedNums}
            settings={settings}
            platform={selectedPlatform}
            bgVideoRef={bgVideoRef}
            previewIdx={previewIdx}
            onPreviewIdx={setPreviewIdx}
            isGenerating={isGenerating}
            genLogs={genLogs}
            resultVideoUrl={resultVideoUrl}
            onGenerate={handleGenerate}
            onCancel={() => abortRef.current?.abort()}
            onReset={() => { setResultVideoUrl(null); setGenLogs([]); }}
            onStartOver={handleStartOver}
            onBack={() => setStep(3)}
            locale={locale}
          />
        )}
      </div>
    </div>
  );
}