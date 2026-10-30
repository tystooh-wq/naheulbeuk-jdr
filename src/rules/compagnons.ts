import { calculerFiche, type Fiche, type Personnage } from './creation';
import { objet } from './objets';
import { noter, valeursCombat, type Equipement, type EtatCompagnon, type Partie } from './partie';

// Les compagnons : des personnages complets (origine, métier, caractéristiques, compétences, équipement),
// créés avec les mêmes règles que le héros. Ils suivent le héros, se battent à ses côtés (leurs dés
// roulent tout seuls, comme ceux du MJ) et se reposent avec lui. Plus tard : un groupe qui décide
// lui-même, que le héros influence selon son Charisme.

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
