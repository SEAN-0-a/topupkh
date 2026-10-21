import Link from "next/link";
import DeliverForm from "@/components/DeliverForm";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getUserContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function SellerOrdersPage() {
  const user = await getUserContext();
  if (!user) return <RedirectToLogin />;

  const supabase = await createSupabaseServerClient();

  // the seller's seller row
  const { data: seller } = await supabase
    .from("sellers")
    .select("id, status, display_name")
    .eq("user_id", user.userId)
    .single<{ id: number; status: string; display_name: string }>();

  if (!seller) {
    return (
      <Notice>
        You don&apos;t have a seller account yet. Apply at{" "}
        <Link href="/sell" className="text-emerald-400">
          /sell
        </Link>{" "}
        — after admin approval you can list products here.
      </Notice>
    );
  }

  if (seller.status !== "approved") {
    return (
      <Notice>
        Your seller application is <b>{seller.status}</b>. Listings and orders unlock once an admin
        approves you.
      </Notice>
    );
  }

  const { data: rawOrders } = await supabase
    .from("orders")
    .select(
      `
        id, public_ref, status, subtotal, seller_proceeds, quantity, delivery_payload, created_at,
        products!inner ( title, seller_id, sellers!inner ( user_id ) )
      `,
    )
    .eq("products.sellers.user_id", user.userId)
    .in("status", ["paid", "processing", "delivering", "pending_verification", "disputed"])
    .order("created_at", { ascending: false });

  type SellerOrder = {
    id: number;
    public_ref: string;
    status: string;
    subtotal: number;
    seller_proceeds: number;
    quantity: number;
    delivery_payload: string | null;
    created_at: string;
    products: { title: string } | { title: string }[] | null;
  };
  const orders = (rawOrders ?? []) as unknown as SellerOrder[];

  function orderTitle(o: SellerOrder): string {
    if (Array.isArray(o.products)) return o.products[0]?.title ?? `Order ${o.public_ref}`;
    if (o.products && "title" in o.products) return o.products.title;
    return `Order ${o.public_ref}`;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-8 text-white">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">📦 Incoming orders</h1>
        <span className="text-[11px] text-gray-500">as {seller.display_name}</span>
      </div>

      {!orders?.length && (
        <p className="rounded-2xl border border-gray-800 bg-gray-900 p-6 text-sm text-gray-400">
          No active orders right now.
        </p>
      )}

      {orders?.map((o) => (
        <div key={o.id} className="rounded-2xl border border-gray-800 bg-gray-900 p-4 text-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-semibold">{orderTitle(o)}</div>
              <div className="text-[11px] text-gray-500">
                {o.public_ref} · {new Date(o.created_at).toLocaleString()} · qty {o.quantity}
              </div>
            </div>
            <div className="text-right">
              <div className="font-mono text-emerald-400">+${Number(o.seller_proceeds).toFixed(2)}</div>
              <div className="text-[11px] text-gray-400">{o.status.replace(/_/g, " ")}</div>
            </div>
          </div>

          {o.status === "paid" && <DeliverForm orderId={o.id} />}
          {o.status === "delivering" && (
            <pre className="mt-2 whitespace-pre-wrap rounded-xl border border-gray-800 bg-black p-3 text-[11px] text-gray-300">
              {o.delivery_payload}
            </pre>
          )}
          {o.status === "pending_verification" && (
            <p className="mt-2 text-[11px] text-yellow-400">
              Waiting for the admin to verify the buyer&apos;s payment…
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-xl px-4 py-10 text-center text-sm text-gray-300">{children}</div>
  );
}

function RedirectToLogin() {
  return (
    <div className="mx-auto max-w-xl px-4 py-10 text-center text-sm text-gray-400">
      Please <Link href="/login" className="text-emerald-400">log in</Link> to see your seller
      orders.
    </div>
  );
}
