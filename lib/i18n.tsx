"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

export type Locale = "en" | "fr" | "ar";

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string | string[];
  dir: "ltr" | "rtl";
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("midhkar-locale") as Locale | null;
    if (saved && ["en", "fr", "ar"].includes(saved)) {
      setLocaleState(saved);
    }
    setMounted(true);
  }, []);

  const setLocale = (locale: Locale) => {
    setLocaleState(locale);
    localStorage.setItem("midhkar-locale", locale);
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = locale;
  };

  useEffect(() => {
    if (mounted) {
      document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
      document.documentElement.lang = locale;
    }
  }, [locale, mounted]);

  const t = (key: string): string | string[] => {
    const keys = key.split(".");
    let value: any = translations[locale];
    for (const k of keys) {
      value = value?.[k];
      if (value === undefined) return key;
    }
    return value;
  };

  const dir = locale === "ar" ? "rtl" : "ltr";

  if (!mounted) {
    return <div className="min-h-screen bg-ink" />;
  }

  return (
    <I18nContext.Provider value={{ locale, setLocale, t, dir }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) throw new Error("useI18n must be used within I18nProvider");
  return context;
}

const translations = {
  en: {
    nav: {
      signIn: "Sign in",
      getStarted: "Get started",
      create: "Start creating",
    },
    hero: {
      arabicTitle: "القرآن الكريم",
      subtitle: "A sadaqah jariyah project — free, always",
      title:
        "Give the Qur'an a voice<br/><span class='text-gold'>worth sharing.</span>",
      description:
        "Choose a surah, a reciter, and a few verses. Midhkar turns them into a short video you can post anywhere — no editing skills, no cost, ever.",
      ctaPrimary: "Start creating",
      ctaSecondary: "Sign in",
      verse:
        "And We have certainly made the Qur'an easy to remember. So is there anyone who will be mindful?",
      verseRef: "— Surah Al-Qamar, 54:17",
    },
    features: {
      eyebrow: "Why Midhkar",
      title: "Created for the Ummah, by the Ummah",
      description:
        "Every video you share becomes a continuous charity. Beautiful, accessible, and rooted in tradition.",
      items: [
        {
          title: "Authentic Reciters",
          description:
            "Choose from a curated collection of world-renowned qaris. Every voice is licensed and clear.",
        },
        {
          title: "Instant Videos",
          description:
            "No timelines, no exports, no waiting. Your video renders in seconds, ready for every platform.",
        },
        {
          title: "Sadaqah Jariyah",
          description:
            "Every share is a seed of reward. We take no payment — this is a trust from Allah ﷻ.",
        },
      ],
    },
    quran: {
      eyebrow: "The Book of Allah",
      title: "Light upon light",
      description:
        "Allah ﷻ says: 'Allah is the Light of the heavens and the earth. The example of His light is like a niche within which is a lamp.'",
      ref: "Surah An-Nur, 24:35",
      cta: "Explore the Qur'an",
    },
    footer: {
      tagline: "Spreading the words of Allah, one video at a time.",
      rights: "All rights reserved. Made for the sake of Allah ﷻ.",
    },
  },
  fr: {
    nav: {
      signIn: "Se connecter",
      getStarted: "Commencer",
      create: "Créer",
    },
    hero: {
      arabicTitle: "القرآن الكريم",
      subtitle: "Un projet de sadaqah jariyah — gratuit, pour toujours",
      title:
        "Donnez au Coran une voix<br/><span class='text-gold'>digne d'être partagée.</span>",
      description:
        "Choisissez une sourate, un récitateur et quelques versets. Midhkar les transforme en une courte vidéo que vous pouvez publier partout — sans compétences en montage, sans frais, jamais.",
      ctaPrimary: "Commencer à créer",
      ctaSecondary: "Se connecter",
      verse:
        "Nous avons certes rendu le Coran facile pour la méditation. Y a-t-il donc quelqu'un pour y réfléchir ?",
      verseRef: "— Sourate Al-Qamar, 54:17",
    },
    features: {
      eyebrow: "Pourquoi Midhkar",
      title: "Créé pour la Oumma, par la Oumma",
      description:
        "Chaque vidéo que vous partagez devient une aumône continue. Belle, accessible et ancrée dans la tradition.",
      items: [
        {
          title: "Récitateurs Authentiques",
          description:
            "Choisissez parmi une collection sélectionnée de qaris de renommée mondiale. Chaque voix est autorisée et claire.",
        },
        {
          title: "Vidéos Instantanées",
          description:
            "Pas de timelines, pas d'exports, pas d'attente. Votre vidéo se génère en secondes, prête pour toutes les plateformes.",
        },
        {
          title: "Sadaqah Jariyah",
          description:
            "Chaque partage est une graine de récompense. Nous ne prenons aucun paiement — c'est un amanah d'Allah ﷻ.",
        },
      ],
    },
    quran: {
      eyebrow: "Le Livre d'Allah",
      title: "Lumière sur lumière",
      description:
        "Allah ﷻ dit : 'Allah est la Lumière des cieux et de la terre. Son exemple de lumière est comme une niche où se trouve une lampe.'",
      ref: "Sourate An-Nur, 24:35",
      cta: "Explorer le Coran",
    },
    footer: {
      tagline: "Diffuser les paroles d'Allah, une vidéo à la fois.",
      rights: "Tous droits réservés. Fait pour la cause d'Allah ﷻ.",
    },
  },
  ar: {
    nav: {
      signIn: "تسجيل الدخول",
      getStarted: "ابدأ الآن",
      create: "ابدأ الإنشاء",
    },
    hero: {
      arabicTitle: "القرآن الكريم",
      subtitle: "مشروع صدقة جارية — مجاني، دائماً",
      title: "أعطِ القرآن صوتاً يستحق المشاركة.",
      description:
        "اختر سورة، وقارئاً، وآيات. يحولها مذكر إلى فيديو قصير يمكنك نشره في أي مكان — بدون مهارات تحرير، وبدون تكلفة، أبداً.",
      ctaPrimary: "ابدأ الإنشاء",
      ctaSecondary: "تسجيل الدخول",
      verse: "وَلَقَدْ يَسَّرْنَا الْقُرْآنَ لِلذِّكْرِ فَهَلْ مِن مُّدَّكِرٍ",
      verseRef: "— سورة القمر، ١٧",
    },
    features: {
      eyebrow: "لماذا مذكر",
      title: "صُنع للأمة، من الأمة",
      description:
        "كل فيديو تشاركه يصبح صدقة جارية. جميل، وسهل، ومُتجذر في التقليد.",
      items: [
        {
          title: "قراء موثوقون",
          description:
            "اختر من مجموعة مختارة من القراء العالميين. كل صوت مرخص وواضح.",
        },
        {
          title: "فيديوهات فورية",
          description:
            "لا خطوط زمنية، ولا تصدير، ولا انتظار. يُنتج فيديوك في ثوانٍ، جاهز لكل المنصات.",
        },
        {
          title: "صدقة جارية",
          description:
            "كل مشاركة هي بذرة أجر. لا نأخذ أي مقابل — هذه أمانة من الله ﷻ.",
        },
      ],
    },
    quran: {
      eyebrow: "كتاب الله",
      title: "نور على نور",
      description:
        "يقول الله ﷻ: ﴿اللَّهُ نُورُ السَّمَاوَاتِ وَالْأَرْضِ مَثَلُ نُورِهِ كَمِشْكَاةٍ فِيهَا مِصْبَاحٌ﴾",
      ref: "سورة النور، ٣٥",
      cta: "استكشف القرآن",
    },
    footer: {
      tagline: "نشر كلمات الله، فيديو تلو الآخر.",
      rights: "جميع الحقوق محفوظة. صُنع لوجه الله ﷻ.",
    },
  },
};
