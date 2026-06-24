"use client";
import { Navbar } from "@/components/Home/navbar";
import { Hero } from "@/components/Home/hero";
import { I18nProvider } from "@/lib/i18n";
import { Features } from "@/components/Home/features";
import { Footer } from "@/components/Home/footer";
import { QuranPreview } from "@/components/Home/QuranPreview";

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
