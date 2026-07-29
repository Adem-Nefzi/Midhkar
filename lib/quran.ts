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
  source: "alquran" | "quranapi";
}

export const PLATFORMS = [
  { id: "youtube", label: "YouTube Shorts", icon: "yt", aspect: "9:16", fontSize: "medium" },
  { id: "instagram", label: "Instagram Reel", icon: "ig", aspect: "9:16", fontSize: "large" },
  { id: "facebook", label: "Facebook", icon: "fb", aspect: "1:1", fontSize: "medium" },
  { id: "tiktok", label: "TikTok", icon: "tt", aspect: "9:16", fontSize: "large" },
];

export const TEXT_POSITIONS = [
  { id: "top", label: "Top" },
  { id: "center", label: "Center" },
  { id: "bottom", label: "Bottom" },
];

export const TEXT_COLORS = [
  { id: "gold", label: "Gold", value: "#d4af37" },
  { id: "parchment", label: "Parchment", value: "#f5f0e8" },
  { id: "white", label: "White", value: "#ffffff" },
  { id: "cream", label: "Cream", value: "#faf5eb" },
  { id: "amber", label: "Amber", value: "#ffbf00" },
  { id: "light-gold", label: "Lt. Gold", value: "#e5c76b" },
  { id: "emerald", label: "Emerald", value: "#50c878" },
  { id: "silver", label: "Silver", value: "#c0c0c0" },
  { id: "rose", label: "Rose Gold", value: "#e0bfb8" },
  { id: "ivory", label: "Ivory", value: "#fffff0" },
];

export const ANIMATED_BG = [{ id: "upload", label: "Upload Video", icon: "📁" }];

export const VERSE_PRESETS = [
  { id: "first-3", label: "First 3" },
  { id: "first-5", label: "First 5" },
  { id: "first-10", label: "First 10" },
  { id: "first-20", label: "First 20" },
  { id: "full", label: "Full Surah" },
];

/* ── Reciter mapping (Quran Foundation recitation IDs → audio CDNs) ── */
const QURAN_FOUNDATION_RECITERS: Record<
  number,
  { englishName: string; name: string; everyayahFolder: string }
> = {
  7: { englishName: "Mishary Al Afasy", name: "مشاري العفاسي", everyayahFolder: "Alafasy_128kbps" },
  4: { englishName: "Abu Bakr Al Shatri", name: "أبو بكر الشاطري", everyayahFolder: "Abu_Bakr_Ash-Shaatree_128kbps" },
  3: { englishName: "Nasser Al Qatami", name: "ناصر القطامي", everyayahFolder: "Nasser_Alqatami_128kbps" },
  5: { englishName: "Hani Ar Rifai", name: "هاني الرفاعي", everyayahFolder: "Hani_Rifai_192kbps" },
  1: { englishName: "AbdulBaset (Murattal)", name: "عبد الباسط", everyayahFolder: "Abdul_Basit_Murattal_192kbps" },
  6: { englishName: "Mahmoud Al Husary", name: "محمود الحصري", everyayahFolder: "Husary_128kbps" },
  10: { englishName: "Saud Al Shuraim", name: "سعود الشريم", everyayahFolder: "Saood_ash-Shuraym_128kbps" },
  9: { englishName: "Minshawi (Murattal)", name: "المنشاوي", everyayahFolder: "Minshawy_Murattal_128kbps" },
};

/* ── Translation IDs on the Quran Foundation API ─────────────────── */
const TRANSLATION_IDS: Record<string, number> = {
  en: 131, // Sahih International
  fr: 136, // Hamidullah (French)
  ar: 0,   // No translation for Arabic
};

async function fetchJson<T>(url: string): Promise<T> {
  const cacheKey = `midhkar:${url}`;
  try {
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) return JSON.parse(cached) as T;
  } catch { /* sessionStorage unavailable */ }

  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  try {
    sessionStorage.setItem(cacheKey, JSON.stringify(data));
  } catch { /* quota exceeded — don't block */ }
  return data;
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
    revelationType: c.revelation_place,
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
        source: "quranapi",
      });
    }
  }

  return results;
}

/* ── Ayahs (Uthmani text) ───────────────────────────────────────── */
export async function fetchAyahs(surahNumber: number): Promise<Ayah[]> {
  const data = await fetchJson<any>(
    `${API_BASE}/verses/by_chapter/${surahNumber}?language=en&words=false&fields=text_uthmani,juz_number,page_number,sajdah_number&page=1&per_page=300`,
  );
  const verses = data.verses || [];
  return verses.map((v: any) => ({
    number: v.id,
    numberInSurah: v.verse_number,
    text: v.text_uthmani || "",
    juz: v.juz_number || 1,
    page: v.page_number || 1,
    sajda: !!v.sajdah_number,
  }));
}

/* ── Translations ───────────────────────────────────────────────── */
export async function fetchTranslation(
  surahNumber: number,
  lang: string,
): Promise<Map<number, string>> {
  const transId = TRANSLATION_IDS[lang];
  if (!transId) return new Map();

  const data = await fetchJson<any>(
    `${API_BASE}/verses/by_chapter/${surahNumber}?language=en&words=false&translations=${transId}&fields=verse_number&page=1&per_page=300`,
  );
  const verses = data.verses || [];
  const map = new Map<number, string>();
  for (const v of verses) {
    const text =
      v.translations?.[0]?.text ||
      v.translations?.find((t: any) => t.resource_id === transId)?.text ||
      "";
    // Strip HTML tags from translation text
    const clean = text.replace(/<[^>]+>/g, "");
    if (clean) map.set(v.verse_number, clean);
  }
  return map;
}

/* ── Per-ayah audio URLs ────────────────────────────────────────── */
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
