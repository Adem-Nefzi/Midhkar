"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  m,
  AnimatePresence,
  useMotionValue,
  useSpring,
  useReducedMotion,
} from "motion/react";
import { EASE_OUT } from "@/components/MotionProvider";
import { renderFullFrame } from "@/lib/canva-utils";
import { ensureFontsReady } from "@/lib/fonts-ready";
import { DEFAULT_SETTINGS } from "@/lib/types";
import type { Surah, Ayah } from "@/lib/quran";
import { fetchVerseByKey } from "@/lib/quran";
import { ArrowIcon, InstagramLogo } from "@/components/VideoBuilder/icons";
import {
  Bloom,
  GardenFrame,
  ScrollCorner,
} from "@/components/Ornament/ornaments";
import { PatternBackdrop } from "@/components/PatternBackdrop";
import { Parallax, useParallax, Motes, BloomScatter, FallingPetals } from "@/components/Home/atmosphere";

const DEMO_SURAH: Surah = {
  number: 54,
  name: "القمر",
  englishName: "Al-Qamar",
  englishNameTranslation: "The Moon",
  numberOfAyahs: 55,
  revelationType: "Meccan",
};

const DEMO_ARABIC =
  "وَلَقَدْ يَسَّرْنَا الْقُرْآنَ لِلذِّكْرِ فَهَلْ مِن مُّدَّكِرٍ";

/* The living showcase: four short, beloved ayahs rotate through the
   "What you'll share" frame. Arabic text + translations are fetched
   from the Quran Foundation API at runtime (byte-exact Uthmani);
   surah meta is static. If fetching fails, the frame gracefully
   stays on the first ayah. */
const SHOWCASE: { s: number; a: number; surah: Surah }[] = [
  { s: 54, a: 17, surah: DEMO_SURAH },
  {
    s: 13,
    a: 28,
    surah: {
      number: 13,
      name: "الرعد",
      englishName: "Ar-Ra'd",
      englishNameTranslation: "The Thunder",
      numberOfAyahs: 43,
      revelationType: "Medinan",
    },
  },
  {
    s: 2,
    a: 152,
    surah: {
      number: 2,
      name: "البقرة",
      englishName: "Al-Baqarah",
      englishNameTranslation: "The Cow",
      numberOfAyahs: 286,
      revelationType: "Medinan",
    },
  },
  {
    s: 55,
    a: 13,
    surah: {
      number: 55,
      name: "الرحمن",
      englishName: "Ar-Rahman",
      englishNameTranslation: "The Beneficent",
      numberOfAyahs: 78,
      revelationType: "Meccan",
    },
  },
];

const AR_DIGITS = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];
const toAr = (n: number) =>
  String(n)
    .split("")
    .map((d) => AR_DIGITS[+d] ?? d)
    .join("");

function Magnetic({
  children,
  strength = 0.3,
  className,
}: {
  children: ReactNode;
  strength?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 180, damping: 14, mass: 0.4 });
  const sy = useSpring(my, { stiffness: 180, damping: 14, mass: 0.4 });

  return (
    <m.div
      ref={ref}
      className={className}
      style={reduce ? undefined : { x: sx, y: sy }}
      onPointerMove={(e) => {
        if (reduce || !ref.current) return;
        const r = ref.current.getBoundingClientRect();
        mx.set((e.clientX - (r.left + r.width / 2)) * strength);
        my.set((e.clientY - (r.top + r.height / 2)) * strength);
      }}
      onPointerLeave={() => {
        mx.set(0);
        my.set(0);
      }}
    >
      {children}
    </m.div>
  );
}

