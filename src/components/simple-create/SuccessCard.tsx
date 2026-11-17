"use client";

// SuccessCard — post-publish state of the SimpleCreateListingForm.
// Two honest outcomes straight from the server action's status read-back:
//   published=true  → live on /marketplace + /product/[id] right now
//   published=false → DB eligibility gate kept it in admin review

import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";

export default function SuccessCard({
  productId,
  published,
  onCreateAnother,
}: {
  productId: number;
  published: boolean;
  onCreateAnother: () => void;
}) {
  const { tf } = useLanguage();

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-[#121212]">
      <p className="text-4xl">🎉</p>
      <h2 className="mt-2 text-lg font-bold text-slate-900 dark:text-white">
        {published
          ? tf("Your offer is live!", "ការផ្ដល់ជូនរបស់អ្នកកំពុងបោះផ្សាយ!")
          : tf("Submitted for review", "បានដាក់ស្នើសម្រាប់ការពិនិត្យ")}
      </h2>
      <p className="mx-auto mt-1 max-w-sm text-xs text-slate-600 dark:text-slate-400">
        {published
          ? tf(
              "Buyers can see and buy it on the marketplace right now.",
              "អ្នកទិញអាចមើលនិងទិញវានៅលើទីផ្សារជាលំដាប់។",
            )
          : tf(
              "This game/category pair is not provisioned yet — an admin will review it shortly.",
              "គូហ្គេម/ប្រភេទនេះមិនទាន់បានរៀបចំ — អ្នកគ្រប់គ្រងនឹងពិនិត្យក្នុងពេលឆាប់ៗ។",
            )}
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-3">
        <Link
          href={`/product/${productId}`}
          className="rounded-xl bg-amber-500 px-5 py-2.5 text-xs font-bold text-slate-950 transition-colors hover:bg-gold"
        >
          {tf("View my listing", "មើលការផ្ដល់ជូនរបស់ខ្ញុំ")}
        </Link>
        <button
          type="button"
          onClick={onCreateAnother}
          className="rounded-xl border border-slate-300 px-5 py-2.5 text-xs font-semibold text-slate-700 transition-colors hover:border-amber-500 hover:text-amber-600 dark:border-slate-700 dark:text-slate-300 dark:hover:text-amber-400"
        >
          {tf("Create another", "បង្កើតថ្មីទៀត")}
        </button>
      </div>
    </div>
  );
}
