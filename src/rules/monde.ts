import type { Zone } from './rencontres';

// Carte du monde : la Terre de Fangh (carte officielle de John Lang, 3000 × 2000 pixels).
// Les positions sont en pixels de cette carte. Les pistes suivent les pointillés de la carte ;
// celles marquées « hors piste » traversent la lande ou les dunes, là où la carte n'a pas de chemin.

export type Point = [number, number];

export const CARTE_MONDE = { largeur: 3000, hauteur: 2000 };

/** Échelle de la carte : la barre de 60 km mesure 558 pixels. */
export const PX_PAR_KM = 558.5 / 60;

export type Terrain = 'sentier' | 'plaine' | 'dunes';

/** Supplément « Déplacements et transport », voyage à pied (km par jour). */
export const KM_PAR_JOUR: Record<Terrain, { normale: number; forcee: number }> = {
  sentier: { normale: 30, forcee: 45 },
  plaine: { normale: 30, forcee: 45 },
  // « Désert chaud » : les dunes waldorgaises sont arides mais petites.
  dunes: { normale: 26, forcee: 38 },
};

/** Une journée de voyage compte une dizaine d'heures de route, pauses comprises. */
export const HEURES_DE_ROUTE_PAR_JOUR = 10;
/** La nuit tombe à 20 h ; on ne repart pas avant 6 h. */
export const CREPUSCULE = 20;
export const AUBE = 6;

export const NOM_TERRAIN: Record<Terrain, string> = { sentier: 'piste', plaine: 'hors piste, lande', dunes: 'hors piste, dunes' };

export type TypeLieuMonde = 'ville' | 'village' | 'campement' | 'grotte' | 'bac' | 'donjon' | 'mine';

export interface LieuMonde {
  id: string;
  nom: string;
  type: TypeLieuMonde;
  x: number;
  y: number;
  description: string;
  /** Une auberge de campagne (tarifs du tableau « Matériel et services » : auberge pourrie ou de qualité). */
  auberge?: { nom: string; repas: number; chambre: number; confort: 'mauvais' | 'normal' | 'excellent' };
  /** On peut y acheter des rations. */
  rations?: number;
  /** Nom absent de la carte officielle : il a été inventé pour le jeu. */
  inventeNom?: boolean;
  /** Région, pour la table de rencontres (terres sauvages par défaut). */
  zone?: Zone;
  /** On peut y entrer : identifiant du plan de ville jouable. */
  ville?: string;
  /** Ville cartographiée dont le plan n'est pas encore jouable. */
  planAVenir?: boolean;
  /** Services d'un village (sans plan) : échoppe, guérisseur… */
  echoppe?: boolean;
  guerisseur?: number;
}

