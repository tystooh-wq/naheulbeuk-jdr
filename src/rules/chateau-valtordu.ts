import { combat, E, marquer, reussit, valeur, xp } from './ddn';
import type { CaracQuete } from './epreuves';
import { aMarque, malConduire, type Choix, type Evenement } from './evenements';
import { soigner, type Partie } from './partie';
import { lancer } from './des';
import { changerReputation } from './reputation';
import type { LigneRencontre } from './rencontres';
import type { Contenu, Donjon, Salle } from './donjons';
import type { Situation } from './talents';

// Le château de Valtordu, pour le scénario « Rendez-nous nos impôts ! » (POC) : plans officiels du
// rez-de-chaussée, de l'étage et des souterrains (positions en % de l'image), ennemis du document
// « Ennemis et rencontres ». Les points de couleur du plan MJ (gardes, larbins, seigneur…) sont placés
// dans les salles correspondantes ; les marques de la carte (porte cachée, grosse porte) sont des portes.

export const ID_CHATEAU = 'chateau-valtordu';

const L = (nom: string, at: number, prd: number, ev: number, pr: number, degats: string, cou: number, xp_: number, notes = ''): LigneRencontre => ({
  d20: 0,
  rencontre: nom,
  nombre: '1',
  nom,
  at,
  prd,
  ev,
  pr,
  degats,
  cou,
  xp: xp_,
  notes,
});

/** Le document « Ennemis et rencontres » du scénario. */
export const MV = {
  garde1: L('Garde (lance)', 8, 10, 18, 4, '1D+3', 12, 12, 'Armé d\'une lance et d\'un bouclier'),
  garde2: L('Garde (épée)', 7, 11, 17, 4, '1D+2', 13, 12, 'Armé d\'une épée et d\'un bouclier'),
  garde3: L('Garde (épée rouillée)', 9, 10, 19, 3, '1D+2', 11, 12, 'Armé d\'une épée rouillée'),
  garde4: L('Garde (hallebarde)', 8, 10, 20, 3, '2D+3', 12, 14, 'Armé d\'une hallebarde à deux mains'),
  garde5: L('Garde arbalétrier', 8, 10, 20, 3, '1D+4', 12, 14, 'Armé d\'une arbalète (AD 12), et d\'une épée courte au corps à corps'),
  chef: L('Chef des gardes', 11, 10, 25, 3, '2D+4', 12, 16, 'Armé d\'une hallebarde à deux mains, FO 13'),
  rat: L('Rat pesteux', 8, 4, 4, 0, '1D', 3, 4, 'Si blessure, infection une fois sur deux'),
  chapichapo: L('Chapichapo maléfique', 12, 6, 12, 2, '1D+1', 20, 15, 'Hachoir de torture très effilé, shurikens, très rapide et agile (2 attaques par assaut, esquive AD 13)'),
  forgeron: L('Ben le forgeron', 12, 10, 30, 2, '1D+4', 12, 20, 'Armé d\'une belle épée'),
  brigand: L('Brigand ivrogne', 7, 6, 15, 1, '1D+2', 8, 6, 'À moitié ivre, armé d\'un tabouret, d\'une dague ou d\'une vieille épée'),
};

const sc = (id: string, titre: string, texte: string, choix: Choix[]): Evenement => ({ id: `cv-${id}`, titre, texte, suiteSeule: true, choix });
const jet = (pour: string, carac: CaracQuete, modif = 0, situation?: Situation): Choix['jet'] => ({ faces: 20, pour, valeur: (p) => valeur(p, carac, modif, situation) });
const bagarre = (texte: string, ennemis: ReturnType<typeof E>[], o: Partial<Extract<Contenu, { type: 'combat' }>> = {}): Contenu => ({ type: 'combat', texte, ennemis, unique: true, ...o });

const JOUR: [number, number][] = [[8, 20]];

// --- Les gens du château ----------------------------------------------------------------------

