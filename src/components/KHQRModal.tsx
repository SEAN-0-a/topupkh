"use client";

import Image from "next/image";

interface KHQRModalProps {
  amount: number;
  orderId: number;
  onClose: () => void;
  onSuccess: () => void;
}

export default function KHQRModal({ amount, orderId, onClose, onSuccess }: KHQRModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 max-w-sm w-full text-center shadow-2xl relative">
        <h2 className="text-xl font-bold text-white mb-1">ស្កែន QR Code ដើម្បីទូទាត់</h2>
        <p className="text-xs text-gray-400 mb-4">
          Scan to pay <span className="text-emerald-400 font-bold">${amount} USD</span> via Bakong / ABA
        </p>

        {/* Display your saved static ABA QR image */}
        <div className="bg-white p-4 rounded-xl inline-block my-2 shadow-inner">
          <img
            src="/aba-qr.jpg" 
            alt="ABA KHQR Code" 
            className="w-60 h-60 mx-auto object-contain"
          />
        </div>

        <p className="text-xs text-gray-400 my-1">Order ID: #{orderId}</p>
        <p className="text-[11px] text-amber-400 mb-3">
          *សូមបញ្ចូល Order ID #{orderId} ទៅក្នុង Remark ពេលទូទាត់
        </p>

        <div className="space-y-2 mt-4">
          <button
            onClick={onSuccess}
            className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-2.5 rounded-xl cursor-pointer text-sm transition-all"
          >
            ខ្ញុំបានទូទាត់រួចរាល់ (I Have Completed Payment)
          </button>
          <button
            onClick={onClose}
            className="w-full bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium py-2.5 rounded-xl cursor-pointer text-xs transition-all"
          >
            បោះបង់ (Cancel)
          </button>
        </div>
      </div>
    </div>
  );
}