export const LIEUX_MONDE: LieuMonde[] = [
  {
    id: 'waldorg',
    nom: 'Waldorg',
    type: 'ville',
    x: 2442,
    y: 1325,
    description: "La capitale de la Terre de Fangh, au bord du fleuve Syé et de la mer d'Embarh. Ses tours se voient de loin, ses impôts aussi.",
    ville: 'waldorg',
  },
  {
    id: 'grangu',
    nom: 'Grangu',
    type: 'village',
    x: 2335,
    y: 1282,
    description: 'Un gros village côtier à l\'ouest de Waldorg. Des pêcheurs, des filets qui sèchent et une odeur de poisson qui ne part jamais vraiment.',
    auberge: { nom: 'Auberge du Hareng Fatigué', repas: 1, chambre: 2, confort: 'normal' },
    rations: 4,
  },
  {
    id: 'sival',
    nom: 'Sival',
    type: 'village',
    x: 2515,
    y: 1240,
    description: 'Village côtier au nord-est de Waldorg, à l\'embouchure de la Nervi. On dit que l\'eau de la rivière sent parfois les pieds d\'orque.',
    auberge: { nom: 'Taverne de la Nervi', repas: 1, chambre: 2, confort: 'normal' },
    rations: 4,
  },
  {
    id: 'hameau',
    nom: 'Hameau de la côte',
    type: 'village',
    x: 2280,
    y: 1264,
    inventeNom: true,
    description: "Quelques maisons de pêcheurs, là où la piste de Fierpâté rejoint la côte. Ici, on loue une paillasse et on ne pose pas de questions.",
    auberge: { nom: 'Paillasse chez la veuve Moule', repas: 1, chambre: 1, confort: 'mauvais' },
  },
  {
    id: 'bac',
    nom: 'Embarcadère du bac',
    type: 'bac',
    x: 2554,
    y: 1167,
    inventeNom: true,
    description: "Un ponton sur le fleuve Syé, en face de Jeanlaf. Le passeur fait traverser vers la Caladie, quand il n'a pas trop bu.",
  },
  {
    id: 'campement',
    nom: 'Campement de nomades',
    type: 'campement',
    x: 2482,
    y: 1075,
    description: 'Des tentes colorées au bord des Terres Sauvages. Les nomades des dunes y vendent du thé à la menthe et des tapis qui ne volent pas.',
    rations: 4,
  },
  {
    id: 'biouro',
    nom: 'Biouro',
    type: 'village',
    x: 2425,
    y: 992,
    description: 'Un village de bûcherons à la lisière du bois N\'talamela. Les elfes du bois viennent y râler contre le bruit des haches.',
    auberge: { nom: 'Le Copeau Joyeux', repas: 1, chambre: 2, confort: 'normal' },
    rations: 4,
  },
  {
    id: 'fierpate',
    nom: 'Fierpâté',
    type: 'village',
    x: 2100,
    y: 1007,
    description: 'Le village des semi-hommes, célèbre pour sa charcuterie, ses fromages et ses plats cuisinés. On y mange six fois par jour, au minimum.',
    auberge: { nom: 'La Panse Comblée', repas: 2, chambre: 6, confort: 'excellent' },
    rations: 4,
  },
  {
    id: 'grottes',
    nom: 'Grottes de Fariliik',
    type: 'grotte',
    x: 2395,
    y: 1182,
    description:
      "Une zone rocheuse qui émerge des dunes. Les cavernes abritent parfois de grandes créatures, et parfois des peaux-vertes : orques, gobelins, et même trogylorks. L'armée les a « nettoyées » plusieurs fois. Ils reviennent toujours.",
  },
  // --- L'ouest : Valtordu et la campagne paisible ----------------------------------
  {
    id: 'valtordu',
    nom: 'Valtordu',
    type: 'ville',
    x: 385,
    y: 1160,
    zone: 'campagne',
    ville: 'valtordu',
    description:
      "Un village moyen à l'extrême sud-ouest de la Terre de Fangh, près de la forêt d'Ouien. On y vit du mouton, du boudin au sang (exporté jusqu'à Glargh) et de pulls très chauds aux motifs affreux. L'endroit idéal pour commencer une carrière d'aventurier.",
  },
  {
    id: 'donjon-naheulbeuk',
    nom: 'Donjon de Naheulbeuk',
    type: 'donjon',
    x: 517,
    y: 1195,
    zone: 'campagne',
    description:
      "La tour du sorcier Zangdar, à une dizaine de kilomètres à l'est de Valtordu, au-delà du bosquet de Tronchenbiais. Douze niveaux de pièges idiots et de monstres syndiqués. Les aventuriers débutants y entrent nombreux ; ils en ressortent moins.",
  },
  {
    id: 'loubet',
    nom: 'Loubet',
    type: 'village',
    x: 537,
    y: 1333,
    zone: 'campagne',
    planAVenir: true,
    echoppe: true,
    description:
      "Le village sans aventure, sur la rivière Glandebruine, en aval de Valtordu. Son seul fait d'armes : un gamin de huit ans (le futur Ranger) y a réparé un fauteuil à bascule. Ville-étape sur la route du sud.",
    auberge: { nom: "L'Auberge du Fauteuil", repas: 1, chambre: 2, confort: 'normal' },
    rations: 4,
  },
  {
    id: 'varig',
    nom: 'Varig-le-Feuillu',
    type: 'village',
    x: 290,
    y: 900,
    zone: 'campagne',
    description: "Un village de bûcherons entre la forêt d'Ouien et le bois de Glandorn. Ici, on parle aux arbres, et parfois ils répondent.",
    auberge: { nom: 'La Bûche Ronflante', repas: 1, chambre: 2, confort: 'normal' },
    rations: 4,
  },
  {
    id: 'ilaral',
    nom: 'Ilaral',
    type: 'village',
    x: 95,
    y: 945,
    zone: 'foret',
    description: "Un château au bout du monde connu, au pied de la passe de Ropolk. Au-delà, il n'y a plus que des légendes et des courants d'air.",
  },
  {
    id: 'tronville',
    nom: 'Tronville',
    type: 'village',
    x: 735,
    y: 1025,
    zone: 'campagne',
    description: "Un village paisible au nord-ouest des Chênes d'Ulgargh, sur la route de Chnafon. Les sylvains de la forêt viennent y vendre du miel et des regards méprisants.",
    auberge: { nom: 'Le Gland Ivre', repas: 1, chambre: 2, confort: 'normal' },
    rations: 4,
  },
  {
    id: 'ahokd',
    nom: "Grotte d'Ahokd",
    type: 'grotte',
    x: 612,
    y: 930,
    zone: 'campagne',
    description: "Une grande caverne dans un éperon rocheux, entre Tronville et Boladar. On y entend des ronflements. Mieux vaut ne pas savoir de quoi.",
  },
  // --- Le centre-ouest : Chnafon, Mliuej et les montagnes ------------------------------
  {
    id: 'chnafon',
    nom: 'Chnafon',
    type: 'ville',
    x: 882,
    y: 888,
    zone: 'campagne',
    planAVenir: true,
    echoppe: true,
    guerisseur: 2,
    description:
      "Une ville fortifiée au bord du lac de Zblouf, avec son château, son école de magie, sa guilde des voleurs et sa guilde des marchands (qui ne s'aiment pas). À la porte, les gardes demandent parfois un « droit de passage ».",
    auberge: { nom: 'La Chaise Boiteuse', repas: 1, chambre: 2, confort: 'normal' },
    rations: 4,
  },
  {
    id: 'boladar',
    nom: 'Boladar',
    type: 'village',
    x: 675,
    y: 800,
    zone: 'foret',
    description: 'Un village de bord de rivière, au sud de Mliuej. Les bateliers y font étape pour boire une bière, puis une autre.',
    auberge: { nom: 'Le Bateau Ivre', repas: 1, chambre: 2, confort: 'mauvais' },
    rations: 4,
  },
  {
    id: 'mliuej',
    nom: 'Mliuej',
    type: 'ville',
    x: 780,
    y: 695,
    zone: 'campagne',
    planAVenir: true,
    echoppe: true,
    guerisseur: 2,
    description:
      "La capitale de la bière ! Quatre brasseries, une école de brassage, un marché aux bières et des nains partout. Le Temple de la Bière n'est pas un lieu de culte, quoique.",
    auberge: { nom: 'Les 16 Chopines', repas: 2, chambre: 6, confort: 'excellent' },
    rations: 4,
  },
  {
    id: 'birtek',
    nom: 'Birtek',
    type: 'village',
    x: 765,
    y: 535,
    zone: 'foret',
    description: 'Le village au pied de la montagne de Jambfer. On y voit passer des wagonnets de minerai et des nains qui râlent.',
    auberge: { nom: 'Le Wagonnet', repas: 1, chambre: 2, confort: 'normal' },
    rations: 4,
  },
  {
    id: 'jambfer',
    nom: 'Mine de Jambfer',
    type: 'mine',
    x: 725,
    y: 465,
    zone: 'foret',
    planAVenir: true,
    description:
      "La cité souterraine des nains, berceau du Nain de la compagnie des Fiers de Hache. Tous les PNJ y sont chiants et radins, mais la bière est bonne et les haches excellentes.",
  },
  {
    id: 'gzor',
    nom: 'Gzor',
    type: 'ville',
    x: 1015,
    y: 425,
    zone: 'foret',
    description: "La cité noire du sorcier Gzor, dans les montagnes du Nord. Des tours pointues, des corbeaux, et des gardes qui ne sourient jamais. Les aventuriers sensés font le détour.",
  },
  {
    id: 'mlauke',
    nom: 'Mlaüke',
    type: 'village',
    x: 975,
    y: 720,
    zone: 'foret',
    description: 'Un village de pêcheurs sur le fleuve, entre Mliuej et la forêt de Schlipak.',
    auberge: { nom: 'Le Brochet Moqueur', repas: 1, chambre: 2, confort: 'normal' },
    rations: 4,
  },
  {
    id: 'juenal',
    nom: 'Juenal',
    type: 'village',
    x: 1320,
    y: 670,
    zone: 'foret',
    description: 'Un village fortifié au nord de la forêt de Schlipak, là où la route quitte le fleuve vers le marécage.',
    auberge: { nom: 'Le Pont Levé', repas: 1, chambre: 2, confort: 'normal' },
    rations: 4,
  },
  // --- Le centre : Glargh, Tulamor, Kjaniouf -------------------------------------------
  {
    id: 'plorodou',
    nom: 'Plorodou',
    type: 'village',
    x: 1100,
    y: 1035,
    zone: 'foret',
    description: 'Un village au bord du lac de Zblouf, à la lisière de la forêt de Schlipak. On y pêche, on y bâille.',
    auberge: { nom: 'Le Lac Tranquille', repas: 1, chambre: 2, confort: 'normal' },
    rations: 4,
  },
  {
    id: 'tulamor',
    nom: 'Tulamor',
    type: 'ville',
    x: 1172,
    y: 1205,
    zone: 'campagne',
    planAVenir: true,
    echoppe: true,
    guerisseur: 2,
    description:
      "Un village important au sud de la forêt de Schlipak, carrefour des routes Glargh-Zoyek-Noghall et Kjaniouf-Plorodou-Chnafon-Mliuej. Plaque tournante commerciale, avec la magicienne Barmizva, le tailleur de gemmes Kurvil et Francis, le patron du bazar, toujours au courant des affaires louches.",
    auberge: { nom: 'Le Carrefour', repas: 1, chambre: 2, confort: 'normal' },
    rations: 4,
  },
  {
    id: 'doduville',
    nom: 'Doduville',
    type: 'village',
    x: 1275,
    y: 1265,
    zone: 'campagne',
    description: 'Un village de fermiers au sud-est de Tulamor. Les vaches y sont plus nombreuses que les habitants, et plus bavardes.',
    auberge: { nom: 'La Vache Qui Rêve', repas: 1, chambre: 2, confort: 'mauvais' },
    rations: 4,
  },
  {
    id: 'zoyek',
    nom: 'Zoyek',
    type: 'village',
    x: 1435,
    y: 1015,
    zone: 'foret',
    description: "Un bourg au bord du fleuve, en face de Glargh, au pied de la forêt de Schlipak. Les bateliers y attendent le passage du pont.",
    auberge: { nom: 'Le Bac à Bière', repas: 1, chambre: 2, confort: 'normal' },
    rations: 4,
  },
  {
    id: 'ranuf',
    nom: 'Ranuf',
    type: 'village',
    x: 1475,
    y: 965,
    zone: 'foret',
    description: 'Un hameau sur la rive du fleuve, au nord de Zoyek, face au marécage de l\'éternelle agonie. Les habitants ont le teint gris et l\'humour aussi.',
  },
  {
    id: 'glargh',
    nom: 'Glargh',
    type: 'ville',
    x: 1568,
    y: 1070,
    zone: 'terres-sauvages',
    planAVenir: true,
    echoppe: true,
    guerisseur: 2,
    description:
      "La grande cité du centre, sur le fleuve Elibed : musée, temples de Braav', de Caddyro et de Dlul, grand comptoir marchand, librairie pour sorciers, entrepôts des bateliers et police fluviale. On y trouve de tout, surtout des ennuis.",
    auberge: { nom: 'La Fourchette Vaillante', repas: 1, chambre: 2, confort: 'normal' },
    rations: 4,
  },
  {
    id: 'bardol',
    nom: 'Bardol',
    type: 'village',
    x: 1430,
    y: 1165,
    zone: 'campagne',
    description: 'Un village de la rive ouest du fleuve, au sud de Glargh. On y élève des oies, qui gardent le village mieux que la milice.',
    auberge: { nom: "L'Oie Sauvage", repas: 1, chambre: 2, confort: 'normal' },
    rations: 4,
  },
  {
    id: 'kjaniouf',
    nom: 'Kjaniouf',
    type: 'ville',
    x: 1570,
    y: 1285,
    zone: 'terres-sauvages',
    planAVenir: true,
    echoppe: true,
    guerisseur: 2,
    description:
      "Le « Comptoir du Centre », près de l'embouchure du fleuve Elibed. Marchands, poissons, docks animés la nuit et goudilles, ces célèbres biscuits. Les gardes y sont aguerris : les Pirates Mauves attaquent parfois.",
    auberge: { nom: 'La Goudille Dorée', repas: 1, chambre: 2, confort: 'normal' },
    rations: 4,
  },
  {
    id: 'bourg-de-baie',
    nom: 'Bourg-de-Baie',
    type: 'village',
    x: 1900,
    y: 1230,
    description: "Un village côtier des Terres sauvages de Kwzprtt, face à la crique des Pirates Mauves. Les habitants ferment leurs volets au moindre bruit de rame.",
    auberge: { nom: 'La Rame Cassée', repas: 1, chambre: 2, confort: 'mauvais' },
    rations: 4,
  },
  {
    id: 'rillettebourg',
    nom: 'Rillettebourg',
    type: 'village',
    x: 1970,
    y: 900,
    zone: 'campagne',
    description: "Un village des semi-hommes dans les collines d'Altrouille, voisin de Fierpâté. Spécialité : les rillettes, sous toutes les formes connues et quelques autres.",
    auberge: { nom: 'Le Pot de Rillettes', repas: 2, chambre: 6, confort: 'excellent' },
    rations: 4,
  },
  {
    id: 'fquiepou',
    nom: 'Fquiepou',
    type: 'ville',
    x: 2530,
    y: 955,
    planAVenir: true,
    echoppe: true,
    guerisseur: 2,
    description:
      "Le « Joyau de l'Est », au sud du bois N'talamela, sur le fleuve Syé : son savon célèbre (ingrédient magique qui lave aussi n'importe quoi), sa halle aux poissons, ses nains blonds de l'Est et ses sylvains qui les évitent.",
    auberge: { nom: 'Le Savon Doré', repas: 1, chambre: 2, confort: 'normal' },
    rations: 4,
  },
];

