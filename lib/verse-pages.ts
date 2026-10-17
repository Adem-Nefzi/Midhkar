/**
 * verse-pages.ts
 *
 * Splits long verses into readable pages, timed to the recitation.
 * Pure + dependency-free: imported by the local generator, the live
 * previews and the spec builder for the server render.
 *
 * Timing: when word-level segments from the qdc API are available
 * (reciters 1-12), each page's window is derived from the FIRST
 * occurrence of its first word and the LAST occurrence of its last
 * word (reciters repeat phrases — merged spans absorb the repeat and
 * the page stays visible through it). Without segments the windows
 * are proportional to Arabic character counts — close enough for
 * everyayah-only reciters.
 */

export interface WordSegments {
  /** Verse audio length in ms in the qdc chapter timeline. */
  verseMs: number;
  /** [wordIndex(1-based), startMs, endMs] — may repeat indices. */
  segments: [number, number, number][];
}

/**
 * qdc segment timestamps are CHAPTER-ABSOLUTE (verse 2:255 starts at
 * ~6,153,050ms into Al-Baqarah) and occasionally malformed (2-element
 * entries). Normalize to verse-relative ms, drop malformed entries,
 * clamp to [0, verseMs]. Exported so the quran client and tests share
 * exactly this transformation.
 */
export function normalizeWordSegments(
  raw: unknown,
  verseStartMs: number,
  verseMs: number,
): [number, number, number][] {
  if (!Array.isArray(raw) || !(verseMs > 0)) return [];
  const from = Number.isFinite(verseStartMs) ? verseStartMs : 0;
  const out: [number, number, number][] = [];
  for (const s of raw) {
    if (!Array.isArray(s) || s.length < 3) continue;
    const [idx, a, b] = s as number[];
    if (!Number.isFinite(idx) || !Number.isFinite(a) || !Number.isFinite(b)) {
      continue;
    }
    let start = a - from;
    let end = b - from;
    if (start < 0) start = 0;
    if (end > verseMs) end = verseMs;
    if (end < start) continue;
    out.push([idx, start, end]);
  }
  return out;
}

export interface VersePage {
  /** Arabic text of this page (words joined). */
  aText: string;
  /** Proportional slice of the translation for this page's window. */
  tText: string;
  /** Window inside the ayah's audio (seconds, 0-based). */
  startSec: number;
  endSec: number;
}

/* Auto-split only kicks in for genuinely long verses — short verses
   (the overwhelming majority) return a single full page unchanged. */
export const SPLIT_MIN_WORDS = 18;
export const SPLIT_MIN_CHARS = 200;

const TARGET_PAGE_SEC = 5;
const MIN_WORDS_PER_PAGE = 3;
const MAX_WORDS_PER_PAGE = 12;
const MAX_CHARS_PER_PAGE = 170;
const MIN_PAGE_SEC = 0.8;

/* Standalone Quranic annotation tokens (pause marks etc.) — qdc's word
   segmentation EXCLUDES these, so they must not consume a word index. */
const MARK_TOKEN_RE = /^[\u06D6-\u06ED]+$/;
/* Waqf marks that end a clause — preferred page-break landmarks. */
const WAQF_END_RE = /[\u06D6\u06D7\u06DA\u06DC\u06E9]$/;

export function tokenizeArabic(arabic: string): string[] {
  return arabic.trim().split(/\s+/).filter(Boolean);
}

export function needsSplit(arabic: string): boolean {
  const words = tokenizeArabic(arabic);
  return words.length > SPLIT_MIN_WORDS || arabic.length > SPLIT_MIN_CHARS;
}

/** Numeric word coverage of the segments (null when unusable). */
function wordSpans(
  segments: WordSegments | null | undefined,
  wordCount: number,
): [number, number][] | null {
  if (!segments || !segments.segments.length || segments.verseMs <= 0) {
    return null;
  }
  const spans: ([number, number] | null)[] = new Array(wordCount).fill(null);
  for (const seg of segments.segments) {
    if (!Array.isArray(seg) || seg.length < 3) return null;
    const [idx, s0, s1] = seg;
    if (!Number.isFinite(idx) || !Number.isFinite(s0) || !Number.isFinite(s1)) {
      return null;
    }
    /* Absolute (un-normalized) timestamps start past the verse length —
       bail to proportional rather than building absurd windows. */
    if (s0 >= segments.verseMs) return null;
    if (idx < 1 || idx > wordCount) return null;
    const end = Math.min(s1, segments.verseMs);
    const cur = spans[idx - 1];
    spans[idx - 1] = cur
      ? [Math.min(cur[0], s0), Math.max(cur[1], end)]
      : [s0, end];
  }
  for (const s of spans) if (!s) return null;
  return spans as [number, number][];
}

/** Token index → content (non-mark) word index, before-position. */
function contentIndexBefore(tokens: string[], tokenIdx: number): number {
  let n = 0;
  for (let i = 0; i < tokenIdx; i++) if (!MARK_TOKEN_RE.test(tokens[i])) n++;
  return n;
}

/** Even word distribution into n pages (+1 words on the first `extra`). */
function evenBoundaries(len: number, n: number): number[] {
  const base = Math.floor(len / n);
  const extra = len % n;
  const bounds: number[] = [0];
  let acc = 0;
  for (let i = 0; i < n; i++) {
    acc += base + (i < extra ? 1 : 0);
    bounds.push(acc);
  }
  return bounds;
}

