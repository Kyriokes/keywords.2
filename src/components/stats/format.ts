/** Puntos de cobertura que suma una habilidad, para mostrar: "+7 pts". */
export function formatPoints(points: number): string {
  const rounded = Math.round(points);
  return rounded >= 1 ? `+${rounded} ${rounded === 1 ? "pt" : "pts"}` : "menos de 1 pt";
}
