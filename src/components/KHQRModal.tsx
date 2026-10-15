"use client";

import { useEffect, useState } from "react";
import { BakongKHQR, IndividualInfo } from "bakong-khqr";
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
        const info: IndividualInfo = {
          bakongAccountID: process.env.NEXT_PUBLIC_BAKONG_ACCOUNT_ID || "seller@abaa",
          merchantName: process.env.NEXT_PUBLIC_BAKONG_MERCHANT_NAME || "TopUpKH Store",
          merchantCity: process.env.NEXT_PUBLIC_BAKONG_MERCHANT_CITY || "Phnom Penh",
          accountInformation: `Order #${orderId}`,
        };

        // 1. Generate standard EMVCo KHQR string
        const khqr = new BakongKHQR();
        const response = khqr.generateIndividual(info, { usd: amount });

        if (response?.data?.qr) {
          // 2. Convert string to Data URL image
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
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-gray-900 border border-red-500/30 rounded-2xl p-6 max-w-sm w-full text-center space-y-4">
        <div className="flex justify-between items-center border-b border-gray-800 pb-3">
          <h2 className="text-lg font-bold text-red-500 flex items-center gap-2">
            🇰🇭 KHQR Payment
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-sm cursor-pointer"
          >
            ✕
          </button>
        </div>

        {loading ? (
          <p className="text-gray-400 text-sm py-8">Generating KHQR...</p>
        ) : qrImageUrl ? (
          <div className="space-y-4">
            <div className="bg-white p-4 rounded-xl inline-block shadow-lg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrImageUrl} alt="KHQR Code" className="w-60 h-60 mx-auto" />
            </div>

            <div>
              <div className="text-2xl font-bold text-emerald-400 font-mono">
                ${amount.toFixed(2)} USD
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Scan with ABA, ACLEDA, Sathapana, or Bakong App
              </p>
            </div>

            <button
              onClick={onSuccess}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-2.5 rounded-xl transition-all text-sm cursor-pointer"
            >
              I Have Completed Payment
            </button>
          </div>
        ) : (
          <p className="text-red-400 text-sm">Failed to create QR Code.</p>
        )}
      </div>
    </div>
  );
}