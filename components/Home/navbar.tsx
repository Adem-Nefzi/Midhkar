"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { useEffect, useState } from "react";
import { m } from "motion/react";
import { ArrowIcon } from "@/components/VideoBuilder/icons";
import { GardenMark } from "@/components/Ornament/ornaments";

const locales: { code: "en" | "fr" | "ar"; label: string }[] = [
  { code: "en", label: "EN" },
  { code: "fr", label: "FR" },
  { code: "ar", label: "ع" },
];

export function Navbar() {
  const { locale, setLocale, t } = useI18n();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 border-b transition-all duration-500 ${
        scrolled
          ? "border-gold/20 bg-ink/95"
          : "border-gold/10 bg-ink/70"
      }`}
    >
      <div
        className={`absolute bottom-0 left-0 right-0 h-px transition-opacity duration-500 ${
          scrolled ? "light-band opacity-100" : "opacity-0"
        }`}
        aria-hidden="true"
      />

      <div className="relative z-10 mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3.5 sm:px-6 sm:py-4">
        <Link
          href="/"
          className="group flex items-center gap-2.5 font-display text-lg tracking-[0.08em] text-parchment transition-colors hover:text-gold-soft"
        >
          <span className="text-gold transition-transform duration-500 group-hover:rotate-[22.5deg]">
            <GardenMark className="h-7 w-7" />
          </span>
          <span>Midhkar</span>
        </Link>

        <div className="flex items-center gap-2 sm:gap-4">
          <div
            role="group"
            aria-label="Language"
            className="flex items-center gap-0.5 rounded-full border border-gold/15 bg-ink-soft/60 p-0.5"
          >
            {locales.map(({ code, label }) => (
              <button
                key={code}
                type="button"
                onClick={() => setLocale(code)}
                aria-pressed={locale === code}
                className={`relative cursor-pointer rounded-full px-2.5 py-1.5 text-[13px] font-semibold transition-colors duration-300 sm:px-3 ${
                  locale === code
                    ? "text-ink"
                    : "text-parchment-muted hover:text-parchment"
                }`}
              >
                {locale === code && (
                  <m.span
                    layoutId="locale-pill"
                    className="absolute inset-0 rounded-full bg-gold shadow-[0_4px_14px_-4px_rgb(var(--gold)/0.6)]"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  />
                )}
                <span className="relative">{label}</span>
              </button>
            ))}
          </div>

          <div className="hidden h-5 w-px bg-gold/15 sm:block" />

          <Link
            href="/create"
            className="btn-ghost group hidden px-4 py-2 text-sm sm:inline-flex"
          >
            {t("nav.create") as string}
            <ArrowIcon className="h-3.5 w-3.5 text-gold/70 transition-transform duration-300 group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
          </Link>
        </div>
      </div>
    </header>
  );
}
