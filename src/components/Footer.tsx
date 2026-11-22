"use client";

import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";
import { TelegramBanner } from "@/components/TelegramBanner";

/**
 * RomdoulKHShop site footer — sleek dark surface (#0d0f1d) with a
 * responsive 3-column link layout (1 column on mobile).
 *
 * Language: accepts an explicit `lang` prop ("en" | "kh"). When omitted it
 * follows the global LanguageContext toggle, so the navbar EN/KH switcher
 * re-renders every label live. All labels are data-driven: each link renders
 * exactly one lookup from the dictionary below for the active language.
 */

type FooterLang = "en" | "kh";

interface FooterLink {
  href: string;
  en: string;
  kh: string;
}

const FOOTER_COLUMNS: { links: FooterLink[] }[] = [
  {
    // Column 1 — company & community
    links: [
      { href: "/info/help-center", en: "Help center", kh: "មជ្ឈមណ្ឌលជំនួយ" },
      { href: "/info/contact-us", en: "Contact us", kh: "ទំនាក់ទំនងយើង" },
      { href: "/info/about-us", en: "About us", kh: "អំពីយើង" },
      { href: "/info/careers", en: "Careers", kh: "ឱកាសការងារ" },
      { href: "/info/bug-bounty", en: "Bug bounty", kh: "កម្មវិធីរាយការណ៍កំហុស" },
      { href: "/info/blog", en: "Blog", kh: "ប្លុក" },
      { href: "/info/influencer-program", en: "Influencer program", kh: "កម្មវិធី Influencer" },
      { href: "/info/become-an-affiliate", en: "Become an affiliate", kh: "ក្លាយជាដៃគូផ្សព្វផ្សាយ" },
      { href: "/info/become-a-seller", en: "Become a seller", kh: "ក្លាយជាអ្នកលក់" },
    ],
  },
  {
    // Column 2 — buyer & account protection
    links: [
      { href: "/info/account-warranty", en: "Account warranty", kh: "ការធានាគណនី" },
      { href: "/info/tradeshield-buying", en: "TradeShield (buying)", kh: "TradeShield (ការទិញ)" },
      { href: "/info/tradeshield-selling", en: "TradeShield (selling)", kh: "TradeShield (ការលក់)" },
      { href: "/info/withdrawals", en: "Withdrawals", kh: "ការដកប្រាក់" },
      { href: "/info/account-seller-rules", en: "Account seller rules", kh: "វិធានសម្រាប់អ្នកលក់គណនី" },
    ],
  },
  {
    // Column 3 — seller resources & policies
    links: [
      { href: "/info/seller-rules", en: "Seller rules", kh: "វិធានសម្រាប់អ្នកលក់" },
      { href: "/info/changing-username", en: "Changing username", kh: "ការផ្លាស់ប្តូរឈ្មោះ" },
      { href: "/info/fees", en: "Fees", kh: "កម្រៃសេវា" },
      { href: "/info/refund-policy", en: "Refund Policy", kh: "គោលការណ៍សងប្រាក់វិញ" },
      { href: "/info/app-on-iphone-pwa", en: "App on iPhone (PWA)", kh: "កម្មវិធីលើ iPhone (PWA)" },
    ],
  },
];

export default function Footer({ lang }: { lang?: FooterLang }) {
  // Explicit prop wins; otherwise follow the global EN/KH toggle.
  // Context language is "en" | "km" — "km" maps onto the Khmer labels.
  const { lang: contextLang } = useLanguage();
  const active: FooterLang = lang ?? (contextLang === "km" ? "kh" : "en");

  return (
    <footer className="mt-16 border-t border-slate-200 bg-slate-50 text-slate-600 dark:border-transparent dark:bg-[#0d0f1d] dark:text-gray-400">
      <div className="mx-auto max-w-7xl px-4 py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {FOOTER_COLUMNS.map((column, index) => (
            <nav key={index} aria-label={`Footer links ${index + 1}`}>
              <ul className="space-y-2 text-sm">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="transition-colors hover:text-slate-900 dark:hover:text-white"
                    >
                      {active === "kh" ? link.kh : link.en}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        {/* Telegram community */}
        <div className="mt-10 flex justify-center">
          <TelegramBanner />
        </div>

        {/* Bottom bar */}
        <div className="mt-8 border-t border-slate-200 pt-6 text-center text-xs text-slate-500 dark:border-white/10 dark:text-gray-500">
          <p>
            © {new Date().getFullYear()} RomdoulKHShop ·{" "}
            {active === "kh" ? "រក្សាសិទ្ធិគ្រប់យ៉ាង" : "All rights reserved"}
          </p>
        </div>
      </div>
    </footer>
  );
}
