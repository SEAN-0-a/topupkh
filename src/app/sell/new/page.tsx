import { redirect } from "next/navigation";

/** The offer creation form lives at /seller/listings/new now. */
export default function LegacySellNewRedirect() {
  redirect("/seller/listings/new");
}
