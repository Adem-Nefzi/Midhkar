"use client";
/**
 * PatternBackdrop.tsx — decorative Islamic-pattern layer for the app UI.
 * Renders the procedural pattern engine onto an absolutely-positioned
 * canvas behind content. Static (drawn once per config/resize), cheap.
 */

import { useEffect, useRef } from "react";
import { drawIslamicPattern } from "@/lib/islamic-patterns";
import type { PatternFamily, PatternFillMode } from "@/lib/islamic-patterns";

interface Props {
  family?: PatternFamily;
  paletteId?: string;
  seed?: number;
  density?: 1 | 2 | 3;
  scale?: number;
  fillMode?: PatternFillMode;
  /** CSS opacity of the whole layer (0–1). */
  opacity?: number;
  className?: string;
}

export function PatternBackdrop({
  family = "star",
  paletteId = "night-gold",
  seed = 108,
  density = 1,
  scale = 1.4,
  fillMode = "outline",
  opacity = 0.5,
  className = "",
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    let raf = 0;
    const render = () => {
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      if (w === 0 || h === 0) return;
      // Cap resolution — this is a subtle backdrop, no need for retina.
      const dpr = Math.min(typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1, 1);
      const pw = Math.round(w * dpr);
      const ph = Math.round(h * dpr);
      if (canvas.width !== pw) canvas.width = pw;
      if (canvas.height !== ph) canvas.height = ph;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      drawIslamicPattern(ctx, pw, ph, { seed, family, paletteId, density, scale, fillMode });
    };

    render();
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(render);
    });
    ro.observe(wrap);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [family, paletteId, seed, density, scale, fillMode]);

  return (
    <div
      ref={wrapRef}
      aria-hidden
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
      style={{ opacity }}
    >
      <canvas ref={canvasRef} className="h-full w-full" />
    </div>
  );
}
