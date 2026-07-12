import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import NextTopLoader from "nextjs-toploader";
import "./globals.css";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { PageTransition } from "@/components/PageTransition";

export const metadata: Metadata = {
  title: "QuickPick — Groceries in minutes",
  description: "Order groceries & daily essentials, delivered in minutes.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "QuickPick",
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
