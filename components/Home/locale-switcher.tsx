"use client";

import { useI18n, type Locale } from "@/lib/i18n";

const locales: { code: Locale; label: string }[] = [
  { code: "en", label: "EN" },
  { code: "fr", label: "FR" },
  { code: "ar", label: "ع" },
];

export function LocaleSwitcher() {
  const { locale, setLocale } = useI18n();

  return (
    <div className="flex items-center gap-1 rounded-full border border-parchment/15 p-1">
      {locales.map(({ code, label }) => (
        <button
          key={code}
          type="button"
          onClick={() => setLocale(code)}
          aria-pressed={locale === code}
          className={`cursor-pointer rounded-full px-2.5 py-1 text-xs font-medium transition ${
            locale === code
              ? "bg-gold text-ink"
              : "text-parchment-muted hover:text-parchment"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
