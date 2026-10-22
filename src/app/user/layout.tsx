import type { Metadata } from "next";

// Todo lo de /user pide sesión: un buscador solo vería el login, así que no se indexa
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function UserLayout({ children }: { children: React.ReactNode }) {
  return children;
}
