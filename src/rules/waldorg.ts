// Waldorg, ville du prototype. Lieux et descriptions d'après « Waldorg pour le MJ ».
// Les positions sont en pourcentage du plan « Waldorg-simple », recalées sur les cartes MJ par zone.

export type TypeLieu = 'porte' | 'info' | 'marche' | 'bar' | 'auberge' | 'emplois' | 'boutique' | 'soins' | 'caisse';

export interface Boutique {
  /** Objets proposés à la vente. */
  stock: string[];
  /** Multiplicateur appliqué aux prix du catalogue (ex. potions -25 % à Waldorg). */
  prix: number;
  /** Part du prix catalogue que le marchand paie quand il rachète. Absent : il ne rachète pas. */
  rachat?: number;
  /** Types d'objets rachetés. */
  rachete?: string[];
}

export interface Lieu {
  id: string;
  nom: string;
  type: TypeLieu;
  x: number;
  y: number;
  quartier: string;
  description: string;
  boutique?: Boutique;
  /** Auberge : prix du repas et de la chambre, confort de la nuit. */
  auberge?: { repas: number; chambre: number; confort: 'mauvais' | 'normal' | 'excellent' };
  /** Bar : prix de la chope. */
  chope?: number;
  /** Clinique : prix d'un point de vie soigné. */
  prixSoin?: number;
  rumeurs?: 'normales' | 'louches';
  /** Un bouton qui donne une information (plan gratuit, formulaire…). */
  action?: { bouton: string; texte: string };
}

const MATERIEL = ['sac', 'briquet', 'couverture', 'gourde', 'chaussettes', 'rations', 'corde', 'torche', 'lampe', 'matelas'];

export const LIEUX: Lieu[] = [
  {
    id: 'porte',
    nom: 'Porte ouest et souk',
    type: 'porte',
    x: 3.5,
    y: 43.5,
    quartier: 'Banlieue',
    description:
      "Avant d'entrer en ville, il faut traverser le souk de la banlieue, où l'on se perd facilement, puis parler aux gardes. Les aventuriers sont une manne commerciale : on les accueille plutôt bien. Les petits marchands qui n'ont pas le droit d'entrer vendent ici du matériel de base.",
    boutique: { stock: [...MATERIEL, 'gourdin', 'baton'], prix: 1, rachat: 0.3, rachete: ['materiel', 'arme'] },
  },
  {
    id: 'tourisme',
    nom: "Guérite de l'Office du Tourisme",
    type: 'info',
    x: 46.2,
    y: 16,
    quartier: 'Nord-Ouest',
    description:
      "Un employé en uniforme jaune moutarde distribue des plans gratuits de la ville et des conseils que personne ne lui demande. Il est ravi de voir un aventurier : « Bienvenue à Waldorg, capitale de la Terre de Fangh et de la magie de haut niveau ! »",
    action: {
      bouton: 'Demander un plan gratuit',
      texte:
        "L'employé te tend un plan et récite : « Au nord-ouest, le stade, les écoles de magie et le marché. Au nord-est, le palais et les riches : évitez d'y traîner. Au sud-ouest, le fort, les armureries et la Guilde des voleurs. Au sud-est, le port, le poisson et les marins. Bonne visite ! »",
    },
  },
  {
    id: 'moriacs',
    nom: 'Place des Moriacs',
    type: 'marche',
    x: 27.5,
    y: 31.1,
    quartier: 'Nord-Ouest',
    description:
      "Le grand comptoir de commerce. Deux fois par mois s'y tient le marché populaire : les gens de la plaine installent leurs étals autour du comptoir. Ça crie, ça marchande, ça sent le fromage.",
    boutique: { stock: [...MATERIEL], prix: 1, rachat: 0.4, rachete: ['materiel'] },
  },
  {
    id: 'childeric',
    nom: 'Le Bistrot Childéric',
    type: 'bar',
    x: 43.5,
    y: 27.5,
    quartier: 'Nord-Ouest',
    description:
      "Un bar assez connu et bien placé, dans lequel on peut apprendre des tas de choses. Le patron essuie toujours le même verre, et les habitués parlent fort.",
    chope: 2,
    rumeurs: 'normales',
  },
  {
    id: 'sportif',
    nom: 'Le Sportif Rassasié',
    type: 'auberge',
    x: 35.1,
    y: 41.1,
    quartier: 'Nord-Ouest',
    description:
      "Auberge, restaurant et hôtel renommé et immense, face au stade de Brute-ball. Les lits sont moelleux, les draps propres, et les prix piquent un peu : à Waldorg, l'hôtellerie coûte cher.",
    auberge: { repas: 4, chambre: 10, confort: 'excellent' },
  },
  {
    id: 'emplois',
    nom: 'Bureau des emplois',
    type: 'emplois',
    x: 59.5,
    y: 32.2,
    quartier: 'Nord-Est',
    description:
      "Pour trouver du travail ou des missions. Un fonctionnaire à lunettes tamponne des formulaires derrière un guichet. Une affiche annonce : « Aventuriers : déclarez vos butins ! »",
  },
  {
    id: 'mulfido',
    nom: 'Chez Mulfido',
    type: 'boutique',
    x: 47.6,
    y: 54.8,
    quartier: 'Sud-Ouest',
    description:
      "Le plus grand spécialiste des potions de la ville : bons prix, bonnes affaires. À Waldorg, la concurrence fait baisser le prix des potions d'un quart.",
    boutique: { stock: ['potion-soin', 'potion-plaies', 'potion-soin-forte'], prix: 0.75, rachat: 0.5, rachete: ['potion'] },
  },
  {
    id: 'lames',
    nom: 'La Caverne aux Lames',
    type: 'boutique',
    x: 31.7,
    y: 65.7,
    quartier: 'Sud-Ouest',
    description:
      "Une bonne armurerie, près du fort militaire. On y trouve des armes neuves et le surplus de l'armée de Waldorg, à peine utilisé.",
    boutique: {
      stock: ['dague-base', 'dague-qualite', 'dague-recourbee', 'epee-correcte', 'epee-bonne', 'glaive-allonge', 'glaive-bleusaille', 'hache-correcte', 'hache-bleusaille', 'marteau-correct', 'lance-base', 'batarde', 'claymore-bleusaille', 'epee-2m-base', 'baton-sorcier', 'gambison-correct', 'plastron-cuir-bouilli', 'plastron-cuir-renforce', 'cotte-sans-manches', 'tenue-eclaireur', 'tenue-lourde'],
      prix: 1,
      rachat: 0.5,
      rachete: ['arme', 'armure'],
    },
  },
  {
    id: 'bazar',
    nom: 'Grand bazar de Gurdu-la-Jaille',
    type: 'boutique',
    x: 40.7,
    y: 69.1,
    quartier: 'Sud-Ouest',
    description:
      "Tout acheter, tout vendre… Attention, le patron est roublard : il rachète tout, mais pas cher, et ses prix sont un peu gonflés.",
    boutique: {
      stock: ['vetements-rembourres', 'veste-cuir', 'plastron-cuir', 'gourdin', 'baton', 'couteau-qualite', 'poignard-base', 'dague-bleusaille', 'epee-perrave', 'hache-2m-grossiere', 'baton-sorcier-perrave', 'outils-crochetage', 'instrument', 'corde', 'torche', 'rations'],
      prix: 1.1,
      rachat: 0.4,
      rachete: ['arme', 'armure', 'potion', 'materiel'],
    },
  },
  {
    id: 'caisse',
    nom: 'Caisse des Donjons',
    type: 'caisse',
    x: 36.9,
    y: 85,
    quartier: 'Sud-Ouest',
    description:
      "L'annexe de la Caisse des Donjons de la Terre de Fangh, circonscription Est. Ici, on enregistre les donjons, leurs propriétaires et les aventuriers qui les visitent. Un guichetier blasé vous tend un formulaire de douze pages.",
    action: {
      bouton: "Remplir le formulaire d'aventurier",
      texte:
        "Tu remplis douze pages : nom, origine, nombre de bras, allergies, donjons déjà visités. Le guichetier tamponne le tout sans le lire. « Revenez quand vous aurez un donjon à déclarer. »",
    },
  },
  {
    id: 'dague',
    nom: 'Bistrot de la Dague Bleue',
    type: 'bar',
    x: 45.6,
    y: 87.8,
    quartier: 'Sud-Ouest',
    description:
      "Un bar très mal famé, bourré de voleurs et d'espions. Tout le monde vous regarde entrer, puis fait semblant de ne pas vous avoir vu. Gardez une main sur votre bourse.",
    chope: 1,
    rumeurs: 'louches',
  },
  {
    id: 'clinique',
    nom: 'Clinique du Secours',
    type: 'soins',
    x: 67.4,
    y: 78.8,
    quartier: 'Sud-Est',
    description:
      "Un centre de soins qui fait aussi appel aux talents d'un mage : on dit qu'il peut recoller les membres. Les services sont chers à Waldorg, mais on ressort en un seul morceau.",
    prixSoin: 3,
  },
  {
    id: 'barcasse',
    nom: 'La Barcasse',
    type: 'auberge',
    x: 64.1,
    y: 87.3,
    quartier: 'Sud-Est',
    description:
      "Une gigantesque auberge pas chère, pleine de marins avinés : l'adresse des aventuriers fauchés. Les matelas sont bosselés et les voisins chantent jusqu'à l'aube.",
    auberge: { repas: 1, chambre: 2, confort: 'normal' },
  },
];

