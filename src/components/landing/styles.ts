// Clases compartidas por las secciones de la landing. Los valores siguen su sistema visual:
// una sola curva de movimiento, foco siempre visible y botones de 8px por 12px.

// Con "reducir movimiento" solo se animan color y opacidad: lo que se desplaza o gira cambia de golpe
export const fluid =
  "transition-all duration-700 ease-fluid motion-reduce:transition-[color,background-color,border-color,opacity]";

export const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground";

export const primaryButton = `inline-flex items-center justify-center gap-2 rounded-lg bg-foreground px-3 py-2 text-base font-semibold text-background hover:bg-foreground/85 active:scale-[0.98] ${fluid} ${focusRing}`;

/** Ancho y márgenes laterales comunes a todas las secciones. */
export const container = "mx-auto w-full max-w-6xl px-4 sm:px-6";

/** Marco que envuelve cada fragmento de interfaz del producto. */
export const productFrame = "rounded-2xl border bg-muted p-2";
export const productSurface = "rounded-lg border bg-background";
