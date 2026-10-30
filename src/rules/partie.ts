import { calculerFiche, cleCompetence, type Fiche, type Personnage } from './creation';
import { lancer, type Rng } from './des';
import { arrondirOr } from './monnaie';
import type { EtatDonjon } from './donjons';
import { objet, type Objet } from './objets';

// L'état d'une partie en cours : le héros, sa bourse, son sac et où il se trouve.

/** Ce que le héros porte : une arme, et une protection par localisation (règles : pas d'empilement). */
export interface Equipement {
  arme?: string;
  /** Torse, ou armure complète (qui couvre alors tout). */
  armure?: string;
  tete?: string;
  bras?: string;
  jambes?: string;
  mains?: string;
  pieds?: string;
  bouclier?: string;
  /** Arme à distance, portée en plus de l'arme de contact. */
  distance?: string;
}

export type CleEquipement = keyof Equipement;

export const EMPLACEMENTS: [CleEquipement, string][] = [
  ['arme', 'Arme'],
  ['armure', 'Torse'],
  ['tete', 'Tête'],
  ['bras', 'Bras'],
  ['jambes', 'Jambes'],
  ['mains', 'Mains'],
  ['pieds', 'Pieds'],
  ['bouclier', 'Bouclier'],
  ['distance', 'Arme à distance'],
];

/** L'emplacement où va un objet, ou null s'il ne s'équipe pas. */
export const emplacementDe = (o: Objet): CleEquipement | null => {
  if (o.tir) return 'distance';
  if (o.type === 'arme') return 'arme';
  if (o.type !== 'armure') return null;
  const e = o.emplacement ?? 'torse';
  return e === 'torse' || e === 'complete' ? 'armure' : e;
};

const porte = (p: Partie): Objet[] =>
  EMPLACEMENTS.map(([k]) => p.equipe[k])
    .filter((id): id is string => !!id)
    .map(objet);

/** Protection totale : la somme des pièces portées. */
export const protectionTotale = (p: Partie) => porte(p).reduce((s, o) => s + (o.type === 'armure' ? (o.pr ?? 0) : 0), 0);

export type EtatQuete = 'acceptee' | 'terminee';

/** Un voyage en cours sur la carte du monde, interrompu (nuit, rencontre) ou en marche. */
export interface Voyage {
  /** Lieux traversés, du départ à l'arrivée. */
  etapes: string[];
  /** Heures de marche déjà faites depuis le départ. */
  fait: number;
  allure: 'normale' | 'forcee';
  /** Tout droit, sans suivre les pistes. */
  horsPiste?: boolean;
  /** Heure de marche à laquelle le MJ vérifiera s'il se passe quelque chose. */
  prochainControle: number;
}

export interface Partie {
  version: 3;
  perso: Personnage;
  ev: number;
  or: number;
  /** Identifiants d'objets ; un objet possédé deux fois apparaît deux fois. */
  sac: string[];
  equipe: Equipement;
  ville: string;
  lieu: string;
  jour: number;
  /** Heure du jour, de 0 à 24 (avec des fractions). */
  heure: number;
  /** En ville (plan de Waldorg) ou sur la carte du monde. */
  zone: 'ville' | 'monde';
  /** Position sur la carte du monde (ou dernière, quand on est en ville). */
  lieuMonde: string;
  voyage?: Voyage;
  /** Points d'expérience gagnés (absent dans les vieilles sauvegardes). */
  xp?: number;
  /** Points de mauvaise conduite : racket, vol… Le monde finit par s'en souvenir. */
  mauvaiseConduite?: number;
  /** Faits marquants qui peuvent revenir plus tard (« marchand-rackette »…). */
  marques?: string[];
  quetes: Record<string, EtatQuete>;
  /** Étape en cours de chaque quête acceptée. */
  etapesQuetes?: Record<string, number>;
  /** Énergie astrale (mages) ; absente : réservoir plein. */
  ea?: number;
  /** Heures (jour × 24 + heure) des derniers soins magiques, pour la limite de deux par heure. */
  soinsMagiques?: number[];
  /** Dernière utilisation (jour × 24 + heure) de chaque compétence limitée (premiers soins, mendier…). */
  talents?: Record<string, number>;
  /** Bivouac de qualité monté ce soir (compétences de camping) : +2 PV et +4 PA à la nuit. */
  campQualite?: boolean;
  /** Donjon en cours d'exploration. */
  donjon?: EtatDonjon;
  journal: string[];
  /** Le récit d'arrivée a été lu. */
  arrive: boolean;
}

