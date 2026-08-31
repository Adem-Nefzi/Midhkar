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

/* Vercel Hobby: 300s max per function invocation. Budget ~55s of
 * output per chunk — the verified pipeline renders ≈60s of output in
 * ~120s at 1 vCPU, leaving headroom for audio download + bg decode. */
const MAX_CHUNK_SEC = 55;
export const MAX_TOTAL_SEC = 10 * 60;

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

export function newJobId(): string {
  const c = "abcdef0123456789";
  let id = "";
  for (let i = 0; i < 24; i++) id += c[Math.floor(Math.random() * c.length)];
  return id + Date.now().toString(36);
}

/** Decode a jobId's embedded creation time (ms since epoch). */
export function jobIdToTimestamp(jobId: string): number {
  const ts = parseInt(jobId.slice(24), 36);
  return Number.isFinite(ts) ? ts : 0;
}
