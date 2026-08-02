"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { useEffect, useRef, useState, useCallback } from "react";
import { usePointerVars } from "@/components/Reveal";

export function Hero() {
  const { t, dir, locale } = useI18n();
  const verse = t("hero.verse");
  const hasVerse = typeof verse === "string" && verse !== "hero.verse";
  const containerRef = useRef<HTMLElement>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);
  const ctaRef = usePointerVars<HTMLAnchorElement>();

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setMousePos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener("mousemove", handleMouseMove);
    return () => el.removeEventListener("mousemove", handleMouseMove);
  }, [handleMouseMove]);

  return (
    <section
      ref={containerRef}
      className="noise relative overflow-hidden"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {/* Aurora beams — modern luxe drift (behind everything else) */}
      <div className="absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
        <div
          className="aurora-beam animate-aurora-drift left-[-10%] top-[-20%] h-[60vmax] w-[60vmax] rounded-full"
          style={{
            background:
              "radial-gradient(circle at 40% 40%, rgba(212,175,55,0.10), transparent 60%)",
          }}
        />
        <div
          className="aurora-beam animate-aurora-drift right-[-15%] top-[10%] h-[55vmax] w-[55vmax] rounded-full"
          style={{
            background:
              "radial-gradient(circle at 60% 50%, rgba(95,141,110,0.08), transparent 60%)",
            animationDelay: "-6s",
            animationDuration: "22s",
          }}
        />
        <div
          className="aurora-beam animate-aurora-drift left-[20%] bottom-[-25%] h-[50vmax] w-[50vmax] rounded-full"
          style={{
            background:
              "radial-gradient(circle at 50% 50%, rgba(212,175,55,0.06), transparent 60%)",
            animationDelay: "-12s",
            animationDuration: "26s",
          }}
        />
      </div>
      {/* ============================================================
          BASE BACKGROUND
      ============================================================ */}
      <div className="absolute inset-0 bg-ink" />

      {/* ============================================================
          CENTRAL SHAMSAH — Large sunburst medallion
          Like opening a Qur'an to a carpet page
      ============================================================ */}
      <div className="absolute left-1/2 top-1/2 h-[400px] w-[400px] sm:h-[600px] sm:w-[600px] lg:h-[900px] lg:w-[900px] -translate-x-1/2 -translate-y-1/2">
        <div className="absolute inset-0 animate-shamsah-pulse rounded-full bg-gradient-radial from-gold/[0.06] via-gold/[0.02] to-transparent" />
        <div className="absolute left-1/2 top-1/2 h-[200px] w-[200px] sm:h-[300px] sm:w-[300px] lg:h-[400px] lg:w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold/[0.04] blur-[80px]" />
      </div>

      {/* ============================================================
          CORNER QUARTER-MEDALLIONS
          Like the four corners of a Qur'an carpet page
      ============================================================ */}
      <div className="absolute -top-10 -left-10 h-[180px] w-[180px] sm:h-[250px] sm:w-[250px] lg:h-[350px] lg:w-[350px] opacity-60">
        <QuarterMedallion />
      </div>
      <div className="absolute -top-10 -right-10 h-[180px] w-[180px] sm:h-[250px] sm:w-[250px] lg:h-[350px] lg:w-[350px] opacity-60 rotate-90">
        <QuarterMedallion />
      </div>
      <div className="absolute -bottom-10 -left-10 h-[180px] w-[180px] sm:h-[250px] sm:w-[250px] lg:h-[350px] lg:w-[350px] opacity-60 -rotate-90">
        <QuarterMedallion />
      </div>
      <div className="absolute -bottom-10 -right-10 h-[180px] w-[180px] sm:h-[250px] sm:w-[250px] lg:h-[350px] lg:w-[350px] opacity-60 rotate-180">
        <QuarterMedallion />
      </div>

      {/* ============================================================
          ARABESQUE BORDER FRAME — Much more prominent
      ============================================================ */}
      <div className="absolute inset-6 sm:inset-10 md:inset-14 pointer-events-none">
        {/* Triple border like a Qur'an frame */}
        <div className="absolute inset-0 border-2 border-gold/20" />
        <div className="absolute inset-2 border border-gold/10" />
        <div className="absolute inset-3 border border-gold/5" />

        {/* Large corner ornaments */}
        <CornerOrnamentLarge position="top-left" />
        <CornerOrnamentLarge position="top-right" />
        <CornerOrnamentLarge position="bottom-left" />
        <CornerOrnamentLarge position="bottom-right" />

        {/* Side arabesque scrollwork */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 h-10 w-48 -translate-y-1/2">
          <svg
            viewBox="0 0 192 40"
            className="h-full w-full"
            preserveAspectRatio="none"
          >
            <path
              d="M0,20 Q24,0 48,20 T96,20 T144,20 T192,20"
              fill="none"
              strokeWidth="1.2"
              className="stroke-gold/40"
            />
            <path
              d="M0,20 Q24,40 48,20 T96,20 T144,20 T192,20"
              fill="none"
              strokeWidth="1"
              className="stroke-gold/25"
            />
            <path
              d="M0,20 Q24,10 48,20 T96,20 T144,20 T192,20"
              fill="none"
              strokeWidth="0.6"
              className="stroke-gold/15"
            />
          </svg>
        </div>
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-10 w-48 translate-y-1/2 rotate-180">
          <svg
            viewBox="0 0 192 40"
            className="h-full w-full"
            preserveAspectRatio="none"
          >
            <path
              d="M0,20 Q24,0 48,20 T96,20 T144,20 T192,20"
              fill="none"
              strokeWidth="1.2"
              className="stroke-gold/40"
            />
            <path
              d="M0,20 Q24,40 48,20 T96,20 T144,20 T192,20"
              fill="none"
              strokeWidth="1"
              className="stroke-gold/25"
            />
          </svg>
        </div>
        <div className="absolute left-0 top-1/2 -translate-y-1/2 h-48 w-10 -translate-x-1/2 -rotate-90">
          <svg
            viewBox="0 0 192 40"
            className="h-full w-full"
            preserveAspectRatio="none"
          >
            <path
              d="M0,20 Q24,0 48,20 T96,20 T144,20 T192,20"
              fill="none"
              strokeWidth="1.2"
              className="stroke-gold/30"
            />
          </svg>
        </div>
        <div className="absolute right-0 top-1/2 -translate-y-1/2 h-48 w-10 translate-x-1/2 rotate-90">
          <svg
            viewBox="0 0 192 40"
            className="h-full w-full"
            preserveAspectRatio="none"
          >
            <path
              d="M0,20 Q24,0 48,20 T96,20 T144,20 T192,20"
              fill="none"
              strokeWidth="1.2"
              className="stroke-gold/30"
            />
          </svg>
        </div>
      </div>

      {/* ============================================================
          GIRIH STAR TESSELLATION — More visible
      ============================================================ */}
      <div className="absolute inset-0 opacity-[0.06]">
        <svg className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern
              id="girih-hero"
              x="0"
              y="0"
              width="100"
              height="100"
              patternUnits="userSpaceOnUse"
            >
              {/* 8-pointed star */}
              <path
                d="M50,8 L55,42 L92,30 L62,50 L88,82 L50,60 L12,82 L38,50 L8,30 L45,42 Z"
                fill="none"
                stroke="#d4af37"
                strokeWidth="0.6"
              />
              {/* Connecting lines */}
              <path
                d="M50,0 L50,8 M50,60 L50,100 M0,50 L8,50 M92,50 L100,50"
                stroke="#d4af37"
                strokeWidth="0.3"
              />
              {/* Interlacing */}
              <path
                d="M30,30 L70,70 M70,30 L30,70"
                stroke="#d4af37"
                strokeWidth="0.25"
              />
              {/* Small center octagon */}
              <path
                d="M50,35 L58,42 L58,58 L50,65 L42,58 L42,42 Z"
                fill="none"
                stroke="#d4af37"
                strokeWidth="0.3"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#girih-hero)" />
        </svg>
      </div>

      {/* ============================================================
          ILLUMINATED GRID — Manuscript ruling lines
      ============================================================ */}
      <div className="absolute inset-0">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `
              linear-gradient(to right, rgba(212,175,55,0.04) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(212,175,55,0.04) 1px, transparent 1px)
            `,
            backgroundSize: "80px 80px",
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `
              linear-gradient(to right, rgba(212,175,55,0.015) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(212,175,55,0.015) 1px, transparent 1px)
            `,
            backgroundSize: "20px 20px",
          }}
        />
        {/* Gold dots at intersections */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(circle, rgba(212,175,55,0.18) 1.5px, transparent 1.5px)`,
            backgroundSize: "80px 80px",
            backgroundPosition: "-1px -1px",
          }}
        />
      </div>

      {/* ============================================================
          FLOATING ARABESQUE ORBS
      ============================================================ */}
      <div className="absolute top-[15%] left-[10%] h-[200px] w-[200px] animate-float-1 rounded-full bg-gold/[0.04] blur-[80px]" />
      <div className="absolute top-[65%] right-[15%] h-[250px] w-[250px] animate-float-2 rounded-full bg-gold/[0.03] blur-[90px]" />
      <div className="absolute bottom-[20%] left-[35%] h-[180px] w-[180px] animate-float-3 rounded-full bg-verdant/[0.03] blur-[70px]" />

      {/* ============================================================
          MOUSE-TRACKING NUR SPOTLIGHT
      ============================================================ */}
      <div
        className="pointer-events-none absolute inset-0 transition-opacity duration-700"
        style={{ opacity: isHovering ? 1 : 0 }}
      >
        <div
          className="absolute h-[700px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            left: mousePos.x,
            top: mousePos.y,
            background:
              "radial-gradient(circle, rgba(212,175,55,0.08) 0%, rgba(212,175,55,0.03) 40%, transparent 70%)",
            filter: "blur(60px)",
          }}
        />
        <div
          className="absolute h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            left: mousePos.x,
            top: mousePos.y,
            background:
              "radial-gradient(circle, rgba(212,175,55,0.12) 0%, transparent 55%)",
            filter: "blur(30px)",
          }}
        />
        <div
          className="absolute h-[120px] w-[120px] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            left: mousePos.x,
            top: mousePos.y,
            background:
              "radial-gradient(circle, rgba(245,240,232,0.08) 0%, transparent 45%)",
            filter: "blur(15px)",
          }}
        />
      </div>

      {/* ============================================================
          STATIC CONTENT ILLUMINATION
      ============================================================ */}
      <div className="absolute left-[12%] top-[32%] h-[280px] w-[450px] rounded-full bg-gold/[0.03] blur-[100px]" />
      <div className="absolute left-[8%] bottom-[22%] h-[180px] w-[350px] rounded-full bg-gold/[0.02] blur-[70px]" />

      {/* ============================================================
          HORIZONTAL LIGHT RAYS
      ============================================================ */}
      <div className="absolute top-[25%] left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-gold/[0.07] to-transparent" />
      <div className="absolute top-[50%] left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-gold/[0.05] to-transparent" />
      <div className="absolute top-[75%] left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-gold/[0.06] to-transparent" />

      {/* ============================================================
          AURORA SHIMMER
      ============================================================ */}
      <div className="absolute inset-0 overflow-hidden">
        <div
          className="absolute -inset-[100%] animate-shimmer"
          style={{
            background: `
              conic-gradient(
                from 0deg at 50% 50%,
                transparent 0deg,
                rgba(212,175,55,0.02) 60deg,
                transparent 120deg,
                rgba(95,141,110,0.015) 180deg,
                transparent 240deg,
                rgba(212,175,55,0.02) 300deg,
                transparent 360deg
              )
            `,
          }}
        />
      </div>

      {/* ============================================================
          VIGNETTE
      ============================================================ */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 0%, transparent 35%, rgba(12,10,9,0.55) 100%)",
        }}
      />

      {/* ============================================================
          ROSSETTE MOTIF
      ============================================================ */}
      <RosetteMotif />

      {/* ============================================================
          CONTENT
      ============================================================ */}
      <div className="relative z-10 mx-auto flex max-w-3xl flex-col items-center px-6 py-20 text-center sm:py-28 lg:py-36">
        {/* Bismillah header */}
        <div className="relative inline-block mb-6">
          <p
            dir="rtl"
            lang="ar"
            className="animate-fade-up font-arabic text-3xl text-gold opacity-0 sm:text-4xl md:text-5xl"
            style={{
              fontFamily: "'Amiri', 'Scheherazade New', serif",
              textShadow: "0 0 40px rgba(212,175,55,0.2)",
            }}
          >
            {t("hero.arabicTitle")}
          </p>
          <span className="absolute -bottom-3 left-0 right-0 h-px origin-center scale-x-0 animate-draw-line bg-gradient-to-r from-transparent via-gold/60 to-transparent [animation-delay:550ms]" />
        </div>

        {/* Subtitle — eyebrow badge */}
        <p className="animate-fade-up mt-4 opacity-0 [animation-delay:120ms]">
          <span className="glass-soft inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[11px] font-medium uppercase tracking-[0.22em] text-gold-soft/80">
            <span className="h-1.5 w-1.5 rounded-full bg-gold/90" />
            {t("hero.subtitle")}
          </span>
        </p>

        {/* Main headline */}
        <h1
          className="mt-8 animate-fade-up text-shine text-shine-slow font-display text-4xl font-semibold leading-[1.08] tracking-tight opacity-0 sm:text-5xl md:text-6xl [animation-delay:220ms]"
          dangerouslySetInnerHTML={{ __html: t("hero.title") }}
        />

        {/* Description */}
        <p className="mt-6 max-w-xl animate-fade-up text-lg leading-relaxed text-parchment-muted opacity-0 [animation-delay:340ms]">
          {t("hero.description")}
        </p>

        {/* Quranic verse — modern glass illuminated card */}
        {hasVerse && (
          <blockquote
            dir="rtl"
            className="glass gradient-border animate-fade-in-scale relative mt-10 rounded-2xl p-6 opacity-0 [animation-delay:380ms] sm:p-8"
          >
            {/* Corner accents */}
            <div className="absolute top-0 left-0 h-6 w-6 rounded-tl-2xl border-t-2 border-l-2 border-gold/30" />
            <div className="absolute top-0 right-0 h-6 w-6 rounded-tr-2xl border-t-2 border-r-2 border-gold/30" />
            <div className="absolute bottom-0 left-0 h-6 w-6 rounded-bl-2xl border-b-2 border-l-2 border-gold/30" />
            <div className="absolute bottom-0 right-0 h-6 w-6 rounded-br-2xl border-b-2 border-r-2 border-gold/30" />

            <p
              lang="ar"
              className="font-arabic text-2xl leading-relaxed text-parchment/95"
              style={{ fontFamily: "'Amiri', 'Scheherazade New', serif" }}
            >
              {verse}
            </p>
            <cite
              dir="ltr"
              className="mt-4 block text-sm not-italic tracking-wide text-gold/70"
            >
              {t("hero.verseRef")}
            </cite>
          </blockquote>
        )}

        {/* CTA Buttons */}
        <div className="animate-fade-up mt-12 flex flex-wrap items-center justify-center gap-4 opacity-0 [animation-delay:460ms]">
          <Link
            ref={ctaRef}
            href="/create"
            className="btn-luxe group relative rounded-full bg-gold px-8 py-3.5 text-sm font-semibold text-ink shadow-lg shadow-gold/25 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-gold/35"
          >
            <span className="relative">{t("hero.ctaPrimary")}</span>
          </Link>
          <a
            href="#features"
            className="glass-soft group inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-sm font-medium text-parchment transition-all duration-300 hover:border-gold/40 hover:text-gold-soft"
          >
            {t("hero.ctaSecondary") as string}
            <svg
              className="h-4 w-4 animate-scroll-cue text-gold/70"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 14l-7 7m0 0l-7-7m7 7V3"
              />
            </svg>
          </a>
        </div>
      </div>
    </section>
  );
}

/* ================================================================
   QUARTER MEDALLION — Carpet page corner motif
   ================================================================ */
function QuarterMedallion() {
  return (
    <svg viewBox="0 0 200 200" className="h-full w-full">
      {/* Outer arc */}
      <path
        d="M200,0 A200,200 0 0,0 0,200"
        fill="none"
        strokeWidth="1"
        className="stroke-gold/20"
      />
      <path
        d="M180,0 A180,180 0 0,0 0,180"
        fill="none"
        strokeWidth="0.8"
        className="stroke-gold/15"
      />
      {/* Radiating lines */}
      {[...Array(12)].map((_, i) => {
        const angle = (i * 15 * Math.PI) / 180;
        const x = 200 - Math.cos(angle) * 200;
        const y = 200 - Math.sin(angle) * 200;
        return (
          <line
            key={i}
            x1="200"
            y1="200"
            x2={x}
            y2={y}
            strokeWidth="0.3"
            className="stroke-gold/10"
          />
        );
      })}
      {/* Inner star */}
      <path
        d="M200,60 L170,100 L200,140 L160,130 L140,170 L130,130 L90,140 L120,100 L90,60 L130,70 L140,30 L160,70 Z"
        fill="none"
        strokeWidth="0.6"
        className="stroke-gold/20"
      />
    </svg>
  );
}

/* ================================================================
   LARGE CORNER ORNAMENT — 8-point star with arabesque
   ================================================================ */
function CornerOrnamentLarge({
  position,
}: {
  position: "top-left" | "top-right" | "bottom-left" | "bottom-right";
}) {
  const posClasses = {
    "top-left": "-top-4 -left-4",
    "top-right": "-top-4 -right-4",
    "bottom-left": "-bottom-4 -left-4",
    "bottom-right": "-bottom-4 -right-4",
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
        viewBox="0 0 64 64"
        className={`h-10 w-10 sm:h-12 sm:w-12 ${rotateClasses[position]}`}
      >
        {/* Outer 8-point star */}
        <path
          d="M32,4 L36,24 L56,20 L40,32 L56,44 L36,40 L32,60 L28,40 L8,44 L24,32 L8,20 L28,24 Z"
          fill="none"
          strokeWidth="1.2"
          className="stroke-gold/50"
        />
        {/* Inner 8-point star */}
        <path
          d="M32,14 L34,26 L46,24 L38,32 L46,40 L34,38 L32,50 L30,38 L18,40 L26,32 L18,24 L30,26 Z"
          fill="none"
          strokeWidth="0.8"
          className="stroke-gold/30"
        />
        {/* Center circle */}
        <circle
          cx="32"
          cy="32"
          r="4"
          fill="none"
          strokeWidth="0.8"
          className="stroke-gold/40"
        />
        <circle cx="32" cy="32" r="1.5" className="fill-gold/30" />
        {/* Corner accent lines */}
        <path
          d="M4,4 L16,16 M4,4 L4,16 M4,4 L16,4"
          fill="none"
          strokeWidth="0.6"
          className="stroke-gold/25"
        />
      </svg>
    </div>
  );
}

/* ================================================================
   ROSETTE MOTIF — Islamic geometric octagram
   ================================================================ */
function RosetteMotif() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute -right-40 top-1/2 h-[560px] w-[560px] -translate-y-1/2 animate-fade-up opacity-0 [animation-delay:80ms] sm:-right-16 sm:h-[640px] sm:w-[640px]"
    >
      {/* Central glow — light within a niche */}
      <div className="absolute left-1/2 top-1/2 h-56 w-56 -translate-x-1/2 -translate-y-1/2 animate-glow-pulse rounded-full bg-gold/40 blur-3xl" />
      <div className="absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 animate-glow-pulse rounded-full bg-parchment/15 blur-2xl [animation-delay:1s]" />

      <svg viewBox="0 0 420 420" className="absolute inset-0 h-full w-full">
        {/* Outer circle */}
        <circle
          cx="210"
          cy="210"
          r="196"
          fill="none"
          strokeWidth="0.8"
          className="stroke-gold/[0.12]"
        />
        <circle
          cx="210"
          cy="210"
          r="170"
          fill="none"
          strokeWidth="0.5"
          className="stroke-gold/[0.08]"
        />
        <circle
          cx="210"
          cy="210"
          r="140"
          fill="none"
          strokeWidth="0.4"
          className="stroke-gold/[0.06]"
        />

        {/* Outer octagram */}
        <g
          className="animate-spin-slow"
          style={{ transformBox: "view-box", transformOrigin: "210px 210px" }}
        >
          <path
            d="M210.00,42.00 L236.79,145.33 L328.79,91.21 L274.67,183.21 L378.00,210.00 L274.67,236.79 L328.79,328.79 L236.79,274.67 L210.00,378.00 L183.21,274.67 L91.21,328.79 L145.33,236.79 L42.00,210.00 L145.33,183.21 L91.21,91.21 L183.21,145.33 Z"
            fill="none"
            strokeWidth="1"
            className="stroke-gold/40"
          />
        </g>

        {/* Inner octagram */}
        <g
          className="animate-spin-slow-reverse"
          style={{ transformBox: "view-box", transformOrigin: "210px 210px" }}
        >
          <path
            d="M263.58,80.66 L251.01,168.99 L339.34,156.42 L268.00,210.00 L339.34,263.58 L251.01,251.01 L263.58,339.34 L210.00,268.00 L156.42,339.34 L168.99,251.01 L80.66,263.58 L152.00,210.00 L80.66,156.42 L168.99,168.99 L156.42,80.66 L210.00,152.00 Z"
            fill="none"
            strokeWidth="0.8"
            className="stroke-verdant/45"
          />
        </g>

        {/* Inner circle */}
        <circle
          cx="210"
          cy="210"
          r="34"
          fill="none"
          strokeWidth="0.8"
          className="stroke-gold/45"
        />
        <circle cx="210" cy="210" r="3" className="fill-gold/50" />
      </svg>
    </div>
  );
}
