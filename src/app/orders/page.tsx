'use client';

import { useState } from 'react';
import Link from 'next/link';

interface Game {
  id: string;
  name: string;
  publisher: string;
  badge?: string;
  gradient: string;
}

interface Package {
  id: string;
  name: string;
  price: number;
  bonus?: string;
  popular?: boolean;
}

const GAMES: Game[] = [
  {
    id: 'Mobile Legends',
    name: 'Mobile Legends',
    publisher: 'Moonton',
    badge: 'Popular',
    gradient: 'from-amber-500/20 to-orange-500/20 text-amber-400 border-amber-500/30',
  },
  {
    id: 'PUBG Mobile',
    name: 'PUBG Mobile',
    publisher: 'Tencent Games',
    badge: 'Hot',
    gradient: 'from-emerald-500/20 to-teal-500/20 text-emerald-400 border-emerald-500/30',
  },
  {
    id: 'Free Fire',
    name: 'Free Fire',
    publisher: 'Garena',
    gradient: 'from-purple-500/20 to-indigo-500/20 text-purple-400 border-purple-500/30',
  },
];

const PACKAGES: Record<string, Package[]> = {
  'Mobile Legends': [
    { id: 'ml-1', name: '86 Diamonds', price: 1.5, bonus: '+8 Bonus' },
    { id: 'ml-2', name: '172 Diamonds', price: 3.0, bonus: '+16 Bonus', popular: true },
    { id: 'ml-3', name: '257 Diamonds', price: 4.5, bonus: '+25 Bonus' },
    { id: 'ml-4', name: '706 Diamonds', price: 12.0, bonus: '+78 Bonus' },
    { id: 'ml-5', name: '2195 Diamonds', price: 35.0, bonus: '+360 Bonus' },
    { id: 'ml-6', name: 'Weekly Diamond Pass', price: 1.99, bonus: 'Best Value' },
  ],
  'PUBG Mobile': [
    { id: 'pubg-1', name: '60 UC', price: 0.99 },
    { id: 'pubg-2', name: '325 UC', price: 4.99, bonus: '+25 Extra', popular: true },
    { id: 'pubg-3', name: '660 UC', price: 9.99, bonus: '+60 Extra' },
    { id: 'pubg-4', name: '1800 UC', price: 24.99, bonus: '+300 Extra' },
  ],
  'Free Fire': [
    { id: 'ff-1', name: '100 Diamonds', price: 0.99 },
    { id: 'ff-2', name: '310 Diamonds', price: 2.99, bonus: '+31 Extra', popular: true },
    { id: 'ff-3', name: '520 Diamonds', price: 4.99, bonus: '+52 Extra' },
    { id: 'ff-4', name: '1060 Diamonds', price: 9.99, bonus: '+106 Extra' },
  ],
};