function VerseReveal() {
  const words = DEMO_ARABIC.split(" ");
  return (
    <p
      dir="rtl"
      lang="ar"
      translate="no"
      className="mx-auto max-w-5xl font-ruqaa text-4xl leading-[1.85] text-gold-soft [text-shadow:0_0_44px_rgb(var(--gold)/0.3)] sm:text-5xl md:text-[4.4rem] lg:text-[5.4rem]"
    >
      {words.map((word, i) => (
        <span key={i} className="inline-block overflow-hidden pb-2 align-bottom">
          <m.span
            className="inline-block"
            initial={{ y: "112%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.85, ease: EASE_OUT, delay: 0.35 + i * 0.09 }}
          >
            {word}
            {i < words.length - 1 ? "\u00A0" : ""}
          </m.span>
        </span>
      ))}
    </p>
  );
}

/* ── The living preview ───────────────────────────────────────────
   Two offscreen canvases ping-pong: the incoming ayah is rendered
   to the back canvas, then a 650ms rAF crossfade (with a gentle
   upward drift) composites both onto the visible canvas. Memory
   stays bounded to two 1080×1920 frames. Cycling pauses while the
   hero is offscreen or the tab is hidden. */

const CYCLE_MS = 5000;
const FADE_MS = 650;

function HeroPreview({ locale }: { locale: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { t } = useI18n();
  const reduce = useReducedMotion();
  const [caption, setCaption] = useState({ s: 54, a: 17, surah: DEMO_SURAH });

  /* Pointer tilt — fine pointers only, ±3.5°, spring-settled. */
  const tiltX = useMotionValue(0);
  const tiltY = useMotionValue(0);
  const rotX = useSpring(tiltX, { stiffness: 140, damping: 16, mass: 0.5 });
  const rotY = useSpring(tiltY, { stiffness: 140, damping: 16, mass: 0.5 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = 1080;
    canvas.height = 1920;

    let disposed = false;
    const ctrl = new AbortController();
    let raf = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let visible = true;

    const pool = [0, 1].map(() => {
      const c = document.createElement("canvas");
      c.width = 1080;
      c.height = 1920;
      return c;
    });
    let front = 0;

    const translationLang = locale === "ar" ? "ar" : locale === "fr" ? "fr" : "en";

    const paint = (target: HTMLCanvasElement, ayah: Ayah, surah: Surah) => {
      const tctx = target.getContext("2d");
      if (!tctx) return;
      renderFullFrame(
        tctx,
        target,
        ayah,
        surah,
        {
          ...DEFAULT_SETTINGS,
          background: "color",
          bgColor: "#121728",
          bgColorSecondary: "#1d2b1f",
          bgGradientAngle: 160,
          textGlow: true,
          textShadow: true,
          frameStyle: "corners" as const,
          fontSize: "large" as const,
          overlayStyle: "none" as const,
          bgOverlay: 0,
          textAnimation: "none" as const,
          showTranslation: locale !== "ar" && !!ayah.translation,
          translationLang,
        },
        null,
        1,
      );
    };

    const fallbackAyah: Ayah = {
      number: 4817,
      numberInSurah: 17,
      text: DEMO_ARABIC,
      translation:
        locale === "ar" ? "" : ((t("hero.verse") as string) || ""),
      juz: 27,
      page: 530,
      sajda: false,
    };

    const blit = (src: HTMLCanvasElement) => {
      ctx.clearRect(0, 0, 1080, 1920);
      ctx.drawImage(src, 0, 0);
    };

    const advance = (items: { ayah: Ayah; surah: Surah; s: number; a: number }[], i: number) => {
      if (disposed) return;
      if (!visible || document.hidden) {
        timer = setTimeout(() => advance(items, i), CYCLE_MS);
        return;
      }
      const next = (i + 1) % items.length;
      const back = 1 - front;
      paint(pool[back], items[next].ayah, items[next].surah);
      setCaption({ s: items[next].s, a: items[next].a, surah: items[next].surah });

      if (reduce) {
        blit(pool[back]);
        front = back;
        timer = setTimeout(() => advance(items, next), CYCLE_MS);
        return;
      }

      const t0 = performance.now();
      const blend = (now: number) => {
        if (disposed) return;
        const k = Math.min(1, (now - t0) / FADE_MS);
        const e = 1 - Math.pow(1 - k, 3);
        ctx.clearRect(0, 0, 1080, 1920);
        ctx.globalAlpha = 1;
        ctx.drawImage(pool[front], 0, 0);
        ctx.globalAlpha = e;
        ctx.drawImage(pool[back], 0, Math.round(16 * (1 - e)));
        ctx.globalAlpha = 1;
        if (k < 1) {
          raf = requestAnimationFrame(blend);
        } else {
          front = back;
          timer = setTimeout(() => advance(items, next), CYCLE_MS);
        }
      };
      raf = requestAnimationFrame(blend);
    };

    ensureFontsReady(DEFAULT_SETTINGS).then(() => {
      if (disposed) return;
      paint(pool[0], fallbackAyah, DEMO_SURAH);
      blit(pool[0]);

      Promise.all(
        SHOWCASE.map(async ({ s, a, surah }) => {
          const v = await fetchVerseByKey(s, a, translationLang, ctrl.signal);
          if (!v || !v.text) return null;
          return {
            s,
            a,
            surah,
            ayah: {
              number: 0,
              numberInSurah: a,
              text: v.text,
              translation: v.translation || "",
              juz: 0,
              page: 0,
              sajda: false,
            } as Ayah,
          };
        }),
      ).then((results) => {
        if (disposed) return;
        const items = results.filter(
          (r): r is NonNullable<typeof r> => r !== null,
        );
        if (items.length < 2) return;
        const startIdx = items.findIndex((it) => it.s === 54 && it.a === 17);
        const from = startIdx >= 0 ? startIdx : 0;
        if (from !== 0) {
          paint(pool[0], items[from].ayah, items[from].surah);
          blit(pool[0]);
          setCaption({ s: items[from].s, a: items[from].a, surah: items[from].surah });
        }
        timer = setTimeout(() => advance(items, from), CYCLE_MS);
      });
    });

    const io = new IntersectionObserver(
      (entries) => {
        visible = entries[0].isIntersecting;
      },
      { threshold: 0.05 },
    );
    io.observe(canvas);

    return () => {
      disposed = true;
      ctrl.abort();
      if (timer) clearTimeout(timer);
      if (raf) cancelAnimationFrame(raf);
      io.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale, reduce]);

  const refLabel =
    locale === "ar"
      ? `سورة ${caption.surah.name} · ${toAr(caption.s)}:${toAr(caption.a)}`
      : `${locale === "fr" ? "Sourate" : "Surah"} ${caption.surah.englishName} · ${caption.s}:${caption.a}`;

  return (
    <div className="relative mx-auto w-fit">
      <m.div
        aria-hidden="true"
        className="garden-light left-1/2 top-1/2 h-[130%] w-[160%] -translate-x-1/2 -translate-y-1/2"
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.6, ease: EASE_OUT, delay: 0.5 }}
      >
        <div className="h-full w-full animate-garden-breathe rounded-full bg-[radial-gradient(closest-side,rgb(var(--gold)/0.14),transparent)] blur-2xl" />
      </m.div>

      {/* Fireflies drifting around the ayah frame */}
      <Motes count={7} dim={0.85} className="-inset-x-10 -inset-y-6" />

      {/* Blooms that open around the phone as it ignites */}
      <BloomScatter
        baseDelay={1.15}
        className="inset-0"
        blooms={[
          { x: "-26px", y: "12%", size: 30, hue: "gold", petals: 8, delay: 0 },
          { x: "-38px", y: "58%", size: 22, hue: "rose", petals: 6, delay: 0.18 },
          { x: "calc(100% + 8px)", y: "22%", size: 26, hue: "rose", petals: 8, delay: 0.1 },
          { x: "calc(100% + 18px)", y: "70%", size: 34, hue: "gold", petals: 8, delay: 0.28 },
          { x: "12%", y: "-24px", size: 20, hue: "green", petals: 6, open: false, delay: 0.36 },
          { x: "78%", y: "calc(100% + 2px)", size: 24, hue: "gold", petals: 6, open: false, delay: 0.44 },
        ]}
      />

      <GardenFrame delay={0.6} className="rounded-[2rem]">
        <m.div
          className="relative rounded-[2rem] border border-gold/30 bg-ink p-2 lit"
          style={{ rotateX: rotX, rotateY: rotY, transformPerspective: 1100 }}
          initial={{ opacity: 0, y: 46 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: EASE_OUT, delay: 0.35 }}
          onPointerMove={(e) => {
            if (reduce) return;
            if (!window.matchMedia("(pointer: fine)").matches) return;
            const r = e.currentTarget.getBoundingClientRect();
            const nx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
            const ny = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
            tiltY.set(nx * 3.5);
            tiltX.set(-ny * 3.5);
          }}
          onPointerLeave={() => {
            tiltX.set(0);
            tiltY.set(0);
          }}
        >
          <canvas
            ref={canvasRef}
            data-ayah={`${caption.s}:${caption.a}`}
            className="block h-[480px] w-[270px] rounded-[1.6rem] sm:h-[540px] sm:w-[304px]"
            aria-label="Preview of a generated Quran video"
          />
          <m.div
            className="absolute -bottom-5 left-1/2 flex items-center gap-2 rounded-full border border-gold/25 bg-ink-soft px-4 py-2 lit-soft"
            initial={{ opacity: 0, x: "-50%", y: 10 }}
            animate={{ opacity: 1, x: "-50%", y: 0 }}
            transition={{ duration: 0.6, ease: EASE_OUT, delay: 1.1 }}
          >
            <InstagramLogo className="h-3.5 w-3.5 text-gold/80" />
            <span className="whitespace-nowrap text-[13px] font-medium text-parchment-muted">
              {t("hero.previewLabel") as string}
            </span>
          </m.div>
        </m.div>
      </GardenFrame>

      <div className="mt-9 flex justify-center">
        <AnimatePresence mode="wait" initial={false}>
          <m.p
            key={`${caption.s}:${caption.a}`}
            className="text-[13px] text-parchment-muted"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.35, ease: EASE_OUT }}
          >
            {refLabel}
          </m.p>
        </AnimatePresence>
      </div>
    </div>
  );
}

