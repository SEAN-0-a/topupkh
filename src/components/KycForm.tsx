"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { submitSellerKyc } from "@/app/actions/kyc";
import {
  DOC_TYPES,
  MIN_DOC_BYTES,
  MIN_DOC_DIMENSION,
  MAX_DOC_BYTES,
  validateKycDetails,
  validateAccountNumber,
} from "@/lib/kyc-validation";

type Step1 = {
  sellerType: "individual" | "company";
  shopName: string;
  phoneNumber: string;
  payoutBankName: string;
  payoutAccountNumber: string;
  payoutAccountName: string;
};

/** Pre-filled KYC details (used when REJECTED users edit & re-apply). */
export type KycInitialDetails = Step1;

const KH_BANKS = ["ABA Bank", "Bakong (KHQR)", "ACLEDA Bank", "Wing Bank", "Cambodia Public Bank", "Canadia Bank", "AFT (ATL)", "Hamkab Bank", "Vattanac Bank"];

/**
 * Multi-step seller KYC (Steps 1+2 of the verification spec):
 *   Step 1 — seller type / shop name / phone / payout bank details
 *   Step 2 — Government ID front + back, uploaded by the browser into the
 *            PRIVATE `seller-docs` bucket under <uid>/... (RLS-enforced);
 *            submit then goes through the submit_seller_kyc RPC which
 *            re-validates everything server-side and marks the application
 *            verification_status = 'pending'.
 * `initialDetails` pre-fills Step 1 with the previously submitted values so
 * a REJECTED applicant can edit their details and re-submit without retyping.
 */
