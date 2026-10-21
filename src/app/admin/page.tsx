import Link from "next/link";
import { redirect } from "next/navigation";
import { getUserContext, isStaff } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** /admin — control panel hub linking to every admin tool. */
export default async function AdminIndexPage() {
  const ctx = await getUserContext();
  if (!ctx || !isStaff(ctx.profile)) redirect("/login?next=/admin");

  const sections = [
    { href: "/admin/sellers", icon: "🛡️", title: "KYC Review", desc: "Approve / reject seller verification + ID documents." },
    { href: "/admin/payouts", icon: "💸", title: "Payout Requests", desc: "Confirm external bank transfers or reject & refund." },
    { href: "/admin/escrow", icon: "⚖️", title: "Escrow", desc: "Verify claimed payments (KHQR / ABA statement)." },
    { href: "/admin/orders", icon: "🧾", title: "Orders", desc: "Live marketplace orders." },
    { href: "/admin/disputes", icon: "⚡", title: "Disputes", desc: "Resolve frozen escrows and refund buyers." },
  ];

  return (
    <div className="min-h-screen bg-gray-950">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-lg font-bold text-white">🛠️ Admin Panel</h1>
        <p className="mt-1 text-xs text-gray-400">Admin: {ctx.profile.display_name}</p>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {sections.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="rounded-2xl border border-gray-800 bg-gray-900 p-5 transition-all hover:border-gray-600"
            >
              <p className="text-xl">{s.icon}</p>
              <p className="mt-1 text-xs font-bold text-white">{s.title}</p>
              <p className="mt-1 text-[11px] text-gray-400">{s.desc}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
