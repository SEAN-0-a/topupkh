import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getUserContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

const STATUS_COLORS: Record<string, string> = {
  pending_payment: "text-yellow-400",
  pending_verification: "text-yellow-400",
  paid: "text-emerald-400",
  processing: "text-emerald-400",
  delivering: "text-emerald-400",
  completed: "text-emerald-400",
  cancelled: "text-gray-500",
  refunded: "text-purple-400",
  disputed: "text-red-400",
};

export default async function OrdersPage() {
  const user = await getUserContext();
  if (!user) redirect("/login?next=/orders");

  const supabase = await createSupabaseServerClient();
  type BuyerOrder = {
    id: number;
    public_ref: string;
    status: string;
    subtotal: number;
    created_at: string;
    products: { title: string } | { title: string }[] | null;
  };
  const { data } = await supabase
    .from("orders")
    .select("id, public_ref, status, subtotal, created_at, products ( title )")
    .eq("buyer_id", user.userId)
    .order("created_at", { ascending: false })
    .limit(50);
  const orders = (data ?? []) as unknown as BuyerOrder[];

  function orderTitle(o: BuyerOrder): string {
    if (Array.isArray(o.products)) return o.products[0]?.title ?? `Order ${o.public_ref}`;
    if (o.products && "title" in o.products) return o.products.title;
    return `Order ${o.public_ref}`;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-8 text-white">
      <h1 className="text-xl font-bold">🧾 My orders</h1>

      {!orders?.length && (
        <p className="rounded-2xl border border-gray-800 bg-gray-900 p-6 text-sm text-gray-400">
          No orders yet. <Link href="/marketplace" className="text-emerald-400">Browse the marketplace →</Link>
        </p>
      )}

      <ul className="space-y-2">
        {orders?.map((o) => (
          <li key={o.id}>
            <Link
              href={`/checkout/${o.public_ref}`}
              className="flex items-center justify-between rounded-2xl border border-gray-800 bg-gray-900 p-4 text-sm hover:border-emerald-500/60"
            >
              <div>
                <div className="font-semibold">{orderTitle(o)}</div>
                <div className="text-[11px] text-gray-500">
                  {o.public_ref} · {new Date(o.created_at).toLocaleString()}
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono font-bold text-emerald-400">${o.subtotal.toFixed(2)}</div>
                <div className={`text-[11px] ${STATUS_COLORS[o.status] ?? "text-gray-400"}`}>
                  {o.status.replace(/_/g, " ")}
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
