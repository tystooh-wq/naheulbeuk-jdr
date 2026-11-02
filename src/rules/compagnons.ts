import { lancer, type Rng } from './des';
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
  /** Aventurier de passage : on peut le croiser dans une taverne ou une auberge (10 % par jour et par lieu). */
  passage?: boolean;
  /** Son CV, sur la pancarte de recrutement du Donjon Facile. */
  cv?: string;
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

// Aventuriers de passage (tavernes et auberges) et jeunes recrues (pancarte du Donjon Facile) : personnages maison.
const PANCARTE = 'ville:valtordu:donjon-facile';
COMPAGNONS.push(
  {
    id: 'mirelda',
    titre: 'voleuse aux doigts agiles',
    description: "Mirelda Fontebrune, trente ans, sourire charmant et poches profondes. Elle cherche un groupe « pour la sécurité », c'est-à-dire pour avoir quelqu'un à mettre devant.",
    recrutement: 'De passage dans les tavernes. Elle suit qui la paie.',
    perso: perso('Mirelda Fontebrune', 'Femme', 'humain', 'voleur', { COU: 10, INT: 11, CHA: 11, AD: 13, FO: 9 }, ['Frapper lâchement', 'Tire-laine', 'Méfiance']),
    equipe: { arme: 'dague-base', armure: 'veste-cuir' },
    sac: ['couverture', 'rations'],
    prix: 30,
    passage: true,
    personnalite: 'Charmeuse, prudente, pas très honnête',
    motivations: ['Un gros coup, puis une maison au bord de la mer', 'Ne jamais être celle qui passe en premier'],
    valeurs: ['cupide', 'prudence'],
    fidelite: 1,
    idees: [
      "Une serrure, c'est juste une porte qui fait des manières.",
      "Je ne vole pas. Je redistribue. Vers moi.",
      "Si ça tourne mal, je serai juste derrière toi. Loin derrière.",
    ],
  },
  {
    id: 'torgal',
    titre: 'barbare des steppes',
    description: "Torgal le Sanguin, deux mètres de muscles et une épée trop grande pour une taverne. Il cherche « des choses à frapper », et il n'est pas difficile sur le choix.",
    recrutement: 'De passage dans les tavernes, entre deux bagarres.',
    perso: perso('Torgal le Sanguin', 'Homme', 'barbare', 'guerrier', { COU: 13, INT: 8, CHA: 9, AD: 11, FO: 14 }, ['Intimider', 'Escalader']),
    equipe: { arme: 'epee-2-mains-correcte', armure: 'plastron-cuir' },
    sac: ['couverture', 'rations', 'rations'],
    prix: 50,
    passage: true,
    personnalite: 'Bruyant, téméraire, affamé',
    motivations: ['Devenir une légende chantée dans les tavernes', 'Manger un dragon (cuit)'],
    valeurs: ['gloire', 'gourmand'],
    fidelite: 1,
    idees: ["Pourquoi réfléchir quand on peut taper ?", "Un jour, on chantera mon nom. Torgal. Avec un G.", "La bière d'ici a un goût de pied. J'en reprends une."],
  },
  {
    id: 'ysolde',
    titre: 'paladine en quête de justice',
    description: "Ysolde de Brumefosse, armure astiquée et regard sévère. Elle a juré de combattre le mal, et elle trouve qu'il y en a beaucoup, surtout autour de toi.",
    recrutement: 'De passage dans les auberges, en route vers une croisade quelconque.',
    perso: perso('Ysolde de Brumefosse', 'Femme', 'humain', 'paladin', { COU: 12, INT: 11, CHA: 12, AD: 10, FO: 12 }, ['Premiers soins', 'Érudition', 'Chef de groupe']),
    equipe: { arme: 'marteau-masse-1-main-bonne-qualite', armure: 'plastron-cuir-renforce', bouclier: 'bouclier-de-base' },
    sac: ['couverture', 'rations'],
    prix: 45,
    passage: true,
    personnalite: 'Droite, sévère, généreuse',
    motivations: ['Protéger les faibles', 'Prouver sa valeur à son ordre'],
    valeurs: ['honneur', 'bonte'],
    fidelite: 2,
    idees: ["Le mal ne prend jamais de jour de congé. Moi non plus.", "Tu as encore racketté quelqu'un ? Non ? Bien.", "Une prière avant le combat, ça ne coûte rien."],
  },
  {
    id: 'pipo',
    titre: 'semi-homme archer',
    description: "Pipo Grosorteil, Semi-homme, archer, gourmet. Il tire juste et mange six fois par jour, ce qui pose des problèmes de rations.",
    recrutement: 'De passage dans les tavernes, toujours près des cuisines.',
    perso: perso('Pipo Grosorteil', 'Homme', 'semi-homme', 'ranger', { COU: 12, INT: 11, CHA: 11, AD: 12, FO: 8 }, ['Tirer correctement', 'Connaissances culinaires']),
    equipe: { arme: 'dague-base', armure: 'veste-cuir', distance: 'arc-court-de-qualite-correcte' },
    sac: ['fleche-de-base', 'fleche-de-base', 'fleche-de-base', 'fleche-de-base', 'couverture', 'rations'],
    prix: 25,
    passage: true,
    personnalite: 'Jovial, gourmand, prudent',
    motivations: ['Goûter tous les plats de la Terre de Fangh', 'Revenir chez lui avec des histoires'],
    valeurs: ['gourmand', 'prudence'],
    fidelite: 2,
    idees: ["Le deuxième petit-déjeuner, c'est le repas le plus important de la journée.", "Je vise mieux le ventre plein.", "Les gobelins, ça sent le fromage tourné. Pas le bon."],
  },
  {
    id: 'kraguk',
    titre: 'orque mercenaire',
    description: "Kraguk, orque, mercenaire, ne comprend pas les phrases de plus de cinq mots. Il se bat bien et compte l'or encore mieux, sur ses doigts.",
    recrutement: 'De passage dans les tavernes louches.',
    perso: perso('Kraguk', 'Homme', 'orque', 'guerrier', { COU: 12, INT: 7, CHA: 8, AD: 10, FO: 13 }, ['Intimider', 'Chercher des noises']),
    equipe: { arme: 'hache-correcte', armure: 'set-armure-de-cuir-orque-troupier' },
    sac: ['couverture', 'rations'],
    prix: 35,
    passage: true,
    personnalite: 'Brutal, cupide, étonnamment loyal quand on paie',
    motivations: ["L'or", 'Taper des elfes'],
    valeurs: ['cupide', 'gloire'],
    fidelite: 0,
    idees: ['Kraguk taper. Toi payer. Bien.', 'Elfe ? Où elfe ?', 'Or partager. Moi compter.'],
  },
  {
    id: 'jehan',
    titre: 'jeune guerrier plein d’espoir',
    description: "Jehan Pommier, dix-sept ans, une épée rouillée héritée d'un oncle et une confiance inébranlable. Il a lu tous les livres d'aventure de Valtordu (il y en a trois).",
    recrutement: 'Son CV est épinglé sur la pancarte du Donjon Facile.',
    cv: "« Jeune, motivé, a déjà tué un rat (gros). Cherche groupe sérieux pour aventure pas trop dangereuse. Disponible tout de suite. »",
    perso: perso('Jehan Pommier', 'Homme', 'humain', 'guerrier', { COU: 12, INT: 9, CHA: 10, AD: 11, FO: 12 }, ['Chercher des noises', 'Truc de mauviette', 'Naïveté touchante']),
    equipe: { arme: 'epee-perrave', armure: 'vetements-rembourres' },
    sac: ['couverture', 'rations'],
    prix: 10,
    embauche: PANCARTE,
    personnalite: 'Enthousiaste, naïf, courageux',
    motivations: ['Devenir un vrai héros', 'Impressionner la fille du meunier'],
    valeurs: ['gloire', 'honneur'],
    fidelite: 2,
    idees: ["Dans les livres, le héros gagne toujours à la fin. On est à la fin, là ?", "J'ai appris à manier l'épée avec un balai. C'est pareil, en plus lourd.", "Tu crois qu'on aura une chanson ?"],
  },
  {
    id: 'berthe',
    titre: 'apprentie magicienne',
    description: "Berthe Courtepaille, renvoyée de l'école de magie pour « excès d'enthousiasme pyrotechnique ». Elle connaît trois sorts et en rate deux.",
    recrutement: 'Son CV est épinglé sur la pancarte du Donjon Facile.',
    cv: "« Magicienne (presque diplômée). Allume les feux de camp, éclaire les couloirs. Pas responsable des sourcils brûlés. Tarif étudiant. »",
    perso: perso('Berthe Courtepaille', 'Femme', 'humain', 'mage', { COU: 9, INT: 13, CHA: 10, AD: 10, FO: 9 }, ['Fariboles', 'Premiers soins', 'Pénible']),
    equipe: { arme: 'baton', armure: 'vetements-rembourres' },
    sac: ['couverture', 'rations'],
    prix: 15,
    embauche: PANCARTE,
    personnalite: 'Bavarde, distraite, curieuse',
    motivations: ['Prouver à ses professeurs qu’ils avaient tort', 'Trouver un grimoire perdu'],
    valeurs: ['prudence', 'bonte'],
    fidelite: 2,
    idees: ["Techniquement, ce n'était pas une explosion. C'était une expansion rapide.", "Si je dis « baissez-vous », ne posez pas de questions.", "Un jour, j'apprendrai la boule de feu. La vraie, celle qui part dans le bon sens."],
  },
  {
    id: 'nestor',
    titre: 'gnôme bricoleur',
    description: "Nestor Bidule, gnôme, ingénieur autoproclamé, arbalète bricolée maison. Elle tire, la plupart du temps dans la bonne direction.",
    recrutement: 'Son CV est épinglé sur la pancarte du Donjon Facile.',
    cv: "« Ingénieur gnôme. Répare tout, invente le reste. Arbalète fournie. Cherche groupe avec budget pour pièces détachées. »",
    perso: perso('Nestor Bidule', 'Homme', 'gnome', 'ingenieur', { COU: 9, INT: 12, CHA: 9, AD: 13, FO: 7 }, ['Tirer correctement', 'Détecter']),
    equipe: { arme: 'dague-base', armure: 'vetements-rembourres', distance: 'arbalete-de-gobelin' },
    sac: ['carreau-de-base', 'carreau-de-base', 'carreau-de-base', 'couverture'],
    prix: 12,
    embauche: PANCARTE,
    personnalite: 'Ingénieux, râleur, radin',
    motivations: ['Construire la machine ultime', 'Financer ses inventions'],
    valeurs: ['cupide', 'prudence'],
    fidelite: 1,
    idees: ["Ce n'est pas cassé, c'est en cours d'amélioration.", "Tu me laisses tes pièces ? Pour la science.", "Si ça fume, c'est normal. Si ça siffle, cours."],
  },
);

