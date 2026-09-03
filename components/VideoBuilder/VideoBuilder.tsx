"use client";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { m, AnimatePresence } from "motion/react";
import { EASE_OUT } from "@/components/MotionProvider";
import { useI18n } from "@/lib/i18n";
import {
  fetchSurahs,
  fetchReciters,
  fetchAyahs,
  getAudioUrlCandidates,
} from "@/lib/quran";
/* ── Supabase Library (disabled — restore by uncommenting) ──────
import { fetchStorageVideos } from "@/lib/storage-client";
import type { StorageVideo } from "@/lib/storage-client";
──────────────────────────────────────────────────────────────── */
import type { Surah, Ayah, Reciter } from "@/lib/quran";
import {
  DEFAULT_SETTINGS,
  GenLog,
  VideoSettings,
  PLATFORM_META,
} from "@/lib/types";
import type { PlatformId, Platform } from "@/lib/types";
import {
  generateVideo,
  prefetchAudio,
  clearAudioCache,
  estimateTotalDurationSec,
  estimateAyahDurationsSec,
  isWebCodecsSupported,
} from "@/lib/generate-video";
import {
  renderVideoCloud,
  clearStaleJob,
} from "@/lib/render-client";
import { getEveryayahFolder } from "@/lib/quran";
import { GardenMark, Bloom } from "@/components/Ornament/ornaments";
import { StudioBackdrop } from "./studio-backdrop";
import { CheckIcon } from "./icons";
import { StepSurah } from "./StepSurah";
import { StepVerses } from "./StepVerses";
import { LivePreview } from "./LivePreview";
import dynamic from "next/dynamic";

const StepGenerate = dynamic(() =>
  import("./StepGenerate").then((m) => m.StepGenerate),
  { ssr: false },
);
const StepSettings = dynamic(() =>
  import("./StepSettings").then((m) => m.StepSettings),
  { ssr: false },
);

const ProductTour = dynamic(() =>
  import("./tour").then((m) => m.Tour),
  { ssr: false },
);

function buildPlatform(id: PlatformId): Platform {
  const meta = PLATFORM_META[id];
  return {
    id,
    label: meta.label,
    aspect: meta.aspect,
  };
}
const FALLBACK_PLATFORM = buildPlatform("youtube");

