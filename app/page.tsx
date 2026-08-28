import { HomeContent } from "@/components/Home/home-content";

const BASE_URL = "https://midhkar.vercel.app";

export default function HomePage() {
  return (
    <>
      {/* Hand-written hreflang: Next's metadata resolver strips query
          strings from alternate URLs whose pathname is "/". Rendered
          here (homepage only) — React 19 hoists links into <head>. */}
      <link rel="alternate" hrefLang="en" href={BASE_URL} />
      <link rel="alternate" hrefLang="ar" href={`${BASE_URL}/?lang=ar`} />
      <link rel="alternate" hrefLang="fr" href={`${BASE_URL}/?lang=fr`} />
      <link rel="alternate" hrefLang="x-default" href={BASE_URL} />
      <HomeContent />
    </>
  );
}
