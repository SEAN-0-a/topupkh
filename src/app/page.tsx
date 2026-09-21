'use client';
import React, { useState, useEffect } from 'react';
import { 
  Search, ShoppingCart, ShieldCheck, Zap, CreditCard, User, CheckCircle, 
  HelpCircle, ChevronRight, Copy, X, Sparkles, Flame, Check, MessageSquare, 
  RefreshCw, AlertCircle, Phone, Globe, Star, ArrowRight, Menu, LogOut, Lock, Send
} from 'lucide-react';

const GAMES_CATALOG = [
  {
    id: 'mlbb',
    name: 'Mobile Legends',
    subtitle: 'Bang Bang',
    type: 'Mobile Games',
    currency: 'Diamonds',
    popular: true,
    badge: 'HOT DEAL',
    rating: '4.9',
    icon: '🎮',
    bgGradient: 'from-blue-600/30 via-indigo-900/40 to-slate-900',
    idFields: [{ label: 'User ID', placeholder: 'e.g. 12345678', required: true }, { label: 'Zone ID', placeholder: 'e.g. 1234', required: true }],
    packages: [
      { id: 'ml-1', name: '86 Diamonds', price: 1.00, bonus: '+8 Bonus', tag: '' },
      { id: 'ml-2', name: '172 Diamonds', price: 2.00, bonus: '+16 Bonus', tag: '' },
      { id: 'ml-3', name: '257 Diamonds', price: 3.00, bonus: '+25 Bonus', tag: 'POPULAR' },
      { id: 'ml-4', name: '706 Diamonds', price: 8.00, bonus: '+98 Bonus', tag: 'BEST VALUE' },
      { id: 'ml-5', name: '2195 Diamonds', price: 24.50, bonus: '+360 Bonus', tag: 'VIP' },
      { id: 'ml-6', name: 'Twilight Pass', price: 9.99, bonus: 'Exclusive Skin', tag: 'SPECIAL' }
    ]
  },
  {
    id: 'pubg',
    name: 'PUBG Mobile',
    subtitle: 'Global / SEA',
    type: 'Mobile Games',
    currency: 'Unknown Cash (UC)',
    popular: true,
    badge: 'INSTANT',
    rating: '4.8',
    icon: '🔫',
    bgGradient: 'from-amber-600/30 via-orange-900/40 to-slate-900',
    idFields: [{ label: 'Player ID', placeholder: 'e.g. 5123456789', required: true }],
    packages: [
      { id: 'pubg-1', name: '60 UC', price: 0.99, bonus: '', tag: '' },
      { id: 'pubg-2', name: '325 UC', price: 4.99, bonus: '+25 Bonus', tag: 'POPULAR' },
      { id: 'pubg-3', name: '660 UC', price: 9.99, bonus: '+60 Bonus', tag: '' },
      { id: 'pubg-4', name: '1800 UC', price: 24.99, bonus: '+300 Bonus', tag: 'BEST VALUE' },
      { id: 'pubg-5', name: '3850 UC', price: 49.99, bonus: '+850 Bonus', tag: 'VIP' }
    ]
  },
  {
    id: 'freefire',
    name: 'Free Fire',
    subtitle: 'Garena',
    type: 'Mobile Games',
    currency: 'Diamonds',
    popular: true,
    badge: 'FAST',
    rating: '4.8',
    icon: '🔥',
    bgGradient: 'from-red-600/30 via-rose-900/40 to-slate-900',
    idFields: [{ label: 'Player UID', placeholder: 'e.g. 987654321', required: true }],
    packages: [
      { id: 'ff-1', name: '100 Diamonds', price: 0.95, bonus: '+10 Bonus', tag: '' },
      { id: 'ff-2', name: '310 Diamonds', price: 2.85, bonus: '+31 Bonus', tag: 'POPULAR' },
      { id: 'ff-3', name: '520 Diamonds', price: 4.75, bonus: '+52 Bonus', tag: '' },
      { id: 'ff-4', name: '1060 Diamonds', price: 9.50, bonus: '+106 Bonus', tag: 'BEST VALUE' },
      { id: 'ff-5', name: 'Weekly Membership', price: 1.99, bonus: '420 Diamonds Total', tag: 'RECOMMENDED' }
    ]
  },
  {
    id: 'hok',
    name: 'Honor of Kings',
    subtitle: 'Global Level Infinite',
    type: 'Mobile Games',
    currency: 'Tokens',
    popular: true,
    badge: 'NEW',
    rating: '4.9',
    icon: '⚔️',
    bgGradient: 'from-yellow-600/30 via-amber-900/40 to-slate-900',
    idFields: [{ label: 'Player UID', placeholder: 'e.g. 1029384756', required: true }],
    packages: [
      { id: 'hok-1', name: '80 Tokens', price: 0.99, bonus: '+8 Bonus', tag: '' },
      { id: 'hok-2', name: '240 Tokens', price: 2.99, bonus: '+24 Bonus', tag: 'POPULAR' },
      { id: 'hok-3', name: '400 Tokens', price: 4.99, bonus: '+40 Bonus', tag: '' },
      { id: 'hok-4', name: '800 Tokens', price: 9.99, bonus: '+80 Bonus', tag: 'BEST VALUE' },
      { id: 'hok-5', name: '2400 Tokens', price: 29.99, bonus: '+240 Bonus', tag: 'VIP' }
    ]
  },
  {
    id: 'genshin',
    name: 'Genshin Impact',
    subtitle: 'HoYoverse',
    type: 'PC & Console',
    currency: 'Genesis Crystals',
    popular: false,
    badge: 'OFFICIAL',
    rating: '5.0',
    icon: '✨',
    bgGradient: 'from-cyan-600/30 via-sky-900/40 to-slate-900',
    idFields: [{ label: 'UID', placeholder: 'e.g. 800123456', required: true }, { label: 'Server', placeholder: 'Asia / America / Europe', required: true }],
    packages: [
      { id: 'gi-1', name: '60 Genesis Crystals', price: 0.99, bonus: '', tag: '' },
      { id: 'gi-2', name: '300 Genesis Crystals', price: 4.99, bonus: '+30 Bonus', tag: '' },
      { id: 'gi-3', name: '980 Genesis Crystals', price: 14.99, bonus: '+110 Bonus', tag: 'POPULAR' },
      { id: 'gi-4', name: 'Blessing of the Welkin Moon', price: 4.99, bonus: '300 Crystals + 2700 Primogems', tag: 'BEST VALUE' },
      { id: 'gi-5', name: '1980 Genesis Crystals', price: 29.99, bonus: '+260 Bonus', tag: '' }
    ]
  },
  {
    id: 'roblox',
    name: 'Roblox',
    subtitle: 'Digital Code / Topup',
    type: 'PC & Console',
    currency: 'Robux',
    popular: false,
    badge: 'HOT',
    rating: '4.7',
    icon: '🟥',
    bgGradient: 'from-emerald-600/30 via-teal-900/40 to-slate-900',
    idFields: [{ label: 'Roblox Username', placeholder: 'e.g. GamerKH_99', required: true }],
    packages: [
      { id: 'rbx-1', name: '400 Robux', price: 4.99, bonus: '', tag: '' },
      { id: 'rbx-2', name: '800 Robux', price: 9.99, bonus: '', tag: 'POPULAR' },
      { id: 'rbx-3', name: '1700 Robux', price: 19.99, bonus: '+100 Bonus', tag: 'BEST VALUE' },
      { id: 'rbx-4', name: '4500 Robux', price: 49.99, bonus: '+500 Bonus', tag: 'VIP' }
    ]
  },
  {
    id: 'steam',
    name: 'Steam Wallet',
    subtitle: 'US Dollar USD',
    type: 'Gift Cards',
    currency: 'USD Gift Code',
    popular: false,
    badge: 'AUTO CODE',
    rating: '4.9',
    icon: '🎮',
    bgGradient: 'from-slate-700/50 via-slate-900 to-slate-950',
    idFields: [{ label: 'Email for Delivery', placeholder: 'e.g. player@gmail.com', required: true }],
    packages: [
      { id: 'stm-1', name: '$5 Steam Wallet Code', price: 5.25, bonus: 'Instant Email', tag: '' },
      { id: 'stm-2', name: '$10 Steam Wallet Code', price: 10.45, bonus: 'Instant Email', tag: 'POPULAR' },
      { id: 'stm-3', name: '$20 Steam Wallet Code', price: 20.80, bonus: 'Instant Email', tag: 'BEST VALUE' },
      { id: 'stm-4', name: '$50 Steam Wallet Code', price: 51.50, bonus: 'Instant Email', tag: '' }
    ]
  },
  {
    id: 'gplay',
    name: 'Google Play',
    subtitle: 'US Region Digital Code',
    type: 'Gift Cards',
    currency: 'USD Gift Card',
    popular: false,
    badge: 'INSTANT',
    rating: '4.8',
    icon: '🟢',
    bgGradient: 'from-emerald-700/30 via-slate-900 to-slate-950',
    idFields: [{ label: 'Email Address', placeholder: 'e.g. user@gmail.com', required: true }],
    packages: [
      { id: 'gp-1', name: '$5 Google Play Card', price: 5.20, bonus: 'Instant Redeem', tag: '' },
      { id: 'gp-2', name: '$10 Google Play Card', price: 10.35, bonus: 'Instant Redeem', tag: 'POPULAR' },
      { id: 'gp-3', name: '$25 Google Play Card', price: 25.75, bonus: 'Instant Redeem', tag: 'BEST VALUE' }
    ]
  },
  {
    id: 'apple',
    name: 'Apple App Store',
    subtitle: 'US Region Gift Card',
    type: 'Gift Cards',
    currency: 'USD Gift Card',
    popular: false,
    badge: 'INSTANT',
    rating: '4.9',
    icon: '🍎',
    bgGradient: 'from-purple-700/30 via-slate-900 to-slate-950',
    idFields: [{ label: 'Email Address', placeholder: 'e.g. appleuser@gmail.com', required: true }],
    packages: [
      { id: 'ap-1', name: '$5 Apple Gift Card', price: 5.25, bonus: '', tag: '' },
      { id: 'ap-2', name: '$10 Apple Gift Card', price: 10.50, bonus: 'Popular', tag: 'POPULAR' },
      { id: 'ap-3', name: '$25 Apple Gift Card', price: 25.90, bonus: 'Best Value', tag: 'BEST VALUE' }
    ]
  }
];