// --- Équipement de départ ----------------------------------------------------

/**
 * Guide de l'équipement, page 1 : le MJ équipe lui-même l'aventurier selon sa classe sociale,
 * sans entamer son pécule. 20-30 PO : paysan dégrossi ; 40-70 : classe moyenne ; au-delà : riche.
 */
export const equipementDepart = (perso: Personnage): { sac: string[]; equipe: Equipement } => {
  const fiche = calculerFiche(perso);
  const classe = perso.or <= 30 ? 'pauvre' : perso.or <= 70 ? 'moyen' : 'riche';
  const base = ['sac', 'briquet', 'couverture', 'gourde', 'chaussettes', 'rations'];
  const m = fiche.metier.id;
  const o = fiche.origine.id;

  let arme: string;
  if (m === 'mage') arme = classe === 'pauvre' ? 'baton-sorcier-perrave' : 'baton-sorcier';
  else if (m === 'menestrel') arme = classe === 'pauvre' ? 'baton' : 'dague-premiere';
  else if (o === 'gnome') arme = 'dague-bleusaille';
  else if (o === 'nain' || o === 'demi-elfe-nain') arme = 'hache-bleusaille';
  else if (classe === 'pauvre') arme = 'gourdin';
  else if (classe === 'moyen') arme = m === 'assassin' || m === 'voleur' ? 'dague-recourbee' : 'glaive-allonge';
  else arme = peutManier(fiche, objet('batarde')) === null && m === 'guerrier' ? 'batarde' : 'glaive-bleusaille';

  const armures = classe === 'pauvre' ? ['vetements-rembourres'] : classe === 'moyen' ? ['veste-cuir'] : ['tenue-eclaireur', 'veste-cuir'];
  const armure = armures.find((a) => peutPorter(fiche, objet(a)) === null);

  const extras: string[] = [];
  if (m === 'voleur') extras.push('outils-crochetage');
  if (m === 'menestrel') extras.push('instrument');
  if (classe !== 'pauvre') extras.push('torche', 'corde');
  if (classe === 'riche') extras.push('potion-soin');
  // Ceux qui savent tirer, et en ont les moyens, partent avec un arc court et dix flèches.
  const tireur = aCompetence(fiche, 'Tirer correctement') && m !== 'mage' && m !== 'menestrel' && classe !== 'pauvre';
  if (tireur) extras.push(...Array.from({ length: 10 }, () => 'fleche-de-base'));

  return {
    sac: [...base, ...extras],
    equipe: { arme: peutManier(fiche, objet(arme)) === null ? arme : 'gourdin', armure, distance: tireur ? 'arc-court-de-qualite-correcte' : undefined },
  };
};

export const nouvellePartie = (perso: Personnage): Partie => {
  const { sac, equipe } = equipementDepart(perso);
  const fiche = calculerFiche(perso);
  return {
    version: 3,
    perso,
    ev: fiche.ev,
    or: perso.or,
    sac,
    equipe,
    ville: 'valtordu',
    lieu: 'porte',
    jour: 1,
    heure: 9,
    zone: 'ville',
    lieuMonde: 'valtordu',
    quetes: {},
    journal: [`Jour 1 : ${perso.nom} arrive à Valtordu avec ${perso.or} pièces d'or.`],
    arrive: false,
  };
};

// --- Règles d'utilisation du matériel ----------------------------------------

const aCompetence = (f: Fiche, nom: string) =>
  [...f.competences.naissance, ...f.competences.heritees, ...f.competences.choisies].some(
    (c) => cleCompetence(c) === cleCompetence(nom),
  );

/** Renvoie la raison pour laquelle le héros ne peut pas manier cette arme, ou null. */
export const peutManier = (f: Fiche, o: Objet): string | null => {
  if (o.type !== 'arme') return null;
  const m = f.metier.id;
  const or = f.origine.id;
  if ((m === 'mage' || m === 'menestrel') && !o.legere) return `Un ${f.metier.nom.toLowerCase()} ne manie que bâton, dague ou gourdin.`;
  if (or === 'gnome' && !o.id.startsWith('dague')) return 'Trop lourd pour un Gnôme : poignards et petites lames uniquement.';
  if (o.mains === 2 && ['haut-elfe', 'elfe-sylvain', 'elfe-noir', 'demi-elfe-noir', 'semi-elfe'].includes(or) && o.bourrin)
    return `Un ${f.origine.nom} refuse les armes de bourrin.`;
  if (o.bourrin && or !== 'nain' && !aCompetence(f, 'Armes de bourrin')) return 'Il faut la compétence « Armes de bourrin ».';
  if (o.bourrin && ['nain', 'semi-homme', 'demi-elfe-nain'].includes(or)) return 'Les armes à 2 mains « humaines » sont trop grandes pour toi.';
  return null;
};

