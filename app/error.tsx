"use client";

import { useEffect } from "react";
import Link from "next/link";
import { I18nProvider, useI18n } from "@/lib/i18n";

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
    <main className="relative min-h-screen overflow-hidden bg-ink flex items-center justify-center px-6">
      {/* Girih background */}
      <div className="absolute inset-0 opacity-[0.05] pointer-events-none">
        <svg className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="girih-err" x="0" y="0" width="80" height="80" patternUnits="userSpaceOnUse">
              <path d="M40,6 L44,34 L74,26 L50,40 L74,66 L40,54 L6,66 L30,40 L6,26 L36,34 Z" fill="none" stroke="#d4af37" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#girih-err)" />
        </svg>
      </div>

      {/* Pulsing ambient glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[350px] w-[350px] rounded-full bg-red-500/[0.04] blur-[100px] pointer-events-none animate-pulse" />

      <div className="relative z-10 text-center">
        {/* Broken star icon */}
        <div className="mx-auto mb-6 h-20 w-20">
          <svg viewBox="0 0 100 100" className="h-full w-full">
            <path
              d="M50,10 L60,35 L85,30 L65,50 L85,70 L60,65 L50,90 L40,65 L15,70 L35,50 L15,30 L40,35 Z"
              fill="none"
              stroke="#d4af37"
              strokeWidth="1.5"
              strokeDasharray="4 2"
              className="opacity-60"
            />
            <path d="M50,10 L50,50 M50,50 L85,30 M50,50 L85,70 M50,50 L50,90 M50,50 L15,70 M50,50 L15,30" stroke="#d4af37" strokeWidth="0.5" opacity="0.2" />
          </svg>
        </div>

        <div className="flex items-center justify-center gap-3 mb-3">
          <div className="h-px w-8 bg-gradient-to-r from-transparent to-gold/40" />
          <span className="text-gold/50 text-xs uppercase tracking-[0.3em]">{t("error.eyebrow")}</span>
          <div className="h-px w-8 bg-gradient-to-l from-transparent to-gold/40" />
        </div>

        <h1 className="font-display text-3xl sm:text-4xl font-medium text-parchment mb-3">
          {t("error.title")}
        </h1>

        <p className="text-parchment-muted text-sm max-w-md mx-auto mb-6 leading-relaxed">
          {t("error.body")}
        </p>

        {/* Error details (collapsed) */}
        <details className="mb-6 max-w-md mx-auto">
          <summary className="cursor-pointer text-xs text-parchment-muted/40 hover:text-gold/60 transition text-center">
            {t("error.details")}
          </summary>
          <pre className="mt-2 rounded-lg border border-gold/10 bg-ink-light/40 p-3 text-[10px] text-red-400/60 text-left overflow-x-auto whitespace-pre-wrap">
            {error.message || "Unknown error"}
            {error.digest ? `\nDigest: ${error.digest}` : ""}
          </pre>
        </details>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={reset}
            className="group relative overflow-hidden rounded-full bg-gold px-8 py-3 text-sm font-semibold text-ink transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-gold/20 btn-press"
          >
            <span className="absolute inset-0 -translate-x-full bg-parchment/30 transition-transform duration-700 group-hover:translate-x-full" />
            <span className="relative">{t("error.tryAgain")}</span>
          </button>
          <Link
            href="/"
            className="rounded-full border border-gold/30 px-8 py-3 text-sm text-gold hover:bg-gold/10 transition-all btn-press"
          >
            {t("error.returnHome")}
          </Link>
        </div>

        <p className="mt-10 text-parchment-muted/30 text-xs italic" dir="rtl" translate="no">
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
