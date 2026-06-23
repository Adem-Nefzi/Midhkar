"use client";
import { Navbar } from "@/components/navbar";
import { Hero } from "@/components/hero";
import { I18nProvider } from "@/lib/i18n";
import { Features } from "@/components/features";
import { Footer } from "@/components/footer";
import { QuranPreview } from "@/components/QuranPreview";

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
