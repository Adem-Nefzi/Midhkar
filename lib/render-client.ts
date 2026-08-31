"use client";
/**
 * render-client.ts — serverless chunked render client.
 *
 * The whole render runs in /api/render/* on the app's own Vercel
 * functions; the browser only uploads the spec, drives chunk calls,
 * and downloads the MP4. Chunk POSTs are idempotent, so retries and
 * re-generation of the same selection resume instead of re-rendering.
 *
 * Any failure rejects; the caller falls back to the in-browser
 * WebCodecs pipeline (see VideoBuilder.handleGenerate).
 */

import type { RenderPlanSpec } from "@/lib/render-plan";
import { MAX_TOTAL_SEC } from "@/lib/render-plan";

const API = "/api/render";
const JOB_KEY = "midhkar-render-job";
const CHUNK_TIMEOUT_MS = 5 * 60 * 1000 + 30_000; // route maxDuration + slack
const PLAN_TIMEOUT_MS = 90_000;

interface JobState {
  jobId: string;
  chunks: number;
  specHash: string;
}

function loadJob(): JobState | null {
  try {
    const raw = sessionStorage.getItem(JOB_KEY);
    return raw ? (JSON.parse(raw) as JobState) : null;
  } catch {
    return null;
  }
}

function saveJob(state: JobState | null): void {
  try {
    if (state) sessionStorage.setItem(JOB_KEY, JSON.stringify(state));
    else sessionStorage.removeItem(JOB_KEY);
  } catch {
    /* private mode — resume just won't survive refresh */
  }
}

async function hashSpec(spec: RenderPlanSpec): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(spec));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .slice(0, 16)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function deleteJob(jobId: string): Promise<void> {
  await fetch(`${API}/download?jobId=${jobId}`, { method: "DELETE" }).catch(
    () => {},
  );
}

/** Abandoned-job hygiene when the Generate step mounts. */
export function clearStaleJob(): void {
  const job = loadJob();
  if (job) void deleteJob(job.jobId);
  saveJob(null);
}

/* Composite abort (timer + user signal) without AbortSignal.any —
 * the cloud path is the ONLY path on browsers too old for it. */
function withTimeout(signal: AbortSignal, ms: number): AbortSignal {
  const composite = new AbortController();
  const onAbort = () => composite.abort();
  signal.addEventListener("abort", onAbort, { once: true });
  const timer = setTimeout(() => composite.abort(), ms);
  composite.signal.addEventListener(
    "abort",
    () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
    },
    { once: true },
  );
  return composite.signal;
}

export interface CloudRenderHandle {
  cancel: () => void;
}

async function postJson<T>(
  path: string,
  body: unknown,
  timeoutMs: number,
  signal: AbortSignal,
): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: withTimeout(signal, timeoutMs),
  });
  const parsed = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(parsed.error || `Request failed (${res.status})`);
  return parsed;
}

/** True when the selection fits the serverless render window. */
export function cloudCanRender(spec: {
  ayahs: { durationSec: number }[];
  settings?: Record<string, unknown>;
}): boolean {
  const spacing = Number(spec.settings?.verseSpacing ?? 0) || 0;
  const total = spec.ayahs.reduce((s, a) => s + a.durationSec + spacing, 0);
  return total <= MAX_TOTAL_SEC;
}

/**
 * Upload the background video for a job. Production: Vercel Blob
 * client upload (browser → Blob direct, no 4.5MB function-body cap).
 * Dev (no Blob store): direct multipart POST — localhost has no
 * meaningful body limit.
 */
async function uploadBgFile(
  jobId: string,
  file: File,
  onLog: (msg: string, pct: number) => void,
  signal: AbortSignal,
): Promise<void> {
  onLog("Uploading background video…", 3);
  try {
    const { upload } = await import("@vercel/blob/client");
    await upload(`renders/${jobId}/bg-input.mp4`, file, {
      access: "private",
      handleUploadUrl: `${API}/upload-token`,
      multipart: true,
      onUploadProgress: (p) => onLog(`Uploading background… ${p.percentage}%`, 3),
      abortSignal: signal,
    });
  } catch (err) {
    if (signal.aborted) throw err;
    const form = new FormData();
    form.append("jobId", jobId);
    form.append("bg", file);
    const res = await fetch(`${API}/plan`, {
      method: "POST",
      body: form,
      signal: withTimeout(signal, PLAN_TIMEOUT_MS),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error || "Background upload failed");
    }
  }
}

