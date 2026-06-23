"use client";

import Link from "next/link";
import {
  SignedIn,
  SignedOut,
  SignInButton,
  SignUpButton,
  UserButton,
} from "@clerk/nextjs";
import { useState, useRef, useEffect } from "react";
import { Locale, useI18n } from "@/app/lib/i18n";

const languages: { code: Locale; label: string; flag: string }[] = [
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "fr", label: "Français", flag: "🇫🇷" },
  { code: "ar", label: "العربية", flag: "🇸🇦" },
];

export function Navbar() {
  const { locale, setLocale, t, dir } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const currentLang = languages.find((l) => l.code === locale) || languages[0];

  return (
    <header className="relative z-50 border-b border-parchment/10 backdrop-blur-md bg-ink/80">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link
          href="/"
          className="group flex items-center gap-2.5 font-display text-lg tracking-tight text-parchment transition-colors hover:text-gold"
        >
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
          <span className="font-semibold">Midhkar</span>
        </Link>

        <div className="flex items-center gap-3">
          {/* Language Switcher */}
          <div className="relative" ref={ref}>
            <button
              onClick={() => setOpen(!open)}
              className="flex items-center gap-2 rounded-full border border-parchment/15 px-3 py-1.5 text-sm text-parchment-muted transition hover:border-gold/40 hover:text-parchment"
              aria-label="Change language"
            >
              <span className="text-base">{currentLang.flag}</span>
              <span className="hidden sm:inline">{currentLang.label}</span>
              <svg
                className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>

            {open && (
              <div className="absolute right-0 mt-2 w-40 overflow-hidden rounded-xl border border-parchment/10 bg-ink-light shadow-2xl shadow-black/50">
                {languages.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => {
                      setLocale(lang.code);
                      setOpen(false);
                    }}
                    className={`flex w-full items-center gap-2.5 px-4 py-2.5 text-sm transition hover:bg-parchment/5 ${
                      locale === lang.code
                        ? "text-gold"
                        : "text-parchment-muted"
                    }`}
                  >
                    <span className="text-base">{lang.flag}</span>
                    <span>{lang.label}</span>
                    {locale === lang.code && (
                      <svg
                        className="ml-auto h-4 w-4 text-gold"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="h-5 w-px bg-parchment/10" />

          <SignedOut>
            <SignInButton mode="modal">
              <button className="cursor-pointer rounded-full px-4 py-2 text-sm text-parchment-muted transition hover:text-parchment">
                {t("nav.signIn") as string}
              </button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button className="cursor-pointer rounded-full bg-gold px-4 py-2 text-sm font-medium text-ink transition hover:bg-gold-soft hover:shadow-lg hover:shadow-gold/20">
                {t("nav.getStarted") as string}
              </button>
            </SignUpButton>
          </SignedOut>

          <SignedIn>
            <Link
              href="/create"
              className="hidden sm:inline-flex cursor-pointer items-center rounded-full bg-gold px-4 py-2 text-sm font-medium text-ink transition hover:bg-gold-soft hover:shadow-lg hover:shadow-gold/20"
            >
              {t("nav.create") as string}
            </Link>
            <UserButton afterSignOutUrl="/" />
          </SignedIn>
        </div>
      </div>
    </header>
  );
}
