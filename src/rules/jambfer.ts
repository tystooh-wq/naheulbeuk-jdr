import type { Lieu } from './waldorg';

// La mine de Jambfer, cité naine sous les montagnes du Nord, à trente kilomètres au nord de Mliuej.
// Lieux d'après « La mine de Jambfer » ; positions en % du plan de Jambfer centre. Le quartier ouest
// (auberge, guérisseur, bains) est au bout de la galerie ouest, hors du plan.

export const LIEUX_JAMBFER: Lieu[] = [
  {
    id: 'porte',
    nom: "Galerie vers l'extérieur",
    type: 'porte',
    x: 44,
    y: 96,
    quartier: 'Galerie sud',
    description:
      "Une centaine de mètres de galerie piétonnière depuis le flanc de la montagne, au-dessus du village de Birtek. Au poste extérieur, taxe d'entrée : 5 pièces d'or par personne. À la salle de garde Rafidul, taxe de séjour : 2 pièces d'or. Les nains n'aiment pas la magie, se méfient des elfes, et refoulent les gobelins et les orques.",
  },
  {
    id: 'rafidul',
    nom: 'Salle de garde Rafidul',
    type: 'info',
    x: 44,
    y: 69,
    quartier: 'Galerie sud',
    description:
      "Le principal poste de garde, qui sert de caserne : dortoir, armurerie, réserve, cages servant de prison, et toilettes publiques (payantes pour les non-soldats). Le chef de la garde, Brancodul, règle les problèmes en mettant tout le monde en cage.",
    action: {
      bouton: 'Parler à Brancodul',
      texte:
        "Brancodul lisse sa barbe. « Ici, on ne vole pas, on n'arnaque pas, on ne fait pas de magie, et on fait ses besoins aux toilettes. Payantes. Sinon, c'est l'amende, et la cage. Et la cage, ça coûte cher à nourrir, alors on règle vite : dehors, acquitté, ou exécuté. Après avoir payé l'amende. Dans les trois cas. »",
    },
  },
  {
    id: 'malabir',
    nom: 'Hall de Malabir',
    type: 'info',
    x: 47,
    y: 17,
    quartier: 'Galerie nord',
    description:
      "La place centrale de Jambfer, haute de presque dix mètres, avec des statues de nains importants (qui se ressemblent tous), deux gardes en faction et un stand de frites.",
    action: {
      bouton: 'Acheter une barquette de frites à Brucknor (1 PO)',
      texte:
        "Brucknor te sert une barquette huileuse. « 1 PO. Oui, c'est cher. C'est sous une montagne. » Il est au courant de tout : « Les mineurs parlent de grève. La Masout, la mafia souterraine, traîne à la taverne du Gobelin Mort. Et les ingénieurs ont encore fait sauter un mur, côté ouest. »",
    },
  },
  {
    id: 'gobelin-mort',
    nom: 'Taverne du Gobelin Mort',
    type: 'bar',
    x: 23,
    y: 8,
    quartier: 'Galerie nord',
    description:
      "Voyageurs fatigués, mineurs, commerçants pas trop riches et malfrats de la Masout. Le mobilier est taillé dans la roche : impossible de le casser ou de s'en servir dans une bagarre. À l'entrée : « Un bon gobelin est un gobelin mort ».",
    chope: 2,
    rumeurs: 'louches',
  },
  {
    id: 'grande-taverne',
    nom: 'Grande taverne de Jambfer',
    type: 'bar',
    x: 69,
    y: 23,
    quartier: 'Galerie nord',
    description:
      "Toujours bondée, ouverte jour et nuit, l'un des rares endroits où l'on voit des naines. Le patron, « Monsieur Burmofor », respecte à peu près les gens de la surface, et a une peur bleue de sa femme Solange, qui mène tout le monde à la baguette. Pas d'hébergement.",
    chope: 2,
    rumeurs: 'normales',
  },
  {
    id: 'alimentation',
    nom: 'Alimentation générale',
    type: 'boutique',
    x: 8,
    y: 25,
    quartier: 'Quartier marchand',
    description: "Viande séchée, galettes de champignon et bière en gourde. Le marchand fait payer plus cher les gens de la surface, « pour le transport ».",
    boutique: { stock: ['rations', 'gourde'], prix: 1.3 },
  },
  {
    id: 'rombarz',
    nom: 'Équipement Chez Rombarz',
    type: 'boutique',
    x: 8,
    y: 39,
    quartier: 'Quartier marchand',
    description: "L'équipementier de Jambfer. Les lampes, les cordes et les sacs sont solides comme du nain. Les prix aussi.",
    boutique: { stock: ['sac', 'briquet', 'couverture', 'corde', 'torche', 'lampe', 'matelas', 'chaussettes', 'outils-crochetage'], prix: 1.2, rachat: 0.3, rachete: ['materiel'] },
  },
  {
    id: 'bazar',
    nom: 'Bazar de Jambfer',
    type: 'boutique',
    x: 33,
    y: 40,
    quartier: 'Quartier marchand',
    description: "Un grand bazar qui vend tout et n'importe quoi. Le marchand rachète, mais il pèse tout, et il pèse mal.",
    boutique: { stock: ['sac', 'corde', 'torche', 'gourdin', 'couteau-qualite', 'instrument'], prix: 1.1, rachat: 0.35, rachete: ['materiel', 'arme', 'armure', 'potion'] },
  },
  {
    id: 'vente-armes',
    nom: "Vente d'armes et d'armures",
    type: 'boutique',
    x: 30,
    y: 57,
    quartier: 'Galerie de Jaroh',
    description:
      "Deux échoppes gardées exposent le matériel des ateliers de Jambfer. Haches, marteaux et cottes de mailles naines sont de qualité, et moins chers qu'en surface.",
    boutique: {
      stock: ['hache-correcte', 'hache-bleusaille', 'hache-longue-bleusaille', 'hache-2m-grossiere', 'marteau-correct', 'dague-qualite', 'dague-premiere', 'epee-bonne', 'batarde', 'cotte-sans-manches', 'tenue-lourde', 'plastron-cuir-renforce', 'arbalete-de-qualite-correcte', 'carreaux-lot'],
      prix: 0.85,
      rachat: 0.4,
      rachete: ['arme', 'armure'],
    },
  },
  {
    id: 'salons',
    nom: 'Salons pour négociants',
    type: 'emplois',
    x: 69,
    y: 8,
    quartier: 'Galerie nord',
    description:
      "Pour négocier un achat ou une vente, la coutume veut qu'on s'installe ici, dans une alcôve de bois. Bière et viande séchée au double du prix. On y trouve des marchands nains qui cherchent des bras pour leurs convois, et des gens de la surface pour leurs livraisons.",
  },
  {
    id: 'gemmes',
    nom: 'Atelier des tailleurs de gemmes',
    type: 'info',
    x: 88,
    y: 81,
    quartier: 'Galerie est',
    description: "L'une des quatre guildes de Jambfer, avec les Polisseurs de lingots, les Forgerons et les Fondeurs. Un garde fouille quiconque veut entrer, et le superviseur ne laisse passer que les gens qui ont une bonne raison.",
    action: {
      bouton: "Demander à voir le superviseur",
      texte: "Le garde te fouille de la tête aux bottes, garde une pièce « pour la fouille », puis le superviseur te toise. « Les gemmes taillées vont aux coffres du quartier Est. Les brutes, à la réserve. Toi, tu vas dehors. » Il te fait raccompagner jusqu'au hall Jaroh.",
    },
  },
  {
    id: 'forge',
    nom: 'Atelier de forge des armes et armures',
    type: 'info',
    x: 17,
    y: 75,
    quartier: 'Galerie de Jaroh',
    description: "La guilde des Forgerons. Ça cogne du matin au soir, et les pièces finies partent à la réserve de l'armée de Jambfer, juste à côté.",
    action: {
      bouton: 'Regarder les forgerons',
      texte: "Un nain torse nu martèle une hache depuis une heure sans lever les yeux. Un autre crache sur ton épée en passant. « Fabrication humaine. » Tu crois comprendre que c'est une insulte.",
    },
  },
  {
    id: 'auberge',
    nom: "Auberge de Jambfer (quartier ouest)",
    type: 'auberge',
    x: 3,
    y: 18,
    quartier: 'Jambfer ouest',
    description:
      "L'unique et onéreuse auberge de la cité, au bout de la galerie ouest. Beaucoup de chambres souvent libres, des lits trop courts, deux dortoirs pour les fauchés, et des prix doublés par rapport à n'importe quelle auberge de qualité de la surface.",
    auberge: { repas: 4, chambre: 8, confort: 'normal' },
  },
  {
    id: 'nordibul',
    nom: 'Guérisseur Nordibul (quartier ouest)',
    type: 'soins',
    x: 3,
    y: 47,
    quartier: 'Jambfer ouest',
    description:
      "Un nain assez âgé, plutôt sympathique, qui soigne deux fois plus cher que les humains parce qu'il a du mal à se procurer ses produits. Il est toujours content d'en racheter.",
    prixSoin: 4,
    boutique: { stock: ['potion-soin', 'potion-plaies'], prix: 1.5, rachat: 0.7, rachete: ['potion'] },
  },
];

