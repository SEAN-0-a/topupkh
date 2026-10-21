import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * /register — registration lives in the /login form (sign-up toggle).
 * Signed-in visitors are sent home; everyone else continues to /login.
 */
export default async function RegisterPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user && !user.is_anonymous) {
    redirect("/");
  }
  redirect("/login");
}
