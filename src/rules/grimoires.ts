import DONNEES from './grimoires.json';

// Les grimoires officiels (magie généraliste, onze spécialités) et les manuels des prêtres et paladins
// (cinq dieux chacun), relevés page par page dans les PDF du site : nom, niveau, coût, épreuve, effets.
// Le jeu sait appliquer cinq familles d'effets en combat (dégâts, malus sur l'ennemi, bonus sur un allié,
// soins, frappe bénie) ; les sorts utilitaires (détection, serrures, lumière…) jouent hors combat, et les
// autres (rituels, invocations, enchantements) sont décrits dans le grimoire mais pas encore gérés par le jeu.
// Les sorts de niveau 1 à 3 ont été vérifiés un par un (scripts de relevé : voir le dossier magie2 du MJ).

export type CaracSort = 'MagiePhys' | 'MagiePsy' | 'INT' | 'CHA' | 'AT' | 'PRD' | 'aucune';

/** Un bonus ou un malus de combat : nombre, ou « niveau » (égal au niveau du lanceur). */
export type Mods = Partial<Record<'at' | 'prd' | 'pr' | 'cou' | 'degats' | 'fuite' | 'prTir' | 'degatsMainsNues', number | 'niveau'>> & { riposte?: string };

export type Effet =
  /** Dégâts sur une cible (ou sur la cible et ses voisins, zone). parNiveau : la formule change avec le niveau. */
  | {
      type: 'degats';
      des: string;
      bonusInt: boolean;
      zone?: boolean;
      ignoreArmure?: boolean;
      /** La cible tente de résister (épreuve sur sa résistance à la magie). */
      rm?: boolean;
      parNiveau?: [number, string][];
      /** La cible tombe (épreuve de FO −2 pour rester debout) : elle perd ce nombre d'assauts. */
      chute?: number;
      /** Les cibles ne peuvent plus agir pendant ce nombre d'assauts (tourbillon, glace aux pieds). */
      immobilise?: number;
      /** Armure de la cible abîmée (PR). */
      armure?: number;
      /** Le lanceur récupère les PV infligés. */
      vol?: boolean;
    }
  /** Un état sur l'ennemi : immobilisé, à terre, aveuglé, effrayé (il fuit), affaibli (malus). */
  | { type: 'malus'; etat: 'immobile' | 'au-sol' | 'aveugle' | 'peur' | 'faible'; assauts: number; rm?: boolean; zone?: boolean; mods?: Mods; immobile?: boolean }
  /** Un bonus sur soi, un allié ou tout le groupe, pour quelques assauts ou tout le combat (99). */
  | { type: 'bonus'; cible: 'soi' | 'allie' | 'groupe'; mods: Mods; assauts: number; gratuit?: boolean }
  /** Des PV rendus (dés, ou PA convertis en PV) ; graves : réduit aussi une fracture ou une hémorragie. */
  | { type: 'soin'; des?: string; parPA?: number; max?: string; groupe?: boolean; graves?: boolean; soi?: boolean }
  /** Une attaque bénie au corps à corps : bonus d'AT et de dégâts sur le prochain coup (ne coûte pas l'assaut). */
  | { type: 'frappe'; at: number; degats: number; parNiveau?: [number, number][] }
  /** Hors combat : un usage géré par le jeu, ou décrit seulement. */
  | { type: 'hors-combat'; usage?: 'priaka' | 'flumitor' | 'zorlaki' | 'lumiere' | 'invisibilite' };

export interface SortGrimoire {
  id: string;
  nom: string;
  niveau: number;
  ecole: string;
  /** PA de base (null : variable, voir coutTexte). */
  cout: number | null;
  coutTexte: string;
  carac: CaracSort;
  modif: number;
  /** Épreuve nécessaire seulement jusqu'à ce niveau : au-delà, le sort part tout seul. */
  jusqua: number | null;
  /** Durée d'incantation, en assauts. */
  incantation: number;
  duree: string;
  portee: string;
  effet: Effet;
  description: string;
  degatsTexte: string;
  benefices: string;
}

export const GRIMOIRES = DONNEES as unknown as SortGrimoire[];

export type Voie = 'mage' | 'pretre' | 'paladin';

export interface Ecole {
  id: string;
  nom: string;
  voie: Voie;
  /** Le grimoire est dans les ressources (sinon : grisée). */
  dispo: boolean;
  description: string;
  /** Spécialités seulement : pas de magie généraliste (invocateur), une seule spécialité (nécro, Tzinntch). */
  sansGeneraliste?: boolean;
  unique?: boolean;
  /** Prêtres et paladins : ce que demande le dieu. */
  dieu?: string;
  avantages?: string[];
  obligations?: string[];
}

