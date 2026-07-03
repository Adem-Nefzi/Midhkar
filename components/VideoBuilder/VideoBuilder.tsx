"use client";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useI18n } from "@/lib/i18n";
import {
  fetchSurahs,
  fetchReciters,
  fetchAyahs,
  fetchTranslation,
  getQuranApiAudioUrl,
  getEveryayahAudioUrl,
} from "@/lib/quran";
import { fetchStorageVideos } from "@/lib/storage-client";
import type { Surah, Ayah, Reciter } from "@/lib/quran";
import type { StorageVideo } from "@/lib/storage-client";
import {
  DEFAULT_SETTINGS,
  GenLog,
  VideoSettings,
  PLATFORM_META,
  saveDraft,
  loadDraft,
  clearDraft,
} from "@/lib/types";
import type { PlatformId, Draft } from "@/lib/types";
import {
  generateVideo,
  prefetchAudio,
  clearAudioCache,
} from "@/lib/generate-video";
import { CrescentMoonIcon, IslamicStarIcon } from "./icons";
import { StepSurah } from "./StepSurah";
import { StepVerses } from "./StepVerses";
import { StepGenerate } from "./StepGenerate";
import { StepSettings } from "./StepSettings";

function buildPlatform(id: PlatformId) {
  const meta = PLATFORM_META[id];
  return {
    id,
    label: meta.label,
    aspect: meta.aspect,
    fontSize: "medium" as const,
    icon: meta.icon,
  };
}
const FALLBACK_PLATFORM = buildPlatform("youtube");

