import { calculerFiche } from './creation';
import { lancer, type Rng } from './des';
import { lancerExpression, valeursCombat, type Partie } from './partie';
import { singulier, type Rencontre } from './rencontres';
import { fouiller, type Fouille } from './butin';

// Combat au contact, règles V4 (chapitres 8 et 10) :
// - initiative : le plus grand Courage frappe le premier, l'Adresse départage, « Chercher des noises » passe devant ;
// - un Assaut : chacun attaque une fois (D20 ≤ AT) et ne peut parer (D20 ≤ PRD) ou esquiver (D20 ≤ AD) qu'une fois ;
// - dégâts au D6 moins la Protection, sauf sur une attaque critique ;
// - 1 au D20 : critique, 20 : maladresse. Les tables de l'écran du MJ sont simplifiées ici (voir `maladresse`) ;
// - un héros seul ne peut avoir que trois ennemis au contact, les autres attendent derrière ;
// - un monstre à 3 PV ou moins peut paniquer et s'enfuir (il rapporte quand même son XP).

export type Camp = 'heros' | 'ennemi';
export type Etat = 'actif' | 'reserve' | 'mort' | 'fui';
export type ModeDefense = 'parade' | 'esquive';

export interface Combattant {
  id: string;
  nom: string;
  camp: Camp;
  at: number;
  prd: number;
  ad: number;
  pr: number;
  cou: number;
  degats: string;
  ev: number;
  evMax: number;
  xp: number;
  etat: Etat;
  /** Ses coups ne se parent pas : il faut les esquiver (« Parade impossible »). */
  imparable?: boolean;
  /** Ne peut pas parer (héros à mains nues, sans Bourre-pif) : seulement esquiver. */
  sansParade?: boolean;
  /** Poison : si le coup passe l'armure, +1D6. */
  poison?: boolean;
  /** Assauts d'attaque à rater (après une esquive, une maladresse…). */
  rate: number;
  /** A déjà paré ou esquivé pendant cet assaut. */
  defendu: boolean;
  /** Ennemi armé d'un arc ou d'une arbalète : il tire pendant l'approche. */
  tireur?: { ad: number; degats: string };
}

export type IssueJet = 'critique' | 'reussi' | 'rate' | 'maladresse';

export interface Defense {
  mode: ModeDefense;
  de: number;
  valeur: number;
  issue: IssueJet;
}

export interface Action {
  attaquant: string;
  cible: string;
  de: number;
  valeur: number;
  issue: IssueJet;
  defense?: Defense;
  /** Pourquoi la cible n'a pas pu se défendre. */
  sansDefense?: string;
  degats?: { des: number[]; total: number; pr: number; blessure: number; poison?: number[] };
  /** Conséquences des critiques et maladresses, en clair. */
  effets: string[];
  /** Un tir (arc, arbalète, arme de jet) plutôt qu'un coup au contact. */
  tir?: boolean;
  /** Les dégâts d'un sort. */
  sort?: boolean;
}

export interface Combat {
  combattants: Combattant[];
  /** Ordre d'initiative (identifiants). */
  ordre: string[];
  tour: number;
  assaut: number;
  journal: string[];
  fin?: 'victoire' | 'defaite' | 'fuite';
  /** Assauts avant que les ennemis n'arrivent au contact : on peut tirer ou lancer des sorts. */
  distance: number;
  /** Assauts avant que l'arme à distance du héros soit rechargée. */
  recharge: number;
  /** L'arme de jet du héros est partie (on la ramasse après une victoire). */
  armeLancee?: boolean;
  /** Projectiles tirés par le héros (identifiants d'objets). */
  projectiles: string[];
}

export const AU_CONTACT = 3;

const aCompetence = (p: Partie, nom: string) => {
  const c = calculerFiche(p.perso).competences;
  return [...c.naissance, ...c.heritees, ...c.choisies].some((n) => n.toLowerCase() === nom.toLowerCase());
};

/** Esquive, modificateurs conseillés sur l'Adresse selon la PR (règles V4, 8.18). Null : impossible. */
export const modEsquive = (pr: number): number | null =>
  pr <= 1 ? 1 : pr === 2 ? 0 : pr <= 4 ? -2 : pr === 5 ? -4 : pr === 6 ? -5 : pr === 7 ? -6 : null;

export const creerHeros = (p: Partie): Combattant => {
  const v = valeursCombat(p);
  const armee = !!p.equipe.arme;
  const bourrePif = aCompetence(p, 'Bourre-pif');
  return {
    id: 'heros',
    nom: p.perso.nom,
    camp: 'heros',
    // À mains nues (8.10) : AT −4 et 1D−2 de dégâts, sauf avec Bourre-pif (1D + bonus de FO).
    at: armee || bourrePif ? v.at : v.at - 4,
    prd: v.prd,
    ad: v.ad,
    pr: v.pr,
    cou: v.cou,
    degats: armee ? v.degats : bourrePif ? v.degats.replace(/^1D-2/, '1D') : v.degats,
    ev: p.ev,
    evMax: calculerFiche(p.perso).ev,
    xp: 0,
    etat: 'actif',
    sansParade: !armee,
    rate: 0,
    defendu: false,
  };
};

