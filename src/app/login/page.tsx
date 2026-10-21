import { redirect } from "next/navigation";
import LoginForm from "./LoginForm";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * /login — server-side guard first: a visitor whose auth cookie already
 * contains a valid session never even renders the form (redirected to home).
 * The client-side layer (LoginForm) catches late-rehydrated sessions via
 * getUser() / onAuthStateChange.
 */
export default async function LoginPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user && !user.is_anonymous) {
    redirect("/");
  }

  return <LoginForm />;
}