const sceneBecot = sc(
  'becot',
  'Deux larbins dans le débarras',
  "Entre deux sacs de farine, un valet et une servante se bécotent avec application. Ils se figent en te voyant : « On faisait l'inventaire ! » Ils ont l'air plus effrayés par toi que par le seigneur.",
  [
    {
      libelle: 'Les rassurer et leur demander ce qui se passe ici',
      jet: jet('les mettre en confiance', 'CHA', 2, 'negocier'),
      effet: (p, rng) => {
        if (!reussit(p, 'CHA', 2, rng, 'negocier')) return { texte: '« On n\'a rien vu, rien entendu, et on n\'était pas là ! » Ils filent par la porte de service.' };
        marquer(p, 'cv:renseigne');
        return {
          texte:
            "La servante chuchote : « Le seigneur n'est pas fou. Il a peur. Les enfants ont disparu le jour où les gardes ont changé. Et la nuit, on entend des petits rires dans les souterrains… des rires de gamins, mais méchants. Le chef des gardes a la seule clé, il ne la quitte jamais. »",
        };
      },
    },
    { libelle: 'Les laisser à leur inventaire', effet: () => ({ texte: 'Tu refermes la porte. Les soupirs reprennent aussitôt.', regle: false }) },
  ],
);

const sceneCuisine = sc(
  'cuisine',
  'Les cuisines',
  "Deux cuisiniers épluchent des navets dans un silence de mort. « Vous n'êtes pas des gardes, vous… Le seigneur a encore doublé les impôts, il paraît. Il ne mange plus rien. On ne sort plus faire les courses, on ne voit plus personne. »",
  [
    {
      libelle: 'Leur demander un en-cas',
      effet: (p) => {
        const r = soigner(p, 2);
        p.sac.push('rations');
        return { texte: `Ils te glissent une tranche de boudin et un quignon, plus une ration pour la route${r ? ` (+${r} PV)` : ''}. « Si c'est pour aider le seigneur, prenez. »` };
      },
    },
    { libelle: 'Les laisser travailler', effet: () => ({ texte: 'Les navets reprennent leur triste destin.', regle: false }) },
  ],
);

const sceneLarbinSalon = sc(
  'guide',
  'Un larbin dans le salon',
  "Un domestique en livrée époussette un fauteuil qui n'a pas de poussière. Il sursaute et lâche son plumeau.",
  [
    {
      libelle: 'Le convaincre de te guider dans le château',
      jet: jet('le convaincre', 'CHA', 1, 'negocier'),
      effet: (p, rng) => {
        if (!reussit(p, 'CHA', 1, rng, 'negocier')) return { texte: '« Je… je dois faire les cuivres ! » Il s\'enfuit vers les cuisines en serrant son plumeau.' };
        marquer(p, 'cv:guide');
        return {
          texte:
            "Il chuchote très vite : « Le seigneur est dans son bureau le jour, et dans sa chambre la nuit avec madame. Le chef des gardes se tient à l'étage, devant la chambre de madame, jour et nuit. Les souterrains, c'est par la grosse porte derrière le balcon du hall. Et il y a une porte cachée entre ce salon et la salle des gardes, derrière la tapisserie. »",
        };
      },
    },
  ],
);

const sceneSeigneur = sc(
  'seigneur',
  'Hubert Jeanfort, seigneur de Valtordu',
  "Derrière son bureau, un homme aux yeux cernés signe des avis d'imposition. Un garde se tient près de la porte, impassible. Le seigneur lève la tête, et son regard dit autre chose que sa bouche : « Sortez. Je ne reçois personne. »",
  [
    {
      libelle: 'Lui faire comprendre, d\'un regard, que tu es là pour l\'aider',
      jet: jet('se faire comprendre sans un mot', 'INT', 0),
      effet: (p, rng) => {
        if (!reussit(p, 'INT', 0, rng))
          return {
            texte: 'Le garde fronce les sourcils et pose la main sur son épée. « Le seigneur a dit : dehors ! » Ça va mal tourner.',
            combat: { rencontre: combat(p, [E(MV.garde2)]), victoire: (q) => (marquer(q, 'cv:seigneur-parle'), "Le garde s'écroule. Le seigneur se lève d'un bond : « Mes enfants ! Ces petites choses en pyjama les gardent dans les souterrains. Le chef des gardes a la clé. Faites vite, je vous en prie. »") },
          };
        marquer(p, 'cv:seigneur-parle');
        return {
          texte:
            "Le seigneur pousse vers toi un avis d'imposition. Au dos, griffonné : « Mes enfants sont otages dans les souterrains. Deux petites créatures en pyjama commandent les gardes. Le chef a la clé. Je ne peux rien faire. » Puis, à voix haute : « Dehors ! »",
        };
      },
    },
    { libelle: 'Sortir sans insister', effet: () => ({ texte: 'Tu ressors. Le seigneur replonge dans ses avis d\'imposition.', regle: false }) },
  ],
);

