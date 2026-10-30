import { calculerFiche } from './creation';
import { lancer, type Rng } from './des';
import { evMax, lancerExpression, niveau, type Partie } from './partie';

// La magie (« Règles concernant la Magie fanghienne », v3.2) :
// - chaque sort coûte des points astraux (PA), pris dans l'énergie astrale (EA) du mage ;
// - on lance le sort par une épreuve sur MagiePhys (moyenne INT/AD, arrondie au-dessus) ou INT, avec un bonus ou un malus ;
// - 1 : réussite critique, effets doublés ; échec : on perd la moitié des PA (au moins 1) ; 20 : maladresse ;
// - +1 aux dégâts des sorts par point d'INTELLIGENCE au-dessus de 12 (selon le sort) ;
// - l'EA revient en se reposant : 2, 3 ou 4 PA par heure selon le confort.
//
// Les sorts de la spécialité « Combat » ci-dessous sont ceux que les règles décrivent en exemple
// (le grimoire de combat n'est pas dans les ressources) ; les autres viennent du grimoire généraliste.

export type CaracMagie = 'MagiePhys' | 'MagiePsy' | 'INT';

export interface Sort {
  id: string;
  nom: string;
  niveau: number;
  ecole: string;
  cout: number;
  carac: CaracMagie;
  modif: number;
  /** Dégâts au D6 sur une cible, ou sur chaque ennemi (zone). */
  degats?: string;
  zone?: boolean;
  /** Ajoute le bonus d'INTELLIGENCE aux dégâts. */
  bonusInt?: boolean;
  /** Soin hors combat : 1 PA par PV, au plus 1D6 PV, sans épreuve. */
  soin?: boolean;
  enCombat: boolean;
  description: string;
}

export const SORTS: Sort[] = [
  {
    id: 'boule-de-feu-mineure',
    nom: 'Boule de feu mineure',
    niveau: 1,
    ecole: 'Magie de combat',
    cout: 2,
    carac: 'MagiePhys',
    modif: 3,
    degats: '1D+1',
    bonusInt: true,
    enCombat: true,
    description: "Une petite boule de feu lancée en un assaut. Épreuve MagiePhys+3, 2 PA, dégâts 1D+1 (+ bonus d'INT), moins l'armure.",
  },
  {
    id: 'tourbillon-de-wazaa',
    nom: 'Tourbillon de Wazaa',
    niveau: 1,
    ecole: 'Magie de combat',
    cout: 10,
    carac: 'MagiePhys',
    modif: 0,
    degats: '2D+2',
    zone: true,
    enCombat: true,
    description: 'Un tourbillon qui frappe toute une bande. Épreuve MagiePhys, 10 PA, 2D+2 à chaque ennemi au contact.',
  },
  {
    id: 'soin-blessures-legeres',
    nom: 'Soin des blessures légères',
    niveau: 1,
    ecole: 'Magie généraliste',
    cout: 0,
    carac: 'INT',
    modif: 0,
    soin: true,
    enCombat: false,
    description: "Hors combat. 1 PA donne 1 PV, au plus 1D6 PV ; pas d'épreuve, mais pas plus de deux soins par heure.",
  },
];

export const sort = (id: string) => SORTS.find((s) => s.id === id)!;

/** Le héros pratique-t-il la magie des mages ? (Prêtres et paladins : prodiges, à venir.) */
export const estMage = (p: Partie) => calculerFiche(p.perso).metier.id === 'mage';

export const eaMax = (p: Partie) => calculerFiche(p.perso).ea;

/** Énergie astrale actuelle (les vieilles sauvegardes n'en ont pas : réservoir plein). */
export const ea = (p: Partie) => p.ea ?? eaMax(p);

export const caracMagie = (p: Partie, c: CaracMagie) => {
  const k = calculerFiche(p.perso).caracs;
  if (c === 'INT') return k.INT;
  return Math.ceil((k.INT + (c === 'MagiePhys' ? k.AD : k.CHA)) / 2);
};

export const bonusInt = (p: Partie) => Math.max(0, calculerFiche(p.perso).caracs.INT - 12);

export const sortsConnus = (p: Partie) => (estMage(p) ? SORTS.filter((s) => s.niveau <= niveau(p)) : []);

export const valeurSort = (p: Partie, s: Sort) => caracMagie(p, s.carac) + s.modif;

export const degatsSort = (p: Partie, s: Sort) => {
  if (!s.degats) return '';
  const [des, fixe] = s.degats.split(/(?=[+-])/);
  const total = Number(fixe ?? 0) + (s.bonusInt ? bonusInt(p) : 0);
  return `${des}${total ? `+${total}` : ''}`;
};

export interface LancementSort {
  issue: 'critique' | 'reussi' | 'rate' | 'maladresse';
  /** PA réellement dépensés. */
  cout: number;
  texte: string;
  /** Blessure au lanceur sur une maladresse. */
  blessure?: number;
}

/**
 * Lance un sort avec le dé du joueur et paie son coût. Les dégâts se tirent ensuite.
 * Maladresse : la table générique « Maladresse au lancement du sort » manque, on applique
 * une version simple : tous les PA sont perdus et le sort explose au visage du mage (1D).
 */
export const lancerSort = (p: Partie, s: Sort, de: number, rng?: Rng): LancementSort | string => {
  if (ea(p) < s.cout) return `Pas assez d'énergie astrale (${ea(p)} PA, il en faut ${s.cout}).`;
  const valeur = valeurSort(p, s);
  const issue = de === 1 ? 'critique' : de === 20 ? 'maladresse' : de <= valeur ? 'reussi' : 'rate';
  const cout = issue === 'rate' ? Math.max(1, Math.floor(s.cout / 2)) : s.cout;
  p.ea = ea(p) - cout;
  if (issue === 'maladresse') {
    const b = lancerExpression('1D', rng).total;
    p.ev -= b;
    return { issue, cout, blessure: b, texte: `Maladresse ! Le sort explose au visage du mage : −${b} PV, et ${cout} PA perdus.` };
  }
  if (issue === 'rate') return { issue, cout, texte: `L'incantation échoue : la moitié des PA est perdue (${cout} PA).` };
  return { issue, cout, texte: issue === 'critique' ? 'Réussite critique : les effets sont doublés !' : 'Le sort part.' };
};

/** Soin des blessures légères : 1 PA par PV, au plus 1D6 (tiré ici), deux fois par heure au plus. */
export const soinLeger = (p: Partie, rng?: Rng): { rendu: number; de: number } | string => {
  const s = sort('soin-blessures-legeres');
  if (!sortsConnus(p).includes(s)) return 'Tu ne connais pas ce sort.';
  const manque = evMax(p) - p.ev;
  if (manque <= 0) return 'Tu es en pleine forme.';
  if (ea(p) <= 0) return "Plus d'énergie astrale.";
  const recents = (p.soinsMagiques ?? []).filter((t) => p.jour * 24 + p.heure - t < 1);
  if (recents.length >= 2) return 'Deux soins dans l\'heure, c\'est le maximum : attends un peu, sinon gare aux complications.';
  const de = lancer(6, rng);
  const rendu = Math.min(de, manque, ea(p));
  p.ea = ea(p) - rendu;
  p.ev += rendu;
  p.soinsMagiques = [...recents, p.jour * 24 + p.heure];
  return { rendu, de };
};
