"use client";

import { useI18n } from "@/lib/i18n";
import Link from "next/link";
import { m } from "motion/react";
import { EASE_OUT } from "@/components/MotionProvider";
import { ArrowIcon } from "@/components/VideoBuilder/icons";
import { GardenFrame, StemDivider } from "@/components/Ornament/ornaments";
import { ArchEdges, MihrabGlow, ThreadDivider, Parallax, BloomScatter } from "@/components/Home/atmosphere";

export function QuranPreview() {
  const { t, dir, locale } = useI18n();
  const isRTL = dir === "rtl";

  return (
    <section className="relative overflow-hidden py-24 sm:py-32">
      <ThreadDivider className="absolute inset-x-0 top-0" />
      <Parallax px={36} className="inset-x-0 -inset-y-10">
        <ArchEdges />
      </Parallax>
      <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-6 lg:grid-cols-2">
        <m.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.8, ease: EASE_OUT }}
        >
          <h2
            className="font-display text-3xl font-medium leading-[1.12] tracking-[0.01em] text-parchment sm:text-4xl md:text-5xl"
            style={
              locale === "ar"
                ? { fontFamily: "var(--font-ruqaa), 'Aref Ruqaa', serif" }
                : undefined
            }
          >
            {t("quran.title") as string}
          </h2>

          <p className="mt-6 max-w-lg text-lg leading-relaxed text-parchment-muted">
            {t("quran.description") as string}
          </p>

          <p
            className="mt-5 text-sm tracking-wide text-gold/90"
            style={{ fontFamily: "'Amiri', serif" }}
          >
            {t("quran.ref") as string}
          </p>

          <Link href="/create" className="btn-ghost group mt-9 px-6 py-3 text-sm">
            {t("quran.cta") as string}
            <ArrowIcon
              className={`h-4 w-4 text-gold/70 transition-transform duration-300 ${isRTL ? "rotate-180 group-hover:-translate-x-0.5" : "group-hover:translate-x-0.5"}`}
            />
          </Link>
        </m.div>

        <m.div
          className="relative"
          initial={{ opacity: 0, y: 34, scale: 0.97 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, amount: 0.35 }}
          transition={{ duration: 0.9, ease: EASE_OUT, delay: 0.1 }}
        >
          <Parallax px={64} className="inset-0 -inset-y-16">
            <MihrabGlow className="left-1/2 top-1/2 h-[118%] w-[88%] -translate-x-1/2 -translate-y-[54%]" />
          </Parallax>
          {/* Vine blooms climbing the mihrab corners */}
          <BloomScatter
            baseDelay={0.5}
            className="inset-0"
            blooms={[
              { x: "-20px", y: "-16px", size: 26, hue: "green", petals: 6, delay: 0 },
              { x: "-30px", y: "42%", size: 18, hue: "gold", petals: 6, open: false, delay: 0.2 },
              { x: "calc(100% + 2px)", y: "18%", size: 20, hue: "green", petals: 8, delay: 0.12 },
              { x: "calc(100% - 8px)", y: "calc(100% + 4px)", size: 24, hue: "gold", petals: 8, delay: 0.32 },
            ]}
          />
          <GardenFrame delay={0.2}>
            <figure className="panel-lit relative overflow-hidden p-10 sm:p-14">
              <div className="frame-sweep" aria-hidden="true" />
              <div className="relative text-center" translate="no">
                <p
                  dir="rtl"
                  lang="ar"
                  className="mb-8 text-3xl leading-loose text-gold sm:text-4xl"
                  style={{ fontFamily: "'Amiri', 'Scheherazade New', serif" }}
                >
                  بِسْمِ اللّٰهَ الرَّحْمٰنِ الرَّحِيْمِ
                </p>

                <StemDivider className="mx-auto mb-8 h-8 w-full max-w-md" delay={0.4} />

                <blockquote
                  dir="rtl"
                  lang="ar"
                  className="text-2xl leading-[2.2] text-parchment sm:text-[1.7rem]"
                  style={{ fontFamily: "'Amiri', 'Scheherazade New', serif" }}
                >
                  اللّٰهَ نُوْرُ السَّمٰوٰتِ وَالْأَرْضِ ۚ مَثَلُ نُوْرِهِ كَمِشْكٰوةٍ فِيْهَا مِصْبَاحٌ
                </blockquote>

                <figcaption
                  className="mt-8 text-sm text-gold/80"
                  style={{ fontFamily: "'Amiri', serif" }}
                >
                  سُوْرَةُ النُّوْر — ٣٥
                </figcaption>
              </div>
            </figure>
          </GardenFrame>
        </m.div>
      </div>
    </section>
  );
}
