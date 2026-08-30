"use client";
/**
 * settings/library-search.tsx — curated Pexels video search used by the
 * Settings step's Library tab. Split out of StepSettings.tsx to keep that
 * file focused on the picker/customise UI.
 */

import { useRef, useState, useCallback, useEffect } from "react";
import { Spinner } from "../icons";
import { searchPexelsVideos } from "@/lib/pexels-client";
import type { PexelsVideo } from "@/lib/pexels-client";
import {
  fetchVideoDuration,
  getCachedVideoDuration,
} from "@/lib/video-meta";

/* ── Simple playlist totals — "3 videos · 1:25 / 1:40 needed  [Clear all]" ── */
function PlaylistTotals({
  urls,
  totalSec,
  ar,
  locale,
  onClearAll,
}: {
  urls: string[];
  totalSec: number | null;
  ar: boolean;
  locale: string;
  onClearAll: () => void;
}) {
  let sumSec = 0;
  for (const u of urls) sumSec += getCachedVideoDuration(u) ?? 0;
  useEffect(() => {
    urls.forEach((u) => {
      if (getCachedVideoDuration(u) === null) fetchVideoDuration(u);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urls.join("|")]);

  if (!urls.length) return null;

  const mm = (n: number) =>
    `${Math.floor(n / 60)}:${String(Math.round(n) % 60).padStart(2, "0")}`;
  const enough = totalSec !== null && sumSec >= totalSec;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-1 pt-1 text-[13px] text-parchment-muted/80">
      <span>
        {urls.length}{" "}
        {ar
          ? urls.length > 2
            ? "فيديوهات"
            : "فيديو"
          : locale === "fr"
            ? urls.length > 1
              ? "vidéos"
              : "vidéo"
            : urls.length === 1
              ? "video"
              : "videos"}
        {" · "}
        {mm(sumSec)}
        {totalSec !== null && (
          <>
            <span className="text-gold/70"> / </span>
            {mm(totalSec)}{" "}
            {ar ? "مطلوب" : locale === "fr" ? "requis" : "needed"}
            <span className={enough ? "text-verdant" : "text-gold"}>
              {enough
                ? " ✓"
                : ` (+${mm(totalSec - sumSec)} ${ar ? "ناقص" : locale === "fr" ? "manquant" : "short"})`}
            </span>
          </>
        )}
      </span>
      <button
        type="button"
        onClick={onClearAll}
        className="inline-flex items-center gap-1 text-red-400/90 transition hover:text-red-300"
      >
        <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
        {ar ? "مسح الكل" : locale === "fr" ? "Tout effacer" : "Clear all"}
      </button>
    </div>
  );
}

const LIBRARY_CATEGORIES = [
  "nature",
  "ocean",
  "mountains",
  "forest",
  "sunset",
  "city",
  "space",
  "rain",
  "snow",
  "desert",
  "flowers",
  "waterfall",
  "clouds",
  "stars",
  "mosque",
];

export function LibrarySearch({
  ar,
  fr,
  selected,
  onSelect,
  onRemove,
  onClear,
  totalSec,
  locale,
}: {
  ar: boolean;
  fr: boolean;
  selected: string[];
  onSelect: (url: string) => void;
  onRemove: (url: string) => void;
  onClear: () => void;
  totalSec: number | null;
  locale: string;
}) {
  const [query, setQuery] = useState("nature");
  const [results, setResults] = useState<PexelsVideo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  // Aborts the previous request when a new one starts; the sequence number
  // drops out-of-order responses so a slow page-1 can't clobber page-2.
  const searchCtrlRef = useRef<AbortController | null>(null);
  const searchSeqRef = useRef(0);

  useEffect(() => {
    return () => searchCtrlRef.current?.abort();
  }, []);

  const doSearch = useCallback(
    async (q: string, p: number, append: boolean) => {
      searchCtrlRef.current?.abort();
      const ctrl = new AbortController();
      searchCtrlRef.current = ctrl;
      const seq = ++searchSeqRef.current;
      setLoading(true);
      setError(null);
      try {
        const data = await searchPexelsVideos(q, p, ctrl.signal);
        if (seq !== searchSeqRef.current) return;
        setResults((prev) => {
          const base = append ? prev : [];
          const seen = new Set(base.map((v) => v.id));
          return [
            ...base,
            ...data.videos.filter((v) => {
              if (seen.has(v.id)) return false;
              seen.add(v.id);
              return true;
            }),
          ];
        });
        setHasMore(!!data.nextPage && data.videos.length > 0);
      } catch (err: any) {
        if (seq !== searchSeqRef.current) return;
        if (err?.name === "AbortError") return;
        setError(err?.message ?? "Search failed");
      } finally {
        if (seq === searchSeqRef.current) setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    const t = setTimeout(() => doSearch(query, 1, false), 400);
    return () => clearTimeout(t);
  }, [query, doSearch]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore || loading) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          const next = page + 1;
          setPage(next);
          doSearch(query, next, true);
        }
      },
      { rootMargin: "200px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMore, loading, page, query, doSearch]);

  return (
    <div className="space-y-3 rounded-xl border border-gold/15 bg-ink-soft/20 p-4">
      <div className="mb-1 flex items-center justify-between">
        <p className="text-[13px] uppercase tracking-wider text-parchment-muted">
          {ar ? "المكتبة — بحث الفيديو" : fr ? "Bibliothèque — recherche" : "Library — video search"}
        </p>
        <a
          href="https://www.pexels.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-parchment-muted/40 transition hover:text-gold/60"
        >
          {ar ? "فيديوهات من بكسلز" : fr ? "Vidéos par Pexels" : "Videos by Pexels"}
        </a>
      </div>

      <div className="group relative">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
          placeholder={
            ar
              ? "ابحث: طبيعة، محيط، جبال…"
              : fr
                ? "Rechercher : nature, océan, montagnes…"
                : "Search: nature, ocean, mountains…"
          }
          className="w-full rounded-2xl border border-gold/20 bg-ink-light/60 px-4 py-3.5 pl-11 text-sm text-parchment placeholder-parchment-dim outline-none transition-all focus:border-gold/55 focus:bg-ink-light/90 focus:ring-2 focus:ring-gold/15"
        />
        <svg
          className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gold/40 transition-colors group-focus-within:text-gold/80"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14z"
          />
        </svg>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {LIBRARY_CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => {
              setQuery(cat);
              setPage(1);
            }}
            className={`rounded-full border px-2.5 py-1 text-[13px] capitalize transition-all ${
              query === cat
                ? "border-gold/40 bg-gold/15 text-gold"
                : "border-gold/10 text-parchment-muted/60 hover:border-gold/25 hover:text-parchment"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {loading && results.length === 0 ? (
        <div className="flex justify-center py-6">
          <Spinner className="h-5 w-5 text-gold" />
        </div>
      ) : error ? (
        <p className="py-3 text-center text-[13px] text-red-400">{error}</p>
      ) : results.length === 0 ? (
        <p className="py-4 text-center text-[13px] text-parchment-muted/40">
          {ar ? "لا توجد نتائج" : fr ? "Aucun résultat" : "No results found"}
        </p>
      ) : (
        <div className="custom-scrollbar max-h-64 overflow-y-auto">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {results.map((v) => {
              const idx = selected.indexOf(v.videoUrl);
              const isSel = idx !== -1;
              return (
                <button
                  key={v.id}
                  onClick={() =>
                    isSel ? onRemove(v.videoUrl) : onSelect(v.videoUrl)
                  }
                  className={`group relative aspect-video overflow-hidden rounded-lg border-2 transition-all ${
                    isSel
                      ? "border-gold ring-2 ring-gold/30"
                      : "border-gold/10 hover:border-gold/30"
                  }`}
                >
                  <img
                    src={v.image}
                    alt={v.photographer}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <span className="pointer-events-none absolute bottom-1.5 right-1.5 rounded bg-black/70 px-1.5 py-0.5 text-xs font-medium text-parchment/90 backdrop-blur-sm">
                    {Math.floor(v.duration / 60)}:
                    {(v.duration % 60).toString().padStart(2, "0")}
                  </span>
                  <span className="pointer-events-none absolute left-1.5 top-1.5 rounded bg-gold/20 px-1.5 py-0.5 text-xs font-medium text-gold backdrop-blur-sm">
                    {v.width}×{v.height}
                  </span>
                  {isSel && (
                    <>
                      <div className="absolute inset-0 bg-gold/10" />
                      <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-gold text-[13px] font-bold text-ink shadow">
                        {idx + 1}
                      </span>
                    </>
                  )}
                </button>
              );
            })}
          </div>
          {hasMore && (
            <div ref={sentinelRef} className="flex justify-center py-4">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-gold/20 border-t-gold" />
            </div>
          )}
        </div>
      )}

      {selected.length > 0 && (
        <PlaylistTotals
          urls={selected}
          totalSec={totalSec}
          ar={ar}
          locale={locale}
          onClearAll={onClear}
        />
      )}
    </div>
  );
}
