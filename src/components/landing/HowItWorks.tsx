"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { HOW, SECTION_IDS } from "./copy";
import { MatchPanel, OfferPanel, RankingPanel } from "./ProductPanels";
import { Reveal } from "./Reveal";
import { container, fluid } from "./styles";

const PANELS = [OfferPanel, MatchPanel, RankingPanel];

/**
 * Los tres pasos como un recorrido: en escritorio el panel del producto queda fijo y cambia
 * de estado según el paso que cruza el centro de la pantalla. En móvil no se fija nada y
 * cada paso trae su panel.
 */
export function HowItWorks() {
  const stepsRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const root = stepsRef.current;
    if (!root) return;

    // Atenuar los pasos fuera de foco depende de este script: sin él se leen todos por igual
    root.dataset.armed = "";

    // La raíz es una línea en el centro de la pantalla: está activo el paso que la cruza
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(Number((entry.target as HTMLElement).dataset.step));
        }
      },
      { rootMargin: "-50% 0px -50% 0px" }
    );
    root.querySelectorAll("[data-step]").forEach((step) => observer.observe(step));

    return () => observer.disconnect();
  }, []);

  return (
    <section id={SECTION_IDS.how} className={`${container} scroll-mt-24 py-24`}>
      <Reveal className="flex max-w-[680px] flex-col gap-4">
        <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{HOW.title}</h2>
        <p className="text-lg text-pretty text-muted-foreground">{HOW.subtitle}</p>
      </Reveal>

      <div ref={stepsRef} className="steps mt-16 lg:grid lg:grid-cols-2 lg:gap-16">
        <ol className="flex flex-col gap-16 lg:gap-0">
          {HOW.steps.map((step, index) => {
            const Panel = PANELS[index];
            return (
              <li
                key={step.title}
                data-step={index}
                data-active={active === index}
                className="step flex flex-col gap-6 lg:min-h-[70svh] lg:justify-center"
              >
                <div className="flex flex-col gap-3">
                  <p className="font-mono text-sm text-muted-foreground">
                    {index + 1} de {HOW.steps.length}
                  </p>
                  <h3 className="text-2xl font-semibold tracking-tight">{step.title}</h3>
                  <p className="text-lg text-pretty text-muted-foreground">{step.body}</p>
                </div>
                <div className="lg:hidden">
                  <Panel />
                </div>
              </li>
            );
          })}
        </ol>

        <div className="hidden lg:block">
          {/* Mismo alto que un paso y centrado en la pantalla: queda alineado con el paso en foco */}
          <div className="sticky top-[15svh] flex h-[70svh] flex-col justify-center gap-6">
            {/* Riel de progreso: en qué paso del recorrido está la pantalla */}
            <ol aria-hidden className="grid grid-cols-3 gap-2">
              {HOW.steps.map((step, index) => (
                <li key={step.short} className="flex flex-col gap-2">
                  <span
                    className={cn("h-0.5 rounded-full", fluid, index <= active ? "bg-foreground" : "bg-border")}
                  />
                  <span
                    className={cn("text-sm", fluid, index === active ? "text-foreground" : "text-muted-foreground")}
                  >
                    {step.short}
                  </span>
                </li>
              ))}
            </ol>

            {/* Los tres paneles ocupan la misma celda, así el alto no salta al cambiar */}
            <div className="grid">
              {PANELS.map((Panel, index) => (
                <div
                  key={HOW.steps[index].title}
                  aria-hidden={active !== index}
                  className={cn(
                    "col-start-1 row-start-1",
                    fluid,
                    active === index ? "opacity-100" : "pointer-events-none translate-y-4 opacity-0 blur-sm"
                  )}
                >
                  <Panel />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
