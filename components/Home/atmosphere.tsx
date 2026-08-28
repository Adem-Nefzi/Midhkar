"use client";
/**
 * atmosphere.tsx — per-section ambient layers for the homepage.
 * Each section gets ONE distinct treatment (never repeated):
 *   Hero      → star-rosette pattern (existing) + fade-out mask
 *   How       → drifting pollen motes + girih band
 *   Features  → giant calligraphic watermark
 *   Quran     → mihrab arch glow + arch pattern edges
 *   Footer    → illuminated border strip
 * All layers are decorative (aria-hidden), cheap (CSS transforms /
 * static canvas), and gated by prefers-reduced-motion.
 */

import { useEffect, useRef } from "react";
import type { CSSProperties, ReactNode } from "react";
import { m } from "motion/react";
import { EASE_OUT } from "@/components/MotionProvider";
import { PatternBackdrop } from "@/components/PatternBackdrop";
import { Bloom } from "@/components/Ornament/ornaments";

const frac = (n: number) => {
  const x = Math.sin(n * 127.1) * 43758.5453;
  return x - Math.floor(x);
};

/* ── Parallax ────────────────────────────────────────────────────
   Hand-rolled instead of motion's useScroll: the app boots with
   LazyMotion `domAnimation`, and useScroll would force `domMax`
   onto the landing bundle. Transform-only, rAF-batched with lerp
   smoothing (spring-settled, never steppy), IntersectionObserver-
   gated (zero work offscreen), optional depth scale/rotate and
   pointer drift — and never touches React state. Decorative layers
   only — never body text. */

export interface ParallaxExtra {
  scale?: number; // extra scale added at viewport center (e.g. 0.06)
  rotate?: number; // max rotation in deg across the full travel
  pointerDrift?: number; // max px the layer drifts toward the pointer
}

const LERP = 0.085;

export function useParallax(px: number, extra: ParallaxExtra = {}) {
  const ref = useRef<HTMLDivElement>(null);
  const { scale = 0, rotate = 0, pointerDrift = 0 } = extra;

  useEffect(() => {
    const el = ref.current;
    if (!el || (px === 0 && !pointerDrift && !scale && !rotate)) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const finePointer = window.matchMedia("(pointer: fine)").matches;

    let raf = 0;
    let near = false;
    let targetY = 0;
    let targetX = 0;
    let curY = 0;
    let curX = 0;
    let curS = 1;
    let curR = 0;

    const apply = () => {
      let t = `translate3d(${curX.toFixed(2)}px, ${curY.toFixed(2)}px, 0)`;
      if (scale) t += ` scale(${curS.toFixed(4)})`;
      if (rotate) t += ` rotate(${curR.toFixed(3)}deg)`;
      el.style.transform = t;
    };

    const tick = () => {
      const dY = targetY - curY;
      const dX = targetX - curX;
      const p = Math.max(-1, Math.min(1, targetY / (px || 1)));
      const tS = 1 + scale * (1 - Math.abs(p));
      const tR = p * rotate;
      const dS = tS - curS;
      const dR = tR - curR;
      curY += dY * LERP;
      curX += dX * LERP;
      curS += dS * LERP;
      curR += dR * LERP;
      const settled =
        Math.abs(dY) < 0.1 &&
        Math.abs(dX) < 0.1 &&
        Math.abs(dS) < 0.0005 &&
        Math.abs(dR) < 0.01;
      if (settled) {
        curY = targetY;
        curX = targetX;
        curS = tS;
        curR = tR;
        apply();
        raf = 0;
        return;
      }
      apply();
      raf = requestAnimationFrame(tick);
    };
    const wake = () => {
      if (!raf && near) raf = requestAnimationFrame(tick);
    };

    const readScroll = () => {
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      const center = r.top + r.height / 2 - vh / 2;
      const p = Math.max(-1, Math.min(1, center / vh));
      targetY = p * px;
    };
    const onScroll = () => {
      readScroll();
      wake();
    };
    const onPointer = (e: PointerEvent) => {
      if (!near) return;
      const vw = window.innerWidth || 1;
      const vh = window.innerHeight || 1;
      const nx = (e.clientX / vw - 0.5) * 2;
      const ny = (e.clientY / vh - 0.5) * 2;
      readScroll();
      targetX = nx * pointerDrift;
      targetY += ny * pointerDrift * 0.4;
      wake();
    };

    const io = new IntersectionObserver(
      (entries) => {
        near = entries[0].isIntersecting;
        if (near) {
          readScroll();
          wake();
        }
      },
      { rootMargin: "100% 0px 100% 0px" },
    );
    io.observe(el);

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    const usePointer = pointerDrift > 0 && finePointer;
    if (usePointer) {
      window.addEventListener("pointermove", onPointer, { passive: true });
    }
    readScroll();
    wake();

    return () => {
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (usePointer) {
        window.removeEventListener("pointermove", onPointer);
      }
      if (raf) cancelAnimationFrame(raf);
      el.style.transform = "";
    };
  }, [px, scale, rotate, pointerDrift]);

  return ref;
}

