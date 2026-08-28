"use client";

import { useI18n } from "@/lib/i18n";
import { m } from "motion/react";
import { EASE_OUT } from "@/components/MotionProvider";
import { usePointerVars } from "@/components/Reveal";
import { MicIcon, VideoCameraIcon } from "@/components/VideoBuilder/icons";
import { Bloom, GardenMark } from "@/components/Ornament/ornaments";
import { CalligraphyWatermark, ThreadDivider, Parallax } from "@/components/Home/atmosphere";

function FeatureRow({
  icon,
  title,
  description,
  index,
  first,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  index: number;
  first: boolean;
}) {
  const ref = usePointerVars<HTMLDivElement>();

  return (
    <m.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.4 }}
      transition={{ duration: 0.7, ease: EASE_OUT, delay: index * 0.12 }}
    >
      <div
        ref={ref}
        className={`track-glow group relative flex gap-5 overflow-hidden rounded-2xl px-4 py-7 transition-colors duration-300 hover:bg-ink-soft/40 ${first ? "" : "border-t border-gold/10"}`}
      >
        <span className="relative mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-gold/25 bg-gold/[0.08] text-gold transition-all duration-300 group-hover:border-gold/50 group-hover:bg-gold/[0.14] group-hover:shadow-[0_8px_24px_-12px_rgb(var(--gold)/0.5)]">
          <Bloom className="absolute inset-0 m-auto h-9 w-9 opacity-0 transition-opacity duration-300 group-hover:opacity-100" petals={8} />
          <span className="transition-opacity duration-300 group-hover:opacity-0">{icon}</span>
        </span>
        <div>
          <h3 className="font-display text-lg text-parchment">{title}</h3>
          <p className="mt-1.5 max-w-lg text-sm leading-relaxed text-parchment-muted">
            {description}
          </p>
        </div>
      </div>
    </m.div>
  );
}

export function Features() {
  const { t, locale } = useI18n();
  const items = t("features.items") as unknown as {
    title: string;
    description: string;
  }[];
  const facts = t("features.facts") as unknown as string[];

  const icons = [
    <MicIcon key="1" className="h-5 w-5" />,
    <VideoCameraIcon key="2" className="h-5 w-5" />,
    <GardenMark key="3" className="h-6 w-6" />,
  ];

  return (
    <section
      id="features"
      className="relative overflow-hidden py-24 sm:py-32"
    >
      <ThreadDivider className="absolute inset-x-0 top-0" />
      <Parallax px={90} scale={0.06} rotate={2} className="inset-0 -inset-y-20">
        <CalligraphyWatermark className="right-0 top-[6%] translate-x-[22%] text-[10rem] text-gold sm:text-[13rem] lg:text-[17rem]">
          الذِّكْر
        </CalligraphyWatermark>
        {/* One great rose breathing beneath the watermark */}
        <Bloom
          className="bloom-sway absolute right-[8%] top-[58%] h-40 w-40 opacity-[0.13] sm:h-56 sm:w-56"
          petals={12}
          hue="rose"
        />
      </Parallax>
      <div className="relative mx-auto grid max-w-6xl gap-14 px-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20">
        <div>
          <m.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.8, ease: EASE_OUT }}
          >
            <h2
              className="font-display text-3xl font-medium leading-tight tracking-[0.01em] text-parchment sm:text-4xl"
              style={
                locale === "ar"
                  ? { fontFamily: "var(--font-ruqaa), 'Aref Ruqaa', serif" }
                  : undefined
              }
            >
              {t("features.title") as string}
            </h2>
            <p className="mt-5 max-w-md leading-relaxed text-parchment-muted">
              {t("features.description") as string}
            </p>
          </m.div>

          <m.ul
            className="mt-9 flex flex-wrap gap-2.5"
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.4 }}
            variants={{
              hidden: {},
              show: { transition: { staggerChildren: 0.09, delayChildren: 0.15 } },
            }}
          >
            {facts.map((fact) => (
              <m.li
                key={fact}
                className="flex items-center gap-2 rounded-full border border-gold/20 bg-gold/[0.06] px-3.5 py-1.5 text-[13px] font-medium text-gold/90"
                variants={{
                  hidden: { opacity: 0, y: 10, scale: 0.92 },
                  show: {
                    opacity: 1,
                    y: 0,
                    scale: 1,
                    transition: { duration: 0.5, ease: EASE_OUT },
                  },
                }}
              >
                <Bloom className="h-3 w-3" petals={6} open={false} />
                {fact}
              </m.li>
            ))}
          </m.ul>
        </div>

        <div>
          {items.map((item, i) => (
            <FeatureRow
              key={i}
              icon={icons[i]}
              title={item.title}
              description={item.description}
              index={i}
              first={i === 0}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
