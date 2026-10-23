import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import PayPanel from "@/components/PayPanel";
import ConfirmReceiveButton from "@/components/ConfirmReceiveButton";
import DisputeButton from "@/components/DisputeButton";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getUserContext } from "@/lib/auth";

const STATUS_LABELS: Record<string, { text: string; className: string }> = {
  pending_payment: { text: "⏳ Awaiting payment", className: "text-yellow-400" },
  pending_verification: { text: "🔒 In escrow — payment held, awaiting admin verification", className: "text-yellow-400" },
  in_escrow: { text: "🔒 In escrow — payment held, awaiting admin verification", className: "text-yellow-400" },
  paid: { text: "✅ Payment verified — seller is preparing delivery", className: "text-emerald-400" },
  processing: { text: "⚙️ Processing", className: "text-emerald-400" },
  delivering: { text: "📦 Delivered — confirm receipt to release funds", className: "text-emerald-400" },
  delivered: { text: "📦 Delivered — confirm receipt to release funds", className: "text-emerald-400" },
  completed: { text: "🎉 Completed — thanks!", className: "text-emerald-400" },
  cancelled: { text: "🚫 Cancelled", className: "text-gray-400" },
  refunded: { text: "↩️ Refunded", className: "text-purple-400" },
  disputed: { text: "⚖️ Under dispute", className: "text-red-400" },
};

export const dynamic = "force-dynamic";

export default async function CheckoutOrderPage({
  params,
}: {
  params: Promise<{ ref: string }>;
}) {
  const { ref } = await params;
  const user = await getUserContext();
  if (!user) redirect(`/login?next=/checkout/${ref}`);

  const supabase = await createSupabaseServerClient();
  const { data: order } = await supabase
    .from("orders")
    .select(
      `
        *,
        products (
          title, image_url, delivery_method,
          sellers ( display_name )
        )
      `,
    )
    .eq("public_ref", ref)
    .single<{
      id: number;
      public_ref: string;
      buyer_id: string;
      product_id: number;
      status: string;
      subtotal: number;
      unit_price: number;
      platform_fee: number;
      seller_proceeds: number;
      commission_rate: number;
      quantity: number;
      delivery_payload: string | null;
      created_at: string;
      products: { title: string; image_url: string | null; delivery_method: string } & {
        sellers: { display_name: string } | null;
      } | null;
    }>();

  // RLS hides other people's orders — a nonexistent row means "not yours/invalid"
  if (!order || order.buyer_id !== user.userId) notFound();

  const status = STATUS_LABELS[order.status] ?? {
    text: order.status,
    className: "text-gray-400",
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5 px-4 py-8 text-white">
      <div className="rounded-3xl border border-gray-800 bg-gray-900 p-6">
        <div className="mb-1 flex items-center justify-between">
          <h1 className="text-lg font-bold">Order {order.public_ref}</h1>
          <span className={`text-xs font-semibold ${status.className}`}>{status.text}</span>
        </div>
        <p className="text-[11px] text-gray-500">
          Placed {new Date(order.created_at).toLocaleString()} · Keep this reference for support
          tickets.
        </p>

        <div className="mt-4 space-y-2 rounded-2xl border border-gray-800 bg-black p-4 text-xs">
          <div className="flex justify-between">
            <span className="text-gray-400">
              {order.products?.title ?? "Product"} × {order.quantity}
              {order.products?.sellers?.display_name
                ? ` · by ${order.products.sellers.display_name}`
                : ""}
            </span>
            <span className="font-mono">${order.subtotal.toFixed(2)}</span>
          </div>
        </div>

        {/* only the buyer pays; seller proceeds are internal accounting */}
        <div className="mt-4 p-4 text-xs text-gray-400">
          <p className="text-[11px]">
            Includes platform fee ${(order.platform_fee).toFixed(2)} — this is how the marketplace
            earns revenue on eligible sales. Seller proceeds: ${(order.seller_proceeds).toFixed(2)}.
          </p>
        </div>
      </div>

      {order.status === "pending_payment" && (
        <div className="rounded-3xl border border-gray-800 bg-gray-900 p-6">
          <h2 className="mb-3 text-sm font-bold">1️⃣ Payment</h2>
          <PayPanel
            orderId={order.id}
            publicRef={order.public_ref}
            amount={order.subtotal}
            productId={order.product_id}
            quantity={order.quantity}
            unitPrice={order.unit_price}
          />
        </div>
      )}

      {(order.status === "pending_verification" || order.status === "in_escrow") && (
        <div className="rounded-3xl border border-yellow-600/40 bg-yellow-500/10 p-6 text-xs text-yellow-200">
          Payment claim received. An administrator will verify the transfer in the ABA/Bakong
          statement shortly. This page updates automatically once verified — a support ticket is
          available if it takes more than a few hours.
        </div>
      )}

      {(order.status === "delivering" || order.status === "delivered") && order.delivery_payload && (
        <div className="rounded-3xl border border-gray-800 bg-gray-900 p-6">
          <h2 className="mb-2 text-sm font-bold">2️⃣ Delivered — please confirm</h2>
          <pre className="whitespace-pre-wrap rounded-xl border border-gray-800 bg-black p-4 text-xs text-gray-200">
            {order.delivery_payload}
          </pre>
          <p className="mt-3 text-[11px] text-gray-500">
            Confirm only after you verified the delivery in game.
          </p>
          <div className="mt-4">
            <ConfirmReceiveButton orderId={order.id} />
          </div>
        </div>
      )}

      {(order.status === "delivering" || order.status === "delivered") && !order.delivery_payload && (
        <div className="rounded-3xl border border-gray-800 bg-gray-900 p-6 text-xs text-gray-400">
          Seller marked this as delivered without details — contact them via messages or support if
          anything is unclear.
        </div>
      )}

      {/* Step 4 (escrow): report a problem — freezes funds, admins review */}
      {["in_escrow", "pending_verification", "delivering", "delivered"].includes(order.status) && (
        <div className="rounded-3xl border border-gray-800 bg-gray-900 p-6">
          <h2 className="text-sm font-bold">4️⃣ Something wrong?</h2>
          <DisputeButton orderId={order.id} />
        </div>
      )}

      <div className="flex flex-wrap gap-3 pb-6 text-xs">
        <Link href="/orders" className="text-gray-400 hover:text-white">
          My orders
        </Link>
        <Link href="/feedback" className="text-gray-400 hover:text-white">
          Problem? Contact support
        </Link>
      </div>
    </div>
  );
}
