import { describe, expect, it } from "vitest";
import { generateAgentToken, hashAgentToken, parseBearerToken, tokenDisplayPrefix } from "./tokens";

describe("generateAgentToken", () => {
    it("genera tokens distintos con el formato que acepta parseBearerToken", () => {
        const a = generateAgentToken();
        const b = generateAgentToken();
        expect(a).not.toBe(b);
        expect(parseBearerToken(`Bearer ${a}`)).toBe(a);
    });
});

describe("hashAgentToken", () => {
    it("es estable y no contiene el token", () => {
        const token = generateAgentToken();
        expect(hashAgentToken(token)).toBe(hashAgentToken(token));
        expect(hashAgentToken(token)).not.toContain(token.slice(3));
        expect(hashAgentToken(token)).toMatch(/^[0-9a-f]{64}$/);
    });
});

describe("parseBearerToken", () => {
    it("rechaza headers ausentes, de otro esquema o con tokens mal formados", () => {
        const token = generateAgentToken();
        const invalid = [null, "", token, `Basic ${token}`, "Bearer ", "Bearer kw_corto", `Bearer ${token} extra`, `Bearer xx${token.slice(2)}`];
        for (const header of invalid) {
            expect(parseBearerToken(header), String(header)).toBeNull();
        }
    });

    it("acepta el esquema sin importar mayúsculas", () => {
        const token = generateAgentToken();
        expect(parseBearerToken(`bearer ${token}`)).toBe(token);
    });
});

describe("tokenDisplayPrefix", () => {
    it("muestra solo el comienzo del token", () => {
        const token = generateAgentToken();
        expect(tokenDisplayPrefix(token)).toHaveLength(9);
        expect(token.startsWith(tokenDisplayPrefix(token))).toBe(true);
    });
});
