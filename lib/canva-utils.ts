/**
 * canvas-utils.ts
 * Pure canvas drawing helpers — no React, no side-effects.
 *
 * New in this version:
 *  - drawBackground supports "color" mode (solid/gradient via bgColor/bgColorSecondary/bgGradientAngle)
 *  - drawAyahFrame respects textGlow and textOutline settings
 *  - drawFrameDecoration draws "corners" | "full" | "arch" overlays
 */

import { PLATFORMS } from "@/lib/quran";
import type { Ayah, Surah } from "@/lib/quran";
import type { VideoSettings } from "@/lib/types";

/* ── Text block cache ────────────────────────────────────────── */

const textBlockCache = new Map<string, TextBlock>();

function cacheKey(
  ayah: Ayah | null,
  surah: Surah,
  s: VideoSettings,
  maxW: number,
): string {
  return `${ayah?.numberInSurah ?? "none"}|${surah.number}|${s.fontSize}|${s.fontFamily}|${s.translationFontFamily}|${s.showSurahName}|${s.showVerseNumber}|${s.showTranslation}|${maxW}`;
}

/* ── Font size map ───────────────────────────────────────────── */

export const FONT_SIZES = {
  small: { arabic: 36, translation: 17, badge: 20 },
  medium: { arabic: 52, translation: 22, badge: 26 },
  large: { arabic: 68, translation: 26, badge: 30 },
};

/* ── Text wrapping ───────────────────────────────────────────── */

export function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxW: number,
): string[] {
  if (!text) return [""];
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(test).width > maxW && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = test;
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [text];
}

/* ── Background ──────────────────────────────────────────────── */

export function drawBackground(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  bgId: string,
  videoEl: HTMLVideoElement | null,
  overlayPct: number,
  settings?: Pick<
    VideoSettings,
    "bgColor" | "bgColorSecondary" | "bgGradientAngle"
  >,
): void {
  const isVideo =
    (bgId === "upload" || bgId === "library" || bgId === "pexels") &&
    videoEl &&
    videoEl.readyState >= 2;

  if (isVideo) {
    try {
      ctx.drawImage(videoEl!, 0, 0, w, h);
    } catch {
      /* fall through */
    }
  }

  if (!isVideo) {
    if (bgId === "color" && settings) {
      // Custom solid / gradient background
      const angle = (settings.bgGradientAngle ?? 135) * (Math.PI / 180);
      const x1 = w / 2 + Math.cos(angle + Math.PI) * w;
      const y1 = h / 2 + Math.sin(angle + Math.PI) * h;
      const x2 = w / 2 + Math.cos(angle) * w;
      const y2 = h / 2 + Math.sin(angle) * h;
      const g = ctx.createLinearGradient(x1, y1, x2, y2);
      g.addColorStop(0, settings.bgColor ?? "#09090f");
      g.addColorStop(1, settings.bgColorSecondary ?? "#1a0e00");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    } else {
      // Default: dark gradient with subtle gold glow
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, "#09090f");
      g.addColorStop(0.5, "#120d03");
      g.addColorStop(1, "#09090f");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      const glow = ctx.createRadialGradient(
        w / 2,
        h / 2,
        0,
        w / 2,
        h / 2,
        Math.max(w, h) * 0.55,
      );
      glow.addColorStop(0, "rgba(212,175,55,0.07)");
      glow.addColorStop(1, "transparent");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);
    }
  }

  if (overlayPct > 0) {
    ctx.fillStyle = `rgba(0,0,0,${overlayPct / 100})`;
    ctx.fillRect(0, 0, w, h);
  }
}

/* ── Frame decorations ───────────────────────────────────────── */

