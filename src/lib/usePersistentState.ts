import { useCallback, useMemo, useSyncExternalStore } from "react";

// Preferencias chicas que conviene recordar entre visitas, guardadas en el navegador.
// Si el almacenamiento no está disponible (modo privado, bloqueado) todo sigue andando
// con el valor por defecto: nunca se rompe la pantalla por no poder recordar algo.

const listeners = new Set<() => void>();
// Lo escrito en esta sesión: es lo que se lee si el navegador no deja guardar
const memory = new Map<string, string>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function read(key: string): string | null {
  const written = memory.get(key);
  if (written !== undefined) return written;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Interpreta lo guardado; cualquier cosa que no tenga la forma esperada vuelve al valor por defecto. */
export function parseStored<T>(raw: string | null, fallback: T, isValid: (value: unknown) => value is T): T {
  if (raw === null) return fallback;
  try {
    const value: unknown = JSON.parse(raw);
    return isValid(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

export const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

export const isBoolean = (value: unknown): value is boolean => typeof value === "boolean";

/** Como useState, pero el valor sobrevive a recargar la página. En el servidor vale `fallback`. */
export function usePersistentState<T>(key: string, fallback: T, isValid: (value: unknown) => value is T) {
  const raw = useSyncExternalStore(
    subscribe,
    () => read(key),
    () => null
  );
  const value = useMemo(() => parseStored(raw, fallback, isValid), [raw, fallback, isValid]);

  const setValue = useCallback(
    (next: T | ((previous: T) => T)) => {
      const previous = parseStored(read(key), fallback, isValid);
      const resolved = typeof next === "function" ? (next as (previous: T) => T)(previous) : next;
      const serialized = JSON.stringify(resolved);
      memory.set(key, serialized);
      try {
        window.localStorage.setItem(key, serialized);
      } catch {
        // Sin almacenamiento el cambio vale hasta recargar la página
      }
      listeners.forEach((listener) => listener());
    },
    [key, fallback, isValid]
  );

  return [value, setValue] as const;
}
