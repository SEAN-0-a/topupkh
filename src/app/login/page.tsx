import { redirect } from "next/navigation";
import LoginForm from "./LoginForm";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * /login — server-side guard first: a visitor whose auth cookie already
 * contains a valid session never even renders the form — they are sent
 * straight to the ?next=... target (e.g. /admin/sellers), NOT to `/`,
 * otherwise an admin bounced here by an /admin/* guard would get dumped
 * on the home page. The client-side layer (LoginForm) catches
 * late-rehydrated sessions via getUser() / onAuthStateChange.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { next } = await searchParams;
  // Only allow same-origin relative paths ("//evil.com" is not).
  const safeNext =
    typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/";

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user && !user.is_anonymous) {
    redirect(safeNext);
  }

  return <LoginForm />;
}
