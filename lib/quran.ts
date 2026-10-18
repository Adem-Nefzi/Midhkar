/**
 * quran.ts
 *
 * All data sourced from the Quran Foundation API (api.quran.com/api/v4).
 * Public content endpoints — no OAuth2 required.
 * Per-ayah audio from the Quran Foundation CDN (everyayah.com / quranicaudio.com).
 */

import type { WordSegments } from "./verse-pages";
import { normalizeWordSegments } from "./verse-pages";

const API_BASE = "https://api.quran.com/api/v4";

export interface Surah {
  number: number;
  name: string;
  englishName: string;
  englishNameTranslation: string;
  numberOfAyahs: number;
  revelationType: string;
}

export interface Ayah {
  number: number;
  numberInSurah: number;
  text: string;
  audio?: string;
  translation?: string;
  juz: number;
  page: number;
  sajda: boolean;
  /** Set on synthetic per-page ayah objects (verse pager ornament). */
  pageInfo?: { index: number; total: number };
}

export interface Reciter {
  identifier: string;
  name: string;
  englishName: string;
  quranApiNo?: number;
  primary?: boolean;
  source: "alquran" | "quranapi" | "everyayah";
}

export const TEXT_POSITIONS = [
  { id: "top", label: "Top" },
  { id: "center", label: "Center" },
  { id: "bottom", label: "Bottom" },
];

export const VERSE_PRESETS = [
  { id: "first-3", label: "First 3" },
  { id: "first-5", label: "First 5" },
  { id: "first-10", label: "First 10" },
  { id: "first-20", label: "First 20" },
  { id: "full", label: "Full Surah" },
];

/* ── Reciter mapping (Quran Foundation recitation IDs → audio CDNs) ──
   IDs and names realigned to api.quran.com/api/v4/resources/recitations
   (the source of truth). CDN coverage probed per reciter (2026-08):
   only ids 1–5 still have live the-quran-project Data/<id>/ folders —
   `primary: true`; the rest are everyayah-only (`primary` omitted) and
   getAudioUrlCandidates() skips the dead CDN for them.

   IDs ≥ 101 are everyayah-only MANUAL entries (not in the QF recitations
   API): synthetic ids keep the keyed lookup for getAudioUrlCandidates /
   getEveryayahFolder working, and never collide with real QF ids (1-12).
   They have NO qdc word-timing segments — the verse pager falls back to
   proportional (character-count) timing for them. */
const QURAN_FOUNDATION_RECITERS: Record<
  number,
  { englishName: string; name: string; everyayahFolder: string; primary?: boolean }
