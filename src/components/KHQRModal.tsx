"use client";

import { useEffect, useState } from "react";
import { BakongKHQR } from "bakong-khqr";
import QRCode from "qrcode";

interface KHQRModalProps {
  amount: number;
  orderId: number;
  onClose: () => void;
  onSuccess: () => void;
}

export default function KHQRModal({ amount, orderId, onClose, onSuccess }: KHQRModalProps) {
  const [qrImageUrl, setQrImageUrl] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function generateQR() {
      try {
        const info = {
          bakongAccountID: process.env.NEXT_PUBLIC_BAKONG_ACCOUNT_ID || "010951946@abaa",
          merchantName: process.env.NEXT_PUBLIC_BAKONG_MERCHANT_NAME || "TopUpKH Store",
          merchantCity: process.env.NEXT_PUBLIC_BAKONG_MERCHANT_CITY || "Phnom Penh",
          acquiringBank: "ABA Bank",
          accountInformation: `Order #${orderId}`,
        };

        // Generate standard EMVCo KHQR string
        const khqr = new BakongKHQR();
        const response = khqr.generateIndividual(info, { usd: amount });

        if (response?.data?.qr) {
          const url = await QRCode.toDataURL(response.data.qr, {
            width: 300,
            margin: 2,
            color: { dark: "#000000", light: "#ffffff" },
          });
          setQrImageUrl(url);
        }
      } catch (err) {
        console.error("Failed to generate KHQR:", err);
      } finally {
        setLoading(false);
      }
    }

    void generateQR();
  }, [amount, orderId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 max-w-sm w-full text-center shadow-2xl relative">
        <h2 className="text-xl font-bold text-white mb-1">ស្កែន QR Code ដើម្បីទូទាត់</h2>
        <p className="text-xs text-gray-400 mb-4">
          Scan to pay <span className="text-emerald-400 font-bold">${amount} USD</span> via Bakong / ABA
        </p>

        <div className="bg-white p-4 rounded-xl inline-block my-2 shadow-inner">
          {loading ? (
            <div className="w-60 h-60 flex items-center justify-center text-gray-500 text-sm">
              កំពុងបង្កើត QR Code...
            </div>
          ) : qrImageUrl ? (
            <img src={qrImageUrl} alt="Bakong KHQR Code" className="w-60 h-60 mx-auto" />
          ) : (
            <div className="w-60 h-60 flex items-center justify-center text-red-500 text-sm">
              មិនអាចបង្កើត QR Code បានទេ
            </div>
          )}
        </div>

        <p className="text-xs text-gray-400 my-3">Order ID: #{orderId}</p>

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