const sceneChatelaine = sc(
  'chatelaine',
  'La châtelaine',
  "Une dame en robe de deuil est assise près de la fenêtre, un petit cheval de bois dans les mains. Elle te dévisage sans peur : « Si vous venez me tuer, faites vite. Si vous venez nous aider, faites plus vite encore. »",
  [
    {
      libelle: 'Lui promettre de ramener ses enfants',
      effet: (p) => {
        marquer(p, 'cv:chatelaine');
        return {
          texte:
            "« Ils ont empoisonné la soupe des gardes avec une potion volée, et depuis, les gardes leur obéissent comme des chiens. Deux petites horreurs, pas plus hautes qu'une chaise, en pyjama, l'un rose, l'autre bleu. Ils ont emmené Hugo et Léonie dans les souterrains. » Elle te tend un mouchoir brodé : « Montrez-leur ça. Ils vous suivront. »",
        };
      },
    },
  ],
);

const scenePaysan = sc(
  'paysan',
  'Le paysan torturé',
  "Sur un vieux chevalet, un paysan à moitié mort gémit. On l'a envoyé porter une pétition au seigneur. Voilà la réponse.",
  [
    {
      libelle: 'Le détacher et soigner ses plaies (épreuve d\'Intelligence)',
      jet: jet('le soigner', 'INT', 0, 'connaissance'),
      effet: (p, rng) => {
        marquer(p, 'cv:paysan-libre');
        if (!reussit(p, 'INT', 0, rng, 'connaissance')) return { texte: "Tu le détaches et le cales contre le mur. Il respire. C'est déjà ça : il saura retrouver la sortie quand tout sera fini." };
        marquer(p, 'cv:paysan-soigne');
        xp(p, 5);
        changerReputation(p, 'valtordu', 1, 'Gaspard le paysan, sauvé des souterrains');
        return { texte: "Tu panses ses plaies avec ce que tu as. Il serre ta main : « Je m'appelle Gaspard. Quand je serai rentré, passe à ma ferme, je te revaudrai ça. » Au village, on saura ce que tu as fait." };
      },
    },
    { libelle: 'Le laisser là pour l\'instant', effet: () => ({ texte: 'Il te regarde partir sans un mot.', regle: false }) },
  ],
);

const sceneOtages = sc(
  'otages',
  'Les enfants du seigneur',
  "Dans une petite pièce humide, deux enfants serrés l'un contre l'autre, sales, mais vivants. Hugo et Léonie Jeanfort. À côté d'eux, le coffre au trésor des chapichapos déborde de pièces, de bijoux de famille et de cuillères en étain : les impôts de tout Valtordu.",
  [
    {
      libelle: 'Rassurer les enfants et les ramener à leurs parents',
      effet: (p) => {
        marquer(p, 'cv:enfants');
        xp(p, 10);
        return { texte: `${aMarque(p, 'cv:chatelaine') ? 'Tu montres le mouchoir de leur mère : les enfants se jettent dans tes bras. ' : ''}Tu les ramènes à la lumière. Le seigneur arrive en courant dans les souterrains, suivi de gardes qui se frottent les yeux comme au sortir d'un long cauchemar.` };
      },
    },
    {
      libelle: 'Éloigner les enfants et fouiller très vite le coffre (Adresse)',
      jet: jet('se servir discrètement', 'AD', 0, 'vol'),
      effet: (p, rng) => {
        marquer(p, 'cv:enfants');
        if (!reussit(p, 'AD', 0, rng, 'vol')) {
          malConduire(p, 'cv:pris-au-coffre');
          return { texte: "Les mains dans le coffre, tu entends : « Papa ! Le monsieur prend nos sous ! » Le seigneur, qui arrive à cet instant, te regarde d'un air glacial. Les gardes, réveillés de leur cauchemar, ramènent tout le monde à la lumière." };
        }
        // Le coffre des impôts de tout un village : ce qu'on rafle en quelques secondes (2D6 × 10 PO, choix maison).
        const pris = (lancer(6, rng) + lancer(6, rng)) * 10;
        p.or += pris;
        return { texte: `${pris} pièces d'or et une poignée de bijoux de famille disparaissent dans ta bourse avant que le seigneur n'arrive, suivi de gardes qui se frottent les yeux comme au sortir d'un long cauchemar. Il veut rendre les impôts aux villageois. Toi, tu as déjà prélevé ta commission.` };
      },
    },
  ],
);

