import { PlusIcon } from "@phosphor-icons/react/dist/ssr";
import { FAQ, SECTION_IDS } from "./copy";
import { Reveal } from "./Reveal";
import { container, fluid, focusRing } from "./styles";

// Las mismas preguntas, como datos estructurados para buscadores y asistentes
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ.items.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: { "@type": "Answer", text: item.answer },
  })),
};

export function Faq() {
  return (
    <section id={SECTION_IDS.faq} className={`${container} scroll-mt-24 py-24`}>
      <Reveal className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-16">
        <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{FAQ.title}</h2>

        {/* <details> nativo: se abre con teclado y funciona sin JavaScript */}
        <ul className="flex flex-col gap-3">
          {FAQ.items.map((item) => (
            <li key={item.question}>
              <details className="group rounded-2xl border bg-background">
                <summary
                  className={`flex cursor-pointer list-none items-center justify-between gap-4 rounded-2xl px-6 py-4 text-lg font-semibold hover:bg-muted [&::-webkit-details-marker]:hidden ${fluid} ${focusRing}`}
                >
                  {item.question}
                  <PlusIcon
                    weight="bold"
                    aria-hidden
                    className={`size-5 shrink-0 text-muted-foreground group-open:rotate-45 ${fluid}`}
                  />
                </summary>
                <p className="px-6 pt-2 pb-6 text-base text-pretty text-muted-foreground">{item.answer}</p>
              </details>
            </li>
          ))}
        </ul>
      </Reveal>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
    </section>
  );
}