function StepIndicator({
  step,
  locale,
  onNavigate,
}: {
  step: number;
  locale: string;
  onNavigate: (n: 1 | 2 | 3 | 4) => void;
}) {
  const steps = [
    { num: 1 as const, en: "Surah", fr: "Sourate", ar: "السورة" },
    { num: 2 as const, en: "Verses", fr: "Versets", ar: "الآيات" },
    { num: 3 as const, en: "Settings", fr: "Réglages", ar: "الإعدادات" },
    { num: 4 as const, en: "Generate", fr: "Générer", ar: "الإنتاج" },
  ];
  const label = (s: { en: string; fr: string; ar: string }) =>
    locale === "ar" ? s.ar : locale === "fr" ? s.fr : s.en;

  return (
    <nav
      data-tour="step-rail"
      className="mx-auto mb-12 flex w-fit items-center justify-center"
      aria-label="Progress"
    >
      {steps.map((s, i) => {
        const active = step === s.num;
        const done = step > s.num;
        const clickable = done;
        return (
          <div key={s.num} className="flex items-center">
            <div className="relative flex flex-col items-center gap-2 px-1 sm:px-2">
              <button
                type="button"
                onClick={() => clickable && onNavigate(s.num)}
                disabled={!clickable && !active}
                aria-current={active ? "step" : undefined}
                aria-label={`${label(s)} — ${done ? "completed" : active ? "current" : "upcoming"}`}
                className={`relative flex h-10 w-10 items-center justify-center rounded-full border text-[13px] font-semibold transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/60 ${
                  done
                    ? "cursor-pointer border-gold/60 bg-gold text-ink lit-soft hover:scale-105"
                    : active
                      ? "border-gold/70 bg-gold/15 text-gold"
                      : "cursor-default border-gold/15 bg-ink-light/60 text-parchment-dim"
                }`}
              >
                {active && (
                  <m.span
                    layoutId="station-bead"
                    className="absolute -inset-2"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                    aria-hidden="true"
                  >
                    <Bloom className="h-full w-full animate-spin-slow" petals={8} />
                  </m.span>
                )}
                <span className="relative">
                  {done ? <CheckIcon className="h-4 w-4" /> : s.num}
                </span>
              </button>
              <span
                className={`text-[13px] font-medium transition-colors ${
                  active
                    ? "text-gold"
                    : done
                      ? "text-gold-soft/80"
                      : "text-parchment-dim"
                }`}
              >
                {label(s)}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className="relative mx-1 mb-6 h-px w-8 overflow-hidden bg-verdant/20 sm:w-14">
                <div
                  className="h-full bg-gradient-to-r from-verdant/80 to-gold/60 transition-all duration-700"
                  style={{ width: done ? "100%" : "0%" }}
                />
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}

export function VideoBuilder() {
  const { locale } = useI18n();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [stepDir, setStepDir] = useState(1);

  const goTo = useCallback(
    (next: 1 | 2 | 3 | 4) => {
      setStepDir((prev) => {
        return next > step ? 1 : next < step ? -1 : prev;
      });
      setStep(next);
    },
    [step],
  );

  const [surahs, setSurahs] = useState<Surah[]>([]);
  const [surahsLoading, setSurahsLoading] = useState(true);
  const [reciters, setReciters] = useState<Reciter[]>([]);
  const [recitersLoading, setRecitersLoading] = useState(true);
  const [selectedSurah, setSelectedSurah] = useState<Surah | null>(null);
  const [ayahs, setAyahs] = useState<Ayah[]>([]);
  const [ayahsLoading, setAyahsLoading] = useState(false);
  const [selectedNums, setSelectedNums] = useState<Set<number>>(new Set());
  const [selectedReciter, setSelectedReciter] = useState<Reciter | null>(null);
  /* ── Supabase Library (disabled — restore by uncommenting) ──────
  const [videos, setVideos] = useState<StorageVideo[]>([]);
  const [videosLoading, setVideosLoading] = useState(false);
  ──────────────────────────────────────────────────────────────── */

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
  const logIdRef = useRef(0);
  const stamp = useCallback(
    (log: { msg: string; pct: number }): GenLog => ({
      ...log,
      id: ++logIdRef.current,
    }),
    [],
  );
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

  // Accurate total output length — decoded audio durations + verse spacing.
  const [totalDurationSec, setTotalDurationSec] = useState<number | null>(null);
  const [durationLoading, setDurationLoading] = useState(false);
  const durationCtrlRef = useRef<AbortController | null>(null);

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
    const ctrl = new AbortController();
    const { number: num } = selectedSurah;
    fetchAyahs(num, settings.translationLang, ctrl.signal)
      .then((list) => {
        if (!ctrl.signal.aborted) setAyahs(list);
      })
      .catch((err) => {
        if (!ctrl.signal.aborted) console.error(err);
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setAyahsLoading(false);
      });
    return () => ctrl.abort();
  }, [selectedSurah, settings.translationLang]);

  /* ── Supabase Library (disabled — restore by uncommenting) ──────
  useEffect(() => {
    setVideosLoading(true);
    fetchStorageVideos()
      .then(setVideos)
      .catch(() => setVideos([]))
      .finally(() => setVideosLoading(false));
  }, []);
  ──────────────────────────────────────────────────────────────── */

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
      // Auto-advance: let the select-bloom confirmation land, then
      // slide to the Verses step — no Continue button to hunt for.
      setStepDir(1);
      setStep(2);
    },
    [stopAudio],
  );
  const handleToggleVerse = useCallback((num: number) => {
    setSelectedNums((prev) => {
      const n = new Set(prev);
      if (n.has(num)) n.delete(num);
      else n.add(num);
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
        ...getAudioUrlCandidates(
          selectedReciter.quranApiNo,
          selectedSurah.number,
          firstAyah.numberInSurah,
        ),
      );
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
      settings.background === "upload" ||
      settings.background === "library" ||
      settings.background === "pexels";
    if (!needsVideo) return;

    const src =
      settings.background === "library" || settings.background === "pexels"
        ? (settings.videoUrls?.[0] ?? settings.videoUrl)
        : settings.uploadedVideoUrl;
    if (!src || loadedBgSrcRef.current === src) return;

    loadedBgSrcRef.current = src;
    bgEl.src = src;
    bgEl.muted = true;
    bgEl.loop = true;
    bgEl.preload = "auto";
    bgEl.load();
  }, [
    settings.background,
    settings.videoUrl,
    settings.videoUrls,
    settings.uploadedVideoUrl,
  ]);

  const handleGenerate = useCallback(async () => {
    if (!selectedSurah || !selectedReciter || selectedAyahsData.length === 0)
      return;
    setIsGenerating(true);
    setGenLogs([stamp({ msg: "Starting…", pct: 0 })]);
    setResultVideoUrl(null);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    const pushLog = (log: { msg: string; pct: number }) => {
      setGenLogs((prev) => [...prev.slice(-4), stamp(log)]);
    };

    /* ── Server-first render, local fallback ─────────────────────
       The whole render runs in the app's own /api/render functions;
       the browser never encodes unless the server path fails or the
       selection exceeds the 10-minute server cap. */
    const cloudHandleRef: { current: { cancel: () => void } | null } = {
      current: null,
    };

    const buildCloudSpec = async () => {
      pushLog({ msg: "Measuring audio…", pct: 1 });
      const durations = await estimateAyahDurationsSec({
        ayahs: selectedAyahsData,
        reciter: selectedReciter,
        surah: selectedSurah,
      });
      if (!durations) throw new Error("Could not measure audio durations");

      const bg: {
        mode: "pexels" | "upload" | "none";
        urls?: string[];
      } = { mode: "none" };
      if (settings.background === "pexels" || settings.background === "library") {
        const urls = settings.videoUrls?.length
          ? settings.videoUrls
          : settings.videoUrl
            ? [settings.videoUrl]
            : [];
        /* BOTH fields — mode stays "none" + urls set means the server
           renders the gradient fallback while believing a bg was
           requested. This exact mismatch shipped the black-bg bug. */
        if (urls.length) {
          bg.mode = "pexels";
          bg.urls = urls;
        }
      }

      const spec = {
        ayahs: selectedAyahsData.map((a, i) => ({
          key: selectedSurah!.number + ":" + a.numberInSurah,
          numberInSurah: a.numberInSurah,
          text: a.text,
          translation: a.translation ?? "",
          durationSec: durations[i],
        })),
        surah: {
          number: String(selectedSurah!.number),
          name: selectedSurah!.name,
          englishName: selectedSurah!.englishName,
        },
        reciter: {
          quranApiNo: selectedReciter!.quranApiNo ?? 0,
          everyayahFolder: getEveryayahFolder(selectedReciter!.quranApiNo ?? 0),
          primary: selectedReciter!.primary !== false,
        },
        settings: settings as unknown as Record<string, unknown>,
        platform: {
          aspect: selectedPlatform.aspect as "16:9" | "9:16" | "1:1",
          id: selectedPlatform.id,
        },
        bg,
        quality: { isLowPower: false },
      };

      if (settings.background === "upload" && settings.uploadedVideoFile instanceof File) {
        return { ...spec, bg: { mode: "upload" as const } };
      }
      return spec;
    };

    const bgUploadFile =
      settings.background === "upload" && settings.uploadedVideoFile instanceof File
        ? settings.uploadedVideoFile
        : null;

    try {
      let blob: Blob | null = null;

      try {
        blob = await renderVideoCloud(
          await buildCloudSpec(),
          (msg, pct) => pushLog({ msg, pct }),
          cloudHandleRef,
          bgUploadFile,
        );
      } catch (cloudErr: any) {
        /* User hit Cancel → honor it; anything else is a server-path
           failure → fall back to the in-browser pipeline (if capable). */
        if (ctrl.signal.aborted) {
          throw new DOMException("Aborted", "AbortError");
        }
        /* A server-side TIMEOUT must not look like user cancel —
           AbortSignal-abort() from our own timer carries
           TimeoutError/message tag, fall through to local render. */
        if (
          cloudErr?.name === "AbortError" &&
          cloudErr?.message !== "midhkar-cloud-timeout"
        ) {
          throw cloudErr;
        }
        if (!isWebCodecsSupported()) throw cloudErr;
        pushLog({
          msg: "Server render unavailable — rendering on your device…",
          pct: 0,
        });
        blob = null;
      }

      if (!blob) {
        blob = await generateVideo({
          ayahs: selectedAyahsData,
          surah: selectedSurah,
          reciter: selectedReciter,
          settings,
          platform: selectedPlatform,
          onLog: pushLog,
          signal: ctrl.signal,
        });
      }

      if (objectUrlRef.current) {
        // Defer: the result <video> may still hold this src until React
        // re-renders; revoking synchronously logs ERR_FILE_NOT_FOUND.
        const stale = objectUrlRef.current;
        setTimeout(() => URL.revokeObjectURL(stale), 1000);
      }
      const url = URL.createObjectURL(blob);
      objectUrlRef.current = url;
      setResultVideoUrl(url);
      setGenLogs((prev) => [...prev, stamp({ msg: "✅ Done!", pct: 100 })]);
    } catch (err: any) {
      if (err?.name === "AbortError") {
        setGenLogs((prev) => [...prev, stamp({ msg: "Cancelled.", pct: 0 })]);
      } else {
        console.error("[VideoBuilder] generation error:", err);
        setGenLogs((prev) => [
          ...prev,
          stamp({ msg: `❌ Error: ${err?.message ?? String(err)}`, pct: 0 }),
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
    stamp,
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

  // Prefetch audio as soon as reciter + surah + verses are ready. The
  // decoded-audio cache is LRU-capped and survives verse toggles — wiping
  // it here (as before) re-downloaded the whole selection on every toggle.
  useEffect(() => {
    if (selectedReciter && selectedSurah && selectedAyahsData.length > 0) {
      prefetchAudio(selectedAyahsData, selectedReciter, selectedSurah).catch(
        console.error,
      );
    }
  }, [selectedReciter, selectedSurah, selectedAyahsData]);

  // Drop the cache only when the reciter or surah actually changes (or on
  // unmount) — its keys include both, so old entries are never served.
  useEffect(() => {
    return () => {
      clearAudioCache();
    };
  }, [selectedReciter, selectedSurah]);

  // Accurate total video length: decode real audio durations for the selection.
  // Re-runs whenever verses/reciter/verse-spacing change; cancelled on change/unmount.
  useEffect(() => {
    durationCtrlRef.current?.abort();
    const hasSelection =
      !!selectedReciter && !!selectedSurah && selectedAyahsData.length > 0;
    if (!hasSelection) {
      setTotalDurationSec(null);
      setDurationLoading(false);
      return;
    }
    const ctrl = new AbortController();
    durationCtrlRef.current = ctrl;
    setDurationLoading(true);
    estimateTotalDurationSec({
      ayahs: selectedAyahsData,
      reciter: selectedReciter,
      surah: selectedSurah,
      verseSpacingSec: settings.verseSpacing ?? 0,
      signal: ctrl.signal,
    })
      .then((sec) => {
        if (!ctrl.signal.aborted) setTotalDurationSec(sec);
      })
      .catch(() => {
        if (!ctrl.signal.aborted) setTotalDurationSec(null);
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setDurationLoading(false);
      });
    return () => ctrl.abort();
  }, [
    selectedReciter,
    selectedSurah,
    selectedAyahsData,
    settings.verseSpacing,
  ]);

  /* ── Legacy cleanup: drafts/checkpoints were removed — wipe old keys ── */
  useEffect(() => {
    try {
      localStorage.removeItem("midhkar-draft");
      localStorage.removeItem("midhkar-checkpoint");
    } catch {
      /* storage unavailable */
    }
  }, []);

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
    loadedBgSrcRef.current = null;
  }, [stopAudio]);

  const showSidePreview =
    step < 4 && !!selectedSurah && selectedAyahsData.length > 0;

  /* Entering the Generate step: drop any render job left behind by a
     previous session (refresh mid-render). Live renders manage their
     own cleanup in render-client. */
  const prevStepRef = useRef(step);
  useEffect(() => {
    if (step === 4 && prevStepRef.current !== 4 && !isGenerating) clearStaleJob();
    prevStepRef.current = step;
  }, [step, isGenerating]);

  return (
    <div className="garden-ground relative min-h-screen overflow-hidden">
      <StudioBackdrop step={step} />

      {/* Hidden video element — used only for the live preview.
          Preloaded eagerly (see effect above) as soon as a background
          video is chosen, decoupled from generation. */}
      <video
        ref={bgVideoRef}
        className="hidden"
        muted
        loop
        playsInline
        preload="auto"
        crossOrigin="anonymous"
      />

      <div className="relative z-10 mx-auto max-w-7xl px-6 py-16 sm:py-20">
        <div className="relative mb-10">
          <div className="text-center">
            <div className="mb-3 flex items-center justify-center gap-2 text-gold/70">
              <GardenMark className="h-7 w-7" />
            </div>
            <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              {locale === "ar" ? "استوديو الفيديو القرآني" : "Quran Video Studio"}
            </h1>
            <p className="mx-auto mt-2 max-w-md text-sm text-parchment-muted">
              {selectedSurah
                ? locale === "ar"
                  ? `${selectedSurah.name} · ${selectedSurah.number}${sortedNums.length ? ` · ${sortedNums[0]}–${sortedNums[sortedNums.length - 1]}` : ""}`
                  : `${selectedSurah.englishName} · ${selectedSurah.number}${sortedNums.length ? ` · ${sortedNums[0]}–${sortedNums[sortedNums.length - 1]}` : ""}`
                : locale === "ar"
                  ? "اختر سورة وقارئا واصنع فيديو قرآني احترافي مع الصوت الكامل"
                  : "Choose a surah and reciter — generate a professional Quran video with full synchronized audio"}
            </p>
          </div>

          {/* Product Tour — dynamically imported to keep the wizard bundle lean.
              Renders the "?" replay pill beside the heading + welcome card + coach-marks. */}
          <ProductTour step={step} busy={isGenerating || !!resultVideoUrl} />
        </div>

        <StepIndicator step={step} locale={locale} onNavigate={goTo} />

        <div
          className={
            showSidePreview
              ? "grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_auto]"
              : ""
          }
        >
          <AnimatePresence mode="wait" initial={false} custom={stepDir}>
            <m.div
              key={step}
              className="min-w-0"
              custom={stepDir}
              variants={{
                enter: (dir: number) => ({ opacity: 0, x: dir >= 0 ? 44 : -44 }),
                center: { opacity: 1, x: 0 },
                exit: (dir: number) => ({ opacity: 0, x: dir >= 0 ? -26 : 26 }),
              }}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.32, ease: EASE_OUT }}
            >
        {step === 1 && (
          <StepSurah
            surahs={surahs}
            loading={surahsLoading}
            selected={selectedSurah}
            onSelect={handleSurahSelect}
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
            onBack={() => goTo(1)}
            onNext={() => goTo(3)}
            locale={locale}
            surahNumber={selectedSurah.number}
            reciterIdentifier={selectedReciter?.identifier ?? null}
            reciters={reciters}
            totalDurationSec={totalDurationSec}
            durationLoading={durationLoading}
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
            /* ── Supabase Library (disabled — restore by uncommenting) ──
            storageVideos={videos}
            videosLoading={videosLoading}
            ──────────────────────────────────────────────────────────── */
            onFileUpload={handleFileUpload}
            uploadError={uploadError}
            onBack={() => goTo(2)}
            onNext={() => goTo(4)}
            locale={locale}
            totalDurationSec={totalDurationSec}
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
                const stale = objectUrlRef.current;
                objectUrlRef.current = null;
                setResultVideoUrl(null);
                setGenLogs([]);
                if (stale) setTimeout(() => URL.revokeObjectURL(stale), 1000);
              }}
              onStartOver={handleStartOver}
              onBack={() => goTo(3)}
              locale={locale}
            />
          )}
            </m.div>
          </AnimatePresence>

          <AnimatePresence>
            {showSidePreview && selectedSurah && (
              <m.aside
                className="hidden lg:block"
                initial={{ opacity: 0, x: 48 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 48 }}
                transition={{ duration: 0.5, ease: EASE_OUT }}
              >
                <div className="sticky top-8" data-tour="side-preview">
                  <LivePreview
                    surah={selectedSurah}
                    ayahs={selectedAyahsData}
                    settings={settings}
                    platform={selectedPlatform}
                    bgVideoRef={bgVideoRef}
                    previewIdx={Math.min(
                      previewIdx,
                      Math.max(0, selectedAyahsData.length - 1),
                    )}
                    onPreviewIdx={setPreviewIdx}
                    locale={locale}
                    height={400}
                    showControls={false}
                  />
                  <p className="mt-3 max-w-[240px] text-center text-[13px] text-parchment-dim">
                    {locale === "ar"
                      ? "معاينة حية — مطابقة للفيديو النهائي"
                      : "Live preview — pixel-accurate to the final video"}
                  </p>
                </div>
              </m.aside>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