/** Renvoie la raison pour laquelle le héros ne peut pas porter cette armure, ou null. */
export const peutPorter = (f: Fiche, o: Objet, prAilleurs = 0): string | null => {
  if (o.type !== 'armure') return null;
  if (f.prMax !== null && (o.pr ?? 0) + prAilleurs > f.prMax)
    return `Ton armure est limitée à PR ${f.prMax} en tout${prAilleurs ? ` (tu portes déjà PR ${prAilleurs} ailleurs)` : ''}.`;
  if (f.origine.id === 'barbare' && o.id === 'tenue-lourde') return "Un Barbare ne porte pas d'armure complète.";
  return null;
};

// --- Valeurs de combat avec l'équipement -------------------------------------

export interface ValeursCombat {
  at: number;
  prd: number;
  pr: number;
  degats: string;
  cha: number;
  cou: number;
  ad: number;
}

export const valeursCombat = (p: Partie): ValeursCombat => {
  const f = calculerFiche(p.perso);
  const arme = p.equipe.arme ? objet(p.equipe.arme) : undefined;
  const pieces = porte(p);
  // Bric-à-brac : l'armure ne gêne pas la parade (les malus de PRD des pièces portées ne comptent pas).
  const bricABrac = aCompetence(f, 'Bric-à-brac');
  const mod = (k: 'AT' | 'PRD' | 'CHA' | 'COU' | 'AD') =>
    pieces.reduce((s, o) => s + (k === 'PRD' && bricABrac ? Math.max(0, o.mods?.[k] ?? 0) : (o.mods?.[k] ?? 0)), 0);
  // Les Nains manient les armes à une main humaines à deux mains : +1 aux dégâts (livret p. 5).
  const bonusNain = arme && f.origine.id === 'nain' && arme.mains === 1 && !arme.id.startsWith('hache') ? 1 : 0;
  const bonus = f.bonusDegats + bonusNain;
  const base = arme?.degats ?? '1D-2';
  const [des, fixe] = base.split(/(?=[+-])/);
  const total = Number(fixe ?? 0) + bonus;
  return {
    at: f.at + mod('AT'),
    prd: f.prd + mod('PRD'),
    // Truc de mauviette : +1 de protection naturelle.
    pr: protectionTotale(p) + (aCompetence(f, 'Truc de mauviette') ? 1 : 0),
    degats: `${des}${total === 0 ? '' : total > 0 ? `+${total}` : total}`,
    cha: f.caracs.CHA + mod('CHA'),
    cou: f.caracs.COU + mod('COU'),
    ad: f.caracs.AD + mod('AD'),
  };
};

// --- Expérience et niveaux -------------------------------------------------------

/** Table des niveaux (règles V4, 14) : XP nécessaire pour atteindre chaque niveau. */
export const PALIERS_XP = [0, 100, 300, 600, 1000, 1500, 2100, 2800, 3600, 4500, 5500, 6600, 7800, 9100, 10500];

export const niveauPour = (xp: number) => PALIERS_XP.filter((s) => xp >= s).length;

export const niveau = (p: Partie) => p.perso.progression?.niveau ?? 1;

/** Le héros a assez d'XP pour passer au niveau suivant. */
export const niveauEnAttente = (p: Partie) => niveauPour(p.xp ?? 0) > niveau(p);

export type GainNiveau = 'FO' | 'AD' | 'COU' | 'INT' | 'AT' | 'PRD';

/** Ce qu'on peut augmenter au prochain niveau : une caractéristique aux niveaux pairs, AT ou PRD aux impairs. */
export const gainsPossibles = (p: Partie): GainNiveau[] => ((niveau(p) + 1) % 2 === 0 ? ['FO', 'AD', 'COU', 'INT'] : ['AT', 'PRD']);