/** Aujourd'hui, dans cette taverne ou cette auberge, un aventurier de passage boit-il au comptoir (10 % par jour) ? */
export const dePassage = (p: Partie, ou: string): DefCompagnon | null => {
  let h = 2166136261;
  for (const ch of `${Math.floor(p.jour)}:${ou}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  const tirage = ((h >>> 0) % 1000) / 1000;
  if (tirage >= 0.1) return null;
  // Le tirage désigne une personne précise : une fois recrutée, le comptoir reste vide jusqu'au lendemain.
  const tous = COMPAGNONS.filter((d) => d.passage);
  const d = tous[(h >>> 10) % tous.length];
  return d && !dansGroupe(p, d.id) ? d : null;
};

export const compagnon = (id: string): DefCompagnon => {
  const c = COMPAGNONS.find((x) => x.id === id);
  if (!c) throw new Error(`Compagnon inconnu : ${id}`);
  return c;
};

export const ficheCompagnon = (id: string): Fiche => calculerFiche(compagnon(id).perso);

/** Une partie vue depuis le compagnon (sa fiche, son équipement, ses PV), pour réutiliser les règles du héros. */
export const vueCompagnon = (p: Partie, e: EtatCompagnon): Partie => ({ ...p, perso: compagnon(e.id).perso, equipe: compagnon(e.id).equipe, ev: e.ev, talents: {}, blessures: blessuresCompagnon(p, e) });

/** Ses blessures graves encore actives (celles qui sont guéries disparaissent). */
export const blessuresCompagnon = (p: Partie, e: EtatCompagnon) => {
  const maintenant = p.jour + p.heure / 24;
  if (e.blessures?.some((b) => b.jusqua !== undefined && b.jusqua <= maintenant)) e.blessures = e.blessures.filter((b) => b.jusqua === undefined || b.jusqua > maintenant);
  return e.blessures ?? [];
};

/** Sa bourse : à son arrivée, la moitié de son prix d'embauche (10 PO s'il est venu pour rien). */
export const bourseDe = (e: EtatCompagnon) => (e.bourse ??= Math.round((compagnon(e.id).prix ?? 20) / 2));

export const valeursCompagnon = (p: Partie, e: EtatCompagnon) => valeursCombat(vueCompagnon(p, e));

/** Son arme à distance, s'il en a une : il tire tant que personne n'est à son contact (flèches non comptées). */
export const tirCompagnon = (p: Partie, e: EtatCompagnon) => {
  const id = compagnon(e.id).equipe.distance;
  if (!id) return undefined;
  return { ad: valeursCompagnon(p, e).ad, degats: objet(id).degats ?? '1D', arme: objet(id).nom, recharge: objet(id).tir?.recharge ?? 2 };
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
  p.compagnons = [...groupe(p), { id, ev, evMax: ev, destin: lancer(4) - 1 }];
  noter(p, `${c.perso.nom} (${c.titre}) rejoint le groupe.`);
  return null;
};

/** Ses points de destin (règles V4 : 1D4−1) ; un compagnon arrivé avant cette règle les tire maintenant. */
export const destinCompagnon = (e: EtatCompagnon, rng?: Rng) => (e.destin ??= lancer(4, rng) - 1);

/**
 * Un compagnon tombé à 0 PV : un point de destin le ramène (1 PV), sinon il meurt pour de bon et quitte le groupe.
 * Renvoie le récit.
 */
export const tomber = (p: Partie, id: string, rng?: Rng): string => {
  const e = groupe(p).find((x) => x.id === id);
  if (!e) return '';
  const nom = compagnon(id).perso.nom;
  if (destinCompagnon(e, rng) > 0) {
    e.destin! -= 1;
    e.ev = 1;
    noter(p, `${nom} frôle la mort ; un point de destin le ramène.`);
    return `${nom} est tombé, mais le destin n'en a pas fini avec lui : il se relève avec 1 PV (il lui reste ${e.destin} point${e.destin! > 1 ? 's' : ''} de destin).`;
  }
  p.compagnons = groupe(p).filter((x) => x.id !== id);
  noter(p, `${nom} meurt au combat.`);
  return `${nom} est mort. Plus de point de destin pour lui : il ne se relèvera pas.`;
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

export const prenom = (id: string) => compagnon(id).perso.nom.split(' ')[0];
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

/**
 * Le butin se partage le soir, au campement ou à l'auberge : chaque compagnon attend sa part (EtatCompagnon.du).
 * On peut payer chacun séparément : régler les radins, garder la part de ceux qui ne regardent pas trop.
 * Une part pas payée à la nuit est une part gardée : il en veut au héros selon ce qu'elle représente
 * à côté de ce qu'il a coûté à l'embauche, et selon son goût pour l'or (choix maison, à valider).
 */

/** Ce que le groupe attend en tout. */
const recompter = (p: Partie) => {
  const total = arrondirOr(groupe(p).reduce((s, e) => s + (e.du ?? 0), 0));
  p.butin = total > 0 ? total : undefined;
};

/** Les vieilles sauvegardes n'avaient qu'un pot commun : on le répartit. */
const repartirAncien = (p: Partie) => {
  const g = groupe(p);
  if (!p.butin || !g.length || g.some((e) => e.du !== undefined)) return;
  for (const e of g) e.du = arrondirOr(p.butin / (g.length + 1));
};

/** Ajoute de l'or gagné avec le groupe : chacun a droit à sa part égale, héros compris (rien à partager quand on est seul). */
export const ajouterButin = (p: Partie, or: number) => {
  const g = groupe(p);
  if (or <= 0 || !g.length) return;
  repartirAncien(p);
  for (const e of g) e.du = arrondirOr((e.du ?? 0) + or / (g.length + 1));
  recompter(p);
};

/** Ce qu'on doit à ce compagnon (pièces entières). */
export const partDue = (p: Partie, e: EtatCompagnon) => {
  repartirAncien(p);
  return Math.floor(e.du ?? 0);
};

/** La part de chacun si l'on partage à parts égales, héros compris. */
export const partButin = (p: Partie) => Math.max(0, ...groupe(p).map((e) => partDue(p, e)));

/** Il a un faible pour l'or : plus il est cupide, plus une part oubliée lui reste en travers. */
export const appetit = (e: EtatCompagnon) => (a(e, 'cupide') ? 2 : 0) + (a(e, 'honneur') ? 1 : 0);

/** Donne à ce compagnon sa part. Renvoie la ligne à afficher, ou le refus. */
export const payerPart = (p: Partie, e: EtatCompagnon): string => {
  const part = partDue(p, e);
  if (!part) {
    e.du = 0;
    recompter(p);
    return `${prenom(e.id)} n'attend rien.`;
  }
  if (p.or < part) return `Il te manque ${arrondirOr(part - p.or)} PO pour payer ${prenom(e.id)}.`;
  p.or = arrondirOr(p.or - part);
  e.bourse = arrondirOr(bourseDe(e) + part);
  e.du = 0;
  recompter(p);
  noter(p, `donne sa part à ${prenom(e.id)} : ${part} PO.`);
  return apprecier(p, e, appetit(e) ? 2 : 1, `reçoit sa part, ${part} PO`) || `${prenom(e.id)} empoche ses ${part} PO.`;
};

export const partagerButin = (p: Partie): string[] => groupe(p).filter((e) => partDue(p, e) > 0).map((e) => payerPart(p, e));

/** Ce que lui coûte une part gardée : selon la somme (comparée à son prix d'embauche) et son goût pour l'or. */
export const rancune = (p: Partie, e: EtatCompagnon) => {
  const part = partDue(p, e);
  if (!part) return 0;
  const prix = compagnon(e.id).prix ?? 30;
  return Math.min(6, Math.floor((part / prix) * 4) + appetit(e));
};

/** La nuit tombe (ou le héros dit qu'il garde tout) : chaque part pas payée est une part gardée. */
export const garderButin = (p: Partie, raison = 'tu as gardé sa part du butin'): string[] => {
  repartirAncien(p);
  const lignes: string[] = [];
  for (const e of [...groupe(p)]) {
    const part = partDue(p, e);
    if (!part) continue;
    const r = rancune(p, e);
    e.du = 0;
    lignes.push(r ? apprecier(p, e, -r, `${raison} (${part} PO)`) : `${prenom(e.id)} ne réclame pas ses ${part} PO : il n'y tenait pas tant que ça.`);
  }
  recompter(p);
  return lignes.filter(Boolean);
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
