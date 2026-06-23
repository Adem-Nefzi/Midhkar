"use client";

import { useI18n } from "@/lib/i18n";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";

export function QuranPreview() {
  const { t, dir, locale } = useI18n();
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  const isRTL = dir === "rtl";

  return (
    <section ref={ref} className="relative overflow-hidden py-24 sm:py-32">
      {/* ============================================================
          BACKGROUND LAYERS
      ============================================================ */}
      <div className="absolute inset-0 bg-gradient-to-b from-ink via-ink-light/20 to-ink" />

      {/* Large ambient glow behind the card — brighter */}
      <div className="absolute left-1/2 top-1/2 h-[700px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold/[0.05] blur-[100px]" />
      <div className="absolute left-1/3 top-1/3 h-[400px] w-[400px] rounded-full bg-verdant/[0.03] blur-[80px]" />

      {/* Corner quarter-medallions — brighter and larger */}
      <div className="absolute -top-12 -left-12 h-[300px] w-[300px] opacity-70">
        <QuarterMedallion />
      </div>
      <div className="absolute -top-12 -right-12 h-[300px] w-[300px] opacity-70 rotate-90">
        <QuarterMedallion />
      </div>
      <div className="absolute -bottom-12 -left-12 h-[300px] w-[300px] opacity-70 -rotate-90">
        <QuarterMedallion />
      </div>
      <div className="absolute -bottom-12 -right-12 h-[300px] w-[300px] opacity-70 rotate-180">
        <QuarterMedallion />
      </div>

      {/* Islamic geometric pattern background — more visible */}
      <div className="absolute inset-0 opacity-[0.07]">
        <svg className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern
              id="girih-quran"
              x="0"
              y="0"
              width="100"
              height="100"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M50,8 L55,42 L92,30 L62,50 L88,82 L50,60 L12,82 L38,50 L8,30 L45,42 Z"
                fill="none"
                stroke="#d4af37"
                strokeWidth="0.7"
              />
              <path
                d="M50,0 L50,8 M50,60 L50,100 M0,50 L8,50 M92,50 L100,50"
                stroke="#d4af37"
                strokeWidth="0.35"
              />
              <path
                d="M30,30 L70,70 M70,30 L30,70"
                stroke="#d4af37"
                strokeWidth="0.3"
              />
              <path
                d="M50,35 L58,42 L58,58 L50,65 L42,58 L42,42 Z"
                fill="none"
                stroke="#d4af37"
                strokeWidth="0.35"
              />
              {/* Inner small star */}
              <path
                d="M50,45 L52,50 L57,50 L53,53 L55,58 L50,55 L45,58 L47,53 L43,50 L48,50 Z"
                fill="none"
                stroke="#d4af37"
                strokeWidth="0.25"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#girih-quran)" />
        </svg>
      </div>

      {/* Floating gold orbs — more visible */}
      <div className="absolute top-[20%] left-[10%] h-[150px] w-[150px] animate-float-1 rounded-full bg-gold/[0.06] blur-[60px]" />
      <div className="absolute bottom-[30%] right-[15%] h-[180px] w-[180px] animate-float-2 rounded-full bg-gold/[0.05] blur-[70px]" />
      <div className="absolute top-[60%] left-[5%] h-[120px] w-[120px] animate-float-3 rounded-full bg-verdant/[0.04] blur-[50px]" />

      {/* ============================================================
          DECORATIVE TOP/BOTTOM BORDERS — brighter
      ============================================================ */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 h-[2px] w-3/4 bg-gradient-to-r from-transparent via-gold/30 to-transparent" />
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-[2px] w-3/4 bg-gradient-to-r from-transparent via-gold/30 to-transparent" />

      {/* Horizontal light beams */}
      <div className="absolute top-[20%] left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-gold/[0.08] to-transparent" />
      <div className="absolute top-[50%] left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-gold/[0.06] to-transparent" />
      <div className="absolute top-[80%] left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-gold/[0.07] to-transparent" />

      <div className="relative z-10 mx-auto max-w-6xl px-6">
        <div
          className={`grid gap-12 lg:grid-cols-2 items-center ${isRTL ? "lg:flex-row-reverse" : ""}`}
        >
          {/* ============================================================
              TEXT CONTENT
          ============================================================ */}
          <div
            className={`${visible ? "opacity-100 translate-x-0" : isRTL ? "opacity-0 translate-x-8" : "opacity-0 -translate-x-8"} transition-all duration-1000`}
          >
            {/* Eyebrow with ornament — brighter */}
            <div className="flex items-center gap-3 mb-4">
              <div className="h-px w-10 bg-gradient-to-r from-gold/50 to-transparent" />
              <svg
                className="h-3 w-3 text-gold/50"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5Z" />
              </svg>
              <p className="text-xs uppercase tracking-[0.25em] text-gold/80">
                {t("quran.eyebrow") as string}
              </p>
            </div>

            <h2 className="font-display text-3xl font-medium text-parchment sm:text-4xl md:text-5xl leading-tight mb-6">
              {locale === "ar" ? (
                <span
                  style={{ fontFamily: "'Amiri', 'Scheherazade New', serif" }}
                >
                  {t("quran.title") as string}
                </span>
              ) : (
                <>
                  Light upon <span className="text-gold">light</span>
                </>
              )}
            </h2>

            <p className="text-lg leading-relaxed text-parchment-muted mb-8">
              {t("quran.description") as string}
            </p>

            <p
              className="text-sm text-gold/80 mb-8 tracking-wide"
              style={{ fontFamily: "'Amiri', serif" }}
            >
              {t("quran.ref") as string}
            </p>

            <Link
              href="/create"
              className="group inline-flex items-center gap-2 rounded-full border-2 border-gold/40 bg-gold/10 px-6 py-3 text-sm text-gold transition-all hover:bg-gold/20 hover:border-gold/60"
            >
              {t("quran.cta") as string}
              <svg
                className={`h-4 w-4 transition-transform group-hover:translate-x-0.5 ${isRTL ? "rotate-180 group-hover:-translate-x-0.5" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 8l4 4m0 0l-4 4m4-4H3"
                />
              </svg>
            </Link>
          </div>

          {/* ============================================================
              ILLUMINATED MANUSCRIPT CARD
              — Like opening a Qur'an to a carpet page
          ============================================================ */}
          <div
            className={`relative ${visible ? "opacity-100 translate-x-0" : isRTL ? "opacity-0 -translate-x-8" : "opacity-0 translate-x-8"} transition-all duration-1000 delay-200`}
          >
            {/* Outer glow — brighter */}
            <div className="absolute -inset-6 rounded-sm bg-gold/[0.05] blur-2xl" />
            <div className="absolute -inset-3 rounded-sm bg-gold/[0.03] blur-xl" />

            <div className="relative rounded-sm border-2 border-gold/30 bg-gradient-to-b from-ink-light/70 via-ink/90 to-ink-light/70 p-8 sm:p-14 overflow-hidden">
              {/* Triple manuscript border frame — brighter */}
              <div className="absolute inset-2 border border-gold/20" />
              <div className="absolute inset-3 border border-gold/12" />
              <div className="absolute inset-4 border border-gold/8" />
              <div className="absolute inset-5 border border-gold/5" />

              {/* Large corner ornaments — brighter */}
              <ManuscriptCornerLarge position="top-left" />
              <ManuscriptCornerLarge position="top-right" />
              <ManuscriptCornerLarge position="bottom-left" />
              <ManuscriptCornerLarge position="bottom-right" />

              {/* Inner corner accents */}
              <InnerCornerAccent position="top-left" />
              <InnerCornerAccent position="top-right" />
              <InnerCornerAccent position="bottom-left" />
              <InnerCornerAccent position="bottom-right" />

              {/* Side arabesque scrollwork — top & bottom — brighter */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 h-8 w-40 -translate-y-1/2">
                <svg
                  viewBox="0 0 160 32"
                  className="h-full w-full"
                  preserveAspectRatio="none"
                >
                  <path
                    d="M0,16 Q20,0 40,16 T80,16 T120,16 T160,16"
                    fill="none"
                    strokeWidth="1.2"
                    className="stroke-gold/45"
                  />
                  <path
                    d="M0,16 Q20,32 40,16 T80,16 T120,16 T160,16"
                    fill="none"
                    strokeWidth="1"
                    className="stroke-gold/30"
                  />
                  <path
                    d="M0,16 Q20,8 40,16 T80,16 T120,16 T160,16"
                    fill="none"
                    strokeWidth="0.6"
                    className="stroke-gold/18"
                  />
                </svg>
              </div>
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-8 w-40 translate-y-1/2 rotate-180">
                <svg
                  viewBox="0 0 160 32"
                  className="h-full w-full"
                  preserveAspectRatio="none"
                >
                  <path
                    d="M0,16 Q20,0 40,16 T80,16 T120,16 T160,16"
                    fill="none"
                    strokeWidth="1.2"
                    className="stroke-gold/45"
                  />
                  <path
                    d="M0,16 Q20,32 40,16 T80,16 T120,16 T160,16"
                    fill="none"
                    strokeWidth="1"
                    className="stroke-gold/30"
                  />
                  <path
                    d="M0,16 Q20,8 40,16 T80,16 T120,16 T160,16"
                    fill="none"
                    strokeWidth="0.6"
                    className="stroke-gold/18"
                  />
                </svg>
              </div>

              {/* Side arabesque scrollwork — left & right — brighter */}
              <div className="absolute left-0 top-1/2 -translate-y-1/2 h-40 w-8 -translate-x-1/2 -rotate-90">
                <svg
                  viewBox="0 0 160 32"
                  className="h-full w-full"
                  preserveAspectRatio="none"
                >
                  <path
                    d="M0,16 Q20,0 40,16 T80,16 T120,16 T160,16"
                    fill="none"
                    strokeWidth="1"
                    className="stroke-gold/35"
                  />
                  <path
                    d="M0,16 Q20,32 40,16 T80,16 T120,16 T160,16"
                    fill="none"
                    strokeWidth="0.8"
                    className="stroke-gold/22"
                  />
                </svg>
              </div>
              <div className="absolute right-0 top-1/2 -translate-y-1/2 h-40 w-8 translate-x-1/2 rotate-90">
                <svg
                  viewBox="0 0 160 32"
                  className="h-full w-full"
                  preserveAspectRatio="none"
                >
                  <path
                    d="M0,16 Q20,0 40,16 T80,16 T120,16 T160,16"
                    fill="none"
                    strokeWidth="1"
                    className="stroke-gold/35"
                  />
                  <path
                    d="M0,16 Q20,32 40,16 T80,16 T120,16 T160,16"
                    fill="none"
                    strokeWidth="0.8"
                    className="stroke-gold/22"
                  />
                </svg>
              </div>

              {/* Central glow behind text — brighter */}
              <div className="absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold/[0.08] blur-[70px]" />
              <div className="absolute left-1/2 top-[35%] h-40 w-56 -translate-x-1/2 rounded-full bg-parchment/[0.03] blur-[40px]" />

              <div className="relative z-10 text-center py-8">
                {/* Bismillah — large, glowing, in bright gold */}
                <p
                  className="text-4xl sm:text-5xl md:text-6xl text-gold mb-12 leading-loose drop-shadow-[0_0_40px_rgba(212,175,55,0.2)]"
                  style={{ fontFamily: "'Amiri', 'Scheherazade New', serif" }}
                >
                  بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
                </p>

                {/* Ornate divider — manuscript headpiece style — brighter */}
                <div className="flex items-center justify-center gap-6 mb-12">
                  <div className="h-px w-24 bg-gradient-to-r from-transparent to-gold/50" />
                  <svg
                    className="h-7 w-7 text-gold/60"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1"
                  >
                    <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5Z" />
                  </svg>
                  <div className="h-px w-24 bg-gradient-to-l from-transparent to-gold/50" />
                </div>

                {/* Ayat an-Nur — the verse of light — brighter text */}
                <p
                  className="text-2xl sm:text-3xl text-parchment leading-[2.4] mb-10"
                  style={{ fontFamily: "'Amiri', 'Scheherazade New', serif" }}
                >
                  اللَّهُ نُورُ السَّمَاوَاتِ وَالْأَرْضِ ۚ مَثَلُ نُورِهِ
                  كَمِشْكَاةٍ فِيهَا مِصْبَاحٌ
                </p>

                {/* Sajdah marker with ornament — brighter */}
                <div className="flex items-center justify-center gap-5 mt-10">
                  <div className="h-px w-16 bg-gradient-to-r from-transparent to-gold/40" />
                  <svg
                    className="h-4 w-4 text-gold/40"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5Z" />
                  </svg>
                  <span
                    className="text-sm text-gold/70 tracking-[0.15em]"
                    style={{ fontFamily: "'Amiri', serif" }}
                  >
                    سورة النور — ٣٥
                  </span>
                  <svg
                    className="h-4 w-4 text-gold/40"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5Z" />
                  </svg>
                  <div className="h-px w-16 bg-gradient-to-l from-transparent to-gold/40" />
                </div>
              </div>
            </div>

            {/* Floating geometric ornaments around the card — brighter */}
            <div
              className="absolute -top-8 -right-8 h-24 w-24 animate-spin-slow"
              style={{ animationDuration: "40s" }}
            >
              <svg viewBox="0 0 96 96" className="h-full w-full">
                <path
                  d="M48,12 L52,40 L80,36 L56,48 L80,60 L52,56 L48,84 L44,56 L16,60 L40,48 L16,36 L44,40 Z"
                  fill="none"
                  strokeWidth="1.2"
                  className="stroke-gold/30"
                />
                <path
                  d="M48,24 L50,42 L68,40 L54,48 L68,56 L50,54 L48,72 L46,54 L28,56 L42,48 L28,40 L46,42 Z"
                  fill="none"
                  strokeWidth="0.8"
                  className="stroke-gold/20"
                />
                <circle
                  cx="48"
                  cy="48"
                  r="4"
                  fill="none"
                  strokeWidth="0.8"
                  className="stroke-gold/25"
                />
              </svg>
            </div>
            <div
              className="absolute -bottom-6 -left-6 h-20 w-20 animate-spin-slow-reverse"
              style={{ animationDuration: "35s" }}
            >
              <svg viewBox="0 0 80 80" className="h-full w-full">
                <path
                  d="M40,8 L43,32 L68,28 L48,40 L68,52 L43,48 L40,72 L37,48 L12,52 L32,40 L12,28 L37,32 Z"
                  fill="none"
                  strokeWidth="1"
                  className="stroke-gold/25"
                />
                <circle
                  cx="40"
                  cy="40"
                  r="3"
                  fill="none"
                  strokeWidth="0.6"
                  className="stroke-gold/20"
                />
              </svg>
            </div>
            <div
              className="absolute top-1/2 -right-10 h-16 w-16 animate-float-1"
              style={{ animationDuration: "20s" }}
            >
              <svg viewBox="0 0 64 64" className="h-full w-full">
                <path
                  d="M32,6 L35,26 L54,24 L38,32 L54,40 L35,38 L32,58 L29,38 L10,40 L26,32 L10,24 L29,26 Z"
                  fill="none"
                  strokeWidth="0.8"
                  className="stroke-gold/20"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ================================================================
   QUARTER MEDALLION — Carpet page corner motif — brighter
   ================================================================ */
function QuarterMedallion() {
  return (
    <svg viewBox="0 0 200 200" className="h-full w-full">
      <path
        d="M200,0 A200,200 0 0,0 0,200"
        fill="none"
        strokeWidth="1.5"
        className="stroke-gold/35"
      />
      <path
        d="M180,0 A180,180 0 0,0 0,180"
        fill="none"
        strokeWidth="1"
        className="stroke-gold/28"
      />
      <path
        d="M160,0 A160,160 0 0,0 0,160"
        fill="none"
        strokeWidth="0.7"
        className="stroke-gold/20"
      />
      <path
        d="M140,0 A140,140 0 0,0 0,140"
        fill="none"
        strokeWidth="0.5"
        className="stroke-gold/15"
      />
      {[...Array(16)].map((_, i) => {
        const angle = (i * 11.25 * Math.PI) / 180;
        const x = 200 - Math.cos(angle) * 200;
        const y = 200 - Math.sin(angle) * 200;
        return (
          <line
            key={i}
            x1="200"
            y1="200"
            x2={x}
            y2={y}
            strokeWidth="0.5"
            className="stroke-gold/12"
          />
        );
      })}
      <path
        d="M200,50 L170,90 L200,130 L160,120 L140,160 L130,120 L90,130 L120,90 L90,50 L130,60 L140,20 L160,60 Z"
        fill="none"
        strokeWidth="0.8"
        className="stroke-gold/25"
      />
      <path
        d="M200,80 L185,100 L200,120 L175,115 L165,140 L155,115 L130,120 L150,100 L130,80 L155,85 L165,60 L175,85 Z"
        fill="none"
        strokeWidth="0.6"
        className="stroke-gold/18"
      />
    </svg>
  );
}

/* ================================================================
   LARGE MANUSCRIPT CORNER ORNAMENT — brighter
   ================================================================ */
function ManuscriptCornerLarge({
  position,
}: {
  position: "top-left" | "top-right" | "bottom-left" | "bottom-right";
}) {
  const posClasses = {
    "top-left": "top-4 left-4",
    "top-right": "top-4 right-4",
    "bottom-left": "bottom-4 left-4",
    "bottom-right": "bottom-4 right-4",
  };

  const rotateClasses = {
    "top-left": "",
    "top-right": "rotate-90",
    "bottom-left": "-rotate-90",
    "bottom-right": "rotate-180",
  };

  return (
    <div className={`absolute ${posClasses[position]}`}>
      <svg
        viewBox="0 0 40 40"
        className={`h-8 w-8 sm:h-10 sm:w-10 ${rotateClasses[position]}`}
      >
        {/* Outer L-frame */}
        <path
          d="M2,2 L2,28 L10,28 L10,10 L28,10 L28,2 Z"
          fill="none"
          strokeWidth="1.5"
          className="stroke-gold/50"
        />
        {/* Middle L-frame */}
        <path
          d="M6,6 L6,24 L12,24 L12,12 L24,12 L24,6 Z"
          fill="none"
          strokeWidth="1"
          className="stroke-gold/35"
        />
        {/* Inner L-frame */}
        <path
          d="M10,10 L10,20 L14,20 L14,14 L20,14 L20,10 Z"
          fill="none"
          strokeWidth="0.7"
          className="stroke-gold/22"
        />
        {/* Corner 8-point star */}
        <path
          d="M18,18 L19,21 L22,20 L20,22 L22,24 L19,23 L18,26 L17,23 L14,24 L16,22 L14,20 L17,21 Z"
          fill="none"
          strokeWidth="0.7"
          className="stroke-gold/35"
        />
        <circle cx="18" cy="18" r="2" className="fill-gold/30" />
      </svg>
    </div>
  );
}

/* ================================================================
   INNER CORNER ACCENT — small decorative corner detail
   ================================================================ */
function InnerCornerAccent({
  position,
}: {
  position: "top-left" | "top-right" | "bottom-left" | "bottom-right";
}) {
  const posClasses = {
    "top-left": "top-7 left-7",
    "top-right": "top-7 right-7",
    "bottom-left": "bottom-7 left-7",
    "bottom-right": "bottom-7 right-7",
  };

  const rotateClasses = {
    "top-left": "",
    "top-right": "rotate-90",
    "bottom-left": "-rotate-90",
    "bottom-right": "rotate-180",
  };

  return (
    <div className={`absolute ${posClasses[position]}`}>
      <svg viewBox="0 0 16 16" className={`h-4 w-4 ${rotateClasses[position]}`}>
        <path
          d="M2,2 L2,10 L6,10 L6,6 L10,6 L10,2 Z"
          fill="none"
          strokeWidth="0.8"
          className="stroke-gold/30"
        />
        <circle cx="6" cy="6" r="1" className="fill-gold/25" />
      </svg>
    </div>
  );
}
