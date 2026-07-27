import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import NextTopLoader from "nextjs-toploader";
import "./globals.css";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { PageTransition } from "@/components/PageTransition";
import { DynamicIsland } from "@/components/DynamicIsland";
import { PwaInstallListener } from "@/components/PwaInstallListener";
import { OfflineScreen } from "@/components/OfflineScreen";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://grabon.vercel.app",
  ),
  title: {
    default: "GrabOn — Groceries in minutes",
    template: "%s | GrabOn",
  },
  description:
    "Order fresh groceries & daily essentials online. Delivered to your door in minutes.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "GrabOn",
  },
  openGraph: {
    type: "website",
    siteName: "GrabOn",
    title: "GrabOn — Groceries in minutes",
    description:
      "Order fresh groceries & daily essentials online. Delivered to your door in minutes.",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "GrabOn — Groceries delivered in minutes",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "GrabOn — Groceries in minutes",
    description:
      "Order fresh groceries & daily essentials online. Delivered to your door in minutes.",
    images: ["/og-image.jpg"],
  },
};

export const viewport: Viewport = {
  themeColor: "#7c3aed",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans">
        <NextTopLoader color="#7c3aed" height={3} showSpinner={false} />
        <PwaInstallListener />
        <DynamicIsland />
        <OfflineScreen />
        <Suspense fallback={<div className="h-16 border-b border-gray-100 bg-white" />}>
          <Header />
        </Suspense>
        <main className="container-app py-4 pb-28 sm:pb-10">
          <PageTransition>{children}</PageTransition>
        </main>
        <BottomNav />
      </body>
    </html>
  );
}
