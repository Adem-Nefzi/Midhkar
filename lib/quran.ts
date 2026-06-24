const API_BASE = "https://api.alquran.cloud/v1";
const QURAN_API_RECITERS = "https://quranapi.pages.dev/api/reciters.json";

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
  {
    id: "youtube",
    label: "YouTube Shorts",
    icon: "yt",
    aspect: "9:16",
    fontSize: "medium",
  },
  {
    id: "instagram",
    label: "Instagram Reel",
    icon: "ig",
    aspect: "9:16",
    fontSize: "large",
  },
  {
    id: "facebook",
    label: "Facebook",
    icon: "fb",
    aspect: "1:1",
    fontSize: "medium",
  },
  {
    id: "tiktok",
    label: "TikTok",
    icon: "tt",
    aspect: "9:16",
    fontSize: "large",
  },
];

export const TEXT_POSITIONS = [
  { id: "center", label: "Center" },
  { id: "top", label: "Top" },
  { id: "top-left", label: "Top Left" },
  { id: "top-right", label: "Top Right" },
  { id: "bottom", label: "Bottom" },
  { id: "bottom-left", label: "Bottom Left" },
  { id: "bottom-right", label: "Bottom Right" },
];

export const TEXT_COLORS = [
  { id: "gold", label: "Gold", value: "#d4af37" },
  { id: "parchment", label: "Parchment", value: "#f5f0e8" },
  { id: "white", label: "White", value: "#ffffff" },
  { id: "cream", label: "Cream", value: "#faf5eb" },
  { id: "amber", label: "Amber", value: "#ffbf00" },
  { id: "light-gold", label: "Light Gold", value: "#e5c76b" },
  { id: "emerald", label: "Emerald", value: "#50c878" },
  { id: "silver", label: "Silver", value: "#c0c0c0" },
  { id: "rose", label: "Rose Gold", value: "#e0bfb8" },
  { id: "ivory", label: "Ivory", value: "#fffff0" },
];

export const ANIMATED_BG = [
  { id: "golden-pulse", label: "Golden Pulse", icon: "✦" },
  { id: "starry-night", label: "Starry Night", icon: "★" },
  { id: "ripple", label: "Rippling Water", icon: "〰" },
  { id: "shimmer", label: "Shimmer", icon: "✨" },
  { id: "mist", label: "Mist", icon: "🌫" },
  { id: "upload", label: "Upload Video", icon: "📁" },
];

export const VERSE_PRESETS = [
  { id: "first-3", label: "First 3" },
  { id: "first-5", label: "First 5" },
  { id: "first-10", label: "First 10" },
  { id: "first-20", label: "First 20" },
  { id: "full", label: "Full Surah" },
];

const QURAN_API_RECITERS_MAP: Record<
  number,
  { englishName: string; name: string }
> = {
  1: { englishName: "Mishary Al Afasy", name: "مشاري العفاسي" },
  2: { englishName: "Abu Bakr Al Shatri", name: "أبو بكر الشاطري" },
  3: { englishName: "Nasser Al Qatami", name: "ناصر القطامي" },
  4: { englishName: "Yasser Al Dosari", name: "ياسر الدوسري" },
  5: { englishName: "Hani Ar Rifai", name: "هاني الرفاعي" },
};

async function fetchJson<T>(url: string): Promise<{ data: T }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return { data: await res.json() };
}

export async function fetchSurahs(): Promise<Surah[]> {
  const { data } = await fetchJson<any>(`${API_BASE}/surah`);
  return data.data || data || [];
}

export async function fetchReciters(): Promise<Reciter[]> {
  const results: Reciter[] = [];

  try {
    const recitersRaw =
      await fetchJson<Record<string, string>>(QURAN_API_RECITERS);
    const reciterMap = recitersRaw.data || {};
    for (const [no, name] of Object.entries(reciterMap)) {
      const info = QURAN_API_RECITERS_MAP[Number(no)];
      results.push({
        identifier: `quranapi-${no}`,
        englishName: info?.englishName || name,
        name: info?.name || name,
        quranApiNo: Number(no),
        source: "quranapi",
      });
    }
  } catch {
    /* fall through */
  }

  if (results.length === 0) {
    for (const [no, info] of Object.entries(QURAN_API_RECITERS_MAP)) {
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

export async function fetchAyahs(surahNumber: number): Promise<Ayah[]> {
  const { data } = await fetchJson<any>(
    `${API_BASE}/surah/${surahNumber}/quran-uthmani`,
  );
  const ayahs = data.data?.ayahs || data.ayahs || [];
  return ayahs.map((a: any) => ({
    number: a.number,
    numberInSurah: a.numberInSurah,
    text: a.text,
    juz: a.juz,
    page: a.page,
    sajda: a.sajda,
  }));
}

export async function fetchTranslation(
  surahNumber: number,
  lang: string,
): Promise<Map<number, string>> {
  if (lang === "ar") return new Map();
  const transId = lang === "fr" ? "fr.hamidullah" : "en.sahih";
  const { data } = await fetchJson<any>(
    `${API_BASE}/surah/${surahNumber}/${transId}`,
  );
  const ayahs = data.data?.ayahs || data.ayahs || [];
  const map = new Map<number, string>();
  ayahs.forEach((a: any) => map.set(a.numberInSurah, a.text));
  return map;
}

export function getQuranApiAudioUrl(
  reciterNo: number,
  surah: number,
  ayah: number,
): string {
  return `https://the-quran-project.github.io/Quran-Audio/Data/${reciterNo}/${surah}_${ayah}.mp3`;
}

const EVERYAYAH_MAP: Record<number, { folder: string; reciterNo: number }> = {
  1: { folder: "Alafasy_128kbps", reciterNo: 1 },
  2: { folder: "Abu_Bakr_Ash-Shaatree_128kbps", reciterNo: 2 },
  3: { folder: "Nasser_Alqatami_128kbps", reciterNo: 3 },
  4: { folder: "Yasser_Ad-Dussary_128kbps", reciterNo: 4 },
  5: { folder: "Hani_Rifai_192kbps", reciterNo: 5 },
};

export function getEveryayahAudioUrl(
  reciterNo: number,
  surah: number,
  ayah: number,
): string | null {
  const entry = EVERYAYAH_MAP[reciterNo];
  if (!entry) return null;
  const surahStr = String(surah).padStart(3, "0");
  const ayahStr = String(ayah).padStart(3, "0");
  return `https://everyayah.com/data/${entry.folder}/${surahStr}${ayahStr}.mp3`;
}

export function getGlobalAyahNumber(
  surahNumber: number,
  ayahNumberInSurah: number,
  surahs: Surah[],
): number {
  let global = 0;
  for (let i = 0; i < surahNumber - 1; i++) {
    const s = surahs.find((s) => s.number === i + 1);
    global += s?.numberOfAyahs ?? 7;
  }
  return global + ayahNumberInSurah;
}
