"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { GardenMark } from "@/components/Ornament/ornaments";
import {
  SearchIcon,
  IslamicStarIcon,
  MicIcon,
  VideoCameraIcon,
} from "./icons";

/* ─────────────────────────────────────────────────────────────
   Product Tour — "The Guided Studio"
   Phase A: welcome card, once per browser (midhkar-tour-done)
   Phase B: non-blocking coach-marks, one per wizard step, shown
            on first organic arrival (midhkar-tour-tips)
   Replay: "?" pill re-runs the whole flow for the current
           session without touching stored flags
   ───────────────────────────────────────────────────────────── */

const STORAGE_DONE = "midhkar-tour-done";
const STORAGE_TIPS = "midhkar-tour-tips";

type StepId = 1 | 2 | 3 | 4;
type L10n = { en: string; fr: string; ar: string };

type StopDef = {
  step: StepId;
  key: string;
  selector: string;
  icon: React.ReactNode;
  title: L10n;
  body: L10n;
};

const railGlyph = (
  <svg
    className="h-3.5 w-3.5"
    viewBox="0 0 24 12"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    aria-hidden="true"
  >
    <path d="M4 6h16" opacity="0.5" />
    <circle cx="4" cy="6" r="2.2" />
    <circle cx="12" cy="6" r="2.2" />
    <circle cx="20" cy="6" r="2.2" />
  </svg>
);

const STOPS: StopDef[] = [
  {
    step: 1,
    key: "step-rail",
    selector: '[data-tour="step-rail"]',
    icon: railGlyph,
    title: { en: "Your path", fr: "Votre parcours", ar: "مسارك" },
    body: {
      en: "These four stations light up as you go — completed steps stay clickable, so you can always hop back.",
      fr: "Ces quatre stations s'illuminent au fil de votre avancée — les étapes terminées restent cliquables pour revenir.",
      ar: "تضيء هذه المحطات الأربع كلما تقدمت — والخطوات المكتملة تبقى قابلة للنقر لتعود إليها متى شئت.",
    },
  },
  {
    step: 1,
    key: "surah-search",
    selector: '[data-tour="surah-search"]',
    icon: <SearchIcon className="h-3.5 w-3.5" />,
    title: {
      en: "Find your surah",
      fr: "Trouvez votre sourate",
      ar: "اعثر على سورتك",
    },
    body: {
      en: "Search by name, meaning, or number — or browse the full index. Picking a surah carries you to the next step.",
      fr: "Recherchez par nom, sens ou numéro — ou parcourez l'index. Choisir une sourate vous mène à l'étape suivante.",
      ar: "ابحث بالاسم أو المعنى أو الرقم — أو تصفّح الفهرس كاملاً. اختيار سورة ينقلك إلى الخطوة التالية.",
    },
  },
  {
    step: 2,
    key: "verses-presets",
    selector: '[data-tour="verses-presets"]',
    icon: <IslamicStarIcon className="h-3.5 w-3.5" />,
    title: {
      en: "Choose your verses",
      fr: "Choisissez vos versets",
      ar: "اختر آياتك",
    },
    body: {
      en: "Tap a preset for the first verses or the whole surah — or pick ayahs one by one. The chip counts your exact video length as you go.",
      fr: "Touchez un préréglage pour les premiers versets ou la sourate entière — ou choisissez les ayahs un à un. La pastille compte la durée exacte de votre vidéo.",
      ar: "اضغط جاهزاً لأول الآيات أو السورة كاملة — أو اختر الآيات واحدة واحدة. تحسب الشارة مدة الفيديو الدقيقة أثناء اختيارك.",
    },
  },
  {
    step: 3,
    key: "platform-cards",
    selector: '[data-tour="platform-cards"]',
    icon: <MicIcon className="h-3.5 w-3.5" />,
    title: {
      en: "Pick a platform",
      fr: "Choisissez une plateforme",
      ar: "اختر المنصة",
    },
    body: {
      en: "The platform sets the exact export size. Then choose a reciter and make it yours — background, fonts, colors, effects.",
      fr: "La plateforme fixe la taille exacte de l'export. Choisissez ensuite un récitant et personnalisez — fond, polices, couleurs, effets.",
      ar: "تحدد المنصة حجم التصدير بدقة. ثم اختر قارئاً واجعله لك — الخلفية والخطوط والألوان والتأثيرات.",
    },
  },
  {
    step: 4,
    key: "generate-button",
    selector: '[data-tour="generate-button"]',
    icon: <VideoCameraIcon className="h-3.5 w-3.5" />,
    title: {
      en: "Preview & generate",
      fr: "Aperçu & génération",
      ar: "المعاينة والإنتاج",
    },
    body: {
      en: "Watch the live preview, then generate — the video is encoded right here in your browser and saved as an MP4.",
      fr: "Regardez l'aperçu en direct, puis générez — la vidéo est encodée ici même dans votre navigateur et enregistrée en MP4.",
      ar: "شاهد المعاينة الحيّة ثم أنشئ الفيديو — يتم الترميز هنا في متصفحك ويُحفظ بصيغة MP4.",
    },
  },
];

