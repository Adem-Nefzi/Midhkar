"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { m } from "motion/react";
import { EASE_OUT } from "@/components/MotionProvider";
import { Bloom, GardenBed, GardenMark } from "@/components/Ornament/ornaments";
import {
  BloomScatter,
  BorderStrip,
  FallingPetals,
  Motes,
  Parallax,
} from "@/components/Home/atmosphere";
import { fetchVerseByKey } from "@/lib/quran";

/* The closing ayah — 2:186, "indeed I am near". Fetched byte-exact
   from the Quran Foundation API at runtime; the constants below are
   API-verified fallbacks so the band never renders empty. */
const FALLBACK_AR = "وَإِذَا سَأَلَكَ عِبَادِى عَنِّى فَإِنِّى قَرِيبٌ ۖ أُجِيبُ دَعْوَةَ ٱلدَّاعِ إِذَا دَعَانِ ۖ فَلْيَسْتَجِيبُوا۟ لِى وَلْيُؤْمِنُوا۟ بِى لَعَلَّهُمْ يَرْشُدُونَ";
const FALLBACK_EN = "And when My servants ask you, [O Muḥammad], concerning Me - indeed I am near. I respond to the invocation of the supplicant when he calls upon Me. So let them respond to Me [by obedience] and believe in Me that they may be [rightly] guided.";
const FALLBACK_FR = "Et quand Mes serviteurs t’interrogent sur Moi, alors Je suis tout proche: Je réponds à l’appel de celui qui M’invoque quand il M’invoque. Qu’ils répondent donc à Mon appel, et qu’ils croient en Moi, afin qu’ils soient bien guidés.";

function FooterAyah({ locale }: { locale: string }) {
  const [verse, setVerse] = useState<{
    text: string;
    translation: string;
  } | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    const lang = locale === "ar" ? "ar" : locale === "fr" ? "fr" : "en";
    fetchVerseByKey(2, 186, lang, ctrl.signal)
      .then((v) => {
        if (v && v.text) {
          setVerse({ text: v.text, translation: v.translation });
        }
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, [locale]);

  const ar = locale === "ar";
  const text = verse?.text || FALLBACK_AR;
  const translation = ar
    ? ""
    : verse?.translation || (locale === "fr" ? FALLBACK_FR : FALLBACK_EN);
  const refLabel = ar
    ? "سُورَة البَقَرَة · ١٨٦"
    : `${locale === "fr" ? "Sourate" : "Surah"} Al-Baqarah · 2:186`;

  return (
    <div className="relative mx-auto max-w-5xl px-6 text-center">
      <div
        aria-hidden="true"
        className="absolute left-1/2 top-1/2 h-[170%] w-[135%] -translate-x-1/2 -translate-y-1/2"
      >
        <div className="animate-garden-breathe h-full w-full rounded-full bg-[radial-gradient(closest-side,rgb(var(--gold)/0.12),rgb(var(--verdant)/0.04)_58%,transparent)] blur-2xl" />
      </div>

      <BloomScatter
        className="inset-0"
        blooms={[
          { x: "-42px", y: "6%", size: 26, hue: "gold", petals: 8, delay: 0.25 },
          { x: "-58px", y: "74%", size: 18, hue: "rose", petals: 6, delay: 0.45 },
          { x: "calc(100% + 14px)", y: "14%", size: 22, hue: "rose", petals: 8, delay: 0.35 },
          { x: "calc(100% + 32px)", y: "80%", size: 28, hue: "gold", petals: 8, delay: 0.55 },
        ]}
      />

      <m.figure
        className="relative"
        initial={{ opacity: 0, y: 26 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.9, ease: EASE_OUT }}
      >
        <p
          dir="rtl"
          lang="ar"
          translate="no"
          className="text-[1.9rem] leading-[2.15] text-gold-soft [text-shadow:0_0_40px_rgb(var(--gold)/0.28)] sm:text-4xl sm:leading-[2.1] lg:text-[2.8rem]"
          style={{ fontFamily: "'Amiri', 'Scheherazade New', serif" }}
        >
          {text}
        </p>
        {translation && (
          <p className="mx-auto mt-7 max-w-3xl text-[15px] leading-relaxed text-parchment-muted">
            {translation}
          </p>
        )}
        <figcaption
          className="mt-6 text-[13px] tracking-wide text-gold/70"
          style={{ fontFamily: "'Amiri', serif" }}
        >
          {refLabel}
        </figcaption>
      </m.figure>
    </div>
  );
}

export function Footer() {
  const { t, locale } = useI18n();
  return (
    <footer className="relative overflow-hidden">
      <Parallax px={26} className="inset-x-0 -top-7 h-28">
        <BorderStrip />
      </Parallax>
      <div
        className="absolute left-1/2 top-0 h-px w-2/3 -translate-x-1/2 bg-gradient-to-r from-transparent via-gold/40 to-transparent"
        aria-hidden="true"
      />

      {/* Petals drifting down through the closing garden */}
      <FallingPetals count={7} dim={0.75} />
      {/* Fireflies over the garden floor — two depth groups that
          follow the pointer */}
      <Motes count={9} dim={0.9} boost interactive />

      {/* One ayah for the whole band — said once, takes the space */}
      <div className="relative z-10 border-b border-gold/10 py-16 sm:py-24">
        <FooterAyah locale={locale} />
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-6 pb-32 pt-14 sm:pb-36">
        <div className="flex flex-col items-center text-center">
          <Link href="/" className="group flex items-center gap-3">
            <span className="text-gold transition-transform duration-500 group-hover:rotate-[22.5deg]">
              <GardenMark className="h-8 w-8" />
            </span>
            <span className="font-display text-xl tracking-[0.08em] text-parchment transition-colors group-hover:text-gold-soft">
              Midhkar
            </span>
          </Link>

          <p className="mt-6 max-w-md text-[15px] leading-relaxed text-parchment-muted">
            {t("footer.tagline") as string}
          </p>

          <p className="mt-3 text-sm text-gold/80">
            {t("footer.free") as string}
          </p>

          <div className="group mt-8 flex items-center gap-3" aria-hidden="true">
            <div className="h-px w-16 bg-gradient-to-r from-transparent to-gold/25 sm:w-20" />
            <Bloom
              className="h-3 w-3 opacity-70 transition-transform duration-500 ease-out group-hover:rotate-45 group-hover:scale-125"
              petals={6}
              open={false}
            />
            <Bloom
              className="h-4 w-4 transition-transform duration-500 ease-out group-hover:rotate-[22.5deg] group-hover:scale-110"
              petals={8}
            />
            <Bloom
              className="h-3 w-3 opacity-70 transition-transform duration-500 ease-out group-hover:-rotate-45 group-hover:scale-125"
              petals={6}
              open={false}
            />
            <div className="h-px w-16 bg-gradient-to-l from-transparent to-gold/25 sm:w-20" />
          </div>

          <p className="mt-8 text-[13px] tracking-wide text-parchment-dim">
            &copy; {new Date().getFullYear()} Midhkar.{" "}
            {t("footer.rights") as string}
          </p>
        </div>
      </div>

      {/* The garden floor: swaying grass, leaves, blooms on scroll */}
      <GardenBed />
    </footer>
  );
}
