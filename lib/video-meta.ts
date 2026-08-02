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
    v.preload = "metadata";
    v.muted = true;
    v.src = url;
    const done = (val: number | null) => {
      _cache.set(url, val);
      v.src = "";
      resolve(val);
    };
    v.addEventListener("loadedmetadata", () =>
      done(isFinite(v.duration) && v.duration > 0 ? v.duration : null),
    );
    v.addEventListener("error", () => done(null));
    // Safety timeout — never hang the summary if the CDN is slow.
    setTimeout(() => done(null), 15000);
  });
}
