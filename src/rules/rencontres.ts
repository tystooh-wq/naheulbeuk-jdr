import { aTalent, bonusSituation } from './talents';
import { calculerFiche } from './creation';
import { CREATURES } from './bestiaire';
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
  /** Assauts d'approche avant le contact : le temps de tirer ou de lancer des sorts (2 par défaut). */
  approche?: number;
  /** Autres adversaires du même combat (un chef et ses sbires, dans un donjon). */
  avec?: { ligne: LigneRencontre; nombre: number }[];
  /** Combattent du côté du héros (des elfes en difficulté…). */
  allies?: { ligne: LigneRencontre; nombre: number }[];
  /** Les adversaires attaquent par surprise : ils frappent les premiers, déjà au contact. */
  surprise?: boolean;
  /** Des créatures pensantes : le héros peut se rendre (il finit au cachot plutôt que mort). */
  reddition?: boolean;
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
  // On voit venir l'ennemi de plus loin en terrain découvert qu'en forêt.
  return { ligne, d20, table: TABLES[zone].nom, approche: zone === 'foret' ? 2 : 3, nombre: Math.min(tirerNombre(ligne.nombre, rng), plafondGroupe(ligne, niveau)) };
};

/** Le nom d'un seul membre de la bande : « coyotes affamés » → « Coyote affamé » (l'Aurochs, seul, reste un Aurochs). */
export const singulier = (l: LigneRencontre) => {
  const n = l.nombre === '1' ? l.nom : l.nom.replace(/(\p{L}+)s(?!\p{L})/gu, '$1');
  return n.charAt(0).toUpperCase() + n.slice(1);
};

/** Brigands, orques, ogres et trolls parlent (plus ou moins) : on peut négocier. Les bêtes, on les intimide. */
export const parle = (l: LigneRencontre) => /brigand|orque|ogre|troll|kobold|marchand/i.test(l.nom);

export type Tactique = 'fuir' | 'negocier' | 'intimider' | 'menacer' | 'embrouiller';

export const TACTIQUES: Record<Tactique, { libelle: string; carac: 'ad' | 'cha' | 'cou' | 'int'; nomCarac: string }> = {
  fuir: { libelle: 'Prendre la fuite', carac: 'ad', nomCarac: 'Adresse' },
  negocier: { libelle: 'Négocier', carac: 'cha', nomCarac: 'Charisme' },
  intimider: { libelle: "Faire peur à la bestiole", carac: 'cou', nomCarac: 'Courage' },
  // Compétence Intimider : faire fuir, au Charisme, un adversaire moins courageux que soi.
  menacer: { libelle: 'Intimider', carac: 'cha', nomCarac: 'Charisme' },
  // Idée de Sedy : noyer une brute simplette sous la philosophie (« être ou ne pas être ») et filer.
  embrouiller: { libelle: "L'embrouiller avec de la philosophie", carac: 'int', nomCarac: 'Intelligence' },
};

/** Les adversaires assez simplets pour se laisser embrouiller. */
export const embrouillable = (l: LigneRencontre) => /débile|crétin|abruti/i.test(l.nom);

/** Les tactiques possibles face à cette rencontre, compétences comprises. */
export const tactiquesPossibles = (p: Partie, l: LigneRencontre): Tactique[] => [
  'fuir',
  parle(l) ? 'negocier' : 'intimider',
  ...(aTalent(p, 'Intimider') && valeursCombat(p).cou > l.cou ? (['menacer'] as Tactique[]) : []),
  ...(embrouillable(l) ? (['embrouiller'] as Tactique[]) : []),
];

/** Bonus des compétences pour cette tactique (Fariboles pour négocier…). */
export const bonusTactique = (p: Partie, t: Tactique) =>
  t === 'negocier' ? bonusSituation(p, 'negocier') : t === 'embrouiller' ? { total: -1, details: ['−1 : il faut tenir le fil'] } : { total: 0, details: [] };

export const valeurTactique = (p: Partie, t: Tactique) => {
  const k = TACTIQUES[t].carac;
  return (k === 'int' ? calculerFiche(p.perso).caracs.INT : valeursCombat(p)[k]) + bonusTactique(p, t).total;
};

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
  /** Raté : l'adversaire attaque par surprise (il faut combattre). */
  surprise?: boolean;
}

/**
 * Résout une rencontre hostile sans combat. En cas d'échec, chaque adversaire (trois au plus,
 * les autres gênent plus qu'ils ne frappent) porte un coup avant que le héros ne s'en sorte.
 */
export const resoudre = (p: Partie, r: Rencontre, tactique: Tactique, rng?: Rng, deLance?: number): Issue => {
  const valeur = valeurTactique(p, tactique);
  const v = valeursCombat(p);
  const e = epreuve(valeur, rng, deLance);
  // Appel des renforts : on fuit sans prendre de coups.
  if (tactique === 'fuir' && aTalent(p, 'Appel des renforts')) e.reussi = true;
  const coups: Coup[] = [];
  // Embrouiller raté : pas de coups en fuyant, mais l'adversaire, vexé, attaque le premier.
  if (!e.reussi && tactique === 'embrouiller') return { epreuve: { ...e, valeur }, coups, perdu: 0, surprise: true };
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

const nombreDe = (t: string, defaut = 0) => Number(/\d+/.exec(t)?.[0] ?? defaut);

/**
 * Un adversaire par son nom, pour les idées des joueurs : d'abord les tables de rencontres
 * (stats prêtes pour le combat), sinon le bestiaire (les « 10 à 60 » prennent la première valeur).
 */
export const ligneEnnemi = (nom: string): LigneRencontre | null => {
  const t = [...TABLE_TERRES_SAUVAGES, ...TABLE_FORET].find((l) => l.nom === nom);
  if (t) return t;
  const c = CREATURES.find((x) => x.nom === nom);
  if (!c) return null;
  return {
    d20: 0,
    rencontre: c.nom,
    nombre: '1',
    nom: c.nom,
    at: nombreDe(c.at, 8),
    prd: nombreDe(c.prd, 0),
    ev: Math.max(1, nombreDe(c.ev, 10)),
    pr: nombreDe(c.pr, 0),
    degats: /\d*D[+-]?\d*/.exec(c.degats)?.[0] ?? '1D',
    cou: nombreDe(c.cou, 10),
    xp: nombreDe(c.xp, 5),
    notes: c.notes.join(' '),
  };
};

/** Tous les adversaires qu'on peut choisir dans une idée : tables de rencontres puis bestiaire. */
export const nomsEnnemis = (): string[] => [...new Set([...TABLE_TERRES_SAUVAGES, ...TABLE_FORET].map((l) => l.nom).concat(CREATURES.map((c) => c.nom)))];
