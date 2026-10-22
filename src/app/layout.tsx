import "./globals.css";
import Navbar from "@/components/Navbar";
import ThemeProvider from "@/components/ThemeProvider";
import { LanguageProvider } from "@/context/LanguageContext";

export const metadata = {
  title: "TopUpKH - Local P2P Roblox Escrow Marketplace",
  description: "Buy and sell Roblox items and Robux safely in Cambodia.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-black text-white antialiased">
        <ThemeProvider>
          <LanguageProvider>
            <Navbar />
            <main>{children}</main>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}