/* ─────────────────────────────────────────────────────────────
   Storage helpers
   ───────────────────────────────────────────────────────────── */

function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function writeFlag(key: string, value: boolean) {
  try {
    if (value) localStorage.setItem(key, "1");
    else localStorage.removeItem(key);
  } catch {
    /* storage unavailable */
  }
}

function readTipMask(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_TIPS);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function writeTipMask(mask: Set<string>) {
  try {
    localStorage.setItem(STORAGE_TIPS, JSON.stringify(Array.from(mask)));
  } catch {
    /* storage unavailable */
  }
}

/* Lock body scroll while the welcome dialog is open. */
function useBodyScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [locked]);
}

/* ─────────────────────────────────────────────────────────────
   Welcome card — Phase A
   ───────────────────────────────────────────────────────────── */

const WELCOME_STEPS: {
  step: StepId;
  icon: React.ReactNode;
  label: L10n;
  promise: L10n;
}[] = [
  {
    step: 1,
    icon: <SearchIcon className="h-3.5 w-3.5" />,
    label: { en: "Surah", fr: "Sourate", ar: "السورة" },
    promise: {
      en: "pick from all 114 chapters",
      fr: "parmi les 114 sourates",
      ar: "من بين ١١٤ سورة",
    },
  },
  {
    step: 2,
    icon: <IslamicStarIcon className="h-3.5 w-3.5" />,
    label: { en: "Verses", fr: "Versets", ar: "الآيات" },
    promise: {
      en: "select ayahs, see the exact length",
      fr: "choisissez les ayahs, voyez la durée exacte",
      ar: "اختر الآيات وشاهد المدة الدقيقة",
    },
  },
  {
    step: 3,
    icon: <MicIcon className="h-3.5 w-3.5" />,
    label: { en: "Settings", fr: "Réglages", ar: "الإعدادات" },
    promise: {
      en: "platform, reciter, background & style",
      fr: "plateforme, récitant, fond & style",
      ar: "المنصة والقارئ والخلفية والطراز",
    },
  },
  {
    step: 4,
    icon: <VideoCameraIcon className="h-3.5 w-3.5" />,
    label: { en: "Generate", fr: "Générer", ar: "الإنتاج" },
    promise: {
      en: "live preview, then MP4 in your browser",
      fr: "aperçu en direct, puis MP4 dans votre navigateur",
      ar: "معاينة حيّة ثم MP4 في متصفحك",
    },
  },
];

