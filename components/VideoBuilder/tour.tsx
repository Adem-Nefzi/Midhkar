"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useI18n } from "@/lib/i18n";

/* ──────────────────────────────────────────────
   Storage keys
   ────────────────────────────────────────────── */

const STORAGE_DONE = "midhkar-tour-done";
const STORAGE_TIPS = "midhkar-tour-tips";

/* ──────────────────────────────────────────────
   Stop definitions — one per step
   ────────────────────────────────────────────── */

type StopDef = {
  key: string;
  labelEn: string;
  labelFr: string;
  labelAr: string;
  selector: string;
  tolerant: boolean;
};

const stops: StopDef[] = [
  {
    key: "surah-search",
    labelEn: "Search for a surah name, meaning, or number…",
    labelFr: "Recherchez le nom, le sens ou le numéro d'une sourate…",
    labelAr: "ابحث عن اسم، معنى أو رقم سورَة…",
    selector: '[data-tour="surah-search"]',
    tolerant: true,
  },
  {
    key: "verses-presets",
    labelEn: "Pick a preset (Full, 1–5, 1–10…) or select verses individually",
    labelFr: "Choisissez un modèle (Tout, 1–5, 1–10…) ou sélectionnez les versets individuellement",
    labelAr: "حدد preset (الكاملة، أول 5، أول 10…) أو حدد الآيات فردياً",
    selector: '[data-tour="verses-presets"]',
    tolerant: true,
  },
  {
    key: "platform-cards",
    labelEn: "Choose a platform — it sets the exact video dimensions",
    labelFr: "Choisissez une plateforme — cela définit les dimensions exactes de la vidéo",
    labelAr: "اختر المنصة — تحدد الأبعاد exacte للفيديو",
    selector: '[data-tour="platform-cards"]',
    tolerant: true,
  },
  {
    key: "generate-button",
    labelEn: "Preview your video, then generate — everything runs in your browser",
    labelFr: "Apercevez votre vidéo, puis générez — tout s'exécute dans votre navigateur",
    labelAr: "معاينة الفيديو ثم الجيل — تتم العملية كلها في المتصفح",
    selector: '[data-tour="generate-button"]',
    tolerant: true,
  },
];

/* ──────────────────────────────────────────────
   Coach-mark component
   ────────────────────────────────────────────── */

function CoachMark({
  key,
  selector,
  labelEn,
  labelFr,
  labelAr,
  t,
  onDismiss,
}: {
  key: string;
  selector: string;
  labelEn: string;
  labelFr: string;
  labelAr: string;
  t: (key: string) => string;
  onDismiss: () => void;
}) {
  const { locale } = useI18n();
  const [mounted, setMounted] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);

  const keyAr = `tour-${key}-ar`;
  const keyFr = `tour-${key}-fr`;
  const keyEn = `tour-${key}-en`;
  const text = locale === "ar"
    ? t(keyAr)
    : locale === "fr"
    ? t(keyFr)
    : t(keyEn);

  useEffect(() => {
    const update = () => {
      const target = document.querySelector(selector) as HTMLElement | null;
      if (!target) {
        setMounted(false);
        return;
      }
      const rect = target.getBoundingClientRect();
      const style = tipRef.current?.style as CSSStyleDeclaration;
      style.width = `${Math.min(rect.width, 300)}px`;
      const spaceBelow = window.innerHeight - rect.bottom - 80;
      const spaceAbove = rect.top - 40;
      if (spaceBelow < 80 && spaceAbove >= 40) {
        style.top = `${rect.top + window.scrollY - 50}px`;
        style.bottom = "auto";
        style.left = `${rect.left + window.scrollX}px`;
      } else {
        style.top = `${rect.bottom + window.scrollY + 8}px`;
        style.bottom = "auto";
        style.left = `${rect.left + window.scrollX}px`;
      }
      setMounted(true);
    };
    update();
    const raf = requestAnimationFrame(update);
    return () => cancelAnimationFrame(raf);
  }, [selector, locale]);

  useEffect(() => {
    if (!mounted) return;
    const target = document.querySelector(selector) as HTMLElement | null;
    if (target) {
      ;(target as HTMLElement).style.boxShadow = `0 0 0 3px rgb(var(--gold) / 0.4)`;
      const style = document.createElement("style");
      style.textContent = `
        @media (prefers-reduced-motion: no-preference) {
          @keyframes tour-pulse {
            0%   { box-shadow: 0 0 0 3px rgb(var(--gold) / 0.4); }
            50%  { box-shadow: 0 0 0 6px rgb(var(--gold) / 0.7); }
            100% { box-shadow: 0 0 0 3px rgb(var(--gold) / 0.4); }
          }
        }
      `;
      document.head.appendChild(style);
    }
    return () => {
      const t = document.querySelector(selector);
      if (t) (t as HTMLElement).style.boxShadow = "";
    };
  }, [selector, mounted]);

  return mounted ? (
    <div
      ref={overlayRef}
      className="fixed z-[70] pointer-events-none inset-0"
      style={{ top: 0, left: 0, width: "100%", height: "100%" }}
    >
      {mounted && (
        <div
          ref={tipRef}
          className="fixed pointer-events-auto z-[71] rounded-xl border border-gold/40 bg-gold/5 shadow-lit transition-all duration-300"
          style={{
            minWidth: 200,
            maxWidth: 300,
            width: "auto",
            top: 0,
            left: 0,
          }}
        >
          <div className="p-4">
            <p className="text-[13px] text-parchment muted">{text}</p>
            <button
              onClick={onDismiss}
              className="mt-2 btn-ghost text-sm w-full"
              aria-label={t("dismiss")}
            >
              {t("got-it")}
            </button>
          </div>
        </div>
      )}
    </div>
  ) : null;
}