/** « Armé d'un arc et d'une dague - AD 11 », « Arc : 1D+3, AD : 9 » : un tireur, avec son Adresse et ses dégâts au tir. */
const tireurDe = (notes: string, degats: string, ad: number) => {
  if (!/\barc\b|arbalète/i.test(notes)) return undefined;
  const d = /Arc\s*:\s*(\d*D[+-]?\d*)/i.exec(notes)?.[1];
  const a = Number(/AD\s*:?\s*(\d+)/.exec(notes)?.[1] ?? ad);
  return { ad: a, degats: d ?? degats.replace('*', '') };
};

export const creerEnnemis = (r: Rencontre): Combattant[] => {
  const groupes = [{ ligne: r.ligne, nombre: r.nombre }, ...(r.avec ?? [])];
  const tous = groupes.flatMap(({ ligne: l, nombre }) => {
    const ad = Number(/AD (\d+)/.exec(l.notes)?.[1] ?? 10);
    const base = singulier(l);
    return Array.from({ length: nombre }, (_, i) => ({
      nom: nombre > 1 ? `${base} ${i + 1}` : base,
      camp: 'ennemi' as Camp,
      at: l.at,
      prd: l.prd,
      ad,
      pr: l.pr,
      cou: l.cou,
      degats: l.degats.replace('*', ''),
      ev: l.ev,
      evMax: l.ev,
      xp: l.xp,
        imparable: /parade impossible/i.test(l.notes),
      poison: /poison/i.test(l.notes),
      tireur: tireurDe(l.notes, l.degats, ad),
      rate: 0,
      defendu: false,
    }));
  });
  return tous.map((c, i) => ({ ...c, id: `e${i + 1}`, etat: (i < AU_CONTACT ? 'actif' : 'reserve') as Etat }));
};

/** Ordre d'initiative : Courage, puis Adresse ; le héros qui cherche des noises frappe toujours le premier. */
export const initiative = (cs: Combattant[], noises = false): string[] =>
  [...cs]
    .sort((a, b) => {
      if (noises && (a.camp === 'heros') !== (b.camp === 'heros')) return a.camp === 'heros' ? -1 : 1;
      return b.cou - a.cou || b.ad - a.ad || (a.camp === 'heros' ? -1 : b.camp === 'heros' ? 1 : 0);
    })
    .map((c) => c.id);

export const creerCombat = (p: Partie, r: Rencontre): Combat => {
  const combattants = [creerHeros(p), ...creerEnnemis(r)];
  const c: Combat = {
    combattants,
    ordre: initiative(combattants, aCompetence(p, 'Chercher des noises')),
    tour: 0,
    assaut: 1,
    journal: [],
    distance: r.approche ?? 2,
    recharge: 0,
    projectiles: [],
  };
  return c;
};

export const combattant = (c: Combat, id: string) => c.combattants.find((x) => x.id === id)!;
export const heros = (c: Combat) => combattant(c, 'heros');
export const ennemis = (c: Combat) => c.combattants.filter((x) => x.camp === 'ennemi');
export const auContact = (c: Combat) => ennemis(c).filter((x) => x.etat === 'actif');
export const acteur = (c: Combat) => combattant(c, c.ordre[c.tour]);

const jet = (de: number, valeur: number): IssueJet =>
  de === 1 ? 'critique' : de === 20 ? 'maladresse' : de <= valeur ? 'reussi' : 'rate';

/** Valeur de défense, ou null si ce mode est impossible contre cet attaquant. */
export const valeurDefense = (cible: Combattant, mode: ModeDefense, attaquant?: Combattant): number | null => {
  if (mode === 'esquive') {
    const m = modEsquive(cible.pr);
    return m === null ? null : cible.ad + m;
  }
  if (cible.sansParade || attaquant?.imparable) return null;
  return cible.prd;
};

/** La cible peut-elle encore se défendre de ce coup (ni critique, ni déjà défendue cet assaut) ? */
export const peutSeDefendre = (cible: Combattant, deAttaque: number, valeurAttaque: number) =>
  !cible.defendu && jet(deAttaque, valeurAttaque) === 'reussi';

/**
 * Table de maladresse simplifiée (D6), en attendant les tables de l'écran du MJ :
 * 1-2 rien de grave, 3-4 déséquilibré (rate le prochain assaut), 5 se blesse (1D6), 6 se blesse gravement (1D6+2).
 */
