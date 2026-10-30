import type { Lieu } from './waldorg';

// Valtordu, village de départ des débutants. Lieux et PNJ d'après « Valtordu pour le MJ ».
// Le plan officiel (« plan parchemin ») ne numérote pas les bâtiments : les positions sont choisies
// pour le jeu le long des rues nommées sur le plan, en % de sa largeur et de sa hauteur.

const BOUDINS = ['boudin-valtordu', 'boudin-epices', 'boudin-oignons', 'boudin-special'];

export const LIEUX_VALTORDU: Lieu[] = [
  {
    id: 'porte',
    nom: "Entrée par le chemin de l'Est",
    type: 'porte',
    x: 91,
    y: 23,
    quartier: "Chemin de l'Est",
    description:
      "Le chemin de l'Est passe le moulin et entre au village sans porte ni rempart : à Valtordu, on n'a rien à défendre à part le boudin. Un panneau de bois annonce « Valtordu. Son boudin, ses pulls. »",
  },
  {
    id: 'garde',
    nom: 'Poste de garde',
    type: 'info',
    x: 42,
    y: 31,
    quartier: 'Place des Pendus',
    description:
      "Le sergent Melchior dirige le poste, c'est-à-dire trois gardes et un chien. Firmin, assigné à la surveillance de la place, surveille surtout l'étal du boucher.",
    action: {
      bouton: 'Demander des nouvelles au sergent Melchior',
      texte:
        "« Rien à signaler, à part des brigands sur la route de Tronville, des rats chez Gros Didier et un concours de boudin qui va encore finir en bagarre. Le guérisseur cherche toujours un coursier, et le seigneur paie ceux qui rendent service. Si tu veux t'entraîner, va voir Léonard au Donjon Facile. »",
    },
  },
  {
    id: 'boucherie-jobard',
    nom: 'Boucherie Jobard',
    type: 'boutique',
    x: 38,
    y: 41,
    quartier: 'Place des Pendus',
    description:
      "Maître Jobard vend son boudin sous l'arbre de la place des Pendus, en jetant des regards noirs vers la rue du Vieux Bélier, où son rival Plandu gagne le concours tous les ans.",
    boutique: { stock: BOUDINS, prix: 1 },
  },
  {
    id: 'trois-boudins',
    nom: 'Auberge des Trois Boudins',
    type: 'auberge',
    x: 58,
    y: 43,
    quartier: 'Rue des Trois Boudins',
    description:
      "L'établissement le plus connu du village, face à la place des Pendus. Gros Didier, costaud et plutôt aimable, fait son travail correctement, mais il n'aime pas qu'on vienne foutre le bazar chez lui. Au menu : du boudin.",
    auberge: { repas: 2, chambre: 3, confort: 'normal' },
  },
  {
    id: 'chien',
    nom: 'Taverne du Chien qui Pleure',
    type: 'bar',
    x: 66,
    y: 49,
    quartier: 'Rue des Trois Boudins',
    description:
      "La taverne de Hugues Jeanfort, le frère du seigneur. La bière est tiède, le chien de l'enseigne pleure vraiment (on ne sait pas pourquoi), et le vieux Bertrand raconte à qui veut l'entendre ce que tout le monde fait de travers.",
    chope: 1,
    rumeurs: 'normales',
  },
  {
    id: 'guerisseur',
    nom: "Chez Archibald Ozonuc, guérisseur",
    type: 'soins',
    x: 75,
    y: 53,
    quartier: 'Rue Claudique',
    description:
      "Archibald Ozonuc est connu de tous : il soigne les bergers, les moutons et les aventuriers, dans cet ordre. Il donne parfois des quêtes, surtout quand il a besoin d'un coursier. Les tarifs de village sont doux.",
    prixSoin: 1,
    boutique: { stock: ['potion-soin', 'potion-plaies'], prix: 1, rachat: 0.5, rachete: ['potion'] },
  },
  {
    id: 'bazar',
    nom: 'Bazar de Robert Moutier',
    type: 'boutique',
    x: 54,
    y: 54,
    quartier: 'Chemin des Étourneaux',
    description:
      "Robert Moutier achète et vend à peu près n'importe quoi, y compris des choses dont il ignore l'usage. Il fait aussi boulangerie le mardi.",
    boutique: {
      stock: ['sac', 'briquet', 'couverture', 'gourde', 'chaussettes', 'rations', 'corde', 'torche', 'lampe', 'matelas', 'gourdin', 'baton', 'couteau-qualite', 'vetements-rembourres', 'pull-valtordu', 'instrument'],
      prix: 1,
      rachat: 0.4,
      rachete: ['arme', 'armure', 'potion', 'materiel'],
    },
  },
  {
    id: 'forge',
    nom: 'Forge de Ben',
    type: 'boutique',
    x: 30,
    y: 44,
    quartier: "Rue de la Forêt d'Ouien",
    description:
      "Ben, le jeune forgeron, grand et baraqué, a repris l'entreprise de son père. Il ferre surtout des chevaux, mais il a toujours quelques lames et des pièces d'armure pour les aventuriers de passage.",
    boutique: {
      stock: ['dague-base', 'epee-correcte', 'hache-correcte', 'marteau-correct', 'lance-base', 'gambison-correct', 'veste-cuir', 'plastron-cuir', 'arc-court-de-basse-qualite', 'arc-court-de-qualite-correcte', 'javelot-de-base', 'fleches-lot'],
      prix: 1,
      rachat: 0.5,
      rachete: ['arme', 'armure'],
    },
  },
  {
    id: 'chateau',
    nom: 'Château de Valtordu',
    type: 'emplois',
    x: 10,
    y: 42,
    quartier: 'Rue du Château',
    description:
      "Le petit château du seigneur Hubert Jeanfort, un homme plutôt sympathique qui possède aussi quelques fermes du patelin. Églantine, la fille du guérisseur, y travaille. Le seigneur reçoit les aventuriers qui veulent rendre service.",
  },
  {
    id: 'donjon-facile',
    nom: 'Le Donjon Facile',
    type: 'caisse',
    x: 84,
    y: 72,
    quartier: 'Rue Chafouin',
    description:
      "Le donjon d'entraînement de Léonard Boudu, tenu avec sa fille Clémence. Burgal, un vétéran, surveille l'entrée. Le panneau promet « Des vrais monstres, des vrais pièges, un vrai trésor ».",
  },
  {
    id: 'boucherie-plandu',
    nom: 'Boucherie Plandu',
    type: 'boutique',
    x: 79,
    y: 62,
    quartier: 'Rue du Vieux Bélier',
    description:
      "La boucherie qui gagne le concours du meilleur boudin chaque année, grâce à une recette secrète. Plandu ne la montre à personne, et son arrière-boutique est fermée par un rideau très épais.",
    boutique: { stock: BOUDINS, prix: 1.1 },
  },
  {
    id: 'boucherie-salabert',
    nom: 'Boucherie Salabert',
    type: 'boutique',
    x: 86,
    y: 47,
    quartier: 'Rue Claudique',
    description: 'Madame Salabert vend le boudin le moins cher du village. Elle jure que c\'est du mouton.',
    boutique: { stock: BOUDINS, prix: 0.9 },
  },
  {
    id: 'boucherie-flantier',
    nom: 'Boucherie Flantier',
    type: 'boutique',
    x: 22,
    y: 33,
    quartier: "Rue de la Forêt d'Ouien",
    description: "Flantier fume ses boudins au bois de la forêt d'Ouien. Ça sent bon jusqu'à la place Pairav.",
    boutique: { stock: BOUDINS, prix: 1 },
  },
];

