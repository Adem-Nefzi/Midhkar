"use client";

import { type CSSProperties, type ReactNode } from "react";
import { m, useReducedMotion } from "motion/react";
import { EASE_OUT } from "@/components/MotionProvider";

const frac = (n: number) => {
  const x = Math.sin(n * 127.1) * 43758.5453;
  return x - Math.floor(x);
};

const GOLD = "rgb(var(--gold) / 0.85)";
const GOLD_DIM = "rgb(var(--gold) / 0.45)";
const GREEN = "rgb(var(--verdant) / 0.9)";
const GREEN_DIM = "rgb(var(--verdant) / 0.5)";
const ROSE = "rgb(var(--ember) / 0.9)";

const LEAF = "M0 0 Q8 -14 22 -10 Q10 2 0 0 Z";

export function Leaf({
  transform,
  fill = GREEN_DIM,
  stroke = GREEN,
}: {
  transform?: string;
  fill?: string;
  stroke?: string;
}) {
  return (
    <path
      d={LEAF}
      transform={transform}
      fill={fill}
      stroke={stroke}
      strokeWidth="0.8"
      strokeLinejoin="round"
    />
  );
}

export function BloomShape({
  petals = 8,
  hue = "gold",
  open = true,
}: {
  petals?: number;
  hue?: "gold" | "rose" | "green";
  open?: boolean;
}) {
  const petal =
    hue === "rose" ? ROSE : hue === "green" ? GREEN : GOLD;
  const petalEdge =
    hue === "rose"
      ? "rgb(var(--ember) / 0.5)"
      : hue === "green"
        ? "rgb(var(--verdant) / 0.5)"
        : "rgb(var(--gold) / 0.5)";
  return open ? (
    <g>
      {Array.from({ length: petals }).map((_, i) => (
        <ellipse
          key={i}
          cx="0"
          cy="-8.5"
          rx="3.4"
          ry="7.5"
          transform={`rotate(${(360 / petals) * i})`}
          fill={petal}
          fillOpacity="0.28"
          stroke={petalEdge}
          strokeWidth="0.9"
        />
      ))}
      <circle r="3.6" fill={petal} fillOpacity="0.9" />
      <circle
        r="5.6"
        fill="none"
        stroke={petalEdge}
        strokeWidth="0.7"
        strokeDasharray="1.4 2.2"
      />
    </g>
  ) : (
    <g>
      <path
        d="M0 6 C-5.5 -1 -4.5 -9 0 -13 C4.5 -9 5.5 -1 0 6 Z"
        fill={petal}
        fillOpacity="0.3"
        stroke={petalEdge}
        strokeWidth="0.9"
      />
      <path
        d="M0 6 C-2.5 1 -3 -4 -1.5 -8 M0 6 C2.5 1 3 -4 1.5 -8"
        fill="none"
        stroke={petalEdge}
        strokeWidth="0.7"
      />
    </g>
  );
}

export function Bloom({
  className,
  petals = 8,
  hue = "gold",
  open = true,
}: {
  className?: string;
  petals?: number;
  hue?: "gold" | "rose" | "green";
  open?: boolean;
}) {
  return (
    <svg viewBox="-16 -16 32 32" className={className} aria-hidden="true">
      <BloomShape petals={petals} hue={hue} open={open} />
    </svg>
  );
}

