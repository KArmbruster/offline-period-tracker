import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { AppProvider } from "@/context/AppContext";
import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Offline Period Tracker",
  description: "Privacy-first offline period tracking app",
  manifest: (process.env.NODE_ENV === "production" ? "/offline-period-tracker" : "") + "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Offline Period Tracker",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#B3014F",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} antialiased`}
      >
        <ServiceWorkerRegistration />
        <AppProvider>{children}</AppProvider>
      </body>
    </html>
  );
}
