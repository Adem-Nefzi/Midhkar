"use client";
/**
 * render-client.ts — cloud render API client with automatic local
 * fallback. Mirrors the generateVideo() contract: progress via onLog,
 * returns a Blob. Any failure (host asleep, timeout, HTTP error,
 * unsupported feature) rejects — the caller falls back to the existing
 * WebCodecs pipeline.
 */

const RENDER_API_URL = process.env.NEXT_PUBLIC_RENDER_API_URL ?? "";
const RENDER_TIMEOUT_MS = 5 * 60 * 1000; // hard ceiling for whole job
const NO_PROGRESS_TIMEOUT_MS = 45_000; // no milestone → assume host died
const HEALTH_WAKE_TIMEOUT_MS = 40_000; // cold-start wake budget
const MAX_CLOUD_DURATION_MIN = 10;

export interface CloudAyahSpec {
  key: string;
  numberInSurah: number;
  text: string;
  translation: string;
}

export interface CloudRenderSpec {
  ayahs: CloudAyahSpec[];
  surah: { number: string; name: string; englishName: string };
  reciter: { quranApiNo: number; everyayahFolder: string; primary: boolean };
  settings: Record<string, unknown>;
  platform: { aspect: "16:9" | "9:16" | "1:1"; id: string };
  bg: { mode: "pexels" | "upload" | "none"; urls?: string[]; uploadId?: string };
  quality: { isLowPower: boolean };
}

export function cloudRenderConfigured(): boolean {
  return RENDER_API_URL.length > 0;
}

/** Quick wake-ping with a generous budget for HF cold starts. */
export async function cloudRenderAwake(): Promise<boolean> {
  if (!cloudRenderConfigured()) return false;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), HEALTH_WAKE_TIMEOUT_MS);
  try {
    const r = await fetch(`${RENDER_API_URL}/api/health`, {
      signal: ctrl.signal,
    });
    return r.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/** Upload a background video file; returns uploadId or null. */
export async function uploadBgVideo(
  file: File,
  onLog?: (msg: string, pct: number) => void,
): Promise<string | null> {
  try {
    onLog?.("Uploading background video…", 8);
    const r = await fetch(`${RENDER_API_URL}/api/upload`, {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream" },
      body: file,
    });
    if (!r.ok) return null;
    const { uploadId } = (await r.json()) as { uploadId: string };
    return uploadId;
  } catch {
    return null;
  }
}

export interface CloudRenderHandle {
  cancel: () => void;
}

/**
 * Render server-side. Resolves with the MP4 Blob.
 * Rejects on ANY failure — caller must fall back to local rendering.
 */
export async function renderVideoCloud(
  spec: CloudRenderSpec,
  onLog: (msg: string, pct: number) => void,
  handleRef: { current: CloudRenderHandle | null },
): Promise<Blob> {
  if (!cloudRenderConfigured()) throw new Error("Cloud render not configured");

  const ctrl = new AbortController();
  handleRef.current = { cancel: () => ctrl.abort() };

  const t0 = Date.now();
  try {
    onLog("Contacting render service…", 2);
    const res = await fetch(`${RENDER_API_URL}/api/render`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(spec),
      signal: ctrl.signal,
    });
    if (res.status === 429) throw new Error("Render queue is full");
    if (!res.ok) throw new Error(`Render service error (${res.status})`);
    const { jobId } = (await res.json()) as { jobId: string };

    onLog("Queued — rendering on the server…", 4);

    const sse = await fetch(`${RENDER_API_URL}/api/render/${jobId}`, {
      signal: ctrl.signal,
    });
    if (!sse.ok || !sse.body) throw new Error("Progress stream failed");

    const reader = sse.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    let lastMilestone = Date.now();

    const deadline = setTimeout(() => ctrl.abort(), RENDER_TIMEOUT_MS);
    const watchdog = setInterval(() => {
      if (Date.now() - lastMilestone > NO_PROGRESS_TIMEOUT_MS) {
        ctrl.abort();
      }
    }, 5000);

    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const events = buf.split("\n\n");
        buf = events.pop() ?? "";
        for (const ev of events) {
          if (ev.startsWith("event: error")) {
            const data = ev.split("\n").find((l) => l.startsWith("data: "))?.slice(6);
            const message = data ? (JSON.parse(data) as { message: string }).message : "Render failed";
            throw new Error(message || "Render failed");
          }
          if (ev.startsWith("event: cancelled")) {
            throw new DOMException("Aborted", "AbortError");
          }
          if (ev.startsWith("event: done")) {
            onLog("Downloading your video…", 98);
            const vid = await fetch(`${RENDER_API_URL}/api/render/${jobId}/video`, {
              signal: ctrl.signal,
            });
            if (!vid.ok) throw new Error("Video download failed");
            const blob = await vid.blob();
            onLog("Video ready (cloud render)", 100);
            return blob;
          }
          const dataLine = ev.split("\n").find((l) => l.startsWith("data: "));
          if (dataLine) {
            lastMilestone = Date.now();
            const p = JSON.parse(dataLine.slice(6)) as { msg: string; pct: number };
            onLog(`☁ ${p.msg}`, Math.max(2, p.pct));
          }
        }
      }
      throw new Error("Progress stream ended unexpectedly");
    } finally {
      clearTimeout(deadline);
      clearInterval(watchdog);
    }
  } finally {
    handleRef.current = null;
    void t0;
  }
}
