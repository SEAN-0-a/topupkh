import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ThemeProvider from "@/components/ThemeProvider";
import { LanguageProvider } from "@/context/LanguageContext";

export const metadata = {
  title: "RomdoulKHShop — Cambodia's Gaming Top-Up Marketplace",
  description:
    "Buy Mobile Legends, PUBG, Free Fire and Roblox top-ups safely in Cambodia. USD payments via KHQR (ABA PayWay) with escrow-protected delivery.",
  icons: {
    icon: "/image/website%20favicon.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-page text-slate-900 dark:text-white antialiased transition-colors duration-200">
        <ThemeProvider>
          <LanguageProvider>
            <div className="flex min-h-screen flex-col">
              <Navbar />
              <main className="flex-1">{children}</main>
              <Footer />
            </div>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}