const PAYMENT_METHODS = [
  { id: 'aba', name: 'ABA Pay / KHQR', sub: 'Instant KHQR Scan', fee: '$0.00', icon: '🏦', color: 'bg-cyan-950 border-cyan-500/50 text-cyan-400' },
  { id: 'bakong', name: 'Bakong KHQR', sub: 'National QR Code', fee: '$0.00', icon: '🇰🇭', color: 'bg-red-950 border-red-500/50 text-red-400' },
  { id: 'wing', name: 'Wing Bank', sub: 'Instant Wallet & QR', fee: '$0.00', icon: '💸', color: 'bg-lime-950 border-lime-500/50 text-lime-400' },
  { id: 'acleda', name: 'ACLEDA ToanChet', sub: 'Direct Bank Pay', fee: '$0.00', icon: '🦁', color: 'bg-amber-950 border-amber-500/50 text-amber-400' }
];

const RECENT_PURCHASES = [
  { name: 'Sokha M.', game: 'Mobile Legends', pkg: '257 Diamonds', time: '2 mins ago' },
  { name: 'Vannak K.', game: 'PUBG Mobile', pkg: '660 UC', time: '5 mins ago' },
  { name: 'Dara P.', game: 'Free Fire', pkg: '1060 Diamonds', time: '8 mins ago' },
  { name: 'Bopha T.', game: 'Steam Wallet', pkg: '$10 Code', time: '12 mins ago' }
];

