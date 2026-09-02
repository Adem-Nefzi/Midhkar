/**
 * render-plan.ts — shared types + chunk planner for the serverless
 * render pipeline. Imported by BOTH the API routes (server) and
 * render-client.ts (client) — keep it dependency-free.
 */

export interface PlanAyah {
  key: string;
  numberInSurah: number;
  text: string;
  translation: string;
  durationSec: number;
}

export interface RenderPlanSpec {
  ayahs: PlanAyah[];
  surah: { number: string; name: string; englishName: string };
  reciter: { quranApiNo: number; everyayahFolder: string; primary: boolean };
  settings: Record<string, unknown>;
  platform: { aspect: "16:9" | "9:16" | "1:1"; id: string };
  bg: { mode: "pexels" | "upload" | "none"; urls?: string[] };
  quality: { isLowPower: boolean };
}

export interface RenderChunk {
  /** Inclusive ayah index range into RenderPlanSpec.ayahs. */
  from: number;
  to: number;
  /** Output seconds of this chunk (sum of ayah durations + spacing). */
  durationSec: number;
}

export interface RenderPlan {
  jobId: string;
  spec: RenderPlanSpec;
  chunks: RenderChunk[];
  totalDurationSec: number;
  createdAt: number;
}

/* Vercel Hobby: 300s max per function invocation. With real-bg
 * compositing a chunk renders at ~7x realtime (measured in prod:
 * 21s of output -> 143s), so MAX_CHUNK_SEC must keep worst-case
 * render time well under the cap: 30s * 7x + audio/bg fetch ~ 240s.
 * A 46s selection (full Fatihah) must therefore SPLIT into chunks —
 * never raise this back to 55 without re-measuring. */
const MAX_CHUNK_SEC = 30;
export const MAX_TOTAL_SEC = 10 * 60;

/** jobId charset + length — the single source of truth for validation. */
export const JOB_ID_RE = /^[0-9a-z]{27,}$/;

export function planChunks(ayahs: PlanAyah[], verseSpacingSec: number): RenderChunk[] {
  const chunks: RenderChunk[] = [];
  let from = 0;
  let dur = 0;
  for (let i = 0; i < ayahs.length; i++) {
    const ayahSec = ayahs[i].durationSec + verseSpacingSec;
    if (i > from && dur + ayahSec > MAX_CHUNK_SEC) {
      chunks.push({ from, to: i - 1, durationSec: dur });
      from = i;
      dur = 0;
    }
    dur += ayahSec;
  }
  chunks.push({ from, to: ayahs.length - 1, durationSec: dur });
  return chunks;
}

/* ── Job IDs ──────────────────────────────────────────────────────
 * A jobId is a capability token: knowing it grants download/delete.
 * Randomness comes from crypto when available (all Node runtimes);
 * Math.random is a last-resort fallback for non-secure contexts.
 * Layout: 22 random chars + 8 timestamp chars (base36, ms epoch). */
const ID_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";

function secureRandomInts(count: number): number[] {
  const g = globalThis as { crypto?: { getRandomValues(a: Uint32Array): Uint32Array } };
  if (g.crypto?.getRandomValues) {
    return Array.from(g.crypto.getRandomValues(new Uint32Array(count)));
  }
  return Array.from({ length: count }, () => Math.floor(Math.random() * 0xffffffff));
}

export function newJobId(): string {
  let id = "";
  for (const r of secureRandomInts(22)) id += ID_ALPHABET[r % ID_ALPHABET.length];
  return id + Date.now().toString(36);
}

/** Decode a jobId's embedded creation time (ms since epoch). */
export function jobIdToTimestamp(jobId: string): number {
  const ts = parseInt(jobId.slice(22), 36);
  return Number.isFinite(ts) ? ts : 0;
}
