"use client";

// Withdrawal-history table.

import { useLanguage } from "@/context/LanguageContext";
import type { PayoutRequestRow } from "@/lib/types";

const STATUS_CHIP: Record<string, string> = {
  approved:
    "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
  rejected: "bg-red-500/10 text-red-400 border border-red-500/20",
  pending: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
};

export default function PayoutHistoryTable({ payouts }: { payouts: PayoutRequestRow[] }) {
  const { tf } = useLanguage();

  return (
    <div className="rounded-3xl border border-gray-800 bg-gray-900 p-6 shadow-xl">
      <h2 className="text-sm font-bold text-emerald-400">
        {tf("📜 Withdrawal history", "📜 ប្រវត្តិដកប្រាក់")}
      </h2>
      {payouts.length === 0 ? (
        <p className="py-6 text-center text-xs text-gray-500">
          {tf("No withdrawal requests yet.", "មិនទាន់មានប្រវត្តិដកប្រាក់")}
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gray-800 text-[10px] uppercase tracking-wide text-gray-500">
                <th className="py-2 pr-3 font-semibold">Amount</th>
                <th className="py-2 pr-3 font-semibold">Destination</th>
                <th className="py-2 pr-3 font-semibold">Admin note</th>
                <th className="py-2 pr-3 font-semibold">Status</th>
                <th className="py-2 font-semibold">Date</th>
              </tr>
            </thead>
            <tbody>
              {payouts.map((p) => (
                <tr key={p.id} className="border-b border-gray-800/60 align-top">
                  <td className="py-3 pr-3 font-bold text-white">${Number(p.amount).toFixed(2)} USD</td>
                  <td className="py-3 pr-3 text-[10px] text-gray-400">
                    {p.account_name} ({p.account_number}) · {p.bank_name}
                  </td>
                  <td className="py-3 pr-3 text-[10px] text-gray-500">{p.review_note ?? "—"}</td>
                  <td className="py-3 pr-3">
                    <span
                      className={`whitespace-nowrap rounded-md px-2.5 py-1 text-[10px] font-bold capitalize ${
                        STATUS_CHIP[p.status] ?? STATUS_CHIP.pending
                      }`}
                    >
                      {p.status}
                    </span>
                  </td>
                  <td className="py-3 text-[10px] text-gray-500">
                    {new Date(p.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
