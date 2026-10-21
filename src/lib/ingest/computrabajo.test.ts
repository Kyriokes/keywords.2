import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
    computrabajoAgeDays,
    computrabajoLocation,
    computrabajoSlugs,
    fetchComputrabajo,
    parseComputrabajoDetail,
    parseComputrabajoList,
} from "./computrabajo";

const fixture = (name: string) => readFileSync(join(__dirname, "fixtures", name), "utf8");
const LIST = fixture("computrabajo-list.html");
const DETAIL = fixture("computrabajo-detail.html");
const NOW = new Date("2026-10-20T20:00:00.000Z");

describe("computrabajoAgeDays", () => {
    it("entiende las fechas relativas de las tarjetas", () => {
        expect(computrabajoAgeDays("Hace  17  horas", NOW)).toBe(0);
        expect(computrabajoAgeDays("Hoy", NOW)).toBe(0);
        expect(computrabajoAgeDays("Ayer", NOW)).toBe(1);
        expect(computrabajoAgeDays("Hace 3 d&#xED;as", NOW)).toBe(3);
        expect(computrabajoAgeDays("Hace 6 días (actualizada)", NOW)).toBe(6);
        expect(computrabajoAgeDays("M&#xE1;s de 30 d&#xED;as", NOW)).toBe(31);
        expect(computrabajoAgeDays("2 de octubre", NOW)).toBe(18);
        expect(computrabajoAgeDays("", NOW)).toBeNull();
    });
});

describe("parseComputrabajoList", () => {
    const cards = parseComputrabajoList(LIST, NOW);

    it("lee cada tarjeta con su id, título, empresa, lugar y fecha", () => {
        expect(cards).toHaveLength(5);
        expect(cards[0]).toMatchObject({
            id: "18B45A689F19BB3461373E686DCF3405",
            url: "https://ar.computrabajo.com/ofertas-de-trabajo/oferta-de-trabajo-de-desarrollador-senior-y-jefe-de-desarrollo-full-stack-net-en-belgrano-18B45A689F19BB3461373E686DCF3405",
            title: "Desarrollador Senior y Jefe de desarrollo Full Stack .NET",
            company: "Estudio Orbe",
            location: "Belgrano, Capital Federal",
            ageDays: 0,
        });
        // Las entidades HTML se decodifican
        expect(cards[1]).toMatchObject({ location: "Córdoba, Córdoba", ageDays: 1 });
        expect(cards[4].ageDays).toBe(31);
    });

    it("traduce la modalidad de las etiquetas a la ubicación que entienden los filtros", () => {
        expect(computrabajoLocation(cards[2])).toMatch(/^Híbrido · /);
        expect(computrabajoLocation(cards[3])).toBe("Remoto");
        expect(computrabajoLocation({ tags: "", location: "Palermo, Capital Federal" })).toBe("Palermo, Capital Federal");
        expect(computrabajoLocation({ tags: "Presencial", location: "Rosario, Santa Fe" })).toBe("Presencial · Rosario, Santa Fe");
    });
});

describe("parseComputrabajoDetail", () => {
    it("devuelve la descripción con los requerimientos, sin los botones de la página", () => {
        const description = parseComputrabajoDetail(DETAIL);
        expect(description).toContain("Descripción de la oferta");
        expect(description).toContain("Buscamos un perfil que nos permita");
        expect(description).toContain("• 3 años de experiencia");
        expect(description).not.toContain("Postularme");
        expect(parseComputrabajoDetail("<html><body>Nada</body></html>")).toBeNull();
    });
});

describe("computrabajoSlugs", () => {
    it("usa los slugs conocidos y arma uno para los roles que no están en la lista", () => {
        expect(computrabajoSlugs(["Full Stack Developer", "Software Developer", "Data Engineer"])).toEqual([
            "desarrollador-full-stack",
            "desarrollador-de-software",
            "programador",
            "data-engineer",
        ]);
    });
});

describe("fetchComputrabajo", () => {
    it("lee dos páginas por puesto, pide el detalle de las recientes y arma las ofertas", async () => {
        const getText = vi.fn(async (url: string) => (url.includes("/trabajo-de-") ? LIST : DETAIL));

        const jobs = await fetchComputrabajo(["Full Stack Developer"], getText, NOW);

        expect(getText).toHaveBeenCalledWith("https://ar.computrabajo.com/trabajo-de-desarrollador-full-stack");
        expect(getText).toHaveBeenCalledWith("https://ar.computrabajo.com/trabajo-de-desarrollador-full-stack?p=2");
        // La de más de 30 días no se pide; las dos páginas traen las mismas tarjetas y no se repiten
        expect(jobs).toHaveLength(4);
        expect(jobs[0]).toMatchObject({
            source: "computrabajo",
            externalId: "18B45A689F19BB3461373E686DCF3405",
            company: "Estudio Orbe",
            applyUrl: null,
            location: "Belgrano, Capital Federal",
            publishedAt: NOW.toISOString(),
        });
        expect(jobs[0].description).toContain("Requerimientos");
        expect(jobs.find((job) => job.externalId === "3B151D0AB01390DA61373E686DCF3405")).toMatchObject({ location: "Remoto" });
    });

    it("si ninguna página responde, la fuente falla y se ve el error", async () => {
        const getText = vi.fn(async () => {
            throw new Error("403 Forbidden");
        });
        await expect(fetchComputrabajo(["Full Stack Developer"], getText, NOW)).rejects.toThrow("403 Forbidden");
    });

    it("una oferta cuyo detalle no se pudo leer se saltea", async () => {
        const getText = vi.fn(async (url: string) => {
            if (url.includes("/trabajo-de-")) return LIST;
            if (url.includes("18B45A689F19BB34")) throw new Error("500");
            return DETAIL;
        });
        const jobs = await fetchComputrabajo(["Full Stack Developer"], getText, NOW);
        expect(jobs).toHaveLength(3);
    });
});
