import type { Metadata } from "next";
import { auth } from "@/auth";
import { Benefits } from "@/components/landing/Benefits";
import { SEO, TAGLINE } from "@/components/landing/copy";
import { Facts } from "@/components/landing/Facts";
import { Faq } from "@/components/landing/Faq";
import { FinalCta } from "@/components/landing/FinalCta";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { TaglineReveal } from "@/components/landing/TaglineReveal";
import { SITE_NAME, SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: { absolute: SEO.title },
  alternates: { canonical: "/" },
};

// El sitio y la aplicación como datos estructurados: Google usa WebSite para el nombre del sitio en
// los resultados, y WebApplication para entender que es una herramienta web gratuita
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      name: SITE_NAME,
      url: SITE_URL,
      inLanguage: "es-AR",
      description: SEO.description,
    },
    {
      "@type": "WebApplication",
      "@id": `${SITE_URL}/#app`,
      name: SITE_NAME,
      url: SITE_URL,
      description: SEO.description,
      image: `${SITE_URL}/opengraph-image`,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      inLanguage: "es-AR",
      isAccessibleForFree: true,
      offers: { "@type": "Offer", price: "0", priceCurrency: "ARS" },
      author: { "@type": "Person", name: "Sergio Ferrari", url: "https://github.com/kyriokes" },
    },
  ],
};

export default async function LandingPage() {
  const session = await auth();
  const isLoggedIn = !!session?.user;

  return (
    // pt-24 deja lugar a la navegación flotante; overflow-x-clip contiene las entradas animadas
    <div className="landing overflow-x-clip pt-24">
      <Hero isLoggedIn={isLoggedIn} />
      <TaglineReveal lines={TAGLINE} />
      <HowItWorks />
      <Benefits />
      <Facts />
      <Faq />
      <FinalCta isLoggedIn={isLoggedIn} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
    </div>
  );
}
