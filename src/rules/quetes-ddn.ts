import { aMarque } from './evenements';
import { entre, instruments, INSTRUMENTS_ZANGDAR } from './ddn';
import type { Quete } from './quetes';
import type { LigneRencontre } from './rencontres';

// Les quêtes du Donjon de Naheulbeuk : le volume 1 des quêtes officielles (une ou deux par étage),
// plus la grande quête de la statuette, qui se joue sur la durée.
// Les étapes « donjon:naheulbeuk:salle » se jouent dans la salle du donjon.

const ici = (salle: string) => `donjon:naheulbeuk:${salle}`;

/** La bestiole invoquée par le mage du rituel : un petit démon de bas étage (estimation, le scénario ne la décrit pas). */
const BESTIOLE: LigneRencontre = {
  d20: 0,
  rencontre: 'Bestiole invoquée',
  nombre: '1',
  nom: 'Bestiole démoniaque invoquée',
  at: 10,
  prd: 8,
  ev: 16,
  pr: 1,
  degats: '1D+2',
  cou: 12,
  xp: 14,
  notes: 'Un petit démon de bas étage, sorti du pentacle par erreur. Il est furieux.',
};

export const QUETES_DDN: Quete[] = [
  {
    id: 'ddn-statuette',
    titre: 'La statuette de Zangdar',
    donneur: 'ville:valtordu:trois-boudins',
    qui: "Un homme encapuchonné, au fond de la salle des Trois Boudins",
    proposition:
      "Un homme dont on ne voit que le menton te fait signe de t'asseoir. « On dit que tu as du courage. Le sorcier Zangdar garde dans son bureau, au deuxième niveau de son donjon, une statuette prophétique : la statuette de Gladeulfeurha. Je la veux. Le placard est scellé par sa magie : tant que Zangdar tient debout, personne ne l'ouvrira. Et Zangdar est protégé par une sphère d'invincibilité parfaite. Trouve sa faiblesse, prépare-toi, et prends ton temps : ce n'est pas un travail d'une semaine. »",
    etapes: [
      {
        ou: ici('n0-entree'),
        objectif:
          "Découvrir la faiblesse de Zangdar et de sa sphère d'invincibilité. Les gens du donjon savent des choses : le personnel de la taverne, le bourreau quand il a bu, Reivax quand il a peur, les corbeaux…",
        action: 'Chercher la faiblesse de Zangdar',
        recit: "Tu connais le secret de Zangdar : il ne supporte pas la musique mal jouée. Avec au moins quatre instruments joués très faux, sa sphère d'invincibilité ne tient pas.",
        auto: (p) => aMarque(p, 'ddn:faiblesse'),
      },
      {
        ou: ici('n0-entree'),
        objectif: `Réunir au moins ${INSTRUMENTS_ZANGDAR} instruments de musique dans ton sac (on en trouve dans les coffres du donjon, au magasin de la cave et dans les boutiques des villes).`,
        action: 'Réunir des instruments',
        recit: `Tu as ${INSTRUMENTS_ZANGDAR} instruments. Tu ne sais jouer d'aucun, et c'est parfait.`,
        auto: (p) => instruments(p) >= INSTRUMENTS_ZANGDAR,
      },
      {
        ou: ici('n2-15'),
        objectif:
          "Vaincre Zangdar (à son bureau de 9 h à 18 h, dans sa bibliothèque le soir, dans sa chambre la nuit), puis prendre la statuette dans le placard de son bureau, au niveau 2.",
        action: 'Ouvrir le placard à statuettes',
        recit: "Le sceau du placard s'est éteint avec la défaite de Zangdar. Parmi les statuettes prophétiques, une seule a l'air de te regarder : Gladeulfeurha. Tu l'emballes dans une chaussette.",
        requiert: (p) => (aMarque(p, 'ddn:zangdar-vaincu') ? null : 'Le placard est scellé par la magie de Zangdar : il faut d\'abord le vaincre.'),
        donne: 'statuette-zangdar',
      },
      {
        ou: 'ville:valtordu:trois-boudins',
        objectif: "Rapporter la statuette à l'homme encapuchonné, aux Trois Boudins de Valtordu.",
        action: 'Remettre la statuette',
        recit: "L'homme encapuchonné soupèse la statuette, sourit d'un sourire qu'on ne voit pas, et pose une lourde bourse sur la table. « On se reverra. » Quand tu relèves les yeux, il n'est plus là.",
        reprend: 'statuette-zangdar',
      },
    ],
    recompense: { or: 1500, xp: 100, texte: '1500 PO' },
    niveau: 4,
  },
  {
    id: 'ddn-rituel',
    titre: 'Le rituel',
    donneur: 'ville:chnafon:ecole',
    qui: "Brindol, un apprenti mage de l'École de magie de Chnafon",
    proposition:
      "« La salle des rituels du Donjon de Naheulbeuk est la meilleure de la Terre de Fangh : l'architecte l'a conçue exprès. Je dois y réussir un rituel d'invocation que je n'ai jamais réussi ailleurs. Il me faut une escorte. Elle est au rez-de-chaussée, à gauche après la double porte. Attention à la dalle du couloir et aux orques d'à côté. »",
    etapes: [
      {
        ou: ici('n0-12'),
        objectif: "Escorter Brindol jusqu'à la salle des rituels du Donjon de Naheulbeuk (rez-de-chaussée, à gauche après la double porte) et le protéger pendant le rituel.",
        action: 'Laisser Brindol procéder au rituel',
        recit: "Le rituel réussit… trop bien. La bestiole est renvoyée dans son plan à coups d'épée, et Brindol, livide, déclare que c'était exactement ce qu'il voulait.",
        combat: { ligne: BESTIOLE, nombre: 1 },
      },
      {
        ou: 'ville:chnafon:ecole',
        objectif: "Ramener Brindol à l'École de magie de Chnafon.",
        action: 'Ramener Brindol à son école',
        recit: "Brindol raconte son rituel à tous ses camarades en oubliant la partie où il s'est caché derrière toi. Il te paie quand même.",
      },
    ],
    recompense: { or: 500, xp: 30, texte: '500 PO' },
    niveau: 1,
  },
  {
    id: 'ddn-puits',
    titre: 'Le puits des âmes damnées',
    donneur: 'ville:chnafon:chateau',
    qui: 'Dame Tordelia de Luzur, veuve de la noblesse de Chnafon',
    proposition:
      "« Mon défunt mari, Ravamic, me hante toutes les nuits. Une partie de son âme est coincée dans les limbes, et la porte des limbes, c'est le puits des âmes damnées, dans la cave du Donjon de Naheulbeuk. Un prêtre a préparé cette poudre : dispersez-la dans le puits et lisez la formule. Un ami m'a dit qu'au rez-de-chaussée il faut aller à gauche, puis descendre l'escalier un peu plus loin. »",
    remet: ['poudre-luzur'],
    etapes: [
      {
        ou: ici('cave-10'),
        objectif: "Disperser la poudre du prêtre dans le puits des âmes damnées (cave du donjon) et lire la formule.",
        action: 'Disperser la poudre et lire la formule',
        recit: "La poudre scintille en tombant dans le noir. Tu lis la formule sans trébucher sur les mots. Du fond du puits monte un long soupir, puis plus rien : Ravamic de Luzur a trouvé la paix.",
        epreuve: { carac: 'INT', echec: 'Tu écorches un mot de la formule. Le puits gronde, une main glacée te frôle. Il faudra recommencer, en articulant.', pvEchec: 2 },
        requiert: (p) => (p.sac.includes('poudre-luzur') ? null : 'Il faut la poudre du prêtre de Chnafon.'),
        reprend: 'poudre-luzur',
      },
      {
        ou: 'ville:chnafon:chateau',
        objectif: 'Annoncer à Dame Tordelia que son mari repose en paix.',
        action: 'Rassurer Dame Tordelia',
        recit: "Dame Tordelia a dormi toute la nuit, pour la première fois depuis des mois. Elle te remercie avec une dignité un peu humide.",
      },
    ],
    recompense: { or: 1000, xp: 30, texte: '1000 PO' },
    niveau: 2,
  },
  {
    id: 'ddn-troll',
    titre: 'Le trésor du troll enchaîné',
    donneur: 'ville:tulamor:mairie',
    qui: "Anselme de Brocheval, un héritier sans preuve, devant le bureau du notaire",
    proposition:
      "« Mon oncle est mort, je suis le dernier de la famille, et le notaire refuse de me laisser l'héritage sans la broche en or à notre blason. Je l'ai échangée contre ma vie, il y a des années, au troll enchaîné des souterrains du Donjon de Naheulbeuk. On y descend par la taverne : un escalier part près des toilettes, et en bas, il faut prendre à gauche. Ce troll est érudit et dur en affaires : prenez cette bague de famille pour l'échange. »",
    remet: ['bague-heritier'],
    etapes: [
      {
        ou: ici('sout-18'),
        objectif: "Trouver le troll enchaîné dans les souterrains du donjon (par la taverne, l'escalier près des toilettes, puis à gauche) et récupérer la broche au blason.",
        action: 'Négocier la broche contre la bague',
        recit: "Le troll examine la bague à la lumière, renifle, et finit par fouiller dans son coffre. « Marché conclu. Les gens honnêtes se font rares. » La broche au blason est à toi.",
        epreuve: { carac: 'CHA', modif: -1, situation: 'negocier', echec: "Le troll croise les bras. « Ma broche vaut plus que ça. Revenez avec de meilleurs arguments. »" },
        dispense: (p) => aMarque(p, 'ddn:troll-mort') || aMarque(p, 'ddn:ami-troll'),
        reprend: 'bague-heritier',
        donne: 'broche-blason',
      },
      {
        ou: 'ville:tulamor:mairie',
        objectif: "Rapporter la broche à Anselme, à la mairie de Tulamor.",
        action: 'Remettre la broche',
        recit: "Le notaire examine la broche à la loupe, tamponne quatre documents, et Anselme hérite. Il te paie avec l'argent de son oncle, ce qui le fait beaucoup rire.",
        reprend: 'broche-blason',
      },
    ],
    recompense: { or: 1000, xp: 30, texte: '1000 PO' },
    niveau: 2,
  },
  {
    id: 'ddn-ours',
    titre: "L'ours à la bière",
    donneur: 'ville:valtordu:trois-boudins',
    qui: 'Gros Didier, le patron des Trois Boudins',
    proposition:
      "« L'ours à la bière du Donjon de Naheulbeuk ! Tout le monde m'en parle ! J'ai écrit trois fois au chef de cuisine, il m'a jamais répondu. Moi j'y arrive pas, c'est toujours raté. Sa recette est dans ses appartements, au niveau 1, derrière la taverne. Pour entrer dans la taverne, tu fais le tour du donjon et tu suis l'écriteau. Seuls le bar et la grande salle sont publics. Pas besoin de tuer qui que ce soit, hein. »",
    etapes: [
      {
        ou: ici('n1-9'),
        objectif: 'Entrer dans la taverne du Donjon de Naheulbeuk, se glisser dans les appartements du chef cuisinier (niveau 1) et prendre la recette.',
        action: 'Chercher la recette parmi les papiers gras',
        recit: "Sous une pile de factures de bière et de sauce brune : « Ours à la bière, recette du chef ». Il y a même un dessin de l'ours.",
        epreuve: { carac: 'INT', modif: 2, situation: 'cachette', echec: 'Des listes de courses, des menus, une lettre d\'amour mal orthographiée. Pas la recette. Tu peux continuer à chercher.' },
        donne: 'recette-ours',
      },
      {
        ou: 'ville:valtordu:trois-boudins',
        objectif: 'Rapporter la recette à Gros Didier.',
        action: 'Donner la recette à Gros Didier',
        recit: "Gros Didier lit la recette en remuant les lèvres, devient tout rouge, et file en cuisine. Une heure plus tard, tu manges le meilleur ours à la bière de la Terre de Fangh. Et tu es payé.",
        reprend: 'recette-ours',
      },
    ],
    recompense: { or: 400, xp: 25, texte: '400 PO' },
    niveau: 1,
  },
  {
    id: 'ddn-cdd',
    titre: 'Des preuves pour la C.D.D.',
    donneur: 'ville:waldorg:caisse',
    qui: 'Un employé de la Caisse des Donjons, qui parle très bas',
    proposition:
      "« Zangdar falsifie ses factures pour payer moins de taxes, j'en suis sûr. Il me faut le dossier de factures, dans son bureau administratif, au niveau 2. Au rez-de-chaussée, allez tout droit : l'escalier monte chez lui. Ce passe ouvre la porte de son bureau en haut des marches. Attention au golem de l'antichambre et aux maraudeurs, qui dorment en face. L'affaire ne doit pas s'ébruiter. »",
    remet: ['passe-cdd'],
    etapes: [
      {
        ou: ici('n2-5'),
        objectif: "Se rendre au bureau administratif de Zangdar (niveau 2) et trouver le dossier de factures. Il faut savoir lire, et ne pas réveiller les maraudeurs.",
        action: 'Chercher le bon classeur de factures',
        recit: "Classeur 47-B : « Factures, version pour la Caisse ». Classeur 47-C : « Factures, les vraies ». Zangdar n'est pas un génie de la fraude.",
        epreuve: { carac: 'INT', situation: 'connaissance', echec: 'Des factures de nourriture pour rats mutants. Encore. Tu peux continuer à chercher.' },
        donne: 'dossier-factures',
      },
      {
        ou: 'ville:waldorg:caisse',
        objectif: "Rapporter le dossier de factures à l'employé de la Caisse des Donjons, à Waldorg.",
        action: 'Remettre le dossier',
        recit: "L'employé feuillette, pâlit, sourit. « Parfait. Zangdar va recevoir une petite visite. » Il te remet des objets magiques saisis par la Caisse, d'une valeur de 2000 PO, puis il te demande de signer un reçu, en trois exemplaires.",
        reprend: 'dossier-factures',
      },
    ],
    recompense: { or: 0, xp: 50, objets: ['potion-de-resistance-magique', 'bague-de-lumiere-bleue', 'potion-d-invincibilite-de-gargalor', 'potion-soin-forte'], texte: 'des objets magiques de la Caisse des Donjons (valeur 2000 PO)' },
    niveau: 2,
  },
  {
    id: 'ddn-livre',
    titre: 'Un livre rare',
    donneur: 'ville:chnafon:rufus',
    qui: "Rufus d'Ombrelune, collectionneur",
    proposition:
      "« Le Bestiaire Démoniaque Interdit. Un exemplaire existe encore, dans la bibliothèque de Zangdar, au deuxième niveau de son donjon. Je le veux. Je me moque de la manière. De nuit, le donjon est calme ; de jour, il grouille. Savez-vous lire, au moins ? »",
    etapes: [
      {
        ou: ici('n2-9'),
        objectif: "Trouver le Bestiaire Démoniaque Interdit dans la bibliothèque de Zangdar (niveau 2).",
        action: 'Chercher le Bestiaire parmi les rayonnages',
        recit: "Entre « Les haltères pour les nuls » et « Mille recettes de nécromancie », un gros volume relié en cuir noir qui grogne quand on le touche. Le Bestiaire Démoniaque Interdit.",
        epreuve: { carac: 'INT', situation: 'connaissance', echec: 'Des centaines de titres en écriture tarabiscotée. Pas le bon. Tu peux continuer à chercher.' },
        donne: 'bestiaire-interdit',
      },
      {
        ou: 'ville:chnafon:rufus',
        objectif: "Rapporter le livre à Rufus d'Ombrelune, à Chnafon.",
        action: 'Remettre le Bestiaire',
        recit: "Rufus caresse la couverture, qui lui mord le doigt. Il paie en suçant son pouce.",
        reprend: 'bestiaire-interdit',
      },
    ],
    recompense: { or: 4000, xp: 60, texte: '4000 PO' },
    niveau: 3,
  },
  {
    id: 'ddn-recherche',
    titre: 'Aidez la recherche !',
    donneur: 'ville:glargh:universite',
    qui: "Le professeur Ebelard, chercheur en sortilèges de protection",
    proposition:
      "« Zangdar m'a envoyé bouler ! Moi ! Je lui demandais simplement ses notes sur les sortilèges de protection. Elles sont dans son laboratoire secret, au deuxième niveau, dont l'entrée est cachée quelque part dans son laboratoire. Rapportez-les-moi, et ce sera pour la science. Et pour ma revanche. »",
    etapes: [
      {
        ou: ici('n2-11'),
        objectif: "Trouver l'entrée cachée du laboratoire secret de Zangdar (dans son laboratoire, au niveau 2) et y prendre ses notes sur les sortilèges de protection.",
        action: 'Fouiller les notes du laboratoire secret',
        recit: "Un carnet couvert de schémas de sphères et d'annotations rageuses : « Protection parfaite… sauf contre la musique ?! À corriger. » Tu le glisses dans ton sac.",
        epreuve: { carac: 'INT', modif: -2, situation: 'connaissance', echec: "Des formules incompréhensibles et des taches de potion. Il faut chercher encore." },
        donne: 'notes-protection',
      },
      {
        ou: 'ville:glargh:universite',
        objectif: "Rapporter les notes au professeur Ebelard, à l'Université de Magie de Glargh.",
        action: 'Remettre les notes',
        recit: "Le professeur lit, rit, pleure, et court annoncer à tout le département que Zangdar est un amateur. Il te paie au nom de la science.",
        reprend: 'notes-protection',
      },
    ],
    recompense: { or: 4000, xp: 70, texte: '4000 PO' },
    niveau: 4,
  },
  {
    id: 'ddn-robinet',
    titre: 'Le robinet miraculeux',
    donneur: 'ville:chnafon:kraken',
    qui: 'Un noble de Chnafon, désespéré, au comptoir du Kraken Velu',
    proposition:
      "« Ma femme veut pour son anniversaire le Robinet Miraculeux, qui donne de l'eau tiède à toute heure. Un marchand l'a vendu à Reivax, le sbire de Zangdar, qui collectionne les robinets. Sa chambre est au troisième niveau du Donjon de Naheulbeuk ; on y monte par la taverne. Voici une gravure du robinet. L'anniversaire approche : faites vite, par pitié. »",
    remet: ['gravure-robinet'],
    etapes: [
      {
        ou: ici('n3-17'),
        objectif: "Trouver le Robinet Miraculeux dans la collection de Reivax, dans sa chambre au niveau 3 (par la taverne et ses escaliers).",
        action: 'Comparer les robinets avec la gravure',
        recit: "Quarante-trois robinets alignés. Le trente-septième a exactement le bec de la gravure, et il est tiède au toucher. Le Robinet Miraculeux !",
        epreuve: { carac: 'INT', modif: 3, echec: 'Tu prends le mauvais : celui-ci donne de l\'eau froide. Tu reposes et tu recommences.' },
        reprend: 'gravure-robinet',
        donne: 'robinet-miraculeux',
      },
      {
        ou: 'ville:chnafon:kraken',
        objectif: 'Rapporter le robinet au noble, au Kraken Velu de Chnafon.',
        action: 'Remettre le Robinet Miraculeux',
        recit: "Le noble serre le robinet contre son cœur, ouvre, sent l'eau tiède couler sur ses doigts, et pleure de joie. Son mariage est sauvé.",
        reprend: 'robinet-miraculeux',
      },
    ],
    recompense: { or: 3000, xp: 50, texte: '3000 PO' },
    niveau: 2,
  },
  {
    id: 'ddn-flute',
    titre: 'La pièce de résistance',
    donneur: 'ville:glargh:elfique',
    qui: "Une émissaire du musée de la musique elfique de Folonariel",
    proposition:
      "« Notre musée réclame une ultime pièce : une flûte en or qui aurait appartenu à un ancêtre Lahtépraiddubor. Elle est chez la liche du Donjon de Naheulbeuk, au quatrième niveau, l'étage abandonné. Un mal ancien hante cet étage : ne le réveillez pas. Attention à la grosse porte ! Le musée refuse d'envoyer des elfes : c'est un peu dangereux. »",
    etapes: [
      {
        ou: ici('n4-3'),
        objectif: "Récupérer la flûte en or chez la liche, au niveau 4 du donjon (l'étage abandonné). Attention à la grosse porte.",
        action: 'Prendre la flûte en or',
        recit: 'Tu tiens la flûte en or de Folonariel. Elle est très belle, et tu ne vas surtout pas jouer dedans.',
        auto: (p) => p.sac.includes('flute-en-or-de-folonariel'),
      },
      {
        ou: 'ville:glargh:elfique',
        objectif: "Rapporter la flûte à l'émissaire du musée, à l'Institut de beauté elfique de Glargh.",
        action: 'Remettre la flûte',
        recit: "L'émissaire joue trois notes cristallines, verse une larme, et te paie en évitant de te serrer la main.",
        reprend: 'flute-en-or-de-folonariel',
      },
    ],
    recompense: { or: 4000, xp: 80, texte: '4000 PO' },
    niveau: 4,
  },
  {
    id: 'ddn-olitric',
    titre: "L'ingrédient secret",
    donneur: 'ville:glargh:saril',
    qui: "Saril, l'alchimiste",
    proposition:
      "« Mon stock de mélange Olitric est épuisé. Un seul herboriste sait le préparer, et il est entré au service de Zangdar : son bureau est au cinquième niveau du donjon. Ce n'est pas un mauvais bougre. Montrez-lui cette lettre, achetez-lui ce qu'il faudra, et surtout ne le menacez pas. »",
    remet: ['lettre-saril'],
    etapes: [
      {
        ou: ici('n5-16'),
        objectif: "Trouver l'herboriste au niveau 5 du donjon (ouvert de 9 h à 18 h) et lui acheter du mélange Olitric. Éviter Gérard le Terrible.",
        action: 'Montrer la lettre de Saril',
        recit: "L'herboriste lit la lettre, sourit : « Ce vieux Saril ! » Il te prépare un sachet de mélange Olitric, et refuse de te le faire payer.",
        requiert: (p) => (entre(p.heure, 9, 18) ? null : "L'herboriste n'est là que de 9 h à 18 h."),
        reprend: 'lettre-saril',
        donne: 'melange-olitric',
      },
      {
        ou: 'ville:glargh:saril',
        objectif: 'Rapporter le mélange Olitric à Saril, à Glargh.',
        action: 'Remettre le mélange',
        recit: "Saril renifle le sachet, éternue, et se déclare satisfait. Il te paie et retourne à ses cornues.",
        reprend: 'melange-olitric',
      },
    ],
    recompense: { or: 2000, xp: 50, texte: '2000 PO' },
    niveau: 3,
  },
  {
    id: 'ddn-gilderoy',
    titre: 'Le fils indigne',
    donneur: 'ville:tulamor:trois-rubis',
    qui: 'Le joaillier des Trois Rubis, un riche marchand qui a perdu son fils',
    proposition:
      "« Mon fils Gilderoy est parti à l'aventure avec des amis. Un rescapé est revenu : Gilderoy croupit dans les geôles du Donjon de Naheulbeuk, au niveau 5. On y monte par l'escalier de la grande salle de la taverne, si on ne se fait pas pincer par les gardes. Ramenez-le-moi. Il est agaçant, je sais. »",
    etapes: [
      {
        ou: ici('n5-3'),
        objectif: 'Trouver Gilderoy dans les cachots du niveau 5 et ouvrir sa cellule (avec les clés des geôliers, ou en crochetant).',
        action: 'Ouvrir la cellule de Gilderoy',
        recit: "La porte s'ouvre. Gilderoy, en caleçon, se lève : « Enfin ! Vous en avez mis, du temps. Et mes affaires ? Je ne rentre pas à poil. » Il te suit en râlant.",
        epreuve: { carac: 'AD', modif: -3, situation: 'serrure', echec: 'La serrure de la cellule résiste. Gilderoy soupire très fort.' },
        dispense: (p) => p.sac.includes('trousseau-geolier'),
        donne: 'gilderoy',
      },
      {
        ou: 'ville:tulamor:trois-rubis',
        objectif: 'Ramener Gilderoy à son père, aux Trois Rubis de Tulamor.',
        action: 'Rendre Gilderoy à son père',
        recit: "Le joaillier serre son fils dans ses bras ; le fils se plaint qu'on le serre trop fort. Le père te paie, puis te glisse : « S'il repart à l'aventure, ne venez pas me le ramener. »",
        reprend: 'gilderoy',
      },
    ],
    recompense: { or: 2000, xp: 40, texte: '2000 PO' },
    niveau: 2,
  },
  {
    id: 'ddn-dirigeable',
    titre: 'Les plans du dirigeable',
    donneur: 'ville:chnafon:caserne',
    qui: 'Le capitaine de la milice de Chnafon',
    proposition:
      "« Une baudruche hideuse bombarde la ville, toujours hors de portée de nos archers. Des gardes de Valtordu l'ont vue se poser au sommet du Donjon de Naheulbeuk. Un engin de guerre gobelin ! La Caisse des Donjons nous interdit d'y envoyer la milice : c'est un donjon répertorié, seuls des aventuriers peuvent y entrer. Volez les plans de l'engin. Il faut savoir lire, et comprendre ce qu'on lit. »",
    etapes: [
      {
        ou: ici('n6-2'),
        objectif: "Monter au sommet du donjon (niveau 6), dans le hangar des ingénieurs gobelins, et dérober les plans du dirigeable.",
        action: 'Trouver et comprendre les plans du dirigeable',
        recit: "Sous un deltaplane cassé, un rouleau de parchemin couvert de schémas : « Baudruche de guerre, modèle Krakoreille III ». Tu comprends même à quoi sert la grosse manivelle.",
        epreuve: { carac: 'INT', modif: -1, situation: 'connaissance', echec: 'Des schémas de tronçonneuse à gnôle. Pas les bons. Il faut chercher encore.' },
        donne: 'plans-dirigeable',
      },
      {
        ou: 'ville:chnafon:caserne',
        objectif: 'Rapporter les plans à la caserne de Chnafon.',
        action: 'Remettre les plans',
        recit: "Le capitaine étale les plans, appelle trois ingénieurs, et jure que la baudruche ne bombardera plus jamais Chnafon. Il te paie sur le budget des catapultes.",
        reprend: 'plans-dirigeable',
      },
    ],
    recompense: { or: 2000, xp: 60, texte: '2000 PO' },
    niveau: 3,
  },
];