function WelcomeCard({
  locale,
  onStart,
  onSkip,
}: {
  locale: string;
  onStart: () => void;
  onSkip: () => void;
}) {
  const L = (o: L10n) =>
    locale === "ar" ? o.ar : locale === "fr" ? o.fr : o.en;
  const ar = locale === "ar";

  const dialogRef = useRef<HTMLDivElement>(null);
  const startRef = useRef<HTMLButtonElement>(null);
  const previouslyFocused = useRef<Element | null>(null);

  useBodyScrollLock(true);

  useEffect(() => {
    previouslyFocused.current = document.activeElement;
    startRef.current?.focus();
    return () => {
      const el = previouslyFocused.current as HTMLElement | null;
      if (el && el.isConnected) el.focus?.();
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onSkip();
        return;
      }
      if (e.key === "Tab") {
        const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(
          'button, [href], input, [tabindex]:not([tabindex="-1"])',
        );
        if (!focusables || focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [onSkip]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center overflow-y-auto bg-ink/80 p-4 backdrop-blur-sm sm:items-center"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onSkip();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-welcome-title"
        dir={ar ? "rtl" : "ltr"}
        className="tour-card-in panel-lit mx-auto w-full max-w-md rounded-2xl bg-ink-soft/95 p-6 sm:p-8"
      >
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-gold/30 bg-gold/10 text-gold lit-soft">
          <GardenMark className="h-6 w-6" />
        </div>

        <h3
          id="tour-welcome-title"
          className="text-center font-display text-2xl font-medium text-parchment"
        >
          {L({
            en: "Welcome to the Studio",
            fr: "Bienvenue au Studio",
            ar: "أهلاً بك في الاستوديو",
          })}
        </h3>
        <p className="mx-auto mt-2 max-w-xs text-center text-sm leading-relaxed text-parchment-muted">
          {L({
            en: "Turn any passage of the Qur'an into a beautiful, shareable video — in four gentle steps.",
            fr: "Transformez n'importe quel passage du Coran en une belle vidéo partageable — en quatre étapes.",
            ar: "حوّل أي مقطع من القرآن إلى فيديو جميل قابل للمشاركة — في أربع خطوات هادئة.",
          })}
        </p>

        <div className="my-6 space-y-2" role="list">
          {WELCOME_STEPS.map((s, i) => (
            <div key={s.step} role="listitem" className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-gold/35 bg-gold/10 text-gold">
                  {s.icon}
                </div>
                {i < WELCOME_STEPS.length - 1 && (
                  <span className="my-1 w-px flex-1 bg-gradient-to-b from-gold/25 to-gold/5" />
                )}
              </div>
              <div className="min-w-0 pb-1 pt-1">
                <p className="text-[13px] text-parchment-muted">
                  <span className="font-semibold text-parchment">
                    {L(s.label)}
                  </span>
                  <span className="mx-1.5 text-gold/50" aria-hidden="true">
                    ·
                  </span>
                  {L(s.promise)}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2.5">
          <button
            ref={startRef}
            type="button"
            onClick={onStart}
            className="btn-primary w-full px-6 py-3 text-sm"
          >
            {L({
              en: "Start the tour",
              fr: "Commencer la visite",
              ar: "ابدأ الجولة",
            })}
          </button>
          <button
            type="button"
            onClick={onSkip}
            className="btn-ghost w-full px-6 py-2.5 text-sm"
          >
            {L({
              en: "Skip for now",
              fr: "Passer pour l'instant",
              ar: "تخطَّ الآن",
            })}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Coach-mark — Phase B (non-modal, never blocks interaction)
   ───────────────────────────────────────────────────────────── */

type TipPlacement = { top: number; left: number };

function CoachMark({
  locale,
  stop,
  onDismiss,
}: {
  locale: string;
  stop: StopDef;
  onDismiss: () => void;
}) {
  const L = (o: L10n) =>
    locale === "ar" ? o.ar : locale === "fr" ? o.fr : o.en;
  const ar = locale === "ar";

  const [placement, setPlacement] = useState<TipPlacement | null>(null);
  const [isMobile] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 639px)").matches,
  );
  const tipRef = useRef<HTMLDivElement>(null);

  /* Fixed-position math from the anchor's live rect — recomputed
     on scroll/resize through a passive, rAF-batched listener. */
  const recompute = useCallback(() => {
    const target = document.querySelector(stop.selector);
    const tip = tipRef.current;
    if (!target || !tip) return;
    const rect = target.getBoundingClientRect();
    const tipRect = tip.getBoundingClientRect();
    const vw = window.innerWidth;

    const above =
      window.innerHeight - rect.bottom < tipRect.height + 24 &&
      rect.top > tipRect.height + 24;
    const top = above
      ? rect.top - tipRect.height - 10
      : rect.bottom + 10;

    const rawLeft = rect.left + rect.width / 2 - tipRect.width / 2;
    const left = Math.min(Math.max(rawLeft, 12), vw - tipRect.width - 12);
    setPlacement({ top, left });
  }, [stop.selector]);

  useEffect(() => {
    recompute();
    let raf = 0;
    const schedule = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        recompute();
      });
    };
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [recompute]);

  /* Self-dismiss if the anchor unmounts (user moved on). */
  useEffect(() => {
    const poll = window.setInterval(() => {
      if (!document.querySelector(stop.selector)) onDismiss();
    }, 400);
    return () => window.clearInterval(poll);
  }, [stop.selector, onDismiss]);

  /* Highlight ring via class — removed with the component. */
  useEffect(() => {
    const target = document.querySelector(stop.selector);
    if (!(target instanceof HTMLElement)) return;
    const prevZ = target.style.zIndex;
    target.classList.add("tour-target");
    target.style.zIndex = "1";
    return () => {
      target.classList.remove("tour-target");
      target.style.zIndex = prevZ;
    };
  }, [stop.selector]);

  return (
    <div
      ref={tipRef}
      role="status"
      dir={ar ? "rtl" : "ltr"}
      className={
        isMobile
          ? "tour-sheet-in fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom,0px)+14px)] z-[70] rounded-2xl border border-gold/40 bg-ink-soft/95 p-4 shadow-lit backdrop-blur-md"
          : `tour-tip-in fixed z-[70] w-72 rounded-2xl border border-gold/40 bg-ink-soft/95 p-4 shadow-lit backdrop-blur-md${
              placement ? "" : " pointer-events-none opacity-0"
            }`
      }
      style={
        !isMobile && placement
          ? { top: `${placement.top}px`, left: `${placement.left}px` }
          : undefined
      }
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-gold/35 bg-gold/10 text-gold">
          {stop.icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-parchment">
            {L(stop.title)}
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-parchment-muted">
            {L(stop.body)}
          </p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label={L({ en: "Dismiss", fr: "Fermer", ar: "إغلاق" })}
          className="shrink-0 rounded-full border border-gold/20 p-1 text-parchment-dim transition-colors hover:border-gold/50 hover:text-gold focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
        >
          <svg
            className="h-3 w-3"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Tour — orchestrator
   ───────────────────────────────────────────────────────────── */

type Phase = "boot" | "idle" | "welcome" | "tips";

export function Tour({ step, busy }: { step: number; busy?: boolean }) {
  const { locale } = useI18n();
  const L = (o: L10n) =>
    locale === "ar" ? o.ar : locale === "fr" ? o.fr : o.en;

  const [phase, setPhase] = useState<Phase>("boot");
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [replaying, setReplaying] = useState(false);

  /* The shown-tips mask lives in a ref so picking a tip never
     re-triggers the picker (which would cascade through all stops
     of a step in one cycle). Mirrored to storage immediately. */
  const maskRef = useRef<Set<string> | null>(null);
  const replayRef = useRef(false);
  const pickedForRef = useRef<number | null>(null);

  /* Read persisted state once on mount; first visit opens the
     welcome card after the wizard's step-in settles. */
  useEffect(() => {
    maskRef.current = readTipMask();
    if (readFlag(STORAGE_DONE)) {
      setPhase("idle");
      return;
    }
    const timer = window.setTimeout(() => setPhase("welcome"), 700);
    return () => window.clearTimeout(timer);
  }, []);

  /* Advance to the next unshown tip of the current step, marking
     it shown the moment it is picked (never repeats, even if the
     user advances without dismissing). */
  const advance = useCallback(() => {
    if (!maskRef.current) maskRef.current = new Set();
    const mask = maskRef.current;
    const next = STOPS.find((s) => s.step === step && !mask.has(s.key));
    if (next) {
      mask.add(next.key);
      if (!replayRef.current) writeTipMask(mask);
    }
    setActiveKey(next?.key ?? null);
  }, [step]);

  /* Show a tip on first arrival at each step (or right after the
     welcome card). pickedForRef guards against double-picks for
     the same step transition (React StrictMode / re-renders). */
  useEffect(() => {
    if (phase !== "tips") {
      setActiveKey(null);
      pickedForRef.current = null;
      return;
    }
    if (pickedForRef.current === step) return;
    pickedForRef.current = step;
    advance();
  }, [phase, step, advance]);

  const dismiss = useCallback(() => {
    advance();
  }, [advance]);

  const handleReplay = useCallback(() => {
    replayRef.current = true;
    setReplaying(true);
    maskRef.current = new Set();
    setActiveKey(null);
    pickedForRef.current = null;
    setPhase("welcome");
  }, []);

  const endReplay = useCallback(() => {
    replayRef.current = false;
    setReplaying(false);
    maskRef.current = readTipMask();
    pickedForRef.current = null;
    setPhase("idle");
  }, []);

  const finishFirstVisit = useCallback((startTour: boolean) => {
    writeFlag(STORAGE_DONE, true);
    setPhase(startTour ? "tips" : "idle");
  }, []);

  const visibleStop =
    activeKey !== null
      ? (STOPS.find((s) => s.key === activeKey) ?? null)
      : null;
  const showTip = phase === "tips" && visibleStop !== null && !busy;

  return (
    <>
      {/* Replay "?" pill — sits beside the studio heading */}
      {(phase === "idle" || phase === "tips") && !busy && (
        <button
          type="button"
          onClick={handleReplay}
          aria-label={L({
            en: "Take the tour",
            fr: "Faire la visite",
            ar: "استكشف الجولة",
          })}
          title={L({
            en: "Take the tour",
            fr: "Faire la visite",
            ar: "استكشف الجولة",
          })}
          className="btn-ghost absolute end-0 top-0 flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-semibold"
        >
          ?
        </button>
      )}

      {phase === "welcome" && (
        <WelcomeCard
          key={replaying ? "replay" : "first"}
          locale={locale}
          onStart={() => {
            if (replaying) {
              setReplaying(false);
              replayRef.current = true;
              setPhase("tips");
            } else {
              finishFirstVisit(true);
            }
          }}
          onSkip={() => {
            if (replaying) {
              endReplay();
            } else {
              finishFirstVisit(false);
            }
          }}
        />
      )}

      {showTip && visibleStop && (
        <CoachMark
          key={`${visibleStop.key}-${step}-${replaying ? "r" : "f"}`}
          locale={locale}
          stop={visibleStop}
          onDismiss={dismiss}
        />
      )}
    </>
  );
}
