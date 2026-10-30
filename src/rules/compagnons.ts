import { calculerFiche, type Fiche, type Personnage } from './creation';
import { objet } from './objets';
import { arrondirOr } from './monnaie';
import { noter, valeursCombat, type Equipement, type EtatCompagnon, type Partie } from './partie';

// Les compagnons : des personnages complets (origine, métier, caractéristiques, compétences, équipement),
// créés avec les mêmes règles que le héros. Ils suivent le héros, se battent à ses côtés (leurs dés
// roulent tout seuls, comme ceux du MJ) et se reposent avec lui.
//
// Chacun a sa personnalité, ses valeurs et ses motivations, et une appréciation du héros qui part de 0.
// Les succès la font monter (victoires, quêtes, butin partagé, tournées), les échecs l'effritent (fuites,
// défaites, butin gardé pour soi, coups reçus du héros par maladresse, mauvaise conduite). Les valeurs
// changent la réaction : un cupide tient au partage, une âme sensible n'aime ni le racket ni qu'on tue
// des bêtes. En combat, le héros peut leur donner un ordre : ils obéissent sur un D20 sous le Charisme
// du héros plus leur appréciation. Trop bas, ils s'en vont (plus ou moins vite selon leur fidélité).
// Choix du jeu, à valider : les règles officielles n'ont pas de système de moral des compagnons.

/** Ce qui compte pour lui, et change ses réactions. */
export type Valeur = 'cupide' | 'honneur' | 'bonte' | 'nature' | 'gloire' | 'prudence' | 'gourmand';

export const VALEURS: Record<Valeur, string> = {
  cupide: "L'or d'abord : il tient à sa part du butin.",
  honneur: 'Un partage juste, une parole tenue.',
  bonte: "N'aime ni le racket, ni la cruauté, ni qu'on maltraite les petites gens.",
  nature: "Souffre quand on tue des bêtes qui n'ont rien demandé.",
  gloire: 'Vit pour les grandes bagarres, méprise les fuyards.',
  prudence: 'Préfère une fuite bien menée à une mort glorieuse.',
  gourmand: 'Une bonne table et une bière fraîche le rendent heureux.',
};

export interface DefCompagnon {
  id: string;
  /** En deux mots, pour les listes : « fils du boucher Jobard ». */
  titre: string;
  description: string;
  /** Comment il rejoint le groupe. */
  recrutement: string;
  perso: Personnage;
  equipe: Equipement;
  /** Ce qu'il garde dans son sac (pour la fiche). */
  sac: string[];
  /** Prix d'embauche (mercenaire). */
  prix?: number;
  /** Lieu où on peut l'embaucher (notation des quêtes : « ville:valtordu:trois-boudins »). */
  embauche?: string;
  /** Trois traits de caractère. */
  personnalite: string;
  motivations: string[];
  valeurs: Valeur[];
  /** De 0 (mercenaire) à 3 (fidèle) : plus elle est haute, plus il supporte avant de partir. */
  fidelite: number;
  /** Ce qu'il raconte quand on discute avec lui. */
  idees: string[];
}

const perso = (nom: string, sexe: 'Homme' | 'Femme', origineId: string, metierId: string, jets: Personnage['jets'], competencesChoisies: string[], ajustements: Personnage['ajustements'] = {}): Personnage => ({
  version: 1,
  nom,
  sexe,
  jets,
  origineId,
  metierId,
  competencesChoisies,
  ajustements,
  destin: 0,
  or: 0,
  jetsOr: [],
});