> = {
  1: {
    englishName: "AbdulBaset AbdulSamad (Mujawwad)",
    name: "عبد الباسط عبد الصمد (مجوّد)",
    everyayahFolder: "Abdul_Basit_Mujawwad_128kbps",
    primary: true,
  },
  7: {
    englishName: "Mishari Rashid al-Afasy",
    name: "مشاري العفاسي",
    everyayahFolder: "Alafasy_128kbps",
  },
  2: {
    englishName: "AbdulBaset AbdulSamad",
    name: "عبد الباسط عبد الصمد",
    everyayahFolder: "Abdul_Basit_Murattal_192kbps",
    primary: true,
  },
  3: {
    englishName: "Abdur-Rahman as-Sudais",
    name: "عبد الرحمن السديس",
    everyayahFolder: "Abdurrahmaan_As-Sudais_192kbps",
    primary: true,
  },
  4: {
    englishName: "Abu Bakr al-Shatri",
    name: "أبو بكر الشاطري",
    everyayahFolder: "Abu_Bakr_Ash-Shaatree_128kbps",
    primary: true,
  },
  5: {
    englishName: "Hani ar-Rifai",
    name: "هاني الرفاعي",
    everyayahFolder: "Hani_Rifai_192kbps",
    primary: true,
  },
  6: {
    englishName: "Mahmoud Khalil Al-Husary",
    name: "محمود خليل الحصري",
    everyayahFolder: "Husary_128kbps",
  },
  8: {
    englishName: "Mohamed Siddiq al-Minshawi (Mujawwad)",
    name: "محمد صديق المنشاوي (مجوّد)",
    everyayahFolder: "Minshawy_Mujawwad_192kbps",
  },
  9: {
    englishName: "Mohamed Siddiq al-Minshawi",
    name: "محمد صديق المنشاوي",
    everyayahFolder: "Minshawy_Murattal_128kbps",
  },
  10: {
    englishName: "Saud ash-Shuraym",
    name: "سعود الشريم",
    everyayahFolder: "Saood_ash-Shuraym_128kbps",
  },
  11: {
    englishName: "Mohamed al-Tablawi",
    name: "محمد الطبلاوي",
    everyayahFolder: "Mohammad_al_Tablaway_128kbps",
  },
  12: {
    englishName: "Mahmoud Khalil Al-Husary (Muallim)",
    name: "محمود خليل الحصري (المعلّم)",
    everyayahFolder: "Husary_Muallim_128kbps",
  },
  /* ── Manual everyayah-only additions (ids ≥ 101) — folders probed 2026-10 ── */
  101: {
    englishName: "Maher al-Muaiqly",
    name: "ماهر المعيقلي",
    everyayahFolder: "MaherAlMuaiqly128kbps",
  },
  102: {
    englishName: "Muhammad Ayyub",
    name: "محمد أيوب",
    everyayahFolder: "Muhammad_Ayyoub_128kbps",
  },
  103: {
    englishName: "Yasser ad-Dussary",
    name: "ياسر الدوسري",
    everyayahFolder: "Yasser_Ad-Dussary_128kbps",
  },
  104: {
    englishName: "Nasser al-Qatami",
    name: "ناصر القطامي",
    everyayahFolder: "Nasser_Alqatami_128kbps",
  },
  105: {
    englishName: "Ali al-Hudhaify",
    name: "علي الحذيفي",
    everyayahFolder: "Hudhaify_128kbps",
  },
  106: {
    englishName: "Mahmoud Khalil Al-Husary (Mujawwad)",
    name: "محمود خليل الحصري (مجوّد)",
    everyayahFolder: "Husary_Mujawwad_64kbps",
  },
  107: {
    englishName: "Saad al-Ghamidi",
    name: "سعد الغامدي",
    everyayahFolder: "Ghamadi_40kbps",
  },
  108: {
    englishName: "Abdul Muhsin al-Qasim",
    name: "عبد المحسن القاسم",
    everyayahFolder: "Muhsin_Al_Qasim_192kbps",
  },
  109: {
    englishName: "Fares Abbad",
    name: "فارس عباد",
    everyayahFolder: "Fares_Abbad_64kbps",
  },
  110: {
    englishName: "Salah al-Budair",
    name: "صلاح البدير",
    everyayahFolder: "Salah_Al_Budair_128kbps",
  },
};

/* ── Translation resource IDs (Quran Foundation API) ─────────────────── */
const TRANSLATION_IDS: Record<string, number> = {
  en: 20, // Saheeh International
  fr: 31, // Muhammad Hamidullah
  ar: 0, // No translation for Arabic
};

