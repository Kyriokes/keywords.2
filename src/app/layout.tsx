import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Toaster } from "sonner";
import { ReviewOverlayWrapper } from "@/components/ReviewOverlayWrapper";
import { auth } from "@/auth";
import { SEO } from "@/components/landing/copy";
import { SITE_NAME, SITE_URL, THEME_DARK, THEME_LIGHT } from "@/lib/site";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_NAME, template: `%s | ${SITE_NAME}` },
  description: SEO.description,
  applicationName: SITE_NAME,
  category: "technology",
  creator: "Sergio Ferrari",
  authors: [{ name: "Sergio Ferrari", url: "https://github.com/kyriokes" }],
  // Sin esto el navegador del celular convierte números sueltos en links de llamada
  formatDetection: { telephone: false, email: false, address: false },
  openGraph: {
    type: "website",
    locale: "es_AR",
    siteName: SITE_NAME,
    url: "/",
    title: SEO.title,
    description: SEO.description,
  },
  twitter: {
    card: "summary_large_image",
    title: SEO.title,
    description: SEO.description,
  },
};

export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: THEME_LIGHT },
    { media: "(prefers-color-scheme: dark)", color: THEME_DARK },
  ],
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  return (
    <html lang="es-AR" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="antialiased" suppressHydrationWarning>
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
