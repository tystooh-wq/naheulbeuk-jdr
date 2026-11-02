import { calculerFiche, cleCompetence } from './creation';
import { changerReputation } from './reputation';
import { lancer, type Rng } from './des';
import { eaMax, ea } from './magie';
import { evMax, lancerExpression, niveau, noter, passerTemps, soigner, valeursCombat, type Partie } from './partie';

// Les compétences du héros (livret des origines et métiers V3.2) prises en compte par le jeu :
// - passives : le jeu les applique tout seul (bonus aux épreuves, armure, combat…) ;
// - utilisables : un bouton apparaît là où elles servent (en ville, au bivouac, n'importe où hors combat…).
// Celles qui n'ont pas encore de situation dans le jeu sont signalées comme telles sur la fiche du sac.

export const aTalent = (p: Partie, nom: string) => {
  const c = calculerFiche(p.perso).competences;
  return [...c.naissance, ...c.heritees, ...c.choisies].some((n) => cleCompetence(n) === cleCompetence(nom));
};

/** Ingéniosité (règles V4) : moyenne de l'Intelligence et de l'Adresse, arrondie au-dessus. */
export const ingeniosite = (p: Partie) => {
  const k = calculerFiche(p.perso).caracs;
  return Math.ceil((k.INT + valeursCombat(p).ad) / 2);
};

// --- Bonus aux épreuves, selon la situation ------------------------------------------

export type Situation =
  | 'marchandage'
  | 'negocier'
  | 'vol'
  | 'piege'
  | 'desamorcer'
  | 'nature'
  | 'cuisine'
  | 'cavernes'
  | 'connaissance'
  | 'cachette'
  | 'serrure';

/** Pour chaque situation, les compétences qui aident. Les groupes « un seul » ne se cumulent pas (on garde le meilleur). */
const BONUS: Record<Situation, { nom: string; bonus: number; groupe?: string }[]> = {
  // Radin +4, Fariboles +3 : « non cumulables » d'après le livret.
  marchandage: [
    { nom: 'Radin', bonus: 4, groupe: 'marchand' },
    { nom: 'Fariboles', bonus: 3, groupe: 'marchand' },
  ],
  negocier: [
    { nom: 'Fariboles', bonus: 3 },
    { nom: 'Erreur de la nature', bonus: -5 },
  ],
  vol: [{ nom: 'Chouraver', bonus: 4 }],
  piege: [{ nom: 'Détecter', bonus: 2 }],
  desamorcer: [{ nom: 'Désamorcer', bonus: 4 }],
  // Les connaissances spécifiques donnent +4, les générales +2, sans cumul.
  nature: [
    { nom: 'Connaissances de la nature', bonus: 4, groupe: 'savoir' },
    { nom: 'Connaissances générales', bonus: 2, groupe: 'savoir' },
  ],
  cuisine: [
    { nom: 'Connaissances culinaires', bonus: 4, groupe: 'savoir' },
    { nom: 'Connaissances générales', bonus: 2, groupe: 'savoir' },
  ],
  cavernes: [
    { nom: 'Connaissances des cavernes', bonus: 4, groupe: 'savoir' },
    { nom: 'Connaissances générales', bonus: 2, groupe: 'savoir' },
  ],
  connaissance: [{ nom: 'Connaissances générales', bonus: 2 }],
  // Passages secrets, coffres planqués : Instinct du trésor +3, Détecter +2, sans cumul.
  cachette: [
    { nom: 'Instinct du trésor', bonus: 3, groupe: 'flair' },
    { nom: 'Détecter', bonus: 2, groupe: 'flair' },
  ],
  // Sans Serrurier, « le MJ rend la vie dure » : le jeu applique −3, que la compétence efface.
  serrure: [{ nom: 'Serrurier', bonus: 3 }],
};

export interface BonusEpreuve {
  total: number;
  /** « +4 Radin », pour l'afficher à côté de l'épreuve. */
  details: string[];
}

export const bonusSituation = (p: Partie, ...situations: Situation[]): BonusEpreuve => {
  const retenus = new Map<string, { nom: string; bonus: number }>();
  for (const s of situations)
    for (const b of BONUS[s]) {
      if (!aTalent(p, b.nom)) continue;
      const cle = b.groupe ? `groupe:${b.groupe}` : b.nom;
      const deja = retenus.get(cle);
      if (!deja || b.bonus > deja.bonus) retenus.set(cle, b);
    }
  const liste = [...retenus.values()];
  return { total: liste.reduce((s, b) => s + b.bonus, 0), details: liste.map((b) => `${b.bonus > 0 ? '+' : ''}${b.bonus} ${b.nom}`) };
};

/** « (+4 Radin) », ou rien. */
export const texteBonus = (b: BonusEpreuve) => (b.details.length ? ` (${b.details.join(', ')})` : '');

