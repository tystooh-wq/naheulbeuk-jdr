import TABLE from './rencontres-terres-sauvages.json';
import FORET from './rencontres-foret1.json';
import { lancer, type Rng } from './des';
import { epreuve, lancerExpression, valeursCombat, type Partie } from './partie';

// Rencontres en terre sauvage 1 (Naheulbeuk JDR V2.0), ennemis de bas niveau, tirées au D20.
// En attendant les combats, une rencontre hostile se règle par une épreuve : fuir (Adresse),
// négocier (Charisme) avec ceux qui parlent, ou intimider (Courage) les bêtes.

export interface LigneRencontre {
  d20: number;
  rencontre: string;
  /** Combien : « 1 », « 1 à 3 », « 1 ou 2 », « 1D6 »… */
  nombre: string;
  nom: string;
  at: number;
  prd: number;
  ev: number;
  pr: number;
  degats: string;
  cou: number;
  xp: number;
  notes: string;
}

export const TABLE_TERRES_SAUVAGES = TABLE as LigneRencontre[];
export const TABLE_FORET = FORET as LigneRencontre[];

/** Les grandes régions de la carte, chacune avec sa table de rencontres et son niveau de danger. */
export type Zone = 'campagne' | 'terres-sauvages' | 'foret';

/**
 * Campagne paisible (Valtordu, Loubet) : table composée pour le jeu à partir des lignes les plus faibles
 * des tables officielles « Terre sauvage 1 » et « Forêt 1 ». Les rencontres y sont aussi deux fois plus rares.
 */
const CAMPAGNE: [number, LigneRencontre][] = [
  [1, TABLE_FORET[0]],
  [4, TABLE_TERRES_SAUVAGES[2]],
  [6, TABLE_TERRES_SAUVAGES[1]],
  [7, TABLE_TERRES_SAUVAGES[0]],
  [9, TABLE_FORET[3]],
  [11, TABLE_FORET[2]],
  [14, TABLE_TERRES_SAUVAGES[4]],
  [15, TABLE_FORET[4]],
  [16, TABLE_TERRES_SAUVAGES[3]],
  [17, TABLE_TERRES_SAUVAGES[8]],
  [18, TABLE_TERRES_SAUVAGES[7]],
  [19, TABLE_FORET[11]],
  [20, TABLE_TERRES_SAUVAGES[9]],
];

export const TABLES: Record<Zone, { nom: string; ligne: (d20: number) => LigneRencontre; paisible?: boolean }> = {
  campagne: { nom: 'Campagne paisible (table du jeu)', ligne: (d) => CAMPAGNE.find(([max]) => d <= max)![1], paisible: true },
  'terres-sauvages': { nom: 'Rencontres en terre sauvage 1', ligne: (d) => TABLE_TERRES_SAUVAGES[d - 1] },
  foret: { nom: 'Rencontres en forêt 1', ligne: (d) => TABLE_FORET[d - 1] },
};

export const NOM_ZONE: Record<Zone, string> = { campagne: 'campagne paisible', 'terres-sauvages': 'terres sauvages', foret: 'forêt' };

export interface Rencontre {
  ligne: LigneRencontre;
  nombre: number;
  d20: number;
  /** Nom de la table tirée (pour l'affichage). */
  table?: string;
}

/**
 * Un héros seul de bas niveau ne croise pas une armée : au plus « niveau + 1 » petites bêtes
 * (EV 10 ou moins), et au plus « niveau » adversaires plus costauds.
 */
export const plafondGroupe = (l: LigneRencontre, niveau: number) => Math.max(1, l.ev <= 10 ? niveau + 1 : niveau);

export const tirerNombre = (expr: string, rng?: Rng): number => {
  let m = /^(\d+) à (\d+)$/.exec(expr);
  if (m) return Number(m[1]) - 1 + lancer(Number(m[2]) - Number(m[1]) + 1, rng);
  m = /^(\d+) ou (\d+)$/.exec(expr);
  if (m) return lancer(2, rng) === 1 ? Number(m[1]) : Number(m[2]);
  m = /^(\d)D(\d)$/.exec(expr);
  if (m) return Array.from({ length: Number(m[1]) }, () => lancer(Number(m![2]), rng)).reduce((a, b) => a + b, 0);
  return Number(expr) || 1;
};

export const tirerRencontre = (rng?: Rng, zone: Zone = 'terres-sauvages', niveau = 1): Rencontre => {
  const d20 = lancer(20, rng);
  const ligne = TABLES[zone].ligne(d20);
  return { ligne, d20, table: TABLES[zone].nom, nombre: Math.min(tirerNombre(ligne.nombre, rng), plafondGroupe(ligne, niveau)) };
};

/** Le nom d'un seul membre de la bande : « coyotes affamés » → « Coyote affamé » (l'Aurochs, seul, reste un Aurochs). */
export const singulier = (l: LigneRencontre) => {
  const n = l.nombre === '1' ? l.nom : l.nom.replace(/(\p{L}+)s(?!\p{L})/gu, '$1');
  return n.charAt(0).toUpperCase() + n.slice(1);
};

/** Brigands, orques, ogres et trolls parlent (plus ou moins) : on peut négocier. Les bêtes, on les intimide. */
export const parle = (l: LigneRencontre) => /brigand|orque|ogre|troll|kobold|marchand/i.test(l.nom);

export type Tactique = 'fuir' | 'negocier' | 'intimider';

export const TACTIQUES: Record<Tactique, { libelle: string; carac: 'ad' | 'cha' | 'cou'; nomCarac: string }> = {
  fuir: { libelle: 'Prendre la fuite', carac: 'ad', nomCarac: 'Adresse' },
  negocier: { libelle: 'Négocier', carac: 'cha', nomCarac: 'Charisme' },
  intimider: { libelle: "Faire peur à la bestiole", carac: 'cou', nomCarac: 'Courage' },
};

export const valeurTactique = (p: Partie, t: Tactique) => valeursCombat(p)[TACTIQUES[t].carac];

export interface Coup {
  des: number[];
  degats: number;
  /** Ce qui passe l'armure. */
  blessure: number;
}

export interface Issue {
  epreuve: { de: number; reussi: boolean; valeur: number };
  coups: Coup[];
  perdu: number;
}

/**
 * Résout une rencontre hostile sans combat. En cas d'échec, chaque adversaire (trois au plus,
 * les autres gênent plus qu'ils ne frappent) porte un coup avant que le héros ne s'en sorte.
 */
export const resoudre = (p: Partie, r: Rencontre, tactique: Tactique, rng?: Rng, deLance?: number): Issue => {
  const valeur = valeurTactique(p, tactique);
  const v = valeursCombat(p);
  const e = epreuve(valeur, rng, deLance);
  const coups: Coup[] = [];
  if (!e.reussi) {
    for (let i = 0; i < Math.min(r.nombre, 3); i++) {
      const jet = lancerExpression(r.ligne.degats, rng);
      coups.push({ des: jet.des, degats: jet.total, blessure: Math.max(0, jet.total - v.pr) });
    }
  }
  const perdu = coups.reduce((s, c) => s + c.blessure, 0);
  p.ev -= perdu;
  return { epreuve: { ...e, valeur }, coups, perdu };
};
