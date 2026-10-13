import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Toaster } from "sonner";
import { ReviewOverlayWrapper } from "@/components/ReviewOverlayWrapper";
import { auth } from "@/auth";
import { SEO } from "@/components/landing/copy";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Dominio de producción en Vercel; fuera de Vercel se usa el público conocido
const siteUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "https://kwtools.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "KeyWords", template: "%s | KeyWords" },
  description: SEO.description,
  applicationName: "KeyWords",
  openGraph: {
    type: "website",
    locale: "es_AR",
    siteName: "KeyWords",
    title: SEO.title,
    description: SEO.description,
  },
  twitter: {
    card: "summary_large_image",
    title: SEO.title,
    description: SEO.description,
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  return (
    <html lang="es">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <a
          href="#contenido"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-lg focus:bg-foreground focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-background"
        >
          Saltar al contenido
        </a>
        <Toaster />
        <ReviewOverlayWrapper />
        <Navbar session={session} />
        <main id="contenido" className="min-h-screen">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
