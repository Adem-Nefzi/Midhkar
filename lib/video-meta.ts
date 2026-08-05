/**
 * video-meta.ts — tiny shared metadata cache for background videos.
 * Only fetches `loadedmetadata` (a few KB), so summing playlist durations
 * is cheap. Safe on mobile (short-circuits in-flight + caches results).
 */

const _cache = new Map<string, number | null>();

export function getCachedVideoDuration(url: string): number | null {
  const v = _cache.get(url);
  return v === undefined ? null : v;
}

export function fetchVideoDuration(url: string): Promise<number | null> {
  const cached = _cache.get(url);
  if (cached !== undefined) return Promise.resolve(cached);

  return new Promise((resolve) => {
    const v = document.createElement("video");
    let finished = false;
    const done = (val: number | null) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      _cache.set(url, val);
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
}