const TESTIMONIALS = [
  { name: 'Chan Seyha', location: 'Phnom Penh', text: 'Scanned ABA KHQR and received my MLBB Diamonds in 15 seconds. TopUpKH is the fastest in Cambodia!', rating: 5, avatar: '👤' },
  { name: 'Khmey Sreypov', location: 'Siem Reap', text: 'Super easy to buy UC for PUBG. Saved money with the TOPUPKH10 promo code too.', rating: 5, avatar: '👩' },
  { name: 'Rithy Panha', location: 'Battambang', text: 'Best website for Steam cards in Cambodia. Very reliable and Khmer support is very helpful.', rating: 5, avatar: '👨' }
];

export default function App() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedGame, setSelectedGame] = useState(null);
  
  // Checkout Modal State
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [idValues, setIdValues] = useState({});
  const [selectedPkg, setSelectedPkg] = useState(null);
  const [selectedPayment, setSelectedPayment] = useState('aba');
  const [promoCode, setPromoCode] = useState('');
  const [discountPercent, setDiscountPercent] = useState(0);
  const [promoError, setPromoError] = useState('');
  const [promoSuccess, setPromoSuccess] = useState('');

  // KHQR Payment Verification Modal
  const [isPaying, setIsPaying] = useState(false);
  const [paymentTimer, setPaymentTimer] = useState(120);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  // User Auth State
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authPhone, setAuthPhone] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userProfile, setUserProfile] = useState({ name: 'Dara Gamer', phone: '+855 12 888 999', balance: '15.00' });

  // Notifications / Toast
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Open Checkout for a Game
  const handleOpenGame = (game) => {
    setSelectedGame(game);
    setSelectedPkg(game.packages[0]);
    setIdValues({});
    setPromoCode('');
    setDiscountPercent(0);
    setPromoError('');
    setPromoSuccess('');
    setIsCheckoutOpen(true);
  };

  // Apply Coupon Logic
  const handleApplyPromo = () => {
    if (promoCode.trim().toUpperCase() === 'TOPUPKH10' || promoCode.trim().toUpperCase() === 'WELCOMEKH') {
      setDiscountPercent(10);
      setPromoSuccess('10% Discount Applied!');
      setPromoError('');
      showToast('🎉 Promo Code Applied! (10% OFF)');
    } else {
      setPromoError('Invalid code. Try "TOPUPKH10"');
      setPromoSuccess('');
    }
  };

  useEffect(() => {
    let interval = null;
    if (isPaying && paymentTimer > 0 && !paymentSuccess) {
      interval = setInterval(() => {
        setPaymentTimer((prev) => prev - 1);
      }, 1000);
    } else if (paymentTimer === 0) {
      setIsPaying(false);
      showToast('❌ Payment Session Expired. Please try again.');
    }
    return () => clearInterval(interval);
  }, [isPaying, paymentTimer, paymentSuccess]);

  const handleStartPayment = () => {
    let missing = false;
    selectedGame?.idFields.forEach((field) => {
      if (!idValues[field.label] || idValues[field.label].trim() === '') {
        missing = true;
      }
    });

    if (missing) {
      showToast('⚠️ Please fill in all account ID details!');
      return;
    }

    setIsPaying(true);
    setPaymentTimer(120);
    setPaymentSuccess(false);

    // Auto verify mock payment trigger after 5s
    setTimeout(() => {
      setPaymentSuccess(true);
      setTimeout(() => {
        setIsPaying(false);
        setIsCheckoutOpen(false);
        showToast(`✅ Payment Confirmed! ${selectedPkg?.name} added to your account.`);
      }, 2000);
    }, 5000);
  };

  // Price Calculations
  const basePrice = selectedPkg ? selectedPkg.price : 0;
  const discountAmount = (basePrice * discountPercent) / 100;
  const finalPriceUSD = Math.max(0, basePrice - discountAmount).toFixed(2);
  const finalPriceKHR = (parseFloat(finalPriceUSD) * 4100).toLocaleString();

  // Filter Catalog Items
  const filteredCatalog = GAMES_CATALOG.filter((game) => {
    const matchesCategory =
      selectedCategory === 'All' ||
      (selectedCategory === 'Popular' && game.popular) ||
      game.type === selectedCategory;
    const matchesSearch = game.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          game.subtitle.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-emerald-500 selection:text-black">
      
      {/* Floating Notification Toast */}
      {toastMessage && (
        <div className="fixed top-20 right-4 z-50 flex items-center gap-3 bg-emerald-500 text-slate-950 font-bold px-5 py-3 rounded-xl shadow-2xl shadow-emerald-500/30 border border-emerald-300 animate-bounce">
          <Sparkles className="w-5 h-5 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {}
      <nav className="sticky top-0 z-40 bg-slate-950/85 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
          
          {/* Logo */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => { setSelectedCategory('All'); setSearchQuery(''); }}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center font-black text-slate-950 text-xl shadow-lg shadow-emerald-500/20">
              KH
            </div>
            <div>
              <span className="text-2xl font-black tracking-tight text-white">TopUp<span className="text-emerald-400">KH</span></span>
              <span className="hidden sm:inline-block text-[10px] bg-emerald-500/10 text-emerald-400 font-semibold px-2 py-0.5 rounded-full border border-emerald-500/20 ml-2">CAMBODIA #1</span>
            </div>
          </div>

          {/* Search Input Central */}
          <div className="hidden md:flex flex-1 max-w-md relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search Mobile Legends, PUBG UC, Steam, Gift Cards..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-full pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition text-slate-200 placeholder-slate-500"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Nav Actions */}
          <div className="flex items-center gap-4">
            <a href="#games" className="hidden lg:block text-sm font-medium text-slate-300 hover:text-emerald-400 transition">
              Games
            </a>
            <a href="#giftcards" onClick={() => setSelectedCategory('Gift Cards')} className="hidden lg:block text-sm font-medium text-slate-300 hover:text-emerald-400 transition">
              Gift Cards
            </a>
            <a href="#how-it-works" className="hidden lg:block text-sm font-medium text-slate-300 hover:text-emerald-400 transition">
              How It Works
            </a>

            {/* Auth Trigger Button */}
            {isLoggedIn ? (
              <button 
                onClick={() => setIsAuthOpen(true)}
                className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 border border-emerald-500/30 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold text-emerald-400 transition"
              >
                <User className="w-4 h-4" />
                <span className="hidden sm:inline">{userProfile.name}</span>
                <span className="bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded text-[11px]">${userProfile.balance}</span>
              </button>
            ) : (
              <button
                onClick={() => setIsAuthOpen(true)}
                className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs sm:text-sm shadow-lg shadow-emerald-500/20 transition active:scale-95"
              >
                <User className="w-4 h-4" />
                <span>Login</span>
              </button>
            )}
          </div>

        </div>
      </nav>

      {}
      <section className="relative overflow-hidden pt-12 pb-16 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 border-b border-slate-800/60">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-10 right-10 w-72 h-72 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          
          <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider mb-6">
            <Sparkles className="w-3.5 h-3.5 animate-pulse" />
            <span>Cambodia's #1 Gaming Top-Up Platform 🇰🇭</span>
          </div>

          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight text-white mb-6 leading-tight">
            Instant Top-Up With <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-300">Bakong & ABA KHQR</span>
          </h1>

          <p className="max-w-2xl mx-auto text-base sm:text-xl text-slate-400 font-normal mb-8 leading-relaxed">
            Fast, secure, and automated game recharge for Mobile Legends, PUBG UC, Free Fire & Gift Cards. Instant delivery directly to your account.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-14">
            <a
              href="#games"
              className="w-full sm:w-auto bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-8 py-3.5 rounded-xl shadow-xl shadow-emerald-500/20 transition transform hover:-translate-y-0.5 text-center flex items-center justify-center gap-2"
            >
              <Zap className="w-5 h-5 fill-slate-950" />
              <span>Start Top Up Now</span>
            </a>
            <a
              href="#how-it-works"
              className="w-full sm:w-auto bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 px-8 py-3.5 rounded-xl font-semibold transition text-center"
            >
              How It Works
            </a>
          </div>

          {/* Live Trust Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto bg-slate-900/60 backdrop-blur-md p-4 rounded-2xl border border-slate-800/80">
            <div className="p-3 text-center border-r border-slate-800/50 last:border-0">
              <p className="text-2xl font-black text-emerald-400">100K+</p>
              <p className="text-xs text-slate-400 font-medium mt-0.5">Orders Completed</p>
            </div>
            <div className="p-3 text-center border-r border-slate-800/50 last:border-0">
              <p className="text-2xl font-black text-emerald-400">&lt; 30s</p>
              <p className="text-xs text-slate-400 font-medium mt-0.5">Instant Delivery</p>
            </div>
            <div className="p-3 text-center border-r border-slate-800/50 last:border-0">
              <p className="text-2xl font-black text-white">0% Fee</p>
              <p className="text-xs text-slate-400 font-medium mt-0.5">Bakong & ABA Pay</p>
            </div>
            <div className="p-3 text-center">
              <p className="text-2xl font-black text-emerald-400">24/7</p>
              <p className="text-xs text-slate-400 font-medium mt-0.5">Khmer Customer Service</p>
            </div>
          </div>

        </div>
      </section>

      {}
      <div className="bg-slate-900/40 border-b border-slate-800/60 py-2.5 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5 text-emerald-400 font-bold shrink-0 uppercase tracking-wider">
            <Flame className="w-4 h-4 fill-emerald-400" />
            <span>Recent Orders:</span>
          </div>
          <div className="flex items-center gap-6 overflow-x-auto no-scrollbar whitespace-nowrap text-slate-400">
            {RECENT_PURCHASES.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2 bg-slate-950/60 border border-slate-800 px-3 py-1 rounded-full">
                <span className="font-semibold text-slate-200">{item.name}</span>
                <span>bought</span>
                <span className="text-emerald-400 font-medium">{item.pkg} ({item.game})</span>
                <span className="text-slate-500 text-[10px]">• {item.time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {}
      <main id="games" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        
        {/* Mobile Search */}
        <div className="md:hidden mb-6">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search games or gift cards..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-200"
            />
          </div>
        </div>

        {/* Category Filters */}
        <div className="flex items-center justify-between flex-wrap gap-4 mb-8">
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight">Popular Top-Up Catalog</h2>
            <p className="text-slate-400 text-sm mt-0.5">Select a game or voucher to reload instantly</p>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 no-scrollbar">
            {['All', 'Popular', 'Mobile Games', 'PC & Console', 'Gift Cards'].map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition whitespace-nowrap ${
                  selectedCategory === cat
                    ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Grid Display */}
        {filteredCatalog.length === 0 ? (
          <div className="text-center py-16 bg-slate-900/30 rounded-2xl border border-slate-800">
            <AlertCircle className="w-12 h-12 text-slate-500 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-white">No games or cards found</h3>
            <p className="text-slate-400 text-sm mt-1">Try resetting your search filter.</p>
            <button
              onClick={() => { setSearchQuery(''); setSelectedCategory('All'); }}
              className="mt-4 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-4 py-2 rounded-xl text-xs font-semibold"
            >
              Show All Items
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCatalog.map((game) => (
              <div
                key={game.id}
                onClick={() => handleOpenGame(game)}
                className="group relative bg-slate-900/80 border border-slate-800 hover:border-emerald-500/60 rounded-2xl p-5 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl hover:shadow-emerald-500/10 cursor-pointer overflow-hidden flex flex-col justify-between"
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${game.bgGradient} opacity-20 group-hover:opacity-40 transition pointer-events-none`} />

                <div>
                  <div className="flex items-center justify-between mb-4 relative z-10">
                    <span className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full">
                      {game.badge}
                    </span>
                    <div className="flex items-center gap-1 text-amber-400 text-xs font-bold bg-slate-950/60 px-2 py-0.5 rounded-md border border-slate-800">
                      <Star className="w-3.5 h-3.5 fill-amber-400" />
                      <span>{game.rating}</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-4 mb-4 relative z-10">
                    <div className="w-14 h-14 rounded-2xl bg-slate-800/80 border border-slate-700/80 flex items-center justify-center text-3xl shrink-0 group-hover:scale-110 transition">
                      {game.icon}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white group-hover:text-emerald-400 transition">{game.name}</h3>
                      <p className="text-xs text-slate-400 mt-0.5">{game.subtitle}</p>
                      <span className="inline-block text-[11px] font-medium text-emerald-400/90 mt-1">
                        Offers: {game.currency}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between relative z-10">
                  <span className="text-xs text-slate-400">
                    From <span className="text-emerald-400 font-bold text-sm">${game.packages[0].price.toFixed(2)}</span>
                  </span>
                  <div className="flex items-center gap-1 text-xs font-bold text-slate-950 bg-emerald-500 group-hover:bg-emerald-400 px-3.5 py-1.5 rounded-xl transition shadow-md shadow-emerald-500/20">
                    <span>Top Up</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </div>
                </div>

              </div>
            ))}
          </div>
        )}

      </main>

      {}
      <section id="how-it-works" className="bg-slate-900/50 border-y border-slate-800/80 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-3xl font-black text-white tracking-tight">3-Step Simple Top-Up Guide</h2>
            <p className="text-slate-400 text-sm mt-2">Get your game items instantly without waiting</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-slate-950 border border-slate-800 p-6 rounded-2xl text-center">
              <div className="w-12 h-12 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-2xl flex items-center justify-center font-black text-lg mx-auto mb-4">
                1
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Select Game & Enter ID</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Choose Mobile Legends, PUBG, or Gift Cards, then enter your User ID or Zone ID.
              </p>
            </div>

            <div className="bg-slate-950 border border-slate-800 p-6 rounded-2xl text-center">
              <div className="w-12 h-12 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-2xl flex items-center justify-center font-black text-lg mx-auto mb-4">
                2
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Select Package & KHQR</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Choose the amount of Diamonds/UC you need and pick ABA Pay or Bakong KHQR.
              </p>
            </div>

            <div className="bg-slate-950 border border-slate-800 p-6 rounded-2xl text-center">
              <div className="w-12 h-12 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-2xl flex items-center justify-center font-black text-lg mx-auto mb-4">
                3
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Scan & Instant Delivery</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Scan the generated KHQR with your mobile banking app. Your game items arrive automatically!
              </p>
            </div>
          </div>
        </div>
      </section>

      {}
      <section className="py-12 border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-6">Cambodian Local Bank Payment Partners</p>
          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-8">
            {PAYMENT_METHODS.map((pm) => (
              <div key={pm.id} className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-5 py-2.5 rounded-xl text-slate-300 font-bold text-sm">
                <span>{pm.icon}</span>
                <span>{pm.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {}
      <section className="py-16 bg-slate-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-xl mx-auto mb-10">
            <h2 className="text-2xl sm:text-3xl font-black text-white">What Cambodian Gamers Say</h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">Trusted by over 100,000 players across Phnom Penh and provinces</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t, idx) => (
              <div key={idx} className="bg-slate-900/60 border border-slate-800 p-6 rounded-2xl relative">
                <div className="flex items-center gap-1 text-amber-400 mb-3">
                  {Array.from({ length: t.rating }).map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-amber-400" />
                  ))}
                </div>
                <p className="text-xs text-slate-300 leading-relaxed mb-4 italic">"{t.text}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-sm">
                    {t.avatar}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">{t.name}</h4>
                    <p className="text-[10px] text-emerald-400">{t.location}, Cambodia</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {}
      {isCheckoutOpen && selectedGame && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 sm:p-8 relative shadow-2xl my-8">
            
            <button
              onClick={() => setIsCheckoutOpen(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Modal Game Header */}
            <div className="flex items-center gap-4 mb-6 pb-6 border-b border-slate-800">
              <div className="w-14 h-14 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-3xl shrink-0">
                {selectedGame.icon}
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">{selectedGame.name}</h3>
                <p className="text-xs text-slate-400">{selectedGame.subtitle} • Instant Delivery</p>
              </div>
            </div>

            {/* Step 1: ID Input */}
            <div className="mb-6">
              <label className="block text-xs font-bold text-emerald-400 uppercase tracking-wider mb-2">
                Step 1: Enter Account Details
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {selectedGame.idFields.map((field, idx) => (
                  <div key={idx}>
                    <label className="block text-xs text-slate-400 mb-1">{field.label}</label>
                    <input
                      type="text"
                      placeholder={field.placeholder}
                      value={idValues[field.label] || ''}
                      onChange={(e) => setIdValues({ ...idValues, [field.label]: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none"
                    />
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-slate-500 mt-1.5 flex items-center gap-1">
                <HelpCircle className="w-3.5 h-3.5" />
                <span>To find your Player ID, open in-game profile settings.</span>
              </p>
            </div>

            {/* Step 2: Select Package */}
            <div className="mb-6">
              <label className="block text-xs font-bold text-emerald-400 uppercase tracking-wider mb-2">
                Step 2: Choose Recharge Package
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {selectedGame.packages.map((pkg) => (
                  <button
                    key={pkg.id}
                    onClick={() => setSelectedPkg(pkg)}
                    className={`p-3 rounded-xl border text-left transition relative flex flex-col justify-between ${
                      selectedPkg?.id === pkg.id
                        ? 'bg-emerald-500/10 border-emerald-500 text-white shadow-lg shadow-emerald-500/10'
                        : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    {pkg.tag && (
                      <span className="absolute -top-2 right-2 bg-emerald-500 text-slate-950 text-[9px] font-black px-1.5 py-0.5 rounded">
                        {pkg.tag}
                      </span>
                    )}
                    <div>
                      <p className="text-sm font-bold text-white">{pkg.name}</p>
                      {pkg.bonus && <p className="text-[10px] text-emerald-400 font-medium">{pkg.bonus}</p>}
                    </div>
                    <div className="mt-2">
                      <p className="text-sm font-extrabold text-slate-200">${pkg.price.toFixed(2)}</p>
                      <p className="text-[10px] text-slate-500">≈ {(pkg.price * 4100).toLocaleString()} KHR</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Step 3: Payment Method */}
            <div className="mb-6">
              <label className="block text-xs font-bold text-emerald-400 uppercase tracking-wider mb-2">
                Step 3: Select Cambodian Payment Method
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {PAYMENT_METHODS.map((pm) => (
                  <button
                    key={pm.id}
                    onClick={() => setSelectedPayment(pm.id)}
                    className={`p-3 rounded-xl border flex flex-col items-center justify-center text-center transition ${
                      selectedPayment === pm.id
                        ? 'bg-slate-800 border-emerald-500 ring-1 ring-emerald-500'
                        : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <span className="text-2xl mb-1">{pm.icon}</span>
                    <span className="text-xs font-bold text-white">{pm.name}</span>
                    <span className="text-[10px] text-slate-400">{pm.sub}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Step 4: Promo Code & Price Calculation */}
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 mb-6">
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  placeholder="Promo Code (Try: TOPUPKH10)"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value)}
                  className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white flex-1 focus:outline-none uppercase"
                />
                <button
                  onClick={handleApplyPromo}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold px-4 py-2 rounded-xl transition"
                >
                  Apply
                </button>
              </div>

              {promoSuccess && <p className="text-xs text-emerald-400 font-medium mb-2">{promoSuccess}</p>}
              {promoError && <p className="text-xs text-red-400 font-medium mb-2">{promoError}</p>}

              <div className="space-y-1.5 text-xs border-t border-slate-800 pt-3">
                <div className="flex justify-between text-slate-400">
                  <span>Subtotal:</span>
                  <span>${basePrice.toFixed(2)}</span>
                </div>
                {discountPercent > 0 && (
                  <div className="flex justify-between text-emerald-400">
                    <span>Voucher Discount ({discountPercent}%):</span>
                    <span>-${discountAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-400">
                  <span>Transfer Fee:</span>
                  <span className="text-emerald-400 font-bold">FREE ($0.00)</span>
                </div>
                <div className="flex justify-between text-base font-black text-white pt-2 border-t border-slate-800">
                  <span>Total Amount:</span>
                  <div className="text-right">
                    <span className="text-emerald-400">${finalPriceUSD} USD</span>
                    <span className="block text-xs font-normal text-slate-400">≈ {finalPriceKHR} KHR</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Pay Button */}
            <button
              onClick={handleStartPayment}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black py-3.5 rounded-xl shadow-xl shadow-emerald-500/20 text-base transition flex items-center justify-center gap-2"
            >
              <Zap className="w-5 h-5 fill-slate-950" />
              <span>Pay ${finalPriceUSD} with KHQR</span>
            </button>

          </div>
        </div>
      )}

      {}
      {isPaying && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-lg">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-sm w-full p-6 text-center relative shadow-2xl">
            
            <button
              onClick={() => setIsPaying(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            {paymentSuccess ? (
              <div className="py-6">
                <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
                  <CheckCircle className="w-10 h-10" />
                </div>
                <h3 className="text-xl font-black text-white mb-1">Payment Verified!</h3>
                <p className="text-xs text-slate-400">Item credited to account automatically.</p>
              </div>
            ) : (
              <div>
                <div className="inline-flex items-center gap-2 bg-red-600 text-white font-black px-3 py-1 rounded-md text-xs uppercase tracking-widest mb-4">
                  <span>KHQR BAKONG / ABA</span>
                </div>

                <p className="text-sm font-bold text-white mb-1">Scan KHQR with Mobile Banking App</p>
                <p className="text-xs text-slate-400 mb-4">Total: <span className="text-emerald-400 font-bold">${finalPriceUSD}</span> ({finalPriceKHR} KHR)</p>

                {/* Simulated KHQR Visual Frame */}
                <div className="bg-white p-4 rounded-2xl border-4 border-red-600 max-w-[220px] mx-auto mb-4 shadow-inner">
                  <div className="aspect-square bg-slate-950 rounded-lg p-2">
                    <div className="grid grid-cols-5 gap-1.5 w-full h-full p-2 bg-white rounded">
                      {Array.from({ length: 25 }).map((_, i) => (
                        <div
                          key={i}
                          className={`rounded-sm ${
                            i % 2 === 0 || i % 5 === 0 ? 'bg-slate-950' : 'bg-slate-200'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="mt-2 text-[10px] font-black text-red-600 tracking-wider uppercase">
                    CAMBODIA NATIONAL KHQR
                  </div>
                </div>

                <div className="flex items-center justify-center gap-2 text-xs text-slate-400 mb-2">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                  <span>Checking status... ({paymentTimer}s)</span>
                </div>

                <p className="text-[11px] text-slate-500">
                  Do not refresh or exit. System auto-checks every second.
                </p>
              </div>
            )}

          </div>
        </div>
      )}

      {}
      {isAuthOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-sm w-full p-6 relative shadow-2xl">
            <button
              onClick={() => setIsAuthOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            {isLoggedIn ? (
              <div className="text-center py-4">
                <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-3">
                  👨‍💻
                </div>
                <h3 className="text-lg font-bold text-white">{userProfile.name}</h3>
                <p className="text-xs text-slate-400 mb-4">{userProfile.phone}</p>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 mb-6 flex justify-between items-center text-xs">
                  <span className="text-slate-400">Store Credit:</span>
                  <span className="text-emerald-400 font-bold">${userProfile.balance}</span>
                </div>
                <button
                  onClick={() => {
                    setIsLoggedIn(false);
                    setIsAuthOpen(false);
                    showToast('Logged out successfully');
                  }}
                  className="w-full bg-slate-800 hover:bg-slate-700 text-red-400 font-bold py-2.5 rounded-xl text-xs transition flex items-center justify-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Log Out Account</span>
                </button>
              </div>
            ) : (
              <div>
                <h3 className="text-lg font-bold text-white mb-1">Gamer Login</h3>
                <p className="text-xs text-slate-400 mb-4">Enter Cambodian Phone (+855) to login</p>
                
                <div className="space-y-3 mb-4">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Phone Number</label>
                    <div className="flex">
                      <span className="bg-slate-950 border border-r-0 border-slate-800 rounded-l-xl px-3 py-2.5 text-xs text-slate-400 font-bold flex items-center">
                        +855
                      </span>
                      <input
                        type="text"
                        placeholder="12 888 999"
                        value={authPhone}
                        onChange={(e) => setAuthPhone(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-r-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setIsLoggedIn(true);
                    setIsAuthOpen(false);
                    showToast('Welcome to TopUpKH!');
                  }}
                  className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-3 rounded-xl text-xs transition flex items-center justify-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  <span>Send SMS Code</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {}
      <footer id="support" className="bg-slate-950 border-t border-slate-800/80 pt-12 pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
            
            <div className="md:col-span-1">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center font-black text-slate-950 text-sm">
                  KH
                </div>
                <span className="text-xl font-black text-white">TopUp<span className="text-emerald-400">KH</span></span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed mb-4">
                Cambodia’s digital game store. Direct ABA and Bakong KHQR integration for instant game diamond top-ups.
              </p>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Globe className="w-4 h-4 text-emerald-400" />
                <span>Phnom Penh, Kingdom of Cambodia 🇰🇭</span>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-3">Mobile Games</h4>
              <ul className="space-y-2 text-xs text-slate-400">
                <li><a href="#games" className="hover:text-emerald-400 transition">Mobile Legends Diamonds</a></li>
                <li><a href="#games" className="hover:text-emerald-400 transition">PUBG Mobile UC</a></li>
                <li><a href="#games" className="hover:text-emerald-400 transition">Free Fire Diamonds</a></li>
                <li><a href="#games" className="hover:text-emerald-400 transition">Honor of Kings Tokens</a></li>
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-3">Digital Vouchers</h4>
              <ul className="space-y-2 text-xs text-slate-400">
                <li><a href="#games" className="hover:text-emerald-400 transition">Steam Wallet USD</a></li>
                <li><a href="#games" className="hover:text-emerald-400 transition">Google Play Card</a></li>
                <li><a href="#games" className="hover:text-emerald-400 transition">Apple Gift Card</a></li>
                <li><a href="#games" className="hover:text-emerald-400 transition">Roblox Robux</a></li>
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-3">Khmer Support Team</h4>
              <p className="text-xs text-slate-400 mb-3">Need order assistance? Contact our local support team on Telegram.</p>
              <a
                href="https://t.me"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 bg-sky-500/10 border border-sky-500/30 text-sky-400 hover:bg-sky-500/20 px-4 py-2 rounded-xl text-xs font-bold transition"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Telegram Support (@TopUpKH)</span>
              </a>
            </div>

          </div>

          <div className="pt-6 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
            <p>© {new Date().getFullYear()} TopUpKH. All rights reserved.</p>
            <div className="flex items-center gap-4">
              <a href="#" className="hover:text-slate-400">Privacy Policy</a>
              <a href="#" className="hover:text-slate-400">Terms of Service</a>
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}