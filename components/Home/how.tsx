"use client";

import { useI18n } from "@/lib/i18n";
import { m, useReducedMotion } from "motion/react";
import { EASE_OUT } from "@/components/MotionProvider";
import { BloomShape, Leaf } from "@/components/Ornament/ornaments";
import { Motes, GirihBand, Parallax, BloomScatter } from "@/components/Home/atmosphere";

function StepBloom({
  value,
  delay,
}: {
  value: number | string;
  delay: number;
}) {
  const reduce = useReducedMotion();
  const anim = !reduce;
  return (
    <span className="relative z-10 inline-flex h-14 w-14 items-center justify-center">
      <svg
        viewBox="-24 -24 48 48"
        className="absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
        <m.g
          {...(anim
            ? {
                initial: { opacity: 0, scale: 0.3, rotate: -30 },
                whileInView: { opacity: 1, scale: 1, rotate: 0 },
                viewport: { once: true, amount: 0.5 },
                transition: { duration: 0.8, ease: EASE_OUT, delay },
              }
            : {})}
        >
          <BloomShape petals={8} />
        </m.g>
      </svg>
      <m.span
        className="relative flex h-8 w-8 items-center justify-center rounded-full border border-gold/50 bg-ink text-[13px] font-bold text-gold shadow-[0_0_18px_-4px_rgb(var(--gold)/0.5)]"
        {...(anim
          ? {
              initial: { opacity: 0, scale: 0.5 },
              whileInView: { opacity: 1, scale: 1 },
              viewport: { once: true, amount: 0.5 },
              transition: { duration: 0.5, ease: EASE_OUT, delay: delay + 0.25 },
            }
          : {})}
      >
        {value}
      </m.span>
    </span>
  );
}

export function How() {
  const { t, locale } = useI18n();
  const steps = t("how.steps") as unknown as {
    title: string;
    description: string;
  }[];
  const ar = locale === "ar";
  const reduce = useReducedMotion();
  const anim = !reduce;

  return (
    <section id="how" className="relative overflow-hidden py-24 sm:py-32">
      <Parallax px={52} className="inset-x-0 -inset-y-14">
        <GirihBand />
      </Parallax>
      <Motes count={11} />
      {/* A flower row blooming along the garden band */}
      <BloomScatter
        className="inset-x-0 bottom-4 h-16"
        blooms={[
          { x: "5%", y: "30%", size: 22, hue: "gold", petals: 8, delay: 0 },
          { x: "21%", y: "58%", size: 15, hue: "green", petals: 6, open: false, delay: 0.15 },
          { x: "40%", y: "22%", size: 26, hue: "rose", petals: 8, delay: 0.3 },
          { x: "57%", y: "60%", size: 17, hue: "gold", petals: 6, open: false, delay: 0.45 },
          { x: "75%", y: "28%", size: 24, hue: "gold", petals: 8, delay: 0.6 },
          { x: "91%", y: "52%", size: 16, hue: "rose", petals: 6, delay: 0.75 },
        ]}
      />
      <Parallax px={78} pointerDrift={12} className="inset-0 -inset-y-16">
        <div
          className="garden-light left-1/2 top-[46%] h-[360px] w-[680px] -translate-x-1/2 -translate-y-1/2"
          aria-hidden="true"
        />
      </Parallax>
      <div className="relative mx-auto max-w-6xl px-6">
        <m.div
          className="mb-16 max-w-2xl"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.8, ease: EASE_OUT }}
        >
          <h2
            className="font-display text-3xl font-medium leading-tight tracking-[0.01em] text-parchment sm:text-4xl"
            style={
              ar
                ? { fontFamily: "var(--font-ruqaa), 'Aref Ruqaa', serif" }
                : undefined
            }
          >
            {t("how.title") as string}
          </h2>
        </m.div>

        <div className="relative">
          <div
            className="absolute left-[4.5%] right-[4.5%] top-0 hidden h-[64px] md:block"
            aria-hidden="true"
          >
            <svg viewBox="0 0 1000 64" className="h-full w-full" preserveAspectRatio="none">
              <m.path
                d="M125,40 C210,16 290,16 375,36 C460,56 540,56 625,36 C710,16 790,16 875,40"
                fill="none"
                stroke="rgb(var(--verdant) / 0.55)"
                strokeWidth="1.6"
                strokeLinecap="round"
                {...(anim
                  ? {
                      initial: { pathLength: 0 },
                      whileInView: { pathLength: 1 },
                      viewport: { once: true, amount: 0.5 },
                      transition: { duration: 2, ease: EASE_OUT },
                    }
                  : {})}
              />
              {[
                { x: 250, y: 22, r: -35 },
                { x: 500, y: 50, r: 145 },
                { x: 750, y: 22, r: -35 },
              ].map((l, i) => (
                <m.g
                  key={i}
                  {...(anim
                    ? {
                        initial: { opacity: 0, scale: 0.4 },
                        whileInView: { opacity: 1, scale: 1 },
                        viewport: { once: true, amount: 0.5 },
                        transition: {
                          duration: 0.6,
                          ease: EASE_OUT,
                          delay: 0.6 + i * 0.4,
                        },
                      }
                    : {})}
                  style={{ transformOrigin: `${l.x}px ${l.y}px` }}
                >
                  <g transform={`translate(${l.x} ${l.y}) rotate(${l.r})`}>
                    <Leaf />
                  </g>
                </m.g>
              ))}
            </svg>
          </div>

          <ol className="grid gap-10 md:grid-cols-4 md:gap-6">
            {steps.map((step, i) => (
              <li key={i}>
                <m.div
                  className="flex flex-col items-start gap-4 md:items-center md:text-center"
                  initial={{ opacity: 0, y: 26 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.4 }}
                  transition={{ duration: 0.7, ease: EASE_OUT, delay: 0.15 + i * 0.14 }}
                >
                  <StepBloom
                    value={ar ? ["١", "٢", "٣", "٤"][i] : i + 1}
                    delay={0.35 + i * 0.3}
                  />
                  <div>
                    <h3 className="font-display text-lg text-parchment">
                      {step.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-parchment-muted">
                      {step.description}
                    </p>
                  </div>
                </m.div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
