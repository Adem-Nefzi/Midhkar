"use client";

import Link from "next/link";
import { SignedIn, SignedOut, SignInButton, SignUpButton } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { useI18n } from "@/app/lib/i18n";

export function Hero() {
  const { t, dir, locale } = useI18n();
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setLoaded(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const isRTL = dir === "rtl";

  return (
    <section className="relative overflow-hidden">
      {/* Background layers */}
      <div className="absolute inset-0 bg-ink" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-gold/[0.03] via-transparent to-transparent" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-verdant/[0.02] via-transparent to-transparent" />

      {/* Geometric pattern overlay */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 0L33.5 26.5L60 30L33.5 33.5L30 60L26.5 33.5L0 30L26.5 26.5Z' fill='none' stroke='%23d4af37' stroke-width='0.5'/%3E%3C/svg%3E")`,
          backgroundSize: "60px 60px",
        }}
      />

      <RosetteMotif />

      <div className="relative z-10 mx-auto flex max-w-4xl flex-col items-center px-6 py-24 text-center sm:py-32 lg:py-40">
        {/* Arabic title with decorative line */}
        <div
          className={`relative inline-block ${loaded ? "opacity-100" : "opacity-0"} transition-opacity duration-1000`}
        >
          <p
            dir="rtl"
            lang="ar"
            className="font-arabic text-3xl text-gold sm:text-4xl md:text-5xl leading-relaxed"
            style={{ fontFamily: "'Amiri', 'Scheherazade New', serif" }}
          >
            {t("hero.arabicTitle") as string}
          </p>
          <span
            className={`absolute -bottom-2 h-px bg-gradient-to-r from-transparent via-gold/60 to-transparent ${
              isRTL ? "right-0 left-0" : "left-0 right-0"
            }`}
          />
        </div>

        {/* Subtitle */}
        <p
          className={`mt-6 text-xs uppercase tracking-[0.25em] text-parchment-muted/80 ${loaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"} transition-all duration-700 delay-200`}
        >
          {t("hero.subtitle") as string}
        </p>

        {/* Main headline */}
        <h1
          className={`mt-8 font-display text-4xl font-medium leading-[1.15] text-parchment sm:text-5xl md:text-6xl lg:text-7xl ${loaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"} transition-all duration-700 delay-300`}
        >
          {locale === "ar" ? (
            <span style={{ fontFamily: "'Amiri', 'Scheherazade New', serif" }}>
              {t("hero.title") as string}
            </span>
          ) : (
            <span
              dangerouslySetInnerHTML={{ __html: t("hero.title") as string }}
            />
          )}
        </h1>

        {/* Description */}
        <p
          className={`mt-6 max-w-2xl text-lg leading-relaxed text-parchment-muted sm:text-xl ${loaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"} transition-all duration-700 delay-400`}
        >
          {t("hero.description") as string}
        </p>

        {/* Quranic verse card */}
        <div
          className={`mt-10 max-w-xl rounded-2xl border border-gold/10 bg-parchment/[0.02] p-6 backdrop-blur-sm ${loaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"} transition-all duration-700 delay-500`}
        >
          <div className="flex flex-col items-center gap-3">
            <svg
              className="h-5 w-5 text-gold/60"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
            </svg>
            <p
              dir="rtl"
              lang="ar"
              className="text-lg text-parchment/90 leading-relaxed"
              style={{ fontFamily: "'Amiri', 'Scheherazade New', serif" }}
            >
              {t("hero.verse") as string}
            </p>
            <p className="text-xs text-gold/70 tracking-wide uppercase">
              {t("hero.verseRef") as string}
            </p>
          </div>
        </div>

        {/* CTA Buttons */}
        <div
          className={`mt-10 flex flex-wrap items-center justify-center gap-4 ${loaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"} transition-all duration-700 delay-600`}
        >
          <SignedOut>
            <SignUpButton mode="modal">
              <button className="group relative cursor-pointer overflow-hidden rounded-full bg-gold px-8 py-3.5 text-sm font-semibold text-ink transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-gold/20">
                <span className="absolute inset-0 -translate-x-full bg-parchment/30 transition-transform duration-700 group-hover:translate-x-full" />
                <span className="relative flex items-center gap-2">
                  {t("hero.ctaPrimary") as string}
                  <svg
                    className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d={
                        isRTL
                          ? "M19 12H5M12 19l-7-7 7-7"
                          : "M17 8l4 4m0 0l-4 4m4-4H3"
                      }
                    />
                  </svg>
                </span>
              </button>
            </SignUpButton>
            <SignInButton mode="modal">
              <button className="cursor-pointer rounded-full border border-parchment/20 px-8 py-3.5 text-sm text-parchment transition-all duration-300 hover:border-gold/50 hover:text-gold hover:bg-gold/5">
                {t("hero.ctaSecondary") as string}
              </button>
            </SignInButton>
          </SignedOut>

          <SignedIn>
            <Link
              href="/create"
              className="group relative inline-block overflow-hidden rounded-full bg-gold px-8 py-3.5 text-sm font-semibold text-ink transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-gold/20"
            >
              <span className="absolute inset-0 -translate-x-full bg-parchment/30 transition-transform duration-700 group-hover:translate-x-full" />
              <span className="relative flex items-center gap-2">
                {t("hero.ctaPrimary") as string}
                <svg
                  className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
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
              </span>
            </Link>
          </SignedIn>
        </div>

        {/* Scroll indicator */}
        <div
          className={`mt-16 ${loaded ? "opacity-100" : "opacity-0"} transition-opacity duration-1000 delay-1000`}
        >
          <div className="flex flex-col items-center gap-2 text-parchment-muted/40">
            <span className="text-[10px] uppercase tracking-[0.3em]">
              {locale === "ar"
                ? "استكشف"
                : locale === "fr"
                  ? "Explorer"
                  : "Explore"}
            </span>
            <div className="h-8 w-px bg-gradient-to-b from-parchment-muted/40 to-transparent animate-pulse" />
          </div>
        </div>
      </div>
    </section>
  );
}