export function Hero() {
  const { t, locale } = useI18n();
  const trust = t("hero.trust") as unknown as string[];
  const phoneRef = useParallax(-30);

  return (
    <section className="garden-ground relative overflow-hidden">
      <Parallax px={72} pointerDrift={10} className="inset-x-0 -inset-x-3 -inset-y-16">
        <PatternBackdrop
          family="star"
          paletteId="night-gold"
          seed={108}
          density={1}
          scale={1.6}
          fillMode="outline"
          opacity={0.35}
          className="[mask-image:linear-gradient(to_bottom,black_52%,transparent_98%)]"
        />
      </Parallax>
      <Parallax px={40} pointerDrift={14} scale={0.05} className="inset-0 -inset-y-10">
        <ScrollCorner className="pointer-events-none absolute -left-6 -top-6 h-32 w-32 opacity-90 sm:h-44 sm:w-44" />
        <ScrollCorner className="pointer-events-none absolute -right-6 -top-6 h-32 w-32 rotate-90 opacity-90 sm:h-44 sm:w-44" delay={0.2} />
        <ScrollCorner className="pointer-events-none absolute -bottom-6 -left-6 h-32 w-32 -rotate-90 opacity-70 sm:h-44 sm:w-44" delay={0.35} />
        <ScrollCorner className="pointer-events-none absolute -bottom-6 -right-6 h-32 w-32 rotate-180 opacity-70 sm:h-44 sm:w-44" delay={0.5} />
      </Parallax>

      {/* Petals drifting down through the night garden */}
      <FallingPetals count={10} dim={0.8} />

      <div className="relative z-10 mx-auto grid max-w-7xl items-center gap-16 px-6 py-20 lg:grid-cols-12 lg:gap-8 lg:py-28">
        <div className="lg:col-span-7">
          <div className="relative">
            <BloomScatter
              baseDelay={0.9}
              className="inset-0"
              blooms={[
                { x: "-14px", y: "68%", size: 26, hue: "gold", petals: 8, delay: 0 },
                { x: "calc(100% - 6px)", y: "8%", size: 22, hue: "rose", petals: 6, delay: 0.22 },
              ]}
            />
            <VerseReveal />
          </div>

          <m.h1
            className="mt-8 font-display text-3xl leading-[1.15] tracking-[0.01em] text-parchment sm:text-4xl"
            style={
              locale === "ar"
                ? { fontFamily: "var(--font-ruqaa), 'Aref Ruqaa', serif" }
                : undefined
            }
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: EASE_OUT, delay: 0.9 }}
            dangerouslySetInnerHTML={{ __html: t("hero.title") as string }}
          />

          <m.p
            className="mt-6 max-w-xl text-lg leading-relaxed text-parchment-muted"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE_OUT, delay: 1.0 }}
          >
            {t("hero.description") as string}
          </m.p>

          <m.div
            className="mt-10 flex flex-wrap items-center gap-4"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE_OUT, delay: 1.1 }}
          >
            <Magnetic strength={0.25}>
              <Link href="/create" className="btn-primary px-8 py-3.5 text-sm">
                <Bloom className="h-4 w-4" petals={8} hue="rose" />
                {t("hero.ctaPrimary") as string}
              </Link>
            </Magnetic>
            <a href="#how" className="btn-ghost group px-7 py-3.5 text-sm">
              {t("hero.ctaSecondary") as string}
              <ArrowIcon className="h-4 w-4 rotate-90 text-gold/70 transition-transform duration-300 group-hover:translate-y-0.5" />
            </a>
          </m.div>

          <m.ul
            className="mt-10 flex flex-wrap gap-x-8 gap-y-3"
            initial="hidden"
            animate="show"
            variants={{
              hidden: {},
              show: { transition: { staggerChildren: 0.12, delayChildren: 1.25 } },
            }}
          >
            {trust.map((item) => (
              <m.li
                key={item}
                className="group flex items-center gap-2.5 text-sm text-parchment-muted"
                variants={{
                  hidden: { opacity: 0, y: 10 },
                  show: {
                    opacity: 1,
                    y: 0,
                    transition: { duration: 0.5, ease: EASE_OUT },
                  },
                }}
              >
                <Bloom
                  className="h-3.5 w-3.5 shrink-0 transition-transform duration-500 ease-out group-hover:rotate-45 group-hover:scale-125"
                  petals={6}
                  open={false}
                />
                {item}
              </m.li>
            ))}
          </m.ul>
        </div>

        <div className="lg:col-span-5">
          <div ref={phoneRef} className="will-change-transform">
            <HeroPreview locale={locale} />
          </div>
        </div>
      </div>
    </section>
  );
}
