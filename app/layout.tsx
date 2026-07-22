import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Inter, Manrope } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { RegisterSW } from "@/components/pwa/register-sw";
import { ThemeScript } from "@/components/theme/theme-script";
import { ThemeSync } from "@/components/theme/theme-sync";

const inter = Inter({subsets:['latin'],variable:'--font-sans'});
const manrope = Manrope({ subsets: ["latin"], variable: "--font-heading" });

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FamilyHQ",
  description: "El centro de operaciones del hogar.",
  applicationName: "FamilyHQ",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "FamilyHQ",
  },
  icons: {
    apple: "/icons/apple-touch-icon-180.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#284b63",
  // App-like: sin zoom por gestos (el pellizco descuadraba el layout y el bottom
  // nav) y el contenido ajustado a la pantalla, incluida el área bajo el notch.
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={cn("h-full", "antialiased", geistSans.variable, geistMono.variable, "font-sans", inter.variable, manrope.variable)}
    >
      <body className="min-h-full flex flex-col">
        <ThemeScript />
        {children}
        <ThemeSync />
        <RegisterSW />
      </body>
    </html>
  );
}
