"use client";

import { useEffect, useRef, useState } from "react";
import { container } from "./styles";

/** Parte de la pantalla, desde arriba, donde una palabra ya cuenta como leída. */
const TRIGGER_LINE = 0.6;

/**
 * La frase central de la página: arranca apagada y cada palabra se enciende, en orden de
 * lectura, a medida que el bloque cruza la línea de disparo.
 *
 * No hay listener de scroll: un IntersectionObserver con un umbral por palabra informa qué
 * fracción del bloque ya cruzó la línea, y esa fracción es la cantidad de palabras encendidas.
 */
export function TaglineReveal({ lines }: { lines: string[] }) {
  const ref = useRef<HTMLElement>(null);
  const [lit, setLit] = useState(0);

  const words = lines.map((line) => line.split(" "));
  const total = words.reduce((count, line) => count + line.length, 0);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    // Las palabras se apagan recién acá: sin JavaScript la frase se lee entera.
    // Es un cambio de opacidad, no un movimiento, así que vale también con "reducir movimiento".
    node.dataset.armed = "";

    const observer = new IntersectionObserver(
      ([entry]) => {
        // Si el bloque ya sale por arriba, la fracción visible baja pero la frase queda encendida
        const leavingTop = entry.boundingClientRect.top < (entry.rootBounds?.top ?? 0);
        setLit(leavingTop ? total : Math.round(entry.intersectionRatio * total));
      },
      {
        rootMargin: `0px 0px -${Math.round((1 - TRIGGER_LINE) * 100)}% 0px`,
        threshold: Array.from({ length: total + 1 }, (_, step) => step / total),
      }
    );
    observer.observe(node);

    return () => observer.disconnect();
  }, [total]);

  return (
    <section ref={ref} className={`tagline ${container} flex justify-center py-24`}>
      <p className="max-w-[680px] text-center text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
        {words.map((line, lineIndex) => {
          const offset = words.slice(0, lineIndex).reduce((count, previous) => count + previous.length, 0);
          return (
            <span key={line.join(" ")} className="block">
              {line.map((word, wordIndex) => (
                <span
                  key={`${word}-${wordIndex}`}
                  className="tagline-word"
                  data-on={offset + wordIndex < lit ? "" : undefined}
                >
                  {word}{" "}
                </span>
              ))}
            </span>
          );
        })}
      </p>
    </section>
  );
}
