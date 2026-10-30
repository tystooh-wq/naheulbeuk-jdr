import type { Lieu } from './waldorg';

// Fquiepou, « Joyau de l'Est », ville du savon. Lieux d'après « Fquiepou pour le MJ » (numéros de la carte
// du MJ entre parenthèses) ; positions en % du plan joueur, qui a le même cadrage que la carte du MJ.

const MATERIEL = ['sac', 'briquet', 'couverture', 'gourde', 'chaussettes', 'rations', 'corde', 'torche', 'lampe', 'matelas'];

export const LIEUX_FQUIEPOU: Lieu[] = [
  {
    id: 'porte',
    nom: 'Route de Waldorg',
    type: 'porte',
    x: 56,
    y: 93,
    quartier: 'Les Anciens',
    description:
      "La route de Waldorg entre en ville entre les fermes et les champs. Pas de rempart ni de porte à Fquiepou : la terre est bonne, les gens sont riches, et ça sent le savon jusque dans les champs de choux.",
  },
  {
    id: 'mairie',
    nom: 'La mairie (1)',
    type: 'emplois',
    x: 63.5,
    y: 60,
    quartier: 'Place Ronflon',
    description:
      "Le centre administratif du maire, Barnabé de Paluchard, avec son collecteur de taxes. On y vend un plan de la ville pour 1 pièce d'or, et le maire confie parfois des missions aux aventuriers qui ont l'air de savoir se laver.",
  },
  {
    id: 'pontons',
    nom: 'Les Pontons et la halle aux poissons (2)',
    type: 'marche',
    x: 86,
    y: 63,
    quartier: 'Les Pontons',
    description:
      "Les bateaux de fret et de pêche, la halle où se négocie le poisson de la Syé et de la Zoc, et le bac pour traverser le fleuve. Le bac passe aussi par l'Isle de Malgor (3), où vit un mage de niveau 12 qui rend des services contre beaucoup d'argent et n'est pas commode.",
    boutique: { stock: ['rations', 'corde', 'gourde', 'couverture'], prix: 0.8, rachat: 0.3, rachete: ['materiel'] },
  },
  {
    id: 'gilbert',
    nom: 'Savonnerie Gilbert (4)',
    type: 'info',
    x: 64,
    y: 30,
    quartier: 'Avenue des Savonniers',
    description:
      "La famille Gilbert a inventé la recette du savon de Fquiepou, et le patron le rappelle à chaque client. Le savon de Fquiepou sert d'ingrédient magique, et il lave aussi n'importe quoi.",
    action: {
      bouton: 'Écouter maître Gilbert',
      texte:
        "« La recette est dans la famille depuis des générations. Ce voleur de Marcellin prétend la même chose, mais ses ancêtres nous l'ont VOLÉE. Et il l'a revendue à Morbier ! » Il te met un savon dans la main. « Sentez. Ça, c'est du vrai. Une pièce d'or à Waldorg, cinq pièces d'argent ici. Faites passer le mot. »",
    },
  },
  {
    id: 'marcellin',
    nom: 'Savonnerie Marcellin (5)',
    type: 'info',
    x: 32,
    y: 31,
    quartier: 'Rivière Zoc',
    description:
      "Marcellin est un type un peu sournois, dont les ancêtres auraient dérobé la recette aux Gilbert. Il voue à ces derniers une haine farouche, et il n'est pas loin d'être un escroc.",
    action: {
      bouton: 'Parler à Marcellin',
      texte:
        "Marcellin te prend à part. « Les Gilbert racontent des histoires. Mais si un aventurier discret voulait jeter un œil dans leur atelier, je saurais me montrer reconnaissant. » Il se frotte les mains, qui sont d'ailleurs très propres.",
    },
  },
  {
    id: 'trois-temples',
    nom: 'Rue des Trois Temples (8, 9, 10)',
    type: 'info',
    x: 18,
    y: 46,
    quartier: 'Quartier Dorlu',
    description:
      "Trois temples construits beaucoup trop près les uns des autres : les adeptes de Lafoune font des blagues salaces aux jeunes elfettes qui sortent du Temple de la Lune, et lancent des vannes à ceux de Malgar, en face, dont le temple est (fait rare) en activité.",
    action: {
      bouton: 'Assister à la dispute des temples',
      texte:
        "Un adepte de Lafoune, en imperméable, crie « Je suis nu là-dessous ! » à une prêtresse de la Lune, qui lève les yeux au ciel. En face, un prêtre de Malgar ouvre sa fenêtre et lui jette un seau d'eau savonneuse. Fquiepou, ville de la propreté.",
    },
  },
  {
    id: 'universite',
    nom: 'Petite Université Réformée de Magie Pratique (12)',
    type: 'info',
    x: 43.5,
    y: 64.5,
    quartier: 'Place Ronflon',
    description:
      "On y forme les jeunes avant qu'ils soient assez âgés pour partir à Waldorg, et on y donne des stages aux aventuriers.",
    action: {
      bouton: 'Demander les stages',
      texte:
        "Le secrétaire te tend un prospectus. « Stage de sortilèges domestiques, stage d'identification d'objets, stage de survie pour mages qui ont oublié leur bâton. Inscriptions le premier jour de la lune. Paiement d'avance, évidemment. »",
    },
  },
  {
    id: 'petipani',
    nom: 'Grand temple de Petipani (16)',
    type: 'info',
    x: 27,
    y: 20.5,
    quartier: 'Les Sylvains',
    description: 'Le plus grand temple du Lembas de toute la région Est. Ça sent la galette elfique et la bienveillance forcée.',
    action: {
      bouton: 'Demander la bénédiction de Petipani',
      texte: "Un prêtre sylvain te tend un morceau de lembas. « Petipani nourrit ceux qui ont faim. Et ceux qui n'ont pas faim aussi, d'ailleurs. » C'est sec, mais ça tient au corps.",
    },
  },
  {
    id: 'truite',
    nom: 'Auberge de la Truite Grise (18)',
    type: 'auberge',
    x: 36,
    y: 54,
    quartier: 'Rue Roger Barlouk',
    description: 'Un établissement de qualité moyenne, bon pour les infos et les rencontres. Le soir, les recrues du fortin y viennent boire leur solde.',
    auberge: { repas: 1, chambre: 3, confort: 'normal' },
    rumeurs: 'normales',
  },
  {
    id: 'fortin',
    nom: 'Fortin de Fquiepou (19)',
    type: 'info',
    x: 13.5,
    y: 59,
    quartier: 'Place de Kjeukien',
    description:
      "Le commandant Muldoquet, assisté du clipitaine Vainal, y entraîne les miliciens de la ville et des villages alentours. Trente futures recrues y vivent en permanence.",
    action: {
      bouton: 'Parler au clipitaine Vainal',
      texte:
        "« Des pirates d'eau douce remontent la Syé pour faire leur marché chez nous. Des humains, des gobelins, et même des hommes-tritons, une fois. C'est pour ça qu'on a les tours de surveillance. Si vous voulez vous rendre utile, le bureau des emplois a toujours des missions. »",
    },
  },
  {
    id: 'balarik',
    nom: 'Brasserie Balarik (20)',
    type: 'bar',
    x: 23.5,
    y: 30,
    quartier: 'Rivière Zoc',
    description:
      "Tenue par un nain exilé pour une erreur comptable, à la lisière du quartier des Elfes, ce qui l'agace beaucoup. La Balarik blonde et la Balarik spéciale sont exportées dans tout l'Est.",
    chope: 1,
    rumeurs: 'normales',
  },
  {
    id: 'emplois',
    nom: 'Bureau des emplois (21)',
    type: 'emplois',
    x: 45.5,
    y: 76.5,
    quartier: 'Route de Waldorg',
    description: "L'endroit idéal pour trouver une mission. Le préposé tamponne tout, même les aventuriers qui ne bougent pas assez vite.",
  },
  {
    id: 'rusard',
    nom: 'Chez Rusard (24)',
    type: 'boutique',
    x: 61,
    y: 71.5,
    quartier: 'Avenue des Moraîchers',
    description: "Magasin d'objets magiques, boutique de sorciers et librairie. Rusard porte bien son nom.",
    boutique: { stock: ['potion-de-mana-des-bitos', 'potion-de-mana-rouge', 'potion-soin', 'potion-soin-forte', 'baton-sorcier-perrave', 'baton-sorcier'], prix: 1.1, rachat: 0.5, rachete: ['potion', 'arme'] },
  },
  {
    id: 'attrape-peur',
    nom: "L'Attrape-Peur (25)",
    type: 'boutique',
    x: 29.5,
    y: 66.5,
    quartier: 'Rue du Fortin',
    description: "Grand bazar franchisé du Donjon Facile : tout pour l'aventurier, des chaussettes aux plastrons, avec le sourire commercial réglementaire.",
    boutique: {
      stock: [...MATERIEL, 'outils-crochetage', 'instrument', 'dague-qualite', 'epee-correcte', 'epee-bonne', 'hache-correcte', 'marteau-correct', 'gambison-correct', 'plastron-cuir-bouilli', 'tenue-eclaireur', 'arc-court-de-qualite-correcte', 'fleches-lot', 'carreaux-lot'],
      prix: 1,
      rachat: 0.4,
      rachete: ['materiel', 'arme', 'armure'],
    },
  },
  {
    id: 'syee',
    nom: 'Le Secret de la Syé (26)',
    type: 'auberge',
    x: 83,
    y: 44.5,
    quartier: 'Rue Gros Didier',
    description: "L'auberge de luxe de la ville : nobles en voyage, riches marchands, draps parfumés au savon de Fquiepou. On vous regarde de haut si vous avez de la boue sur les bottes.",
    auberge: { repas: 4, chambre: 9, confort: 'excellent' },
  },
  {
    id: 'salador',
    nom: "La tour de Salador l'Ancien (28)",
    type: 'info',
    x: 53,
    y: 20,
    quartier: 'Rue Tamba',
    description: 'Un vieux sage au courant de tout. Il reçoit les aventuriers polis, et parle longtemps.',
    action: {
      bouton: "Consulter Salador l'Ancien",
      texte:
        "« Au nord, le bois N'talamela et ses Sylvains. Au nord-est, la mine de Martenbur, où Barbidul Sang-Noir règne sur des nains blonds qui préfèrent le marteau. Au sud, les collines d'Altrouille et leurs semi-hommes, qui font un pâté remarquable. Et partout, des gens qui veulent la recette du savon. » Il sourit. « Moi, je la connais. Mais je ne la dirai pas. »",
    },
  },
  {
    id: 'bijouterie',
    nom: "Grande Bijouterie de l'Est (30)",
    type: 'info',
    x: 36.5,
    y: 25,
    quartier: 'Avenue des Savonniers',
    description:
      "La bijouterie de Célairderien, le noble haut-elfe qui vit dans le château (23), au nord-ouest. Objets de valeur, reliques, bagues de charisme à 1800 pièces d'or. Gardée, avec le poste de garde juste derrière.",
    action: {
      bouton: 'Regarder les vitrines',
      texte: "Un elfe en livrée te suit de vitrine en vitrine. La moins chère des bagues vaut plus que tout ce que tu possèdes. Une bague de Charisme +2 te fait de l'œil, à 1800 pièces d'or. L'elfe toussote : « Monsieur regarde ou Monsieur achète ? »",
    },
  },
  {
    id: 'joe',
    nom: 'Chez Joe le Trembleur (34)',
    type: 'bar',
    x: 55,
    y: 42,
    quartier: 'Rue Childéric II',
    description:
      "Le bistrot favori des traîne-savates et des bandits, au nord de la mairie, juste à côté de l'antenne de la Guilde des Voleurs de l'Est (27). Les ragots y sont moins chers que la bière.",
    chope: 1,
    rumeurs: 'louches',
  },
  {
    id: 'guerisseur',
    nom: 'Guérisseur des Pontons',
    type: 'soins',
    x: 71.5,
    y: 70,
    quartier: 'Rue Odeline Fion',
    description: "Il soigne les pêcheurs mordus par des brochets et les recrues tombées de leur échelle. Ses bandages sentent le savon.",
    prixSoin: 2,
    boutique: { stock: ['potion-soin', 'potion-plaies', 'potion-soin-forte'], prix: 1, rachat: 0.5, rachete: ['potion'] },
  },
  {
    id: 'forge',
    nom: 'Forgeron',
    type: 'boutique',
    x: 31,
    y: 73,
    quartier: 'Rue du Fortin',
    description: "Il travaille surtout pour le fortin. Les nains de l'Est qui passent trouvent ses marteaux acceptables, ce qui est un compliment.",
    boutique: {
      stock: ['dague-base', 'epee-correcte', 'epee-bonne', 'hache-correcte', 'marteau-correct', 'lance-base', 'batarde', 'gambison-correct', 'plastron-cuir-renforce', 'cotte-sans-manches', 'javelot-de-base'],
      prix: 1,
      rachat: 0.35,
      rachete: ['arme', 'armure'],
    },
  },
];

