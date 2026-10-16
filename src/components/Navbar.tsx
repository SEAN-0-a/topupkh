"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { User } from "@supabase/supabase-js";

export default function Navbar() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    // Check active user session
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });

    // Listen for auth changes (login/logout)
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    setUser(null);
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="w-full bg-gray-900/80 backdrop-blur-md border-b border-gray-800 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 py-3.5 flex items-center justify-between">
        {/* Brand / Logo */}
        <Link href="/" className="flex items-center gap-2 text-lg font-bold text-white tracking-wide">
          <span className="bg-emerald-500 text-black px-2 py-0.5 rounded-lg text-sm font-black">
            KH
          </span>
          TopUpKH
        </Link>

        {/* Navigation Links */}
        <nav className="flex items-center gap-4 text-xs font-medium">
          <Link
            href="/"
            className="text-gray-300 hover:text-white transition-colors"
          >
            Store
          </Link>

          <Link
            href="/seller/deliveries"
            className="text-gray-300 hover:text-white transition-colors"
          >
            Seller Deliveries
          </Link>

          <Link
            href="/admin/escrow"
            className="text-amber-400 hover:text-amber-300 transition-colors font-semibold bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg"
          >
            Admin Escrow
          </Link>

          {/* User Auth State */}
          {user ? (
            <div className="flex items-center gap-3 pl-2 border-l border-gray-800">
              <span className="text-gray-400 text-[11px] truncate max-w-[120px]">
                {user.email}
              </span>
              <button
                onClick={handleLogout}
                className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 px-3 py-1 rounded-lg transition-colors cursor-pointer"
              >
                Log Out
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold px-3.5 py-1.5 rounded-lg transition-all"
            >
              Log In
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}