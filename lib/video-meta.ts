/**
 * video-meta.ts — tiny shared metadata cache for background videos.
 * Only fetches `loadedmetadata` (a few KB), so summing playlist durations
 * is cheap. Safe on mobile (dedupes in-flight + caches results).
 *
 * Failures are cached with a short TTL only — a transient CDN hiccup must
 * not poison a clip's duration for the whole session (that's what kept the
 * playlist total stuck at 0:00).
 */

interface Entry {
  val: number | null;
  at: number;
}

const _cache = new Map<string, Entry>();
const _pending = new Map<string, Promise<number | null>>();
const NEGATIVE_TTL_MS = 60_000;

function read(url: string): number | null | undefined {
  const entry = _cache.get(url);
  if (!entry) return undefined;
  if (entry.val === null && Date.now() - entry.at > NEGATIVE_TTL_MS) {
    _cache.delete(url);
    return undefined;
  }
  return entry.val;
}

export function getCachedVideoDuration(url: string): number | null {
  const v = read(url);
  return v === undefined ? null : v;
}

export function fetchVideoDuration(url: string): Promise<number | null> {
  const cached = read(url);
  if (cached !== undefined) return Promise.resolve(cached);

  const inflight = _pending.get(url);
  if (inflight) return inflight;

  const promise = new Promise<number | null>((resolve) => {
    const v = document.createElement("video");
    let finished = false;
    const done = (val: number | null) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      _cache.set(url, { val, at: Date.now() });
      _pending.delete(url);
      v.removeAttribute("src");
      resolve(val);
    };
    // Listeners attached before touching `src`, so fast CDN metadata events
    // can never slip through and leave the sum stuck.
    v.addEventListener("loadedmetadata", () =>
      done(isFinite(v.duration) && v.duration > 0 ? v.duration : null),
    );
    v.addEventListener("error", () => done(null));
    // Safety timeout — never hang the UI if the CDN is slow.
    const timer = setTimeout(() => done(null), 15000);
    v.muted = true;
    v.preload = "metadata";
    v.src = url;
    if (v.readyState >= 1 && isFinite(v.duration) && v.duration > 0) {
      done(v.duration);
    }
  });

  _pending.set(url, promise);
  return promise;
}