export default function KycForm({
  userId,
  initialDetails,
}: {
  userId: string;
  initialDetails?: KycInitialDetails;
}) {
  const router = useRouter();
  const frontInputRef = useRef<HTMLInputElement>(null);
  const backInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState<Step1>({
    sellerType: initialDetails?.sellerType ?? "individual",
    shopName: initialDetails?.shopName ?? "",
    phoneNumber: initialDetails?.phoneNumber ?? "",
    payoutBankName: initialDetails?.payoutBankName || "ABA Bank",
    payoutAccountNumber: initialDetails?.payoutAccountNumber ?? "",
    payoutAccountName: initialDetails?.payoutAccountName ?? "",
  });
  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [frontPreview, setFrontPreview] = useState<string | null>(null);
  const [frontPath, setFrontPath] = useState<string | null>(null);

  const [backFile, setBackFile] = useState<File | null>(null);
  const [backPreview, setBackPreview] = useState<string | null>(null);
  const [backPath, setBackPath] = useState<string | null>(null);

  const [uploading, setUploading] = useState<"front" | "back" | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // strict validation, shared with the server action (src/lib/kyc-validation.ts)
  const fieldErrors = useMemo(
    () => validateKycDetails({
      shopName: form.shopName.trim(),
      phoneNumber: form.phoneNumber.trim(),
      payoutBankName: form.payoutBankName.trim(),
      payoutAccountNumber: form.payoutAccountNumber.trim(),
      payoutAccountName: form.payoutAccountName.trim(),
    }),
    [form],
  );
  const step1Valid = Object.keys(fieldErrors).length === 0;

  function setField<K extends keyof Step1>(key: K, value: Step1[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  /**
   * ID document quality gate:
   *   - real JPG or PNG image (no SVG/WebP/PDF renamed as image)
   *   - 100 KB – 5 MB (rejects blank / placeholder uploads)
   *   - actually decodable AND at least 300×300 px (rejects 1-pixel fakes)
   */
  async function pickDoc(kind: "front" | "back", file: File | undefined | null) {
    if (!file) return;
    setError(null);
    if (!DOC_TYPES.includes(file.type as (typeof DOC_TYPES)[number])) {
      setError("ID photo must be a JPG or PNG image.");
      return;
    }
    if (file.size < MIN_DOC_BYTES) {
      setError("ID photo is too small (below 100 KB) — upload a clear photo of the real document.");
      return;
    }
    if (file.size > MAX_DOC_BYTES) {
      setError("ID photo must be under 5 MB.");
      return;
    }

    // decode the image to prove it's a real picture, not an empty/1px file
    try {
      const bitmap = await createImageBitmap(file);
      const { width, height } = bitmap;
      bitmap.close();
      if (width < MIN_DOC_DIMENSION || height < MIN_DOC_DIMENSION) {
        setError(`ID photo is too small (${width}×${height} px) — use a real photo, at least ${MIN_DOC_DIMENSION}×${MIN_DOC_DIMENSION} px.`);
        return;
      }
    } catch {
      setError("This file is not a readable JPG/PNG image — please re-upload your real document.");
      return;
    }

    if (kind === "front") {
      setFrontFile(file);
      if (frontPreview) URL.revokeObjectURL(frontPreview);
      setFrontPreview(URL.createObjectURL(file));
      setFrontPath(null);
    } else {
      setBackFile(file);
      if (backPreview) URL.revokeObjectURL(backPreview);
      setBackPreview(URL.createObjectURL(file));
      setBackPath(null);
    }
  }

  /** Upload one document to the private bucket; returns its storage path. */
  async function uploadDoc(kind: "front" | "back"): Promise<string | null> {
    const file = kind === "front" ? frontFile : backFile;
    if (!file) return null;
    // skip if already uploaded (e.g. user went back and forth between steps)
    const existingPath = kind === "front" ? frontPath : backPath;
    if (existingPath) return existingPath;

    setUploading(kind);
    setError(null);
    try {
      const ext = file.type === "image/png" ? "png" : "jpg"; // validated at pick-time
      const path = `${userId}/${Date.now()}-${kind}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("seller-docs")
        .upload(path, file, { cacheControl: "3600", contentType: file.type });
      if (uploadError) throw new Error(uploadError.message);

      if (kind === "front") setFrontPath(path);
      else setBackPath(path);
      return path;
    } finally {
      setUploading(null);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const front = await uploadDoc("front");
      const back = await uploadDoc("back");
      if (!front || !back) {
        throw new Error("Both ID photos (front and back) are required.");
      }

      const result = await submitSellerKyc({
        sellerType: form.sellerType,
        shopName: form.shopName.trim(),
        phoneNumber: form.phoneNumber.trim(),
        payoutBankName: form.payoutBankName.trim(),
        payoutAccountNumber: form.payoutAccountNumber.trim(),
        payoutAccountName: form.payoutAccountName.trim(),
        frontPath: front,
        backPath: back,
      });
      if (!result.ok) throw new Error(result.message);

      // success → the parent page renders the "under review" screen
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submission failed — please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass =
    "mt-1 w-full rounded-xl border border-gray-700 bg-gray-800 px-4 py-2.5 text-xs text-white placeholder-gray-500 focus:border-emerald-400 focus:outline-none";
  const labelClass = "block text-xs font-semibold text-gray-300";

  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900 p-6">
      {/* Step indicator */}
      <div className="mb-5 flex items-center gap-2 text-[11px] font-bold">
        <span className={step === 1 ? "rounded-full bg-emerald-500 px-2.5 py-1 text-black" : "rounded-full bg-gray-800 px-2.5 py-1 text-gray-400"}>
          1 · Details & payout bank
        </span>
        <span className="text-gray-600">→</span>
        <span className={step === 2 ? "rounded-full bg-emerald-500 px-2.5 py-1 text-black" : "rounded-full bg-gray-800 px-2.5 py-1 text-gray-400"}>
          2 · Identity documents
        </span>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {step === 1 ? (
          <div className="space-y-4">
            {/* Seller type */}
            <div>
              <label className={labelClass}>Seller type</label>
              <div className="mt-1.5 grid grid-cols-2 gap-2">
                {(["individual", "company"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setField("sellerType", t)}
                    className={`rounded-xl border px-3 py-2.5 text-xs font-bold capitalize transition-all ${
                      form.sellerType === t
                        ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-400"
                        : "border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-700"
                    }`}
                  >
                    {t === "individual" ? "👤 Individual" : "🏢 Company"}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className={labelClass}>Shop name</label>
              <input
                type="text"
                required
                minLength={3}
                maxLength={80}
                value={form.shopName}
                onChange={(e) => setField("shopName", e.target.value)}
                placeholder="e.g. Rising Tier Store"
                className={`${inputClass} ${fieldErrors.shopName ? "!border-red-500" : ""}`}
              />
              {fieldErrors.shopName && (
                <p className="mt-1 text-[10px] text-red-400">{fieldErrors.shopName}</p>
              )}
            </div>

            <div>
              <label className={labelClass}>Phone number (Cambodian)</label>
              <input
                type="tel"
                required
                maxLength={30}
                value={form.phoneNumber}
                onChange={(e) => setField("phoneNumber", e.target.value)}
                placeholder="012 345 678 or +855 12 345 678"
                className={`${inputClass} ${fieldErrors.phoneNumber ? "!border-red-500" : ""}`}
              />
              {fieldErrors.phoneNumber ? (
                <p className="mt-1 text-[10px] text-red-400">{fieldErrors.phoneNumber}</p>
              ) : (
                <p className="mt-1 text-[10px] text-gray-500">
                  Operator prefixes: 010, 011, 012, 015, 016, 017, 070, 073, 076, 081, 085, 092… + 6–7 digits
                </p>
              )}
            </div>

            <div className="rounded-xl border border-gray-800 bg-gray-950 p-4">
              <p className="mb-3 text-[11px] font-bold uppercase tracking-wide text-gray-400">
                🏦 Payout bank details (where funds arrive after escrow)
              </p>
              <div className="space-y-4">
                <div>
                  <label className={labelClass}>Bank</label>
                  <input
                    type="text"
                    required
                    list="kh-banks"
                    value={form.payoutBankName}
                    onChange={(e) => setField("payoutBankName", e.target.value)}
                    placeholder="ABA Bank"
                    className={inputClass}
                  />
                  <datalist id="kh-banks">
                    {KH_BANKS.map((b) => (
                      <option key={b} value={b} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className={labelClass}>Account number / Bakong phone</label>
                  <input
                    type="text"
                    required
                    maxLength={34}
                    value={form.payoutAccountNumber}
                    onChange={(e) => setField("payoutAccountNumber", e.target.value)}
                    placeholder="000 123 456 (ABA)"
                    className={`${inputClass} ${
                      fieldErrors.payoutAccountNumber ||
                      validateAccountNumber(form.payoutAccountNumber.trim(), "ABA Bank")
                        ? "!border-red-500"
                        : ""
                    }`}
                  />
                  {fieldErrors.payoutAccountNumber ? (
                    <p className="mt-1 text-[10px] text-red-400">{fieldErrors.payoutAccountNumber}</p>
                  ) : (
                    <p className="mt-1 text-[10px] text-gray-500">ABA / Bakong accounts: at least 9 digits</p>
                  )}
                </div>
                <div>
                  <label className={labelClass}>Account holder name (as on official ID)</label>
                  <input
                    type="text"
                    required
                    maxLength={80}
                    value={form.payoutAccountName}
                    onChange={(e) => setField("payoutAccountName", e.target.value)}
                    placeholder="e.g. SOK CHAN"
                    className={`${inputClass} ${fieldErrors.payoutAccountName ? "!border-red-500" : ""}`}
                  />
                  {fieldErrors.payoutAccountName ? (
                    <p className="mt-1 text-[10px] text-red-400">{fieldErrors.payoutAccountName}</p>
                  ) : (
                    <p className="mt-1 text-[10px] text-gray-500">First name + last name, matching your ID</p>
                  )}
                </div>
              </div>
            </div>

            <button
              type="button"
              disabled={!step1Valid}
              onClick={() => setStep(2)}
              className="w-full rounded-xl bg-emerald-500 py-3 text-xs font-extrabold text-black shadow transition-all hover:bg-emerald-400 disabled:opacity-50"
            >
              Continue to ID documents →
            </button>
          </div>
        ) : (
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
                        accept="image/png,image/jpeg"
                        className="hidden"
                        onChange={(e) => {
                          void pickDoc(kind, e.target.files?.[0]);
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
              onClick={() => setStep(1)}
              disabled={submitting}
              className="w-full rounded-xl border border-gray-700 bg-gray-800 py-2.5 text-xs font-bold text-gray-300 transition-all hover:bg-gray-700 disabled:opacity-50"
            >
              ← Back to details
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
