/**
 * canvas-utils.ts
 * Pure canvas drawing helpers â€” no React, no side-effects.
 *
 * New in this version:
 *  - drawBackground supports "color" mode (solid/gradient via bgColor/bgColorSecondary/bgGradientAngle)
 *  - drawBackground supports "pattern" mode (procedural Islamic geometric patterns)
 *  - drawAyahFrame respects textGlow and textOutline settings
 *  - drawFrameDecoration draws "corners" | "full" | "arch" overlays
 */

import type { Ayah, Surah } from "./types-quran";
import type { VideoSettings } from "./types-settings";

/* â”€â”€ Text block cache â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

const textBlockCache = new Map<string, TextBlock>();

function cacheKey(
  ayah: Ayah | null,
  surah: Surah,
  s: VideoSettings,
  maxW: number,
  safeH: number,
): string {
  return `${ayah?.numberInSurah ?? "none"}|${surah.number}|${s.fontSize}|${s.fontFamily}|${s.translationFontFamily}|${s.translationLang}|${s.showSurahName}|${s.showVerseNumber}|${s.showTranslation}|${maxW}|${Math.round(safeH)}`;
}

/* â”€â”€ Font size map â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

export const FONT_SIZES = {
  small: { arabic: 36, translation: 17, badge: 20 },
  medium: { arabic: 52, translation: 22, badge: 26 },
  large: { arabic: 68, translation: 26, badge: 30 },
};

/* â”€â”€ Text wrapping â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

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


/* â”€â”€ Frame decorations â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

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

/* â”€â”€ Ayah frame â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

export interface TextBlock {
  arabicLines: string[];
  arabicLineH: number;
  badgeText: string | null;
  transLines: string[];
  transLineH: number;
  totalH: number;
  arabicSize: number;
  translationSize: number;
  badgeSize: number;
}

/* Readable floors for the auto-fit: even the longest verse in the
   Qur'an (2:282) stays legible at these sizes on a 1080-wide frame. */
const ARABIC_FLOOR = 24;
const TRANS_FLOOR = 13;

function measureTextBlock(
  ctx: CanvasRenderingContext2D,
  ayah: Ayah | null,
  surah: Surah,
  s: VideoSettings,
  maxW: number,
  safeH: number,
  sz: { arabic: number; translation: number; badge: number },
): TextBlock {
  const key = cacheKey(ayah, surah, s, maxW, safeH);
  const cached = textBlockCache.get(key);
  if (cached) return cached;

  const arabicText = ayah?.text ?? "";
  const translation = ayah?.translation ?? "";

  const measure = (
    aSize: number,
    tSize: number,
    bSize: number,
  ): TextBlock => {
    ctx.font = `${aSize}px ${s.fontFamily}`;
    ctx.direction = "rtl";
    const arabicLines = wrapText(ctx, arabicText, maxW);
    const arabicLineH = aSize * 1.7;

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
    if (s.showTranslation && translation) {
      ctx.font = `${tSize}px ${s.translationFontFamily}`;
      ctx.direction = "ltr";
      // Full translation, wrapped across the full text width â€” the
      // empty side space of the frame is put to work before any
      // shrinking is considered.
      transLines = wrapText(ctx, translation, maxW * 0.95);
      transLineH = tSize * 1.5;
    }

    let totalH = arabicLines.length * arabicLineH;
    if (badgeText) totalH += bSize * 2.2;
    if (transLines.length)
      totalH += transLines.length * transLineH + tSize * 0.8;

    return {
      arabicLines,
      arabicLineH,
      badgeText,
      transLines,
      transLineH,
      totalH,
      arabicSize: aSize,
      translationSize: tSize,
      badgeSize: bSize,
    };
  };

  let block = measure(sz.arabic, sz.translation, sz.badge);

  // Gentle auto-fit: only when the block genuinely overflows, scale
  // fonts down proportionally (max 3 steps) but never below the
  // readable floors. Most verses never enter this loop â€” the wider
  // translation wrap already handles them at full size.
  if (block.totalH > safeH) {
    for (let i = 0; i < 3; i++) {
      const scale = Math.max(
        ARABIC_FLOOR / sz.arabic,
        Math.min(0.88, safeH / block.totalH),
      );
      const aSize = Math.max(ARABIC_FLOOR, Math.round(block.arabicSize * scale));
      const tSize = Math.max(TRANS_FLOOR, Math.round(block.translationSize * scale));
      const bSize = Math.max(
        Math.round(ARABIC_FLOOR * 0.6),
        Math.round(block.badgeSize * scale),
      );
      const next = measure(aSize, tSize, bSize);
      block = next;
      if (block.totalH <= safeH) break;
      if (
        block.arabicSize <= ARABIC_FLOOR &&
        block.translationSize <= TRANS_FLOOR
      ) {
        break;
      }
    }
  }

  textBlockCache.set(key, block);
  return block;
}