/** Passe un niveau (règles V4, 15) : +1D6 EV (dé du joueur) et le gain choisi. */
export const monterNiveau = (p: Partie, deEv: number, gain: GainNiveau): string | null => {
  if (!niveauEnAttente(p)) return "Pas assez d'expérience.";
  if (!gainsPossibles(p).includes(gain)) return 'Ce gain ne correspond pas à ce niveau.';
  const prog = p.perso.progression ?? { niveau: 1, ev: 0, caracs: {}, at: 0, prd: 0 };
  prog.niveau += 1;
  prog.ev += deEv;
  if (gain === 'AT') prog.at += 1;
  else if (gain === 'PRD') prog.prd += 1;
  else prog.caracs[gain] = (prog.caracs[gain] ?? 0) + 1;
  p.perso.progression = prog;
  p.ev += deEv;
  return null;
};

// --- Commerce ------------------------------------------------------------------

export const prixVente = (o: Objet, taux: number) => Math.max(0.001, arrondirOr(o.prix * taux));

export const acheter = (p: Partie, id: string, prix: number): string | null => {
  if (p.or < prix) return "Tu n'as pas assez d'or.";
  p.or = arrondirOr(p.or - prix);
  const lot = objet(id).lot;
  if (lot) p.sac.push(...Array.from({ length: lot.nombre }, () => lot.id));
  else p.sac.push(id);
  return null;
};

export const vendre = (p: Partie, id: string, prix: number): string | null => {
  const i = p.sac.indexOf(id);
  if (i < 0) return "Tu n'as pas cet objet dans ton sac.";
  if (objet(id).quete) return 'Un objet de quête, ça ne se vend pas.';
  p.sac.splice(i, 1);
  p.or = arrondirOr(p.or + prix);
  return null;
};

/** Équipe une arme ou une protection du sac ; ce qui occupait la place retourne dans le sac. */
export const equiper = (p: Partie, id: string): string | null => {
  const o = objet(id);
  const f = calculerFiche(p.perso);
  const cle = emplacementDe(o);
  if (!cle) return "Ça ne s'équipe pas.";
  // Une armure complète couvre toutes les localisations ; une pièce séparée la remplace.
  const complete = o.emplacement === 'complete';
  const liberes: CleEquipement[] = complete
    ? ['armure', 'tete', 'bras', 'jambes', 'mains', 'pieds']
    : cle !== 'arme' && cle !== 'bouclier' && p.equipe.armure && objet(p.equipe.armure).emplacement === 'complete'
      ? [cle, 'armure']
      : [cle];
  const prAilleurs = porte(p)
    .filter((x) => !liberes.some((k) => p.equipe[k] === x.id))
    .reduce((s, x) => s + (x.type === 'armure' ? (x.pr ?? 0) : 0), 0);
  const refus = o.type === 'arme' ? peutManier(f, o) : peutPorter(f, o, prAilleurs);
  if (refus) return refus;
  if (cle === 'distance' && f.metier.id === 'mage') return 'Un mage ne s\'encombre pas d\'arc : il a ses sorts.';
  if (cle === 'bouclier' && p.equipe.arme && objet(p.equipe.arme).mains === 2) return 'Impossible de tenir un bouclier avec une arme à deux mains.';
  if (cle === 'arme' && o.mains === 2 && p.equipe.bouclier) return "Il faut deux mains pour cette arme : retire d'abord ton bouclier.";
  const i = p.sac.indexOf(id);
  if (i < 0) return "Tu n'as pas cet objet dans ton sac.";
  p.sac.splice(i, 1);
  for (const k of liberes) {
    const ancien = p.equipe[k];
    if (ancien) p.sac.push(ancien);
    p.equipe[k] = undefined;
  }
  p.equipe[cle] = id;
  return null;
};

export const desequiper = (p: Partie, emplacement: CleEquipement) => {
  const ancien = p.equipe[emplacement];
  if (!ancien) return;
  p.sac.push(ancien);
  p.equipe[emplacement] = undefined;
};

// --- Soins et repos ------------------------------------------------------------

/** Lance une expression de dés comme « 2D+4 ». */
export const lancerExpression = (expr: string, rng?: Rng): { total: number; des: number[] } => {
  // Les tableaux notent parfois un astérisque de renvoi (« 1D-1* ») : on l'ignore.
  const fixe = expr.replace(/[\s*]/g, '');
  if (/^\d+$/.test(fixe)) return { total: Number(fixe), des: [] };
  const m = /^(\d*)D([+-]\d+)?$/.exec(fixe);
  if (!m) throw new Error(`Expression de dés invalide : ${expr}`);
  const nb = Number(m[1] || 1);
  const des = Array.from({ length: nb }, () => lancer(6, rng));
  return { total: Math.max(0, des.reduce((a, b) => a + b, 0) + Number(m[2] ?? 0)), des };
};