export const RUMEURS_FQUIEPOU = [
  "Marcellin aurait revendu la recette du savon à Jean-Claude Morbier. Gilbert a juré de les noyer tous les deux dans une cuve.",
  "Des pirates d'eau douce ont été vus sur la Syé. Des gobelins en barque, avec un tonneau de Balarik volé.",
  "Célairderien est paranoïaque : son château est gardé jour et nuit par des elfes. Qu'est-ce qu'il cache, à part des bijoux ?",
  "La ferme de Pifanie fait pousser des légumes énormes. Un peu trop énormes, si tu veux mon avis. De la magie, sûrement.",
  "Le savon de Fquiepou se vend une pièce d'or à Waldorg, et cinq pièces d'argent ici. Il y a de l'argent à faire, si on a un chariot.",
  "La Guilde des Voleurs de l'Est a son antenne derrière chez Joe le Trembleur. La Guilde des Marchands, juste à côté, ne dort plus.",
  "Le nain de la brasserie Balarik a été exilé pour une erreur de calcul. Une seule. Les nains ne pardonnent pas.",
];

/** Rues de Fquiepou relevées sur le plan, en % (voir valtordu.ts pour le principe). */
export const RESEAU_FQUIEPOU = {
  noeuds: {
    sud: [56, 94], wal2: [56, 86], wal1: [51, 78], rf: [45, 68], ronflon: [51, 63], pontS: [47, 53], pontN: [44, 40], pont: [42, 31],
    savon: [46, 27], jamjan: [40, 21], elfes1: [36, 13], impasse: [24, 14], chateau: [14, 13], bois1: [31, 25], bois2: [14, 24],
    tamba: [50, 17], pontons1: [62, 20], barcasse: [70, 23], pic: [55, 24], savonE: [62, 28], ch1: [48, 37], ch2: [60, 37], ch3: [70, 36],
    stella: [59, 45], gd: [70, 45], beq: [68, 54], filet: [79, 55], pontons: [84, 62], brou1: [69, 62], brou2: [77, 72], mor1: [56, 68],
    mor2: [62, 78], odeline: [70, 74], tt1: [38, 44], tt2: [26, 46], tt3: [12, 48], barl1: [38, 51], barl2: [27, 54], misere: [36, 59],
    kjeuk: [22, 62], f2: [30, 68], f3: [39, 72],
  } as Record<string, [number, number]>,
  aretes: [
    ['sud', 'wal2'], ['wal2', 'wal1'], ['wal1', 'rf'], ['rf', 'ronflon'], ['ronflon', 'pontS'], ['pontS', 'pontN'], ['pontN', 'pont'],
    ['pont', 'savon'], ['savon', 'jamjan'], ['jamjan', 'elfes1'], ['elfes1', 'impasse'], ['impasse', 'chateau'], ['pont', 'bois1'],
    ['bois1', 'bois2'], ['jamjan', 'tamba'], ['tamba', 'pontons1'], ['pontons1', 'barcasse'], ['savon', 'pic'], ['pic', 'savonE'],
    ['pontN', 'ch1'], ['ch1', 'ch2'], ['ch2', 'ch3'], ['ch2', 'stella'], ['stella', 'gd'], ['gd', 'beq'], ['beq', 'filet'],
    ['filet', 'pontons'], ['ronflon', 'brou1'], ['brou1', 'brou2'], ['brou1', 'beq'], ['brou2', 'pontons'], ['ronflon', 'mor1'],
    ['mor1', 'mor2'], ['mor2', 'odeline'], ['odeline', 'brou2'], ['pontN', 'tt1'], ['tt1', 'tt2'], ['tt2', 'tt3'], ['pontS', 'barl1'],
    ['barl1', 'barl2'], ['barl1', 'misere'], ['misere', 'rf'], ['barl2', 'kjeuk'], ['kjeuk', 'f2'], ['f2', 'f3'], ['f3', 'rf'], ['tt2', 'barl2'],
  ] as [string, string][],
  acces: {
    porte: 'sud', mairie: 'ronflon', pontons: 'pontons', gilbert: 'savonE', marcellin: 'bois1', 'trois-temples': 'tt2', universite: 'rf',
    petipani: 'bois1', truite: 'barl1', fortin: 'kjeuk', balarik: 'bois1', emplois: 'wal1', rusard: 'mor1', 'attrape-peur': 'f2',
    'syee': 'gd', salador: 'tamba', bijouterie: 'savon', joe: 'ch2', guerisseur: 'odeline', forge: 'f2',
  } as Record<string, string>,
};
