"use client";
/**
 * studio-backdrop.tsx — "The Atelier" backdrop for the VideoBuilder.
 *
 * The old full-bleed star pattern competed with the dense picker UI.
 * The atelier recedes instead: a calm gradient center for focus,
 * ornament pushed to the far edges (desktop only), one barely-there
 * rotating studio seal, and a softer lamp. Living layers: boosted
 * cursor-drifting motes + falling petals in a viewport-fixed wrapper
 * (so they stay in view on tall picker pages), blooms climbing the
 * edge bands, hover-to-open buds in the corners, and — on the Surah
 * step only — a rose at the right edge that blooms and grows as you
 * scroll down, closes and shrinks as you scroll up.
 */

import { useEffect, useRef } from "react";
import { m, AnimatePresence } from "motion/react";
import { EASE_OUT } from "@/components/MotionProvider";
import { PatternBackdrop } from "@/components/PatternBackdrop";
import { BloomShape, Leaf } from "@/components/Ornament/ornaments";
import {
  Motes,
  FallingPetals,
  BloomScatter,
} from "@/components/Home/atmosphere";

function StudioSeal() {
  return (
    <svg
      viewBox="-60 -60 120 120"
      className="seal-spin h-full w-full"
      aria-hidden="true"
    >
      <circle
        r="56"
        fill="none"
        stroke="rgb(var(--gold) / 0.9)"
        strokeWidth="0.6"
        strokeDasharray="2.2 3.4"
      />
      <circle
        r="47"
        fill="none"
        stroke="rgb(var(--gold) / 0.7)"
        strokeWidth="0.5"
      />
      {Array.from({ length: 24 }).map((_, i) => (
        <line
          key={i}
          x1="0"
          y1="-51.5"
          x2="0"
          y2="-48.5"
          stroke="rgb(var(--gold) / 0.8)"
          strokeWidth="0.6"
          transform={`rotate(${(360 / 24) * i})`}
        />
      ))}
      <g transform="scale(2.6)">
        <BloomShape petals={12} />
      </g>
    </svg>
  );
}

/* A closed bud that opens on hover — pure CSS transitions, zero JS
   beyond the one-time scroll-into-view pop. pointer-events-auto only
   on the bud itself; everything around it stays click-through. */
function HoverBloom({
  className,
  hue = "gold",
  size = 34,
  delay = 0,
}: {
  className?: string;
  hue?: "gold" | "rose" | "green";
  size?: number;
  delay?: number;
}) {
  return (
    <m.div
      className={`group pointer-events-auto cursor-default ${className ?? ""}`}
      style={{ width: size, height: size }}
      initial={{ opacity: 0, scale: 0.4 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.8, ease: EASE_OUT, delay }}
    >
      <svg viewBox="-16 -16 32 32" className="h-full w-full overflow-visible">
        <g
          className="transition-all duration-700 ease-out group-hover:scale-50 group-hover:opacity-0"
          style={{ transformBox: "fill-box", transformOrigin: "center" }}
        >
          <BloomShape petals={8} hue={hue} open={false} />
        </g>
        <g
          className="scale-[0.35] opacity-0 transition-all duration-700 ease-out group-hover:rotate-[22deg] group-hover:scale-100 group-hover:opacity-100"
          style={{ transformBox: "fill-box", transformOrigin: "center" }}
        >
          <BloomShape petals={8} hue={hue} open />
        </g>
      </svg>
    </m.div>
  );
}

/* The scroll-driven rose: scale/rotate on the wrapper + one CSS var
   (--bloom-open) crossfading bud → full bloom, all mapped to page
   scroll progress. Hand-rolled rAF + lerp (same philosophy as
   useParallax — no motion useScroll, so domMax stays off the
   bundle). Transform/opacity only, passive listeners, settles and
   stops rAF when idle. Reduced motion: static half-bloom. */
function ScrollBloom() {
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.style.setProperty("--bloom-open", "0.6");
      el.style.transform = "scale(0.85) rotate(3deg)";
      return;
    }

    let raf = 0;
    let target = 0;
    let cur = -1;

    const apply = (p: number) => {
      const scale = 0.35 + p * 0.8;
      const rot = -14 + p * 28;
      el.style.transform = `scale(${scale.toFixed(4)}) rotate(${rot.toFixed(2)}deg)`;
      el.style.setProperty("--bloom-open", p.toFixed(3));
    };
    const tick = () => {
      const d = target - cur;
      cur += d * 0.09;
      if (Math.abs(d) < 0.002) {
        cur = target;
        apply(cur);
        raf = 0;
        return;
      }
      apply(cur);
      raf = requestAnimationFrame(tick);
    };
    const wake = () => {
      if (!raf) raf = requestAnimationFrame(tick);
    };
    const read = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      target = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      if (cur < 0) {
        cur = target;
        apply(cur);
        return;
      }
      wake();
    };

    window.addEventListener("scroll", read, { passive: true });
    window.addEventListener("resize", read, { passive: true });
    read();

    return () => {
      window.removeEventListener("scroll", read);
      window.removeEventListener("resize", read);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed right-[-56px] top-[20%] hidden h-72 w-72 lg:block xl:right-[-36px]"
    >
      <div
        ref={wrapRef}
        className="relative h-full w-full will-change-transform"
        style={{ transform: "scale(0.35) rotate(-14deg)" }}
      >
        <div className="scroll-bloom-glow absolute -inset-[30%] rounded-full bg-[radial-gradient(closest-side,rgb(var(--gold)/0.32),rgb(var(--ember)/0.12)_55%,transparent)] blur-2xl" />
        <svg
          viewBox="-20 -20 40 40"
          className="relative h-full w-full overflow-visible opacity-80"
        >
          <circle
            className="scroll-bloom-open"
            r="17.5"
            fill="none"
            stroke="rgb(var(--gold) / 0.4)"
            strokeWidth="0.5"
            strokeDasharray="1.8 3"
          />
          <g opacity="0.6">
            <Leaf transform="translate(-7 13) rotate(-125) scale(0.8)" />
            <Leaf transform="translate(7 13) rotate(-55) scale(-0.8 0.8)" />
          </g>
          <g className="scroll-bloom-bud">
            <BloomShape petals={8} hue="rose" open={false} />
          </g>
          <g className="scroll-bloom-open">
            <BloomShape petals={12} hue="rose" open />
          </g>
        </svg>
      </div>
    </div>
  );
}

