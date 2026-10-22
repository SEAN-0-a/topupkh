import Link from "next/link";
import { requirePageRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import ProductRowActions from "@/components/admin/ProductRowActions";

export const dynamic = "force-dynamic";

/**
 * /admin/products — every offer/product from every seller in one table.
 * ADMIN-ONLY for mutations (the page itself is staff-visible via the layout
 * guard, but the row actions call requireRole("admin") server actions too).
 * Read access comes from products_read RLS (is_staff() sees everything).
 */

type AdminProductRow = {
  id: number;
  title: string;
  game_name: string | null;
  price_usd: number;
  status: string;
  is_deleted: boolean;
  warranty_days: number;
  image_url: string | null;
  created_at: string;
  games: { name: string } | { name: string }[] | null;
  product_categories: { name: string } | { name: string }[] | null;
  sellers: { display_name: string } | { display_name: string }[] | null;
};

function one<T>(v: T | T[] | null | undefined): T | null {
  return v == null ? null : Array.isArray(v) ? (v[0] ?? null) : v;
}

const STATUS_CHIP: Record<string, string> = {
  approved: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
  paused: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  pending_review: "border-sky-500/40 bg-sky-500/10 text-sky-300",
  draft: "border-gray-500/40 bg-gray-500/10 text-gray-300",
  rejected: "border-red-500/40 bg-red-500/10 text-red-400",
};

function statusInfo(row: AdminProductRow): { label: string; cls: string } {
  if (row.is_deleted) return { label: "Deleted", cls: "border-red-500/40 bg-red-500/10 text-red-400" };
  const cls = STATUS_CHIP[row.status] ?? STATUS_CHIP.draft;
  switch (row.status) {
    case "approved":
      return { label: "Active", cls };
    case "paused":
      return { label: "Disabled", cls };
    case "pending_review":
      return { label: "Pending", cls };
    case "rejected":
      return { label: "Rejected", cls };
    default:
      return { label: row.status, cls };
  }
}

export default async function AdminProductsPage() {
  // Loop-proof guard: not signed in → /login?next=…, non-admin → "/"
  const ctx = await requirePageRole("/admin/products", "admin");

  const supabase = await createSupabaseServerClient();

  type QueryRow = Omit<AdminProductRow, "games" | "product_categories" | "sellers"> & {
    games: { name: string } | { name: string }[] | null;
    product_categories: { name: string } | { name: string }[] | null;
    sellers: { display_name: string } | { display_name: string }[] | null;
  };

  let rows: AdminProductRow[] = [];
  let dbError: string | null = null;
  try {
    const { data, error } = await supabase
      .from("products")
      .select(
        `
        id, title, game_name, price_usd, status, is_deleted, warranty_days,
        image_url, created_at,
        games ( name ),
        product_categories ( name ),
        sellers ( display_name )
      `,
      )
      .order("updated_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(200);

    if (error) throw new Error(error.message);
    rows = ((data ?? []) as unknown as QueryRow[]).map((r) => ({
      ...r,
      games: one(r.games),
      product_categories: one(r.product_categories),
      sellers: one(r.sellers),
    }));
  } catch (e) {
    dbError = e instanceof Error ? e.message : "Failed to load products.";
    console.error("[admin/products] load failed:", dbError);
  }

  const activeCount = rows.filter((r) => !r.is_deleted && r.status === "approved").length;
  const disabledCount = rows.filter(
    (r) => !r.is_deleted && ["paused", "pending_review", "draft", "rejected"].includes(r.status),
  ).length;
  const deletedCount = rows.filter((r) => r.is_deleted).length;

  return (
    <div className="min-h-screen bg-gray-950">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-white">📦 Products &amp; Offers</h1>
            <p className="mt-1 text-xs text-gray-400">
              Every listing across all sellers — Admin: {ctx.profile.display_name}
            </p>
          </div>
          <div className="flex gap-2 text-[10px] font-bold">
            <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-emerald-400">
              {activeCount} active
            </span>
            <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-amber-300">
              {disabledCount} disabled
            </span>
            <span className="rounded-full border border-red-500/40 bg-red-500/10 px-2.5 py-1 text-red-400">
              {deletedCount} deleted
            </span>
          </div>
        </div>

        {dbError && (
          <div className="mt-4 rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-xs text-red-200">
            Failed to load products: {dbError}
          </div>
        )}

        {!dbError && rows.length === 0 && (
          <div className="mt-4 rounded-2xl border border-gray-800 bg-gray-900 p-8 text-center text-xs text-gray-400">
            No listings yet.
          </div>
        )}

        {!dbError && rows.length > 0 && (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[760px] border-separate border-spacing-y-2 text-left text-[11px]">
              <thead className="text-[10px] uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-2">Title</th>
                  <th className="px-3 py-2">Game</th>
                  <th className="px-3 py-2">Price</th>
                  <th className="px-3 py-2">Seller</th>
                  <th className="px-3 py-2">Category</th>
                  <th className="px-3 py-2">Warranty</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const chip = statusInfo(r);
                  const seller = one(r.sellers);
                  return (
                    <tr key={r.id} className="bg-gray-900 text-gray-200">
                      <td className="max-w-[260px] rounded-l-2xl px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={r.image_url || "/aba-qr.jpg"}
                            alt=""
                            className="h-9 w-9 shrink-0 rounded-lg border border-gray-800 object-cover"
                          />
                          <div className="min-w-0">
                            <p className="truncate font-bold text-white">{r.title}</p>
                            <p className="truncate text-[10px] text-gray-500">
                              #{r.id} · {new Date(r.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-gray-300">
                        {r.game_name || one(r.games)?.name || "—"}
                      </td>
                      <td className="px-3 py-3 font-mono font-bold text-emerald-400">
                        ${Number(r.price_usd).toFixed(2)}
                      </td>
                      <td className="px-3 py-3 text-gray-300">{seller?.display_name ?? "—"}</td>
                      <td className="px-3 py-3 text-gray-300">
                        {one(r.product_categories)?.name ?? "—"}
                      </td>
                      <td className="px-3 py-3 text-gray-300">{r.warranty_days}d</td>
                      <td className="px-3 py-3">
                        <span
                          className={`whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${chip.cls}`}
                        >
                          {chip.label}
                        </span>
                      </td>
                      <td className="rounded-r-2xl px-3 py-3">
                        <div className="flex items-start gap-2">
                          <Link
                            href={`/offers/${r.id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="whitespace-nowrap rounded-lg border border-gray-700 px-2.5 py-1.5 text-[10px] font-bold text-gray-200 transition-colors hover:border-emerald-500 hover:text-emerald-400"
                          >
                            👁 View
                          </Link>
                          <ProductRowActions
                            productId={r.id}
                            active={!r.is_deleted && r.status === "approved"}
                            deleted={r.is_deleted}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-4 text-[10px] leading-relaxed text-gray-500">
          Toggling writes status <code>approved</code> ⇄ <code>paused</code>; Delete is a soft
          delete (<code>is_deleted</code> + <code>rejected</code>) so order history stays intact.
          All mutations are admin-only and logged to <code>admin_audit_log</code>.
        </p>

        <div className="mt-8 text-center">
          <Link href="/admin" className="text-xs font-bold text-emerald-400 hover:underline">
            ← Back to Admin
          </Link>
        </div>
      </div>
    </div>
  );
}