/** Nudge interior boundaries toward waqf marks / away from leading marks. */
function nudgeBoundaries(tokens: string[], bounds: number[]): number[] {
  const out = [...bounds];
  for (let i = 1; i < out.length - 1; i++) {
    const prev = out[i - 1];
    const next = out[i + 1];
    let best = out[i];
    let bestScore = Infinity;
    for (let d = 0; d <= 2; d++) {
      for (const c of d === 0 ? [out[i]] : [out[i] - d, out[i] + d]) {
        if (c <= prev + MIN_WORDS_PER_PAGE - 1) continue;
        if (c >= next - (MIN_WORDS_PER_PAGE - 1)) continue;
        if (MARK_TOKEN_RE.test(tokens[c] ?? "")) continue; // never start a page with a mark
        const prevToken = tokens[c - 1] ?? "";
        const score = d * 2 + (WAQF_END_RE.test(prevToken) ? 0 : 1);
        if (score < bestScore) {
          bestScore = score;
          best = c;
        }
      }
    }
    out[i] = best;
  }
  return out;
}

function translationSlice(
  translation: string,
  fromSec: number,
  toSec: number,
  durationSec: number,
  isFirst: boolean,
  isLast: boolean,
): string {
  const t = translation.trim();
  if (!t || durationSec <= 0) return isFirst ? t : "";
  if (isFirst && isLast) return t;
  const tLen = t.length;
  let c0 = isFirst ? 0 : Math.floor((fromSec / durationSec) * tLen);
  let c1 = isLast ? tLen : Math.ceil((toSec / durationSec) * tLen);
  if (c0 > 0) {
    const space = t.indexOf(" ", c0);
    c0 = space === -1 ? c0 : space + 1;
  }
  if (c1 < tLen) {
    const space = t.lastIndexOf(" ", c1);
    if (space > c0) c1 = space;
  }
  if (c1 < c0) c1 = c0;
  return t.slice(c0, c1).trim();
}

export function splitIntoPages(opts: {
  arabic: string;
  translation: string;
  durationSec: number;
  segments?: WordSegments | null;
}): VersePage[] {
  const { arabic, translation, durationSec } = opts;
  const tokens = tokenizeArabic(arabic);
  const single = (): VersePage[] => [
    { aText: arabic, tText: translation, startSec: 0, endSec: durationSec },
  ];
  if (tokens.length < 2 || durationSec <= 0 || !needsSplit(arabic)) {
    return single();
  }

  const totalChars = tokens.reduce((a, w) => a + w.length + 1, 0);
  const bySec = Math.max(1, Math.round(durationSec / TARGET_PAGE_SEC));
  const byWords = Math.ceil(tokens.length / MAX_WORDS_PER_PAGE);
  const byChars = Math.ceil(totalChars / MAX_CHARS_PER_PAGE);
  let n = Math.max(bySec, byWords, byChars);
  n = Math.min(n, Math.ceil(tokens.length / MIN_WORDS_PER_PAGE), tokens.length);
  if (n <= 1) return single();

  const bounds = nudgeBoundaries(tokens, evenBoundaries(tokens.length, n));

  /* Window per page: precise from qdc word spans when they cover every
     content word exactly once, proportional by chars otherwise. */
  const contentCount = tokens.filter((w) => !MARK_TOKEN_RE.test(w)).length;
  const spans = wordSpans(opts.segments, contentCount);
  const scale = spans ? (durationSec * 1000) / opts.segments!.verseMs : 0;

  const startOfToken = (tokenIdx: number): number => {
    if (tokenIdx <= 0) return 0;
    if (!spans) {
      const cum = tokens
        .slice(0, tokenIdx)
        .reduce((a, w) => a + w.length + 1, 0);
      return (cum / totalChars) * durationSec;
    }
    const ci = contentIndexBefore(tokens, tokenIdx);
    if (ci >= spans.length) return durationSec;
    return (spans[ci][0] * scale) / 1000;
  };
  const endOfTokenRange = (tokenEndExclusive: number): number => {
    if (tokenEndExclusive >= tokens.length) return durationSec;
    return startOfToken(tokenEndExclusive);
  };

  const pages: VersePage[] = [];
  let prevEnd = 0;
  for (let p = 0; p < bounds.length - 1; p++) {
    const s = bounds[p];
    const e = bounds[p + 1];
    const isFirst = p === 0;
    const isLast = p === bounds.length - 2;
    let start = isFirst ? 0 : startOfToken(s);
    let end = isLast ? durationSec : endOfTokenRange(e);
    if (start < prevEnd) start = prevEnd;
    if (end <= start + 0.05) end = Math.min(start + MIN_PAGE_SEC, durationSec);
    if (end <= start) end = start + 0.05;
    if (isLast) end = durationSec;
    prevEnd = end;
    pages.push({
      aText: tokens.slice(s, e).join(" "),
      tText: translationSlice(translation, start, end, durationSec, isFirst, isLast),
      startSec: start,
      endSec: end,
    });
  }
  return pages;
}

/** Index of the page visible at `sec` (clamped to both ends). */
export function pageIndexAt(pages: VersePage[], sec: number): number {
  let i = 0;
  for (let k = 0; k < pages.length; k++) {
    if (sec >= pages[k].startSec) i = k;
    else break;
  }
  return i;
}
