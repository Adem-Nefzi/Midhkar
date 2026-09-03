"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { GardenMark } from "@/components/Ornament/ornaments";
import {
  SearchIcon,
  IslamicStarIcon,
  MicIcon,
  VideoCameraIcon,
  FilmIcon,
  TimerIcon,
  PaletteIcon,
  TypeIcon,
  Shamsa,
} from "./icons";

/* ─────────────────────────────────────────────────────────────
   Product Tour — "The Guided Studio"
   Phase A: welcome card, once per browser (midhkar-tour-done)
   Phase B: step-by-step coach-marks, one per stop, chained with a
            Next button + progress dots; auto-shown on first organic
            arrival at each wizard step (midhkar-tour-tips)
   Replay: "?" pill re-runs the whole flow for the current session
           without touching stored flags
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
  /* ── Step 1 · Surah ────────────────────────────────────────── */
  {
    step: 1,
    key: "step-rail",
    selector: '[data-tour="step-rail"]',
    icon: railGlyph,
    title: { en: "Your path", fr: "Votre parcours", ar: "مسارك" },
    body: {
      en: "Four gentle stations — Surah, Verses, Settings, Generate. They light up as you go, and completed steps stay clickable, so you can always hop back.",
      fr: "Quatre stations — Sourate, Versets, Réglages, Génération. Elles s'illuminent au fil de votre avancée, et les étapes terminées restent cliquables.",
      ar: "أربع محطات هادئة — السورة، الآيات، الإعدادات، الإنتاج. تضيء كلما تقدمت، والخطوات المكتملة تبقى قابلة للنقر لتعود إليها.",
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
      en: "Search by name, meaning, or number — press ⌘K / Ctrl+K to jump here. The filter chips narrow the index: All, Meccan, Medinan, or the ones you recite most.",
      fr: "Recherchez par nom, sens ou numéro — ⌘K / Ctrl+K pour y accéder. Les pastilles filtrent l'index : toutes, mecquoises, médinoises, ou préférées.",
      ar: "ابحث بالاسم أو المعنى أو الرقم — واضغط ⌘K / Ctrl+K للوصول هنا. الأزرار تصنّف الفهرس: الكل، المكية، المدنية، أو الأكثر تلاوة.",
    },
  },
  {
    step: 1,
    key: "surah-popular",
    selector: '[data-tour="surah-popular"]',
    icon: <IslamicStarIcon className="h-3.5 w-3.5" />,
    title: {
      en: "Often recited",
      fr: "Souvent récitées",
      ar: "كثيرا ما تُتلى",
    },
    body: {
      en: "A quick rail of beloved surahs — one tap and you're on your way. Scroll it sideways for more.",
      fr: "Un accès rapide aux sourates aimées — un toucher et vous voilà parti. Faites défiler horizontalement.",
      ar: "وصول سريع إلى أشهر السور — لمسة واحدة وتبدأ رحلتك. اسحب جانبياً للمزيد.",
    },
  },
  {
    step: 1,
    key: "surah-index",
    selector: '[data-tour="surah-index"]',
    icon: <Shamsa className="h-3.5 w-3.5" />,
    title: {
      en: "The illuminated index",
      fr: "L'index enluminé",
      ar: "الفهرس المزخرف",
    },
    body: {
      en: "All 114 chapters, each card showing its name, meaning, and revelation place. Picking a surah carries you to the verses.",
      fr: "Les 114 sourates, chaque carte affichant son nom, son sens et son lieu de révélation. Choisir une sourate vous mène aux versets.",
      ar: "جميع السور الـ114، كل بطاقة تعرض الاسم والمعنى ومكان النزول. اختيار سورة ينقلك إلى الآيات.",
    },
  },
  /* ── Step 2 · Verses ───────────────────────────────────────── */
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
      en: "Grab the first 3, 5, 10, or 20 verses with one preset — or take the whole surah. Tap Clear to start over.",
      fr: "Prenez les 3, 5, 10 ou 20 premiers versets d'un geste — ou la sourate entière. Touchez Effacer pour recommencer.",
      ar: "اختر أول ٣ أو ٥ أو ١٠ أو ٢٠ آية بضغطة واحدة — أو السورة كاملة. اضغط إلغاء للبدء من جديد.",
    },
  },
  {
    step: 2,
    key: "verses-chip",
    selector: '[data-tour="verses-chip"]',
    icon: <TimerIcon className="h-3.5 w-3.5" />,
    title: {
      en: "Your exact length",
      fr: "Votre durée exacte",
      ar: "مدتك الدقيقة",
    },
    body: {
      en: "This chip counts your selection and, once a reciter is chosen, shows the real video length — measured from the actual audio, not an estimate.",
      fr: "Cette pastille compte votre sélection et, une fois le récitant choisi, affiche la durée réelle — mesurée sur l'audio véritable.",
      ar: "تحسب هذه الشارة اختيارك، وبعد اختيار القارئ تعرض مدة الفيديو الحقيقية — مأخوذة من الصوت الفعلي.",
    },
  },
  {
    step: 2,
    key: "verses-list",
    selector: '[data-tour="verses-list"]',
    icon: <TypeIcon className="h-3.5 w-3.5" />,
    title: {
      en: "Pick ayah by ayah",
      fr: "Choisissez ayah par ayah",
      ar: "اختر آية بآية",
    },
    body: {
      en: "Or select verses one by one from the full text — hover any line to hear it recited before you decide.",
      fr: "Ou sélectionnez les versets un à un dans le texte intégral — survolez une ligne pour l'écouter avant de choisir.",
      ar: "أو اختر الآيات واحدة واحدة من النص الكامل — مرّر فوق أي سطر لتسمعها قبل أن تقرر.",
    },
  },
  /* ── Step 3 · Settings ─────────────────────────────────────── */
  {
    step: 3,
    key: "platform-cards",
    selector: '[data-tour="platform-cards"]',
    icon: <FilmIcon className="h-3.5 w-3.5" />,
    title: {
      en: "Pick a platform",
      fr: "Choisissez une plateforme",
      ar: "اختر المنصة",
    },
    body: {
      en: "Each card sets the exact export size — 1080×1920 for TikTok and Reels, 1920×1080 for YouTube, and more. This unlocks the rest of the studio.",
      fr: "Chaque carte fixe la taille exacte — 1080×1920 pour TikTok et Reels, 1920×1080 pour YouTube… Cela déverrouille la suite du studio.",
      ar: "كل بطاقة تحدد حجم التصدير بدقة — 1080×1920 لتيك توك وريلز، و1920×1080 ليوتيوب وغيرها. اختيارك يفتح بقية الاستوديو.",
    },
  },
  {
    step: 3,
    key: "reciter-panel",
    selector: '[data-tour="reciter-panel"]',
    icon: <MicIcon className="h-3.5 w-3.5" />,
    title: {
      en: "Choose a reciter",
      fr: "Choisissez un récitant",
      ar: "اختر القارئ",
    },
    body: {
      en: "Eight master reciters. Tap the play button to hear a sample before you commit — the same voice your video will carry.",
      fr: "Huit maîtres récitateurs. Écoutez un extrait avant de choisir — la même voix que portera votre vidéo.",
      ar: "ثمانية من قرّاء القرآن الكريم. اضغط زر التشغيل لتسمع مقطعاً قبل أن تختار — الصوت نفسه الذي سيحمله فيديوك.",
    },
  },
  {
    step: 3,
    key: "customise-panel",
    selector: '[data-tour="customise-panel"]',
    icon: <PaletteIcon className="h-3.5 w-3.5" />,
    title: {
      en: "Make it yours",
      fr: "Personnalisez",
      ar: "اجعله لك",
    },
    body: {
      en: "Three tabs: Video — background from your own clip or the cinematic Library; Text — Arabic fonts, sizes, and colors; Effects — frames, verse transitions, and glows.",
      fr: "Trois onglets : Vidéo — fond perso ou Bibliothèque cinématique ; Texte — polices, tailles et couleurs ; Effets — cadres, transitions et lueurs.",
      ar: "ثلاثة أقسام: الفيديو — خلفية من مقطعك أو من المكتبة السينمائية؛ النص — الخطوط والأحجام والألوان؛ التأثيرات — الأطر والانتقالات والتوهجات.",
    },
  },
  {
    step: 3,
    key: "side-preview",
    selector: '[data-tour="side-preview"]',
    icon: <Shamsa className="h-3.5 w-3.5" />,
    title: {
      en: "Live preview",
      fr: "Aperçu en direct",
      ar: "معاينة حيّة",
    },
    body: {
      en: "Everything you change appears here instantly — pixel-accurate to the final video. What you see is exactly what you'll share.",
      fr: "Chaque changement apparaît ici instantanément — fidèle au pixel près. Ce que vous voyez est ce que vous partagerez.",
      ar: "كل ما تغيّره يظهر هنا فوراً — بدقة البكسل مع الفيديو النهائي. ما تراه هو ما ستشاركه تماماً.",
    },
  },
  /* ── Step 4 · Generate ─────────────────────────────────────── */
  {
    step: 4,
    key: "generate-preview",
    selector: '[data-tour="generate-preview"]',
    icon: <Shamsa className="h-3.5 w-3.5" />,
    title: {
      en: "Final check",
      fr: "Dernière vérification",
      ar: "المراجعة الأخيرة",
    },
    body: {
      en: "Step through every selected verse with the arrows under the preview — make sure each frame is exactly right.",
      fr: "Parcourez chaque verset choisi avec les flèches sous l'aperçu — vérifiez chaque image.",
      ar: "تنقّل بين الآيات المختارة بالأسهم تحت المعاينة — وتأكد أن كل مشهد على ما يرام.",
    },
  },
  {
    step: 4,
    key: "generate-summary",
    selector: '[data-tour="generate-summary"]',
    icon: <FilmIcon className="h-3.5 w-3.5" />,
    title: {
      en: "Your recipe",
      fr: "Votre recette",
      ar: "وصفتك",
    },
    body: {
      en: "Everything in one glance: surah, verses, reciter, platform, resolution, and duration. Shortcuts: ← → to flip verses, Space to generate.",
      fr: "Tout d'un coup d'œil : sourate, versets, récitant, plateforme, résolution, durée. Raccourcis : ← → pour les versets, Espace pour générer.",
      ar: "كل شيء في لمحة: السورة، الآيات، القارئ، المنصة، الدقة، والمدة. اختصارات: ← → للتنقل بين الآيات، ومسافة للإنتاج.",
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
      en: "When it feels right, generate — the video is encoded and saved as an MP4, ready to share. Sit back and watch the progress bloom.",
      fr: "Quand tout est prêt, générez — la vidéo est encodée et enregistrée en MP4, prête à partager.",
      ar: "عندما يكون كل شيء جاهزاً، أنشئ الفيديو — يُرمَّز ويُحفظ بصيغة MP4 جاهزة للمشاركة.",
    },
  },
];

