"use client";
import { LocaleSwitcher } from "@/components/Home/locale-switcher";
import { VideoBuilder } from "@/components/VideoBuilder/VideoBuilder";
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
