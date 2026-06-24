/**
 * canvas-utils.ts
 * Pure canvas drawing helpers — no React, no side-effects.
 */

import { TEXT_POSITIONS, PLATFORMS } from "@/lib/quran";
import type { Ayah, Surah } from "@/lib/quran";
import type { VideoSettings } from "@/lib/types";

/* ── Constants ───────────────────────────────────────────────── */

export const FONT_SIZES = {
  small: { arabic: 36, translation: 17, badge: 13 },
  medium: { arabic: 52, translation: 22, badge: 16 },
  large: { arabic: 68, translation: 26, badge: 18 },
};

export const BG_GRADIENTS: Record<string, string[][]> = {
  "golden-pulse": [
    ["#1a1200", "#0c0a09"],
    ["#0a1a12", "#0c0a09"],
  ],
  "starry-night": [
    ["#000814", "#001d3d"],
    ["#003566", "#000814"],
  ],
  "emerald-dusk": [
    ["#0a1f0a", "#0d1f1a"],
    ["#0a2010", "#0d1a13"],
  ],
  "deep-purple": [
    ["#0d0014", "#1a0028"],
    ["#0a001a", "#120020"],
  ],
  "midnight-rose": [
    ["#1a000a", "#14001a"],
    ["#0c000f", "#1a0010"],
  ],
  upload: [
    ["#000000", "#111111"],
    ["#111111", "#000000"],
  ],
  imagekit: [
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
    (bgId === "upload" || bgId === "imagekit") &&
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
    const stops = BG_GRADIENTS[bgId] ?? BG_GRADIENTS["golden-pulse"];
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, stops[0][0]);
    g.addColorStop(0.5, stops[0][1]);
    g.addColorStop(1, stops[1]?.[0] ?? stops[0][0]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // Gold radial glow
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

  // Darkness overlay (improves text legibility on video backgrounds)
  if (overlayPct > 0) {
    ctx.fillStyle = `rgba(0,0,0,${overlayPct / 100})`;
    ctx.fillRect(0, 0, w, h);
  }
}

/* ── Ayah frame ──────────────────────────────────────────────── */

export function drawAyahFrame(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  ayah: Ayah | null,
  surah: Surah,
  s: VideoSettings,
  platform: (typeof PLATFORMS)[0],
  isBismillah: boolean,
): void {
  const w = canvas.width;
  const h = canvas.height;
  const sz = FONT_SIZES[s.fontSize];
  const pad = w * 0.08;
  const maxW = w - pad * 2;

  const arabicText = isBismillah ? "﷽" : (ayah?.text ?? "");
  const arabicSize = isBismillah ? sz.arabic * 1.15 : sz.arabic;

  ctx.font = `${arabicSize}px ${s.fontFamily}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.direction = "rtl";

  const lines = wrapText(ctx, arabicText, maxW);
  const lh = arabicSize * 1.7;
  const totalH = lines.length * lh;

  const pos =
    TEXT_POSITIONS.find((p) => p.id === s.textPosition) || TEXT_POSITIONS[0];
  const centerY = pos.id.startsWith("bottom")
    ? h * 0.76
    : pos.id.startsWith("top")
      ? h * 0.22
      : h * 0.45;

  let startY = centerY - totalH / 2;
  startY = Math.max(startY, pad * 1.5);

  // ── Top decorative rule ────────────────────────────────────
  if (!isBismillah) {
    ctx.globalAlpha = 0.22;
    ctx.strokeStyle = s.textColor;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(w * 0.3, startY - 18);
    ctx.lineTo(w * 0.7, startY - 18);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // ── Arabic text ────────────────────────────────────────────
  if (s.textShadow) {
    ctx.shadowColor = "rgba(0,0,0,0.9)";
    ctx.shadowBlur = 20;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 3;
  }
  ctx.globalAlpha = s.textOpacity / 100;
  ctx.fillStyle = s.textColor;
  lines.forEach((line, i) => {
    ctx.fillText(line, w / 2, startY + i * lh + lh / 2);
  });
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;

  // ── Surah / verse badge ────────────────────────────────────
  if (!isBismillah && ayah && (s.showSurahName || s.showVerseNumber)) {
    const badgeY = startY + totalH + sz.badge * 1.6;
    const parts: string[] = [];
    if (s.showSurahName) parts.push(surah.name);
    if (s.showVerseNumber)
      parts.push(`(${surah.number}:${ayah.numberInSurah})`);

    ctx.direction = "ltr";
    ctx.font = `${sz.badge}px 'Amiri', serif`;
    ctx.textAlign = "center";
    ctx.fillStyle = s.textColor;
    ctx.globalAlpha = 0.55;
    ctx.shadowColor = "rgba(0,0,0,0.8)";
    ctx.shadowBlur = s.textShadow ? 8 : 0;
    ctx.fillText(parts.join("  "), w / 2, badgeY);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }

  // ── Translation ────────────────────────────────────────────
  if (!isBismillah && s.showTranslation && ayah?.translation) {
    const badgeOffset =
      s.showSurahName || s.showVerseNumber ? sz.badge * 2.2 : 0;
    const transY = startY + totalH + badgeOffset + sz.translation * 2.2;

    ctx.direction = "ltr";
    ctx.font = `${sz.translation}px ${s.translationFontFamily}`;
    ctx.textAlign = "center";
    ctx.fillStyle = s.translationColor;
    ctx.globalAlpha = s.translationOpacity / 100;
    ctx.shadowColor = "rgba(0,0,0,0.9)";
    ctx.shadowBlur = s.textShadow ? 12 : 0;

    const trans =
      ayah.translation.length > 200
        ? ayah.translation.slice(0, 200) + "…"
        : ayah.translation;
    const tLines = wrapText(ctx, trans, maxW * 0.82);
    const transLh = sz.translation * 1.5;

    tLines.forEach((l, i) => {
      const ty = transY + i * transLh;
      if (ty < h - pad) ctx.fillText(l, w / 2, ty);
    });
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }

  // ── Bottom decorative rule ─────────────────────────────────
  if (!isBismillah) {
    const bottomY = Math.min(
      startY +
        totalH +
        sz.badge * 4 +
        (s.showTranslation ? sz.translation * 5 : 0),
      h - pad,
    );
    ctx.globalAlpha = 0.18;
    ctx.strokeStyle = s.textColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(w * 0.35, bottomY);
    ctx.lineTo(w * 0.65, bottomY);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
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
