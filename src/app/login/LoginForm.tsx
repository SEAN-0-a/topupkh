"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { useTheme } from "next-themes";
import { supabase } from "@/lib/supabase";

// hydration-safe theme probe (no setState-in-effect)
const noopSubscribe = () => () => {};

/** Turnstile's widget skin: light on light, dark on dark. */
function useTurnstileTheme(): "light" | "dark" {
  const { resolvedTheme } = useTheme();
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  if (!mounted) return "dark";
  return resolvedTheme === "light" ? "light" : "dark";
}

/**
 * The interactive login form. Authenticated-visit guarding is two-layered:
 *   - the server page (src/app/login/page.tsx) redirects already-signed-in
 *     visitors with full SSR context, and
 *   - this effect below catches anything the server snapshot missed (e.g.
 *     the session cookie was just written client-side or rehydrated late)
 *     by checking getUser() and listening for auth state changes.
 */
export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileInstance | null>(null);
  const turnstileTheme = useTurnstileTheme();

  // Client-side guard: an authenticated user never sees the login screen.
  useEffect(() => {
    let alive = true;

    async function checkExistingSession() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user && alive) {
        // Honor ?next=... (e.g. /login?next=/admin/sellers) — the same-since
        // guard must not dump the user on `/` like the old hardcode did.
        router.replace(getNextPath());
      }
    }
    checkExistingSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        // INITIAL_SESSION (hydrated cookie) and SIGNED_IN (fresh sign-in or
        // OAuth callback) both mean "leave /login"; TOKEN_REFRESHED may fire
        // for an already-redirecting user — same action, router dedupes.
        if ((event === "INITIAL_SESSION" || event === "SIGNED_IN") && session?.user) {
          router.replace(getNextPath());
        }
      },
    );

    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, [router]);

  function resetTurnstile() {
    // Turnstile tokens are single-use: once they've been verified server-side
    // (or failed verification) the widget must issue a fresh one.
    setTurnstileToken(null);
    turnstileRef.current?.reset();
  }

  // Honour ?next=... (produced by /orders, /checkout/[ref], /settings, ...).
  // Only allow same-origin relative paths ("//evil.com" is not).
  function getNextPath(): string {
    const raw = new URLSearchParams(window.location.search).get("next");
    return raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/marketplace";
  }

  async function handleOAuthLogin(provider: "google" | "facebook") {
    const next = getNextPath();
    await supabase.auth.signInWithOAuth({
      provider,
      options: {
        // /auth/callback exchanges the PKCE ?code= for a cookie session
        // (see src/app/auth/callback/route.ts) and then redirects to `next`.
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
  }

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    if (!turnstileToken) {
      setErrorMsg("Please complete the Cloudflare security verification.");
      return;
    }

    setLoading(true);
    setErrorMsg("");

    try {
      // Server-side Turnstile verification (siteverify) before any auth call.
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ turnstileToken }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message ?? "Bot verification failed. Please try again.");
      }
      // The token has now been consumed by verification, so don't retry with it.
      setTurnstileToken(null);

      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        resetTurnstile(); // Stay on the page after sign-up; need a fresh token.
        alert("Check your email for the confirmation link!");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push(getNextPath());
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Authentication failed";
      setErrorMsg(message);
      resetTurnstile();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-100 dark:bg-[#1a1528] relative overflow-hidden p-4">
      {/* Background FX — decorative gradient only in dark mode */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#2a1e45] via-[#1a1528] to-[#0e0a17] opacity-0 dark:opacity-90" />

      {/* Main Login Card */}
      <div className="relative z-10 w-full max-w-md bg-white dark:bg-[#1d2029] border border-slate-200 dark:border-gray-800 rounded-2xl shadow-xl p-8 space-y-6">

        {/* Brand Logo */}
        <div className="flex items-center justify-center gap-2 text-2xl font-bold text-slate-900 dark:text-white">
          <div className="w-8 h-8 bg-amber-400 rounded-lg flex items-center justify-center text-black font-bold text-lg">
            ⚡
          </div>
          <span>TopUpKH</span>
        </div>

        <h1 className="text-xl font-semibold text-slate-900 dark:text-white text-center">
          {isSignUp ? "Create an account" : "Sign in"}
        </h1>

        {/* OAuth Buttons */}
        <div className="space-y-2.5">
          <button
            type="button"
            onClick={() => handleOAuthLogin("google")}
            className="w-full bg-slate-100 dark:bg-[#272b38] hover:bg-slate-200 dark:hover:bg-[#323747] text-slate-800 dark:text-gray-200 font-medium py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer border border-slate-300 dark:border-gray-700/50"
          >
            <span>🌐</span> Sign in with Google
          </button>

          <button
            type="button"
            onClick={() => handleOAuthLogin("facebook")}
            className="w-full bg-slate-100 dark:bg-[#272b38] hover:bg-slate-200 dark:hover:bg-[#323747] text-slate-800 dark:text-gray-200 font-medium py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer border border-slate-300 dark:border-gray-700/50"
          >
            <span>📘</span> Continue with Facebook
          </button>
        </div>

        {/* Divider */}
        <div className="relative flex items-center justify-center">
          <div className="border-t border-slate-300 dark:border-gray-800 w-full" />
          <span className="bg-white dark:bg-[#1d2029] px-3 text-[11px] text-slate-500 dark:text-gray-500 uppercase font-semibold absolute">
            Or
          </span>
        </div>

        {/* Form Error Banner */}
        {errorMsg && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 p-3 rounded-xl text-xs text-center">
            {errorMsg}
          </div>
        )}

        {/* Email Form */}
        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-gray-300 mb-1">
              Email address
            </label>
            <input
              type="email"
              placeholder="name@host.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-slate-50 dark:bg-[#14161d] border border-slate-300 dark:border-gray-700 focus:border-amber-400 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-gray-300 mb-1">
              Password
            </label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full bg-slate-50 dark:bg-[#14161d] border border-slate-300 dark:border-gray-700 focus:border-amber-400 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none transition-all"
            />
          </div>

          {/* Cloudflare Turnstile Bot Security Widget */}
          <div className="flex justify-center my-2">
            <Turnstile
              ref={turnstileRef}
              siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "1x00000000000000000000AA"}
              onSuccess={(token) => setTurnstileToken(token)}
              onExpire={resetTurnstile}
              onError={resetTurnstile}
              options={{ theme: turnstileTheme }}
            />
          </div>

          <button
            type="submit"
            disabled={loading || !turnstileToken}
            className="w-full bg-amber-400 hover:bg-amber-300 text-black font-extrabold py-3 rounded-xl text-xs transition-all cursor-pointer shadow-lg disabled:opacity-50"
          >
            {loading ? "Processing..." : isSignUp ? "Create Account" : "Next"}
          </button>
        </form>

        {/* Footer Toggle */}
        <p className="text-center text-xs text-slate-600 dark:text-gray-400">
          {isSignUp ? "Already have an account?" : "New user?"}{" "}
          <button
            type="button"
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-amber-600 dark:text-amber-400 font-bold hover:underline cursor-pointer ml-1"
          >
            {isSignUp ? "Sign in" : "Create an account"}
          </button>
        </p>

      </div>
    </div>
  );
}