export const maladresse = (c: Combattant, rng?: Rng): string => {
  const d = lancer(6, rng);
  if (d <= 2) return `${c.nom} trébuche, mais se rattrape (maladresse, D6 : ${d}).`;
  if (d <= 4) {
    c.rate += 1;
    return `${c.nom} perd l'équilibre et ratera son prochain assaut (maladresse, D6 : ${d}).`;
  }
  const b = lancerExpression(d === 5 ? '1D' : '1D+2', rng).total;
  c.ev -= b;
  return `${c.nom} se blesse avec sa propre arme : −${b} PV (maladresse, D6 : ${d}).`;
};

/**
 * Résout une attaque. Le dé d'attaque est fourni (celui du joueur, ou celui tiré pour le monstre) ;
 * la défense aussi quand c'est le joueur qui la lance, sinon elle est tirée ici.
 */
export const attaquer = (
  c: Combat,
  idAttaquant: string,
  idCible: string,
  de: number,
  options: { defense?: { mode: ModeDefense; de: number }; encaisser?: boolean; rng?: Rng; desDegats?: number[] } = {},
): Action => {
  const a = combattant(c, idAttaquant);
  const cible = combattant(c, idCible);
  const { rng } = options;
  const action: Action = { attaquant: a.id, cible: cible.id, de, valeur: a.at, issue: jet(de, a.at), effets: [] };

  if (action.issue === 'rate') return action;
  if (action.issue === 'maladresse') {
    action.effets.push(maladresse(a, rng));
    return action;
  }

  const critique = action.issue === 'critique';
  if (critique) action.sansDefense = 'attaque critique, impossible à parer';
  else if (cible.defendu) action.sansDefense = 'déjà occupé à se défendre pendant cet assaut';
  // Encaisser : on serre les dents sans parer ni esquiver, mais on garde son attaque suivante.
  else if (options.encaisser) action.sansDefense = 'encaisse le coup en serrant les dents';
  else {
    // Les monstres parent ; ceux qui ne le peuvent pas (PRD nulle) esquivent comme ils peuvent.
    const mode: ModeDefense = options.defense?.mode ?? (valeurDefense(cible, 'parade', a) === null ? 'esquive' : 'parade');
    const valeur = valeurDefense(cible, mode, a);
    if (valeur === null) action.sansDefense = mode === 'parade' ? 'impossible de parer' : "trop d'armure pour esquiver";
    else {
      const d = options.defense?.de ?? lancer(20, rng);
      const issue = jet(d, valeur);
      action.defense = { mode, de: d, valeur, issue };
      cible.defendu = true;
      if (mode === 'esquive' && issue !== 'critique') cible.rate = Math.max(cible.rate, 1);
      if (issue === 'critique' && mode === 'parade') {
        a.rate += 1;
        action.effets.push(`Parade critique ! ${a.nom} est déséquilibré et ratera son prochain assaut.`);
      }
      if (issue === 'critique' && mode === 'esquive') action.effets.push(`Esquive critique : ${cible.nom} reste au contact et pourra attaquer.`);
      if (issue === 'maladresse') action.effets.push(maladresse(cible, rng));
      if (issue === 'critique' || issue === 'reussi') return action;
    }
  }

  // Dégâts : au D6, moins la PR (pas sur une attaque critique).
  const j = options.desDegats ? { des: options.desDegats, total: 0 } : lancerExpression(a.degats, rng);
  if (options.desDegats) {
    const fixe = Number(/[+-]\d+$/.exec(a.degats)?.[0] ?? 0);
    j.total = Math.max(0, options.desDegats.reduce((s, x) => s + x, 0) + fixe);
  }
  const pr = critique ? 0 : cible.pr;
  const blessure = Math.max(0, j.total - pr);
  action.degats = { des: j.des, total: j.total, pr, blessure };
  if (a.poison && blessure > 0) {
    const poison = lancerExpression('1D', rng);
    action.degats.poison = poison.des;
    action.degats.blessure += poison.total;
  }
  cible.ev -= action.degats.blessure;
  return action;
};

/** Met à jour les morts, fait monter les ennemis de réserve au contact et détecte la fin du combat. */
export const verifier = (c: Combat) => {
  for (const x of c.combattants) {
    if (x.ev <= 0 && (x.etat === 'actif' || x.etat === 'reserve')) {
      x.ev = 0;
      x.etat = 'mort';
      if (x.camp === 'ennemi') c.journal.push(`${x.nom} s'effondre.`);
    }
  }
  const reserve = ennemis(c).filter((x) => x.etat === 'reserve');
  while (auContact(c).length < AU_CONTACT && reserve.length) {
    const r = reserve.shift()!;
    r.etat = 'actif';
    c.journal.push(`${r.nom} s'avance au contact.`);
  }
  if (heros(c).etat === 'mort') c.fin = 'defaite';
  else if (!ennemis(c).some((x) => x.etat === 'actif' || x.etat === 'reserve')) c.fin = 'victoire';
};

