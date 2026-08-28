import type { Metadata } from "next";

const BASE_URL = "https://midhkar.vercel.app";

export const metadata: Metadata = {
  title: "Quran Video Studio — Create Your Video",
  description:
    "Choose a surah, a reciter, and verses — then generate a professional Quran video with synchronized recitation, translations, and elegant backgrounds. Free, in your browser, no editing skills needed.",
  keywords: [
    "create Quran video",
    "Quran video generator",
    "surah video maker",
    "Quran recitation video",
    "Islamic video creator",
    "Quran Shorts maker",
  ],
  alternates: {
    canonical: `${BASE_URL}/create`,
    languages: {
      en: `${BASE_URL}/create`,
      ar: `${BASE_URL}/create?lang=ar`,
      fr: `${BASE_URL}/create?lang=fr`,
    },
  },
  openGraph: {
    type: "website",
    url: `${BASE_URL}/create`,
    siteName: "Midhkar",
    title: "Midhkar — Quran Video Studio",
    description:
      "Choose a surah, a reciter, and verses — Midhkar generates a professional Quran video with synchronized recitation. Free, right in your browser.",
    images: [
      {
        url: `${BASE_URL}/og-image.png`,
        width: 1200,
        height: 630,
        alt: "Midhkar — Quran Video Studio",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Midhkar — Quran Video Studio",
    description:
      "Choose a surah, a reciter, and verses — Midhkar generates a professional Quran video with synchronized recitation. Free, right in your browser.",
    images: [`${BASE_URL}/og-image.png`],
  },
  robots: { index: true, follow: true },
};

export default function CreateLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
