"use client";

import { I18nProvider, useI18n } from "@/lib/i18n";
import { Bloom } from "@/components/Ornament/ornaments";

function LoadingContent() {
  const { t } = useI18n();

  return (
    <main className="garden-ground relative flex min-h-screen items-center justify-center overflow-hidden">
      <div
        className="garden-light left-1/2 top-1/2 h-[360px] w-[360px] -translate-x-1/2 -translate-y-1/2 animate-garden-breathe"
        aria-hidden="true"
      />

      <div className="relative z-10 flex flex-col items-center gap-6">
        <div className="animate-garden-breathe text-gold">
          <Bloom className="h-14 w-14" petals={8} />
        </div>

        <div className="flex items-center gap-2.5">
          <span
            className="h-1.5 w-1.5 animate-pulse rounded-full bg-gold"
            aria-hidden="true"
          />
          <span className="text-[13px] font-medium uppercase tracking-[0.25em] text-gold/80">
            {t("loading")}
          </span>
          <span
            className="h-1.5 w-1.5 animate-pulse rounded-full bg-gold"
            style={{ animationDelay: "0.2s" }}
            aria-hidden="true"
          />
        </div>
      </div>
    </main>
  );
}

export default function Loading() {
  return (
    <I18nProvider>
      <LoadingContent />
    </I18nProvider>
  );
}
