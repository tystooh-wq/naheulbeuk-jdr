import { lancer, type Rng } from './des';
import { lancerExpression } from './partie';

// Butin des combats. Chaque ennemi vaincu (pas ceux qui ont fui) est fouillé : le MJ lance un D20 sur
// la table de sa famille. Les tables sont une proposition du prototype (rien d'officiel) : les humanoïdes
// portent un peu d'or et leur équipement, les bêtes laissent des trophées à revendre.

export interface Lot {
  /** Résultat maximal du D20 pour ce lot (les lots sont rangés dans l'ordre). */
  jusqua: number;
  objet?: string;
  /** Pièces d'or (expression de dés). */
  or?: string;
}

export interface TableButin {
  famille: string;
  motif: RegExp;
  /** Or toujours trouvé sur chaque corps, en plus du tirage. */
  bourse?: string;
  lots: Lot[];
}

export const TABLES_BUTIN: TableButin[] = [
  { famille: 'Marchand', motif: /marchand/i, lots: [{ jusqua: 20 }] },
  {
    famille: 'Brigands',
    motif: /brigand/i,
    bourse: '1D',
    lots: [
      { jusqua: 7 },
      { jusqua: 10, objet: 'rations' },
      { jusqua: 12, objet: 'dague-base' },
      { jusqua: 14, objet: 'epee-perrave' },
      { jusqua: 15, objet: 'bottes-de-cuir-minables' },
      { jusqua: 16, objet: 'casque-de-cuir' },
      { jusqua: 17, objet: 'vetements-rembourres' },
      { jusqua: 18, objet: 'potion-plaies' },
      { jusqua: 19, objet: 'potion-soin' },
      { jusqua: 20, or: '3D+5' },
    ],
  },
  {
    famille: 'Archers',
    motif: /archer/i,
    bourse: '1D',
    lots: [
      { jusqua: 6 },
      { jusqua: 10, objet: 'fleche-de-base' },
      { jusqua: 14, objet: 'dague-base' },
      { jusqua: 17, objet: 'arc-court-de-basse-qualite' },
      { jusqua: 19, objet: 'potion-soin' },
      { jusqua: 20, objet: 'arc-court-de-qualite-correcte' },
    ],
  },
  {
    famille: 'Orques',
    motif: /orque/i,
    bourse: 'D3',
    lots: [
      { jusqua: 8 },
      { jusqua: 12, objet: 'gri-gri-orque' },
      { jusqua: 15, objet: 'hache-1-main-daubesque' },
      { jusqua: 17, objet: 'casque-de-cuir' },
      { jusqua: 19, objet: 'rations' },
      { jusqua: 20, objet: 'potion-soin' },
    ],
  },
  {
    famille: 'Gobelins',
    motif: /gobelin/i,
    bourse: 'D3',
    lots: [
      { jusqua: 8 },
      { jusqua: 13, objet: 'babiole-gobeline' },
      { jusqua: 16, objet: 'couteau-de-poche-du-grand-pere' },
      { jusqua: 18, objet: 'arbalete-de-gobelin' },
      { jusqua: 20, objet: 'potion-soin' },
    ],
  },
  {
    famille: 'Ogres et trolls',
    motif: /ogre|troll/i,
    bourse: '2D',
    lots: [
      { jusqua: 8 },
      { jusqua: 14, objet: 'dent-ogre' },
      { jusqua: 17, objet: 'pagne-de-cuir-solide' },
      { jusqua: 19, objet: 'grand-casque-du-bourreau-tete' },
      { jusqua: 20, objet: 'potion-soin-forte' },
    ],
  },
  { famille: 'Coyotes', motif: /coyote/i, lots: [{ jusqua: 10 }, { jusqua: 20, objet: 'peau-coyote' }] },
  { famille: 'Rats', motif: /rat/i, lots: [{ jusqua: 14 }, { jusqua: 20, objet: 'queue-rat' }] },
  { famille: 'Scorpions', motif: /scorpion/i, lots: [{ jusqua: 8 }, { jusqua: 20, objet: 'dard-scorpion' }] },
  { famille: 'Boucs', motif: /bouc/i, lots: [{ jusqua: 6 }, { jusqua: 20, objet: 'corne-bouc' }] },
  { famille: 'Cochons mutants', motif: /cochon/i, lots: [{ jusqua: 4 }, { jusqua: 20, objet: 'jambon-mutant' }] },
  { famille: 'Chapons', motif: /chapon/i, lots: [{ jusqua: 4 }, { jusqua: 17, objet: 'plumes-chapon' }, { jusqua: 20, objet: 'oeuf-chapon' }] },
  { famille: 'Aurochs', motif: /aurochs/i, lots: [{ jusqua: 5 }, { jusqua: 20, objet: 'cuir-aurochs' }] },
  { famille: 'Brebiphants', motif: /brebiphant/i, lots: [{ jusqua: 5 }, { jusqua: 20, objet: 'laine-brebiphant' }] },
  { famille: 'Dantragors', motif: /dantragor/i, lots: [{ jusqua: 8 }, { jusqua: 20, objet: 'musc-dantragor' }] },
  { famille: 'Morshlegs', motif: /morshleg/i, lots: [{ jusqua: 5 }, { jusqua: 20, objet: 'fourrure-morshleg' }] },
  { famille: 'Dragons', motif: /dragon/i, bourse: '3D', lots: [{ jusqua: 6 }, { jusqua: 18, objet: 'ecaille-dragon' }, { jusqua: 20, or: '1D*10' }] },
];

export const tableButin = (nom: string) => TABLES_BUTIN.find((t) => t.motif.test(nom));

export interface Fouille {
  ennemi: string;
  de?: number;
  or: number;
  objet?: string;
  /** Fouiller dans les poubelles : deux D20, le meilleur gardé. */
  poubelles?: boolean;
}

const tirerOr = (expr: string, rng?: Rng) => {
  if (expr === 'D3') return lancer(3, rng);
  const [e, fois] = expr.split('*');
  return lancerExpression(e, rng).total * Number(fois ?? 1);
};

/** Fouille un ennemi vaincu : sa bourse, puis le D20 du MJ sur la table de sa famille. */
export const fouiller = (nom: string, rng?: Rng): Fouille => {
  const t = tableButin(nom);
  if (!t) return { ennemi: nom, or: 0 };
  const de = lancer(20, rng);
  const lot: Partial<Lot> = t.lots.find((l) => de <= l.jusqua) ?? {};
  const or = (t.bourse ? tirerOr(t.bourse, rng) : 0) + (lot.or ? tirerOr(lot.or, rng) : 0);
  return { ennemi: nom, de, or, objet: lot.objet };
};