export const RUMEURS_VALTORDU = [
  "Le concours du meilleur boudin approche. L'an dernier, Jobard a accusé Plandu de mettre de la poudre de perlimpinpin dans le sien.",
  "Paraît que des aventuriers sont entrés dans le Donjon de Naheulbeuk, à l'est. Ils cherchaient une statuette. On ne les a pas revus.",
  "Le guérisseur Archibald cherche quelqu'un pour porter un colis à Loubet. Le dernier coursier s'est cassé une jambe.",
  "Les pulls de Valtordu protègent du rhume des pierres. Ils protègent aussi des compliments.",
  "Vers le sud, après Loubet, il y a des ogres. Des gros. Qui mangent les moutons, et pas qu'eux.",
  "Le seigneur Hubert paie bien ceux qui débarrassent la route de Tronville de ses brigands.",
  "Gros Didier a des rats dans sa cave. Il n'ose pas descendre, mais ne lui dites pas que je vous l'ai dit.",
  "Dans la forêt d'Ouien vivent des sylvains. Ils sont polis, mais ils ne t'aiment pas.",
];

/**
 * Le réseau des rues du plan de Valtordu, relevé à la main : les trajets suivent ces rues
 * (plus court chemin), puis vont du carrefour le plus proche à la porte du lieu.
 */
export const RESEAU_VALTORDU = {
  noeuds: {
    est: [92, 22],
    moulin: [86, 28],
    tbEst: [85, 39],
    tbMilieu: [70, 43],
    pendus: [50, 44],
    pont: [56, 33],
    pendusOuest: [40, 47],
    foretBas: [25, 48],
    foretHaut: [18, 27],
    chateau: [13, 45],
    etourneaux: [44, 60],
    etourneauxSud: [47, 88],
    croisement: [70, 52],
    claudique: [84, 51],
    belier: [76, 61],
    chafouin: [77, 71],
  } as Record<string, [number, number]>,
  aretes: [
    ['est', 'moulin'],
    ['moulin', 'tbEst'],
    ['tbEst', 'tbMilieu'],
    ['tbMilieu', 'pendus'],
    ['pendus', 'pont'],
    ['pendus', 'pendusOuest'],
    ['pendusOuest', 'foretBas'],
    ['foretBas', 'foretHaut'],
    ['foretBas', 'chateau'],
    ['pendusOuest', 'etourneaux'],
    ['pendus', 'etourneaux'],
    ['etourneaux', 'etourneauxSud'],
    ['tbMilieu', 'croisement'],
    ['tbEst', 'claudique'],
    ['croisement', 'claudique'],
    ['croisement', 'belier'],
    ['belier', 'chafouin'],
    ['claudique', 'belier'],
  ] as [string, string][],
};
