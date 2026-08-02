"use client";

import Link from "next/link";
import { I18nProvider, useI18n } from "@/lib/i18n";

function NotFoundContent() {
  const { t } = useI18n();

  return (
    <main className="relative min-h-screen overflow-hidden bg-ink flex items-center justify-center px-6">
      {/* Girih tessellation background */}
      <div className="absolute inset-0 opacity-[0.06] pointer-events-none">
        <svg className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="girih-404" x="0" y="0" width="80" height="80" patternUnits="userSpaceOnUse">
              <path d="M40,6 L44,34 L74,26 L50,40 L74,66 L40,54 L6,66 L30,40 L6,26 L36,34 Z" fill="none" stroke="#d4af37" strokeWidth="0.5" />
              <path d="M40,28 L46,34 L46,46 L40,52 L34,46 L34,34 Z" fill="none" stroke="#d4af37" strokeWidth="0.3" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#girih-404)" />
        </svg>
      </div>

      {/* Ambient glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[400px] w-[400px] rounded-full bg-gold/[0.05] blur-[120px] pointer-events-none" />

      {/* Floating geometric star */}
      <div className="relative z-10 text-center">
        {/* Large rotating 8-point star */}
        <div className="relative mx-auto mb-8 h-32 w-32 animate-spin-slow">
          <svg viewBox="0 0 100 100" className="h-full w-full">
            <path
              d="M50,5 L58,30 L82,18 L70,42 L95,50 L70,58 L82,82 L58,70 L50,95 L42,70 L18,82 L30,58 L5,50 L30,42 L18,18 L42,30 Z"
              fill="none"
              stroke="#d4af37"
              strokeWidth="1"
              className="drop-shadow-[0_0_8px_rgba(212,175,55,0.3)]"
            />
            <circle cx="50" cy="50" r="15" fill="none" stroke="#d4af37" strokeWidth="0.5" opacity="0.4" />
            <circle cx="50" cy="50" r="25" fill="none" stroke="#d4af37" strokeWidth="0.3" opacity="0.3" />
            <circle cx="50" cy="50" r="35" fill="none" stroke="#d4af37" strokeWidth="0.2" opacity="0.2" />
          </svg>
        </div>

        {/* 404 number with gradient */}
        <h1 className="font-display text-7xl sm:text-8xl font-bold mb-2 bg-gradient-to-b from-gold via-gold-soft to-gold/40 bg-clip-text text-transparent">
          404
        </h1>

        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="h-px w-12 bg-gradient-to-r from-transparent to-gold/40" />
          <span className="text-gold/60 text-sm uppercase tracking-[0.3em]">
            {t("notFound.eyebrow")}
          </span>
          <div className="h-px w-12 bg-gradient-to-l from-transparent to-gold/40" />
        </div>

        <p className="text-parchment-muted text-sm sm:text-base max-w-md mx-auto mb-8 leading-relaxed whitespace-pre-line">
          {t("notFound.subtitle")}
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/"
            className="group relative overflow-hidden rounded-full bg-gold px-8 py-3 text-sm font-semibold text-ink transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-gold/20 btn-press"
          >
            <span className="absolute inset-0 -translate-x-full bg-parchment/30 transition-transform duration-700 group-hover:translate-x-full" />
            <span className="relative">{t("notFound.returnHome")}</span>
          </Link>
          <Link
            href="/create"
            className="rounded-full border border-gold/30 px-8 py-3 text-sm text-gold hover:bg-gold/10 transition-all btn-press"
          >
            {t("notFound.createCta")}
          </Link>
        </div>

        {/* Quranic ayah for comfort */}
        <p className="mt-12 text-parchment-muted/40 text-xs italic max-w-sm mx-auto" dir="rtl" translate="no">
          وَعَلَّمَكَ مَا لَمْ تَكُنْ تَعْلَمُ ۚ وَكَانَ فَضْلُ اللَّهِ عَلَيْكَ عَظِيمًا
        </p>
        <p className="mt-1 text-parchment-muted/30 text-[10px]">
          {t("notFound.reference")}
        </p>
      </div>
    </main>
  );
}

export default function NotFound() {
  return (
    <I18nProvider>
      <NotFoundContent />
    </I18nProvider>
  );
}