function RosetteMotif() {
  const { dir } = useI18n();
  const isRTL = dir === "rtl";

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute ${isRTL ? "-left-40 sm:-left-16" : "-right-40 sm:-right-16"} top-1/2 h-[560px] w-[560px] -translate-y-1/2 opacity-0 animate-fade-up [animation-delay:80ms] sm:h-[640px] sm:w-[640px]`}
    >
      {/* Central glow */}
      <div className="absolute left-1/2 top-1/2 h-48 w-48 -translate-x-1/2 -translate-y-1/2 animate-glow-pulse rounded-full bg-gold/30 blur-3xl" />

      {/* Secondary glow */}
      <div className="absolute left-1/2 top-1/2 h-32 w-32 -translate-x-1/2 -translate-y-1/2 animate-glow-pulse rounded-full bg-verdant/20 blur-2xl [animation-delay:1s]" />

      <svg viewBox="0 0 420 420" className="absolute inset-0 h-full w-full">
        {/* Outer circle */}
        <circle
          cx="210"
          cy="210"
          r="196"
          fill="none"
          strokeWidth="0.8"
          className="stroke-gold/[0.08]"
        />

        {/* Middle circle */}
        <circle
          cx="210"
          cy="210"
          r="160"
          fill="none"
          strokeWidth="0.5"
          className="stroke-gold/[0.05]"
        />

        {/* Inner circle */}
        <circle
          cx="210"
          cy="210"
          r="120"
          fill="none"
          strokeWidth="0.5"
          className="stroke-gold/[0.06]"
        />

        {/* Spinning outer star */}
        <g
          className="animate-spin-slow"
          style={{ transformBox: "view-box", transformOrigin: "210px 210px" }}
        >
          <path
            d="M210.00,42.00 L236.79,145.33 L328.79,91.21 L274.67,183.21 L378.00,210.00 L274.67,236.79 L328.79,328.79 L236.79,274.67 L210.00,378.00 L183.21,274.67 L91.21,328.79 L145.33,236.79 L42.00,210.00 L145.33,183.21 L91.21,91.21 L183.21,145.33 Z"
            fill="none"
            strokeWidth="1"
            className="stroke-gold/30"
          />
        </g>

        {/* Counter-spinning inner star */}
        <g
          className="animate-spin-slow-reverse"
          style={{ transformBox: "view-box", transformOrigin: "210px 210px" }}
        >
          <path
            d="M263.58,80.66 L251.01,168.99 L339.34,156.42 L268.00,210.00 L339.34,263.58 L251.01,251.01 L263.58,339.34 L210.00,268.00 L156.42,339.34 L168.99,251.01 L80.66,263.58 L152.00,210.00 L80.66,156.42 L168.99,168.99 L156.42,80.66 L210.00,152.00 Z"
            fill="none"
            strokeWidth="0.8"
            className="stroke-verdant/40"
          />
        </g>

        {/* Center circle */}
        <circle
          cx="210"
          cy="210"
          r="34"
          fill="none"
          strokeWidth="1"
          className="stroke-gold/40"
        />

        {/* Center dot */}
        <circle cx="210" cy="210" r="4" className="fill-gold/60" />
      </svg>
    </div>
  );
}