export const COMPAGNONS: DefCompagnon[] = [
  {
    id: 'gaston',
    titre: 'fils du boucher Jobard',
    description:
      "Gaston Jobard, vingt ans, deux mètres de gentillesse mal coordonnée. Son père voulait en faire un boucher ; il rêve de dragons et de princesses. Il cuisine très bien, se bat avec le couperet familial et s'enfuit en criant qu'il va chercher des renforts.",
    recrutement: "Récompense de la quête « Le secret du boudin Plandu » : Maître Jobard te confie son fils, « pour qu'il apprenne la vie ».",
    perso: perso('Gaston Jobard', 'Homme', 'humain', 'traine-patins', { COU: 10, INT: 9, CHA: 11, AD: 11, FO: 12 }, ['Cuistot', 'Bourre-pif', 'Premiers soins']),
    equipe: { arme: 'feuille-boucher', armure: 'vetements-rembourres' },
    sac: ['boudin-valtordu', 'boudin-valtordu', 'couverture', 'rations'],
    personnalite: 'Gentil, naïf, froussard',
    motivations: ["Voir un dragon, et si possible une princesse", "Prouver à son père qu'il n'est pas fait que pour le boudin"],
    valeurs: ['bonte', 'prudence', 'gourmand'],
    fidelite: 3,
    idees: [
      "Les gobelins, ils ont peut-être une maman, eux aussi. Enfin, je dis ça…",
      "Si on trouve un dragon, je pourrais lui faire un bourguignon. Pas AVEC lui. POUR lui.",
      "Mon père dit qu'un bon boucher sait quand reculer. Moi, je sais très bien reculer.",
      "Tu crois qu'une princesse, ça mange du boudin ? Il faudrait que j'en garde un.",
      "Quand j'aurai assez d'or, j'ouvrirai une auberge. Avec une salle pour les aventuriers, et une autre pour les gens normaux.",
    ],
  },
  {
    id: 'elwyn',
    titre: 'archère sylvaine',
    description:
      "Elwyn Courtebranche, Elfe Sylvaine et rangeuse… pardon, ranger. Elle parle aux écureuils, tire à l'arc mieux que tout le monde et croit sincèrement que les gobelins peuvent changer. Elle te suit par reconnaissance, et un peu par curiosité.",
    recrutement: "Rencontre en forêt : « L'écureuil blessé ». Si tu sauves les elfes attaqués par les gobelins, elle se joint à toi.",
    perso: perso('Elwyn Courtebranche', 'Femme', 'elfe-sylvain', 'ranger', { COU: 10, INT: 11, CHA: 13, AD: 13, FO: 10 }, ['Comprendre les animaux', 'Méfiance'], { adresse: 'AT' }),
    equipe: { arme: 'dague-base', armure: 'veste-cuir', distance: 'arc-court-de-qualite-correcte' },
    sac: ['fleche-de-base', 'fleche-de-base', 'fleche-de-base', 'couverture'],
    personnalite: 'Idéaliste, curieuse, un peu donneuse de leçons',
    motivations: ['Protéger la forêt et ceux qui y vivent', 'Prouver que tout le monde peut changer, même un gobelin'],
    valeurs: ['nature', 'bonte', 'honneur'],
    fidelite: 2,
    idees: [
      "Les écureuils disent que tu ronfles. Je ne fais que transmettre.",
      "Un loup qui attaque a faim. Un humain qui attaque, c'est plus compliqué.",
      "Chez nous, on partage ce qu'on trouve. Chez vous, on appelle ça « se faire avoir », je crois.",
      "Je ne tire jamais sur ce qui fuit. Sauf les orques. Bon, et les gobelins quand ils insistent.",
      "Tu sais qu'on peut parler aux arbres ? Ils ne répondent pas souvent, mais ils écoutent.",
    ],
  },
  {
    id: 'bralk',
    titre: 'guerrier nain mercenaire',
    description:
      "Bralk Barbe-de-Fer, Nain de Jambfer, hache à la main et bière dans l'autre. Il se loue au plus offrant, râle tout le temps, compte chaque pièce et ne recule jamais (surtout parce qu'il court lentement).",
    recrutement: "Il boit aux Trois Boudins, à Valtordu. Il te suit pour 40 pièces d'or, payées d'avance.",
    perso: perso('Bralk Barbe-de-Fer', 'Homme', 'nain', 'guerrier', { COU: 13, INT: 9, CHA: 8, AD: 10, FO: 14 }, ['Chercher des noises', 'Méfiance'], { guerrierEchange: 'aucun', guerrierBonus: 'AT' }),
    equipe: { arme: 'hache-correcte', armure: 'cotte-de-maille-pour-nain-debutant-avec-manches', tete: 'casque-de-metal-de-base' },
    sac: ['couverture', 'rations', 'rations'],
    prix: 40,
    embauche: 'ville:valtordu:trois-boudins',
    personnalite: 'Râleur, radin, increvable',
    motivations: ["L'or. Beaucoup d'or. Plus d'or que son cousin Dwalik", 'Une bonne baston, et une bière après'],
    valeurs: ['cupide', 'gloire', 'gourmand'],
    fidelite: 0,
    idees: [
      "Mon cousin Dwalik a trouvé un coffre de quarante kilos dans un donjon. Quarante kilos ! Moi, je t'ai trouvé toi.",
      "Les elfes, ça mange des feuilles et ça se croit malin. Je dis ça, je dis rien.",
      "Une hache, ça se respecte. Ça s'aiguise le soir, ça se cire le dimanche, et ça ne se prête pas.",
      "Je suis payé pour me battre, pas pour discuter. Mais une bière, je ne dis pas non.",
      "Le jour où on trouve un vrai trésor, je prends ma part et je rentre à Jambfer m'acheter une mine.",
    ],
  },
];

export const compagnon = (id: string): DefCompagnon => {
  const c = COMPAGNONS.find((x) => x.id === id);
  if (!c) throw new Error(`Compagnon inconnu : ${id}`);
  return c;
};