/**
 * Positioned, overflow-safe parallax wrapper. Give it the layer's
 * absolute positioning PLUS vertical bleed (e.g. `-inset-y-16`) so
 * the translate never exposes an edge. `px` = max displacement in
 * px at one viewport of distance; positive drifts slower than the
 * page (feels deeper), negative floats toward the viewer.
 * `scale` grows the layer as it crosses center, `rotate` tilts it
 * across the travel, `pointerDrift` steers it toward the cursor.
 */
export function Parallax({
  px,
  scale,
  rotate,
  pointerDrift,
  className = "",
  children,
}: {
  px: number;
  scale?: number;
  rotate?: number;
  pointerDrift?: number;
  className?: string;
  children: ReactNode;
}) {
  const ref = useParallax(px, { scale, rotate, pointerDrift });
  return (
    <div
      ref={ref}
      aria-hidden
      className={`pointer-events-none absolute will-change-transform ${className}`}
    >
      {children}
    </div>
  );
}

/* ── Drifting pollen motes (How section / Atelier) ─────────────
   `boost`  — bigger, brighter motes with a stronger glow.
   `interactive` — motes split into two depth groups that drift
   toward the pointer (lerped rAF, fine pointers only, gated by
   prefers-reduced-motion). Transform-only, zero React state. */

function MoteSpans({
  count,
  dim,
  boost,
  seedOffset = 0,
}: {
  count: number;
  dim: number;
  boost: boolean;
  seedOffset?: number;
}) {
  return (
    <>
      {Array.from({ length: count }).map((_, k) => {
        const i = k + seedOffset;
        const r1 = frac(i + 1);
        const r2 = frac(i + 2);
        const r3 = frac(i + 3);
        const r4 = frac(i + 4);
        const r5 = frac(i + 5);
        const size = boost ? 3 + r1 * 4.5 : 2 + r1 * 2.5;
        const gold = i % 3 !== 0;
        const glowAlpha = boost ? 0.65 : 0.35;
        const sway = ((r5 - 0.5) * (boost ? 26 : 16)).toFixed(1);
        return (
          <span
            key={k}
            className="mote"
            style={
              {
                left: `${(r2 * 96 + 2).toFixed(2)}%`,
                top: `${(r3 * 78 + 16).toFixed(2)}%`,
                width: size,
                height: size,
                background: gold
                  ? `rgb(var(--gold-soft) / ${boost ? 0.95 : 0.8})`
                  : `rgb(var(--verdant) / ${boost ? 0.85 : 0.7})`,
                boxShadow: `0 0 ${Math.round(size * (boost ? 5 : 3))}px 0 ${
                  gold
                    ? `rgb(var(--gold) / ${glowAlpha})`
                    : `rgb(var(--verdant) / ${glowAlpha - 0.05})`
                }`,
                "--mote-x": `${((r4 - 0.5) * 48).toFixed(1)}px`,
                "--mote-h": `${(70 + r5 * 90).toFixed(0)}px`,
                "--mote-sway": `${sway}px`,
                "--mote-o": ((boost ? 0.45 + r1 * 0.45 : 0.3 + r1 * 0.4) * dim).toFixed(2),
                animationDuration: `${(9 + r2 * 9).toFixed(1)}s`,
                animationDelay: `${(-r3 * 18).toFixed(1)}s`,
              } as CSSProperties
            }
          />
        );
      })}
    </>
  );
}

