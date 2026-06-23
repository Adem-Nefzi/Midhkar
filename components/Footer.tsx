"use client";

import { useI18n } from "@/lib/i18n";
import Link from "next/link";

export function Footer() {
  const { t, locale } = useI18n();
  return (
    <footer className="relative overflow-hidden border-t-2 border-gold/15 bg-ink">
      {/* Subtle geometric pattern */}
      <div className="absolute inset-0 opacity-[0.02]">
        <svg className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern
              id="footer-pattern"
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
                strokeWidth="0.3"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#footer-pattern)" />
        </svg>
      </div>

      {/* Top gold accent line */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 h-px w-1/2 bg-gradient-to-r from-transparent via-gold/30 to-transparent" />

      <div className="relative z-10 mx-auto max-w-6xl px-6 py-16">
        {/* Main footer content */}
        <div className="flex flex-col items-center text-center">
          {/* Logo with glow */}
          <Link href="/" className="group flex items-center gap-3 mb-8">
            <svg
              viewBox="0 0 32 32"
              className="h-7 w-7 transition-transform duration-700 group-hover:rotate-180"
            >
              <path
                d="M16,2 L18.5,12.5 L29,10 L21,16 L29,22 L18.5,19.5 L16,30 L13.5,19.5 L3,22 L11,16 L3,10 L13.5,12.5 Z"
                fill="none"
                strokeWidth="1.2"
                className="stroke-gold"
              />
              <circle cx="16" cy="16" r="2.5" className="fill-gold/40" />
            </svg>
            <span className="font-display text-xl text-parchment font-semibold tracking-tight">
              Midhkar
            </span>
          </Link>

          {/* Tagline with ornament */}
          <div className="flex items-center justify-center gap-4 mb-6">
            <div className="h-px w-12 bg-gradient-to-r from-transparent to-gold/30" />
            <svg
              className="h-4 w-4 text-gold/40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
            >
              <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5Z" />
            </svg>
            <div className="h-px w-12 bg-gradient-to-l from-transparent to-gold/30" />
          </div>

          <p className="text-parchment-muted/80 text-base max-w-md mb-8 leading-relaxed">
            {t("footer.tagline") as string}
          </p>
          {/* Decorative divider */}
          <div className="flex items-center gap-3 mb-8">
            <div className="h-px w-20 bg-gradient-to-r from-transparent to-gold/20" />
            <svg
              className="h-3 w-3 text-gold/30"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5Z" />
            </svg>
            <div className="h-px w-20 bg-gradient-to-l from-transparent to-gold/20" />
          </div>

          {/* Copyright */}
          <p className="text-xs text-parchment-muted/40 tracking-wide">
            &copy; {new Date().getFullYear()} Midhkar.{" "}
            {t("footer.rights") as string}
          </p>
        </div>
      </div>
    </footer>
  );
}
