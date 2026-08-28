"use client";
import { useEffect, useRef } from "react";
import { Navbar } from "@/components/Home/navbar";
import { Hero } from "@/components/Home/hero";
import { I18nProvider, useI18n } from "@/lib/i18n";
import { How } from "@/components/Home/how";
import { Features } from "@/components/Home/features";
import { Footer } from "@/components/Home/footer";
import { QuranPreview } from "@/components/Home/QuranPreview";

/* A single gold thread at the very top of the page that fills as you
   scroll — position feedback, not decoration. Transform-only, rAF
   batched, no React state. Origin flips with the document direction. */
function ScrollThread() {
  const { dir } = useI18n();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const max =
        document.documentElement.scrollHeight - window.innerHeight;
      const p = max > 0 ? Math.min(1, window.scrollY / max) : 0;
      el.style.transform = `scaleX(${p.toFixed(4)})`;
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    schedule();
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      aria-hidden
      className="fixed inset-x-0 top-0 z-[70] h-[2px] bg-gold/[0.07]"
    >
      <div
        ref={ref}
        className="h-full w-full bg-gradient-to-r from-gold/40 via-gold to-gold/40 shadow-[0_0_8px_rgb(var(--gold)/0.5)]"
        style={{
          transform: "scaleX(0)",
          transformOrigin: dir === "rtl" ? "right" : "left",
        }}
      />
    </div>
  );
}

export function HomeContent() {
  return (
    <I18nProvider>
      <ScrollThread />
      <main className="min-h-screen bg-ink text-parchment antialiased">
        <Navbar />
        <Hero />
        <How />
        <Features />
        <QuranPreview />
        <Footer />
      </main>
    </I18nProvider>
  );
}