const STEP_LABELS: L10n[] = [
  { en: "Surah", fr: "Sourate", ar: "السورة" },
  { en: "Verses", fr: "Versets", ar: "الآيات" },
  { en: "Settings", fr: "Réglages", ar: "الإعدادات" },
  { en: "Generate", fr: "Génération", ar: "الإنتاج" },
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
        className="tour-card-in panel-lit relative mx-auto w-full max-w-md overflow-hidden rounded-2xl bg-ink-soft/95 p-6 sm:p-8"
      >
        {/* soft golden halo behind the medallion */}
        <div
          className="pointer-events-none absolute -top-16 left-1/2 h-40 w-40 -translate-x-1/2 rounded-full bg-gold/[0.06] blur-2xl"
          aria-hidden="true"
        />

        <div className="relative mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-gold/30 bg-gold/10 text-gold lit-soft">
          <GardenMark className="h-6 w-6" />
        </div>

        <h3
          id="tour-welcome-title"
          className="relative text-center font-display text-2xl font-medium text-parchment"
        >
          {L({
            en: "Welcome to the Studio",
            fr: "Bienvenue au Studio",
            ar: "أهلاً بك في الاستوديو",
          })}
        </h3>
        <p className="relative mx-auto mt-2 max-w-xs text-center text-sm leading-relaxed text-parchment-muted">
          {L({
            en: "Turn any passage of the Qur'an into a beautiful, shareable video — in four gentle steps.",
            fr: "Transformez n'importe quel passage du Coran en une belle vidéo partageable — en quatre étapes.",
            ar: "حوّل أي مقطع من القرآن إلى فيديو جميل قابل للمشاركة — في أربع خطوات هادئة.",
          })}
        </p>

        <div className="relative my-6 space-y-2" role="list">
          {WELCOME_STEPS.map((s, i) => (
            <div key={s.step} role="listitem" className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-gold/35 bg-gold/10 text-gold">
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

        <div className="relative flex flex-col gap-2.5">
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
          <p className="pt-1 text-center text-[13px] text-parchment-dim">
            {L({
              en: "The tour follows you through the studio — gold dots guide the way.",
              fr: "La visite vous accompagne dans le studio — des points dorés vous guident.",
              ar: "ترافقك الجولة عبر الاستوديو — نقاط ذهبية ترشد الطريق.",
            })}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Coach-mark — Phase B (non-modal, never blocks interaction)
   ───────────────────────────────────────────────────────────── */

type TipPlacement = { top: number; left: number; side: "above" | "below" };

function CoachMark({
  locale,
  stop,
  stopIndex,
  stepStops,
  onDismiss,
  onEnd,
}: {
  locale: string;
  stop: StopDef;
  stopIndex: number;
  stepStops: StopDef[];
  onDismiss: () => void;
  onEnd: () => void;
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
      ? rect.top - tipRect.height - 12
      : rect.bottom + 12;

    const rawLeft = rect.left + rect.width / 2 - tipRect.width / 2;
    const left = Math.min(Math.max(rawLeft, 12), vw - tipRect.width - 12);
    setPlacement({ top, left, side: above ? "above" : "below" });
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

  /* Highlight ring + presence watch. Anchors may mount a beat after
     the coach-mark during wizard step transitions (AnimatePresence),
     so: retry attaching the ring briefly, and only self-dismiss after
     a short grace period plus several consecutive misses — never on a
     transient gap, and give conditional anchors (e.g. the selection
     chip) a moment to appear while the user reads. */
  useEffect(() => {
    const startedAt = Date.now();
    let misses = 0;
    const poll = window.setInterval(() => {
      const target = document.querySelector(stop.selector);
      if (!(target instanceof HTMLElement)) {
        misses += 1;
        const graceOver = Date.now() - startedAt > 2600;
        if (graceOver && misses >= 4) onDismiss();
        return;
      }
      misses = 0;
      if (!target.classList.contains("tour-target")) {
        target.classList.add("tour-target");
        if (!target.dataset.tourZ) target.dataset.tourZ = "1";
        target.style.zIndex = "1";
      }
    }, 350);
    return () => {
      window.clearInterval(poll);
      const target = document.querySelector(stop.selector);
      if (target instanceof HTMLElement) {
        target.classList.remove("tour-target");
        const prevZ = target.dataset.tourZ;
        if (prevZ !== undefined) {
          target.style.zIndex = prevZ === "" ? "" : prevZ;
          delete target.dataset.tourZ;
        }
      }
    };
  }, [stop.selector, onDismiss]);

  const stepName = L(STEP_LABELS[stop.step - 1]);
  const isLastOfStep =
    stepStops.length === 0 ||
    stepStops[stepStops.length - 1].key === stop.key;

  return (
    <div
      ref={tipRef}
      role="status"
      dir={ar ? "rtl" : "ltr"}
      className={
        isMobile
          ? "tour-sheet-in fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom,0px)+14px)] z-[70] rounded-2xl border border-gold/40 bg-ink-soft/95 p-4 shadow-lit backdrop-blur-md"
          : `tour-tip-in fixed z-[70] w-80 rounded-2xl border border-gold/40 bg-ink-soft/95 p-4 shadow-lit backdrop-blur-md${
              placement ? "" : " pointer-events-none opacity-0"
            }`
      }
      style={
        !isMobile && placement
          ? { top: `${placement.top}px`, left: `${placement.left}px` }
          : undefined
      }
    >
      {/* Desktop diamond arrow pointing at the anchor */}
      {!isMobile && placement && (
        <span
          className="absolute h-3 w-3 rotate-45 rounded-[2px] border border-gold/40 bg-ink-soft"
          style={
            placement.side === "below"
              ? { top: -7, borderBottom: "none", borderRight: "none", left: "calc(50% - 6px)" }
              : { bottom: -7, borderTop: "none", borderLeft: "none", left: "calc(50% - 6px)" }
          }
          aria-hidden="true"
        />
      )}

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
      </div>

      {/* Footer: progress dots + Next / skip */}
      <div className="mt-3.5 flex items-center justify-between gap-3 border-t border-gold/10 pt-3">
        <div className="flex min-w-0 items-center gap-2">
          {/* dots for this step's stops; gold = current, dim = ahead */}
          <span className="flex shrink-0 items-center gap-1.5" aria-hidden="true">
            {stepStops.map((s) => {
              const i = STOPS.findIndex((x) => x.key === s.key);
              return (
                <span
                  key={s.key}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    s.key === stop.key
                      ? "w-4 bg-gold"
                      : i < stopIndex
                        ? "w-1.5 bg-gold/45"
                        : "w-1.5 bg-parchment/15"
                  }`}
                />
              );
            })}
          </span>
          <span className="truncate text-[13px] text-parchment-dim">
            {stepName}
            {" · "}
            {L({
              en: `stop ${stopIndex + 1} of ${STOPS.length}`,
              fr: `étape ${stopIndex + 1} sur ${STOPS.length}`,
              ar: `محطة ${stopIndex + 1} من ${STOPS.length}`,
            })}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={onEnd}
            className="rounded-full px-2.5 py-1 text-[13px] text-parchment-dim transition-colors hover:text-gold focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
          >
            {L({ en: "Skip tour", fr: "Passer", ar: "تخطي" })}
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="btn-primary !px-4 !py-1.5 !text-[13px]"
          >
            {isLastOfStep
              ? L({ en: "Done", fr: "Terminé", ar: "تم" })
              : L({ en: "Next", fr: "Suivant", ar: "التالي" })}
          </button>
        </div>
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
     re-triggers the picker. Mirrored to storage immediately. */
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

  /* Next walks the CURRENT step's stops in order; when this step's
     stops are exhausted it parks on nothing (the next wizard step's
     arrival will auto-show its own first stop). Users can always
     jump ahead through the wizard itself. */
  const advance = useCallback(() => {
    if (!maskRef.current) maskRef.current = new Set();
    const mask = maskRef.current;
    const currentStep = step as StepId;
    const idx = activeKey ? STOPS.findIndex((s) => s.key === activeKey) : -1;
    const current = idx >= 0 ? STOPS[idx] : null;

    let next: StopDef | undefined;
    if (current && current.step === currentStep) {
      /* Next stop within this step */
      next = STOPS.slice(idx + 1).find((s) => s.step === currentStep);
    } else if (current) {
      /* Current stop belongs to another step (wizard moved on):
         continue from this step's first unshown stop, else first
         unshown stop of the wizard's current step. */
      next =
        STOPS.find((s) => s.step === currentStep && !mask.has(s.key)) ??
        STOPS.find((s) => !mask.has(s.key));
    } else {
      next = STOPS.find((s) => s.step === currentStep && !mask.has(s.key));
    }
    if (next) {
      mask.add(next.key);
      if (!replayRef.current) writeTipMask(mask);
    }
    setActiveKey(next?.key ?? null);
  }, [activeKey, step]);

  /* Show the first unshown stop for the current step on arrival. */
  const arrive = useCallback(() => {
    if (!maskRef.current) maskRef.current = new Set();
    const mask = maskRef.current;
    const next = STOPS.find((s) => s.step === step && !mask.has(s.key));
    if (next) {
      mask.add(next.key);
      if (!replayRef.current) writeTipMask(mask);
    }
    setActiveKey(next?.key ?? null);
  }, [step]);

  /* First arrival at each wizard step shows that step's first
     unshown stop. pickedForRef guards double-picks (StrictMode). */
  useEffect(() => {
    if (phase !== "tips") {
      setActiveKey(null);
      pickedForRef.current = null;
      return;
    }
    if (pickedForRef.current === step) return;
    pickedForRef.current = step;
    arrive();
  }, [phase, step, arrive]);

  const dismiss = useCallback(() => {
    advance();
  }, [advance]);

  const endTour = useCallback(() => {
    /* Mark everything shown so it never auto-pops again. */
    if (maskRef.current) {
      for (const s of STOPS) maskRef.current.add(s.key);
      if (!replayRef.current) writeTipMask(maskRef.current);
    }
    setActiveKey(null);
    if (replayRef.current) {
      replayRef.current = false;
      setReplaying(false);
      maskRef.current = readTipMask();
      pickedForRef.current = null;
    }
    setPhase("idle");
  }, []);

  const handleReplay = useCallback(() => {
    replayRef.current = true;
    setReplaying(true);
    maskRef.current = new Set();
    setActiveKey(null);
    pickedForRef.current = null;
    setPhase("welcome");
  }, []);

  const finishFirstVisit = useCallback((startTour: boolean) => {
    writeFlag(STORAGE_DONE, true);
    setPhase(startTour ? "tips" : "idle");
  }, []);

  const visibleStop =
    activeKey !== null
      ? (STOPS.find((s) => s.key === activeKey) ?? null)
      : null;
  const stopIndex = visibleStop
    ? STOPS.findIndex((s) => s.key === visibleStop.key)
    : -1;
  const stepStops = useMemo(
    () => (visibleStop ? STOPS.filter((s) => s.step === visibleStop.step) : []),
    [visibleStop],
  );
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
              endTour();
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
          stopIndex={stopIndex}
          stepStops={stepStops}
          onDismiss={dismiss}
          onEnd={endTour}
        />
      )}
    </>
  );
}
