import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function normalizeKeyword(keyword: string): string {
  // Elimina puntos, guiones y espacios, y convierte a minúsculas
  // Esto ayuda a comparar "Node.js" con "Nodejs", "React Native" con "react-native", etc.
  return keyword.toLowerCase().replace(/[\.\-\s]/g, "");
}

