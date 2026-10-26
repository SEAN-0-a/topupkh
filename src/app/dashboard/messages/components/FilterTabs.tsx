import { FILTER_TABS, type FilterTab } from "@/lib/messaging";

/** All / Orders / Pre-purchase / Support filter pill row. */
export default function FilterTabs({
  tab,
  onTabChange,
}: {
  tab: FilterTab;
  onTabChange: (tab: FilterTab) => void;
}) {
  return (
    <div className="flex gap-2 border-b border-gray-800 pb-4 overflow-x-auto">
      {FILTER_TABS.map((t) => (
        <button
          key={t}
          onClick={() => onTabChange(t)}
          className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
            tab === t
              ? "bg-amber-400 text-black"
              : "bg-gray-900 text-gray-400 hover:bg-gray-800"
          }`}
        >
          {t}
        </button>
      ))}
    </div>
  );
}