export interface Piste {
  de: string;
  vers: string;
  terrain: Terrain;
  points: Point[];
}

export const PISTES: Piste[] = [
  { de: 'waldorg', vers: 'grangu', terrain: 'sentier', points: [[2442, 1325], [2405, 1342], [2370, 1330], [2335, 1282]] },
  { de: 'waldorg', vers: 'sival', terrain: 'sentier', points: [[2442, 1325], [2480, 1300], [2502, 1285], [2515, 1240]] },
  { de: 'grangu', vers: 'sival', terrain: 'sentier', points: [[2335, 1282], [2400, 1277], [2450, 1268], [2485, 1255], [2515, 1240]] },
  { de: 'grangu', vers: 'hameau', terrain: 'sentier', points: [[2335, 1282], [2300, 1268], [2280, 1264]] },
  {
    de: 'hameau',
    vers: 'fierpate',
    terrain: 'sentier',
    points: [[2280, 1264], [2262, 1235], [2253, 1200], [2250, 1160], [2240, 1130], [2220, 1100], [2190, 1080], [2150, 1060], [2120, 1035], [2100, 1007]],
  },
  { de: 'sival', vers: 'bac', terrain: 'sentier', points: [[2515, 1240], [2530, 1215], [2545, 1190], [2554, 1167]] },
  { de: 'bac', vers: 'campement', terrain: 'sentier', points: [[2554, 1167], [2520, 1158], [2497, 1130], [2492, 1100], [2482, 1075]] },
  { de: 'campement', vers: 'biouro', terrain: 'sentier', points: [[2482, 1075], [2490, 1050], [2480, 1025], [2460, 1005], [2425, 992]] },
  // Hors piste : la carte ne trace aucun chemin jusqu'aux grottes.
  { de: 'waldorg', vers: 'grottes', terrain: 'dunes', points: [[2442, 1325], [2440, 1290], [2425, 1240], [2405, 1205], [2395, 1182]] },
  { de: 'sival', vers: 'grottes', terrain: 'dunes', points: [[2515, 1240], [2480, 1220], [2440, 1200], [2395, 1182]] },
  { de: 'grangu', vers: 'grottes', terrain: 'dunes', points: [[2335, 1282], [2345, 1260], [2370, 1220], [2395, 1182]] },
  { de: 'grottes', vers: 'campement', terrain: 'plaine', points: [[2395, 1182], [2430, 1130], [2482, 1075]] },
  // --- Ouest ---------------------------------------------------------------------------------
  { de: 'valtordu', vers: 'donjon-naheulbeuk', terrain: 'sentier', points: [[385, 1160], [405, 1205], [450, 1210], [490, 1203], [517, 1195]] },
  { de: 'valtordu', vers: 'loubet', terrain: 'sentier', points: [[385, 1160], [400, 1225], [415, 1280], [450, 1310], [495, 1328], [537, 1333]] },
  { de: 'valtordu', vers: 'varig', terrain: 'sentier', points: [[385, 1160], [372, 1100], [365, 1030], [350, 960], [320, 920], [290, 900]] },
  { de: 'varig', vers: 'ilaral', terrain: 'sentier', points: [[290, 900], [240, 915], [180, 930], [130, 940], [95, 945]] },
  { de: 'valtordu', vers: 'tronville', terrain: 'sentier', points: [[385, 1160], [440, 1140], [500, 1120], [570, 1090], [640, 1060], [700, 1040], [735, 1025]] },
  { de: 'tronville', vers: 'ahokd', terrain: 'sentier', points: [[735, 1025], [690, 990], [650, 960], [612, 930]] },
  { de: 'tronville', vers: 'chnafon', terrain: 'sentier', points: [[735, 1025], [765, 985], [800, 945], [845, 905], [882, 888]] },
  { de: 'chnafon', vers: 'boladar', terrain: 'sentier', points: [[882, 888], [830, 860], [760, 830], [710, 810], [675, 800]] },
  { de: 'boladar', vers: 'mliuej', terrain: 'sentier', points: [[675, 800], [700, 770], [735, 735], [780, 695]] },
  { de: 'varig', vers: 'boladar', terrain: 'sentier', points: [[290, 900], [380, 880], [470, 850], [560, 820], [620, 805], [675, 800]] },
  { de: 'mliuej', vers: 'birtek', terrain: 'sentier', points: [[780, 695], [775, 640], [770, 585], [765, 535]] },
  { de: 'birtek', vers: 'jambfer', terrain: 'sentier', points: [[765, 535], [745, 500], [725, 465]] },
  { de: 'birtek', vers: 'gzor', terrain: 'sentier', points: [[765, 535], [830, 525], [900, 490], [960, 450], [1015, 425]] },
  { de: 'mliuej', vers: 'mlauke', terrain: 'sentier', points: [[780, 695], [840, 705], [910, 715], [975, 720]] },
  { de: 'mlauke', vers: 'juenal', terrain: 'sentier', points: [[975, 720], [1060, 735], [1150, 730], [1230, 700], [1320, 670]] },
  // --- Centre ----------------------------------------------------------------------------------
  { de: 'chnafon', vers: 'plorodou', terrain: 'sentier', points: [[882, 888], [905, 960], [950, 1030], [1025, 1055], [1100, 1035]] },
  { de: 'plorodou', vers: 'tulamor', terrain: 'sentier', points: [[1100, 1035], [1120, 1100], [1150, 1160], [1172, 1205]] },
  { de: 'donjon-naheulbeuk', vers: 'tulamor', terrain: 'sentier', points: [[517, 1195], [600, 1205], [700, 1195], [800, 1200], [900, 1215], [1000, 1225], [1090, 1215], [1172, 1205]] },
  { de: 'tulamor', vers: 'zoyek', terrain: 'sentier', points: [[1172, 1205], [1250, 1140], [1340, 1080], [1435, 1015]] },
  { de: 'zoyek', vers: 'glargh', terrain: 'sentier', points: [[1435, 1015], [1500, 1030], [1550, 1030], [1568, 1070]] },
  { de: 'zoyek', vers: 'ranuf', terrain: 'sentier', points: [[1435, 1015], [1460, 990], [1475, 965]] },
  { de: 'ranuf', vers: 'juenal', terrain: 'sentier', points: [[1475, 965], [1460, 900], [1440, 800], [1400, 720], [1320, 670]] },
  { de: 'tulamor', vers: 'doduville', terrain: 'sentier', points: [[1172, 1205], [1220, 1240], [1275, 1265]] },
  { de: 'doduville', vers: 'bardol', terrain: 'sentier', points: [[1275, 1265], [1340, 1220], [1390, 1185], [1430, 1165]] },
  { de: 'bardol', vers: 'glargh', terrain: 'sentier', points: [[1430, 1165], [1480, 1130], [1530, 1100], [1568, 1070]] },
  { de: 'glargh', vers: 'kjaniouf', terrain: 'sentier', points: [[1568, 1070], [1560, 1150], [1580, 1220], [1570, 1285]] },
  { de: 'doduville', vers: 'kjaniouf', terrain: 'sentier', points: [[1275, 1265], [1350, 1285], [1450, 1295], [1520, 1290], [1570, 1285]] },
  // --- Vers l'est : les Terres sauvages de Kwzprtt -----------------------------------------------
  { de: 'glargh', vers: 'fierpate', terrain: 'sentier', points: [[1568, 1070], [1650, 1055], [1745, 1000], [1850, 985], [1975, 975], [2060, 985], [2100, 1007]] },
  { de: 'fierpate', vers: 'rillettebourg', terrain: 'sentier', points: [[2100, 1007], [2050, 960], [1990, 920], [1970, 900]] },
  { de: 'glargh', vers: 'bourg-de-baie', terrain: 'sentier', points: [[1568, 1070], [1650, 1120], [1750, 1180], [1850, 1215], [1900, 1230]] },
  { de: 'bourg-de-baie', vers: 'hameau', terrain: 'sentier', points: [[1900, 1230], [2000, 1250], [2100, 1275], [2200, 1270], [2280, 1264]] },
  { de: 'biouro', vers: 'fquiepou', terrain: 'sentier', points: [[2425, 992], [2470, 975], [2510, 960], [2530, 955]] },
];

