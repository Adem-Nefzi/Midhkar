"use client";

import { useI18n } from "@/lib/i18n";
import Link from "next/link";

export function Footer() {
  const { t, locale } = useI18n();
  return (
    <footer className="relative overflow-hidden border-t border-gold/10 bg-ink">
      {/* Ambient top glow */}
      <div className="absolute top-0 left-1/2 h-px w-2/3 -translate-x-1/2 bg-gradient-to-r from-transparent via-gold/40 to-transparent" />
      <div className="absolute left-1/2 top-0 h-32 w-[40rem] -translate-x-1/2 bg-gold/[0.04] blur-[60px] pointer-events-none" />

      {/* Bismillah marquee */}
      <div
        className="relative overflow-hidden border-b border-gold/8 py-5 [mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]"
        aria-hidden="true"
        dir="rtl"
      >
        <div className="marquee gap-10 [--marquee-duration:40s]">
          {Array.from({ length: 2 }).map((_, dup) => (
            <div key={dup} className="flex shrink-0 items-center gap-10">
              {Array.from({ length: 6 }).map((_, i) => (
                <span key={i} className="flex shrink-0 items-center gap-10">
                  <span
                    className="font-arabic text-lg text-gold/35 whitespace-nowrap"
                    style={{ fontFamily: "'Amiri', serif" }}
                  >
                    بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
                  </span>
                  <svg
                    className="h-3 w-3 text-gold/25"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5Z" />
                  </svg>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-6 py-14">
        <div className="flex flex-col items-center text-center">
          {/* Logo */}
          <Link href="/" className="group flex items-center gap-3">
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
              <circle cx="16" cy="16" r="2.5" className="fill-gold/50" />
            </svg>
            <span className="font-display text-xl font-semibold tracking-tight text-parchment transition-colors group-hover:text-gold-soft">
              Midhkar
            </span>
          </Link>

          <p className="mt-6 max-w-md text-[15px] leading-relaxed text-parchment-muted/75">
            {t("footer.tagline") as string}
          </p>

          {/* Divider */}
          <div className="mt-8 flex items-center gap-3">
            <div className="h-px w-20 bg-gradient-to-r from-transparent to-gold/25" />
            <svg
              className="h-3 w-3 text-gold/40"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5Z" />
            </svg>
            <div className="h-px w-20 bg-gradient-to-l from-transparent to-gold/25" />
          </div>

          {/* Colophon */}
          <p className="mt-8 text-xs tracking-wide text-parchment-muted/45">
            &copy; {new Date().getFullYear()} Midhkar.{" "}
            {t("footer.rights") as string}
          </p>
        </div>
      </div>
    </footer>
  );
}