/** Passe au combattant suivant ; un nouvel assaut remet les défenses à zéro. */
export const tourSuivant = (c: Combat) => {
  c.tour += 1;
  if (c.tour >= c.ordre.length) {
    c.tour = 0;
    c.assaut += 1;
    c.combattants.forEach((x) => (x.defendu = false));
    c.recharge = Math.max(0, c.recharge - 1);
    if (c.distance > 0) {
      c.distance -= 1;
      c.journal.push(c.distance ? `Les ennemis approchent : contact dans ${c.distance} assaut${c.distance > 1 ? 's' : ''}.` : 'Les ennemis arrivent au contact !');
    }
  }
};

/** Le héros fonce au contact : fini les tirs, place au corps à corps. */
export const charger = (c: Combat) => {
  c.distance = 0;
  c.journal.push(`${heros(c).nom} charge !`);
};

/**
 * Un tir (règles V4, 8.11) : épreuve d'Adresse du tireur. Pas de parade possible sans bouclier ;
 * critique : l'armure est ignorée, comme au contact ; maladresse : table de maladresse du jeu.
 */
export const tirer = (
  c: Combat,
  idTireur: string,
  idCible: string,
  de: number,
  tir: { ad: number; degats: string },
  options: { rng?: Rng; desDegats?: number[] } = {},
): Action => {
  const a = combattant(c, idTireur);
  const cible = combattant(c, idCible);
  const action: Action = { attaquant: a.id, cible: cible.id, de, valeur: tir.ad, issue: jet(de, tir.ad), effets: [], tir: true };
  if (action.issue === 'rate') return action;
  if (action.issue === 'maladresse') {
    action.effets.push(maladresse(a, options.rng));
    return action;
  }
  const critique = action.issue === 'critique';
  action.sansDefense = critique ? 'tir critique, en plein dans le mille' : 'on ne pare pas un projectile sans bouclier';
  const j = options.desDegats ? { des: options.desDegats, total: 0 } : lancerExpression(tir.degats, options.rng);
  if (options.desDegats) j.total = Math.max(0, options.desDegats.reduce((s, x) => s + x, 0) + Number(/[+-]\d+$/.exec(tir.degats)?.[0] ?? 0));
  const pr = critique ? 0 : cible.pr;
  const blessure = Math.max(0, j.total - pr);
  action.degats = { des: j.des, total: j.total, pr, blessure };
  cible.ev -= blessure;
  return action;
};

/** Dégâts d'un sort sur une cible : au D6, doublés sur une réussite critique, moins l'armure. */
export const toucherParSort = (c: Combat, idCible: string, degats: string, critique: boolean, rng?: Rng): Action => {
  const cible = combattant(c, idCible);
  const j = lancerExpression(degats, rng);
  const total = critique ? j.total * 2 : j.total;
  const blessure = Math.max(0, total - cible.pr);
  cible.ev -= blessure;
  return {
    attaquant: 'heros',
    cible: idCible,
    de: 0,
    valeur: 0,
    issue: critique ? 'critique' : 'reussi',
    effets: [],
    sort: true,
    degats: { des: j.des, total, pr: cible.pr, blessure },
  };
};

/** Un monstre très blessé (3 PV ou moins) panique : 1 à 3 sur le D6, il prend la fuite. */
export const panique = (c: Combat, x: Combattant, rng?: Rng): boolean => {
  if (x.camp !== 'ennemi' || x.ev > 3) return false;
  const d = lancer(6, rng);
  if (d > 3) return false;
  x.etat = 'fui';
  c.journal.push(`${x.nom}, en sang, panique et s'enfuit (D6 : ${d}).`);
  verifier(c);
  return true;
};

/** Le héros tente de fuir en plein combat : épreuve d'Adresse. */
export const tenterFuite = (c: Combat, de: number): boolean => {
  const h = heros(c);
  const ok = de === 1 || (de !== 20 && de <= h.ad);
  if (ok) c.fin = 'fuite';
  return ok;
};

export const xpGagnee = (c: Combat) =>
  ennemis(c)
    .filter((x) => x.etat === 'mort' || x.etat === 'fui')
    .reduce((s, x) => s + x.xp, 0);

/** Fouille chaque ennemi resté à terre (ceux qui ont fui emportent leurs affaires). */
export const butin = (c: Combat, rng?: Rng): Fouille[] => ennemis(c).filter((x) => x.etat === 'mort').map((x) => fouiller(x.nom, rng));