/**
 * Render server-side in verse-aligned chunks. Resolves with the MP4 Blob.
 * Rejects on ANY failure — the caller must fall back to local rendering.
 * Re-generating the same spec resumes from whatever chunks already exist.
 */
export async function renderVideoCloud(
  spec: RenderPlanSpec,
  onLog: (msg: string, pct: number) => void,
  handleRef: { current: CloudRenderHandle | null },
  bgFile?: File | null,
): Promise<Blob> {
  const ctrl = new AbortController();
  handleRef.current = { cancel: () => ctrl.abort() };

  if (!cloudCanRender(spec)) {
    throw new Error(
      "Selection longer than 10 minutes — rendering on your device instead",
    );
  }

  const specHash = await hashSpec(spec);
  let succeeded = false;

  try {
    /* 1. Plan — or resume an existing job for this exact spec. */
    let job: JobState | null = null;
    const previous = loadJob();
    if (previous && previous.specHash === specHash) {
      try {
        const status = await fetch(
          `${API}/status?jobId=${previous.jobId}`,
          { signal: withTimeout(ctrl.signal, 30_000) },
        );
        if (status.ok) {
          const s = (await status.json()) as {
            jobId: string;
            chunks: number;
            finalized: boolean;
          };
          job = { jobId: s.jobId, chunks: s.chunks, specHash };
          onLog("Resuming previous render…", 5);
        }
      } catch {
        /* stale entry — fall through to a fresh plan */
      }
    }
    if (previous && (!job || job.jobId !== previous.jobId)) {
      void deleteJob(previous.jobId);
    }
    if (!job) {
      onLog("Preparing server render…", 2);
      const planRes = await postJson<{
        jobId: string;
        chunks: number;
      }>(
        "/plan",
        spec,
        PLAN_TIMEOUT_MS,
        ctrl.signal,
      );
      job = { jobId: planRes.jobId, chunks: planRes.chunks, specHash };
      saveJob(job);
      onLog(
        `Queued — ${planRes.chunks} server chunk${planRes.chunks > 1 ? "s" : ""}…`,
        4,
      );
    }

    /* 1b. Background upload (upload mode) — browser → Blob direct. */
    if (bgFile) {
      await uploadBgFile(job.jobId, bgFile, onLog, ctrl.signal);
    }

    /* 2. Chunks (sequential; idempotent per chunk) */
    const chunkSpan = 90 / job.chunks; // 5% → 95%
    for (let i = 0; i < job.chunks; i++) {
      if (ctrl.signal.aborted) throw new DOMException("Aborted", "AbortError");
      onLog(
        `Rendering part ${i + 1}/${job.chunks} on the server…`,
        Math.round(5 + i * chunkSpan),
      );
      await postJson<{ ok: boolean }>(
        "/chunk",
        { jobId: job.jobId, chunk: i },
        CHUNK_TIMEOUT_MS,
        ctrl.signal,
      );
    }

    /* 3. Finalize (lossless concat + faststart) */
    if (ctrl.signal.aborted) throw new DOMException("Aborted", "AbortError");
    onLog("Assembling final video…", 96);
    await postJson<{ ok: boolean }>(
      "/finalize",
      { jobId: job.jobId },
      180_000,
      ctrl.signal,
    );

    /* 4. Download */
    onLog("Downloading your video…", 98);
    const vid = await fetch(`${API}/download?jobId=${job.jobId}`, {
      signal: ctrl.signal,
    });
    if (!vid.ok) throw new Error("Video download failed");
    const blob = await vid.blob();
    succeeded = true;
    onLog("Video ready (server render)", 100);
    return blob;
  } finally {
    /* Free storage on success or user cancel. On other failures keep
       the chunks — a retry of the same spec resumes them (cron sweeps
       truly abandoned jobs after 24h). */
    if (succeeded || ctrl.signal.aborted) {
      const job = loadJob();
      if (job) void deleteJob(job.jobId);
      saveJob(null);
    }
    handleRef.current = null;
  }
}
