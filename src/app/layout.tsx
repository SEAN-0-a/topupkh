import "./globals.css";
import MotionBackground from "@/components/MotionBackground";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ThemeProvider from "@/components/ThemeProvider";
import CrispChat from "@/components/CrispChat";
import { LanguageProvider } from "@/context/LanguageContext";

export const metadata = {
  title: "RomdoulKHShop — Cambodia's Gaming Top-Up Marketplace",
  description:
    "Buy Mobile Legends, PUBG, Free Fire and Roblox top-ups safely in Cambodia. USD payments via KHQR (ABA PayWay) with escrow-protected delivery.",
  icons: {
    icon: "/image/websitefavicon1.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-slate-50 text-slate-900 antialiased transition-colors duration-200 dark:bg-[#121212] dark:text-white">
        <MotionBackground />
        <ThemeProvider>
          <LanguageProvider>
            <div className="flex min-h-screen flex-col">
              <Navbar />
              <CrispChat />
              <main className="flex-1">{children}</main>
              <Footer />
            </div>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}