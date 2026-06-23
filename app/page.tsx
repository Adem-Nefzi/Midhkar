"use client";

import { Features } from "@/components/Features";
import { QuranPreview } from "@/components/QuranPreview";
import { Footer } from "@/components/Footer";
import { I18nProvider } from "./lib/i18n";
import { Navbar } from "@/components/navbar";
import { Hero } from "@/components/hero";

export default function HomePage() {
  return (
    <I18nProvider>
      <main className="min-h-screen bg-ink text-parchment antialiased selection:bg-gold/30 selection:text-ink">
        <Navbar />
        <Hero />
        <Features />
        <QuranPreview />
        <Footer />
      </main>
    </I18nProvider>
  );
}
