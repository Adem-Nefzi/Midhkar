"use client";
import { useI18n } from "@/app/lib/i18n";
import { useEffect, useRef, useState } from "react";

export function Features() {
  const { t, locale } = useI18n();
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  const items = t("features.items") as { title: string; description: string }[];

  const icons = [
    <svg
      key="1"
      className="h-6 w-6"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
      />
    </svg>,
    <svg
      key="2"
      className="h-6 w-6"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M13 10V3L4 14h7v7l9-11h-7z"
      />
    </svg>,
    <svg
      key="3"
      className="h-6 w-6"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
      />
    </svg>,
  ];

  return (
    <section
      ref={ref}
      className="relative overflow-hidden border-t border-parchment/5 bg-ink-light/30 py-24 sm:py-32"
    >
      {/* Subtle pattern */}
      <div
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23d4af37' fill-opacity='1' fill-rule='evenodd'%3E%3Cpath d='M0 40L40 0H20L0 20M40 40V20L20 40'/%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />

      <div className="relative z-10 mx-auto max-w-6xl px-6">
        {/* Section header */}
        <div
          className={`text-center mb-16 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"} transition-all duration-700`}
        >
          <p className="text-xs uppercase tracking-[0.25em] text-gold/70 mb-4">
            {t("features.eyebrow") as string}
          </p>
          <h2 className="font-display text-3xl font-medium text-parchment sm:text-4xl md:text-5xl leading-tight">
            {locale === "ar" ? (
              <span
                style={{ fontFamily: "'Amiri', 'Scheherazade New', serif" }}
              >
                {t("features.title") as string}
              </span>
            ) : (
              (t("features.title") as string)
            )}
          </h2>
          <p className="mt-4 max-w-xl mx-auto text-parchment-muted leading-relaxed">
            {t("features.description") as string}
          </p>
        </div>

        {/* Feature cards */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item, i) => (
            <div
              key={i}
              className={`group relative rounded-2xl border border-parchment/5 bg-ink/50 p-8 transition-all duration-500 hover:border-gold/20 hover:bg-ink-light/50 hover:-translate-y-1 ${
                visible
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-8"
              }`}
              style={{ transitionDelay: `${200 + i * 150}ms` }}
            >
              {/* Decorative corner */}
              <div className="absolute top-0 right-0 h-16 w-16 overflow-hidden rounded-tr-2xl">
                <div className="absolute -top-8 -right-8 h-16 w-16 rotate-45 bg-gradient-to-bl from-gold/5 to-transparent" />
              </div>

              <div className="mb-5 inline-flex rounded-xl bg-gold/10 p-3 text-gold transition-colors group-hover:bg-gold/20">
                {icons[i]}
              </div>

              <h3 className="font-display text-lg font-medium text-parchment mb-3">
                {item.title}
              </h3>
              <p className="text-sm leading-relaxed text-parchment-muted/80">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
