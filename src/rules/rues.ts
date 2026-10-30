import TRAJETS from './waldorg-rues.json';

// Trajets à pied entre les lieux de Waldorg, calculés le long des rues et des ponts par scripts/rues.py.
// Chaque point est en % de la largeur et de la hauteur du plan.

export type Point = [number, number];

/** Rapport largeur / hauteur du plan, pour mesurer les distances sans déformation. */
export const RAPPORT_PLAN = 2500 / 1792;

const TRAJETS_WALDORG = TRAJETS as unknown as Record<string, Point[]>;

/** Le chemin de `a` vers `b`, dans le bon sens ; une ligne droite si aucun trajet n'est connu. */
export const trajet = (
  a: { id: string; x: number; y: number },
  b: { id: string; x: number; y: number },
  trajets: Record<string, Point[]> = TRAJETS_WALDORG,
): Point[] => {
  if (a.id === b.id) return [[a.x, a.y]];
  const aller = trajets[`${a.id}|${b.id}`];
  if (aller) return aller;
  const retour = trajets[`${b.id}|${a.id}`];
  if (retour) return [...retour].reverse();
  return [
    [a.x, a.y],
    [b.x, b.y],
  ];
};

/** Longueur d'un chemin, en % de la largeur du plan. */
export const longueur = (chemin: Point[], rapport = RAPPORT_PLAN): number =>
  chemin.slice(1).reduce((total, [x, y], i) => {
    const [x0, y0] = chemin[i];
    return total + Math.hypot(x - x0, (y - y0) / rapport);
  }, 0);

/** Position à une fraction `t` (0 à 1) de la longueur du chemin. */
export const pointA = (chemin: Point[], t: number, rapport = RAPPORT_PLAN): Point => {
  const total = longueur(chemin, rapport);
  let reste = Math.max(0, Math.min(1, t)) * total;
  for (let i = 1; i < chemin.length; i++) {
    const [x0, y0] = chemin[i - 1];
    const [x1, y1] = chemin[i];
    const l = Math.hypot(x1 - x0, (y1 - y0) / rapport);
    if (reste <= l && l > 0) return [x0 + ((x1 - x0) * reste) / l, y0 + ((y1 - y0) * reste) / l];
    reste -= l;
  }
  return chemin[chemin.length - 1];
};