export const ficheCompagnon = (id: string): Fiche => calculerFiche(compagnon(id).perso);

/** Une partie vue depuis le compagnon (sa fiche, son équipement, ses PV), pour réutiliser les règles du héros. */
export const vueCompagnon = (p: Partie, e: EtatCompagnon): Partie => ({ ...p, perso: compagnon(e.id).perso, equipe: compagnon(e.id).equipe, ev: e.ev, talents: {} });

export const valeursCompagnon = (p: Partie, e: EtatCompagnon) => valeursCombat(vueCompagnon(p, e));

/** Son arme à distance, s'il en a une : il tire tant que personne n'est à son contact (flèches non comptées). */
export const tirCompagnon = (p: Partie, e: EtatCompagnon) => {
  const id = compagnon(e.id).equipe.distance;
  if (!id) return undefined;
  return { ad: valeursCompagnon(p, e).ad, degats: objet(id).degats ?? '1D', arme: objet(id).nom };
};

export const groupe = (p: Partie) => p.compagnons ?? [];
export const dansGroupe = (p: Partie, id: string) => groupe(p).some((c) => c.id === id);

/** Le compagnon rejoint le groupe, en pleine forme. */
export const recruter = (p: Partie, id: string): string | null => {
  const c = compagnon(id);
  if (dansGroupe(p, id)) return `${c.perso.nom} est déjà avec toi.`;
  if (c.prix && p.or < c.prix) return `Il faut ${c.prix} PO.`;
  if (c.prix) p.or -= c.prix;
  const ev = ficheCompagnon(id).ev;
  p.compagnons = [...groupe(p), { id, ev, evMax: ev }];
  noter(p, `${c.perso.nom} (${c.titre}) rejoint le groupe.`);
  return null;
};

export const renvoyer = (p: Partie, id: string) => {
  const c = compagnon(id);
  p.compagnons = groupe(p).filter((x) => x.id !== id);
  noter(p, `se sépare de ${c.perso.nom}.`);
};

// --- Appréciation ------------------------------------------------------------------------

export const APPRECIATION_MAX = 10;

/** Sous ce seuil, il quitte le groupe : −4 pour un mercenaire, jusqu'à −10 pour un fidèle. */
export const seuilDepart = (id: string) => -(4 + 2 * compagnon(id).fidelite);

export const appreciation = (e: EtatCompagnon) => e.appreciation ?? 0;

/** Ce qu'il pense du héros, en un mot. */
export const humeur = (e: EtatCompagnon): string => {
  const a = appreciation(e);
  if (a <= seuilDepart(e.id) + 2) return 'Prêt à partir';
  if (a <= -3) return 'Fâché';
  if (a < 0) return 'Mécontent';
  if (a === 0) return 'Neutre';
  if (a <= 3) return 'Content';
  if (a <= 6) return 'Loyal';
  return 'Ami fidèle';
};

const prenom = (id: string) => compagnon(id).perso.nom.split(' ')[0];
const a = (e: EtatCompagnon, v: Valeur) => compagnon(e.id).valeurs.includes(v);

/**
 * Change l'appréciation d'un compagnon et garde le souvenir de pourquoi. S'il tombe sous son seuil, il s'en va.
 * Renvoie la phrase à afficher (vide si rien ne change).
 */
export const apprecier = (p: Partie, e: EtatCompagnon, delta: number, texte: string): string => {
  if (!delta || !dansGroupe(p, e.id)) return '';
  e.appreciation = Math.max(-APPRECIATION_MAX, Math.min(APPRECIATION_MAX, appreciation(e) + delta));
  e.souvenirs = [{ jour: p.jour, delta, texte }, ...(e.souvenirs ?? [])].slice(0, 8);
  const ligne = `${prenom(e.id)} : ${texte} (${delta > 0 ? '+' : ''}${delta})`;
  if (appreciation(e) <= seuilDepart(e.id)) {
    p.compagnons = groupe(p).filter((x) => x.id !== e.id);
    noter(p, `${compagnon(e.id).perso.nom} en a assez et quitte le groupe.`);
    return `${ligne}. ${prenom(e.id)} en a assez : il ramasse ses affaires et s'en va sans se retourner.`;
  }
  return ligne;
};

export type Evenement =
  | { type: 'victoire'; betes: boolean; difficile: boolean }
  | { type: 'fuite' }
  | { type: 'defaite' }
  | { type: 'quete'; titre: string }
  | { type: 'conduite' }
  | { type: 'frappe'; id: string; grave: boolean };