/* ──────────────────────────────────────────────
   Welcome card
   ────────────────────────────────────────────── */

function WelcomeCard({
  show,
  setShow,
  t,
}: {
  show: boolean;
  setShow: (v: boolean) => void;
  t: (key: string) => string;
}) {
  const { locale } = useI18n();

  const handleStart = () => {
    setShow(false);
    try {
      localStorage.setItem(STORAGE_DONE, "1");
    } catch {
      /* storage unavailable */
    }
  };

  const handleSkip = () => {
    setShow(false);
    try {
      localStorage.setItem(STORAGE_DONE, "1");
    } catch {
      /* storage unavailable */
    }
  };

  const steps = [
    { id: "1", label: t("step-1") as string },
    { id: "2", label: t("step-2") as string },
    { id: "3", label: t("step-3") as string },
    { id: "4", label: t("step-4") as string },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-welcome-title"
      className="fixed inset-0 z-[60] overflow-y-auto items-center bg-ink/80 backdrop-blur-sm"
      style={{ opacity: show ? 1 : 0.01 }}
    >
      <div
        className="relative w-full max-w-md mx-4 sm:max-w-lg p-6 sm:p-8 bg-ink-soft rounded-2xl border border-gold/20 lit"
        style={{ animationName: show ? "animate-step-in" : "none" }}
        aria-label={t("dialog-aria")}
      >
        <h3 id="tour-welcome-title" className="font-display text-xl font-medium text-parchment mb-4">
          {t("welcome-title")}
        </h3>

        <p className="text-parchment-muted text-sm mb-6">
          {t("welcome-sub")}
        </p>

        <div className="space-y-3 mb-6">
          {steps.map((s) => (
            <div
              key={s.id}
              className={`flex items-center gap-2 px-2 rounded-full border border-gold/20 bg-gold/5 text-[13px] font-medium ${
                s.id === "1" ? "text-gold" : "text-parchment-muted"
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-gold/60"></span>
              <span>{s.label}</span>
            </div>
          ))}
        </div>

        <div className="flex gap-3">
          <button onClick={handleStart} className="flex-1 btn-primary">
            {t("start-tour")}
          </button>
          <button onClick={handleSkip} className="flex-1 btn-ghost">
            {t("skip-tour")}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────
   Main Tour component
   ────────────────────────────────────────────── */

interface TourProps {
  step: number;
}

export function Tour({ step }: TourProps) {
  const { locale, t } = useI18n();

  /* ── Persistence ───────────────────────────── */
  const [done, setDone] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_DONE) === "1";
    } catch {
      return false;
    }
  });
  const [tipsShown, setTipsShown] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_TIPS);
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch {
      return new Set();
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_TIPS, JSON.stringify(Array.from(tipsShown)));
    } catch {
      /* storage unavailable */
    }
  }, [tipsShown]);

  /* ── Phase logic ───────────────────────────── */
  const [phase, setPhase] = useState<string>("idle");

  // On mount: if not done, show welcome after delay
  useEffect(() => {
    if (done) return;
    const timer = setTimeout(() => setPhase("welcome"), 700);
    return () => clearTimeout(timer);
  }, [done]);

  // Welcome → tips
  useEffect(() => {
    if (phase === "welcome") {
      setPhase("tips");
      try {
        localStorage.setItem(STORAGE_DONE, "1");
      } catch {
        /* storage unavailable */
      }
    }
  }, [phase]);

  // Tips: show coach-mark for current step if not already shown
  useEffect(() => {
    if (phase !== "tips") return;
    const stop = stops[step - 1];
    if (!stop) return;

    const alreadyShown = tipsShown.has(stop.key);
    if (alreadyShown) {
      if (step === 4) {
        setPhase("done");
        try {
          localStorage.setItem(STORAGE_DONE, "1");
        } catch {
          /* storage unavailable */
        }
      }
      return;
    }

    setPhase("tips-visible");
    setTipsShown((prev) => new Set([...prev, stop.key]));

    // Auto-advance after 5s or on dismiss
    const timer = setTimeout(() => {
      if ((phase as string) === "tips-visible" && step < 4) {
        setPhase("tips");
      } else if ((phase as string) === "tips-visible" && step === 4) {
        setPhase("done");
        try {
          localStorage.setItem(STORAGE_DONE, "1");
        } catch {
          /* storage unavailable */
        }
      }
    }, 5000);

    return () => clearTimeout(timer);
  }, [phase, step, stops, tipsShown, done]);

  // Dismiss handler
  const handleDismiss = useCallback(() => {
    setPhase("tips");
  }, []);

  /* ── Replay ────────────────────────────────── */
  const [showReplay, setShowReplay] = useState(false);

  const handleReplay = useCallback(() => {
    setShowReplay(true);
    setTipsShown(new Set());
    try {
      localStorage.setItem(STORAGE_TIPS, JSON.stringify([]));
    } catch {
      /* storage unavailable */
    }
    setPhase("welcome");
  }, [tipsShown]);

  /* ── Render ────────────────────────────────── */
  const ReplayModal = () => {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-replay-title"
        className="fixed inset-0 z-[60] overflow-y-auto items-center bg-ink/80 backdrop-blur-sm"
        style={{ opacity: showReplay ? 1 : 0.01 }}
      >
        <div className="relative w-full max-w-md mx-4 sm:max-w-lg p-6 sm:p-8 bg-ink-soft rounded-2xl border border-gold/20 lit">
          <h3 id="tour-replay-title" className="font-display text-xl font-medium text-parchment mb-4">
            {t("replay-title")}
          </h3>
          <p className="text-parchment-muted text-sm mb-6">
            {t("replay-sub")}
          </p>
          <div className="space-y-3">
            <button onClick={() => setShowReplay(false)} className="flex-1 btn-primary w-full">
              {t("yes-start")}
            </button>
            <button onClick={() => setShowReplay(false)} className="flex-1 btn-ghost w-full">
              {t("no-thanks")}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const WelcomeView = () => (
    <WelcomeCard show={phase === "welcome"} setShow={() => setPhase("tips")} t={t as (key: string) => string} />
  );

  const CoachMarkView = () => {
    const stop = stops[step - 1];
    if (!stop) return null;
    return (
      <CoachMark
        key={stop.key}
        selector={stop.selector}
        labelEn={stop.labelEn}
        labelFr={stop.labelFr}
        labelAr={stop.labelAr}
        t={t as (key: string) => string}
        onDismiss={handleDismiss}
      />
    );
  };

  return (
    <div>
      {/* Replay modal */}
      {showReplay && <ReplayModal />}
      {/* Welcome card */}
      {phase === "welcome" && <WelcomeView />}
      {/* Coach mark */}
      {phase === "tips-visible" && <CoachMarkView />}
    </div>
  );
}