export const evMax = (p: Partie) => calculerFiche(p.perso).ev;

export const soigner = (p: Partie, points: number): number => {
  const avant = p.ev;
  p.ev = Math.min(evMax(p), p.ev + points);
  return p.ev - avant;
};

export const boirePotion = (p: Partie, id: string, rng?: Rng): { rendu: number; des: number[] } | string => {
  const o = objet(id);
  if (!o.soin) return "Ça ne se boit pas, ni ne se mange.";
  const i = p.sac.indexOf(id);
  if (i < 0) return "Tu n'as pas cette potion.";
  p.sac.splice(i, 1);
  const jet = lancerExpression(o.soin, rng);
  return { rendu: soigner(p, jet.total), des: jet.des };
};

/** Une nuit de 8 heures (règles V4, 5.1) : 1 PV par 4 h, 2 h ou 1 h selon le confort. */
export const dormir = (p: Partie, confort: 'mauvais' | 'normal' | 'excellent'): number => {
  if (p.heure >= 6) p.jour += 1;
  p.heure = 7;
  reposAstral(p, 8, confort);
  return soigner(p, { mauvais: 2, normal: 4, excellent: 8 }[confort]);
};

/** L'énergie astrale revient au repos : 2, 3 ou 4 PA par heure selon le confort (règles V4, 5.2). */
export const reposAstral = (p: Partie, heures: number, confort: 'mauvais' | 'normal' | 'excellent') => {
  const max = calculerFiche(p.perso).ea;
  if (!max) return 0;
  const avant = p.ea ?? max;
  p.ea = Math.min(max, avant + heures * { mauvais: 2, normal: 3, excellent: 4 }[confort]);
  return p.ea - avant;
};

/** Fait avancer l'horloge, en changeant de jour à minuit. */
export const passerTemps = (p: Partie, heures: number) => {
  p.heure += heures;
  while (p.heure >= 24) {
    p.heure -= 24;
    p.jour += 1;
  }
};

export const formatHeure = (h: number) => {
  const m = Math.floor((h % 1) * 60);
  return `${Math.floor(h)} h${m ? String(m).padStart(2, '0') : ''}`;
};

/** Épreuve (règles V4) : réussie si le D20 ne dépasse pas la valeur ; 1 réussit toujours, 20 échoue toujours. */
export const epreuve = (valeur: number, rng?: Rng, deLance?: number): { de: number; reussi: boolean } => {
  const de = deLance ?? lancer(20, rng);
  return { de, reussi: de === 1 || (de !== 20 && de <= valeur) };
};

export const noter = (p: Partie, texte: string) => {
  p.journal.unshift(`Jour ${p.jour} : ${texte}`);
  p.journal = p.journal.slice(0, 30);
};

/**
 * Une nuit à la belle étoile. Récupération selon la couverture (tableau « Matériel et services ») :
 * sans couverture, basse ; avec la couverture d'aventurier, normale. Le matelas de camping ajoute
 * 1 PV par heure de sommeil. Sans ration, on dort le ventre vide et on récupère moitié moins.
 */
export const bivouaquer = (p: Partie): { rendu: number; confort: 'mauvais' | 'normal'; mange: boolean; matelas: boolean } => {
  const confort = p.sac.includes('couverture') ? 'normal' : 'mauvais';
  const matelas = p.sac.includes('matelas');
  const i = p.sac.indexOf('rations');
  const mange = i >= 0;
  if (mange) p.sac.splice(i, 1);
  let points = { mauvais: 2, normal: 4 }[confort] + (matelas ? 8 : 0);
  if (!mange) points = Math.floor(points / 2);
  // Compétences : Cuistot (+1 PV au repas), camping réussi (+2 PV, +4 PA).
  if (mange && aCompetence(calculerFiche(p.perso), 'Cuistot')) points += 1;
  const qualite = !!p.campQualite;
  if (qualite) points += 2;
  p.campQualite = undefined;
  if (p.heure >= 6) p.jour += 1;
  p.heure = 6;
  reposAstral(p, 8, confort);
  if (qualite) {
    const max = calculerFiche(p.perso).ea;
    if (max) p.ea = Math.min(max, (p.ea ?? max) + 4);
  }
  return { rendu: soigner(p, points), confort, mange, matelas };
};
