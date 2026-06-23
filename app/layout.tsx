import type { Metadata } from "next";
import { Fraunces, Inter, Amiri } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
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
  title: "Midhkar — Turn verses into video",
  description:
    "Pick a surah, a reciter, and a few verses. Midhkar turns them into a short video you can share anywhere — no editing skills, no cost, ever",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      appearance={{
        baseTheme: dark,
        variables: {
          colorPrimary: "#c49f4f",
          colorBackground: "#0d100f",
          colorInputBackground: "#141a18",
          colorText: "#f0ece3",
          colorTextSecondary: "#9e9c8e",
          borderRadius: "0.75rem",
        },
      }}
    >
      <html
        lang="en"
        className={`${fraunces.variable} ${inter.variable} ${amiri.variable}`}
      >
        <body className="font-sans antialiased">{children}</body>
      </html>
    </ClerkProvider>
  );
}
