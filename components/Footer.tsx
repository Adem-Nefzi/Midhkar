"use client";

import { useI18n } from "@/app/lib/i18n";
import Link from "next/link";

export function Footer() {
  const { t, locale } = useI18n();

  return (
    <footer className="relative border-t border-parchment/5 bg-ink">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="flex flex-col items-center text-center">
          {/* Logo */}
          <Link href="/" className="group flex items-center gap-2.5 mb-6">
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5 transition-transform duration-700 group-hover:rotate-180"
            >
              <path
                d="M12.00,1.50 L13.65,8.03 L19.42,4.58 L15.97,10.35 L22.50,12.00 L15.97,13.65 L19.42,19.42 L13.65,15.97 L12.00,22.50 L10.35,15.97 L4.58,19.42 L8.03,13.65 L1.50,12.00 L8.03,10.35 L4.58,4.58 L10.35,8.03 Z"
                fill="none"
                strokeWidth="1.1"
                className="stroke-gold"
              />
            </svg>
            <span className="font-display text-lg text-parchment">Midhkar</span>
          </Link>

          {/* Tagline */}
          <p className="text-parchment-muted/70 text-sm max-w-md mb-8">
            {t("footer.tagline") as string}
          </p>

          {/* Decorative line */}
          <div className="flex items-center gap-3 mb-8">
            <div className="h-px w-16 bg-gradient-to-r from-transparent to-gold/20" />
            <svg
              className="h-3 w-3 text-gold/30"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5Z" />
            </svg>
            <div className="h-px w-16 bg-gradient-to-l from-transparent to-gold/20" />
          </div>

          {/* Links */}
          <div className="flex flex-wrap items-center justify-center gap-6 mb-8 text-sm text-parchment-muted/50">
            <Link href="/" className="transition hover:text-gold/70">
              Home
            </Link>
            <Link href="/create" className="transition hover:text-gold/70">
              {locale === "ar" ? "إنشاء" : locale === "fr" ? "Créer" : "Create"}
            </Link>
          </div>

          {/* Copyright */}
          <p className="text-xs text-parchment-muted/30">
            &copy; {new Date().getFullYear()} Midhkar.{" "}
            {t("footer.rights") as string}
          </p>
        </div>
      </div>
    </footer>
  );
}