export function ScrollCorner({
  className,
  delay = 0,
  animate = true,
  tone = "gold",
}: {
  className?: string;
  delay?: number;
  animate?: boolean;
  tone?: "gold" | "green";
}) {
  const reduce = useReducedMotion();
  const stem = tone === "green" ? GREEN_DIM : GOLD_DIM;
  const stemBright = tone === "green" ? GREEN : GOLD;
  const draw = animate && !reduce;

  const stemProps = draw
    ? {
        initial: { pathLength: 0, opacity: 0 },
        whileInView: { pathLength: 1, opacity: 1 },
        viewport: { once: true, amount: 0.3 },
        transition: { duration: 1.6, ease: EASE_OUT, delay },
      }
    : {};
  const sproutProps = (extra: number) =>
    draw
      ? {
          initial: { opacity: 0, scale: 0.4 },
          whileInView: { opacity: 1, scale: 1 },
          viewport: { once: true, amount: 0.3 },
          transition: {
            duration: 0.7,
            ease: EASE_OUT,
            delay: delay + 0.7 + extra,
          },
        }
      : {};

  return (
    <svg
      viewBox="0 0 140 140"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <m.path
        d="M10 140 C10 96 14 62 40 40 C62 14 96 10 140 10"
        stroke={stem}
        strokeWidth="1.6"
        strokeLinecap="round"
        {...stemProps}
      />
      <m.path
        d="M13 106 C34 102 48 90 53 68"
        stroke={stem}
        strokeWidth="1.2"
        strokeLinecap="round"
        {...stemProps}
      />
      <m.path
        d="M68 53 C90 48 102 34 106 13"
        stroke={stem}
        strokeWidth="1.2"
        strokeLinecap="round"
        {...stemProps}
      />
      <m.g {...sproutProps(0)} style={{ transformOrigin: "53px 68px" }}>
        <Leaf transform="translate(53 68) rotate(-105)" />
        <Leaf
          transform="translate(53 68) rotate(-160) scale(0.72)"
          fill="rgb(var(--verdant) / 0.32)"
        />
      </m.g>
      <m.g {...sproutProps(0.15)} style={{ transformOrigin: "106px 13px" }}>
        <Leaf transform="translate(106 13) rotate(-15)" />
        <Leaf
          transform="translate(106 13) rotate(-70) scale(0.72)"
          fill="rgb(var(--verdant) / 0.32)"
        />
      </m.g>
      <m.g {...sproutProps(0.3)} style={{ transformOrigin: "40px 40px" }}>
        <g transform="translate(40 40)">
          <BloomShape petals={8} />
        </g>
      </m.g>
      <m.circle
        cx="10"
        cy="140"
        r="2.2"
        fill={stemBright}
        {...(draw
          ? {
              initial: { opacity: 0 },
              whileInView: { opacity: 1 },
              viewport: { once: true },
              transition: { duration: 0.4, delay },
            }
          : {})}
      />
    </svg>
  );
}

export function StemDivider({
  className,
  delay = 0,
  animate = true,
}: {
  className?: string;
  delay?: number;
  animate?: boolean;
}) {
  const reduce = useReducedMotion();
  const draw = animate && !reduce;
  return (
    <svg
      viewBox="0 0 600 44"
      fill="none"
      preserveAspectRatio="none"
      className={className}
      aria-hidden="true"
    >
      <m.path
        d="M0 22 C90 14 170 30 260 22 L340 22 C430 14 510 30 600 22"
        stroke={GOLD_DIM}
        strokeWidth="1.4"
        strokeLinecap="round"
        {...(draw
          ? {
              initial: { pathLength: 0 },
              whileInView: { pathLength: 1 },
              viewport: { once: true, amount: 0.5 },
              transition: { duration: 1.8, ease: EASE_OUT, delay },
            }
          : {})}
      />
      {[
        { x: 120, r: -28, s: 0.9 },
        { x: 205, r: 152, s: 0.75 },
        { x: 395, r: -152, s: 0.75 },
        { x: 480, r: 28, s: 0.9 },
      ].map((l, i) => (
        <m.g
          key={i}
          {...(draw
            ? {
                initial: { opacity: 0, scale: 0.4 },
                whileInView: { opacity: 1, scale: 1 },
                viewport: { once: true, amount: 0.5 },
                transition: {
                  duration: 0.6,
                  ease: EASE_OUT,
                  delay: delay + 0.5 + i * 0.12,
                },
              }
            : {})}
          style={{ transformOrigin: `${l.x}px 22px` }}
        >
          <Leaf transform={`translate(${l.x} 22) rotate(${l.r}) scale(${l.s})`} />
        </m.g>
      ))}
      <m.g
        {...(draw
          ? {
              initial: { opacity: 0, scale: 0.3 },
              whileInView: { opacity: 1, scale: 1 },
              viewport: { once: true, amount: 0.5 },
              transition: { duration: 0.8, ease: EASE_OUT, delay: delay + 1 },
            }
          : {})}
        style={{ transformOrigin: "300px 22px" }}
      >
        <circle cx="300" cy="22" r="12" fill="rgb(var(--ink))" />
        <g transform="translate(300 22)">
          <BloomShape petals={8} hue="rose" />
        </g>
      </m.g>
    </svg>
  );
}

