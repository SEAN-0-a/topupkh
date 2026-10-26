"use client";

// Shared low-level form controls for the seller listing fieldset groups.

/** i18n-keyed delivery-method options for the commercial-terms fieldset. */
export const DELIVERY_OPTIONS = [
  { value: "in_game", key: "market.delivery_in_game" },
  { value: "instructions", key: "market.delivery_instructions" },
  { value: "digital_file", key: "market.delivery_digital_file" },
  { value: "creator_services", key: "market.delivery_creator_service" },
];

export const inputCls =
  "w-full rounded-xl border border-gray-800 bg-black px-4 py-2.5 text-sm focus:border-emerald-500 focus:outline-none";

export function InputBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold text-gray-400">{label}</span>
      {children}
    </label>
  );
}

export function SelectBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return <InputBlock label={label}>{children}</InputBlock>;
}

export function Checkbox({
  checked, disabled, onChange, label,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-center gap-2 text-xs text-gray-300">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-emerald-500"
      />
      {label}
    </label>
  );
}

/** Full-width notice / placeholder panel (non-approved seller, success…). */
export function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900 p-6 text-center text-sm text-gray-300">
      {children}
    </div>
  );
}
