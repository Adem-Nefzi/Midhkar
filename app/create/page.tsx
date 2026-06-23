"use client";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Navbar } from "@/components/navbar";
import { VideoBuilder } from "@/components/VideoBuilder";
import { I18nProvider } from "@/lib/i18n";

export default function CreatePage() {
  return (
    <I18nProvider>
      <main className="min-h-screen bg-ink text-parchment antialiased selection:bg-gold/30 selection:text-ink">
        <LocaleSwitcher />
        <VideoBuilder />
      </main>
    </I18nProvider>
  );
}