export default function Home() {
  const [selectedGame, setSelectedGame] = useState<Game>(GAMES[0]);
  const [playerId, setPlayerId] = useState('');
  const [selectedPackage, setSelectedPackage] = useState<Package>(
    PACKAGES['Mobile Legends'][1]
  );
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
    orderId?: number;
  } | null>(null);

  const handleGameChange = (game: Game) => {
    setSelectedGame(game);
    setSelectedPackage(PACKAGES[game.id][0]);
    setMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!playerId.trim()) {
      setMessage({ type: 'error', text: 'Please enter a valid Player ID to continue.' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch('/api/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: playerId.trim(),
          gameName: selectedGame.name,
          packageName: selectedPackage.name,
          price: selectedPackage.price,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setMessage({
          type: 'success',
          text: 'Order submitted successfully!',
          orderId: data.order?.id,
        });
        setPlayerId('');
      } else {
        setMessage({
          type: 'error',
          text: data.error || 'Failed to submit order. Please try again.',
        });
      }
    } catch {
      setMessage({
        type: 'error',
        text: 'Network error. Please check your connection and retry.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 selection:bg-blue-500 selection:text-white pb-16">
      {/* Background Decor */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 -right-40 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl"></div>
      </div>

      {/* Navigation Bar */}
      <nav className="sticky top-0 z-40 backdrop-blur-md bg-slate-950/80 border-b border-slate-800/80">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center font-bold text-white shadow-lg shadow-blue-500/20">
              ⚡
            </div>
            <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              TopUpKH
            </span>
          </div>
          <Link
            href="/orders"
            className="px-3.5 py-1.5 text-xs font-semibold text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-700/60 rounded-full transition-all duration-200 flex items-center space-x-1.5"
          >
            <span>Track Orders</span>
            <span className="text-blue-400">→</span>
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="max-w-4xl mx-auto px-4 pt-8 pb-6 text-center space-y-2">
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
          Fast & Instant Game Refills 🚀
        </span>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
          Direct Game Recharge Store
        </h1>
        <p className="text-sm text-slate-400 max-w-md mx-auto">
          Instant top-up for your favorite titles. Enter your Player ID, select a package, and get back in the game.
        </p>
      </div>

      {/* Main Form Container */}
      <div className="max-w-4xl mx-auto px-4">
        <form onSubmit={handleSubmit} className="space-y-8">
          
          {/* STEP 1: SELECT GAME */}
          <section className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-sm shadow-xl">
            <div className="flex items-center space-x-2 mb-4">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 text-xs font-bold border border-blue-500/30">
                1
              </span>
              <h2 className="text-base font-semibold text-slate-200">Select Game</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {GAMES.map((game) => {
                const isSelected = selectedGame.id === game.id;
                return (
                  <button
                    key={game.id}
                    type="button"
                    onClick={() => handleGameChange(game)}
                    className={`relative text-left p-4 rounded-xl border transition-all duration-200 flex flex-col justify-between ${
                      isSelected
                        ? 'bg-gradient-to-br ' + game.gradient + ' border-blue-500 shadow-lg ring-1 ring-blue-500/50'
                        : 'bg-slate-900/80 border-slate-800/80 hover:border-slate-700/80 hover:bg-slate-800/50'
                    }`}
                  >
                    {game.badge && (
                      <span className="absolute top-3 right-3 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                        {game.badge}
                      </span>
                    )}
                    <div>
                      <h3 className="font-bold text-sm text-white">{game.name}</h3>
                      <p className="text-xs text-slate-400 mt-0.5">{game.publisher}</p>
                    </div>
                    <div className="mt-4 flex items-center justify-between text-xs">
                      <span className={isSelected ? 'text-blue-400 font-semibold' : 'text-slate-500'}>
                        {isSelected ? 'Selected' : 'Tap to select'}
                      </span>
                      {isSelected && <span className="text-blue-400 font-bold">✓</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* STEP 2: PLAYER ID */}
          <section className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-sm shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 text-xs font-bold border border-blue-500/30">
                  2
                </span>
                <h2 className="text-base font-semibold text-slate-200">Account Details</h2>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-400">
                {selectedGame.name} Player ID
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="e.g. 123456789"
                  value={playerId}
                  onChange={(e) => setPlayerId(e.target.value)}
                  className="w-full bg-slate-950/80 border border-slate-700/80 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-mono transition"
                />
              </div>
              <p className="text-[11px] text-slate-500">
                You can find your Player ID in your in-game profile avatar screen.
              </p>
            </div>
          </section>

          {/* STEP 3: SELECT PACKAGE */}
          <section className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-sm shadow-xl">
            <div className="flex items-center space-x-2 mb-4">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 text-xs font-bold border border-blue-500/30">
                3
              </span>
              <h2 className="text-base font-semibold text-slate-200">Choose Item Package</h2>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {PACKAGES[selectedGame.id].map((pkg) => {
                const isSelected = selectedPackage.id === pkg.id;
                return (
                  <button
                    key={pkg.id}
                    type="button"
                    onClick={() => setSelectedPackage(pkg)}
                    className={`relative text-left p-4 rounded-xl border transition-all duration-200 flex flex-col justify-between ${
                      isSelected
                        ? 'bg-blue-600/10 border-blue-500 text-white shadow-lg ring-1 ring-blue-500/50'
                        : 'bg-slate-900/80 border-slate-800/80 hover:border-slate-700/80 text-slate-300 hover:bg-slate-800/50'
                    }`}
                  >
                    {pkg.popular && (
                      <span className="absolute -top-2.5 right-3 text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 shadow">
                        Best Seller
                      </span>
                    )}
                    <div>
                      <p className="font-semibold text-sm text-white">{pkg.name}</p>
                      {pkg.bonus && (
                        <span className="inline-block text-[10px] text-blue-400 font-medium mt-1 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">
                          {pkg.bonus}
                        </span>
                      )}
                    </div>
                    <div className="mt-4 pt-2 border-t border-slate-800/60 flex items-center justify-between">
                      <span className="text-xs font-bold text-blue-400">
                        ${pkg.price.toFixed(2)}
                      </span>
                      {isSelected && <span className="text-xs text-blue-400 font-bold">✓</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* CHECKOUT SUMMARY & SUBMIT */}
          <section className="bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Order Summary
            </h3>

            <div className="space-y-2 text-sm divide-y divide-slate-800/60">
              <div className="flex justify-between pt-1">
                <span className="text-slate-400">Selected Game</span>
                <span className="font-medium text-slate-200">{selectedGame.name}</span>
              </div>
              <div className="flex justify-between pt-2">
                <span className="text-slate-400">Package Item</span>
                <span className="font-medium text-slate-200">{selectedPackage.name}</span>
              </div>
              <div className="flex justify-between pt-2">
                <span className="text-slate-400">Target Player ID</span>
                <span className="font-mono font-medium text-blue-400">
                  {playerId ? playerId : 'Not Entered Yet'}
                </span>
              </div>
              <div className="flex justify-between pt-3 text-base">
                <span className="font-bold text-white">Total Amount</span>
                <span className="font-extrabold text-blue-400 text-lg">
                  ${selectedPackage.price.toFixed(2)}
                </span>
              </div>
            </div>

            {/* STATUS MESSAGE */}
            {message && (
              <div
                className={`p-4 rounded-xl text-sm border flex flex-col space-y-1 ${
                  message.type === 'success'
                    ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                    : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
                }`}
              >
                <div className="font-bold flex items-center space-x-2">
                  <span>{message.type === 'success' ? '🎉 Success' : '⚠️ Error'}</span>
                </div>
                <p className="text-xs text-slate-300">{message.text}</p>
                {message.orderId && (
                  <div className="pt-2 flex items-center justify-between border-t border-emerald-800/40 mt-1">
                    <span className="text-xs font-mono text-emerald-400">
                      Order ID: #{message.orderId}
                    </span>
                    <Link
                      href="/orders"
                      className="text-xs font-semibold underline text-emerald-300 hover:text-white"
                    >
                      View in Orders →
                    </Link>
                  </div>
                )}
              </div>
            )}

            {/* SUBMIT BUTTON */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:from-slate-800 disabled:to-slate-800 text-white font-bold rounded-xl shadow-lg shadow-blue-600/25 transition-all duration-200 flex items-center justify-center space-x-2 text-sm"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Processing Top-Up...</span>
                </>
              ) : (
                <span>Complete Recharge (${selectedPackage.price.toFixed(2)})</span>
              )}
            </button>
          </section>

        </form>
      </div>
    </main>
  );
}