export function Motes({
  count = 10,
  dim = 1,
  boost = false,
  interactive = false,
  className = "",
}: {
  count?: number;
  dim?: number;
  boost?: boolean;
  interactive?: boolean;
  className?: string;
}) {
  const nearRef = useRef<HTMLDivElement>(null);
  const farRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!interactive) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!window.matchMedia("(pointer: fine)").matches) return;
    const nearEl = nearRef.current;
    const farEl = farRef.current;
    if (!nearEl || !farEl) return;

    let raf = 0;
    let tx = 0;
    let ty = 0;
    let cx = 0;
    let cy = 0;
    let idle = 0;

    const tick = () => {
      const dx = tx - cx;
      const dy = ty - cy;
      cx += dx * 0.06;
      cy += dy * 0.06;
      if (Math.abs(dx) < 0.05 && Math.abs(dy) < 0.05) {
        cx = tx;
        cy = ty;
        if (++idle > 40) {
          raf = 0;
          return;
        }
      } else {
        idle = 0;
      }
      nearEl.style.transform = `translate3d(${cx.toFixed(2)}px, ${cy.toFixed(2)}px, 0)`;
      farEl.style.transform = `translate3d(${(cx * -0.5).toFixed(2)}px, ${(cy * -0.5).toFixed(2)}px, 0)`;
      raf = requestAnimationFrame(tick);
    };
    const wake = () => {
      if (!raf) raf = requestAnimationFrame(tick);
    };
    const onMove = (e: PointerEvent) => {
      const vw = window.innerWidth || 1;
      const vh = window.innerHeight || 1;
      tx = (e.clientX / vw - 0.5) * 2 * 13;
      ty = (e.clientY / vh - 0.5) * 2 * 9;
      wake();
    };
    const onLeave = () => {
      tx = 0;
      ty = 0;
      wake();
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerleave", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerleave", onLeave);
      if (raf) cancelAnimationFrame(raf);
      nearEl.style.transform = "";
      farEl.style.transform = "";
    };
  }, [interactive]);

  const nearCount = Math.ceil(count / 2);
  const farCount = count - nearCount;

  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
    >
      {interactive ? (
        <>
          <div
            ref={farRef}
            className="absolute inset-0 will-change-transform"
          >
            <MoteSpans count={farCount} dim={dim * 0.75} boost={boost} seedOffset={0} />
          </div>
          <div
            ref={nearRef}
            className="absolute inset-0 will-change-transform"
          >
            <MoteSpans count={nearCount} dim={dim} boost={boost} seedOffset={farCount} />
          </div>
        </>
      ) : (
        <MoteSpans count={count} dim={dim} boost={boost} />
      )}
    </div>
  );
}

/* ── Blooming flowers on scroll ─────────────────────────────────
   A scatter of blooms that pop open (scale 0→1, staggered) the
   first time they scroll into view, then settle into a gentle
   CSS sway. Decorative, aria-hidden, reduced-motion safe
   (MotionConfig reducedMotion="user" + global CSS gate). */

export interface BloomSpec {
  x: string; // CSS left
  y: string; // CSS top
  size: number; // px
  hue?: "gold" | "rose" | "green";
  petals?: number;
  open?: boolean;
  delay?: number; // extra stagger on top of baseDelay
  opacity?: number; // resting opacity after bloom
}

