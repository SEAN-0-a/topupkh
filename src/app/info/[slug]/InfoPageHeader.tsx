"use client";

import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";
import LastUpdatedBadge from "@/components/LastUpdatedBadge";

/**
 * InfoPageHeader — client chrome for /info/[slug] (breadcrumbs + heading +
 * subtitle + "Last updated" badge) plus InfoBackLink for the page footer.
 *
 * WHY CLIENT: /info/[slug] is a fully static server page
 * (generateStaticParams + dynamicParams = false), but language switching is
 * a client-side runtime concern (LanguageContext + localStorage). Rendering
 * the heading/metadata chrome in a client component lets titles, subtitles,
 * breadcrumbs and the badge re-render in Khmer the moment the switcher flips,
 * while the long-form blocks stay server-rendered English content.
 *
 * THEME: every token here is an explicit slate pair — no legacy gray-*
 * or inverted classes — so the header reads correctly on light and dark surfaces.
 */

/** Khmer headings per slug; missing slugs fall back to the English string. */
const KM_HEADINGS: Record<string, { title: string; subtitle: string }> = {
  "tradeshield-buying": {
    title: "TradeShield សម្រាប់អ្នកទិញ",
    subtitle:
      "ការទិញរាល់មុខនៅលើ RomdoulKHShop ត្រូវបានការពារដោយ Escrow។ លុយរបស់អ្នកត្រូវរក្សាទុកយ៉ាងសុវត្ថិភាពរហូតទាល់តែទំនិញឌីជីថលត្រូវបានប្រគល់ និងបានបញ្ជាក់ — អ្នកលក់មិនអាចប៉ះវាមុនឡើយ។",
  },
  "tradeshield-selling": {
    title: "TradeShield សម្រាប់អ្នកលក់",
    subtitle:
      "TradeShield ក៏ការពារអ្នកលក់ដែរ៖ អ្នកទិញបង់ប្រាក់ចូល Escrow ជាមុន ដូច្នេះអ្នកអាចប្រគល់ទំនិញដោយមានទំនុកចិត្តថាលុយត្រូវបានធានារួចហើយ — និងចេញដោយស្វ័យប្រវត្តិពេលការប្រគល់ត្រូវបានបញ្ជាក់។",
  },
  withdrawals: {
    title: "ការដកប្រាក់ និងការទូទាត់ចេញ",
    subtitle:
      "ដកសមតុល្យអ្នកលក់ទៅគណនីធនាគារកម្ពុជា និងកាបូបទូរស័ព្ទ — ABA, Wing ឬធនាគារណាមួយតាម Bakong/KHQR។ សុំជាដុល្លារ ទូទាត់ជាដុល្លារ ឬរៀល តាមជម្រើសរបស់អ្នក។",
  },
  "refund-policy": {
    title: "គោលការណ៍ប្រគល់ប្រាក់វិញ",
    subtitle:
      "លក្ខខណ្ឌប្រគល់ប្រាក់ច្បាស់លាស់ និងស្តង់ដារសម្រាប់ទំនិញឌីជីថល — ពេលណាអ្នកបានលុយវិញ លឿនប៉ុណ្ណា និងទៅកាន់កន្លែងណា។",
  },
  fees: {
    title: "ថ្លៃសេវា និងកម្រៃជើងសារ",
    subtitle:
      "តម្លៃដាក់បង្ហាញយ៉ាងច្បាស់។ គ្មានថ្លៃដាក់បង្ហាញ គ្មានការកាត់ដកដោយស៊ាំឡូយឡាង — អ្វីដែលអ្នកឃើញគឺអ្វីដែលអ្នកទាំងអស់គ្នាត្រូវបង់។",
  },
  "contact-us": {
    title: "ទំនាក់ទំនង",
    subtitle:
      "ជំនួយពិតប្រាកដពីភ្នំពេញ — ជាភាសាខ្មែរ និងអង់គ្លេស លើឆैនណលដែលខ្មែរប្រើជាក់ស្តែង។",
  },
  "help-center": {
    title: "មជ្ឈមណ្ឌលជំនួយ",
    subtitle: "ចាប់ផ្តើមពីទីនេះ — ផ្លូវខ្លីបំផុតទៅកាន់ចម្លើយ ឬគោលការណ៍ដែលអ្នកត្រូវការ។",
  },
  "about-us": {
    title: "អំពីយើង",
    subtitle: "ផ្សារទូទាត់ហ្គេមរបស់កម្ពុជា — សាងសង់នៅភ្នំពេញ សម្រាប់អ្នកលេងហ្គេមខ្មែរ។",
  },
  careers: {
    title: "ឱកាសការងារ",
    subtitle: "ជួយសាងសង់ផ្សារឌីជីថលដែលមានសុវត្ថិភាពបំផុតរបស់កម្ពុជា។",
  },
  "bug-bounty": {
    title: "រង្វាន់រកឃើញចំណុចបំផ្លាញ",
    subtitle:
      "រកឃើញចំណុចបំផ្លាញសុវត្ថិភាព? រាយការណ៍ឱ្យបានត្រឹមត្រូវ និងទទួលរង្វាន់តាមកាបូបប្រាក់របស់អ្នក។",
  },
  blog: {
    title: "ប្លុក",
    subtitle: "មគ្គុទ្ទេសក៍ ការតាមដានតម្លៃ និងការពន្យល់សុវត្ថិភាព សម្រាប់អ្នកលេងហ្គេមខ្មែរ។",
  },
  "influencer-program": {
    title: "កម្មវិធី Influencer",
    subtitle:
      "អ្នកបង្កើតខ្លឹមសារខ្មែរ — ទទួលកម្រៃជើងសារលើរាល់ការលក់ពីទស្សនិជនរបស់អ្នក។",
  },
  "become-an-affiliate": {
    title: "ក្លាយជាដៃគូផ្សព្វផ្សាយ",
    subtitle:
      "មិនចាំបាច់មានកាមេរ៉ា — ចែករំលែកតំណភ្ជាប់របស់អ្នក និងទទួលកម្រៃពីការបញ្ជាទិញដែលបានបញ្ចប់។",
  },
  "become-a-seller": {
    title: "ក្លាយជាអ្នកលក់",
    subtitle:
      "លក់កូឌីតហ្គេម កូដ និងគណនី ដល់អ្នកលេងហ្គេមខ្មែររាប់ពាន់នាក់ — ដោយ Escrow ជាភ្នាក់ងារទំនុកចិត្តសម្រាប់អ្នក។",
  },
  "account-warranty": {
    title: "ការធានាគណនីហ្គេម",
    subtitle: "គណនីហ្គេមមានរយៈពេលធានា — នេះជាអ្វីដែលវាគ្របដណ្តប់ និងវិធីទាមទារ។",
  },
  "account-seller-rules": {
    title: "ច្បាប់អ្នកលក់គណនីហ្គេម",
    subtitle:
      "ច្បាប់បន្ថែមសម្រាប់ការលក់គណនីហ្គេម — កម្មសិទ្ធិ ការបង្ហាញព័ត៌មាន និងការដកចេញការចងភ្ជាប់។",
  },
  "seller-rules": {
    title: "ច្បាប់សម្រាប់អ្នកលក់",
    subtitle:
      "ច្បាប់អាកប្បកិរិយាផ្សារទំនិញ — អ្វីដែលអ្នកអាចលក់ វិធីប្រគល់ទំនិញ និងអ្វីដែលធ្វើឱ្យអ្នកត្រូវហាមប្រាម។",
  },
  "changing-username": {
    title: "ការផ្លាស់ប្តូរឈ្មោះអ្នកប្រើប្រាស់",
    subtitle: "វិធីសុំផ្លាស់ប្តូរឈ្មោះដោយមិនបាត់ប្រវត្តិរបស់អ្នក។",
  },
  "app-on-iphone-pwa": {
    title: "ដំឡើងកម្មវិធីលើ iPhone (PWA)",
    subtitle: "ដំឡើង RomdoulKHShop លើអេក្រង់ដើម iPhone របស់អ្នក — មិនចាំបាច់ App Store។",
  },
  terms: {
    title: "លក្ខខណ្ឌនៃការប្រើប្រាស់",
    subtitle:
      "ក្របខ័ណ្ឌសម្រាប់ការប្រើប្រាស់ RomdoulKHShop — សេចក្តីសង្ខេបនៅទីនេះ ឯកសារពេញលេញចុចតែម្តង។",
  },
  privacy: {
    title: "គោលការណ៍ភាពឯកជន",
    subtitle: "ទិន្នន័យអ្វីដែលយើងរក្សាទុក មូលហេតុអ្វី និងវិធីដែលអ្នកប្រើកម្ពុជាយកជាម្ចាស់ការ។",
  },
};

