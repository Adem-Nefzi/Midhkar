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
    const fromUrl = new URLSearchParams(window.location.search).get("lang");
    if (fromUrl && ["en", "fr", "ar"].includes(fromUrl)) {
      const urlLocale = fromUrl as Locale;
      localStorage.setItem("midhkar-locale", urlLocale);
      setLocaleState(urlLocale);
      setMounted(true);
      return;
    }
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
      create: "Start creating",
    },
    hero: {
      title:
        "Give the Qur'an a voice<br/><span class='text-gold'>worth sharing.</span>",
      description:
        "Choose a surah, a reciter, and a few verses. Midhkar turns them into a short video you can post anywhere — no editing skills, no cost, ever.",
      ctaPrimary: "Start creating",
      ctaSecondary: "See how it works",
      trust: ["Free forever", "No watermark", "Nothing leaves your browser"],
      previewLabel: "What you'll share",
      verse:
        "And We have certainly made the Qur'an easy to remember. So is there anyone who will be mindful?",
    },
    how: {
      title: "From verse to video, in four steps",
      steps: [
        {
          title: "Choose a surah",
          description: "All 114 surahs, with search and quick picks.",
        },
        {
          title: "Select your verses",
          description: "Tap the ayahs you want — or take the first three, five, or ten.",
        },
        {
          title: "Shape the look",
          description: "Platform, reciter, background, fonts and effects. Preview updates live.",
        },
        {
          title: "Generate & share",
          description: "One tap renders an MP4 with synchronized recitation, ready to post.",
        },
      ],
    },
    features: {
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
      facts: [
        "114 surahs",
        "3 languages",
        "9:16 · 16:9 · 1:1",
        "100% in-browser",
        "No account needed",
      ],
    },
    quran: {
      title: "Light upon light",
      description:
        "Allah ﷻ says: 'Allah is the Light of the heavens and the earth. The example of His light is like a niche within which is a lamp.'",
      ref: "Surah An-Nur, 24:35",
      cta: "Explore the Qur'an",
    },
    footer: {
      tagline: "Spreading the words of Allah, one video at a time.",
      free: "Free forever — no account, no watermark, no ads.",
      rights: "All rights reserved. Made for the sake of Allah ﷻ.",
    },
    error: {
      title: "An unexpected error occurred",
      body: "The app encountered an unexpected issue. You can try again — if the problem persists, please refresh the page or return home.",
      details: "Technical details",
      tryAgain: "Try again",
      returnHome: "Return home",
    },
    notFound: {
      subtitle: "The page you seek has wandered off the path.\nLet us guide you back, by the will of Allah.",
      returnHome: "Return home",
      createCta: "Create a video",
      reference: "\"And He taught you that which you knew not. And the favor of Allah upon you is immense.\" — Surah An-Nisa 4:113",
    },
    loading: "Loading",
  },
  fr: {
    nav: {
      create: "Créer",
    },
    hero: {
      title:
        "Donnez au Coran une voix<br/><span class='text-gold'>digne d'être partagée.</span>",
      description:
        "Choisissez une sourate, un récitateur et quelques versets. Midhkar les transforme en une courte vidéo que vous pouvez publier partout — sans compétences en montage, sans frais, jamais.",
      ctaPrimary: "Commencer à créer",
      ctaSecondary: "Voir comment ça marche",
      trust: [
        "Gratuit pour toujours",
        "Sans filigrane",
        "Rien ne quitte votre navigateur",
      ],
      previewLabel: "Ce que vous partagerez",
      verse:
        "Nous avons certes rendu le Coran facile pour la méditation. Y a-t-il donc quelqu'un pour y réfléchir ?",
    },
    how: {
      title: "Du verset à la vidéo, en quatre étapes",
      steps: [
        {
          title: "Choisissez une sourate",
          description: "Les 114 sourates, avec recherche et choix rapides.",
        },
        {
          title: "Sélectionnez vos versets",
          description:
            "Touchez les ayahs souhaitées — ou prenez les trois, cinq ou dix premières.",
        },
        {
          title: "Façonnez l'apparence",
          description:
            "Plateforme, récitateur, arrière-plan, polices et effets. L'aperçu se met à jour en direct.",
        },
        {
          title: "Générez et partagez",
          description:
            "Un tap rend un MP4 avec récitation synchronisée, prêt à publier.",
        },
      ],
    },
    features: {
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
      facts: [
        "114 sourates",
        "3 langues",
        "9:16 · 16:9 · 1:1",
        "100% dans votre navigateur",
        "Aucun compte requis",
      ],
    },
    quran: {
      title: "Lumière sur lumière",
      description:
        "Allah ﷻ dit : 'Allah est la Lumière des cieux et de la terre. Son exemple de lumière est comme une niche où se trouve une lampe.'",
      ref: "Sourate An-Nur, 24:35",
      cta: "Explorer le Coran",
    },
    footer: {
      tagline: "Diffuser les paroles d'Allah, une vidéo à la fois.",
      free: "Gratuit pour toujours — sans compte, sans filigrane, sans publicité.",
      rights: "Tous droits réservés. Fait pour la cause d'Allah ﷻ.",
    },
    error: {
      title: "Une erreur inattendue est survenue",
      body: "L'application a rencontré un problème inattendu. Vous pouvez réessayer — si le problème persiste, actualisez la page ou revenez à l'accueil.",
      details: "Détails techniques",
      tryAgain: "Réessayer",
      returnHome: "Retour à l'accueil",
    },
    notFound: {
      subtitle: "La page que vous cherchez s'est égarée.\nLaissez-nous vous guider, par la volonté d'Allah.",
      returnHome: "Retour à l'accueil",
      createCta: "Créer une vidéo",
      reference: "\"Et Il t'a enseigné ce que tu ne savais pas. Et la grâce d'Allah sur toi est immense.\" — Sourate An-Nisa 4:113",
    },
    loading: "Chargement",
  },
  ar: {
    nav: {
      create: "ابدأ الإنشاء",
    },
    hero: {
      title:
        "أعطِ القرآن صوتا<br/><span class='text-gold'>يستحق المشاركة.</span>",
      ctaPrimary: "ابدأ الإنشاء",
      ctaSecondary: "شاهد كيف يعمل",
      trust: ["مجاني للأبد", "بدون علامة مائية", "لا شيء يغادر متصفحك"],
      previewLabel: "هذا ما ستشاركه",
      description:
        "اختر سورة، وقارئا، وآيات. يحولها مذكر إلى فيديو قصير يمكنك نشره في أي مكان — بدون مهارات تحرير، وبدون تكلفة، أبدا.",
      verse: "وَلَقَدْ يَسَّرْنَا الْقُرْآنَ لِلذِّكْر فَهَلْ مِن مُّدَّكِرٍ",
    },
    how: {
      title: "من الآية إلى الفيديو، في أربع خطوات",
      steps: [
        {
          title: "اختر سورة",
          description: "جميع السور الـ١١٤، مع البحث واختيارات سريعة.",
        },
        {
          title: "اختر آياتك",
          description:
            "اضغط على الآيات التي تريدها — أو خذ أول ثلاث أو خمس أو عشر.",
        },
        {
          title: "شكّل المظهر",
          description:
            "المنصة، القارئ، الخلفية، الخطوط والتأثيرات. المعاينة تتحدث مباشرة.",
        },
        {
          title: "أنتج وشارك",
          description: "ضغطة واحدة تُنتج MP4 مع تلاوة متزامنة، جاهز للنشر.",
        },
      ],
    },
    features: {
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
      facts: [
        "١١٤ سورة",
        "٣ لغات",
        "9:16 · 16:9 · 1:1",
        "١٠٠٪ في متصفحك",
        "بدون حساب",
      ],
    },
    quran: {
      title: "نور على نور",
      description:
        "يقول الله ﷻ: ﴿اللَّهُ نُورُ السَّمَاوَاتِ وَالْأَرْضِ مَثَلُ نُورِهِ كَمِشْكَاةٍ فِيهَا مِصْبَاحٌ﴾",
      ref: "سورة النور، ٣٥",
      cta: "استكشف القرآن",
    },
    footer: {
      tagline: "نشر كلمات الله، فيديو تلو الآخر.",
      free: "مجاني للأبد — بدون حساب، بدون علامة مائية، بدون إعلانات.",
      rights: "جميع الحقوق محفوظة. صُنع لوجه الله ﷻ.",
    },
    error: {
      title: "حدث خطأ غير متوقع",
      body: "واجه التطبيق مشكلة غير متوقعة. يمكنك المحاولة مرة أخرى — إذا استمرت المشكلة، حدّث الصفحة أو عُد إلى الصفحة الرئيسية.",
      details: "تفاصيل تقنية",
      tryAgain: "حاول مجدداً",
      returnHome: "العودة للرئيسية",
    },
    notFound: {
      subtitle: "الصفحة التي تبحث عنها ضلّت عن المسار.\nدعنا نعيدك إليها، بإذن الله.",
      returnHome: "العودة للرئيسية",
      createCta: "أنشئ فيديو",
      reference: "﴿وَعَلَّمَكَ مَا لَمْ تَكُنْ تَعْلَمُ ۚ وَكَانَ فَضْلُ اللَّهِ عَلَيْكَ عَظِيمًا﴾ — سورة النساء، ١١٣",
    },
    loading: "جاري التحميل",
  },
};