// Les spécialités (« Manuel des types de magie ») : textes résumés.
export const ECOLES: Ecole[] = [
  { id: 'generaliste', nom: 'Magie généraliste', voie: 'mage', dispo: true, description: 'Enseignée à tous : soins, détection, ouvertures, contrôle mental, téléportations. Variée et peu dangereuse.' },
  { id: 'combat', nom: 'Magie de combat', voie: 'mage', dispo: true, description: "La voie des aventuriers : boules de feu, tourbillons, malédictions et protections. Jusqu'au niveau 14." },
  { id: 'feu', nom: 'Magie du feu', voie: 'mage', dispo: true, description: 'Gros dégâts pour peu de PA à bas niveau ; peu sélectif, gare aux équipiers.' },
  { id: 'eau-glace', nom: "Magie de l'eau et de la glace", voie: 'mage', dispo: true, description: 'Sorts offensifs puissants, protections, élémentaires ; moins dangereuse que le feu à bas niveau.' },
  { id: 'air', nom: "Magie de l'air", voie: 'mage', dispo: true, description: "Protections et assistance, peu d'attaques mais des sorts très agaçants pour l'ennemi." },
  { id: 'terre', nom: 'Magie de la terre', voie: 'mage', dispo: true, description: 'Camouflage, pièges, malédictions, attaques et défenses : une offre très complète.' },
  { id: 'thermo', nom: 'Thermodynamique', voie: 'mage', dispo: true, description: 'Austère à bas niveau, mais les sorts de haut niveau sont terriblement puissants.' },
  { id: 'meta', nom: 'Métamorphoses', voie: 'mage', dispo: true, description: 'Enseignée par les dieux du Chaos : spectaculaire, peu coûteuse, mais peu efficace au combat.' },
  { id: 'necro', nom: 'Nécromancie', voie: 'mage', dispo: true, unique: true, description: 'Sorts tranquilles à bas niveau, puissance qui grimpe vite, beaucoup de rituels. Une seule spécialité, et pas d\'amis.' },
  { id: 'invocation', nom: 'Invocation', voie: 'mage', dispo: true, sansGeneraliste: true, description: "Faire venir des créatures d'autres plans pour se faire servir. Pas de magie généraliste, deux spécialités au plus." },
  { id: 'tzinntch', nom: 'Magie noire de Tzinntch', voie: 'mage', dispo: true, unique: true, description: 'Réservée aux adeptes de la secte : sorts de combat plus puissants et moins chers, au prix de la santé.' },
  { id: 'illusion', nom: 'Illusion', voie: 'mage', dispo: false, description: "Économe en PA, idéale pour les diversions et faire fuir l'ennemi. Grimoire absent des ressources." },
  { id: 'domestique', nom: 'Magie domestique', voie: 'mage', dispo: false, description: "La magie des villes et des familles : eau, conservation, nettoyage, canard de bain. Grimoire absent des ressources." },
  // Prêtres et paladins : un dieu, un seul.
  {
    id: 'pretre-youclidh', nom: 'Prêtre de Youclidh', voie: 'pretre', dispo: true, dieu: 'Youclidh',
    description: 'Divinité de la santé et de la guérison : le meilleur soigneur de la Terre de Fangh.',
    avantages: ['Immunité aux maladies et poisons de Niourgl', 'COU, AT, PRD +2 contre Tzinntch, Khornettoh, Vaarb et Niourgl'],
    obligations: ['Armes contondantes uniquement', 'Ne jamais abandonner un allié blessé', 'Hygiène quotidienne (savon, brosse à dents)'],
  },
  {
    id: 'pretre-dlul', nom: 'Prêtre de Dlul', voie: 'pretre', dispo: true, dieu: 'Dlul',
    description: "Dieu du sommeil et de l'ennui : endort, assomme et protège sous la couette.",
    avantages: ['Bon sommeil : +50 % de PV et +25 % de PA au repos', 'AT, PRD +1 contre les peaux-vertes'],
    obligations: ['Pas d\'armes tranchantes, pointues ou à deux mains, pas d\'arbalète', 'Dormir 8 heures par jour, avec oreiller et pyjama'],
  },
  {
    id: 'pretre-adathie', nom: "Prêtre d'Adathie", voie: 'pretre', dispo: true, dieu: 'Adathie',
    description: 'Déesse de la justice et des merguez : soins équitables, glaive de la justice et barbecue divin.',
    avantages: ['Aucune restriction d\'arme ni de magie'],
    obligations: ['Armure limitée à PR 5', "Ne jamais laisser un compagnon derrière soi en fuyant", 'Toujours avoir sa fourchette sur soi'],
  },
  {
    id: 'pretre-slanoush', nom: 'Prêtre de Slanoush', voie: 'pretre', dispo: true, dieu: 'Slanoush',
    description: 'Dieu du plaisir et de la luxure : charmes, flagellations et armure de cuir.',
    avantages: ['Charmes et malédictions de déconcentration'],
    obligations: ['Pas d\'armure complète : du cuir, deux pièces au plus', 'Ne pas résister à une tentative de séduction'],
  },
  {
    id: 'pretre-niourgl', nom: 'Prêtre de Niourgl', voie: 'pretre', dispo: true, dieu: 'Niourgl',
    description: 'Dieu de la pestilence et de la décomposition : postillons, infections et mutations.',
    avantages: ['Résiste aux maladies qu\'il répand'],
    obligations: ['Ennemi juré des fidèles de Youclidh', 'Hygiène… déconseillée'],
  },
  {
    id: 'paladin-khornettoh', nom: 'Paladin de Khornettoh', voie: 'paladin', dispo: true, dieu: 'Khornettoh',
    description: 'Dieu de la violence : on frappe d\'abord, on frappe ensuite.',
    avantages: ['Aucune restriction d\'armure ni d\'objets magiques', 'Impact de Khornettoh dès le niveau 1'],
    obligations: ['Relique de Khornettoh obligatoire pour ses prodiges', 'Bastonner à vue les fidèles de Braav\' et Malgar', 'Pas de fuite sans une épreuve d\'INT'],
  },
  {
    id: 'paladin-braav', nom: "Paladin de Braav'", voie: 'paladin', dispo: true, dieu: "Braav'",
    description: 'Dieu de la justice et du courage : la force du bien, la dissipation du mal.',
    avantages: ['Force de Braav\' et soins par imposition des pieds'],
    obligations: ['Relique de Braav\' obligatoire pour ses prodiges', 'Pas de coups bas ni de mensonges'],
  },
  {
    id: 'paladin-dlul', nom: 'Paladin de Dlul', voie: 'paladin', dispo: true, dieu: 'Dlul',
    description: 'Le bras armé du dieu du sommeil : coups de polochon et aura d\'obscurité.',
    avantages: ['Conviction de Dlul dès le niveau 1'],
    obligations: ['Relique de Dlul obligatoire pour ses prodiges', 'Dormir 8 heures par jour'],
  },
  {
    id: 'paladin-slanoush', nom: 'Paladin de Slanoush', voie: 'paladin', dispo: true, dieu: 'Slanoush',
    description: 'Le chevalier du plaisir : punitions méritées et armure de cuir bénie.',
    avantages: ['Punition méritée dès le niveau 1'],
    obligations: ['Relique de Slanoush obligatoire pour ses prodiges', 'Armures de cuir de préférence'],
  },
  {
    id: 'paladin-niourgl', nom: 'Paladin de Niourgl', voie: 'paladin', dispo: true, dieu: 'Niourgl',
    description: 'Le croisé de la pestilence : postillons glaireux et carapace de blatte.',
    avantages: ['Prodiges d\'infection dès le niveau 1'],
    obligations: ['Relique de Niourgl obligatoire pour ses prodiges', 'Ennemi des fidèles de Youclidh'],
  },
];

export const ecole = (id: string) => ECOLES.find((e) => e.id === id);

/** Les sorts d'un grimoire (ou d'un manuel de prêtre), du niveau 1 au niveau `max`. */
export const sortsDe = (ecoleId: string, max = 99) => GRIMOIRES.filter((s) => s.ecole === ecoleId && s.niveau <= max);

export const sortGrimoire = (id: string) => GRIMOIRES.find((s) => s.id === id);

/** Les spécialités qu'un mage peut prendre au niveau 1. */
export const specialitesMage = () => ECOLES.filter((e) => e.voie === 'mage' && e.id !== 'generaliste');

/** Les dieux qu'un prêtre (ou un paladin) peut servir. */
export const cultes = (voie: 'pretre' | 'paladin') => ECOLES.filter((e) => e.voie === voie);

/** Prix d'un grimoire de spécialité (règles : « les livres coûtent cher » ; prix maison). */
export const PRIX_GRIMOIRE = 400;
export const objetGrimoire = (ecoleId: string) => `grimoire-${ecoleId}`;
