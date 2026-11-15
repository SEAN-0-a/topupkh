"use client";

import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";

/**
 * RomdoulKHShop site footer — sleek dark surface, 3-column link grid.
 * Bilingual (EN/KH): reads the global LanguageContext by default, or takes an
 * explicit `lang` prop ('en' | 'kh') which wins when provided. The site's
 * navbar toggle uses 'km' internally, so it is mapped to 'kh' here.
 */

type FooterLang = "en" | "kh";

interface FooterLink {
  en: string;
  kh: string;
  href: string;
}

interface FooterColumn {
  heading: { en: string; kh: string };
  links: FooterLink[];
}

const TRANSLATIONS: FooterColumn[] = [
  {
    heading: { en: "Company & Support", kh: "ក្រុមហ៊ុន និងជំនួយ" },
    links: [
      { en: "Help center", kh: "មជ្ឈមណ្ឌលជំនួយ", href: "/help" },
      { en: "Contact us", kh: "ទំនាក់ទំនងយើង", href: "/contact" },
      { en: "About us", kh: "អំពីយើង", href: "/about" },
      { en: "Careers", kh: "ឱកាសការងារ", href: "/careers" },
      { en: "Bug bounty", kh: "កម្មវិធីរាយការណ៍កំហុស", href: "/bug-bounty" },
      { en: "Blog", kh: "ប្លុក", href: "/blog" },
      { en: "Influencer program", kh: "កម្មវិធី Influencer", href: "/influencer" },
      { en: "Become an affiliate", kh: "ក្លាយជាដៃគូផ្សព្វផ្សាយ", href: "/affiliate" },
      { en: "Become a seller", kh: "ក្លាយជាអ្នកលក់", href: "/seller/register" },
    ],
  },
  {
    heading: { en: "Protection & Payments", kh: "ការការពារ និងការទូទាត់" },
    links: [
      { en: "Account warranty", kh: "ការធានាគណនី", href: "/account-warranty" },
      { en: "TradeShield (buying)", kh: "TradeShield (ការទិញ)", href: "/tradeshield?mode=buy" },
      { en: "TradeShield (selling)", kh: "TradeShield (ការលក់)", href: "/tradeshield?mode=sell" },
      { en: "Withdrawals", kh: "ការដកប្រាក់", href: "/wallet" },
      { en: "Account seller rules", kh: "វិធានសម្រាប់អ្នកលក់គណនី", href: "/seller-rules#account" },
    ],
  },
  {
    heading: { en: "Policies & Resources", kh: "គោលការណ៍ និងធនធាន" },
    links: [
      { en: "Seller rules", kh: "វិធានសម្រាប់អ្នកលក់", href: "/seller-rules" },
      { en: "Changing username", kh: "ការផ្លាស់ប្តូរឈ្មោះ", href: "/settings" },
      { en: "Fees", kh: "កម្រៃសេវា", href: "/fees" },
      { en: "Refund Policy", kh: "គោលការណ៍សងប្រាក់វិញ", href: "/refund-policy" },
      { en: "App on iPhone (PWA)", kh: "កម្មវិធីលើ iPhone (PWA)", href: "/pwa" },
    ],
  },
];

export default function Footer({ lang }: { lang?: FooterLang }) {
  const { lang: contextLang } = useLanguage();
  // Explicit prop wins; otherwise derive from the global toggle ('km' → 'kh').
  const active: FooterLang = lang ?? (contextLang === "km" ? "kh" : "en");
  const isKhmer = active === "kh";

  return (
    <footer className="mt-16 border-t border-gray-800 bg-[#0d0f1d] text-gray-400">
      <div className="mx-auto max-w-7xl px-4 py-10">
        {/* 3-column link grid: stacks on mobile, spreads on desktop */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {TRANSLATIONS.map((column, index) => (
            <nav key={index} aria-label={column.heading[active]}>
              <h3 className="text-[11px] font-bold uppercase tracking-widest text-gray-500">
                {column.heading[active]}
              </h3>
              <ul className={`mt-3 space-y-2 text-sm ${isKhmer ? "leading-relaxed" : ""}`}>
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="transition-colors hover:text-white"
                    >
                      {active === "kh" ? link.kh : link.en}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-gray-800 pt-6 text-xs text-gray-500 sm:flex-row">
          <p>© {new Date().getFullYear()} RomdoulKHShop · All rights reserved</p>
          <nav
            aria-label={isKhmer ? "ខាងផ្លូវចិត្ត" : "Legal"}
            className="flex flex-wrap items-center gap-x-2"
          >
            <Link href="/terms" className="transition-colors hover:text-white">
              {isKhmer ? "លក្ខខណ្ឌ" : "Terms"}
            </Link>
            <span aria-hidden="true">·</span>
            <Link href="/seller-terms" className="transition-colors hover:text-white">
              {isKhmer ? "លក្ខខណ្ឌអ្នកលក់" : "Seller Terms"}
            </Link>
            <span aria-hidden="true">·</span>
            <Link href="/privacy" className="transition-colors hover:text-white">
              {isKhmer ? "ភាពឯកជន" : "Privacy"}
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
