"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { User } from "@supabase/supabase-js";

export default function FloatingChatButton() {
  const [unreadCount] = useState(0);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    async function checkUserAndMessages() {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    }
    checkUserAndMessages();
  }, []);

  if (!user) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <Link
        href="/message"
        className="relative flex items-center justify-center w-14 h-14 bg-emerald-500 hover:bg-emerald-400 text-black rounded-full shadow-2xl transition-all transform hover:scale-105 cursor-pointer"
        title="Open Messages"
      >
        <span className="text-2xl">💬</span>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-gray-950">
            {unreadCount}
          </span>
        )}
      </Link>
    </div>
  );
}