export function drawAyahFrame(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  ayah: Ayah | null,
  surah: Surah,
  s: VideoSettings,
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

  const block = measureTextBlock(ctx, ayah, surah, s, maxW, safeH, sz);
  const szArabic = block.arabicSize;
  const szTrans = block.translationSize;
  const szBadge = block.badgeSize;

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

  // â”€â”€ Top decorative rule â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  ctx.globalAlpha = 0.22 * textAlpha;
  ctx.strokeStyle = s.textColor;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(w * 0.3, cursorY - 14);
  ctx.lineTo(w * 0.7, cursorY - 14);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // â”€â”€ Arabic text â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  ctx.font = `${szArabic}px ${s.fontFamily}`;
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
    ctx.lineWidth = szArabic * 0.04;
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

  // â”€â”€ Surah / verse badge â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (block.badgeText) {
    cursorY += szBadge * 0.8;
    ctx.direction = "ltr";
    ctx.font = `bold ${szBadge}px 'Noto Naskh Arabic', serif`;
    ctx.textAlign = "center";
    ctx.fillStyle = s.textColor;
    ctx.globalAlpha = 0.85;
    ctx.shadowColor = "rgba(0,0,0,0.8)";
    ctx.shadowBlur = s.textShadow ? 8 : 0;
    if (cursorY < safeBottom) ctx.fillText(block.badgeText, w / 2, cursorY);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    cursorY += szBadge * 1.4;
  }

  // â”€â”€ Translation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (block.transLines.length) {
    cursorY += szTrans * 0.8;
    ctx.direction = "ltr";
    ctx.font = `${szTrans}px ${s.translationFontFamily}`;
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

  // â”€â”€ Bottom decorative rule â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const ruleY = Math.min(cursorY + szBadge * 1.2, safeBottom);
  ctx.globalAlpha = 0.18;
  ctx.strokeStyle = s.textColor;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(w * 0.35, ruleY);
  ctx.lineTo(w * 0.65, ruleY);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // â”€â”€ Frame decoration (drawn last, on top) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (s.frameStyle && s.frameStyle !== "none") {
    drawFrameDecoration(ctx, w, h, s.frameStyle, s.textColor);
  }
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   Overlay + watermark + full-frame preview composition
   (shared by the encoder pre-render, the live preview and the
   landing hero â€” kept here so none of them import the heavy
   generate-video module)
 â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

export function drawOverlayStyle(
  ctx: CanvasRenderingContext2D,
  cw: number,
  ch: number,
  style: VideoSettings["overlayStyle"],
  intensityPct: number,
): void {
  if (style === "none" || intensityPct <= 0) return;
  const alpha = Math.min(0.85, (intensityPct / 100) * 0.85);
  let g: CanvasGradient;
  if (style === "radial") {
    g = ctx.createRadialGradient(
      cw / 2,
      ch / 2,
      Math.min(cw, ch) * 0.2,
      cw / 2,
      ch / 2,
      Math.max(cw, ch) * 0.7,
    );
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, `rgba(0,0,0,${alpha})`);
  } else {
    g = ctx.createLinearGradient(0, 0, 0, ch);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(0.55, "rgba(0,0,0,0)");
    g.addColorStop(1, `rgba(0,0,0,${alpha})`);
  }
  ctx.save();
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, cw, ch);
  ctx.restore();
}

export function drawWatermark(
  ctx: CanvasRenderingContext2D,
  cw: number,
  ch: number,
  text: string,
): void {
  ctx.save();
  ctx.font = `${Math.round(ch * 0.022)}px sans-serif`;
  ctx.fillStyle = "rgba(245,240,232,0.55)";
  ctx.textAlign = "right";
  ctx.textBaseline = "bottom";
  const pad = Math.round(ch * 0.025);
  ctx.fillText(text, cw - pad, ch - pad);
  ctx.restore();
}

