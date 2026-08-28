"use client";

import Link from "next/link";
import { I18nProvider, useI18n } from "@/lib/i18n";
import { Bloom, ScrollCorner } from "@/components/Ornament/ornaments";

function NotFoundContent() {
  const { t } = useI18n();

  return (
    <main className="garden-ground relative flex min-h-screen items-center justify-center overflow-hidden px-6">
      <ScrollCorner className="pointer-events-none absolute -right-4 -top-4 h-36 w-36 rotate-90 opacity-80" delay={0.15} />
      <ScrollCorner className="pointer-events-none absolute -bottom-4 -left-4 h-36 w-36 -rotate-90 opacity-80" delay={0.45} />
      <div
        className="garden-light left-1/2 top-1/2 h-[460px] w-[460px] -translate-x-1/2 -translate-y-1/2 opacity-70"
        aria-hidden="true"
      />

      <div className="relative z-10 text-center">
        <div className="mx-auto mb-8 flex justify-center text-gold/70">
          <Bloom className="h-16 w-16" petals={8} open={false} />
        </div>

        <h1 className="mb-4 font-display text-7xl font-bold tracking-tight text-gold sm:text-8xl">
          404
        </h1>

        <p className="mx-auto mb-8 max-w-md whitespace-pre-line text-sm leading-relaxed text-parchment-muted sm:text-base">
          {t("notFound.subtitle")}
        </p>

        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/" className="btn-primary px-8 py-3 text-sm">
            {t("notFound.returnHome")}
          </Link>
          <Link href="/create" className="btn-ghost px-8 py-3 text-sm">
            {t("notFound.createCta")}
          </Link>
        </div>

        <p
          className="mx-auto mt-12 max-w-sm text-[13px] text-parchment-dim"
          dir="rtl"
          lang="ar"
          translate="no"
          style={{ fontFamily: "'Amiri', serif" }}
        >
          وَعَلَّمَكَ مَا لَمْ تَكُنْ تَعْلَمُ ۚ وَكَانَ فَضْلُ اللَّهِ عَلَيْكَ عَظِيمًا
        </p>
        <p className="mt-1 text-[13px] text-parchment-dim">
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
