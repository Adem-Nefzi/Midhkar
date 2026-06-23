"use client";

import { useI18n } from "@/lib/i18n";
import { useEffect, useRef, useState } from "react";

export function Features() {
  const { t, locale } = useI18n();
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
      { threshold: 0.2 },
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  const items = t("features.items") as { title: string; description: string }[];

  const icons = [
    <svg
      key="1"
      className="h-6 w-6"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
      />
    </svg>,
    <svg
      key="2"
      className="h-6 w-6"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M13 10V3L4 14h7v7l9-11h-7z"
      />
    </svg>,
    <svg
      key="3"
      className="h-6 w-6"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
      />
    </svg>,
  ];

  return (
    <section
      ref={ref}
      className="relative overflow-hidden border-t border-gold/15 bg-ink-light/30 py-24 sm:py-32"
    >
      {/* Ambient glows */}
      <div className="absolute left-1/2 top-0 h-[400px] w-[600px] -translate-x-1/2 bg-gold/[0.03] blur-[100px]" />
      <div className="absolute right-0 top-1/3 h-[300px] w-[300px] bg-verdant/[0.02] blur-[80px]" />

      {/* Islamic geometric pattern background — more visible */}
      <div className="absolute inset-0 opacity-[0.06]">
        <svg className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern
              id="arabesque-features"
              x="0"
              y="0"
              width="60"
              height="60"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M30,0 L33,27 L60,30 L33,33 L30,60 L27,33 L0,30 L27,27 Z"
                fill="none"
                stroke="#d4af37"
                strokeWidth="0.5"
              />
              <circle
                cx="30"
                cy="30"
                r="4"
                fill="none"
                stroke="#d4af37"
                strokeWidth="0.4"
              />
              <path
                d="M30,20 L32,28 L40,30 L32,32 L30,40 L28,32 L20,30 L28,28 Z"
                fill="none"
                stroke="#d4af37"
                strokeWidth="0.25"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#arabesque-features)" />
        </svg>
      </div>

      {/* Top decorative line — brighter */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 h-[2px] w-3/4 bg-gradient-to-r from-transparent via-gold/30 to-transparent" />

      {/* Floating orbs */}
      <div className="absolute top-[15%] left-[8%] h-[150px] w-[150px] animate-float-1 rounded-full bg-gold/[0.04] blur-[60px]" />
      <div className="absolute bottom-[20%] right-[10%] h-[180px] w-[180px] animate-float-2 rounded-full bg-gold/[0.03] blur-[70px]" />

      <div className="relative z-10 mx-auto max-w-6xl px-6">
        {/* Section header with Islamic ornament — brighter */}
        <div
          className={`text-center mb-16 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"} transition-all duration-700`}
        >
          {/* Ornamental divider above title — brighter */}
          <div className="flex items-center justify-center gap-5 mb-8">
            <div className="h-px w-20 bg-gradient-to-r from-transparent to-gold/40" />
            <svg
              className="h-6 w-6 text-gold/50"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
            >
              <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5Z" />
            </svg>
            <div className="h-px w-20 bg-gradient-to-l from-transparent to-gold/40" />
          </div>

          <p className="text-xs uppercase tracking-[0.25em] text-gold/70 mb-4">
            {t("features.eyebrow") as string}
          </p>
          <h2 className="font-display text-3xl font-medium text-parchment sm:text-4xl md:text-5xl leading-tight">
            {locale === "ar" ? (
              <span
                style={{ fontFamily: "'Amiri', 'Scheherazade New', serif" }}
              >
                {t("features.title") as string}
              </span>
            ) : (
              (t("features.title") as string)
            )}
          </h2>
          <p className="mt-4 max-w-xl mx-auto text-parchment-muted leading-relaxed">
            {t("features.description") as string}
          </p>

          {/* Bottom ornamental divider */}
          <div className="flex items-center justify-center gap-4 mt-8">
            <div className="h-px w-12 bg-gradient-to-r from-transparent to-gold/25" />
            <div className="h-1.5 w-1.5 rounded-full bg-gold/30" />
            <div className="h-px w-12 bg-gradient-to-l from-transparent to-gold/25" />
          </div>
        </div>

        {/* Feature cards with richer Islamic border styling */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item, i) => (
            <div
              key={i}
              className={`group relative rounded-sm border border-gold/15 bg-gradient-to-b from-ink-light/50 to-ink/60 p-8 transition-all duration-500 hover:border-gold/35 hover:bg-ink-light/60 hover:-translate-y-1 hover:shadow-lg hover:shadow-gold/5 ${
                visible
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-8"
              }`}
              style={{ transitionDelay: `${200 + i * 150}ms` }}
            >
              {/* Corner ornaments — brighter */}
              <div className="absolute top-0 left-0 h-5 w-5 border-t-2 border-l-2 border-gold/25" />
              <div className="absolute top-0 right-0 h-5 w-5 border-t-2 border-r-2 border-gold/25" />
              <div className="absolute bottom-0 left-0 h-5 w-5 border-b-2 border-l-2 border-gold/25" />
              <div className="absolute bottom-0 right-0 h-5 w-5 border-b-2 border-r-2 border-gold/25" />
              {/* Inner corner accents */}
              <div className="absolute top-1.5 left-1.5 h-2.5 w-2.5 border-t border-l border-gold/12" />
              <div className="absolute top-1.5 right-1.5 h-2.5 w-2.5 border-t border-r border-gold/12" />
              <div className="absolute bottom-1.5 left-1.5 h-2.5 w-2.5 border-b border-l border-gold/12" />
              <div className="absolute bottom-1.5 right-1.5 h-2.5 w-2.5 border-b border-r border-gold/12" />

              {/* Icon with glow on hover */}
              <div className="mb-5 inline-flex rounded-sm border border-gold/25 bg-gold/15 p-3.5 text-gold transition-all duration-300 group-hover:bg-gold/25 group-hover:border-gold/40 group-hover:shadow-md group-hover:shadow-gold/10">
                {icons[i]}
              </div>

              <h3 className="font-display text-lg font-medium text-parchment mb-3">
                {item.title}
              </h3>
              <p className="text-sm leading-relaxed text-parchment-muted/80">
                {item.description}
              </p>

              {/* Bottom accent line */}
              <div className="mt-6 h-px w-12 bg-gradient-to-r from-gold/20 to-transparent transition-all duration-300 group-hover:w-20 group-hover:from-gold/40" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
