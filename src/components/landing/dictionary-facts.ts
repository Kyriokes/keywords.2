import "server-only";

import { loadRoles } from "../../../prisma/dictionary/roles-data";
import { loadSeed } from "../../../prisma/dictionary/seed-data";
import { OTHER_ROLE } from "@/lib/positions/rules";
import { DAILY_ANALYSES } from "./copy";

// Los números que anuncia la landing salen de la semilla del diccionario, no de un texto
// escrito a mano: si la semilla crece, la landing lo refleja en el próximo deploy.
const seed = loadSeed();

export const DICTIONARY_FACTS = {
  technologies: seed.length,
  /** Variantes de escritura que se reconocen, contando el nombre de cada entrada. */
  spellings: seed.reduce((count, entry) => count + entry.aliases.length, 0),
  /** "Otros" es un destino manual, no un rol. */
  roles: loadRoles().filter((role) => role.name !== OTHER_ROLE).length,
  analyses: DAILY_ANALYSES,
};
