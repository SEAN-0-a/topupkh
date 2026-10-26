import { statusChip, prettyStatus } from "@/lib/messaging";

/** Colored pill describing an order / ticket status. */
export default function StatusChip({ status }: { status: string }) {
  return (
    <span
      className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusChip(status)}`}
    >
      {prettyStatus(status)}
    </span>
  );
}
