"use client";

import Link from "next/link";
import {
  SignedIn,
  SignedOut,
  SignInButton,
  SignUpButton,
  UserButton,
} from "@clerk/nextjs";
import { useI18n } from "@/lib/i18n";

const locales: { code: "en" | "fr" | "ar"; label: string }[] = [
  { code: "en", label: "EN" },
  { code: "fr", label: "FR" },
  { code: "ar", label: "ع" },
];

export function Navbar() {
  const { locale, setLocale, t } = useI18n();

  return (
    <header className="relative z-50 overflow-hidden border-b border-gold/15 backdrop-blur-xl bg-ink/70">
      {/* Subtle top gold accent line */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-gold/30 to-transparent" />

      {/* Ambient glow behind navbar */}
      <div className="absolute left-1/2 top-0 h-20 w-96 -translate-x-1/2 bg-gold/[0.03] blur-[60px]" />

      {/* Subtle geometric pattern */}
      <div className="absolute inset-0 opacity-[0.02]">
        <svg className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern
              id="nav-girih"
              x="0"
              y="0"
              width="40"
              height="40"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M20,0 L22,18 L40,20 L22,22 L20,40 L18,22 L0,20 L18,18 Z"
                fill="none"
                stroke="#d4af37"
                strokeWidth="0.3"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#nav-girih)" />
        </svg>
      </div>

      <div className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        {/* Logo */}
        <Link
          href="/"
          className="group flex items-center gap-3 font-display text-lg tracking-tight text-parchment transition-colors hover:text-gold"
        >
          <div className="relative">
            <svg
              viewBox="0 0 36 36"
              className="h-7 w-7 transition-transform duration-700 group-hover:rotate-180"
            >
              {/* Outer 8-point star */}
              <path
                d="M18,2 L21,15 L34,12 L24,18 L34,24 L21,21 L18,34 L15,21 L2,24 L12,18 L2,12 L15,15 Z"
                fill="none"
                strokeWidth="1.2"
                className="stroke-gold"
              />
              {/* Inner 8-point star */}
              <path
                d="M18,8 L19.5,15.5 L27,14 L21.5,18.5 L27,23 L19.5,21.5 L18,29 L16.5,21.5 L9,23 L14.5,18.5 L9,14 L16.5,15.5 Z"
                fill="none"
                strokeWidth="0.8"
                className="stroke-gold/50"
              />
              {/* Center dot */}
              <circle cx="18" cy="18" r="2" className="fill-gold/60" />
            </svg>
            {/* Subtle glow behind logo */}
            <div className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold/10 blur-lg opacity-0 transition-opacity group-hover:opacity-100" />
          </div>
          <span className="font-semibold">Midhkar</span>
        </Link>

        <div className="flex items-center gap-4">
          {/* Locale Switcher — pill style */}
          <div className="flex items-center gap-1 rounded-full border border-gold/20 bg-ink-light/50 p-1 backdrop-blur-sm">
            {locales.map(({ code, label }) => (
              <button
                key={code}
                type="button"
                onClick={() => setLocale(code)}
                aria-pressed={locale === code}
                className={`cursor-pointer rounded-full px-3 py-1.5 text-xs font-semibold transition-all duration-300 ${
                  locale === code
                    ? "bg-gold text-ink shadow-md shadow-gold/20"
                    : "text-parchment-muted hover:text-parchment hover:bg-gold/5"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="h-6 w-px bg-gold/15" />

          <SignedOut>
            <SignInButton mode="modal">
              <button className="cursor-pointer rounded-full px-4 py-2 text-sm text-parchment-muted transition hover:text-parchment">
                {t("nav.signIn") as string}
              </button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button className="group relative cursor-pointer overflow-hidden rounded-full border-2 border-gold/40 bg-gold/15 px-5 py-2 text-sm font-semibold text-gold transition-all hover:bg-gold/25 hover:border-gold/60 hover:shadow-lg hover:shadow-gold/10">
                <span className="absolute inset-0 -translate-x-full bg-parchment/20 transition-transform duration-500 group-hover:translate-x-full" />
                <span className="relative">
                  {t("nav.getStarted") as string}
                </span>
              </button>
            </SignUpButton>
          </SignedOut>

          <SignedIn>
            <Link
              href="/create"
              className="group relative hidden sm:inline-flex cursor-pointer items-center overflow-hidden rounded-full border-2 border-gold/40 bg-gold/15 px-5 py-2 text-sm font-semibold text-gold transition-all hover:bg-gold/25 hover:border-gold/60 hover:shadow-lg hover:shadow-gold/10"
            >
              <span className="absolute inset-0 -translate-x-full bg-parchment/20 transition-transform duration-500 group-hover:translate-x-full" />
              <span className="relative">{t("nav.create") as string}</span>
            </Link>
            <UserButton afterSignOutUrl="/" />
          </SignedIn>
        </div>
      </div>
    </header>
  );
}
