import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ServiceWorkerRegister } from "@/components/pwa/ServiceWorkerRegister";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Laura — Sua família no controle das finanças",
  description:
    "Gestão financeira familiar via WhatsApp. Score, metas e relatórios com IA. 7 dias grátis, sem cartão.",
  openGraph: {
    title: "Laura — Sua família no controle das finanças",
    description: "Gestão financeira familiar via WhatsApp. 7 dias grátis, sem cartão.",
    type: "website",
    locale: "pt_BR",
  },
  manifest: "/manifest.json",
  applicationName: "Laura Finance",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Laura",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "48x48", type: "image/x-icon" },
      { url: "/icons/icon-192.svg", sizes: "192x192", type: "image/svg+xml" },
      { url: "/icons/icon-512.svg", sizes: "512x512", type: "image/svg+xml" },
    ],
    apple: [{ url: "/icons/icon-512.svg", sizes: "512x512", type: "image/svg+xml" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#7C3AED",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="dark" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <TooltipProvider>
          {children}
          <ServiceWorkerRegister />
          <InstallPrompt />
        </TooltipProvider>
      </body>
    </html>
  );
}
