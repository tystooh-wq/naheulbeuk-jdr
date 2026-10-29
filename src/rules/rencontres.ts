import TABLE from './rencontres-terres-sauvages.json';
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

export interface Rencontre {
  ligne: LigneRencontre;
  nombre: number;
  d20: number;
}

export const tirerNombre = (expr: string, rng?: Rng): number => {
  let m = /^(\d+) à (\d+)$/.exec(expr);
  if (m) return Number(m[1]) - 1 + lancer(Number(m[2]) - Number(m[1]) + 1, rng);
  m = /^(\d+) ou (\d+)$/.exec(expr);
  if (m) return lancer(2, rng) === 1 ? Number(m[1]) : Number(m[2]);
  m = /^(\d)D(\d)$/.exec(expr);
  if (m) return Array.from({ length: Number(m[1]) }, () => lancer(Number(m![2]), rng)).reduce((a, b) => a + b, 0);
  return Number(expr) || 1;
};

export const tirerRencontre = (rng?: Rng): Rencontre => {
  const d20 = lancer(20, rng);
  const ligne = TABLE_TERRES_SAUVAGES[d20 - 1];
  return { ligne, d20, nombre: tirerNombre(ligne.nombre, rng) };
};

/** Brigands, orques, ogres et trolls parlent (plus ou moins) : on peut négocier. Les bêtes, on les intimide. */
export const parle = (l: LigneRencontre) => /brigand|orque|ogre|troll/i.test(l.nom);

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