function StepIndicator({ step, locale }: { step: number; locale: string }) {
  const steps = [
    { num: 1, label: locale === "ar" ? "السورة" : "Surah" },
    { num: 2, label: locale === "ar" ? "الآيات" : "Verses" },
    { num: 3, label: locale === "ar" ? "الإعدادات" : "Settings" },
    { num: 4, label: locale === "ar" ? "الإنتاج" : "Generate" },
  ];
  return (
    <nav
      className="mb-12 flex items-center justify-center gap-2"
      aria-label="Progress"
    >
      {steps.map((s, i) => (
        <div key={s.num} className="flex items-center gap-2">
          <div className="flex flex-col items-center">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold transition-all ${step >= s.num ? "border-gold/40 bg-gold/15 text-gold" : "border-gold/10 bg-ink-light/30 text-parchment-muted"}`}
              aria-current={step === s.num ? "step" : undefined}
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
              className={`w-8 sm:w-12 h-px ${step > s.num ? "bg-gold/30" : "bg-gold/10"}`}
            />
          )}
        </div>
      ))}
    </nav>
  );
}

export function VideoBuilder() {
  const { locale } = useI18n();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  const [surahs, setSurahs] = useState<Surah[]>([]);
  const [surahsLoading, setSurahsLoading] = useState(true);
  const [reciters, setReciters] = useState<Reciter[]>([]);
  const [recitersLoading, setRecitersLoading] = useState(true);
  const [selectedSurah, setSelectedSurah] = useState<Surah | null>(null);
  const [ayahs, setAyahs] = useState<Ayah[]>([]);
  const [ayahsLoading, setAyahsLoading] = useState(false);
  const [selectedNums, setSelectedNums] = useState<Set<number>>(new Set());
  const [selectedReciter, setSelectedReciter] = useState<Reciter | null>(null);
  const [videos, setVideos] = useState<StorageVideo[]>([]);
  const [videosLoading, setVideosLoading] = useState(false);

  // ← CHANGED: added verseSpacing: 0 and transitionStyle: "none" so the
  // default experience is seamless back-to-back verses with no fade delays.
  const [settings, setSettings] = useState<VideoSettings>({
    ...DEFAULT_SETTINGS,
    verseSpacing: 0,
    transitionStyle: "none",
    translationLang: locale === "ar" ? "ar" : locale === "fr" ? "fr" : "en",
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const [genLogs, setGenLogs] = useState<GenLog[]>([]);
  const [resultVideoUrl, setResultVideoUrl] = useState<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const bgVideoRef = useRef<HTMLVideoElement>(null);
  // Tracks which src we've already told bgVideoRef to load, so the eager
  // preload effect below doesn't call .load() repeatedly on every render.
  const loadedBgSrcRef = useRef<string | null>(null);
  // Tracks the object URL created for a user-uploaded background video so
  // it can be revoked when replaced or on Start Over — otherwise every
  // re-upload leaks a blob URL for the life of the tab.
  const uploadedUrlRef = useRef<string | null>(null);

  const [audioPlaying, setAudioPlaying] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [previewIdx, setPreviewIdx] = useState(0);

  // Fix: was hardcoded to `null` when passed to StepSettings, so the
  // (already-built) invalid-file / oversized-file UI in StepSettings
  // never actually received a message — uploads just silently no-op'd.
  const [uploadError, setUploadError] = useState<string | null>(null);

  const sortedNums = useMemo(
    () => Array.from(selectedNums).sort((a, b) => a - b),
    [selectedNums],
  );
  const selectedAyahsData = useMemo(
    () => ayahs.filter((a) => selectedNums.has(a.numberInSurah)),
    [ayahs, selectedNums],
  );
  const selectedPlatform = useMemo(() => {
    const id = settings.platform as PlatformId;
    return id && PLATFORM_META[id] ? buildPlatform(id) : FALLBACK_PLATFORM;
  }, [settings.platform]);

  useEffect(() => {
    fetchSurahs()
      .then(setSurahs)
      .catch(console.error)
      .finally(() => setSurahsLoading(false));
    fetchReciters()
      .then(setReciters)
      .catch(console.error)
      .finally(() => setRecitersLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedSurah) {
      setAyahs([]);
      return;
    }
    setAyahsLoading(true);
    const { number: num } = selectedSurah;
    const lang = settings.translationLang;
    fetchAyahs(num)
      .then((base) => {
        setAyahs(base);
        if (lang !== "ar") {
          fetchTranslation(num, lang)
            .then((map) =>
              setAyahs((prev) =>
                prev.map((a) => ({
                  ...a,
                  translation: map.get(a.numberInSurah) || "",
                })),
              ),
            )
            .catch(console.error);
        }
      })
      .catch(console.error)
      .finally(() => setAyahsLoading(false));
  }, [selectedSurah, settings.translationLang]);

  useEffect(() => {
    setVideosLoading(true);
    fetchStorageVideos()
      .then(setVideos)
      .catch(() => setVideos([]))
      .finally(() => setVideosLoading(false));
  }, []);

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setAudioPlaying(false);
    setAudioError(null);
  }, []);

  const handleSurahSelect = useCallback(
    (surah: Surah) => {
      setSelectedSurah(surah);
      setSelectedNums(new Set());
      setResultVideoUrl(null);
      stopAudio();
    },
    [stopAudio],
  );
  const handleToggleVerse = useCallback((num: number) => {
    setSelectedNums((prev) => {
      const n = new Set(prev);
      n.has(num) ? n.delete(num) : n.add(num);
      return n;
    });
  }, []);
  const handleChangeSetting = useCallback(
    <K extends keyof VideoSettings>(k: K, v: VideoSettings[K]) => {
      setSettings((s) => ({ ...s, [k]: v }));
    },
    [],
  );
  const handleSelectReciter = useCallback(
    (r: Reciter) => {
      setSelectedReciter(r);
      stopAudio();
    },
    [stopAudio],
  );

  const handlePreset = useCallback(
    (id: string) => {
      if (id === "clear") {
        setSelectedNums(new Set());
        return;
      }
      if (!selectedSurah) return;
      const total = selectedSurah.numberOfAyahs;
      const nums = new Set<number>();
      if (id === "full") {
        for (let i = 1; i <= total; i++) nums.add(i);
      } else {
        const count = parseInt(id.split("-")[1]) || 3;
        for (let i = 1; i <= Math.min(count, total); i++) nums.add(i);
      }
      setSelectedNums(nums);
    },
    [selectedSurah],
  );

  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      // Reset the input so selecting the same file again (e.g. after
      // fixing something and re-picking) still fires onChange.
      e.target.value = "";
      if (!file) return;

      if (!file.type.startsWith("video/")) {
        setUploadError(
          locale === "ar"
            ? "الرجاء اختيار ملف فيديو صالح"
            : "Please choose a valid video file",
        );
        return;
      }
      if (file.size > 150 * 1024 * 1024) {
        setUploadError(
          locale === "ar"
            ? "الحجم الأقصى للملف 150 ميجابايت"
            : "Max file size is 150MB",
        );
        return;
      }

      setUploadError(null);
      const url = URL.createObjectURL(file);
      if (uploadedUrlRef.current) {
        URL.revokeObjectURL(uploadedUrlRef.current);
      }
      uploadedUrlRef.current = url;

      setSettings((s) => ({
        ...s,
        background: "upload",
        uploadedVideoUrl: url,
        uploadedVideoFile: file,
      }));
    },
    [locale],
  );

  const handleToggleAudio = useCallback(async () => {
    if (!selectedReciter || !selectedSurah || sortedNums.length === 0) return;
    if (audioPlaying) {
      stopAudio();
      return;
    }
    setAudioLoading(true);
    setAudioError(null);
    const firstAyah = ayahs.find((a) => a.numberInSurah === sortedNums[0]);
    if (!firstAyah) {
      setAudioLoading(false);
      return;
    }
    const urls: string[] = [];
    if (selectedReciter.source === "quranapi" && selectedReciter.quranApiNo) {
      urls.push(
        getQuranApiAudioUrl(
          selectedReciter.quranApiNo,
          selectedSurah.number,
          firstAyah.numberInSurah,
        ),
      );
      const ev = getEveryayahAudioUrl(
        selectedReciter.quranApiNo,
        selectedSurah.number,
        firstAyah.numberInSurah,
      );
      if (ev) urls.push(ev);
    }
    if (!urls.length) {
      setAudioError("No audio available");
      setAudioLoading(false);
      return;
    }
    const audio = new Audio();
    audioRef.current = audio;
    audio.crossOrigin = "anonymous";
    audio.onended = () => setAudioPlaying(false);
    const tryUrl = (i: number) => {
      if (i >= urls.length) {
        setAudioError("Audio unavailable for this reciter");
        setAudioLoading(false);
        return;
      }
      audio.src = urls[i];
      audio.onerror = () => tryUrl(i + 1);
      audio.oncanplay = () => {
        audio
          .play()
          .then(() => {
            setAudioPlaying(true);
            setAudioLoading(false);
          })
          .catch(() => tryUrl(i + 1));
      };
    };
    tryUrl(0);
  }, [
    selectedReciter,
    selectedSurah,
    sortedNums,
    ayahs,
    audioPlaying,
    stopAudio,
  ]);

  /* ── Eagerly preload the background video as soon as it's chosen ──
     Previously this src-loading + "wait for readyState>=2" logic lived
     INSIDE handleGenerate, meaning every click of "Generate" first paid
     up to ~5s of load/decode latency before generation could even start
     — even though the worker no longer needs this element at all (it
     decodes the background from raw bytes itself). Moving it here means
     it happens in the background the moment the user picks a background
     video (in Settings, step 3), so by the time they reach Generate and
     click the button it's virtually always already loaded — and either
     way, generation itself is never gated on it anymore. This element is
     now used ONLY for the live preview in StepGenerate. */
  useEffect(() => {
    const bgEl = bgVideoRef.current;
    if (!bgEl) return;

    const needsVideo =
      settings.background === "upload" || settings.background === "library";
    if (!needsVideo) return;

    const src =
      settings.background === "library"
        ? settings.videoUrl
        : settings.uploadedVideoUrl;
    if (!src || loadedBgSrcRef.current === src) return;

    loadedBgSrcRef.current = src;
    bgEl.src = src;
    bgEl.muted = true;
    bgEl.loop = true;
    bgEl.preload = "auto";
    bgEl.load();
  }, [settings.background, settings.videoUrl, settings.uploadedVideoUrl]);

  const handleGenerate = useCallback(async () => {
    if (!selectedSurah || !selectedReciter || selectedAyahsData.length === 0)
      return;
    setIsGenerating(true);
    setGenLogs([{ msg: "Starting…", pct: 0 }]);
    setResultVideoUrl(null);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const blob = await generateVideo({
        ayahs: selectedAyahsData,
        surah: selectedSurah,
        reciter: selectedReciter,
        settings,
        platform: selectedPlatform,
        onLog: (log) => {
          setGenLogs((prev) => [...prev.slice(-4), log]);
        },
        signal: ctrl.signal,
      });
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
      const url = URL.createObjectURL(blob);
      objectUrlRef.current = url;
      setResultVideoUrl(url);
      setGenLogs((prev) => [...prev, { msg: "✅ Done!", pct: 100 }]);
    } catch (err: any) {
      if (err?.name === "AbortError") {
        setGenLogs((prev) => [...prev, { msg: "Cancelled.", pct: 0 }]);
      } else {
        console.error("[VideoBuilder] generation error:", err);
        setGenLogs((prev) => [
          ...prev,
          { msg: `❌ Error: ${err?.message ?? String(err)}`, pct: 0 },
        ]);
      }
    } finally {
      setIsGenerating(false);
      abortRef.current = null;
    }
  }, [
    selectedSurah,
    selectedReciter,
    selectedAyahsData,
    settings,
    selectedPlatform,
  ]);

  // Bug 7: Revoke URL on unmount
  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, []);

  // Opt 8: Start prefetching audio as soon as reciter + surah + verses are ready
  useEffect(() => {
    if (selectedReciter && selectedSurah && selectedAyahsData.length > 0) {
      prefetchAudio(selectedAyahsData, selectedReciter, selectedSurah).catch(
        console.error,
      );
    }
    return () => {
      clearAudioCache();
    };
  }, [selectedReciter, selectedSurah, selectedAyahsData]);

  /* ── Draft auto-save ──────────────────────────────────────── */
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [draftSaving, setDraftSaving] = useState(false);

  useEffect(() => {
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    if (resultVideoUrl) return; // don't save after generation
    draftTimerRef.current = setTimeout(() => {
      saveDraft({
        step,
        settings,
        surahNumber: selectedSurah?.number ?? 0,
        selectedNums: sortedNums,
        reciterIdentifier: selectedReciter?.identifier ?? null,
        reciterSource: selectedReciter?.source ?? null,
        savedAt: Date.now(),
      });
      setDraftSaving(true);
      setTimeout(() => setDraftSaving(false), 2000);
    }, 500);
    return () => {
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    };
  }, [
    step,
    settings,
    selectedSurah?.number,
    sortedNums,
    selectedReciter?.identifier,
    selectedReciter?.source,
    resultVideoUrl,
  ]);

  /* ── Restore draft on mount (after surahs + reciters loaded) ─ */
  const [draftRestored, setDraftRestored] = useState(false);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (loadedRef.current) return;
    if (surahsLoading || recitersLoading || !surahs.length || !reciters.length)
      return;
    loadedRef.current = true;

    const draft = loadDraft();
    if (!draft || !draft.surahNumber) return;

    const sr = surahs.find((s) => s.number === draft.surahNumber);
    if (!sr) return;

    setSelectedSurah(sr);
    setSelectedNums(new Set(draft.selectedNums));

    // Guard: if the draft's platform no longer exists in PLATFORM_META
    // (e.g. it changed shape since the draft was saved), clear it so the
    // "required" prompt in StepSettings correctly reappears instead of
    // silently falling back while the UI shows nothing selected.
    const restoredSettings = { ...draft.settings };
    if (
      restoredSettings.platform &&
      !PLATFORM_META[restoredSettings.platform as PlatformId]
    ) {
      restoredSettings.platform = "";
    }
    setSettings(restoredSettings);
    setStep(draft.step);

    if (draft.reciterIdentifier) {
      const rc = reciters.find(
        (r) =>
          r.identifier === draft.reciterIdentifier &&
          r.source === draft.reciterSource,
      );
      if (rc) setSelectedReciter(rc);
    }

    setDraftRestored(true);
    setTimeout(() => setDraftRestored(false), 4000);
  }, [surahsLoading, recitersLoading, surahs, reciters]);

  const handleStartOver = useCallback(() => {
    setStep(1);
    setSelectedSurah(null);
    setSelectedReciter(null);
    setAyahs([]);
    setSelectedNums(new Set());
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    if (uploadedUrlRef.current) {
      URL.revokeObjectURL(uploadedUrlRef.current);
      uploadedUrlRef.current = null;
    }
    setUploadError(null);
    setResultVideoUrl(null);
    setGenLogs([]);
    stopAudio();
    clearDraft();
    loadedRef.current = false;
    loadedBgSrcRef.current = null;
  }, [stopAudio]);

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div
        className="absolute left-1/2 top-0 h-[500px] w-[700px] -translate-x-1/2 bg-gold/[0.025] blur-[100px]"
        aria-hidden="true"
      />
      <div className="absolute inset-0 opacity-[0.02]" aria-hidden="true">
        <svg className="h-full w-full">
          <defs>
            <pattern
              id="bg-girih"
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
          <rect width="100%" height="100%" fill="url(#bg-girih)" />
        </svg>
      </div>

      {/* Hidden video element — used only for the live preview in
          StepGenerate now. Preloaded eagerly (see effect above) as soon
          as a background video is chosen, decoupled from generation. */}
      <video
        ref={bgVideoRef}
        className="hidden"
        muted
        loop
        playsInline
        preload="auto"
        crossOrigin="anonymous"
      />

      <div className="relative z-10 mx-auto max-w-6xl px-6 py-24 sm:py-32">
        <div className="text-center mb-10">
          <div className="flex items-center justify-center gap-4 mb-4">
            <div className="h-px w-16 bg-gradient-to-r from-transparent to-gold/40" />
            <div className="flex items-center gap-2">
              <CrescentMoonIcon className="h-5 w-5 text-gold/30" />
              <IslamicStarIcon className="h-5 w-5 text-gold/50" />
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

        {/* Draft indicator */}
        {(draftSaving || draftRestored) && (
          <div className="flex justify-center mb-4">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-medium transition-all duration-300 ${draftRestored ? "bg-gold/15 text-gold border border-gold/20" : "bg-parchment/5 text-parchment-muted/60 border border-parchment/10"}`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${draftRestored ? "bg-gold" : "bg-parchment/40"}`}
              />
              {draftRestored
                ? locale === "ar"
                  ? "تمت استعادة المسودة"
                  : "Draft restored"
                : locale === "ar"
                  ? "جاري الحفظ..."
                  : "Auto-saving..."}
            </span>
          </div>
        )}

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
            canPreviewAudio={
              !!(selectedReciter && selectedSurah && sortedNums.length > 0)
            }
            storageVideos={videos}
            videosLoading={videosLoading}
            onFileUpload={handleFileUpload}
            uploadError={uploadError}
            onBack={() => setStep(2)}
            onNext={() => setStep(4)}
            locale={locale}
          />
        )}

        {step === 4 &&
          selectedSurah &&
          selectedReciter &&
          settings.platform && (
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
              onReset={() => {
                if (objectUrlRef.current) {
                  URL.revokeObjectURL(objectUrlRef.current);
                  objectUrlRef.current = null;
                }
                setResultVideoUrl(null);
                setGenLogs([]);
              }}
              onStartOver={handleStartOver}
              onBack={() => setStep(3)}
              locale={locale}
            />
          )}
      </div>
    </div>
  );
}