// --- Les salles ---------------------------------------------------------------------------------

const RDC: Salle[] = [
  {
    id: 'cv-entree',
    nom: 'Devant la grande porte',
    niveau: 'cv-rdc',
    px: 45,
    py: 93,
    x: 0,
    y: 0,
    sortie: 'Revenir dans la rue du Château',
    description: "La grande porte du château, au bout de la rue du Château. Fermée, évidemment. Pas un garde dehors : ils sont tous à l'intérieur.",
    vers: ['cv-hall'],
    portes: { 'cv-hall': { texte: 'la grande porte du château, fermée à clé', cle: 'cle-chateau-valtordu', crochetage: -4, force: -5 } },
  },
  {
    id: 'cv-hall',
    nom: 'Le hall',
    niveau: 'cv-rdc',
    px: 45,
    py: 64,
    x: 0,
    y: 0,
    description: 'Un grand hall dallé, deux escaliers qui montent à l\'étage, des portes de chaque côté. Au-dessus de la porte de gauche, une alcôve avec un balcon.',
    vers: ['cv-entree', 'cv-balcon', 'cv-bureau', 'cv-salon', 'cv-ecuries', 'cv-salle-manger', 'cv1-palier'],
    contenu: bagarre(
      "Deux gardes au regard vide lèvent leurs armes sans un mot. Là-haut, dans l'alcôve du balcon, un troisième arme son arbalète.",
      [E(MV.garde1), E(MV.garde2), E(MV.garde5)],
    ),
  },
  {
    id: 'cv-balcon',
    nom: "L'alcôve du balcon",
    niveau: 'cv-rdc',
    px: 25,
    py: 73,
    x: 0,
    y: 0,
    description: "Le petit balcon d'où l'arbalétrier surveillait le hall. Au fond, quelques marches descendent vers une grosse porte cloutée.",
    vers: ['cv-hall', 'cv-sout-porte'],
    portes: { 'cv-sout-porte': { texte: 'une grosse porte cloutée, fermée à clé', cle: 'cle-souterrains-valtordu', crochetage: -3, force: -4 } },
  },
  {
    id: 'cv-sout-porte',
    nom: 'Entrée des souterrains',
    niveau: 'cv-rdc',
    px: 11,
    py: 84,
    x: 0,
    y: 0,
    description: "Une tour ronde, humide. Un escalier en colimaçon s'enfonce sous le château. Ça sent le rat, la pluie et autre chose.",
    vers: ['cv-balcon', 'cvs-escalier'],
  },
  {
    id: 'cv-bureau',
    nom: 'Le bureau du seigneur',
    niveau: 'cv-rdc',
    px: 20,
    py: 53,
    x: 0,
    y: 0,
    description: 'Un bureau encombré d\'avis d\'imposition.',
    vers: ['cv-hall', 'cv-secrete'],
    portes: { 'cv-secrete': { texte: 'un panneau de bois qui sonne creux', cachee: { carac: 'INT', modif: -2 } } },
    variantes: [
      { quand: JOUR, contenu: { type: 'scene', scene: sceneSeigneur }, description: 'Un bureau encombré d\'avis d\'imposition. Le seigneur y travaille le jour, sous bonne garde.' },
      { description: 'Le bureau est vide la nuit : le seigneur dort à l\'étage, sous bonne garde.' },
    ],
  },
  {
    id: 'cv-secrete',
    nom: 'La pièce secrète',
    niveau: 'cv-rdc',
    px: 15.5,
    py: 63,
    x: 0,
    y: 0,
    description: 'Un réduit sans fenêtre, derrière le bureau. Le seigneur y range ce qu\'il ne veut pas voir taxé.',
    vers: ['cv-bureau'],
    tresor: { or: 40, objets: ['potion-soin'], texte: 'Une cassette de famille et une fiole de potion, posées sur une étagère.' },
  },
  {
    id: 'cv-salle-manger',
    nom: 'La salle à manger',
    niveau: 'cv-rdc',
    px: 55,
    py: 30,
    x: 0,
    y: 0,
    description: 'Une longue table dressée pour un banquet qui n\'a jamais eu lieu. Les bougies ont fondu, la poussière a pris place.',
    vers: ['cv-hall', 'cv-cuisines', 'cv-debarras'],
  },
  {
    id: 'cv-cuisines',
    nom: 'Les cuisines',
    niveau: 'cv-rdc',
    px: 22,
    py: 31,
    x: 0,
    y: 0,
    description: 'Des marmites, une cheminée, une odeur de navet.',
    vers: ['cv-salle-manger', 'cv-reserve'],
    contenu: { type: 'scene', scene: sceneCuisine },
  },
  {
    id: 'cv-reserve',
    nom: 'La réserve',
    niveau: 'cv-rdc',
    px: 12,
    py: 17,
    x: 0,
    y: 0,
    description: 'Une tour d\'angle pleine de jambons, de sacs de farine et de pots de graisse.',
    vers: ['cv-cuisines'],
    tresor: { objets: ['boudin-valtordu', 'rations'], texte: 'Un boudin de Valtordu et des provisions, que personne ne comptera.' },
  },
  {
    id: 'cv-debarras',
    nom: 'Le débarras',
    niveau: 'cv-rdc',
    px: 81,
    py: 15,
    x: 0,
    y: 0,
    description: 'Une tour d\'angle encombrée de balais et de sacs.',
    vers: ['cv-salle-manger'],
    contenu: { type: 'scene', scene: sceneBecot },
  },
  {
    id: 'cv-salon',
    nom: 'Le salon',
    niveau: 'cv-rdc',
    px: 70,
    py: 59,
    x: 0,
    y: 0,
    description: 'Des fauteuils, une tapisserie de chasse au mouton, un escalier qui monte à l\'étage.',
    vers: ['cv-hall', 'cv-gardes', 'cv1-est'],
    portes: { 'cv-gardes': { texte: 'une porte dérobée derrière la tapisserie', cachee: { carac: 'INT', modif: -1 } } },
    contenu: { type: 'scene', scene: sceneLarbinSalon },
  },
  {
    id: 'cv-ecuries',
    nom: 'Les écuries',
    niveau: 'cv-rdc',
    px: 68,
    py: 77,
    x: 0,
    y: 0,
    description: 'Trois chevaux maigres qui n\'ont pas vu de foin depuis longtemps. Ils te regardent avec espoir.',
    vers: ['cv-hall', 'cv-gardes'],
  },
  {
    id: 'cv-gardes',
    nom: 'La salle des gardes',
    niveau: 'cv-rdc',
    px: 83,
    py: 85,
    x: 0,
    y: 0,
    sortie: 'Ressortir par la fenêtre de la salle des gardes',
    description: 'Une tour ronde aux murs épais, des râteliers d\'armes, une table couverte de cartes à jouer. Une fenêtre basse donne sur la rue.',
    vers: ['cv-ecuries', 'cv-salon'],
    contenu: bagarre('Trois gardes jouent aux cartes. Ils se lèvent ensemble, le regard vide, et décrochent leurs armes.', [E(MV.garde3), E(MV.garde4), E(MV.garde2)]),
  },
];