/** Chrome labels + badge metadata, per language (fallback: English). */
const LABELS = {
  en: {
    home: "Home",
    info: "Info",
    back: "← Back to the Help Center",
    updated: "Last updated · November 2026",
  },
  km: {
    home: "ទំព័រដើម",
    info: "ព័ត៌មាន",
    back: "← ត្រឡប់ទៅមជ្ឈមណ្ឌលជំនួយ",
    updated: "ធ្វើបច្ចុប្បន្នភាពចុងក្រោយ · ខែវិច្ឆិកា ២០២៦",
  },
} as const;

export default function InfoPageHeader({
  slug,
  title,
  subtitle,
  updated,
}: {
  slug: string;
  /** English fallback strings from src/lib/info-content.ts. */
  title: string;
  subtitle: string;
  updated: string;
}) {
  const { lang } = useLanguage();
  const km = KM_HEADINGS[slug];
  const t = LABELS[lang];
  const headingTitle = (lang === "km" ? km?.title : undefined) ?? title;
  const headingSubtitle = (lang === "km" ? km?.subtitle : undefined) ?? subtitle;

  return (
    <>
      {/* breadcrumbs */}
      <nav
        aria-label="Breadcrumb"
        className="mb-6 flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400"
      >
        <Link
          href="/"
          className="font-semibold transition-colors hover:text-slate-900 dark:hover:text-white"
        >
          {t.home}
        </Link>
        <span aria-hidden="true">/</span>
        <Link
          href="/info/help-center"
          className="font-semibold transition-colors hover:text-slate-900 dark:hover:text-white"
        >
          {t.info}
        </Link>
        <span aria-hidden="true">/</span>
        <span className="truncate font-semibold text-slate-900 dark:text-white">
          {headingTitle}
        </span>
      </nav>

      {/* header */}
      <header className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          {headingTitle}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">
          {headingSubtitle}
        </p>
        <LastUpdatedBadge en={updated} km={t.updated} className="mt-3" />
      </header>
    </>
  );
}

/** Footer link back to the Help Center (translated, high-contrast). */
export function InfoBackLink() {
  const { lang } = useLanguage();
  return (
    <Link
      href="/info/help-center"
      className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 transition-colors hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400"
    >
      {LABELS[lang].back}
    </Link>
  );
}
