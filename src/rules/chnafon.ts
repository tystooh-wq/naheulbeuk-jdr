import type { Lieu } from './waldorg';

// Chnafon, ville fortifiée sur la rive ouest du lac de Zblouf. Lieux d'après « Chnafon pour le MJ ».
// Le plan parchemin ne numérote pas les bâtiments : les positions sont choisies le long des rues nommées.

const MATERIEL = ['sac', 'briquet', 'couverture', 'gourde', 'chaussettes', 'rations', 'corde', 'torche', 'lampe', 'matelas'];

export const LIEUX_CHNAFON: Lieu[] = [
  {
    id: 'porte',
    nom: 'Porte ouest (1)',
    type: 'porte',
    x: 11,
    y: 52,
    quartier: 'Place du Vieux Puit',
    description:
      "On n'entre à Chnafon (théoriquement) que par les deux portes, à l'ouest et à l'est. Les gardes ont un sens civique très développé : ils demandent parfois un « droit de passage » aux voyageurs. Le nom de la ville n'est écrit que sur une pancarte, personne n'ayant réussi à trouver comment appeler les habitants.",
  },
  {
    id: 'chateau',
    nom: 'Château du Seigneur (3)',
    type: 'info',
    x: 47,
    y: 27,
    quartier: 'Rue des Patates',
    description:
      "La famille de Grandvent dirige la ville : Hubertin, sa femme Géraldine et leur crétin de fils Sofok. Tout le monde est plus ou moins corrompu à Chnafon, à commencer par le seigneur.",
    action: {
      bouton: 'Se présenter à la porte du château',
      texte:
        "Un garde te barre le passage. « Monseigneur reçoit les gens importants. Vous êtes important ? » Il frotte son pouce contre son index. Derrière lui, Sofok de Grandvent essaie de faire tenir une patate en équilibre sur sa tête.",
    },
  },
  {
    id: 'chaise-boiteuse',
    nom: 'La Chaise Boiteuse (17)',
    type: 'auberge',
    x: 30,
    y: 55,
    quartier: 'Avenue des Grandes Échoppes',
    description: "Auberge et hôtel de qualité moyenne. Toutes les chaises sont boiteuses, par fidélité à l'enseigne, et le patron est fâché avec tout le monde, comme tous les habitants.",
    auberge: { repas: 1, chambre: 2, confort: 'normal' },
    rumeurs: 'normales',
  },
  {
    id: 'kraken',
    nom: 'Le Kraken Velu (18)',
    type: 'auberge',
    x: 70,
    y: 40,
    quartier: 'Avenue des Pêcheurs de Zblouf',
    description: "Auberge de bonne qualité. Le kraken velu empaillé au-dessus du comptoir aurait été pêché dans le lac de Zblouf ; vu sa dentition, on comprend pourquoi plus personne n'y va en barque.",
    auberge: { repas: 2, chambre: 5, confort: 'excellent' },
  },
  {
    id: 'rat',
    nom: "Le Rat d'Égout Lubrique (16)",
    type: 'bar',
    x: 20,
    y: 77,
    quartier: 'Ruelle Kisbar Arkoin',
    description: "Repaire de vauriens et de brigands, qualité médiocre. On dit que la Guilde des Voleurs y recrute, et que Xavier de Niva, noble et chef des voleurs, y passe parfois incognito.",
    chope: 1,
    rumeurs: 'louches',
  },
  {
    id: 'saltimbanques',
    nom: 'Les Saltimbanques (19)',
    type: 'bar',
    x: 55,
    y: 58,
    quartier: 'Place du Marché',
    description: "Une taverne sans chambres, mais la meilleure adresse pour les informateurs. Gigno, le patron du bazar, y est un vrai pilier de bistrot.",
    chope: 1,
    rumeurs: 'normales',
  },
  {
    id: 'gigno',
    nom: 'Bazar de Gigno (c)',
    type: 'boutique',
    x: 40,
    y: 48,
    quartier: 'Place du Marché',
    description: "Gigno voit passer à peu près tout le monde dans sa boutique : c'est une très bonne source de renseignements, quand il est là (et pas aux Saltimbanques).",
    boutique: { stock: [...MATERIEL, 'gourdin', 'baton', 'couteau-qualite', 'instrument'], prix: 1, rachat: 0.4, rachete: ['materiel', 'arme'] },
  },
  {
    id: 'oubliette',
    nom: "L'Oubliette (a)",
    type: 'boutique',
    x: 62,
    y: 50,
    quartier: 'Place du Marché',
    description: "Magasin d'aventurier et armurier. Tout ce qu'il faut, d'une qualité légèrement moindre que les belles pièces de Glargh ou Waldorg, mais moins cher.",
    boutique: {
      stock: ['outils-crochetage', 'dague-base', 'dague-qualite', 'epee-correcte', 'hache-correcte', 'marteau-correct', 'lance-base', 'batarde', 'gambison-correct', 'plastron-cuir', 'plastron-cuir-bouilli', 'cotte-sans-manches', 'arc-court-de-qualite-correcte', 'arbalete-de-qualite-correcte', 'fleches-lot', 'carreaux-lot', 'javelot-de-base'],
      prix: 0.95,
      rachat: 0.35,
      rachete: ['arme', 'armure'],
    },
  },
  {
    id: 'emplois',
    nom: 'Bureau des emplois (24)',
    type: 'emplois',
    x: 53,
    y: 44,
    quartier: 'Place du Marché',
    description: "Du travail et des missions de mercenariat. Le préposé prend une petite commission, que la mairie ne lui a jamais demandée.",
  },
  {
    id: 'caserne',
    nom: 'La caserne (22)',
    type: 'info',
    x: 84,
    y: 36,
    quartier: 'Porte est',
    description:
      "On y entraîne une partie des soldats et miliciens des villages et postes avancés. Ruflak Santanza, responsable de la sécurité, y règne. À Chnafon, une plaisanterie de trop mène vite en prison, et les gardes en profitent pour vous « délester » de vos effets.",
    action: {
      bouton: 'Parler à Ruflak Santanza',
      texte:
        "Ruflak Santanza te jauge. « Un aventurier. Bon. Ici, on ne plaisante pas, on ne se bat pas, on ne lance pas de sorts, et on paie ses taxes. Toutes ses taxes. » Il insiste sur « toutes ». Sur le mur, une affiche recrute des soldats pour les postes avancés de la forêt de Schlipak.",
    },
  },
  {
    id: 'ecole',
    nom: 'École de magie (15)',
    type: 'info',
    x: 76,
    y: 27,
    quartier: 'Rue des Apprentis',
    description: "L'une des seules écoles de magie de l'ouest. Les apprentis font sauter le toit à peu près une fois par mois.",
    action: {
      bouton: "Visiter l'école",
      texte: "Un apprenti court dans le couloir, les sourcils en feu. Le directeur soupire. « On forme les mages de l'ouest, ceux qui n'ont pas les moyens d'aller à Waldorg. Ils apprennent vite. Ceux qui survivent. »",
    },
  },
  {
    id: 'rufus',
    nom: "Tour de Rufus d'Ombrelune (7)",
    type: 'info',
    x: 77,
    y: 61,
    quartier: "Rue de l'Archer Myope",
    description: "Mage ensorceleur de niveau 8, installé à son compte. Il rend des services, payants, et il a une liste de prix affichée à la porte.",
    action: {
      bouton: 'Lire la liste de Rufus',
      texte: "« Identification : 20 PO. Désenvoûtement : 80 PO. Retrouver un objet perdu : 15 PO (30 PO s'il a été volé par la Guilde). Transformer un garde en crapaud : nous consulter. »",
    },
  },
  {
    id: 'yeruk',
    nom: 'Chez Yeruk Stormblade (6)',
    type: 'info',
    x: 36,
    y: 74,
    quartier: 'Rue des Grandes Invasions Barbares',
    description: "Un maître d'armes assez réputé. Il entraîne les gardes, les fils de nobles, et les aventuriers qui peuvent payer.",
    action: {
      bouton: "Regarder l'entraînement",
      texte: "Yeruk désarme trois élèves d'un seul mouvement, sans même lâcher sa pipe. « Tu veux apprendre ? Reviens quand tu auras de l'expérience, je ne donne pas de cours aux débutants. Ils me cassent mes mannequins. »",
    },
  },
  {
    id: 'guerisseur',
    nom: 'Guérisseur (k)',
    type: 'soins',
    x: 25,
    y: 41,
    quartier: "Rue de l'Apicole",
    description: "Il soigne avec du miel de la rue de l'Apicole et un manque d'enthousiasme total. Les soins sont efficaces, le sourire en option.",
    prixSoin: 2,
    boutique: { stock: ['potion-soin', 'potion-plaies'], prix: 1, rachat: 0.5, rachete: ['potion'] },
  },
  {
    id: 'sorciers',
    nom: 'Boutique de sorciers (d)',
    type: 'boutique',
    x: 63,
    y: 63,
    quartier: 'Rue du Vieux Chnafon',
    description: 'Fournisseur des apprentis de l’école de magie : potions, bâtons de débutants, et beaucoup de pansements.',
    boutique: { stock: ['potion-soin', 'potion-plaies', 'potion-de-mana-des-bitos', 'baton-sorcier-perrave', 'baton-sorcier', 'grimoire-feu', 'grimoire-eau-glace', 'grimoire-air', 'grimoire-terre'], prix: 1, rachat: 0.5, rachete: ['potion', 'arme'] },
  },
  {
    id: 'poissonnerie',
    nom: 'Poissonnerie (g)',
    type: 'boutique',
    x: 81,
    y: 72,
    quartier: 'Place Tordue',
    description:
      "Un courant étrange repousse les poissons à l'autre bout du lac, et des bestioles à grandes dents découragent les barques. Le poissonnier marche des kilomètres pour pêcher, et quand il revient, le poisson a eu le temps de… vieillir. Mieux vaut ne pas en acheter, surtout en été.",
    boutique: { stock: ['rations'], prix: 0.6 },
  },
];