/** Le meilleur bonus de connaissance pour une situation donnée, ou null si le héros n'y connaît rien. */
export const savoir = (p: Partie, s: Situation): BonusEpreuve | null => {
  const b = bonusSituation(p, s);
  return b.details.length ? b : null;
};

// --- Compétences utilisables (boutons) -----------------------------------------------

export type Cadre = 'ville' | 'monde' | 'bivouac' | 'donjon';

export interface TalentActif {
  id: string;
  /** Compétence(s) qui donnent accès à ce talent. */
  competences: string[];
  libelle: string;
  /** Où il sert. Absent : partout hors combat. */
  cadres?: Cadre[];
  /** Valeur de l'épreuve au D20, si le joueur doit lancer le dé. */
  epreuve?: (p: Partie) => number;
  /** Ce que le joueur lance quand il n'y a pas d'épreuve (un D20 de pièces d'or…). */
  jet?: { faces: number; pour: string };
  /** Une fois par heure, par jour, par nuit, ou sans limite. */
  limite: 'heure' | 'jour' | 'nuit' | 'aucune';
  /** Accessible à tous ceux qui ont de l'énergie astrale, compétence ou non. */
  pourAstraux?: boolean;
  /** Raison pour laquelle on ne peut pas l'utiliser maintenant, ou null. */
  possible?: (p: Partie, cadre: Cadre, zone?: string) => string | null;
  resoudre: (p: Partie, de: number, rng?: Rng) => string;
  /** Une phrase pour expliquer la règle. */
  aide: string;
}

const maintenant = (p: Partie) => p.jour * 24 + p.heure;

const COMPETENCES_CAMPING = ['Camping tout-terrain', 'Camping forestier'];

export const TALENTS_ACTIFS: TalentActif[] = [
  {
    id: 'premiers-soins',
    competences: ['Premiers soins'],
    libelle: 'Premiers soins',
    epreuve: ingeniosite,
    limite: 'heure',
    possible: (p) => (p.ev >= evMax(p) ? 'Tu es en pleine forme.' : null),
    resoudre: (p, de, rng) => {
      if (de === 20) {
        const b = lancerExpression('1D', rng).total;
        p.ev = Math.max(1, p.ev - b);
        return `Maladresse : le bandage serre tellement qu'il rouvre la plaie. −${b} PV.`;
      }
      if (de !== 1 && de > ingeniosite(p)) return 'Le pansement ne tient pas. Tu pourras réessayer dans une heure.';
      const d = lancer(6, rng);
      const rendu = soigner(p, d);
      return `Tu nettoies et bandes tes plaies (D6 : ${d}) : +${rendu} PV.`;
    },
    aide: "Épreuve d'ingéniosité (moyenne INT/AD) : au plus 1D6 PV. Maladresse : −1D6 PV. Une fois par heure.",
  },
  {
    // Étude (règles V4, 5.2) : obligatoire pour la plupart des mages et prêtres, une fois par 24 h.
    id: 'recuperation',
    competences: ['Récupération'],
    pourAstraux: true,
    libelle: 'Étudier ses grimoires (1 heure)',
    limite: 'jour',
    possible: (p) => (!eaMax(p) ? "Tu n'as pas d'énergie astrale." : ea(p) >= eaMax(p) ? 'Ton énergie astrale est au maximum.' : null),
    resoudre: (p) => {
      passerTemps(p, 1);
      const avant = ea(p);
      p.ea = Math.min(eaMax(p), avant + 4);
      return `Une heure le nez dans le grimoire : +${p.ea - avant} PA.`;
    },
    aide: 'Étude au calme, une fois par jour : +4 PA.',
  },
  {
    id: 'repos',
    competences: [],
    pourAstraux: true,
    libelle: 'Se reposer une heure',
    limite: 'aucune',
    possible: (p) => (!eaMax(p) ? "Tu n'as pas d'énergie astrale." : ea(p) >= eaMax(p) && p.ev >= evMax(p) ? 'Tu es frais comme un gardon.' : null),
    resoudre: (p) => {
      passerTemps(p, 1);
      // Règles V4, 5.2 : 3 PA par heure de repos (conditions normales).
      const avant = ea(p);
      p.ea = Math.min(eaMax(p), avant + 3);
      return `Une heure assis à l'écart, les yeux fermés : +${p.ea - avant} PA.`;
    },
    aide: 'Une heure de repos : +3 PA (règles V4, 5.2).',
  },
  {
    id: 'mendier',
    competences: ['Mendier et pleurnicher'],
    libelle: 'Mendier et pleurnicher (4 heures)',
    cadres: ['ville'],
    jet: { faces: 20, pour: 'compter les piécettes' },
    limite: 'jour',
    resoudre: (p, de) => {
      passerTemps(p, 4);
      p.or += de;
      noter(p, `mendie et récolte ${de} PO.`);
      return `Quatre heures assis au coin d'une rue, avec ta mine la plus pitoyable : ${de} PO dans ton chapeau.`;
    },
    aide: 'En ville ou au village, une fois par jour : 1D20 PO.',
  },
  {
    id: 'tire-laine',
    competences: ['Tire-laine'],
    libelle: 'Faire les poches des passants (4 heures)',
    cadres: ['ville'],
    jet: { faces: 20, pour: 'compter le butin' },
    limite: 'jour',
    resoudre: (p, de, rng) => {
      passerTemps(p, 4);
      // 1D20 PO, et 1D20 de plus tous les 3 niveaux.
      let or = de;
      for (let n = 3; n <= niveau(p); n += 3) or += lancer(20, rng);
      p.or += or;
      p.mauvaiseConduite = (p.mauvaiseConduite ?? 0) + 1;
      noter(p, `fait les poches des passants : ${or} PO.`);
      const jase = changerReputation(p, p.ville, -1, 'bourses envolées') ? ' On commence à jaser sur ton compte : ta réputation baisse.' : '';
      return `Quelques bourses mal attachées plus tard : ${or} PO. Personne n'a rien vu. Enfin, presque personne.${jase}`;
    },
    aide: 'En ville, une fois par jour : 1D20 PO de menus larcins (1D20 de plus tous les 3 niveaux). Compte comme une mauvaise action et fait baisser ta réputation en ville.',
  },
  {
    id: 'camping',
    competences: COMPETENCES_CAMPING,
    libelle: 'Monter un bivouac de qualité',
    cadres: ['bivouac'],
    epreuve: (p) => ingeniosite(p) + 3,
    limite: 'nuit',
    possible: (p, _c, zone) =>
      !aTalent(p, 'Camping tout-terrain') && zone !== 'foret' ? 'Camping forestier : seulement en forêt.' : p.campQualite ? 'Le camp est déjà monté.' : null,
    resoudre: (p, de) => {
      if (de === 1 || (de !== 20 && de <= ingeniosite(p) + 3)) {
        p.campQualite = true;
        return 'Un coin plat, à l\'abri du vent, un bon feu : la nuit rendra deux fois plus de PV (et 4 PA de plus pour qui manie la magie).';
      }
      return 'Les branches tombent, le feu fume : ce sera un bivouac ordinaire.';
    },
    aide: "Épreuve d'ingéniosité +3 : la nuit rend deux fois plus de PV, et +4 PA.",
  },
];