export const lieuMonde = (id: string): LieuMonde => {
  const l = LIEUX_MONDE.find((x) => x.id === id);
  if (!l) throw new Error(`Lieu inconnu : ${id}`);
  return l;
};

/** La région d'un point de la carte : celle du lieu le plus proche. */
export const zoneEn = ([x, y]: Point): Zone => {
  let meilleur = LIEUX_MONDE[0];
  for (const l of LIEUX_MONDE) if (Math.hypot(l.x - x, l.y - y) < Math.hypot(meilleur.x - x, meilleur.y - y)) meilleur = l;
  return meilleur.zone ?? 'terres-sauvages';
};

const longueurPx = (pts: Point[]) => pts.slice(1).reduce((s, [x, y], i) => s + Math.hypot(x - pts[i][0], y - pts[i][1]), 0);

export interface Troncon {
  terrain: Terrain;
  points: Point[];
  km: number;
  heures: number;
}

export interface Itineraire {
  etapes: string[];
  /** Tout droit à travers la lande, sans suivre les pistes. */
  horsPiste?: boolean;
  troncons: Troncon[];
  km: number;
  heures: number;
}

const troncon = (piste: Piste, sens: 1 | -1, allure: 'normale' | 'forcee'): Troncon => {
  const points = sens === 1 ? piste.points : [...piste.points].reverse();
  const km = longueurPx(points) / PX_PAR_KM;
  return { terrain: piste.terrain, points, km, heures: (km / KM_PAR_JOUR[piste.terrain][allure]) * HEURES_DE_ROUTE_PAR_JOUR };
};

