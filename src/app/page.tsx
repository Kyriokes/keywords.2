import { auth } from "@/auth";
import { LandingPageClient } from "@/components/LandingPageClient";

export default async function LandingPage() {
  const session = await auth();
  const isLoggedIn = !!session?.user;

  return <LandingPageClient isLoggedIn={isLoggedIn} />;
}
