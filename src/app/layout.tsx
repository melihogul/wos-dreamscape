import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WoS Dreamscape - Live Screen Sharing with Interactive Dots",
  description:
    "Share your screen, create a room, and let viewers place colorful dots on your screen in real-time.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
