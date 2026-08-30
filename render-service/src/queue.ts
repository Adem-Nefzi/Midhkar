/**
 * queue.ts — in-memory render job queue.
 * Max 2 concurrent renders; jobs TTL'd; dedupe by spec hash; SSE
 * subscriber fan-out with the exact client log milestones.
 */
import { createHash, randomUUID } from "node:crypto";
import { renderVideo, type RenderJobSpec } from "./render";

export type JobStatus = "queued" | "rendering" | "done" | "error" | "cancelled";

export interface Job {
  id: string;
  spec: RenderJobSpec;
  status: JobStatus;
  progress: { msg: string; pct: number }[];
  createdAt: number;
  finishedAt: number | null;
  result: Buffer | null;
  error: string | null;
  controller: AbortController;
  dedupeKey: string;
}

const MAX_CONCURRENT = 2;
const JOB_TTL_MS = 30 * 60 * 1000;
const jobs = new Map<string, Job>();
const uploadStore = new Map<string, { buf: Buffer; createdAt: number }>();
const UPLOAD_TTL_MS = 30 * 60 * 1000;

function specHash(spec: RenderJobSpec): string {
  return createHash("sha256").update(JSON.stringify(spec)).digest("hex").slice(0, 24);
}

export function newId(): string {
  return randomUUID().replace(/-/g, "").slice(0, 20) + Date.now().toString(36);
}

export function createUpload(buf: Buffer): string {
  const id = newId();
  uploadStore.set(id, { buf, createdAt: Date.now() });
  return id;
}

export function getUpload(id: string): Buffer | null {
  const u = uploadStore.get(id);
  return u ? u.buf : null;
}

export function queueSize(): { active: number; waiting: number } {
  let active = 0;
  let waiting = 0;
  for (const j of jobs.values()) {
    if (j.status === "rendering") active++;
    else if (j.status === "queued") waiting++;
  }
  return { active, waiting };
}

export function enqueue(spec: RenderJobSpec): Job {
  // Dedupe: same spec still running/done recently → return existing
  const key = specHash(spec);
  for (const j of jobs.values()) {
    if (j.dedupeKey === key && (j.status === "queued" || j.status === "rendering")) {
      return j;
    }
  }
  const job: Job = {
    id: newId(),
    spec,
    status: "queued",
    progress: [],
    createdAt: Date.now(),
    finishedAt: null,
    result: null,
    error: null,
    controller: new AbortController(),
    dedupeKey: key,
  };
  jobs.set(job.id, job);
  pump();
  return job;
}

export function getJob(id: string): Job | null {
  return jobs.get(id) ?? null;
}

export function cancelJob(id: string): boolean {
  const job = jobs.get(id);
  if (!job || (job.status !== "queued" && job.status !== "rendering")) return false;
  job.controller.abort();
  job.status = "cancelled";
  job.finishedAt = Date.now();
  return true;
}

let pumping = false;
async function pump(): Promise<void> {
  if (pumping) return;
  pumping = true;
  try {
    while (true) {
      const { active } = queueSize();
      if (active >= MAX_CONCURRENT) break;
      const next = [...jobs.values()]
        .filter((j) => j.status === "queued")
        .sort((a, b) => a.createdAt - b.createdAt)[0];
      if (!next) break;
      runJob(next);
    }
  } finally {
    pumping = false;
  }
}

async function runJob(job: Job): Promise<void> {
  job.status = "rendering";
  try {
    const result = await renderVideo(
      job.spec,
      (msg, pct) => {
        job.progress.push({ msg, pct });
        if (job.progress.length > 60) job.progress.shift();
      },
      job.controller.signal,
      new Map([...uploadStore].map(([k, v]) => [k, v.buf])),
    );
    job.result = result.buffer;
    job.status = "done";
  } catch (e) {
    if (job.controller.signal.aborted) {
      job.status = "cancelled";
    } else {
      job.status = "error";
      job.error = e instanceof Error ? e.message : String(e);
      console.error("[render]", job.id, job.error);
    }
  } finally {
    job.finishedAt = Date.now();
    pump();
  }
}

/* Periodic TTL cleanup */
setInterval(
  () => {
    const now = Date.now();
    for (const [id, job] of jobs) {
      if (job.finishedAt && now - job.finishedAt > JOB_TTL_MS) {
        job.result = null;
        jobs.delete(id);
      }
    }
    for (const [id, u] of uploadStore) {
      if (now - u.createdAt > UPLOAD_TTL_MS) uploadStore.delete(id);
    }
  },
  60 * 1000,
).unref();