export const RUMEURS_CHNAFON = [
  "Le concours de la plus grosse patate a lieu tous les cinq ans. Le fils du seigneur, Sofok, l'a gagné avec une patate qu'il avait volée.",
  "Xavier de Niva est noble le jour et chef de la Guilde des Voleurs la nuit. Tout le monde le sait, personne ne le dit.",
  "Les gardes à l'entrée rackettent les voyageurs. Ruflak Santanza touche sa part, c'est pour ça qu'il ne voit rien.",
  "Le club Surivili, réservé aux notables, est le cœur de toutes les affaires louches de la ville. On n'y entre pas sans recommandation.",
  "Dans le lac de Zblouf vivent de gros animaux inconnus à forte dentition. Le dernier pêcheur en barque est revenu sans barque.",
  "Yeronimus Bloch, le patron de la guilde des marchands, est le seul honnête homme de la ville. On le surveille de près.",
  "La forêt maudite de Schlipak n'est pas loin. Ceux qui s'y promènent en reviennent fâchés, ce qui à Chnafon ne se remarque pas.",
];

/** Rues de Chnafon relevées sur le plan parchemin, en % (voir valtordu.ts pour le principe). */
export const RESEAU_CHNAFON = {
  noeuds: {
    ouest: [11, 52], vpuit: [16, 53], ech1: [27, 53.5], apic2: [22, 48], chev0: [45, 81], ech2: [39, 52], marche: [47, 52], marcheN: [47, 42], fr1: [37, 39], fr2: [53, 38],
    apicole: [25, 40], triumvirat: [20, 33], patates: [34, 28], poulet: [17, 23], chateauP: [47, 35], wyv: [60, 24], machin: [62, 39],
    apprentis: [76, 30], pech1: [74, 42], est: [90, 42], paf: [72, 51], archer: [79, 58], kalvan: [85, 62], tordue: [82, 74], marcheE: [58, 55],
    vieux1: [60, 63], vieux2: [73, 66], tabarnak: [29, 62], barb1: [40, 64], barb2: [33, 80], tabluk: [24, 69], kisbar: [19, 78], pal1: [48, 73],
    pal2: [68, 74], chevres: [56, 83],
  } as Record<string, [number, number]>,
  aretes: [
    ['ouest', 'vpuit'], ['vpuit', 'ech1'], ['ech1', 'ech2'], ['ech2', 'marche'], ['marche', 'marcheN'], ['marcheN', 'fr1'], ['marcheN', 'fr2'],
    ['fr1', 'apicole'], ['apicole', 'triumvirat'], ['triumvirat', 'poulet'], ['fr1', 'patates'], ['fr2', 'chateauP'],
    ['fr2', 'machin'], ['chateauP', 'wyv'], ['wyv', 'apprentis'], ['machin', 'apprentis'], ['machin', 'pech1'], ['apprentis', 'pech1'], ['pech1', 'est'],
    ['marche', 'marcheE'], ['marcheE', 'paf'], ['paf', 'pech1'], ['paf', 'archer'], ['archer', 'kalvan'], ['kalvan', 'tordue'], ['marcheE', 'vieux1'],
    ['vieux1', 'vieux2'], ['vieux2', 'archer'], ['vieux2', 'tordue'], ['ech1', 'tabarnak'], ['tabarnak', 'barb1'], ['barb1', 'marche'],
    ['barb1', 'barb2'], ['tabarnak', 'tabluk'], ['tabluk', 'kisbar'], ['pal1', 'pal2'], ['pal2', 'tordue'], 
    ['vpuit', 'apic2'], ['apic2', 'apicole'], ['barb2', 'chev0'], ['chev0', 'pal1'], ['chev0', 'chevres'],
  ] as [string, string][],
  acces: {
    porte: 'ouest', chateau: 'chateauP', 'chaise-boiteuse': 'ech1', kraken: 'pech1', rat: 'kisbar', saltimbanques: 'marcheE', gigno: 'ech2',
    oubliette: 'marcheE', emplois: 'marcheN', caserne: 'est', ecole: 'apprentis', rufus: 'archer', yeruk: 'barb1', guerisseur: 'apicole',
    sorciers: 'vieux1', poissonnerie: 'tordue',
  } as Record<string, string>,
};
