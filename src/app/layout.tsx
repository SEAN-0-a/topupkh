import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "TopUpKH - Secure Digital Marketplace",
  description: "Escrow-protected digital top-ups and gift cards",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-black text-white min-h-screen antialiased`}>
        <Navbar />
        <main className="py-6">{children}</main>
      </body>
    </html>
  );
}