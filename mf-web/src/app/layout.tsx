import type { Metadata } from "next";
import { Geist, Geist_Mono, Syne } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const syne = Syne({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "MasterFabric Tracker",
  description: "Desktop-first issue tracking for MasterFabric teams.",
  applicationName: "MasterFabric Tracker",
  icons: {
    icon: [{ url: "/tracker-mark.png", type: "image/png" }],
    apple: [{ url: "/tracker-mark.png" }],
  },
  openGraph: {
    title: "MasterFabric Tracker",
    description: "Desktop-first issue tracking — list, board, and keyboard speed.",
    siteName: "MasterFabric Tracker",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "MasterFabric Tracker" }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "MasterFabric Tracker",
    description: "Desktop-first issue tracking — list, board, and keyboard speed.",
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${syne.variable} h-full`}
    >
      <body className="min-h-full antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
