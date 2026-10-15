import { Battambang } from "next/font/google";
import "./globals.css";

const battambang = Battambang({
  weight: ["400", "700"],
  subsets: ["khmer"],
});

export const metadata = {
  title: "TopUpKH - ផ្សារទិញលក់ Roblox និងទំនិញឌីជីថល",
  description: "ទិញ លក់ Robux, ហ្គេមបាស, និងគណនីហ្គេម ដោយសុវត្ថិភាព",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="km">
      <body className={battambang.className}>{children}</body>
    </html>
  );
}