import { BENEFITS, SECTION_IDS } from "./copy";
import { GapsFragment, MatchFragment, RolesFragment, SimulationFragment } from "./ProductPanels";
import { Reveal } from "./Reveal";
import { container } from "./styles";

// Cada beneficio va con su prueba al lado: el fragmento de la pantalla donde eso se ve
const ITEMS = [
  { ...BENEFITS.items.gaps, Fragment: GapsFragment },
  { ...BENEFITS.items.match, Fragment: MatchFragment },
  { ...BENEFITS.items.roles, Fragment: RolesFragment },
  { ...BENEFITS.items.simulation, Fragment: SimulationFragment },
];

export function Benefits() {
  return (
    <section id={SECTION_IDS.benefits} className={`${container} flex scroll-mt-24 flex-col gap-16 py-24`}>
      <Reveal>
        <h2 className="max-w-[680px] text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          {BENEFITS.title}
        </h2>
      </Reveal>

      <ul className="grid grid-cols-1 gap-x-16 gap-y-16 lg:grid-cols-2">
        {ITEMS.map(({ title, body, Fragment }, index) => (
          <li key={title} className="min-w-0">
            <Reveal className="flex h-full flex-col gap-6" delay={(index % 2) * 100}>
              {/* El marco se estira para que los textos de una misma fila arranquen a la misma altura */}
              <div className="flex-1">
                <Fragment />
              </div>
              <div className="flex flex-col gap-2">
                <h3 className="text-xl font-semibold tracking-tight">{title}</h3>
                <p className="text-base text-pretty text-muted-foreground">{body}</p>
              </div>
            </Reveal>
          </li>
        ))}
      </ul>
    </section>
  );
}
