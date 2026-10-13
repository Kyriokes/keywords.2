import Link from "next/link";
import { GoogleLogoIcon } from "@phosphor-icons/react/dist/ssr";
import { CTA, FINAL } from "./copy";
import { Reveal } from "./Reveal";
import { container, primaryButton } from "./styles";

/** Cierre: el mismo botón del hero, con lo que reduce el riesgo de probar justo al lado. */
export function FinalCta({ isLoggedIn }: { isLoggedIn: boolean }) {
  const cta = isLoggedIn ? CTA.loggedIn : CTA.anonymous;

  return (
    <section className={`${container} py-24`}>
      <Reveal className="flex flex-col items-center gap-8 text-center">
        <div className="flex flex-col items-center gap-4">
          <h2 className="max-w-[680px] text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            {FINAL.title}
          </h2>
          <p className="max-w-[680px] text-lg text-pretty text-muted-foreground">{FINAL.body}</p>
        </div>

        <div className="flex flex-col items-center gap-3">
          <Link href={cta.href} className={primaryButton}>
            {!isLoggedIn && <GoogleLogoIcon weight="bold" className="size-5" aria-hidden />}
            {cta.label}
          </Link>
          <p className="text-sm text-muted-foreground">{FINAL.risk}</p>
        </div>
      </Reveal>
    </section>
  );
}
