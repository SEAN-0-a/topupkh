import Image from "next/image";

/** Full-screen dark loader shown by the root `loading.tsx` boundary. */
export default function PageLoader() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading RomdoulKHShop"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-[#050811]"
    >
      {/* Spinner ring around the brand mark */}
      <div className="relative flex h-24 w-24 items-center justify-center">
        <div className="absolute inset-0 animate-spin rounded-full border-4 border-white/10 border-t-amber-400" />
        <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-[#0b1120] shadow-[0_0_30px_rgba(245,158,11,0.18)]">
          <Image
            src="/logo.png"
            alt="RomdoulKHShop"
            width={44}
            height={44}
            priority
            className="h-11 w-11 object-contain"
          />
        </div>
      </div>

      <p className="text-sm font-bold tracking-wide text-slate-100">RomdoulKHShop</p>

      {/* Heartbeat baseline */}
      <svg
        viewBox="0 0 160 24"
        fill="none"
        aria-hidden="true"
        className="h-6 w-40 animate-pulse text-amber-400"
      >
        <path
          d="M0 12h44l7-8 8 16 6-8h95"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
