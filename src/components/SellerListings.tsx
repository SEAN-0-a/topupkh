"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import SafeProductImage from "@/components/SafeProductImage";
import EditListingModal, { type EditableListing } from "@/components/EditListingModal";

/**
 * "My Listings" section of the seller dashboard.
 *
 * Data flow (all through the cookie-backed browser client — RLS decides what
 * this session can see/write):
 *   1. supabase.auth.getUser() → the session user.
 *   2. sellers row where user_id = auth user → numeric seller_id.
 *   3. products where seller_id = seller_id AND is_deleted = false.
 *
 * Delete = SOFT delete (`.update({ is_deleted: true })`) after a confirm
 * prompt: orders reference products, so a hard delete would break order
 * history — the row simply disappears from every public feed (the products
 * RLS read policy filters is_deleted = false) and from this grid.
 * Edit opens <EditListingModal>; a successful save refreshes the list.
 */

const STATUS_CHIP: Record<string, string> = {
  approved: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
  pending_review: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
  pending: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
  rejected: "bg-red-500/10 text-red-400 border border-red-500/20",
};

interface ListingRow extends EditableListing {
  stock: number;
  stock_is_unlimited: boolean;
  created_at: string;
}

export default function SellerListings() {
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [listings, setListings] = useState<ListingRow[]>([]);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [editing, setEditing] = useState<ListingRow | null>(null);

  const loadListings = useCallback(async () => {
    setErrorMsg("");
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setErrorMsg("Session expired — please sign in again.");
      setLoading(false);
      return;
    }

    const { data: seller } = await supabase
      .from("sellers")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle<{ id: number }>();

    if (!seller) {
      setListings([]);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("products")
      .select(
        "id, title, description, image_url, price_usd, status, stock, stock_is_unlimited, created_at",
      )
      .eq("seller_id", seller.id)
      .eq("is_deleted", false)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      setErrorMsg(`Failed to load your listings: ${error.message}`);
    } else {
      setListings((data ?? []) as unknown as ListingRow[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadListings();
  }, [loadListings]);

  async function handleDelete(listing: ListingRow) {
    if (
      !window.confirm(
        `Delete "${listing.title}"?\n\nThe listing is removed from the marketplace (soft delete — your order history stays intact). This cannot be undone from the dashboard.`,
      )
    ) {
      return;
    }

    setDeletingId(listing.id);
    // Soft delete: is_deleted = true hides the row everywhere public.
    const { error } = await supabase
      .from("products")
      .update({ is_deleted: true, updated_at: new Date().toISOString() })
      .eq("id", listing.id);

    if (error) {
      alert(`Delete failed: ${error.message}`);
    } else {
      // state update — drop it from the grid immediately (no refetch)
      setListings((prev) => prev.filter((l) => l.id !== listing.id));
    }
    setDeletingId(null);
  }

  // ---- loading skeletons ----
  if (loading) {
    return (
      <div className="space-y-4 rounded-3xl border border-gray-800 bg-gray-900 p-6">
        <div className="h-4 w-40 animate-pulse rounded bg-gray-800" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="overflow-hidden rounded-2xl border border-gray-800 bg-slate-900">
              <div className="aspect-[16/10] animate-pulse bg-gray-800" />
              <div className="space-y-2 p-4">
                <div className="h-3 w-3/4 animate-pulse rounded bg-gray-800" />
                <div className="h-3 w-1/3 animate-pulse rounded bg-gray-800" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-3xl border border-gray-800 bg-gray-900 p-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-sm font-bold text-emerald-400">📦 My Listings</h2>
          <p className="mt-0.5 text-[11px] text-gray-500">
            {listings.length} live listing{listings.length === 1 ? "" : "s"} — edit details or
            remove items from the marketplace.
          </p>
        </div>
        <Link
          href="/sell"
          className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-xs font-bold text-emerald-400 transition-all hover:bg-emerald-500/20"
        >
          + New listing
        </Link>
      </div>

      {errorMsg && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
          {errorMsg}
        </div>
      )}

      {listings.length === 0 && !errorMsg ? (
        <div className="rounded-2xl border border-dashed border-gray-700 bg-slate-950 p-8 text-center">
          <p className="text-sm font-semibold text-gray-300">No live listings yet</p>
          <p className="mt-1 text-xs text-gray-500">
            Publish your first offer to start selling on the marketplace.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {listings.map((listing) => (
            <div
              key={listing.id}
              className="group flex flex-col overflow-hidden rounded-2xl border border-gray-800 bg-slate-900 shadow-lg transition-all hover:-translate-y-0.5 hover:border-emerald-500/40"
            >
              <div className="relative aspect-[16/10] w-full overflow-hidden bg-slate-950">
                <SafeProductImage
                  src={listing.image_url}
                  alt={listing.title}
                  width={640}
                  height={400}
                  className="h-full w-full object-cover"
                />
                <span
                  className={`absolute left-2.5 top-2.5 rounded-full border px-2.5 py-1 text-[10px] font-bold ${
                    STATUS_CHIP[listing.status] ?? STATUS_CHIP.pending
                  }`}
                >
                  {listing.status === "approved" ? "✓ Live" : listing.status.replace("_", " ")}
                </span>
              </div>

              <div className="flex flex-1 flex-col gap-3 p-4">
                <div>
                  <h3 className="line-clamp-2 text-sm font-bold text-white">{listing.title}</h3>
                  <p className="mt-1 text-[10px] text-gray-500">
                    {listing.stock_is_unlimited
                      ? "Unlimited stock"
                      : `${listing.stock} in stock`}{" "}
                    · listed {new Date(listing.created_at).toLocaleDateString()}
                  </p>
                </div>

                <p className="mt-auto font-mono text-lg font-extrabold text-emerald-400">
                  ${Number(listing.price_usd).toFixed(2)}
                </p>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEditing(listing)}
                    className="flex-1 rounded-xl border border-gray-700 bg-slate-950 px-3 py-2 text-xs font-bold text-emerald-400 transition-colors hover:border-emerald-500/50"
                  >
                    ✏️ Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(listing)}
                    disabled={deletingId === listing.id}
                    className="flex-1 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-400 transition-colors hover:bg-red-500/20 disabled:opacity-50"
                  >
                    {deletingId === listing.id ? "Deleting…" : "🗑️ Delete"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <EditListingModal
        listing={editing}
        onSaved={() => void loadListings()}
        onClose={() => setEditing(null)}
      />
    </div>
  );
}
