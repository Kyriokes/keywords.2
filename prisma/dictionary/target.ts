/** Host y nombre de la base a la que apunta DATABASE_URL, sin credenciales, para mostrar antes de escribir. */
export function describeTarget(): string {
    try {
        const url = new URL(process.env.DATABASE_URL ?? "");
        return `${url.hostname}${url.pathname}`;
    } catch {
        return "(DATABASE_URL no definida o inválida)";
    }
}
