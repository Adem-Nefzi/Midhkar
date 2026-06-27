import type { Metadata, Viewport } from "next";
import { Fraunces, Inter, Amiri } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-display",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

const amiri = Amiri({
  subsets: ["arabic"],
  weight: ["400", "700"],
  variable: "--font-arabic",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://midhkar.com"),
  title: {
    default: "Midhkar — Turn Quran Verses into Video",
    template: "%s | Midhkar",
  },
  description:
    "Pick a surah, a reciter, and a few verses. Midhkar turns them into a professional short video you can share anywhere — no editing skills, no cost, ever. Supports YouTube Shorts, Instagram Reels, TikTok, and more.",
  keywords: [
    "Quran video",
    "Islamic video maker",
    "Quran recitation video",
    "Surah video generator",
    "Quran shorts",
    "Islamic content creator",
    "Quran verses video",
    "Muslim video editor",
    "Quran Instagram Reel",
    "Quran TikTok",
  ],
  authors: [{ name: "Midhkar" }],
  creator: "Midhkar",
  publisher: "Midhkar",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    alternateLocale: ["ar_SA", "fr_FR"],
    url: "https://midhkar.com",
    siteName: "Midhkar",
    title: "Midhkar — Turn Quran Verses into Video",
    description:
      "Pick a surah, a reciter, and a few verses. Midhkar turns them into a professional short video you can share anywhere.",
  },
  twitter: {
    card: "summary",
    title: "Midhkar — Turn Quran Verses into Video",
    description:
      "Pick a surah, a reciter, and a few verses. Midhkar turns them into a professional short video you can share anywhere.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
  alternates: {
    canonical: "https://midhkar.com",
    languages: {
      en: "https://midhkar.com",
      ar: "https://midhkar.com?lang=ar",
      fr: "https://midhkar.com?lang=fr",
    },
  },
};

export const viewport: Viewport = {
  themeColor: "#0c0a09",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Midhkar",
    url: "https://midhkar.com",
    description:
      "Turn Quran verses into professional short videos. Pick a surah, a reciter, and verses — Midhkar handles the rest.",
    applicationCategory: "MultimediaApplication",
    operatingSystem: "Web",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    inLanguage: ["en", "ar", "fr"],
  };

  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${inter.variable} ${amiri.variable}`}
    >
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="font-sans antialiased">
        <Analytics />
        <SpeedInsights />
        {children}
      </body>
    </html>
  );
}