/** Talents que le héros possède. */
export const talentsDuHeros = (p: Partie) =>
  TALENTS_ACTIFS.filter((t) => (t.pourAstraux && eaMax(p) > 0) || t.competences.some((c) => aTalent(p, c)));

/** Pourquoi le talent n'est pas utilisable ici et maintenant, ou null. */
export const empechement = (p: Partie, t: TalentActif, cadre: Cadre, zone?: string): string | null => {
  if (t.cadres && !t.cadres.includes(cadre)) return 'pas ici';
  const dernier = p.talents?.[t.id];
  if (dernier !== undefined) {
    const ecart = maintenant(p) - dernier;
    if (t.limite === 'heure' && ecart < 1) return 'Une fois par heure : patiente un peu.';
    if (t.limite === 'jour' && Math.floor(dernier / 24) === p.jour) return 'Déjà fait aujourd\'hui.';
    if (t.limite === 'nuit' && ecart < 12) return 'Déjà tenté ce soir.';
  }
  return t.possible?.(p, cadre, zone) ?? null;
};

/** Utilise le talent avec le dé du joueur (épreuve ou jet). */
export const utiliserTalent = (p: Partie, id: string, de: number, rng?: Rng): string => {
  const t = TALENTS_ACTIFS.find((x) => x.id === id)!;
  p.talents = { ...(p.talents ?? {}), [id]: maintenant(p) };
  return t.resoudre(p, de, rng);
};

// --- Ce que le jeu fait de chaque compétence (pour la fiche du sac) ---------------------

export type Prise = 'auto' | 'bouton' | 'seul' | 'non';