export function GardenFrame({
  children,
  className,
  corners = true,
  delay = 0,
  animate = true,
  tone = "gold",
}: {
  children: ReactNode;
  className?: string;
  corners?: boolean;
  delay?: number;
  animate?: boolean;
  tone?: "gold" | "green";
}) {
  return (
    <div className={`relative ${className ?? ""}`}>
      {corners && (
        <>
          <ScrollCorner
            className="pointer-events-none absolute -left-3 -top-3 h-20 w-20 sm:h-24 sm:w-24"
            delay={delay}
            animate={animate}
            tone={tone}
          />
          <ScrollCorner
            className="pointer-events-none absolute -right-3 -top-3 h-20 w-20 rotate-90 sm:h-24 sm:w-24"
            delay={delay + 0.12}
            animate={animate}
            tone={tone}
          />
          <ScrollCorner
            className="pointer-events-none absolute -bottom-3 -right-3 h-20 w-20 rotate-180 sm:h-24 sm:w-24"
            delay={delay + 0.24}
            animate={animate}
            tone={tone}
          />
          <ScrollCorner
            className="pointer-events-none absolute -bottom-3 -left-3 h-20 w-20 -rotate-90 sm:h-24 sm:w-24"
            delay={delay + 0.36}
            animate={animate}
            tone={tone}
          />
        </>
      )}
      {children}
    </div>
  );
}

export function GardenMark({ className }: { className?: string }) {
  return (
    <svg viewBox="-20 -20 40 40" className={className} aria-hidden="true">
      <circle
        r="17"
        fill="none"
        stroke={GOLD_DIM}
        strokeWidth="1"
        strokeDasharray="2 3"
      />
      <Leaf transform="translate(-13 8) rotate(-118) scale(0.62)" />
      <Leaf transform="translate(13 8) rotate(-62) scale(-0.62 0.62)" />
      <BloomShape petals={8} />
    </svg>
  );
}

/* A living garden floor: swaying grass blades (CSS, staggered),
   leaves and stemmed blooms that pop open on scroll. Decorative,
   aria-hidden, reduced-motion safe. Anchor: absolute bottom. */

const BED_BLOOMS: {
  x: number;
  h: number;
  hue: "gold" | "rose" | "green";
  petals: number;
  s: number;
  delay: number;
  open?: boolean;
}[] = [
  { x: 120, h: 46, hue: "gold", petals: 8, s: 0.62, delay: 0.1 },
  { x: 340, h: 34, hue: "rose", petals: 6, s: 0.5, delay: 0.3 },
  { x: 560, h: 52, hue: "gold", petals: 8, s: 0.7, delay: 0.5 },
  { x: 760, h: 38, hue: "green", petals: 6, s: 0.48, delay: 0.25, open: false },
  { x: 950, h: 48, hue: "rose", petals: 8, s: 0.6, delay: 0.65 },
  { x: 1160, h: 36, hue: "gold", petals: 6, s: 0.52, delay: 0.4 },
  { x: 1330, h: 50, hue: "rose", petals: 8, s: 0.66, delay: 0.8 },
];

