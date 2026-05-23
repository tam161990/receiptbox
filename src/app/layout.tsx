import type { Metadata, Viewport } from "next";
import "./globals.css";
import { getBrandFromEnv } from "@/lib/brand";

const brand = getBrandFromEnv();

export const metadata: Metadata = {
  title: brand.appName,
  description: brand.description,
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: brand.shortName,
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: brand.themeColor,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang={brand.countryCode === "LV" ? "lv" : "en"}>
      <body>{children}</body>
    </html>
  );
}
