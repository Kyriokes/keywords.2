import { describe, expect, it } from "vitest";
import { isBoolean, isStringArray, parseStored } from "./usePersistentState";

describe("parseStored", () => {
  it("devuelve lo guardado cuando tiene la forma esperada", () => {
    expect(parseStored('["a","b"]', [], isStringArray)).toEqual(["a", "b"]);
    expect(parseStored("false", true, isBoolean)).toBe(false);
  });

  it("vuelve al valor por defecto si no hay nada, está roto o tiene otra forma", () => {
    expect(parseStored(null, ["x"], isStringArray)).toEqual(["x"]);
    expect(parseStored("{no es json", [], isStringArray)).toEqual([]);
    expect(parseStored("[1,2]", [], isStringArray)).toEqual([]);
    expect(parseStored('"sí"', true, isBoolean)).toBe(true);
  });
});
