import type { Metadata } from "next";

// La página es un componente de cliente y no puede declarar su título: lo hace este layout
export const metadata: Metadata = { title: "Administración", robots: { index: false, follow: false } };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