export const RUMEURS_NORMALES = [
  "Il paraît que le fermier Barnabé, au nord-ouest, ne dort plus : des gobelins lui volent ses poules depuis les grottes de la colline. Le Bureau des emplois cherche quelqu'un.",
  "Le mage Yeronimus Boulak rend des services, mais ne lui envoyez pas d'elfe. Vraiment pas.",
  "L'équipe de Brute-ball de Waldorg a encore perdu. Les supporters ont mangé l'arbitre. Enfin, presque.",
  "Chez Mulfido, les potions sont moins chères qu'à Glargh. Mais celles de Glargh sentent moins le pied.",
  "Le Grand bazar de Gurdu-la-Jaille vous rachète tout, mais il vous plume au passage.",
  "La Caisse des Donjons a augmenté sa taxe de visite. Les gobelins ne la paient jamais, eux.",
  "Méfie-toi du canal de Xaraz quand il descend vers le sud : on y jette tout et n'importe quoi.",
  "Les gardes du quartier nord-est sont des soldats d'élite. Ils préfèrent les cachots aux discussions.",
];

export const RUMEURS_LOUCHES = [
  "Pour un peu d'or, un type en capuche te dit que la Guilde des Assassins et Voleurs recrute. Ou qu'elle cherche des victimes, il n'a pas été très clair.",
  "Les gobelins de la colline ont un chef qui se fait appeler « le Grand Zgrot ». Il collectionne les casques d'aventuriers.",
  "Au port de pêche, des cargaisons disparaissent toutes les nuits. Personne n'a rien vu, évidemment.",
  "Un espion t'assure qu'il y a un trésor au fond des grottes gobelines. Il ne dit pas pourquoi il n'y est pas allé lui-même.",
];

export const lieu = (id: string): Lieu => {
  const l = LIEUX.find((x) => x.id === id);
  if (!l) throw new Error(`Lieu inconnu : ${id}`);
  return l;
};