export function BloomScatter({
  blooms,
  baseDelay = 0,
  className = "",
}: {
  blooms: BloomSpec[];
  baseDelay?: number;
  className?: string;
}) {
  return (
    <div aria-hidden className={`pointer-events-none absolute ${className}`}>
      {blooms.map((b, i) => (
        <m.div
          key={i}
          className="absolute"
          style={{
            left: b.x,
            top: b.y,
            width: b.size,
            height: b.size,
            opacity: b.opacity ?? 1,
          }}
          initial={{ scale: 0, rotate: -24 }}
          whileInView={{ scale: 1, rotate: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{
            duration: 0.9,
            ease: EASE_OUT,
            delay: baseDelay + (b.delay ?? i * 0.12),
          }}
        >
          <Bloom
            className="bloom-sway h-full w-full"
            petals={b.petals ?? 8}
            hue={b.hue ?? "gold"}
            open={b.open ?? true}
          />
        </m.div>
      ))}
    </div>
  );
}

/* ── Falling petals (hero / footer) ─────────────────────────────
   Petal-shaped spans drifting down with rotation + sway, Motes-
   style: deterministic pseudo-random placement, CSS-only, gated
   by the global prefers-reduced-motion block. */

export function FallingPetals({
  count = 8,
  dim = 1,
  className = "",
}: {
  count?: number;
  dim?: number;
  className?: string;
}) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
    >
      {Array.from({ length: count }).map((_, i) => {
        const r1 = frac(i + 11);
        const r2 = frac(i + 12);
        const r3 = frac(i + 13);
        const r4 = frac(i + 14);
        const r5 = frac(i + 15);
        const size = 7 + r1 * 7;
        const rose = i % 3 === 0;
        return (
          <span
            key={i}
            className="petal"
            style={
              {
                left: `${(r2 * 92 + 4).toFixed(2)}%`,
                width: size,
                height: size * 1.35,
                background: rose
                  ? "linear-gradient(135deg, rgb(var(--ember) / 0.55), rgb(var(--ember) / 0.18))"
                  : "linear-gradient(135deg, rgb(var(--gold-soft) / 0.5), rgb(var(--gold) / 0.14))",
                boxShadow: `0 0 ${Math.round(size)}px 0 rgb(var(--gold) / ${rose ? 0.12 : 0.18})`,
                "--petal-h": `${(260 + r3 * 340).toFixed(0)}px`,
                "--petal-x1": `${((r4 - 0.5) * 70).toFixed(1)}px`,
                "--petal-x2": `${((r5 - 0.5) * 110).toFixed(1)}px`,
                "--petal-r": `${(200 + r5 * 260).toFixed(0)}deg`,
                "--petal-o": ((0.35 + r1 * 0.4) * dim).toFixed(2),
                animationDuration: `${(11 + r2 * 10).toFixed(1)}s`,
                animationDelay: `${(-r3 * 21).toFixed(1)}s`,
              } as CSSProperties
            }
          />
        );
      })}
    </div>
  );
}

/* ── Giant calligraphic watermark (Features section) ─────────── */

export function CalligraphyWatermark({
  children,
  className = "",
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      aria-hidden
      dir="rtl"
      lang="ar"
      translate="no"
      className={`watermark-breathe pointer-events-none absolute select-none leading-none ${className}`}
      style={{ fontFamily: "'Amiri', serif", ...style }}
    >
      {children}
    </span>
  );
}

/* ── Gold thread divider with a slow shimmer sweep ───────────── */

export function ThreadDivider({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`thread-divider relative h-px overflow-hidden ${className}`}
    >
      <span className="thread-shimmer" />
    </div>
  );
}

/* ── Masked pattern bands (unique family per section) ────────── */

export function GirihBand() {
  return (
    <PatternBackdrop
      family="girih"
      paletteId="night-gold"
      seed={41}
      density={1}
      scale={1.15}
      fillMode="outline"
      opacity={0.14}
      className="[mask-image:linear-gradient(to_top,black,transparent_58%)]"
    />
  );
}

export function ArchEdges() {
  return (
    <PatternBackdrop
      family="arch"
      paletteId="night-gold"
      seed={23}
      density={1}
      scale={1.3}
      fillMode="outline"
      opacity={0.16}
      className="[mask-image:linear-gradient(to_right,black,transparent_34%,transparent_66%,black)]"
    />
  );
}

export function BorderStrip({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-x-0 top-0 h-14 overflow-hidden ${className}`}
      style={{
        maskImage: "linear-gradient(to bottom, black, transparent)",
        WebkitMaskImage: "linear-gradient(to bottom, black, transparent)",
      }}
    >
      <PatternBackdrop
        family="border"
        paletteId="night-gold"
        seed={7}
        density={2}
        scale={0.9}
        fillMode="outline"
        opacity={0.28}
      />
    </div>
  );
}

/* ── Mihrab arch glow (QuranPreview section) ─────────────────── */

export function MihrabGlow({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute ${className}`}
    >
      <div
        className="animate-garden-breathe h-full w-full rounded-t-full"
        style={{
          background:
            "radial-gradient(ellipse 62% 58% at 50% 42%, rgb(var(--gold) / 0.13), rgb(var(--gold) / 0.04) 55%, transparent 75%)",
          filter: "blur(18px)",
        }}
      />
    </div>
  );
}
