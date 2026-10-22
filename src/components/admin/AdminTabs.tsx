"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin", label: "🛠️ Overview" },
  { href: "/admin/sellers", label: "🛡️ Sellers" },
  { href: "/admin/products", label: "📦 Products / Offers" },
  { href: "/admin/payouts", label: "💸 Payouts" },
  { href: "/admin/escrow", label: "⚖️ Escrow" },
  { href: "/admin/orders", label: "🧾 Orders" },
  { href: "/admin/disputes", label: "⚡ Disputes" },
];

/** Shared tab navigation for /admin/* pages — highlights the active tab. */
export default function AdminTabs() {
  const pathname = usePathname();

  return (
    <nav className="mx-auto mb-6 flex max-w-5xl gap-1.5 overflow-x-auto px-4 pt-6 text-[11px]">
      {TABS.map((t) => {
        const active = t.href === "/admin" ? pathname === "/admin" : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`whitespace-nowrap rounded-full px-3.5 py-2 font-bold transition-all ${
              active
                ? "bg-emerald-500 text-black"
                : "border border-gray-800 bg-gray-900 text-gray-300 hover:border-gray-600 hover:text-white"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
