"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { CTA, NAV_ANCHORS } from "./copy";
import { fluid, focusRing } from "./styles";

const MENU_ID = "landing-menu";

interface LandingNavProps {
  isLoggedIn: boolean;
  isAdmin: boolean;
  onLogout: () => void;
}

const pillLink = `rounded-full px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground ${fluid} ${focusRing}`;

/** Navegación de la landing: una pastilla flotante que en móvil se abre a pantalla completa. */
export function LandingNav({ isLoggedIn, isAdmin, onLogout }: LandingNavProps) {
  const [open, setOpen] = useState(false);

  const cta = isLoggedIn ? CTA.loggedIn : CTA.anonymous;
  // Con sesión, lo útil desde la portada es entrar a la app, no leerla
  const links = isLoggedIn
    ? [
        { href: "/user/add-job", label: "Agregar postulación" },
        { href: "/user/profile", label: "Mi perfil" },
        ...(isAdmin ? [{ href: "/admin", label: "Admin" }] : []),
      ]
    : NAV_ANCHORS;

  useEffect(() => {
    if (!open) return;

    // Con el menú abierto, lo que queda detrás no se scrollea ni recibe foco
    const behind = document.querySelectorAll<HTMLElement>("main, footer");
    behind.forEach((element) => element.setAttribute("inert", ""));
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    // En escritorio el menú no existe: si la ventana crece, se cierra
    const desktop = window.matchMedia("(min-width: 48rem)");
    const onResize = () => desktop.matches && setOpen(false);

    document.addEventListener("keydown", onKeyDown);
    desktop.addEventListener("change", onResize);

    return () => {
      behind.forEach((element) => element.removeAttribute("inert"));
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKeyDown);
      desktop.removeEventListener("change", onResize);
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <>
      <header className="pointer-events-none fixed inset-x-0 top-0 z-40 flex justify-center px-4">
        <div className="pointer-events-auto mt-6 flex w-max max-w-full items-center gap-2 rounded-full border bg-background/70 p-2 backdrop-blur-xl">
          <Link
            href="/"
            aria-current="page"
            onClick={close}
            className={`rounded-full px-3 py-2 text-base font-semibold tracking-tight ${focusRing}`}
          >
            KeyWords
          </Link>

          <nav aria-label="Principal" className="hidden items-center md:flex">
            {links.map((link) => (
              <Link key={link.href} href={link.href} className={pillLink}>
                {link.label}
              </Link>
            ))}
            {isLoggedIn && (
              <button type="button" onClick={onLogout} className={pillLink}>
                Cerrar sesión
              </button>
            )}
          </nav>

          <Link
            href={cta.href}
            onClick={close}
            className={`rounded-full bg-foreground px-3 py-2 text-sm font-semibold text-background hover:bg-foreground/85 active:scale-[0.98] ${fluid} ${focusRing}`}
          >
            {cta.short}
          </Link>

          <button
            type="button"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            aria-controls={MENU_ID}
            aria-label={open ? "Cerrar el menú" : "Abrir el menú"}
            className={`relative size-10 shrink-0 rounded-full hover:bg-muted active:scale-[0.98] md:hidden ${fluid} ${focusRing}`}
          >
            {/* Las dos líneas giran hasta formar la X; nunca desaparecen */}
            <span
              aria-hidden
              className={cn(
                "absolute top-1/2 left-1/2 h-0.5 w-4 -translate-x-1/2 rounded-full bg-foreground",
                fluid,
                open ? "-translate-y-1/2 rotate-45" : "-translate-y-1"
              )}
            />
            <span
              aria-hidden
              className={cn(
                "absolute top-1/2 left-1/2 h-0.5 w-4 -translate-x-1/2 rounded-full bg-foreground",
                fluid,
                open ? "-translate-y-1/2 -rotate-45" : "translate-y-0.5"
              )}
            />
          </button>
        </div>
      </header>

      <div
        id={MENU_ID}
        inert={!open}
        className={cn(
          "fixed inset-0 z-30 flex flex-col justify-center bg-background/80 px-6 backdrop-blur-3xl md:hidden",
          fluid,
          open ? "opacity-100" : "pointer-events-none opacity-0"
        )}
      >
        <nav aria-label="Menú" className="flex flex-col gap-2">
          {links.map((link, index) => (
            // Cada enlace sube desde una caja que lo recorta, uno después del otro
            <div key={link.href} className="overflow-hidden">
              <Link
                href={link.href}
                onClick={close}
                style={{ transitionDelay: open ? `${100 + index * 50}ms` : "0ms" }}
                className={cn(
                  `block rounded-lg py-2 text-3xl font-semibold tracking-tight ${focusRing}`,
                  fluid,
                  open ? "translate-y-0 opacity-100" : "translate-y-12 opacity-0"
                )}
              >
                {link.label}
              </Link>
            </div>
          ))}
          {isLoggedIn && (
            <div className="overflow-hidden">
              <button
                type="button"
                onClick={() => {
                  close();
                  onLogout();
                }}
                style={{ transitionDelay: open ? `${100 + links.length * 50}ms` : "0ms" }}
                className={cn(
                  `block rounded-lg py-2 text-left text-3xl font-semibold tracking-tight text-muted-foreground ${focusRing}`,
                  fluid,
                  open ? "translate-y-0 opacity-100" : "translate-y-12 opacity-0"
                )}
              >
                Cerrar sesión
              </button>
            </div>
          )}
        </nav>
      </div>
    </>
  );
}
