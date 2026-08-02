"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { useEffect, useState } from "react";
import { usePointerVars } from "@/components/Reveal";

const locales: { code: "en" | "fr" | "ar"; label: string }[] = [
  { code: "en", label: "EN" },
  { code: "fr", label: "FR" },
  { code: "ar", label: "ع" },
];

export function Navbar() {
  const { locale, setLocale, t } = useI18n();
  const [scrolled, setScrolled] = useState(false);
  const ctaRef = usePointerVars<HTMLAnchorElement>();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 overflow-hidden border-b backdrop-blur-xl transition-all duration-500 ${
        scrolled
          ? "border-gold/25 bg-ink/85 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.6)]"
          : "border-gold/10 bg-ink/60"
      }`}
    >
      {/* Gold accent hairline */}
      <div
        className={`absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent transition-opacity duration-500 ${
          scrolled ? "opacity-100" : "opacity-40"
        }`}
      />

      {/* Ambient glow */}
      <div className="absolute left-1/2 top-0 h-16 w-[28rem] -translate-x-1/2 bg-gold/[0.05] blur-[50px] pointer-events-none" />

      <div className="relative z-10 mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3.5 sm:px-6 sm:py-4">
        {/* Logo */}
        <Link
          href="/"
          className="group flex items-center gap-2.5 font-display text-lg tracking-tight text-parchment transition-colors hover:text-gold-soft"
        >
          <span className="relative">
            <svg
              viewBox="0 0 36 36"
              className="h-7 w-7 transition-transform duration-700 ease-out group-hover:rotate-180 group-hover:scale-110"
            >
              <path
                d="M18,2 L21,15 L34,12 L24,18 L34,24 L21,21 L18,34 L15,21 L2,24 L12,18 L2,12 L15,15 Z"
                fill="none"
                strokeWidth="1.2"
                className="stroke-gold"
              />
              <path
                d="M18,8 L19.5,15.5 L27,14 L21.5,18.5 L27,23 L19.5,21.5 L18,29 L16.5,21.5 L9,23 L14.5,18.5 L9,14 L16.5,15.5 Z"
                fill="none"
                strokeWidth="0.8"
                className="stroke-gold/50"
              />
              <circle cx="18" cy="18" r="2" className="fill-gold/60" />
            </svg>
            <span className="absolute inset-0 -z-10 rounded-full bg-gold/25 blur-md opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
          </span>
          <span className="font-semibold">Midhkar</span>
        </Link>

        <div className="flex items-center gap-2 sm:gap-4">
          {/* Locale switcher — glass pill */}
          <div
            role="group"
            aria-label="Language"
            className="glass-soft flex items-center gap-0.5 rounded-full p-0.5"
          >
            {locales.map(({ code, label }) => (
              <button
                key={code}
                type="button"
                onClick={() => setLocale(code)}
                aria-pressed={locale === code}
                className={`cursor-pointer rounded-full px-2.5 py-1.5 text-[11px] font-semibold transition-all duration-300 sm:px-3 ${
                  locale === code
                    ? "bg-gold text-ink shadow-md shadow-gold/25"
                    : "text-parchment-muted hover:text-parchment"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="hidden h-5 w-px bg-gold/15 sm:block" />

          {/* CTA */}
          <Link
            ref={ctaRef}
            href="/create"
            className="btn-luxe group hidden cursor-pointer items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-4 py-2 text-sm font-semibold text-gold transition-all duration-300 hover:border-gold/70 hover:bg-gold/20 hover:shadow-lg hover:shadow-gold/15 sm:inline-flex"
          >
            <span className="relative">{t("nav.create") as string}</span>
            <svg
              className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13 7l5 5m0 0l-5 5m5-5H6"
              />
            </svg>
          </Link>
        </div>
      </div>
    </header>
  );
}
