import type { Metadata, Viewport } from "next";
import {
  Marcellus,
  Alegreya_Sans,
  Aref_Ruqaa,
  Amiri,
  Noto_Naskh_Arabic,
} from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { MotionProvider } from "@/components/MotionProvider";
import "./globals.css";

const marcellus = Marcellus({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-display",
  display: "swap",
});

const alegreya = Alegreya_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-sans",
  display: "swap",
});

const ruqaa = Aref_Ruqaa({
  subsets: ["arabic"],
  weight: ["400", "700"],
  variable: "--font-ruqaa",
  display: "swap",
});

const amiri = Amiri({
  subsets: ["arabic"],
  weight: ["400", "700"],
  variable: "--font-arabic",
  display: "swap",
});

const naskh = Noto_Naskh_Arabic({
  subsets: ["arabic"],
  weight: ["400", "700"],
  variable: "--font-naskh",
  display: "swap",
});

const BASE_URL = "https://midhkar.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: "Midhkar — Turn Quran Verses into Video",
    template: "%s | Midhkar",
  },
  description:
    "Pick a surah, a reciter, and a few verses. Midhkar turns them into a professional short video you can share anywhere — no editing skills, no cost, ever. Supports YouTube Shorts, Instagram Reels, TikTok, Facebook, and more.",
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
    "Quran YouTube Shorts",
    "free Quran video maker",
    "صانع فيديو قرآن",
    "فيديو قرآني",
    "générateur vidéo Coran",
  ],
  authors: [{ name: "Midhkar", url: BASE_URL }],
  creator: "Midhkar",
  publisher: "Midhkar",
  formatDetection: { email: false, address: false, telephone: false },
  openGraph: {
    type: "website",
    locale: "en_US",
    alternateLocale: ["ar_SA", "fr_FR"],
    url: BASE_URL,
    siteName: "Midhkar",
    title: "Midhkar — Turn Quran Verses into Video",
    description:
      "Pick a surah, a reciter, and a few verses. Midhkar turns them into a professional short video you can share anywhere.",
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
    title: "Midhkar — Turn Quran Verses into Video",
    description:
      "Pick a surah, a reciter, and a few verses. Midhkar turns them into a professional short video you can share anywhere.",
    images: [`${BASE_URL}/og-image.png`],
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
    apple: "/apple-touch-icon.png",
  },
  alternates: {
    canonical: BASE_URL,
  },
  verification: {
    // Add your Google Search Console token here when ready:
    // google: "YOUR_TOKEN",
  },
};

export const viewport: Viewport = {
  themeColor: "#121728",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Midhkar",
    url: BASE_URL,
    description:
      "Turn Quran verses into professional short videos. Pick a surah, a reciter, and verses — Midhkar handles the rest.",
    applicationCategory: "MultimediaApplication",
    operatingSystem: "Web",
    browserRequirements: "Requires Chrome, Edge, or Safari 18+",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    inLanguage: ["en", "ar", "fr"],
    audience: {
      "@type": "Audience",
      audienceType: "Muslims, Islamic content creators",
    },
  };

  return (
    <html
      lang="en"
      className={`${marcellus.variable} ${alegreya.variable} ${ruqaa.variable} ${amiri.variable} ${naskh.variable}`}
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="font-sans antialiased">
        <Analytics />
        <SpeedInsights />
        <MotionProvider>{children}</MotionProvider>
      </body>
    </html>
  );
}
