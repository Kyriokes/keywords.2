import { describe, expect, it } from "vitest";
import { seedRoleSources } from "../../../prisma/dictionary/roles-data";
import { buildRoleDictionary } from "./classify";
import { toDesiredRoles } from "./desired";

const sources = seedRoleSources();
const dictionary = buildRoleDictionary(sources);
const roleNames = new Map(sources.map((role) => [role.id, role.name]));
const convert = (titles: string[]) => toDesiredRoles(titles, dictionary, roleNames);

describe("toDesiredRoles", () => {
    it("conserva los nombres de rol, sin importar mayúsculas", () => {
        expect(convert(["Frontend Developer", "data engineer"])).toEqual({
            roles: ["Frontend Developer", "Data Engineer"],
            unrecognized: [],
        });
    });

    it("convierte los puestos en texto libre guardados antes del diccionario", () => {
        expect(convert(["Desarrollador React Sr", "Programador Java", "Analista QA"])).toEqual({
            roles: ["Frontend Developer", "Backend Developer", "QA Analyst"],
            unrecognized: [],
        });
    });

    it("no repite un rol al que llegan dos textos distintos", () => {
        expect(convert(["Frontend", "React Developer", "Front End Engineer"]).roles).toEqual(["Frontend Developer"]);
    });

    it("separa lo que no corresponde a ningún rol y descarta los vacíos", () => {
        expect(convert(["Backend", "Vendedor", "  ", "Otros"])).toEqual({
            roles: ["Backend Developer"],
            unrecognized: ["Vendedor", "Otros"],
        });
    });
});
