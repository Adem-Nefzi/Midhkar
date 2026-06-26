/**
 * canvas-utils.ts
 * Pure canvas drawing helpers — no React, no side-effects.
 */

import { PLATFORMS } from "@/lib/quran";
import type { Ayah, Surah } from "@/lib/quran";
import type { VideoSettings } from "@/lib/types";

/* ── Constants ───────────────────────────────────────────────── */

export const FONT_SIZES = {
  small: { arabic: 36, translation: 17, badge: 13 },
  medium: { arabic: 52, translation: 22, badge: 16 },
  large: { arabic: 68, translation: 26, badge: 18 },
};

export const BG_GRADIENTS: Record<string, string[][]> = {
  upload: [
    ["#000000", "#111111"],
    ["#111111", "#000000"],
  ],
  library: [
    ["#000000", "#111111"],
    ["#111111", "#000000"],
  ],
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
): void {
  const isVideo =
    (bgId === "upload" || bgId === "library") &&
    videoEl &&
    videoEl.readyState >= 2;

  if (isVideo) {
    try {
      ctx.drawImage(videoEl!, 0, 0, w, h);
    } catch {
      // fall through to gradient
    }
  }

  if (!isVideo) {
    const stops = BG_GRADIENTS[bgId] ?? BG_GRADIENTS["library"];
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, stops[0][0]);
    g.addColorStop(0.5, stops[0][1]);
    g.addColorStop(1, stops[1]?.[0] ?? stops[0][0]);
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

  if (overlayPct > 0) {
    ctx.fillStyle = `rgba(0,0,0,${overlayPct / 100})`;
    ctx.fillRect(0, 0, w, h);
  }
}

/* ── Ayah frame — layout-first approach ──────────────────────── */

interface TextBlock {
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
  if (transLines.length) totalH += transLines.length * transLineH + sz.translation * 0.8;

  return { arabicLines, arabicLineH, badgeText, transLines, transLineH, totalH };
}

export function drawAyahFrame(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  ayah: Ayah | null,
  surah: Surah,
  s: VideoSettings,
  platform: (typeof PLATFORMS)[0],
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

  const posId = s.textPosition;
  let startY: number;
  if (posId === "top") {
    startY = safeTop;
  } else if (posId === "bottom") {
    startY = safeBottom - block.totalH;
  } else {
    startY = safeTop + (safeH - block.totalH) / 2;
  }

  if (startY < safeTop) startY = safeTop;
  if (startY + block.totalH > safeBottom) {
    startY = safeBottom - block.totalH;
    if (startY < safeTop) startY = safeTop;
  }

  let cursorY = startY;

  // ── Top decorative rule ────────────────────────────────────
  ctx.globalAlpha = 0.22;
  ctx.strokeStyle = s.textColor;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(w * 0.3, cursorY - 14);
  ctx.lineTo(w * 0.7, cursorY - 14);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // ── Arabic text ────────────────────────────────────────────
  if (s.textShadow) {
    ctx.shadowColor = "rgba(0,0,0,0.9)";
    ctx.shadowBlur = 20;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 3;
  }
  ctx.globalAlpha = s.textOpacity / 100;
  ctx.fillStyle = s.textColor;
  ctx.font = `${sz.arabic}px ${s.fontFamily}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.direction = "rtl";
  block.arabicLines.forEach((line, i) => {
    const y = cursorY + i * block.arabicLineH + block.arabicLineH / 2;
    if (y < safeBottom + block.arabicLineH) {
      ctx.fillText(line, w / 2, y);
    }
  });
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
  cursorY += block.arabicLines.length * block.arabicLineH;

  // ── Surah / verse badge ────────────────────────────────────
  if (block.badgeText) {
    cursorY += sz.badge * 0.8;
    ctx.direction = "ltr";
    ctx.font = `${sz.badge}px 'Amiri', serif`;
    ctx.textAlign = "center";
    ctx.fillStyle = s.textColor;
    ctx.globalAlpha = 0.55;
    ctx.shadowColor = "rgba(0,0,0,0.8)";
    ctx.shadowBlur = s.textShadow ? 8 : 0;
    if (cursorY < safeBottom) {
      ctx.fillText(block.badgeText, w / 2, cursorY);
    }
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    cursorY += sz.badge * 1.4;
  }

  // ── Translation ────────────────────────────────────────────
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
      if (y < safeBottom) {
        ctx.fillText(line, w / 2, y);
      }
    });
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    cursorY += block.transLines.length * block.transLineH;
  }

  // ── Bottom decorative rule ─────────────────────────────────
  const ruleY = Math.min(cursorY + sz.badge * 1.2, safeBottom);
  ctx.globalAlpha = 0.18;
  ctx.strokeStyle = s.textColor;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(w * 0.35, ruleY);
  ctx.lineTo(w * 0.65, ruleY);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

/* ── Canvas → PNG bytes ──────────────────────────────────────── */

export async function canvasToPNG(
  canvas: HTMLCanvasElement,
): Promise<Uint8Array> {
  const blob = await new Promise<Blob>((res, rej) => {
    canvas.toBlob(
      (b) => (b ? res(b) : rej(new Error("canvas.toBlob returned null"))),
      "image/png",
    );
  });
  return new Uint8Array(await blob.arrayBuffer());
}
