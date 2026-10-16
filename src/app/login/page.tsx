"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMessage("");

    if (isSignUp) {
      // Handle User Sign Up
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        setErrorMessage(error.message);
      } else {
        alert("Account created successfully! You can now log in.");
        setIsSignUp(false);
      }
    } else {
      // Handle User Login
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setErrorMessage(error.message);
      } else {
        router.push("/");
        router.refresh();
      }
    }

    setLoading(false);
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4 text-white">
      <div className="w-full max-w-md bg-gray-900 border border-gray-800 rounded-2xl p-8 shadow-2xl space-y-6">
        
        {/* Title */}
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold">
            {isSignUp ? "Create an Account" : "Welcome Back"}
          </h1>
          <p className="text-xs text-gray-400">
            {isSignUp
              ? "Sign up to start placing or fulfilling orders"
              : "Log in to manage your orders and escrow pipeline"}
          </p>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs p-3 rounded-xl">
            {errorMessage}
          </div>
        )}

        {/* Auth Form */}
        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500 text-white placeholder-gray-600"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500 text-white placeholder-gray-600"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-bold py-3 rounded-xl text-sm transition-all cursor-pointer shadow-lg shadow-emerald-500/10 mt-2"
          >
            {loading
              ? "Processing..."
              : isSignUp
              ? "Sign Up"
              : "Log In"}
          </button>
        </form>

        {/* Toggle Login vs Sign Up */}
        <div className="text-center pt-2 border-t border-gray-800">
          <button
            onClick={() => {
              setIsSignUp(!isSignUp);
              setErrorMessage("");
            }}
            className="text-xs text-gray-400 hover:text-white transition-colors underline cursor-pointer"
          >
            {isSignUp
              ? "Already have an account? Log in"
              : "Don't have an account? Sign up"}
          </button>
        </div>

      </div>
    </div>
  );
}