/** Le chemin le plus rapide (Dijkstra sur les pistes), ou null si aucun ne relie les deux lieux. */
export const itineraire = (de: string, vers: string, allure: 'normale' | 'forcee' = 'normale'): Itineraire | null => {
  const duree = new Map<string, number>([[de, 0]]);
  const venu = new Map<string, { depuis: string; t: Troncon }>();
  const restants = new Set(LIEUX_MONDE.map((l) => l.id));
  while (restants.size) {
    let ici: string | undefined;
    for (const id of restants) if (duree.has(id) && (ici === undefined || duree.get(id)! < duree.get(ici)!)) ici = id;
    if (ici === undefined || ici === vers) break;
    restants.delete(ici);
    for (const p of PISTES) {
      const sens = p.de === ici ? 1 : p.vers === ici ? -1 : 0;
      if (!sens) continue;
      const autre = sens === 1 ? p.vers : p.de;
      const t = troncon(p, sens, allure);
      const d = duree.get(ici)! + t.heures;
      if (d < (duree.get(autre) ?? Infinity)) {
        duree.set(autre, d);
        venu.set(autre, { depuis: ici, t });
      }
    }
  }
  if (de === vers || !venu.has(vers)) return null;
  const etapes = [vers];
  const troncons: Troncon[] = [];
  while (etapes[0] !== de) {
    const v = venu.get(etapes[0])!;
    troncons.unshift(v.t);
    etapes.unshift(v.depuis);
  }
  return {
    etapes,
    troncons,
    km: troncons.reduce((s, t) => s + t.km, 0),
    heures: troncons.reduce((s, t) => s + t.heures, 0),
  };
};