const ETAGE: Salle[] = [
  {
    id: 'cv1-palier',
    nom: 'Le grand palier',
    niveau: 'cv-etage',
    px: 40,
    py: 48,
    x: 0,
    y: 0,
    description: "Le palier de l'étage, devant la chambre de la châtelaine. Ce n'est pas très logique de la garder elle, mais c'est comme ça.",
    vers: ['cv-hall', 'cv1-chambre', 'cv1-enfants', 'cv1-dortoir', 'cv1-amis', 'cv1-jeux', 'cv1-the'],
    contenu: bagarre(
      'Le chef des gardes, une hallebarde à deux mains, se tient devant la porte de la chambre avec un de ses hommes. « Personne ne passe. Ordre du… du seigneur. »',
      [E(MV.chef), E(MV.garde1)],
      { gagne: ['cle-souterrains-valtordu'] },
    ),
  },
  {
    id: 'cv1-chambre',
    nom: 'La chambre du seigneur',
    niveau: 'cv-etage',
    px: 23,
    py: 30,
    x: 0,
    y: 0,
    description: 'Un grand lit à baldaquin, des tapis de laine, une fenêtre sur la rue du Château.',
    vers: ['cv1-palier', 'cv1-penderie'],
    contenu: { type: 'scene', scene: sceneChatelaine },
  },
  {
    id: 'cv1-penderie',
    nom: 'La penderie',
    niveau: 'cv-etage',
    px: 12,
    py: 17,
    x: 0,
    y: 0,
    description: 'Des robes, des pourpoints, et trois pulls de Valtordu (de luxe) soigneusement pliés.',
    vers: ['cv1-chambre'],
    tresor: { objets: ['pull-valtordu'], texte: 'Un pull de Valtordu, que personne ne regrettera.' },
  },
  {
    id: 'cv1-enfants',
    nom: 'La chambre des enfants',
    niveau: 'cv-etage',
    px: 43,
    py: 27,
    x: 0,
    y: 0,
    description: "Deux petits lits défaits, des jouets renversés. Sur le sol, de minuscules traces de pas boueuses, trop petites pour un adulte, trop griffues pour un enfant. Elles mènent vers l'escalier.",
    vers: ['cv1-palier'],
  },
  {
    id: 'cv1-dortoir',
    nom: 'Le dortoir des larbins',
    niveau: 'cv-etage',
    px: 66,
    py: 30,
    x: 0,
    y: 0,
    description: 'Des paillasses alignées. Le personnel dort ici, quand il arrive à dormir.',
    vers: ['cv1-palier', 'cv1-pigeons'],
    contenu: { type: 'repos', pv: 3, texte: 'Une paillasse libre, une couverture qui gratte : de quoi souffler un peu.' },
  },
  {
    id: 'cv1-pigeons',
    nom: 'Le pigeonnier',
    niveau: 'cv-etage',
    px: 80,
    py: 13,
    x: 0,
    y: 0,
    description: "Des pigeons voyageurs qui roucoulent. Les messages du seigneur ne partent plus : quelqu'un a tordu toutes les bagues.",
    vers: ['cv1-dortoir', 'cv1-est'],
  },
  {
    id: 'cv1-amis',
    nom: "Les chambres d'amis",
    niveau: 'cv-etage',
    px: 20,
    py: 63,
    x: 0,
    y: 0,
    description: "Deux chambres pour les invités. Plus personne n'est invité au château depuis des semaines.",
    vers: ['cv1-palier', 'cv1-eau'],
  },
  {
    id: 'cv1-eau',
    nom: "La salle d'eau",
    niveau: 'cv-etage',
    px: 13,
    py: 83,
    x: 0,
    y: 0,
    description: 'Une baignoire en cuivre et une servante qui frotte le carrelage en pleurant doucement.',
    vers: ['cv1-amis', 'cv1-the'],
    contenu: { type: 'repos', pv: 2, texte: "La servante te tend une serviette chaude sans poser de questions. Un brin de toilette, et ça va mieux." },
  },
  {
    id: 'cv1-jeux',
    nom: 'La salle de jeux',
    niveau: 'cv-etage',
    px: 50,
    py: 63,
    x: 0,
    y: 0,
    description: 'Un échiquier abandonné en pleine partie, des cartes, un jeu de quilles. Le seigneur gagnait, apparemment.',
    vers: ['cv1-palier', 'cv1-est', 'cv1-the'],
  },
  {
    id: 'cv1-the',
    nom: 'Le salon de thé',
    niveau: 'cv-etage',
    px: 46,
    py: 86,
    x: 0,
    y: 0,
    description: 'Une petite pièce au-dessus de l\'entrée, avec une vue sur la rue du Château et des tasses ébréchées.',
    vers: ['cv1-palier', 'cv1-jeux', 'cv1-eau'],
  },
  {
    id: 'cv1-est',
    nom: "Le palier de l'escalier du salon",
    niveau: 'cv-etage',
    px: 72,
    py: 50,
    x: 0,
    y: 0,
    description: "Le haut de l'escalier qui descend au salon.",
    vers: ['cv-salon', 'cv1-jeux', 'cv1-prive', 'cv1-pigeons'],
  },
  {
    id: 'cv1-prive',
    nom: 'Le salon privé',
    niveau: 'cv-etage',
    px: 72,
    py: 67,
    x: 0,
    y: 0,
    description: 'Deux fauteuils face à la cheminée, une carafe vide. Le seigneur y fumait sa pipe, avant.',
    vers: ['cv1-est', 'cv1-biblio'],
  },
  {
    id: 'cv1-biblio',
    nom: 'La bibliothèque',
    niveau: 'cv-etage',
    px: 83,
    py: 84,
    x: 0,
    y: 0,
    description: "Des rayonnages de livres de comptes et d'almanachs ovins. Sur le pupitre, le registre des impôts : les montants ont triplé, d'une écriture tremblante.",
    vers: ['cv1-prive'],
    tresor: { or: 15, texte: 'Une bourse oubliée derrière les almanachs.' },
  },
];

