import { FACTS } from "./copy";
import { DICTIONARY_FACTS } from "./dictionary-facts";
import { Reveal } from "./Reveal";
import { container } from "./styles";

const format = new Intl.NumberFormat("es-AR");

const ITEMS = (Object.keys(FACTS.labels) as Array<keyof typeof FACTS.labels>).map((key) => ({
  key,
  value: DICTIONARY_FACTS[key],
  label: FACTS.labels[key],
}));

/** La prueba de la página: lo que el producto tiene cargado hoy, sin testimonios inventados. */
export function Facts() {
  return (
    <section className={`${container} py-24`}>
      <Reveal className="flex flex-col gap-12">
        <div className="flex max-w-[680px] flex-col gap-4">
          <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{FACTS.title}</h2>
          <p className="text-lg text-pretty text-muted-foreground">{FACTS.subtitle}</p>
        </div>

        {/* Las líneas entre celdas son el fondo del contenedor asomando por la separación */}
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border bg-border lg:grid-cols-4">
          {ITEMS.map((item) => (
            <div key={item.key} className="flex flex-col-reverse justify-end gap-2 bg-background p-6">
              <dt className="text-sm text-pretty text-muted-foreground">{item.label}</dt>
              <dd className="font-mono text-4xl font-semibold tracking-tight tabular-nums">
                {format.format(item.value)}
              </dd>
            </div>
          ))}
        </dl>
      </Reveal>
    </section>
  );
}
