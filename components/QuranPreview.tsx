"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/app/lib/i18n";

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
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-ink via-ink-light/20 to-ink" />

      {/* Decorative elements */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 h-px w-1/3 bg-gradient-to-r from-transparent via-gold/20 to-transparent" />
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-px w-1/3 bg-gradient-to-r from-transparent via-gold/20 to-transparent" />

      <div className="relative z-10 mx-auto max-w-6xl px-6">
        <div
          className={`grid gap-12 lg:grid-cols-2 items-center ${isRTL ? "lg:flex-row-reverse" : ""}`}
        >
          {/* Text content */}
          <div
            className={`${visible ? "opacity-100 translate-x-0" : isRTL ? "opacity-0 translate-x-8" : "opacity-0 -translate-x-8"} transition-all duration-1000`}
          >
            <p className="text-xs uppercase tracking-[0.25em] text-gold/70 mb-4">
              {t("quran.eyebrow") as string}
            </p>
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
            <p className="text-sm text-gold/70 mb-8 tracking-wide">
              {t("quran.ref") as string}
            </p>
            <Link
              href="/create"
              className="group inline-flex items-center gap-2 rounded-full border border-gold/30 px-6 py-3 text-sm text-gold transition-all hover:bg-gold/10 hover:border-gold/50"
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

          {/* Visual - Arabic calligraphy card */}
          <div
            className={`relative ${visible ? "opacity-100 translate-x-0" : isRTL ? "opacity-0 -translate-x-8" : "opacity-0 translate-x-8"} transition-all duration-1000 delay-200`}
          >
            <div className="relative rounded-3xl border border-gold/10 bg-gradient-to-br from-ink-light/60 to-ink p-8 sm:p-12 overflow-hidden">
              {/* Glow effect */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-64 w-64 rounded-full bg-gold/5 blur-3xl" />

              {/* Decorative border corners */}
              <div className="absolute top-4 left-4 h-8 w-8 border-t border-l border-gold/20" />
              <div className="absolute top-4 right-4 h-8 w-8 border-t border-r border-gold/20" />
              <div className="absolute bottom-4 left-4 h-8 w-8 border-b border-l border-gold/20" />
              <div className="absolute bottom-4 right-4 h-8 w-8 border-b border-r border-gold/20" />

              <div className="relative z-10 text-center">
                {/* Bismillah */}
                <p
                  className="text-3xl sm:text-4xl text-gold/90 mb-8 leading-loose"
                  style={{ fontFamily: "'Amiri', 'Scheherazade New', serif" }}
                >
                  بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
                </p>

                {/* Decorative divider */}
                <div className="flex items-center justify-center gap-4 mb-8">
                  <div className="h-px w-12 bg-gradient-to-r from-transparent to-gold/30" />
                  <svg
                    className="h-4 w-4 text-gold/40"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5Z" />
                  </svg>
                  <div className="h-px w-12 bg-gradient-to-l from-transparent to-gold/30" />
                </div>

                {/* Ayat an-Nur */}
                <p
                  className="text-xl sm:text-2xl text-parchment/90 leading-[2] mb-6"
                  style={{ fontFamily: "'Amiri', 'Scheherazade New', serif" }}
                >
                  اللَّهُ نُورُ السَّمَاوَاتِ وَالْأَرْضِ ۚ مَثَلُ نُورِهِ
                  كَمِشْكَاةٍ فِيهَا مِصْبَاحٌ
                </p>

                <p className="text-xs text-parchment-muted/60 tracking-wider uppercase">
                  سورة النور — ٣٥
                </p>
              </div>
            </div>

            {/* Floating decorative elements */}
            <div
              className="absolute -top-6 -right-6 h-24 w-24 rounded-full border border-gold/10 animate-spin-slow"
              style={{ animationDuration: "20s" }}
            >
              <svg viewBox="0 0 100 100" className="h-full w-full">
                <path
                  d="M50,10 L55,40 L85,35 L60,55 L75,80 L50,65 L25,80 L40,55 L15,35 L45,40 Z"
                  fill="none"
                  strokeWidth="0.5"
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