const SOUTERRAINS: Salle[] = [
  {
    id: 'cvs-escalier',
    nom: "Le bas de l'escalier",
    niveau: 'cv-sout',
    px: 37,
    py: 95,
    x: 0,
    y: 0,
    description: 'Le colimaçon débouche sur un long couloir humide, éclairé par des torches. De l\'eau de pluie goutte du plafond.',
    vers: ['cv-sout-porte', 'cvs-couloir'],
  },
  {
    id: 'cvs-couloir',
    nom: 'Le couloir des geôles',
    niveau: 'cv-sout',
    px: 37,
    py: 72,
    x: 0,
    y: 0,
    description: "Un couloir étroit, bordé de portes de geôles ouvertes. Ça sent très mauvais.",
    vers: ['cvs-escalier', 'cvs-rats', 'cvs-geoles', 'cvs-nord'],
    contenu: bagarre('Un garde fait les cent pas dans le couloir. Il se retourne, l\'épée déjà sortie.', [E(MV.garde2)]),
  },
  {
    id: 'cvs-geoles',
    nom: 'Les geôles vides',
    niveau: 'cv-sout',
    px: 60,
    py: 77,
    x: 0,
    y: 0,
    description: "Deux geôles ouvertes, vides, avec de la paille pourrie. Des noms gravés dans la pierre : ceux des émissaires que les villageois avaient envoyés au seigneur.",
    vers: ['cvs-couloir'],
  },
  {
    id: 'cvs-rats',
    nom: 'La geôle aux rats',
    niveau: 'cv-sout',
    px: 60,
    py: 56,
    x: 0,
    y: 0,
    description: 'Une geôle infestée de rats occupés à dévorer des cadavres putréfiés.',
    vers: ['cvs-couloir'],
    contenu: bagarre('Les rats lèvent le museau de leur festin. Il y en a beaucoup. Ils ont faim, et toi tu es frais.', [E(MV.rat, 3)]),
  },
  {
    id: 'cvs-nord',
    nom: 'Le couloir nord',
    niveau: 'cv-sout',
    px: 37,
    py: 34,
    x: 0,
    y: 0,
    description: 'Le couloir remonte vers deux portes. Derrière la plus grande, des voix aiguës se disputent.',
    vers: ['cvs-couloir', 'cvs-gardes', 'cvs-trone'],
  },
  {
    id: 'cvs-gardes',
    nom: 'La salle des gardes des souterrains',
    niveau: 'cv-sout',
    px: 18,
    py: 24,
    x: 0,
    y: 0,
    description: 'Des lits superposés, une table, des bouteilles vides.',
    vers: ['cvs-nord'],
    contenu: bagarre('Un garde se lève de sa couchette en titubant, attrape sa lance et fonce sur toi.', [E(MV.garde1)]),
    tresor: { or: 12, objets: ['torche'], texte: 'La paie des gardes, cachée sous un matelas, et une torche de rechange.' },
  },
  {
    id: 'cvs-trone',
    nom: 'La salle du trône des chapichapos',
    niveau: 'cv-sout',
    px: 72,
    py: 30,
    x: 0,
    y: 0,
    description:
      "L'ancienne salle de torture, transformée en salle du trône grotesque : un fauteuil doré sur une table, un tas d'objets inutiles dans un coin. Le butin des impôts est rangé à côté.",
    vers: ['cvs-nord', 'cvs-chevalet', 'cvs-otages'],
    contenu: bagarre(
      "Sur le trône, deux petites créatures en pyjama, l'une rose et l'autre bleue, avec de grands chapeaux ronds, se chamaillent : « C'est TOI qui as fini la potion ! — Non, c'est TOI ! » Elles te voient, sortent des hachoirs de torture très effilés et sautent sur la table en ricanant.",
      [E(MV.chapichapo, 2)],
      { marque: 'cv:chapichapos' },
    ),
  },
  {
    id: 'cvs-chevalet',
    nom: 'Le coin torture',
    niveau: 'cv-sout',
    px: 52,
    py: 13,
    x: 0,
    y: 0,
    description: 'Un chevalet, des chaînes, et un paysan qui y est attaché.',
    vers: ['cvs-trone'],
    contenu: { type: 'scene', scene: scenePaysan },
  },
  {
    id: 'cvs-otages',
    nom: 'La pièce des otages',
    niveau: 'cv-sout',
    px: 90,
    py: 56,
    x: 0,
    y: 0,
    description: 'Une petite pièce derrière la salle du trône.',
    vers: ['cvs-trone'],
    contenu: { type: 'scene', scene: sceneOtages },
  },
];

