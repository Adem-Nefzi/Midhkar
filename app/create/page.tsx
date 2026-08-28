"use client";
import dynamic from "next/dynamic";
import { I18nProvider } from "@/lib/i18n";

const VideoBuilder = dynamic(
  () =>
    import("@/components/VideoBuilder/VideoBuilder").then(
      (m) => m.VideoBuilder,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gold/30 border-t-gold" />
      </div>
    ),
  },
);

export default function CreatePage() {
  return (
    <I18nProvider>
      <main className="relative min-h-screen overflow-hidden bg-ink text-parchment antialiased">
        <VideoBuilder />
      </main>
    </I18nProvider>
  );
}
