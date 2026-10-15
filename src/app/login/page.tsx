"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleAuth = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        alert("ការចុះឈ្មោះជោគជ័យ! (Account created successfully)");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        alert("ចូលប្រើប្រាស់ជោគជ័យ! (Logged in successfully)");
      }
      router.push("/");
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Authentication failed";
      alert("មានបញ្ហា: " + msg);
    } finally {
      setLoading(false);
    }
  };

  let buttonLabel = "ចូលប្រើ (Log In)";
  if (loading) {
    buttonLabel = "កំពុងដំណើរការ...";
  } else if (isSignUp) {
    buttonLabel = "ចុះឈ្មោះ (Sign Up)";
  }

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-gray-900 border border-gray-800 p-8 rounded-2xl space-y-6">
        <h2 className="text-2xl font-bold text-center text-emerald-400">
          {isSignUp ? "បង្កើតគណនី (Sign Up)" : "ចូលប្រើប្រាស់ (Log In)"}
        </h2>

        <form onSubmit={(e) => void handleAuth(e)} className="space-y-4">
          <div>
            <label htmlFor="auth-email" className="block text-xs text-gray-400 mb-1">
              អុីមែល (Email)
            </label>
            <input
              id="auth-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-black border border-gray-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label htmlFor="auth-password" className="block text-xs text-gray-400 mb-1">
              ពាក្យសម្ងាត់ (Password)
            </label>
            <input
              id="auth-password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-black border border-gray-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold py-3 rounded-xl transition text-sm cursor-pointer"
          >
            {buttonLabel}
          </button>
        </form>

        <button
          onClick={() => setIsSignUp(!isSignUp)}
          className="w-full text-center text-xs text-gray-400 hover:text-white"
        >
          {isSignUp ? "មានគណនីរួចហើយ? ចូលប្រើប្រាស់" : "មិនទាន់មានគណនី? បង្កើតគណនីថ្មី"}
        </button>
      </div>
    </div>
  );
}