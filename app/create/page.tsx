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
      <main className="relative min-h-screen bg-ink text-parchment antialiased selection:bg-gold/30 selection:text-ink overflow-hidden">
        {/* Girih tessellation background */}
        <div className="absolute inset-0 opacity-[0.08] pointer-events-none">
          <svg className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern
                id="girih-create"
                x="0"
                y="0"
                width="80"
                height="80"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M40,6 L44,34 L74,26 L50,40 L74,66 L40,54 L6,66 L30,40 L6,26 L36,34 Z"
                  fill="none"
                  stroke="#d4af37"
                  strokeWidth="0.5"
                />
                <path
                  d="M40,0 L40,6 M40,54 L40,80 M0,40 L6,40 M74,40 L80,40"
                  stroke="#d4af37"
                  strokeWidth="0.25"
                />
                <path
                  d="M24,24 L56,56 M56,24 L24,56"
                  stroke="#d4af37"
                  strokeWidth="0.2"
                />
                <path
                  d="M40,28 L46,34 L46,46 L40,52 L34,46 L34,34 Z"
                  fill="none"
                  stroke="#d4af37"
                  strokeWidth="0.25"
                />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#girih-create)" />
          </svg>
        </div>

        {/* Manuscript grid overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `
              linear-gradient(to right, rgba(212,175,55,0.05) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(212,175,55,0.05) 1px, transparent 1px)
            `,
            backgroundSize: "60px 60px",
          }}
        />

        {/* Corner medallions */}
        <div className="absolute -top-6 -left-6 h-[200px] w-[200px] opacity-70 pointer-events-none">
          <QuarterMedallion />
        </div>
        <div className="absolute -top-6 -right-6 h-[200px] w-[200px] opacity-70 pointer-events-none rotate-90">
          <QuarterMedallion />
        </div>
        <div className="absolute -bottom-6 -left-6 h-[200px] w-[200px] opacity-70 pointer-events-none -rotate-90">
          <QuarterMedallion />
        </div>
        <div className="absolute -bottom-6 -right-6 h-[200px] w-[200px] opacity-70 pointer-events-none rotate-180">
          <QuarterMedallion />
        </div>

        {/* Arabesque border frame */}
        <div className="absolute inset-4 sm:inset-6 pointer-events-none">
          <div className="absolute inset-0 border border-gold/20" />
          <div className="absolute inset-1 border border-gold/10" />
          <CornerOrnament position="top-left" />
          <CornerOrnament position="top-right" />
          <CornerOrnament position="bottom-left" />
          <CornerOrnament position="bottom-right" />
        </div>

        {/* Floating ambient orbs */}
        <div className="absolute top-[10%] left-[5%] h-[350px] w-[350px] animate-float-1 rounded-full bg-gold/[0.05] blur-[100px] pointer-events-none" />
        <div className="absolute bottom-[15%] right-[8%] h-[300px] w-[300px] animate-float-2 rounded-full bg-gold/[0.04] blur-[80px] pointer-events-none" />
        <div className="absolute top-[60%] left-[60%] h-[250px] w-[250px] animate-float-3 rounded-full bg-verdant/[0.03] blur-[70px] pointer-events-none" />

        {/* Horizontal light rays */}
        <div className="absolute top-[20%] left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold/[0.1] to-transparent pointer-events-none" />
        <div className="absolute top-[50%] left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold/[0.07] to-transparent pointer-events-none" />
        <div className="absolute top-[80%] left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold/[0.1] to-transparent pointer-events-none" />

        {/* Vignette */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at center, transparent 0%, transparent 30%, rgba(12,10,9,0.3) 100%)",
          }}
        />

        <VideoBuilder />
      </main>
    </I18nProvider>
  );
}

/* ── Corner ornament ──────────────────────────────────────────── */
function CornerOrnament({
  position,
}: {
  position: "top-left" | "top-right" | "bottom-left" | "bottom-right";
}) {
  const posClasses = {
    "top-left": "-top-2 -left-2",
    "top-right": "-top-2 -right-2",
    "bottom-left": "-bottom-2 -left-2",
    "bottom-right": "-bottom-2 -right-2",
  };
  const rotateClasses = {
    "top-left": "",
    "top-right": "rotate-90",
    "bottom-left": "-rotate-90",
    "bottom-right": "rotate-180",
  };
  return (
    <div className={`absolute ${posClasses[position]}`}>
      <svg
        viewBox="0 0 40 40"
        className={`h-8 w-8 ${rotateClasses[position]}`}
      >
        <path
          d="M20,3 L22,16 L36,12 L24,20 L36,28 L22,24 L20,37 L18,24 L4,28 L16,20 L4,12 L18,16 Z"
          fill="none"
          strokeWidth="0.8"
          className="stroke-gold/30"
        />
        <circle cx="20" cy="20" r="2.5" fill="none" strokeWidth="0.6" className="stroke-gold/25" />
        <circle cx="20" cy="20" r="1" className="fill-gold/20" />
      </svg>
    </div>
  );
}

/* ── Quarter medallion ────────────────────────────────────────── */
function QuarterMedallion() {
  return (
    <svg viewBox="0 0 200 200" className="h-full w-full">
      <path
        d="M200,0 A200,200 0 0,0 0,200"
        fill="none"
        strokeWidth="0.8"
        className="stroke-gold/15"
      />
      <path
        d="M170,0 A170,170 0 0,0 0,170"
        fill="none"
        strokeWidth="0.5"
        className="stroke-gold/10"
      />
      {[...Array(8)].map((_, i) => {
        const angle = (i * 22.5 * Math.PI) / 180;
        const x = 200 - Math.cos(angle) * 200;
        const y = 200 - Math.sin(angle) * 200;
        return (
          <line
            key={i}
            x1="200"
            y1="200"
            x2={x}
            y2={y}
            strokeWidth="0.2"
            className="stroke-gold/8"
          />
        );
      })}
      <path
        d="M200,50 L175,90 L200,130 L165,120 L150,155 L140,120 L105,130 L130,90 L105,50 L140,60 L150,25 L165,60 Z"
        fill="none"
        strokeWidth="0.5"
        className="stroke-gold/15"
      />
    </svg>
  );
}
