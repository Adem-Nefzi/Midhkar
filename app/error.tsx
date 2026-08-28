"use client";

import { useEffect } from "react";
import Link from "next/link";
import { I18nProvider, useI18n } from "@/lib/i18n";
import { Bloom, ScrollCorner } from "@/components/Ornament/ornaments";

function ErrorContent({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useI18n();

  useEffect(() => {
    console.error("[midhkar] app error:", error);
  }, [error]);

  return (
    <main className="garden-ground relative flex min-h-screen items-center justify-center overflow-hidden px-6">
      <ScrollCorner className="pointer-events-none absolute -left-4 -top-4 h-36 w-36 opacity-80" />
      <ScrollCorner className="pointer-events-none absolute -bottom-4 -right-4 h-36 w-36 rotate-180 opacity-80" delay={0.3} />
      <div
        className="garden-light left-1/2 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 opacity-60"
        aria-hidden="true"
      />

      <div className="relative z-10 text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center">
          <Bloom className="h-14 w-14" petals={8} />
        </div>

        <h1 className="mb-3 font-display text-3xl font-medium text-parchment sm:text-4xl">
          {t("error.title")}
        </h1>

        <p className="mx-auto mb-6 max-w-md text-sm leading-relaxed text-parchment-muted">
          {t("error.body")}
        </p>

        <details className="mx-auto mb-6 max-w-md">
          <summary className="cursor-pointer text-center text-[13px] text-parchment-dim transition hover:text-gold/80">
            {t("error.details")}
          </summary>
          <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-xl border border-gold/15 bg-ink-soft/60 p-3 text-left text-[13px] text-red-400/80">
            {error.message || "Unknown error"}
            {error.digest ? `\nDigest: ${error.digest}` : ""}
          </pre>
        </details>

        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
          <button onClick={reset} className="btn-primary px-8 py-3 text-sm">
            {t("error.tryAgain")}
          </button>
          <Link href="/" className="btn-ghost px-8 py-3 text-sm">
            {t("error.returnHome")}
          </Link>
        </div>

        <p
          className="mt-10 text-[13px] text-parchment-dim"
          dir="rtl"
          lang="ar"
          translate="no"
          style={{ fontFamily: "'Amiri', serif" }}
        >
          إِنَّا لِلَّهِ وَإِنَّا إِلَيْهِ رَاجِعُونَ
        </p>
      </div>
    </main>
  );
}

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <I18nProvider>
      <ErrorContent error={error} reset={reset} />
    </I18nProvider>
  );
}
