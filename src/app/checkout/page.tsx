import { redirect } from "next/navigation";

/**
 * The legacy listing-based checkout has been replaced by the new flow:
 *   /product/[id]  ->  Buy button (server action)  ->  /checkout/[public-ref]
 * This old route just points people at the marketplace.
 */
export default function LegacyCheckoutRedirect() {
  redirect("/marketplace");
}
