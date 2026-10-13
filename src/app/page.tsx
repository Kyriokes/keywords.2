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

export const metadata: Metadata = {
  title: { absolute: SEO.title },
  alternates: { canonical: "/" },
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
    </div>
  );
}