export function drawFrameDecoration(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  style: VideoSettings["frameStyle"],
  color: string = "#d4af37",
): void {
  if (!style || style === "none") return;

  const pad = Math.round(Math.min(w, h) * 0.04);
  const arm = Math.round(Math.min(w, h) * 0.07);
  const alpha = 0.45;

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1.5, Math.min(w, h) * 0.004);
  ctx.globalAlpha = alpha;

  if (style === "corners" || style === "full") {
    // Top-left
    ctx.beginPath();
    ctx.moveTo(pad, pad + arm);
    ctx.lineTo(pad, pad);
    ctx.lineTo(pad + arm, pad);
    ctx.stroke();
    // Top-right
    ctx.beginPath();
    ctx.moveTo(w - pad - arm, pad);
    ctx.lineTo(w - pad, pad);
    ctx.lineTo(w - pad, pad + arm);
    ctx.stroke();
    // Bottom-left
    ctx.beginPath();
    ctx.moveTo(pad, h - pad - arm);
    ctx.lineTo(pad, h - pad);
    ctx.lineTo(pad + arm, h - pad);
    ctx.stroke();
    // Bottom-right
    ctx.beginPath();
    ctx.moveTo(w - pad - arm, h - pad);
    ctx.lineTo(w - pad, h - pad);
    ctx.lineTo(w - pad, h - pad - arm);
    ctx.stroke();
  }

  if (style === "full") {
    // Full border rect inside the corners
    ctx.globalAlpha = alpha * 0.4;
    ctx.strokeRect(pad, pad, w - pad * 2, h - pad * 2);
    // Inner inset
    ctx.globalAlpha = alpha * 0.15;
    ctx.strokeRect(pad + 6, pad + 6, w - (pad + 6) * 2, h - (pad + 6) * 2);
  }

  if (style === "arch") {
    // Bottom straight border
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.moveTo(pad, h - pad);
    ctx.lineTo(w - pad, h - pad);
    ctx.stroke();
    // Side lines
    ctx.beginPath();
    ctx.moveTo(pad, h - pad);
    ctx.lineTo(pad, h * 0.35);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(w - pad, h - pad);
    ctx.lineTo(w - pad, h * 0.35);
    ctx.stroke();
    // Arch (top arc)
    ctx.beginPath();
    ctx.arc(w / 2, h * 0.35, w / 2 - pad, Math.PI, 0);
    ctx.stroke();
    // Corner ornaments
    ctx.globalAlpha = alpha * 0.5;
    const r = arm * 0.3;
    [
      [pad, h - pad],
      [w - pad, h - pad],
    ].forEach(([x, y]) => {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.stroke();
    });
  }

  ctx.restore();
}

/* ── Ayah frame ──────────────────────────────────────────────── */

export interface TextBlock {
  arabicLines: string[];
  arabicLineH: number;
  badgeText: string | null;
  transLines: string[];
  transLineH: number;
  totalH: number;
}

function measureTextBlock(
  ctx: CanvasRenderingContext2D,
  ayah: Ayah | null,
  surah: Surah,
  s: VideoSettings,
  maxW: number,
  sz: { arabic: number; translation: number; badge: number },
): TextBlock {
  const key = cacheKey(ayah, surah, s, maxW);
  const cached = textBlockCache.get(key);
  if (cached) return cached;

  const arabicText = ayah?.text ?? "";
  ctx.font = `${sz.arabic}px ${s.fontFamily}`;
  ctx.direction = "rtl";
  const arabicLines = wrapText(ctx, arabicText, maxW);
  const arabicLineH = sz.arabic * 1.7;

  let badgeText: string | null = null;
  if (ayah && (s.showSurahName || s.showVerseNumber)) {
    const parts: string[] = [];
    if (s.showSurahName) parts.push(surah.name);
    if (s.showVerseNumber)
      parts.push(`(${surah.number}:${ayah.numberInSurah})`);
    badgeText = parts.join("  ");
  }

  let transLines: string[] = [];
  let transLineH = 0;
  if (s.showTranslation && ayah?.translation) {
    ctx.font = `${sz.translation}px ${s.translationFontFamily}`;
    ctx.direction = "ltr";
    const trans =
      ayah.translation.length > 200
        ? ayah.translation.slice(0, 200) + "..."
        : ayah.translation;
    transLines = wrapText(ctx, trans, maxW * 0.82);
    transLineH = sz.translation * 1.5;
  }

  let totalH = arabicLines.length * arabicLineH;
  if (badgeText) totalH += sz.badge * 2.2;
  if (transLines.length)
    totalH += transLines.length * transLineH + sz.translation * 0.8;

  const result: TextBlock = {
    arabicLines,
    arabicLineH,
    badgeText,
    transLines,
    transLineH,
    totalH,
  };
  textBlockCache.set(key, result);
  return result;
}

const ANIM_DUR_FRAMES = 15; // ~0.5s at 30fps

