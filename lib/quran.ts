/**
 * quran.ts
 *
 * All data sourced from the Quran Foundation API (api.quran.com/api/v4).
 * Public content endpoints — no OAuth2 required.
 * Per-ayah audio from the Quran Foundation CDN (everyayah.com / quranicaudio.com).
 */

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
}

export interface Reciter {
  identifier: string;
  name: string;
  englishName: string;
  quranApiNo?: number;
  primary?: boolean;
  source: "alquran" | "quranapi";
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
   getAudioUrlCandidates() skips the dead CDN for them. */
const QURAN_FOUNDATION_RECITERS: Record<
  number,
  { englishName: string; name: string; everyayahFolder: string; primary?: boolean }
> = {
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

  return results;
}

/* ── Ayahs (Uthmani text) + translation in ONE request ─────────── */
export async function fetchAyahs(
  surahNumber: number,
  lang: string = "ar",
  signal?: AbortSignal,
): Promise<Ayah[]> {
  const transId = TRANSLATION_IDS[lang] || 0;
  const transParam = transId ? `&translations=${transId}` : "";
  const data = await fetchJson<any>(
    `${API_BASE}/verses/by_chapter/${surahNumber}?language=en&words=false&fields=text_uthmani,juz_number,page_number,sajdah_number${transParam}&page=1&per_page=300`,
    signal,
  );
  const verses = data.verses || [];
  return verses.map((v: any) => {
    let translation = "";
    if (transId) {
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
  const transId = TRANSLATION_IDS[lang] || 0;
  const transParam = transId ? `&translations=${transId}` : "";
  try {
    const data = await fetchJson<any>(
      `${API_BASE}/verses/by_key/${surah}:${ayah}?language=en&words=false&fields=text_uthmani${transParam}`,
      signal,
    );
    const v = data.verse;
    if (!v) return null;
    const rawTrans =
      v.translations?.[0]?.text ||
      v.translations?.find((t: any) => t.resource_id === transId)?.text ||
      "";
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
  if (entry.primary !== false) {
    urls.push(getQuranApiAudioUrl(reciterNo, surah, ayah));
  }
  const ev = getEveryayahAudioUrl(reciterNo, surah, ayah);
  if (ev) urls.push(ev);
  return urls;
}
