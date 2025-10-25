import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Uniswap v3 Orderbook",
  description: "Interactive orderbook visualization for Uniswap v3 pools",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