const BED_LEAVES = [
  { x: 230, r: -115, s: 0.8, delay: 0.2 },
  { x: 470, r: -60, s: 0.7, delay: 0.45 },
  { x: 680, r: -120, s: 0.85, delay: 0.35 },
  { x: 880, r: -55, s: 0.65, delay: 0.6 },
  { x: 1080, r: -115, s: 0.75, delay: 0.5 },
  { x: 1260, r: -65, s: 0.7, delay: 0.75 },
];

export function GardenBed({ className }: { className?: string }) {
  const reduce = useReducedMotion();
  const anim = !reduce;

  const blades = Array.from({ length: 26 }, (_, i) => {
    const r1 = frac(i + 31);
    const r2 = frac(i + 32);
    const r3 = frac(i + 33);
    const x = 14 + i * 54.5 + r1 * 30;
    const h = 24 + r2 * 52;
    const bend = (r3 - 0.5) * 30;
    return {
      x,
      h,
      bend,
      a: 1.6 + r1 * 2.4,
      d: 4 + r2 * 3.5,
      delay: -r3 * 7,
      o: 0.2 + r2 * 0.3,
      w: 1.3 + r3 * 0.9,
    };
  });

  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-x-0 bottom-0 ${className ?? ""}`}
    >
      <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-verdant/[0.08] via-verdant/[0.03] to-transparent" />
      <svg
        viewBox="0 0 1440 120"
        preserveAspectRatio="xMidYMax slice"
        className="relative block h-20 w-full sm:h-24"
      >
        {blades.map((b, i) => (
          <path
            key={i}
            d={`M${b.x.toFixed(1)} 120 Q${(b.x + b.bend * 0.35).toFixed(1)} ${(120 - b.h * 0.55).toFixed(1)}, ${(b.x + b.bend).toFixed(1)} ${(120 - b.h).toFixed(1)}`}
            fill="none"
            stroke={`rgb(var(--verdant) / ${b.o.toFixed(2)})`}
            strokeWidth={b.w}
            strokeLinecap="round"
            className="grass-sway"
            style={
              {
                "--grass-a": `${b.a.toFixed(1)}deg`,
                "--grass-d": `${b.d.toFixed(1)}s`,
                "--grass-delay": `${b.delay.toFixed(1)}s`,
              } as CSSProperties
            }
          />
        ))}
        {BED_LEAVES.map((l, i) => (
          <m.g
            key={i}
            {...(anim
              ? {
                  initial: { opacity: 0, scale: 0.4 },
                  whileInView: { opacity: 1, scale: 1 },
                  viewport: { once: true, amount: 0.2 },
                  transition: { duration: 0.7, ease: EASE_OUT, delay: l.delay },
                }
              : {})}
            style={{ transformOrigin: `${l.x}px 120px` }}
          >
            <Leaf transform={`translate(${l.x} 118) rotate(${l.r}) scale(${l.s})`} />
          </m.g>
        ))}
        {BED_BLOOMS.map((b, i) => (
          <m.g
            key={i}
            {...(anim
              ? {
                  initial: { opacity: 0, scale: 0.3 },
                  whileInView: { opacity: 1, scale: 1 },
                  viewport: { once: true, amount: 0.2 },
                  transition: { duration: 0.8, ease: EASE_OUT, delay: b.delay },
                }
              : {})}
            style={{ transformOrigin: `${b.x}px ${120 - b.h}px` }}
          >
            <path
              d={`M${b.x} 120 Q${b.x + 6} ${120 - b.h * 0.5}, ${b.x} ${120 - b.h + 6}`}
              fill="none"
              stroke="rgb(var(--verdant) / 0.45)"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
            <g transform={`translate(${b.x} ${120 - b.h}) scale(${b.s})`}>
              <BloomShape petals={b.petals} hue={b.hue} open={b.open ?? true} />
            </g>
          </m.g>
        ))}
      </svg>
    </div>
  );
}
