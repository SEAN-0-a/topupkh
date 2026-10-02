'use client';

import { useState } from 'react';

const GAMES = [
  { id: 'Mobile Legends', name: 'Mobile Legends: Bang Bang' },
  { id: 'PUBG Mobile', name: 'PUBG Mobile' },
  { id: 'Free Fire', name: 'Free Fire' },
];

const PACKAGES: Record<string, { name: string; price: number }[]> = {
  'Mobile Legends': [
    { name: '86 Diamonds', price: 1.5 },
    { name: '172 Diamonds', price: 3.0 },
    { name: '257 Diamonds', price: 4.5 },
    { name: '706 Diamonds', price: 12.0 },
  ],
  'PUBG Mobile': [
    { name: '60 UC', price: 0.99 },
    { name: '325 UC', price: 4.99 },
    { name: '660 UC', price: 9.99 },
  ],
  'Free Fire': [
    { name: '100 Diamonds', price: 0.99 },
    { name: '310 Diamonds', price: 2.99 },
    { name: '520 Diamonds', price: 4.99 },
  ],
};

export default function Home() {
  const [selectedGame, setSelectedGame] = useState('Mobile Legends');
  const [playerId, setPlayerId] = useState('');
  const [selectedPackage, setSelectedPackage] = useState(PACKAGES['Mobile Legends'][0]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleGameChange = (game: string) => {
    setSelectedGame(game);
    setSelectedPackage(PACKAGES[game][0]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerId) {
      setMessage({ type: 'error', text: 'Please enter your Player ID.' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch('/api/order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          playerId: playerId,
          gameName: selectedGame,
          packageName: selectedPackage.name,
          price: selectedPackage.price,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setMessage({
          type: 'success',
          text: `Order submitted successfully! Order ID: #${data.order.id}`,
        });
        setPlayerId('');
      } else {
        setMessage({
          type: 'error',
          text: data.error || 'Failed to create order. Please try again.',
        });
      }
    } catch (err) {
      setMessage({
        type: 'error',
        text: 'Network error. Please check your connection.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight text-blue-500">TopUpKH Game Store</h1>
          <p className="text-slate-400 text-sm mt-1">Select your game and top up instantly</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* 1. Select Game */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">1. Select Game</label>
            <div className="grid grid-cols-3 gap-2">
              {GAMES.map((game) => (
                <button
                  key={game.id}
                  type="button"
                  onClick={() => handleGameChange(game.id)}
                  className={`py-2 px-3 text-xs font-semibold rounded-lg border transition ${
                    selectedGame === game.id
                      ? 'bg-blue-600 border-blue-500 text-white'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
                  }`}
                >
                  {game.name}
                </button>
              ))}
            </div>
          </div>

          {/* 2. Player ID */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">2. Enter Player ID</label>
            <input
              type="text"
              placeholder="e.g. 123456789"
              value={playerId}
              onChange={(e) => setPlayerId(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500 text-sm"
            />
          </div>

          {/* 3. Select Package */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">3. Select Package</label>
            <div className="grid grid-cols-2 gap-3">
              {PACKAGES[selectedGame].map((pkg) => (
                <button
                  key={pkg.name}
                  type="button"
                  onClick={() => setSelectedPackage(pkg)}
                  className={`p-3 text-left rounded-lg border transition flex flex-col justify-between ${
                    selectedPackage.name === pkg.name
                      ? 'bg-blue-950/50 border-blue-500 text-white'
                      : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600'
                  }`}
                >
                  <span className="text-sm font-medium">{pkg.name}</span>
                  <span className="text-xs text-blue-400 font-bold mt-1">${pkg.price.toFixed(2)}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Status Message */}
          {message && (
            <div
              className={`p-3 rounded-lg text-sm ${
                message.type === 'success'
                  ? 'bg-emerald-950/60 border border-emerald-800 text-emerald-300'
                  : 'bg-rose-950/60 border border-rose-800 text-rose-300'
              }`}
            >
              {message.text}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-semibold rounded-lg shadow-lg transition flex items-center justify-center text-sm"
          >
            {loading ? 'Processing...' : `Buy Now ($${selectedPackage.price.toFixed(2)})`}
          </button>
        </form>
      </div>
    </main>
  );
}