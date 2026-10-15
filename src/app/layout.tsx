import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TopUpKH - Roblox Top-Up Marketplace Cambodia",
  description: "Fast and reliable Roblox Robux top-ups in Cambodia. Direct recharge using KHQR payment.",
  keywords: ["Roblox", "Robux", "TopUpKH", "Cambodia", "KHQR", "Game Top Up"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="km">
      <body className="bg-black text-white antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}