/** Comment le jeu gère une compétence. Celles absentes de la table ne servent pas encore. */
const PRISES: Record<string, [Prise, string]> = {
  'TIRER CORRECTEMENT': ['auto', 'Tir sans le malus de −4, +1 aux armes mécaniques.'],
  'BOURRE-PIF': ['auto', 'À mains nues : pas de malus en attaque, 1D de dégâts.'],
  'CHERCHER DES NOISES': ['auto', 'Tu frappes toujours en premier au corps à corps.'],
  'ARMES DE BOURRIN': ['auto', 'Tu peux manier les armes à deux mains.'],
  'TRUC DE MAUVIETTE': ['auto', '+1 en protection, même contre les coups critiques.'],
  VICIEUX: ['auto', "Tes coups ignorent 1 point d'armure."],
  'BRIC-À-BRAC': ['auto', "L'armure ne gêne ni ta parade ni ton esquive."],
  'SUPER ESQUIVE': ['auto', "Tu peux attaquer après une esquive, et tu ne rates jamais une esquive sur un 20."],
  'ESQUIVE NATURELLE': ['auto', 'Après une esquive, 4 à 6 au D6 : tu peux quand même attaquer.'],
  'CHANCE DU REMPAILLEUR': ['auto', 'Tu ne peux pas mourir en combat : laissé pour mort, tu te relèves avec 1 PV.'],
  'APPEL DES RENFORTS': ['auto', 'Tu fuis un combat sans épreuve et sans prendre de coups.'],
  'FOUILLER DANS LES POUBELLES': ['auto', 'Sur les vaincus, tu lances deux D20 de butin et gardes le meilleur.'],
  RADIN: ['auto', '+4 au marchandage (non cumulable avec Fariboles).'],
  FARIBOLES: ['auto', '+3 au marchandage et pour négocier avec une rencontre.'],
  'ARNAQUE ET CARAMBOUILLE': ['auto', 'En boutique : 20 % de remise à l\'achat, 10 % de mieux à la revente, sans marchander.'],
  CHOURAVER: ['auto', '+4 aux épreuves de vol à la tire.'],
  DÉTECTER: ['auto', '+2 pour repérer les pièges à temps.'],
  DÉSAMORCER: ['bouton', 'Désamorcer les pièges des donjons, avec +4 en Adresse.'],
  INTIMIDER: ['bouton', 'Faire fuir une rencontre moins courageuse que toi, au Charisme.'],
  'CONNAISSANCES DE LA NATURE': ['bouton', "+4 pour reconnaître plantes et champignons (choix « Les examiner »)."],
  'CONNAISSANCES CULINAIRES': ['bouton', "+4 pour reconnaître ce qui se mange (choix « Les examiner »)."],
  'CONNAISSANCES GÉNÉRALES': ['bouton', '+2 aux épreuves de connaissance (choix « Les examiner »).'],
  'SENTIR DES PIEDS': ['auto', 'Bottes retirées, les bêtes évitent ton bivouac : pas de rencontre la nuit.'],
  CUISTOT: ['auto', '+1 PV quand tu cuisines ta ration au bivouac.'],
  'PREMIERS SOINS': ['bouton', 'Dans le sac, hors combat : soigne au plus 1D6 PV, une fois par heure.'],
  RÉCUPÉRATION: ['bouton', 'Dans le sac : une heure d\'étude par jour, +4 PA.'],
  'MENDIER ET PLEURNICHER': ['bouton', 'En ville, une fois par jour : 1D20 PO.'],
  'TIRE-LAINE': ['bouton', 'En ville, une fois par jour : 1D20 PO de larcins.'],
  'CAMPING TOUT-TERRAIN': ['bouton', 'Au bivouac : épreuve d\'ingéniosité +3 pour +2 PV et +4 PA.'],
  'CAMPING FORESTIER': ['bouton', 'Au bivouac en forêt : épreuve d\'ingéniosité +3 pour +2 PV et +4 PA.'],
  BERSERKER: ['bouton', 'En combat, une fois par jour : +3D6 + niveau PV temporaires.'],
  'FRAPPER LÂCHEMENT': ['bouton', 'En combat, avec une dague : une fois par combat, dégâts doublés.'],
  'ERREUR DE LA NATURE': ['auto', '−5 pour négocier avec les rencontres qui parlent.'],
  'ATTIRE LES MONSTRES': ['seul', 'Tu voyages seul : tu es de toute façon la seule cible.'],
  'TOMBER DANS LES PIÈGES': ['seul', 'Tu voyages seul : les pièges sont tous pour toi.'],
  'CHEF DE GROUPE': ['seul', 'Pas encore de groupe à commander.'],
  'APPEL DU SAUVAGE': ['seul', 'Concerne les combats de groupe contre une horde apparentée : à venir avec les compagnons.'],
};

export const priseCompetence = (nom: string): [Prise, string] =>
  PRISES[cleCompetence(nom)] ?? ['non', "Pas encore de situation dans le jeu où elle sert : le MJ l'appliquera dès qu'il y en aura une."];

/** Toutes les compétences du héros, sans doublon. */
export const competencesDuHeros = (p: Partie) => {
  const c = calculerFiche(p.perso).competences;
  const vus = new Set<string>();
  return [...c.naissance, ...c.heritees, ...c.choisies].filter((n) => !vus.has(cleCompetence(n)) && !!vus.add(cleCompetence(n)));
};