export const RUMEURS_JAMBFER = [
  "Les mineurs préparent une grève. Encore. La guilde des mineurs dit que c'est la faute des Polisseurs de lingots.",
  "La Masout, la mafia souterraine, fait ses affaires dans les entrepôts généraux, côté ouest. On s'y fait détrousser facilement.",
  "Les ingénieurs de la guilde peuvent améliorer une arbalète. Ou la faire exploser. Ça dépend des jours.",
  "L'Institut des bains annuels, côté ouest : 5 pièces d'or le bain, mais l'eau bleue de la montagne donne du courage pour la journée.",
  "Jambfer, c'est le berceau du Nain de la compagnie des Fiers de Hache. Sa famille ne veut plus en entendre parler.",
  "Les toilettes publiques ne sont indiquées nulle part. Il faut demander son chemin, et c'est payant.",
];

/** Galeries de Jambfer centre relevées sur le plan, en % (voir valtordu.ts pour le principe). */
export const RESEAU_JAMBFER = {
  noeuds: {
    ouest: [3, 14], mN1: [23, 14], malabir: [44, 14], tav: [69, 14], est: [97, 14], mm: [23, 31], mW: [8, 31], mE: [37, 31], mS: [23, 51],
    wW: [3, 51], forgeN: [18, 51], forgeC: [18, 66], vente: [30, 51], jaroh: [44, 52], rafidul: [44, 69], sud: [44, 97], eE1: [64, 54],
    eE2: [84, 54], eE3: [95, 54], gemmesC: [84, 75], cantine: [54, 46],
  } as Record<string, [number, number]>,
  aretes: [
    ['ouest', 'mN1'], ['mN1', 'malabir'], ['malabir', 'tav'], ['tav', 'est'], ['mN1', 'mm'], ['mm', 'mW'], ['mm', 'mE'], ['mm', 'mS'], ['mS', 'wW'],
    ['mS', 'forgeN'], ['forgeN', 'forgeC'], ['mS', 'vente'], ['vente', 'jaroh'], ['malabir', 'jaroh'], ['jaroh', 'rafidul'], ['rafidul', 'sud'],
    ['jaroh', 'eE1'], ['eE1', 'eE2'], ['eE2', 'eE3'], ['eE2', 'gemmesC'], ['jaroh', 'cantine'],
  ] as [string, string][],
  acces: {
    porte: 'sud', rafidul: 'rafidul', malabir: 'malabir', 'gobelin-mort': 'mN1', 'grande-taverne': 'tav', alimentation: 'mW', rombarz: 'mW',
    bazar: 'mE', 'vente-armes': 'vente', salons: 'tav', gemmes: 'gemmesC', forge: 'forgeC', auberge: 'ouest', nordibul: 'wW',
  } as Record<string, string>,
};