const FETCH_TIMEOUT_MS = 10_000;

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const cacheKey = `midhkar:${url}`;
  try {
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) return JSON.parse(cached) as T;
  } catch {
    /* sessionStorage unavailable */
  }

  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    try {
      const res = await fetch(url, {
        signal: signal ?? AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      try {
        sessionStorage.setItem(cacheKey, JSON.stringify(data));
      } catch {
        /* quota exceeded — don't block */
      }
      return data;
    } catch (err) {
      if (signal?.aborted) throw err;
      lastErr = err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

/* ── Surahs ──────────────────────────────────────────────────────── */
export async function fetchSurahs(): Promise<Surah[]> {
  const data = await fetchJson<any>(`${API_BASE}/chapters?language=en`);
  const chapters = data.chapters || [];
  return chapters.map((c: any) => ({
    number: c.id,
    name: c.name_arabic,
    englishName: c.name_simple,
    englishNameTranslation: c.translated_name?.name || "",
    numberOfAyahs: c.verses_count,
    // API returns lowercase "makkah" / "madinah"; normalize to the labels
    // the UI filters and badges on.
    revelationType:
      String(c.revelation_place).toLowerCase() === "madinah"
        ? "Medinan"
        : "Meccan",
  }));
}

/* ── Reciters ────────────────────────────────────────────────────── */
export async function fetchReciters(): Promise<Reciter[]> {
  const results: Reciter[] = [];

  try {
    const data = await fetchJson<any>(
      `${API_BASE}/resources/recitations?language=en`,
    );
    const recitations = data.recitations || [];

    for (const r of recitations) {
    const mapped = QURAN_FOUNDATION_RECITERS[r.id];
    if (!mapped) continue;
    results.push({
      identifier: `quranapi-${r.id}`,
      englishName: mapped.englishName,
      name: mapped.name,
      quranApiNo: r.id,
      primary: mapped.primary ?? false,
      source: "quranapi",
    });
    }
  } catch {
    /* fall through to hardcoded */
  }

    // Fallback: use hardcoded reciters if API fails
    if (results.length === 0) {
      for (const [no, info] of Object.entries(QURAN_FOUNDATION_RECITERS)) {
        if (Number(no) >= 101) continue;
        results.push({
          identifier: `quranapi-${no}`,
          englishName: info.englishName,
          name: info.name,
          quranApiNo: Number(no),
          primary: info.primary ?? false,
          source: "quranapi",
        });
      }
    }

  /* Manual everyayah-only reciters (ids ≥ 101) — always offered,
     regardless of the QF API listing. */
  for (const [no, info] of Object.entries(QURAN_FOUNDATION_RECITERS)) {
    if (Number(no) < 101) continue;
    results.push({
      identifier: `everyayah-${no}`,
      englishName: info.englishName,
      name: info.name,
      quranApiNo: Number(no),
      primary: false,
      source: "everyayah",
    });
  }

  return results;
}

/* ── Ayahs (Uthmani text) + translation in ONE request ─────────── */
export async function fetchAyahs(
  surahNumber: number,
  lang: string = "ar",
  signal?: AbortSignal,
): Promise<Ayah[]> {
  const isAr = lang === "ar";
  const transId = isAr ? 0 : (TRANSLATION_IDS[lang] || 0);
  const transParam = transId ? `&translations=${transId}` : "";
  const data = await fetchJson<any>(
    `${API_BASE}/verses/by_chapter/${surahNumber}?language=en&words=false&fields=text_uthmani,juz_number,page_number,sajdah_number${transParam}&page=1&per_page=300`,
    signal,
  );
  const verses = data.verses || [];

  // Arabic "translation" = Tafsir Muyassar (resource 16), fetched per chapter.
  const tafsirMap: Record<string, string> = {};
  if (isAr) {
    try {
      const tData = await fetchJson<any>(
        `${API_BASE}/tafsirs/16/by_chapter/${surahNumber}?per_page=300`,
        signal,
      );
      for (const item of tData.tafsirs || []) {
        const key = item.verse_key || "";
        const txt = String(item.text || "").replace(/<[^>]+>/g, "").trim();
        if (key) tafsirMap[key] = txt;
      }
    } catch {
      /* fallback: empty translation */
    }
  }

  return verses.map((v: any) => {
    let translation = "";
    if (isAr) {
      translation =
        tafsirMap[v.verse_key] ||
        tafsirMap[`${surahNumber}:${v.verse_number}`] ||
        "";
    } else if (transId) {
      const raw =
        v.translations?.[0]?.text ||
        v.translations?.find((t: any) => t.resource_id === transId)?.text ||
        "";
      translation = raw.replace(/<[^>]+>/g, "");
    }
    return {
      number: v.id,
      numberInSurah: v.verse_number,
      text: v.text_uthmani || "",
      translation,
      juz: v.juz_number || 1,
      page: v.page_number || 1,
      sajda: !!v.sajdah_number,
    };
  });
}

/* ── Word-level verse timing (qdc) ─────────────────────────────────
   api.qurancdn.com is Quran.com's own audio CDN/API (same org as the
   data API) — it carries per-verse word segments for recitations 1-12.
   Used ONLY by the long-verse pager; every failure path degrades to
   proportional (character-count) timing, so nothing user-visible
   depends on this endpoint staying up. Cached per surah+reciter by the
   shared fetchJson sessionStorage cache. */

const QDC_BASE = "https://api.qurancdn.com/api/qdc";

export async function fetchVerseSegments(
  surahNumber: number,
  reciterNo: number,
  signal?: AbortSignal,
): Promise<Map<number, WordSegments> | null> {
  if (!reciterNo || reciterNo > 12) return null;
  try {
    const data = await fetchJson<any>(
      `${QDC_BASE}/audio/reciters/${reciterNo}/audio_files?chapter=${surahNumber}&segments=true`,
      signal,
    );
    const timings = data?.audio_files?.[0]?.verse_timings || [];
    const map = new Map<number, WordSegments>();
    for (const vt of timings) {
      const ayahNo = Number(String(vt?.verse_key || "").split(":")[1]);
      if (
        !ayahNo ||
        !Array.isArray(vt.segments) ||
        vt.segments.length === 0 ||
        typeof vt.timestamp_from !== "number" ||
        typeof vt.timestamp_to !== "number"
      ) {
        continue;
      }
      /* qdc segment timestamps are chapter-absolute and occasionally
         malformed — normalize to verse-relative & drop bad entries. */
      const verseMs = vt.timestamp_to - vt.timestamp_from;
      const segments = normalizeWordSegments(
        vt.segments,
        vt.timestamp_from,
        verseMs,
      );
      if (segments.length === 0) continue;
      map.set(ayahNo, { verseMs, segments });
    }
    return map.size ? map : null;
  } catch {
    return null;
  }
}

/* ── Single verse by key (used by the living hero preview) ────── */
export interface VerseByKey {
  surah: number;
  ayah: number;
  text: string;
  translation: string;
}

export async function fetchVerseByKey(
  surah: number,
  ayah: number,
  lang: string,
  signal?: AbortSignal,
): Promise<VerseByKey | null> {
  const isAr = lang === "ar";
  const transId = isAr ? 0 : (TRANSLATION_IDS[lang] || 0);
  const transParam = transId ? `&translations=${transId}` : "";
  try {
    const data = await fetchJson<any>(
      `${API_BASE}/verses/by_key/${surah}:${ayah}?language=en&words=false&fields=text_uthmani${transParam}`,
      signal,
    );
    const v = data.verse;
    if (!v) return null;
    let rawTrans = "";
    if (isAr) {
      try {
        const tData = await fetchJson<any>(
          `${API_BASE}/tafsirs/16/by_chapter/${surah}?per_page=300`,
          signal,
        );
        const item = (tData.tafsirs || []).find(
          (t: any) => t.verse_key === `${surah}:${ayah}`,
        );
        rawTrans = item?.text || "";
      } catch {
        rawTrans = "";
      }
    } else if (transId) {
      rawTrans =
        v.translations?.[0]?.text ||
        v.translations?.find((t: any) => t.resource_id === transId)?.text ||
        "";
    }
    return {
      surah,
      ayah,
      text: v.text_uthmani || "",
      translation: rawTrans.replace(/<[^>]+>/g, ""),
    };
  } catch {
    return null;
  }
}

/* ── Per-ayah audio URLs ────────────────────────────────────────── */
/** everyayah.com folder name for a reciter (cloud-render spec building) */
export function getEveryayahFolder(reciterNo: number): string {
  return QURAN_FOUNDATION_RECITERS[reciterNo]?.everyayahFolder ?? "";
}

/** Primary: the-quran-project CDN (reliable, fast) */
export function getQuranApiAudioUrl(
  reciterNo: number,
  surah: number,
  ayah: number,
): string {
  return `https://the-quran-project.github.io/Quran-Audio/Data/${reciterNo}/${surah}_${ayah}.mp3`;
}

/** Fallback: everyayah.com (Quran Foundation CDN) */
export function getEveryayahAudioUrl(
  reciterNo: number,
  surah: number,
  ayah: number,
): string | null {
  const entry = QURAN_FOUNDATION_RECITERS[reciterNo];
  if (!entry) return null;
  const surahStr = String(surah).padStart(3, "0");
  const ayahStr = String(ayah).padStart(3, "0");
  return `https://everyayah.com/data/${entry.everyayahFolder}/${surahStr}${ayahStr}.mp3`;
}

/**
 * Ordered URL candidates for one ayah, honoring probed CDN coverage:
 * reciters whose the-quran-project folder 404s (`primary: false`)
 * skip the dead CDN entirely — everyayah comes first. One source of
 * truth for generation, the Settings preview, and hover-play.
 */
export function getAudioUrlCandidates(
  reciterNo: number,
  surah: number,
  ayah: number,
): string[] {
  const entry = QURAN_FOUNDATION_RECITERS[reciterNo];
  if (!entry) return [];
  const urls: string[] = [];
  /* STRICT === true: `primary` is only set for reciters with a live
   * the-quran-project folder (ids 1-5, probed 2026-08). An omitted
   * primary used to pass `!== false` and every playback tried the
   * dead CDN first — 14 console 404s per page. */
  if (entry.primary === true) {
    urls.push(getQuranApiAudioUrl(reciterNo, surah, ayah));
  }
  const ev = getEveryayahAudioUrl(reciterNo, surah, ayah);
  if (ev) urls.push(ev);
  return urls;
}