// Les chapichapos morts, le sortilège de Suprématie s'évanouit : les gardes redeviennent normaux et ne se battent plus.
const libere = (p: Partie) => aMarque(p, 'cv:chapichapos');
const APRES: Record<string, string> = {
  'cv-bureau': "Le bureau est vide : le seigneur est auprès de ses enfants. Il t'attend à la porte du château pour te remercier.",
  'cv-hall': 'Des gardes encore hagards te saluent bien bas en passant. « Merci, l\'ami. On a fait un drôle de rêve. »',
  'cv-gardes': 'Les gardes ont rangé les cartes et se passent une cruche d\'eau fraîche en se tenant la tête.',
  'cv1-palier': "Le chef des gardes, la clé à la ceinture, se confond en excuses : « Je ne sais pas ce qui m'a pris. »",
  'cvs-couloir': 'Un garde fait les cent pas, mais cette fois il te salue.',
  'cvs-gardes': "Le garde de la couchette ronfle comme un bienheureux. On ne le réveille pas.",
};
for (const sa of [...RDC, ...ETAGE, ...SOUTERRAINS])
  if (APRES[sa.id]) sa.variantes = [{ si: libere, description: APRES[sa.id] }, ...(sa.variantes ?? [])];

export const CHATEAU_VALTORDU: Donjon = {
  id: ID_CHATEAU,
  nom: 'Le château de Valtordu',
  ou: 'ville:valtordu:chateau',
  niveaux: [
    { id: 'cv-etage', nom: "L'étage" },
    { id: 'cv-rdc', nom: 'Le rez-de-chaussée' },
    { id: 'cv-sout', nom: 'Les souterrains' },
  ],
  entrees: [
    { salle: 'cv-entree', libelle: 'Aller à la grande porte' },
    { salle: 'cv-gardes', libelle: 'Entrer par la fenêtre de la salle des gardes, à droite' },
  ],
  intro:
    "Le petit château des Jeanfort, au bout de la rue du Château : quatre tours, des volets fermés, pas un bruit. Seuls les gardes entrent et sortent.",
  salles: [...RDC, ...ETAGE, ...SOUTERRAINS],
  entree: 'cv-entree',
  finale: 'cvs-otages',
  conclusion:
    "Les chapichapos morts, le sortilège de Suprématie s'évanouit : les gardes se réveillent comme d'un long cauchemar. Les enfants Jeanfort sont libres. Il reste à aller voir le seigneur.",
};
