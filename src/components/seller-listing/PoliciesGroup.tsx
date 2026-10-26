"use client";

// Fieldset 4 — policies (refund policy, ownership note).

import { InputBlock, inputCls } from "./FormControls";

export default function PoliciesGroup({
  t,
  refundPolicy,
  onRefundPolicyChange,
  ownershipNote,
  onOwnershipNoteChange,
}: {
  t: (key: string) => string;
  refundPolicy: string;
  onRefundPolicyChange: (v: string) => void;
  ownershipNote: string;
  onOwnershipNoteChange: (v: string) => void;
}) {
  return (
    <fieldset className="space-y-4 rounded-2xl border border-gray-800 bg-gray-900 p-5">
      <legend className="px-2 text-xs font-bold text-emerald-400">{t("sell.step4")}</legend>
      <InputBlock label={t("sell.f_refund_label")}>
        <textarea
          value={refundPolicy}
          onChange={(e) => onRefundPolicyChange(e.target.value)}
          rows={2}
          className={inputCls}
        />
      </InputBlock>
      <InputBlock label={t("sell.f_ownership_label")}>
        <textarea
          value={ownershipNote}
          onChange={(e) => onOwnershipNoteChange(e.target.value)}
          rows={2}
          className={inputCls}
          placeholder="I created this asset myself / license attached…"
        />
      </InputBlock>
    </fieldset>
  );
}