const EDGE_BLOOMS_LEFT = [
  { x: "24%", y: "10%", size: 22, hue: "gold", petals: 8, delay: 0.1 },
  { x: "58%", y: "26%", size: 15, hue: "green", petals: 6, open: false, delay: 0.3 },
  { x: "30%", y: "44%", size: 19, hue: "rose", petals: 6, delay: 0.5 },
  { x: "56%", y: "62%", size: 24, hue: "gold", petals: 8, delay: 0.7 },
  { x: "26%", y: "79%", size: 16, hue: "rose", petals: 6, open: false, delay: 0.9 },
  { x: "52%", y: "93%", size: 20, hue: "gold", petals: 8, delay: 1.1 },
] as const;

const EDGE_BLOOMS_RIGHT = [
  { x: "56%", y: "6%", size: 18, hue: "rose", petals: 6, delay: 0.2 },
  { x: "24%", y: "20%", size: 24, hue: "gold", petals: 8, delay: 0.4 },
  { x: "54%", y: "38%", size: 15, hue: "green", petals: 6, open: false, delay: 0.6 },
  { x: "28%", y: "56%", size: 20, hue: "rose", petals: 8, delay: 0.8 },
  { x: "58%", y: "73%", size: 17, hue: "gold", petals: 6, open: false, delay: 1 },
  { x: "30%", y: "90%", size: 23, hue: "gold", petals: 8, delay: 1.2 },
] as const;

export function StudioBackdrop({ step }: { step: number }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Calm depth gradient — the reading area stays quiet */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 90% 60% at 50% -8%, rgb(var(--ink-soft) / 0.9), transparent 62%), radial-gradient(ellipse 70% 45% at 50% 108%, rgb(var(--ink-soft) / 0.55), transparent 65%)",
        }}
      />

      {/* Ornament lives at the far edges only (desktop) */}
      <div className="absolute inset-y-0 left-0 hidden w-44 lg:block">
        <PatternBackdrop
          family="girih"
          paletteId="night-gold"
          seed={31}
          density={1}
          scale={0.9}
          fillMode="outline"
          opacity={0.11}
          className="[mask-image:linear-gradient(to_right,black,transparent)]"
        />
      </div>
      <div className="absolute inset-y-0 right-0 hidden w-44 lg:block">
        <PatternBackdrop
          family="girih"
          paletteId="night-gold"
          seed={31}
          density={1}
          scale={0.9}
          fillMode="outline"
          opacity={0.11}
          className="[mask-image:linear-gradient(to_left,black,transparent)]"
        />
      </div>

      {/* Blooms climbing the edge bands, popping as they scroll in */}
      <BloomScatter
        className="inset-y-0 left-0 hidden w-44 lg:block"
        blooms={[...EDGE_BLOOMS_LEFT]}
      />
      <BloomScatter
        className="inset-y-0 right-0 hidden w-44 lg:block"
        blooms={[...EDGE_BLOOMS_RIGHT]}
      />

      {/* The studio seal — one slow revolution, barely there */}
      <div className="absolute -bottom-40 -right-40 h-[480px] w-[480px] opacity-[0.05] sm:h-[560px] sm:w-[560px]">
        <StudioSeal />
      </div>

      {/* A calmer lamp over the workspace */}
      <div
        className="garden-light left-1/2 top-[-200px] h-[380px] w-[640px] -translate-x-1/2 animate-garden-breathe opacity-70"
        aria-hidden="true"
      />

      {/* Viewport-fixed living layers — they stay in view on tall
          picker pages instead of scattering across the full scroll
          height. Motes: brighter + cursor-drifting. Petals: drifting
          down through the workspace. */}
      <div className="pointer-events-none fixed inset-0">
        <FallingPetals count={8} dim={0.85} />
      </div>
      <div className="pointer-events-none fixed inset-0">
        <Motes count={16} dim={1} boost interactive />
      </div>

      {/* Buds that open on hover (desktop corners) */}
      <div className="pointer-events-none fixed inset-0 hidden lg:block">
        <HoverBloom className="absolute bottom-8 left-16" hue="gold" size={38} />
        <HoverBloom
          className="absolute bottom-24 left-20"
          hue="rose"
          size={26}
          delay={0.2}
        />
        <HoverBloom
          className="absolute bottom-10 right-10"
          hue="rose"
          size={32}
          delay={0.35}
        />
      </div>

      {/* The scroll-blooming rose — Surah step only */}
      <AnimatePresence>
        {step === 1 && (
          <m.div
            key="scroll-bloom"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: EASE_OUT }}
          >
            <ScrollBloom />
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
