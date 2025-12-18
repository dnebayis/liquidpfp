import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Liquid PFP Maker",
  description:
    "Create a perfect PFP for Twitter/X and Discord: upload your photo, add hats/glasses/beanies, rotate/scale, and export in high quality.",
  icons: {
    icon: [
      { url: "/brand/Favicon1.svg", type: "image/svg+xml" },
      { url: "/brand/Favicon2.svg", type: "image/svg+xml", media: "(prefers-color-scheme: light)" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body
        className={`${geistSans.variable} ${geistMono.variable} h-full bg-[#0b0b10] text-[#ededff] antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