/** Comment chacun réagit à ce qui vient d'arriver, selon ses valeurs. Renvoie les phrases à afficher. */
export const reagir = (p: Partie, ev: Evenement): string[] => {
  const lignes: string[] = [];
  for (const e of [...groupe(p)]) {
    let d = 0;
    let t = '';
    switch (ev.type) {
      case 'victoire':
        d = a(e, 'gloire') && ev.difficile ? 2 : 1;
        t = d > 1 ? 'belle bagarre !' : 'victoire';
        if (ev.betes && a(e, 'nature')) {
          d -= 2;
          t = "victoire, mais elle n'aime pas qu'on tue des bêtes";
        }
        break;
      case 'fuite':
        d = a(e, 'prudence') ? 0 : a(e, 'gloire') ? -2 : -1;
        t = a(e, 'gloire') ? 'on a fui comme des lapins' : 'retraite peu glorieuse';
        break;
      case 'defaite':
        d = -2;
        t = 'défaite';
        break;
      case 'quete':
        d = 2;
        t = `quête « ${ev.titre} » réussie`;
        break;
      case 'conduite':
        d = a(e, 'bonte') ? -2 : a(e, 'honneur') ? -1 : 0;
        t = 'il désapprouve tes méthodes';
        break;
      case 'frappe':
        if (e.id !== ev.id) continue;
        d = ev.grave ? -4 : -2;
        t = ev.grave ? 'tu lui as fait une blessure grave avec ta maladresse' : "tu l'as frappé par maladresse";
        break;
    }
    const l = apprecier(p, e, d, t);
    if (l) lignes.push(l);
  }
  return lignes;
};

// --- Le partage du butin --------------------------------------------------------------------

/** Ajoute de l'or gagné avec le groupe au butin à partager (rien à partager quand on est seul). */
export const ajouterButin = (p: Partie, or: number) => {
  if (or > 0 && groupe(p).length) p.butin = arrondirOr((p.butin ?? 0) + or);
};

/** La part de chacun si l'on partage à parts égales, héros compris. */
export const partButin = (p: Partie) => Math.floor((p.butin ?? 0) / (groupe(p).length + 1));

export const partagerButin = (p: Partie): string[] => {
  const part = partButin(p);
  const lignes: string[] = [];
  for (const e of [...groupe(p)]) {
    p.or = arrondirOr(p.or - part);
    lignes.push(apprecier(p, e, a(e, 'cupide') || a(e, 'honneur') ? 2 : 1, `reçoit sa part, ${part} PO`));
  }
  noter(p, `partage le butin : ${part} PO pour chacun.`);
  p.butin = undefined;
  return lignes.filter(Boolean);
};

export const garderButin = (p: Partie, raison = 'tu gardes tout le butin pour toi'): string[] => {
  const lignes = groupe(p)
    .map((e) => apprecier(p, e, a(e, 'cupide') ? -3 : a(e, 'honneur') ? -2 : -1, raison))
    .filter(Boolean);
  p.butin = undefined;
  return lignes;
};

// --- Discuter, payer une tournée, donner des ordres ----------------------------------------

/** Discuter avec lui, une fois par jour : il raconte ce qu'il a en tête. L'appréciation ne monte ainsi que jusqu'à 3. */
export const discuter = (p: Partie, e: EtatCompagnon, rng: () => number = Math.random): { idee: string; ligne: string } => {
  const d = compagnon(e.id);
  const idee = d.idees[Math.floor(rng() * d.idees.length)];
  if (e.discussion === p.jour) return { idee, ligne: '' };
  e.discussion = p.jour;
  return { idee, ligne: appreciation(e) < 3 ? apprecier(p, e, 1, 'une bonne discussion') : '' };
};

export const PRIX_TOURNEE = 2;

/** Payer à boire (2 PO), une fois par jour : les gourmands apprécient double. */
export const payerTournee = (p: Partie, e: EtatCompagnon): string => {
  if (e.tournee === p.jour) return `${prenom(e.id)} a déjà eu sa tournée aujourd'hui.`;
  if (p.or < PRIX_TOURNEE) return `Il faut ${PRIX_TOURNEE} PO.`;
  p.or = arrondirOr(p.or - PRIX_TOURNEE);
  e.tournee = p.jour;
  return apprecier(p, e, a(e, 'gourmand') ? 2 : 1, 'une tournée offerte');
};

export type Ordre = 'proteger' | 'cible' | 'distance';

export const ORDRES: Record<Ordre, string> = {
  proteger: 'Protège-moi !',
  cible: 'Sur celui-là !',
  distance: 'Reste en arrière !',
};

/** Il obéit sur un D20 inférieur ou égal au Charisme du héros plus son appréciation (1 : toujours, 20 : jamais). */
export const valeurObeissance = (p: Partie, e: EtatCompagnon) => Math.max(1, Math.min(19, valeursCombat(p).cha + appreciation(e)));

export const obeit = (p: Partie, e: EtatCompagnon, de: number) => de === 1 || (de !== 20 && de <= valeurObeissance(p, e));