/** Où en est le voyageur après `h` heures de marche. */
export const positionApres = (it: Itineraire, h: number): Point => {
  let reste = Math.max(0, h);
  for (const t of it.troncons) {
    if (reste <= t.heures) {
      let px = (reste / t.heures) * longueurPx(t.points);
      for (let i = 1; i < t.points.length; i++) {
        const [x0, y0] = t.points[i - 1];
        const [x1, y1] = t.points[i];
        const l = Math.hypot(x1 - x0, y1 - y0);
        if (px <= l) return [x0 + ((x1 - x0) * px) / l, y0 + ((y1 - y0) * px) / l];
        px -= l;
      }
      return t.points[t.points.length - 1];
    }
    reste -= t.heures;
  }
  const dernier = it.troncons[it.troncons.length - 1];
  return dernier.points[dernier.points.length - 1];
};

/** Le terrain sous les pieds du voyageur après `h` heures de marche. */
export const terrainApres = (it: Itineraire, h: number): Terrain => {
  let reste = h;
  for (const t of it.troncons) {
    if (reste <= t.heures) return t.terrain;
    reste -= t.heures;
  }
  return it.troncons[it.troncons.length - 1].terrain;
};

/** Les Dunes Waldorgaises, à peu près : une ellipse autour du dessin des dunes. */
const DUNES = { cx: 2415, cy: 1210, rx: 100, ry: 50 };
const dansLesDunes = ([x, y]: Point) => ((x - DUNES.cx) / DUNES.rx) ** 2 + ((y - DUNES.cy) / DUNES.ry) ** 2 <= 1;