export function drawAyahFrame(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  ayah: Ayah | null,
  surah: Surah,
  s: VideoSettings,
  platform: (typeof PLATFORMS)[0],
  animProgress: number = 1,
): void {
  const w = canvas.width;
  const h = canvas.height;
  const sz = FONT_SIZES[s.fontSize];
  const pad = w * 0.08;
  const maxW = w - pad * 2;
  const safeTop = pad * 1.2;
  const safeBottom = h - pad * 1.2;
  const safeH = safeBottom - safeTop;

  const block = measureTextBlock(ctx, ayah, surah, s, maxW, sz);

  let startY =
    s.textPosition === "top"
      ? safeTop
      : s.textPosition === "bottom"
        ? safeBottom - block.totalH
        : safeTop + (safeH - block.totalH) / 2;

  if (startY < safeTop) startY = safeTop;
  if (startY + block.totalH > safeBottom) {
    startY = safeBottom - block.totalH;
    if (startY < safeTop) startY = safeTop;
  }

  let cursorY = startY;

  const textAlpha = s.textAnimation === "fade" ? Math.min(1, animProgress) : 1;

  // ── Top decorative rule ──────────────────────────────────────
  ctx.globalAlpha = 0.22 * textAlpha;
  ctx.strokeStyle = s.textColor;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(w * 0.3, cursorY - 14);
  ctx.lineTo(w * 0.7, cursorY - 14);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // ── Arabic text ──────────────────────────────────────────────
  ctx.font = `${sz.arabic}px ${s.fontFamily}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.direction = "rtl";

  // Glow effect (drawn before main text as a blurred shadow pass)
  if (s.textGlow) {
    ctx.save();
    ctx.shadowColor = "#d4af37";
    ctx.shadowBlur = 28;
    ctx.globalAlpha = 0.5 * textAlpha;
    ctx.fillStyle = "#d4af37";
    block.arabicLines.forEach((line, i) => {
      const y = cursorY + i * block.arabicLineH + block.arabicLineH / 2;
      if (y < safeBottom + block.arabicLineH) ctx.fillText(line, w / 2, y);
    });
    ctx.restore();
  }

  // Outline effect
  if (s.textOutline) {
    ctx.save();
    ctx.strokeStyle = "rgba(0,0,0,0.8)";
    ctx.lineWidth = sz.arabic * 0.04;
    ctx.lineJoin = "round";
    ctx.globalAlpha = (s.textOpacity / 100) * textAlpha;
    block.arabicLines.forEach((line, i) => {
      const y = cursorY + i * block.arabicLineH + block.arabicLineH / 2;
      if (y < safeBottom + block.arabicLineH) ctx.strokeText(line, w / 2, y);
    });
    ctx.restore();
  }

  // Main text shadow
  if (s.textShadow) {
    ctx.shadowColor = "rgba(0,0,0,0.9)";
    ctx.shadowBlur = 20;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 3;
  }

  ctx.globalAlpha = (s.textOpacity / 100) * textAlpha;
  ctx.fillStyle = s.textColor;
  block.arabicLines.forEach((line, i) => {
    const y = cursorY + i * block.arabicLineH + block.arabicLineH / 2;
    if (y < safeBottom + block.arabicLineH) ctx.fillText(line, w / 2, y);
  });
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
  cursorY += block.arabicLines.length * block.arabicLineH;

  // ── Surah / verse badge ──────────────────────────────────────
  if (block.badgeText) {
    cursorY += sz.badge * 0.8;
    ctx.direction = "ltr";
    ctx.font = `bold ${sz.badge}px 'Noto Naskh Arabic', serif`;
    ctx.textAlign = "center";
    ctx.fillStyle = s.textColor;
    ctx.globalAlpha = 0.85;
    ctx.shadowColor = "rgba(0,0,0,0.8)";
    ctx.shadowBlur = s.textShadow ? 8 : 0;
    if (cursorY < safeBottom) ctx.fillText(block.badgeText, w / 2, cursorY);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    cursorY += sz.badge * 1.4;
  }

  // ── Translation ──────────────────────────────────────────────
  if (block.transLines.length) {
    cursorY += sz.translation * 0.8;
    ctx.direction = "ltr";
    ctx.font = `${sz.translation}px ${s.translationFontFamily}`;
    ctx.textAlign = "center";
    ctx.fillStyle = s.translationColor;
    ctx.globalAlpha = s.translationOpacity / 100;
    ctx.shadowColor = "rgba(0,0,0,0.9)";
    ctx.shadowBlur = s.textShadow ? 12 : 0;
    block.transLines.forEach((line, i) => {
      const y = cursorY + i * block.transLineH;
      if (y < safeBottom) ctx.fillText(line, w / 2, y);
    });
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    cursorY += block.transLines.length * block.transLineH;
  }

  // ── Bottom decorative rule ───────────────────────────────────
  const ruleY = Math.min(cursorY + sz.badge * 1.2, safeBottom);
  ctx.globalAlpha = 0.18;
  ctx.strokeStyle = s.textColor;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(w * 0.35, ruleY);
  ctx.lineTo(w * 0.65, ruleY);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // ── Frame decoration (drawn last, on top) ────────────────────
  if (s.frameStyle && s.frameStyle !== "none") {
    drawFrameDecoration(ctx, w, h, s.frameStyle, s.textColor);
  }
}

/* ── Canvas → PNG bytes ──────────────────────────────────────── */

export async function canvasToPNG(
  canvas: HTMLCanvasElement,
): Promise<Uint8Array> {
  const blob = await new Promise<Blob>((res, rej) =>
    canvas.toBlob(
      (b) => (b ? res(b) : rej(new Error("canvas.toBlob returned null"))),
      "image/png",
    ),
  );
  return new Uint8Array(await blob.arrayBuffer());
}
