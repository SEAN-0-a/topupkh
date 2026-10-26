"use client";

// KYC step 2 — Government ID front/back upload tiles + submit/back actions.

export type DocSide = "front" | "back";

export default function KycStep2Documents({
  frontPreview,
  backPreview,
  frontPath,
  backPath,
  uploading,
  frontFile,
  backFile,
  submitting,
  frontInputRef,
  backInputRef,
  onPickDoc,
  onBack,
}: {
  /** Object-URL previews (null = nothing chosen yet). */
  frontPreview: string | null;
  backPreview: string | null;
  /** Uploaded storage paths (set after a verified upload). */
  frontPath: string | null;
  backPath: string | null;
  uploading: DocSide | null;
  frontFile: File | null;
  backFile: File | null;
  submitting: boolean;
  frontInputRef: React.RefObject<HTMLInputElement | null>;
  backInputRef: React.RefObject<HTMLInputElement | null>;
  onPickDoc: (kind: DocSide, file: File | undefined | null) => void;
  onBack: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {(["front", "back"] as const).map((kind) => {
          const preview = kind === "front" ? frontPreview : backPreview;
          const uploadedPath = kind === "front" ? frontPath : backPath;
          const busy = uploading === kind;
          return (
            <div key={kind} className="rounded-xl border border-gray-800 bg-gray-950 p-3 text-center">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-gray-400">
                ID {kind}
              </p>
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={preview}
                  alt={`ID ${kind}`}
                  className={`mx-auto h-28 w-full rounded-lg border border-gray-700 object-cover ${uploadedPath ? "ring-2 ring-emerald-500/60" : ""}`}
                />
              ) : (
                <div className="mx-auto flex h-28 w-full items-center justify-center rounded-lg border border-dashed border-gray-700 bg-gray-900 text-2xl">
                  🪪
                </div>
              )}
              <label className="mt-2 inline-block cursor-pointer rounded-lg bg-gray-800 px-3 py-1.5 text-[11px] font-bold text-gray-200 transition-all hover:bg-gray-700">
                {preview ? "Change" : "Choose photo"}
                <input
                  ref={kind === "front" ? frontInputRef : backInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,.jpg,.jpeg,.png"
                  className="hidden"
                  onChange={(e) => {
                    onPickDoc(kind, e.target.files?.[0]);
                    e.target.value = ""; // allow re-picking the same file
                  }}
                />
              </label>
              <p className="mt-1.5 text-[10px] text-gray-500">
                {busy ? "Uploading..." : uploadedPath ? "✅ Uploaded" : "JPG/PNG · 100KB–5MB · ≥300×300 px"}
              </p>
            </div>
          );
        })}
      </div>

      <p className="rounded-xl border border-gray-800 bg-gray-950 p-3 text-[11px] leading-relaxed text-gray-400">
        🔐 Your ID photos are uploaded to a <span className="font-bold text-gray-200">private</span> bucket
        readable only by you and reviewing staff — never visible to buyers.
      </p>

      <button
        type="submit"
        disabled={submitting || !frontFile || !backFile}
        className="w-full rounded-xl bg-emerald-500 py-3 text-xs font-extrabold text-black shadow transition-all hover:bg-emerald-400 disabled:opacity-50"
      >
        {submitting ? "Submitting application..." : "Submit verification application"}
      </button>
      <button
        type="button"
        onClick={onBack}
        disabled={submitting}
        className="w-full rounded-xl border border-gray-700 bg-gray-800 py-2.5 text-xs font-bold text-gray-300 transition-all hover:bg-gray-700 disabled:opacity-50"
      >
        ← Back to details
      </button>
    </div>
  );
}
