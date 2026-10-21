import type { seller_status, user_role } from "@/lib/db-enums";

export type RankInfo = {
  /** Short badge label, e.g. "Gold" / "Admin" / "Member". */
  label: string;
  /** Tailwind classes for the badge (bg / text / border). */
  classes: string;
  /** One-line explanation for the settings page. */
  note: string;
};

/**
 * Deterministic rank badge derived from role + verified-seller sales volume.
 * (There is no `rank` column in the DB — this is a display-level feature.)
 *
 * Tiers follow completed seller escrows; buyers are plain "Member", staff
 * always outrank everything.
 */
export function computeRank(input: {
  role: user_role;
  sellerStatus?: seller_status | null;
  completedSales?: number | null;
}): RankInfo {
  const { role, sellerStatus = null, completedSales = 0 } = input;

  if (role === "admin") {
    return {
      label: "Staff",
      classes: "bg-purple-500/15 text-purple-300 border-purple-500/40",
      note: "Platform staff — full moderation access.",
    };
  }
  if (role === "support") {
    return {
      label: "Support",
      classes: "bg-purple-500/15 text-purple-300 border-purple-500/40",
      note: "Platform support team.",
    };
  }

  const sales = Math.max(0, Math.floor(completedSales || 0));
  if (sellerStatus === "approved") {
    if (sales >= 500) {
      return {
        label: "Diamond Seller",
        classes: "bg-cyan-400/15 text-cyan-300 border-cyan-400/40",
        note: "500+ completed sales with escrow.",
      };
    }
    if (sales >= 100) {
      return {
        label: "Gold Seller",
        classes: "bg-amber-400/15 text-amber-300 border-amber-400/40",
        note: "100+ completed sales with escrow.",
      };
    }
    if (sales >= 25) {
      return {
        label: "Silver Seller",
        classes: "bg-slate-300/15 text-slate-200 border-slate-300/40",
        note: "25+ completed sales with escrow.",
      };
    }
    return {
      label: "Verified Seller",
      classes: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
      note: `Verified seller${sales > 0 ? ` — ${sales} completed sale${sales === 1 ? "" : "s"}.` : ". Growing!"}`,
    };
  }

  if (sellerStatus === "pending") {
    return {
      label: "Applying Seller",
      classes: "bg-sky-500/15 text-sky-300 border-sky-500/40",
      note: "Seller verification under review.",
    };
  }

  return {
    label: "Member",
    classes: "bg-gray-500/15 text-gray-300 border-gray-500/40",
    note: "Standard buyer account. Sell something to level up!",
  };
}
