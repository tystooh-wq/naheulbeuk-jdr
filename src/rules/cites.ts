import { longueur, pointA, RAPPORT_PLAN, trajet, type Point } from './rues';
import { LIEUX_VALTORDU, RESEAU_VALTORDU, RUMEURS_VALTORDU } from './valtordu';
import { LIEUX, RUMEURS_LOUCHES, RUMEURS_NORMALES, type Lieu } from './waldorg';

// Les villes jouables, avec leur plan : Waldorg (la capitale) et Valtordu (le village des débutants).

export interface Cite {
  id: string;
  nom: string;
  sousTitre: string;
  lieux: Lieu[];
  /** Rapport largeur / hauteur du plan. */
  rapport: number;
  /** Trajets précalculés le long des rues (Waldorg), ou réseau de rues relevé à la main (Valtordu). */
  trajets?: Record<string, Point[]>;
  reseau?: { noeuds: Record<string, Point>; aretes: [string, string][] };
  /** Lieu de la carte du monde où l'on se retrouve en sortant. */
  lieuMonde: string;
  rumeurs: { normales: string[]; louches: string[] };
  /** Récit d'arrivée, paragraphe par paragraphe. */
  arrivee: string[];
  /** Heures de marche pour traverser le plan de part en part. */
  heuresTraversee: number;
  sortie: string;
}

export const CITES: Cite[] = [
  {
    id: 'waldorg',
    nom: 'Waldorg',
    sousTitre: 'Capitale de la Terre de Fangh, épicentre de la magie de haut niveau. On peut tout y acheter, à condition que ce soit cher.',
    lieux: LIEUX,
    rapport: RAPPORT_PLAN,
    lieuMonde: 'waldorg',
    rumeurs: { normales: RUMEURS_NORMALES, louches: RUMEURS_LOUCHES },
    arrivee: [
      "Après une longue marche, {nom} traverse le souk de la banlieue, où un marchand de tapis tente de lui vendre un chameau. Aux portes de la ville, un garde mâchonne une saucisse et l'examine de la tête aux pieds.",
      "« Aventurier, hein ? Bienvenue à Waldorg. Pas de bagarre, pas de magie dans les rues, et si vous mourez, c'est à vos frais. »",
    ],
    heuresTraversee: 1.6,
    sortie: 'Quitter Waldorg et partir sur les routes',
  },
  {
    id: 'valtordu',
    nom: 'Valtordu',
    sousTitre: "Son boudin, ses pulls. Un village tranquille à l'extrême sud-ouest de la Terre de Fangh, parfait pour commencer une carrière d'aventurier.",
    lieux: LIEUX_VALTORDU,
    rapport: 1600 / 1130,
    reseau: RESEAU_VALTORDU,
    lieuMonde: 'valtordu',
    rumeurs: { normales: RUMEURS_VALTORDU, louches: RUMEURS_VALTORDU },
    arrivee: [
      "{nom} arrive par le chemin de l'Est, passe le vieux moulin et découvre Valtordu : des toits de chaume, des moutons partout, et une odeur de boudin grillé qui flotte jusqu'au pont des Tricoteuses.",
      "Une vieille dame en pull affreux te dévisage. « Encore un aventurier. Le Donjon Facile, c'est au bout de la rue Chafouin. Et essuie tes bottes. »",
    ],
    heuresTraversee: 0.4,
    sortie: "Quitter Valtordu par le chemin de l'Est",
  },
];

/** Accepte aussi les vieilles sauvegardes, où la ville s'écrivait « Waldorg ». */
export const cite = (id: string): Cite => CITES.find((c) => c.id === id.toLowerCase()) ?? CITES[0];

export const lieuCite = (c: Cite, id: string): Lieu => {
  const l = c.lieux.find((x) => x.id === id);
  if (!l) throw new Error(`Lieu inconnu à ${c.nom} : ${id}`);
  return l;
};

const distance = (c: Cite, a: Point, b: Point) => Math.hypot(a[0] - b[0], (a[1] - b[1]) / c.rapport);

/** Plus court chemin dans le réseau de rues (Dijkstra, il y a une quinzaine de carrefours). */
const parLesRues = (c: Cite, depart: Point, arrivee: Point): Point[] => {
  const { noeuds, aretes } = c.reseau!;
  const proche = (pt: Point) => Object.keys(noeuds).reduce((m, k) => (distance(c, noeuds[k], pt) < distance(c, noeuds[m], pt) ? k : m));
  const de = proche(depart);
  const vers = proche(arrivee);
  const dist: Record<string, number> = { [de]: 0 };
  const avant: Record<string, string> = {};
  const restants = new Set(Object.keys(noeuds));
  while (restants.size) {
    const n = [...restants].reduce((m, k) => ((dist[k] ?? Infinity) < (dist[m] ?? Infinity) ? k : m));
    restants.delete(n);
    if (n === vers || dist[n] === undefined) break;
    for (const [a, b] of aretes) {
      const voisin = a === n ? b : b === n ? a : null;
      if (!voisin || !restants.has(voisin)) continue;
      const d = dist[n] + distance(c, noeuds[n], noeuds[voisin]);
      if (d < (dist[voisin] ?? Infinity)) {
        dist[voisin] = d;
        avant[voisin] = n;
      }
    }
  }
  const etapes: string[] = [vers];
  while (etapes[0] !== de && avant[etapes[0]]) etapes.unshift(avant[etapes[0]]);
  return [depart, ...etapes.map((k) => noeuds[k]), arrivee];
};

export const trajetCite = (c: Cite, a: Lieu, b: Lieu): Point[] => {
  if (a.id === b.id) return [[a.x, a.y]];
  if (c.reseau) return parLesRues(c, [a.x, a.y], [b.x, b.y]);
  return trajet(a, b, c.trajets);
};

export const longueurCite = (c: Cite, chemin: Point[]) => longueur(chemin, c.rapport);
export const pointCite = (c: Cite, chemin: Point[], t: number) => pointA(chemin, t, c.rapport);
