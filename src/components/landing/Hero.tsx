import type { CSSProperties } from "react";
import Link from "next/link";
import { GoogleLogoIcon } from "@phosphor-icons/react/dist/ssr";
import { CTA, HERO } from "./copy";
import { HeroDemo } from "./HeroDemo";
import { container, primaryButton } from "./styles";

/** Orden de entrada de cada bloque en la animación de carga. */
const order = (index: number) => ({ "--rise-order": index }) as CSSProperties;

export function Hero({ isLoggedIn }: { isLoggedIn: boolean }) {
  const cta = isLoggedIn ? CTA.loggedIn : CTA.anonymous;

  return (
    <section className={`${container} flex flex-col items-center gap-16 pt-16 pb-24`}>
      <div className="flex flex-col items-center gap-8 text-center">
        <div className="flex flex-col items-center gap-6">
          {/* El corte va donde corta la idea; cada mitad se equilibra sola para no dejar una palabra suelta */}
          <h1 className="landing-heading rise max-w-[680px] pb-1 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            <span className="block">{HERO.title[0]}</span> <span className="block">{HERO.title[1]}</span>
          </h1>
          <p className="rise max-w-[680px] text-lg text-pretty text-muted-foreground" style={order(1)}>
            {HERO.subtitle}
          </p>
        </div>

        <div className="rise flex flex-col items-center gap-3" style={order(2)}>
          <Link href={cta.href} className={primaryButton}>
            {!isLoggedIn && <GoogleLogoIcon weight="bold" className="size-5" aria-hidden />}
            {cta.label}
          </Link>
          <p className="text-sm text-muted-foreground">{HERO.proof}</p>
        </div>
      </div>

      <div className="rise w-full" style={order(3)}>
        <HeroDemo />
      </div>
    </section>
  );
}
