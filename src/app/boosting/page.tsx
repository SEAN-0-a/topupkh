import { redirect } from "next/navigation";

/**
 * Boosting offers are browsed in the marketplace under the `boosting`
 * category tab — send users straight there.
 */
export default function BoostingRedirect() {
  redirect("/marketplace?category=boosting");
}
