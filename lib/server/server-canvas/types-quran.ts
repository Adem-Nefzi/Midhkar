/* Vendored type shims — mirror the app's lib/quran.ts and lib/types.ts
   shapes that canva-utils actually consumes. Kept in sync by hand. */

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
