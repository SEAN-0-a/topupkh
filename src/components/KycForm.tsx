"use client";

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
 *
 * Broken into ./kyc child components; document checks live in lib/kyc-doc.ts.
 */

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { submitSellerKyc } from "@/app/actions/kyc";
import {
  docExtension,
  normalizeDocMime,
  validateKycDetails,
} from "@/lib/kyc-validation";
import { validateIdDoc } from "@/lib/kyc-doc";
import KycStepIndicator from "./kyc/KycStepIndicator";
import KycStep1Details, { type KycStep1Form } from "./kyc/KycStep1Details";
import KycStep2Documents from "./kyc/KycStep2Documents";

/** Pre-filled KYC details (used when REJECTED users edit & re-apply). */
export type KycInitialDetails = KycStep1Form;

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
  const [form, setForm] = useState<KycStep1Form>({
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

  function setField<K extends keyof KycStep1Form>(key: K, value: KycStep1Form[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function pickDoc(kind: "front" | "back", file: File | undefined | null) {
    if (!file) return;
    setError(null);
    void validateIdDoc(file).then((docError) => {
      if (docError) {
        setError(docError);
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
    });
  }

  /**
   * Upload one document to the private bucket; returns its storage path.
   * The upload is VERIFIED before returning: the object's existence is
   * re-checked with a signed-URL probe (a valid, fetchable URL) so the form
   * payload can never reference a path that didn't actually land in storage.
   */
  async function uploadDoc(kind: "front" | "back"): Promise<string | null> {
    const file = kind === "front" ? frontFile : backFile;
    if (!file) return null;
    // skip if already uploaded (e.g. user went back and forth between steps)
    const existingPath = kind === "front" ? frontPath : backPath;
    if (existingPath) return existingPath;

    setUploading(kind);
    setError(null);
    try {
      const path = `${userId}/${Date.now()}-${kind}.${docExtension(file.name) || "jpg"}`;
      // contentType NORMALIZED: browsers may report .jpg files as "image/jpg"
      // or an empty type — Storage's allowed MIME list only accepts the
      // canonical "image/jpeg", so standard files must map to it here.
      const contentType = normalizeDocMime(file.type) ?? "image/jpeg";
      const { error: uploadError } = await supabase.storage
        .from("seller-docs")
        .upload(path, file, { cacheControl: "3600", contentType });
      if (uploadError) throw new Error(uploadError.message);

      // verify the object is real and readable via a signed URL — for a
      // PRIVATE bucket this is the equivalent of "a valid URL exists": it
      // proves the upload landed (RLS-visible to the owner) before submit
      const { data: signed, error: signedError } = await supabase.storage
        .from("seller-docs")
        .createSignedUrl(path, 60);
      if (signedError || !signed?.signedUrl) {
        // raw storage error goes to the console for diagnosis
        console.error(`KYC post-upload verification failed (${kind}):`, signedError);
        throw new Error(
          "Upload completed but the file could not be verified in storage — please re-upload.",
        );
      }

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

  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900 p-6">
      <KycStepIndicator step={step} />

      {error && (
        <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {step === 1 ? (
          <KycStep1Details
            form={form}
            fieldErrors={fieldErrors}
            onFieldChange={setField}
            onContinue={() => setStep(2)}
          />
        ) : (
          <KycStep2Documents
            frontPreview={frontPreview}
            backPreview={backPreview}
            frontPath={frontPath}
            backPath={backPath}
            uploading={uploading}
            frontFile={frontFile}
            backFile={backFile}
            submitting={submitting}
            frontInputRef={frontInputRef}
            backInputRef={backInputRef}
            onPickDoc={pickDoc}
            onBack={() => setStep(1)}
          />
        )}
      </form>
    </div>
  );
}