/**
 * Tout droit, sans suivre la route : plus court, mais à travers la lande ou les dunes,
 * là où les embûches sont plus nombreuses (voir `controler`).
 */
export const itineraireDirect = (de: string, vers: string, allure: 'normale' | 'forcee' = 'normale'): Itineraire => {
  const a = lieuMonde(de);
  const b = lieuMonde(vers);
  const morceaux = 24;
  const troncons: Troncon[] = [];
  for (let i = 0; i < morceaux; i++) {
    const p0: Point = [a.x + ((b.x - a.x) * i) / morceaux, a.y + ((b.y - a.y) * i) / morceaux];
    const p1: Point = [a.x + ((b.x - a.x) * (i + 1)) / morceaux, a.y + ((b.y - a.y) * (i + 1)) / morceaux];
    const terrain: Terrain = dansLesDunes([(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2]) ? 'dunes' : 'plaine';
    const dernier = troncons[troncons.length - 1];
    if (dernier?.terrain === terrain) dernier.points.push(p1);
    else troncons.push({ terrain, points: [p0, p1], km: 0, heures: 0 });
  }
  for (const t of troncons) {
    t.km = longueurPx(t.points) / PX_PAR_KM;
    t.heures = (t.km / KM_PAR_JOUR[t.terrain][allure]) * HEURES_DE_ROUTE_PAR_JOUR;
  }
  return {
    etapes: [de, vers],
    horsPiste: true,
    troncons,
    km: troncons.reduce((s, t) => s + t.km, 0),
    heures: troncons.reduce((s, t) => s + t.heures, 0),
  };
};

/** Rebâtit un itinéraire à partir de la liste de ses étapes (pour reprendre un voyage sauvegardé). */
export const itineraireEtapes = (etapes: string[], allure: 'normale' | 'forcee' = 'normale', horsPiste = false): Itineraire => {
  if (horsPiste) return itineraireDirect(etapes[0], etapes[etapes.length - 1], allure);
  const troncons = etapes.slice(1).map((vers, i) => {
    const de = etapes[i];
    const piste = PISTES.find((p) => (p.de === de && p.vers === vers) || (p.de === vers && p.vers === de));
    if (!piste) throw new Error(`Pas de piste entre ${de} et ${vers}`);
    return troncon(piste, piste.de === de ? 1 : -1, allure);
  });
  return { etapes, troncons, km: troncons.reduce((s, t) => s + t.km, 0), heures: troncons.reduce((s, t) => s + t.heures, 0) };
};
