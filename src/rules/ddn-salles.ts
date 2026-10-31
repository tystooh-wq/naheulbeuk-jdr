import { lancer, type Rng } from './des';
import { ea, eaMax } from './magie';
import { lancerExpression, noter, passerTemps, valeursCombat, type Partie } from './partie';
import { aMarque, malConduire, type Choix, type Evenement, type Resultat } from './evenements';
import { aTalent } from './talents';
import type { CaracQuete } from './epreuves';
import type { Situation } from './talents';
import type { Contenu, Donjon, Salle, Variante } from './donjons';
import {
  combat,
  E,
  hautFait,
  ID_DDN,
  instruments,
  INSTRUMENTS_ZANGDAR,
  M,
  malus,
  marquer,
  reussit,
  seLaver,
  touche,
  valeur,
  xp,
} from './ddn';

// Les salles du Donjon de Naheulbeuk, niveau par niveau, d'après le manuel du MJ et les plans officiels
// (positions en % de l'image du plan). Les numéros entre parenthèses sont ceux des plans.
// Ce que le manuel laisse au MJ (nombre d'ennemis, contenu des coffres, énigme de chaque porte) est
// choisi ici : les coffres piochent dans le catalogue officiel, les énigmes dans le document « Énigmes ».

// --- Outils -----------------------------------------------------------------------------------------

const sc = (id: string, titre: string, texte: string, choix: Choix[]): Evenement => ({ id: `ddn-${id}`, titre, texte, suiteSeule: true, choix });

const jet = (pour: string, carac: CaracQuete, modif = 0, situation?: Situation): Choix['jet'] => ({ faces: 20, pour, valeur: (p) => valeur(p, carac, modif, situation) });

/** Recule dans la salle d'où l'on vient. */
const reculer = (p: Partie) => {
  const e = p.donjon!;
  if (!e.precedente) return;
  const v = e.precedente;
  e.precedente = e.salle;
  e.salle = v;
};

/** Des coups qui passent l'armure (arbalètes, golem…). */
const blesser = (p: Partie, expr: string, rng?: Rng, armure = true) => {
  const j = lancerExpression(expr, rng);
  const perte = Math.max(0, j.total - (armure ? valeursCombat(p).pr : 0));
  p.ev -= perte;
  return perte;
};

/** Une volée de projectiles : chaque D6 de 1 à 3 touche. */
const volee = (p: Partie, n: number, degats: string, rng?: Rng) => {
  let total = 0;
  let touches = 0;
  for (let i = 0; i < n; i++)
    if (touche(rng)) {
      touches++;
      total += blesser(p, degats, rng);
    }
  return { touches, total };
};

const recul = (texte: string): Resultat => ({ texte, regle: false });

const avecCorde = (n: number) => (p: Partie) =>
  p.sac.filter((x) => x === 'corde').length >= n ? null : `Il faudrait ${n} cordes de 10 m nouées bout à bout (tu en as ${p.sac.filter((x) => x === 'corde').length}).`;

/** Combat ordinaire de la salle. */
const bagarre = (texte: string, ennemis: ReturnType<typeof E>[], o: Partial<Extract<Contenu, { type: 'combat' }>> = {}): Contenu => ({ type: 'combat', texte, ennemis, pensants: true, ...o });

const piege = (carac: CaracQuete, modif: number, degats: string, texte: string, evite: string, subit: string, suite?: (p: Partie) => string): Contenu => ({
  type: 'piege',
  carac,
  modif,
  degats,
  texte,
  evite,
  subit,
  suite,
});

const pas = (marque: string) => (p: Partie) => !aMarque(p, marque);

/** Heures d'ouverture de la taverne : le midi, le soir et une partie de la nuit. */
const TAVERNE_OUVERTE: [number, number][] = [
  [11, 14],
  [18, 26],
];
const HEURES_OUVRABLES: [number, number][] = [[9, 18]];

const RUMEURS = [
  "« Le Golbargh, au 4e, il est coincé là-haut depuis trente ans. Zangdar l'a maudit : il ne peut plus prendre un escalier. Autant te dire qu'il l'aime pas, Zangdar. »",
  "« Zangdar a une sphère d'invincibilité parfaite. Rien ne passe au travers. Rien. Enfin, c'est ce qu'il dit. »",
  "« Gérard, le bourreau du 5e, il boit le soir. Après la cinquième chope, il raconte sa vie à n'importe qui. Même aux prisonniers. »",
  "« La liche de l'étage abandonné se balade la nuit dans les couloirs. En babouches. Le jour, elle lit chez elle. »",
  "« Le magasin de la cave ouvre de 9 h à 18 h. La vendeuse est gentille, les vigiles beaucoup moins. »",
  "« Reivax, le sous-fifre ? Il plie à la moindre menace. Il sait tout sur le donjon, c'est lui qui fait les plannings. »",
  "« Y a un troll enchaîné dans les souterrains. Il cause bien, pour un troll. Il aime qu'on lui apporte à manger. »",
  "« L'ours à la bière, la recette, le chef la garde chez lui, au fond du couloir. Ça vaut de l'or, ce papier. »",
  "« Le chef des orques du rez-de-chaussée a la clé de la cave. Il la garde dans son slip, paraît-il. »",
  "« L'escalier du rez-de-chaussée qui monte tout droit ? Il mène chez Zangdar. Personne ne le prend : les aventuriers ne vont jamais tout droit. »",
  "« Les gobelins du 3e font du patin sur une salle gelée. On les entend crier « youpiiee » jusqu'ici. »",
  "« Au 6e, les ingénieurs gobelins ont un dirigeable. Il a bombardé Chnafon la semaine dernière, à ce qu'on dit. »",
];

// --- Les grands rôles : Zangdar, Reivax, Gérard ----------------------------------------------------

const zangdarVaincu = (p: Partie) => {
  marquer(p, 'ddn:zangdar-vaincu');
  noter(p, 'vient à bout de Zangdar !');
  return "Zangdar s'effondre en se tenant les oreilles, puis, dans un dernier sursaut, file par une porte dérobée en jurant qu'on le reverra. Le donjon n'a plus de maître, au moins pour un moment. Il a laissé tomber son trousseau de clés.";
};

const sceneZangdar = (ou: 'bureau' | 'lecture' | 'pyjama'): Evenement =>
  sc(
    `zangdar-${ou}`,
    'Zangdar',
    {
      bureau:
        "Derrière un grand bureau couvert de parchemins, un sorcier vêtu de noir lève les yeux et prend une grosse voix : « Des aventuriers ? Dans MON bureau ? » Une bulle irisée l'entoure aussitôt : sa sphère d'invincibilité parfaite.",
      lecture:
        "Zangdar est plongé dans un grimoire, près d'une rangée d'haltères. Il sursaute, referme le livre en catastrophe et s'entoure d'une bulle irisée : « On ne frappe plus, chez les aventuriers ? »",
      pyjama:
        "Dans le grand lit, sous une couette brodée de pentacles, Zangdar dort en pyjama ridicule. Des chaussons panda attendent au pied du lit. Il ouvre un œil, puis deux : « Hein ? QUOI ? » La bulle irisée de sa sphère s'allume au-dessus de la couette.",
    }[ou],
    [
      {
        libelle: `Jouer très faux de tes instruments (il en faut ${INSTRUMENTS_ZANGDAR})`,
        possible: (p) => (instruments(p) >= INSTRUMENTS_ZANGDAR ? null : `Il te faut ${INSTRUMENTS_ZANGDAR} instruments dans ton sac (tu en as ${instruments(p)}).`),
        effet: (p) => ({
          texte: `Tu sors tes ${instruments(p)} instruments et tu joues, très fort et très faux, la pire cacophonie de l'histoire de la Terre de Fangh. Zangdar se bouche les oreilles, devient tout rouge, perd sa concentration… La sphère vacille et s'éteint ! Fou de rage, il empoigne son bâton.`,
          combat: {
            rencontre: combat(p, [E(M.zangdar)]),
            victoire: (q) => {
              q.sac.push('trousseau-zangdar');
              return zangdarVaincu(q);
            },
          },
        }),
      },
      {
        libelle: "L'attaquer quand même",
        effet: (p, rng) => {
          const perte = blesser(p, '2D+2', rng, false);
          return {
            texte: `Ton coup rebondit sur la bulle irisée comme sur un mur de caoutchouc. Zangdar ricane et te renvoie une décharge d'énergie astrale (−${perte} PV). « GARDES ! » Un maraudeur déboule.`,
            combat: { rencontre: combat(p, [E(M.maraudeur, 1, 1)]) },
            regle: false,
          };
        },
      },
      {
        libelle: 'Parlementer',
        jet: jet('le convaincre de te laisser filer', 'CHA', -2, 'negocier'),
        effet: (p, rng) => {
          if (reussit(p, 'CHA', -2, rng, 'negocier')) {
            reculer(p);
            return recul("Zangdar t'écoute, bâille, regarde l'heure. « Bon. Dehors, et essuyez vos pieds la prochaine fois. » D'un geste, il t'expédie dans la pièce d'à côté.");
          }
          const perte = blesser(p, '2D', rng, false);
          reculer(p);
          return recul(`« Assez ! » Une boule de feu de niveau 1 te roussit les sourcils (−${perte} PV). Tu te retrouves dans la pièce d'à côté sans savoir comment.`);
        },
      },
      { libelle: 'Battre en retraite', effet: (p) => (reculer(p), recul('Tu recules sans le quitter des yeux. Zangdar hausse les épaules et retourne à ses affaires.')) },
    ],
  );

/** Zangdar n'est là qu'à certaines heures, et plus du tout une fois vaincu. */
const zangdar = (quand: [number, number][], ou: 'bureau' | 'lecture' | 'pyjama', description: string): Variante => ({
  quand,
  si: pas('ddn:zangdar-vaincu'),
  contenu: { type: 'scene', scene: sceneZangdar(ou), bloque: true, permanente: true },
  description,
});

const bavardReivax = (p: Partie) => {
  marquer(p, 'ddn:faiblesse', 'ddn:indice-7', 'ddn:indice-8', 'ddn:levier');
  if (!p.sac.includes('cle-reivax')) p.sac.push('cle-reivax');
};

const sceneReivax = sc(
  'reivax',
  'Reivax',
  "Un petit homme voûté, au nez pointu, range des factures en marmonnant. Reivax, l'assistant de Zangdar. Il vous voit, pâlit, et regarde déjà la porte.",
  [
    {
      libelle: 'Le menacer (il ne supporte pas la douleur)',
      jet: jet("l'intimider", 'CHA', 3, 'negocier'),
      effet: (p, rng) => {
        if (!reussit(p, 'CHA', 3, rng, 'negocier')) return { texte: 'Reivax pousse un cri suraigu et file par la porte de derrière. Il est déjà loin, et il a emporté sa clé.' };
        bavardReivax(p);
        return {
          texte:
            "Reivax se met à genoux avant même que tu lèves la main. « Pitié ! Je dirai tout ! » Il déballe : Zangdar ne supporte pas la musique mal jouée, il faut au moins quatre instruments pour percer sa sphère. Les énigmes du 3e ? « Chaussette » et « un homme qui suit un cercueil ». Les chompeurs ? Un levier près du sol, dans le couloir. Il te donne sa clé pour que tu le laisses partir.",
        };
      },
    },
    {
      libelle: 'Lui proposer de changer de camp',
      jet: jet('le retourner', 'CHA', -2, 'negocier'),
      effet: (p, rng) => {
        if (!reussit(p, 'CHA', -2, rng, 'negocier')) return recul("Reivax fait semblant d'y réfléchir, puis appelle la garde dès que tu as le dos tourné. Tu files avant qu'elle n'arrive.");
        bavardReivax(p);
        marquer(p, 'ddn:reivax-allie');
        const h = hautFait(p, 'sbire');
        return {
          texte: `Reivax se frotte les mains. « Vous gagnez, je suis avec vous. Je suis toujours avec le gagnant. » Il te confie sa clé, le point faible de Zangdar (la musique mal jouée, quatre instruments au moins), les réponses des énigmes du 3e et le levier des chompeurs.${h ? ` ${h}.` : ''}`,
        };
      },
    },
    {
      libelle: "L'attaquer",
      effet: (p) => ({
        texte: 'Reivax couine et sort une dague.',
        combat: {
          rencontre: combat(p, [E(M.reivax)]),
          victoire: (q) => {
            marquer(q, 'ddn:reivax-vaincu');
            if (!q.sac.includes('cle-reivax')) q.sac.push('cle-reivax');
            return 'Reivax se rend en pleurnichant et te tend sa clé. Il disparaît dès que tu as le dos tourné.';
          },
        },
      }),
    },
    { libelle: 'Le laisser tranquille', effet: (p) => (reculer(p), recul('Tu refermes la porte. Reivax soupire de soulagement, puis se précipite pour prévenir quelqu\'un.')) },
  ],
);

const sceneGerardIvre = sc(
  'gerard-ivre',
  'Gérard le Terrible, pinté',
  "Gérard le Terrible, le bourreau, est affalé près de sa cheminée, une bouteille dans chaque main. Il lève vers toi des yeux rouges et mouillés : « T'es qui, toi ? T'es venu te moquer, comme les autres ? »",
  [
    {
      libelle: "Trinquer avec lui et l'écouter",
      jet: jet('gagner sa confiance', 'CHA', 2, 'negocier'),
      effet: (p, rng) => {
        if (!reussit(p, 'CHA', 2, rng, 'negocier'))
          return {
            texte: "« Toi aussi tu te fiches de moi ! » Gérard se lève en titubant et attrape sa hache.",
            combat: { rencontre: combat(p, [E(M.gerardIvre)]), victoire: (q) => (marquer(q, 'ddn:gerard-vaincu'), "Gérard s'écroule en ronflant au milieu des bouteilles. Il ne fera plus peur à personne avant longtemps.") },
            regle: false,
          };
        marquer(p, 'ddn:faiblesse', 'ddn:ami-gerard');
        passerTemps(p, 1);
        return {
          texte:
            "Une heure plus tard, Gérard pleure sur ton épaule. Personne ne l'aime, son métier le dégoûte, il voulait être fleuriste. Puis il baisse la voix : « Zangdar, hein… il supporte pas la musique mal jouée. Sa sphère, elle tient pas quand on lui joue faux. Au moins quatre instruments, qu'il faut. C'est Reivax qui me l'a dit. Chut. » Tu as un ami au niveau 5.",
          regle: false,
        };
      },
    },
    {
      libelle: "L'assommer pendant qu'il cuve",
      effet: (p) => ({
        texte: 'Gérard grogne et se lève, hache en main. Il voit double, mais il tape fort.',
        combat: { rencontre: combat(p, [E(M.gerardIvre)]), victoire: (q) => (marquer(q, 'ddn:gerard-vaincu'), 'Gérard s\'écroule au milieu des bouteilles.') },
        regle: false,
      }),
    },
    { libelle: 'Le laisser pleurer', effet: (p) => (reculer(p), recul('Tu refermes doucement la porte. Derrière, Gérard chante une chanson triste.')) },
  ],
);

const gerardSobre = (texte: string): Contenu => ({ type: 'combat', texte, ennemis: [E(M.gerard)], pensants: true, unique: true, marque: 'ddn:gerard-vaincu' });

// --- Les gens et les bêtes des salles -----------------------------------------------------------

const sceneLimon = sc(
  'limon',
  'Le limon maléfique et glaireux',
  "Une mare verte et luisante glisse sur les dalles vers toi, en dissolvant tout ce qu'elle touche. Le limon maléfique et glaireux. Les armes ne lui font rien : il se reforme aussitôt. Il craint le feu, la glace et l'énergie.",
  [
    {
      libelle: "Répandre de l'huile et y mettre le feu",
      possible: (p) => (['flacon-d-huile', 'lampe', 'lampe-a-huile'].some((x) => p.sac.includes(x)) ? null : "Il faut un flacon d'huile ou une lampe à huile."),
      effet: (p) => {
        const id = ['flacon-d-huile', 'lampe', 'lampe-a-huile'].find((x) => p.sac.includes(x))!;
        p.sac.splice(p.sac.indexOf(id), 1);
        xp(p, 20);
        return { texte: "Tu répands l'huile entre le limon et toi, tu craques ton briquet. Le limon avance, s'embrase, siffle, bouillonne et finit en croûte noire qui sent le vieux fromage. (+20 XP)" };
      },
    },
    {
      libelle: 'Lui lancer un sort de feu ou d\'énergie (6 PA)',
      visible: (p) => eaMax(p) > 0,
      possible: (p) => (ea(p) >= 6 ? null : "Pas assez d'énergie astrale (6 PA)."),
      effet: (p) => {
        p.ea = ea(p) - 6;
        xp(p, 20);
        return { texte: 'Ton sort frappe le limon de plein fouet. Il se tortille, sèche, craquelle et tombe en poussière verte. (+20 XP)' };
      },
    },
    {
      libelle: 'Le frapper avec ton arme',
      effet: (p, rng) => {
        const perte = blesser(p, '1D', rng, false);
        return recul(`Ta lame traverse le limon sans résistance et ressort fumante. Le pseudopode, lui, te brûle le bras (−${perte} PV). Il faut autre chose.`);
      },
    },
    {
      libelle: 'Passer en rasant les murs',
      jet: jet('te faufiler', 'AD', -2),
      effet: (p, rng) => {
        if (reussit(p, 'AD', -2, rng)) return { texte: 'Tu te plaques au mur et tu files. Le limon, lent, te perd de vue et retourne mijoter dans son coin.' };
        const perte = blesser(p, '1D', rng, false);
        return recul(`Le limon te rattrape par la botte : ça brûle (−${perte} PV). Tu recules d'un bond.`);
      },
    },
    { libelle: 'Reculer', effet: (p) => (reculer(p), recul('Tu laisses le limon à ses glaires.')) },
  ],
);

const sceneAssistant = sc(
  'assistant',
  'Un assistant sorcier',
  "Au milieu du grand pentacle, un assistant sorcier en robe tachée prépare une honteuse manipulation magique, entouré de bougies noires. Il sursaute en te voyant.",
  [
    {
      libelle: "L'interroger",
      jet: jet('lui faire avouer des trucs', 'CHA', 0, 'negocier'),
      effet: (p, rng) => {
        if (!reussit(p, 'CHA', 0, rng, 'negocier'))
          return { texte: 'L\'assistant pointe sa dague vers toi en marmonnant une incantation ratée.', combat: { rencontre: combat(p, [E(M.assistant)]), victoire: (q) => (q.sac.push('potion-soin'), 'Sur lui : une potion de soin.') } };
        marquer(p, 'ddn:indice-1');
        p.sac.push('potion-soin');
        return {
          texte:
            "Il avoue tout, et même un peu plus : le limon de l'autre côté du mur ne craint que le feu, l'écriteau du couloir de droite attend un gros mot (« Merde », tout simplement), et le chef des orques garde la clé de la cave. Il te donne une potion pour que tu l'oublies.",
        };
      },
    },
    { libelle: "L'attaquer", effet: (p) => ({ texte: "L'assistant lâche ses bougies et sort une dague.", combat: { rencontre: combat(p, [E(M.assistant)]), victoire: (q) => (q.sac.push('potion-soin'), 'Sur lui : une potion de soin.') } }) },
    { libelle: 'Le laisser à ses bougies', effet: () => recul("L'assistant hausse les épaules et reprend ses incantations.") },
  ],
);

const sceneKobolds = sc(
  'kobolds',
  'Les kobolds farceurs',
  "Trois petits lutins tordus, plus petits que des gobelins, t'accueillent en ricanant : « Tu connais celle du nain qui rentre dans une taverne ? Viens, viens au fond, on te la raconte ! » Ils gesticulent en te poussant vers le fond de la salle.",
  [
    {
      libelle: 'Les suivre au fond de la salle',
      effet: (p, rng) => {
        const v = volee(p, 3, '1D+4', rng);
        return {
          texte: `Clac ! La dalle s'enfonce sous ton pied et trois carreaux d'arbalète jaillissent du mur${v.touches ? ` : ${v.touches} te touche${v.touches > 1 ? 'nt' : ''} (−${v.total} PV)` : ', et te ratent de peu'}. Les kobolds se tordent de rire… puis sortent leurs dagues.`,
          combat: { rencontre: combat(p, [E(M.kobold, 2)]) },
        };
      },
    },
    {
      libelle: 'Rire à leurs blagues',
      jet: jet('être bon public', 'CHA', 0, 'negocier'),
      effet: (p, rng) =>
        reussit(p, 'CHA', 0, rng, 'negocier')
          ? { texte: "Tu ris aux éclats, même à celle du nain. Les kobolds, ravis d'avoir enfin un public, te font une révérence et s'en vont raconter leurs blagues ailleurs." }
          : { texte: "Ton rire sonne faux. « Il se moque de nous ! » Les kobolds sortent leurs dagues.", combat: { rencontre: combat(p, [E(M.kobold, 2)]) } },
    },
    { libelle: 'Les attaquer', effet: (p) => ({ texte: 'Les kobolds esquivent en ricanant, puis se décident à combattre.', combat: { rencontre: combat(p, [E(M.kobold, 2)]) } }) },
    { libelle: 'Reculer', effet: (p) => (reculer(p), recul('« Rabat-joie ! » crient les kobolds.')) },
  ],
);

const scenePredicateur = sc(
  'predicateur',
  'Le prédicateur hystérique',
  "Au bord d'un grand puits sombre, un vieil homme sale en haillons se lève d'un bond : « Les âmes ! Les âmes damnées ! Elles souffrent ! Priez avec moi, mes frères, et donnez pour mes bonnes œuvres, que les âmes trouvent le repos ! »",
  [
    {
      libelle: 'Écouter son sermon sans te laisser embobiner',
      jet: jet('garder la tête froide', 'INT'),
      effet: (p, rng) => {
        if (reussit(p, 'INT', 0, rng))
          return {
            texte: "Tu ne te laisses pas avoir. Le prédicateur, vexé, attrape son vieux bâton : « Mécréant ! »",
            combat: { rencontre: combat(p, [E(M.predicateur)]) },
          };
        const don = Math.min(5, p.or);
        p.or -= don;
        return { texte: `Sans trop savoir comment, tu lui donnes ${don} PO pour ses bonnes œuvres. Il te bénit avec effusion et retourne marmonner près du puits.` };
      },
    },
    {
      libelle: 'Prier avec lui',
      effet: (p) => {
        passerTemps(p, 1);
        return { texte: "Une heure de prières pour les âmes damnées. Tes genoux s'en souviendront. Le prédicateur, comblé, te laisse tranquille." };
      },
    },
    { libelle: "L'occire sans discuter", effet: (p) => ({ texte: 'Le vieil homme brandit son bâton en hurlant.', combat: { rencontre: combat(p, [E(M.predicateur)]) } }) },
  ],
);

const sceneTroll = sc(
  'troll',
  'Le troll enchaîné',
  "Une énorme masse grise, enchaînée au mur par des maillons gros comme des têtes de nain, lève vers toi un regard étonnamment intelligent. « Bonjour. Vous n'auriez pas quelque chose à manger, par hasard ? La conversation est meilleure le ventre plein. »",
  [
    {
      libelle: 'Lui donner une ration et lui poser des questions',
      possible: (p) => (p.sac.includes('rations') ? null : 'Il faut une ration de voyage.'),
      effet: (p) => {
        p.sac.splice(p.sac.indexOf('rations'), 1);
        marquer(p, 'ddn:indice-5', 'ddn:ami-troll');
        return {
          texte:
            "Le troll mâche avec délicatesse. « Merci. Alors : ne marchez pas sur les dalles orange chez les mouches, au sud-ouest. Dans le bourbier, tenez-vous au bord. La harpie est défoncée en permanence, battez-vous loin de sa fumée. Chez les gobelins aveugles, il faut une lampe : le vent éteint les torches. Et l'écriteau près du long couloir ? Une maison dont les quatre façades sont au sud : elle est au pôle Nord, voyons. »",
          regle: false,
        };
      },
    },
    {
      libelle: 'Lui parler de tout et de rien',
      effet: () => recul("Le troll cite trois philosophes elfes et se plaint de ses chaînes. Il ajoute qu'il serait plus bavard avec quelque chose dans l'estomac."),
    },
    {
      libelle: "L'attaquer",
      effet: (p) => ({
        texte: 'Le troll soupire : « Vraiment ? » et se lève, massue en main.',
        combat: {
          rencontre: combat(p, [E(M.troll)], false),
          victoire: (q) => {
            marquer(q, 'ddn:troll-mort');
            malConduire(q, 'ddn:troll-tue');
            q.or += 120;
            return 'Le troll s\'effondre dans un fracas de chaînes. Sous sa paillasse : 120 PO. Tu as tué un prisonnier enchaîné qui ne demandait qu\'à manger.';
          },
        },
        regle: false,
      }),
    },
  ],
);

const sceneChamane = sc(
  'chamane',
  'Le chamane lubrique',
  "La salle est éclairée par un feu. Un homme vêtu de plumes et de colliers de coquillages agite des sachets d'herbes et des bâtons bizarres. Le chamane lubrique. Il n'a pas l'air agressif, juste très enthousiaste.",
  [
    {
      libelle: 'Danser nue autour du feu pour la faveur des dieux',
      visible: (p) => p.perso.sexe === 'Femme',
      effet: (p, rng) => {
        const d = lancer(6, rng);
        if (d === 6) {
          malus(p, 'Faveur des dieux du chamane', { CHA: 1 });
          return { texte: `Le chamane hurle des incantations pendant que tu danses. D6 : ${d} ! Les dieux, amusés, t'accordent leur faveur : +1 CHA, pour toujours.` };
        }
        return { texte: `D6 : ${d}. Les dieux regardent ailleurs. Tu as juste dansé nue autour d'un feu devant un type en plumes. Ça restera entre vous.` };
      },
    },
    { libelle: 'Discuter avec lui', effet: () => recul("Le chamane te parle des esprits de la terre, des énergies du feu, et des « danses sacrées ». Il insiste beaucoup sur les danses sacrées.") },
    { libelle: "L'attaquer", effet: (p) => ({ texte: 'Le chamane se défend avec son bâton, sans grande conviction.', combat: { rencontre: combat(p, [E(M.chamane)]) } }) },
  ],
);

const sceneAveugles = sc(
  'aveugles',
  'Les gobelins aveugles',
  "Un courant d'air violent traverse la grotte. Ta torche vacille… et s'éteint. Dans le noir complet, tu entends des petits rires et des pieds nus sur la pierre. Les gobelins aveugles, eux, sont chez eux dans la pénombre.",
  [
    {
      libelle: 'Allumer ta lampe à huile',
      possible: (p) => (['lampe', 'lampe-a-huile'].some((x) => p.sac.includes(x)) ? null : 'Il faut une lampe à huile (le vent éteint les torches).'),
      effet: (p) => ({ texte: 'La flamme de ta lampe tient bon dans le courant d\'air. Les gobelins aveugles, éblouis, attaquent au jugé.', combat: { rencontre: combat(p, [E(M.gobelinAveugle, 2, 1)]) } }),
    },
    { libelle: 'Te battre dans le noir', effet: (p) => ({ texte: 'Tu frappes au hasard. Eux ne frappent pas au hasard.', combat: { rencontre: combat(p, [E(M.gobelinAveugleNoir, 2, 1)]) } }) },
    { libelle: 'Reculer', effet: (p) => (reculer(p), recul('Tu recules à tâtons vers le couloir.')) },
  ],
);

const chompeurs = (n: number): Evenement =>
  sc(
    `chompeurs-${n}`,
    `Les chompeurs (bloc ${n} sur 3)`,
    n === 1 ? 'Tu as compris la séquence. Premier bloc : il remonte… maintenant !' : n === 2 ? 'Un bloc derrière toi s\'écrase dans un nuage de poussière. Le suivant !' : 'Le dernier bloc. Tu vois la sortie.',
    [
      {
        libelle: 'Courir',
        jet: jet('passer sous le bloc', 'AD'),
        effet: (p, rng) => {
          if (!reussit(p, 'AD', 0, rng)) {
            p.ev = 0;
            return { texte: 'Un quart de seconde trop tard. Le bloc de pierre s\'abat sur toi.', regle: false };
          }
          if (n < 3) return { texte: 'Tu passes !', suite: chompeurs(n + 1) };
          const h = hautFait(p, 'timing');
          return { texte: `Tu roules de l'autre côté du couloir, couvert de poussière et vivant.${h ? ` ${h}.` : ''}` };
        },
      },
    ],
  );

const sceneChompeurs = sc(
  'chompeurs',
  'Les chompeurs',
  "Un couloir dont le plafond est fait de gros blocs de pierre qui tombent et remontent à intervalles réguliers, dès qu'on pose un pied à l'entrée. Il faut être fou pour essayer de traverser, d'autant qu'il existe un autre passage un peu plus loin.",
  [
    {
      libelle: 'Chercher un mécanisme pour les arrêter',
      jet: jet('repérer le mécanisme', 'INT', 0, 'cachette'),
      effet: (p, rng) => {
        passerTemps(p, 1 / 6);
        if (aMarque(p, 'ddn:levier') || reussit(p, 'INT', 0, rng, 'cachette')) return { texte: 'Près du sol, dans le couloir qui descend, un petit levier dissimulé. Clonk. Les blocs s\'immobilisent.' };
        return recul('Tu ne trouves rien, et les blocs continuent de tomber avec un bruit d\'enfer.');
      },
    },
    {
      libelle: 'Observer la séquence, puis traverser',
      jet: jet('comprendre la séquence', 'INT'),
      effet: (p, rng) => (reussit(p, 'INT', 0, rng) ? { texte: 'Un, deux, trois, quatre… Tu as compris le rythme.', suite: chompeurs(1) } : recul("Tu comptes, tu recomptes, tu ne comprends rien. Mieux vaut ne pas tenter le coup.")),
    },
    { libelle: 'Faire demi-tour', effet: (p) => (reculer(p), recul('Sage décision.')) },
  ],
);

const sceneGolem = sc(
  'golem',
  'Le golem de fer',
  "Au milieu de l'antichambre vide, un golem de fer de deux mètres tourne la tête vers toi dans un grincement. « Moi vois… moi tue. » Il n'a qu'un œil valide. Au fond de la salle, une trappe : l'oubliette.",
  [
    {
      libelle: 'Tirer une flèche dans son œil valide',
      visible: (p) => !!p.equipe.distance,
      jet: jet('viser l\'œil', 'AD', -4),
      effet: (p, rng) => {
        if (reussit(p, 'AD', -4, rng)) {
          xp(p, 50);
          const h = hautFait(p, 'elite');
          return { texte: `En plein dans l'œil ! Aveugle, le golem avance au hasard, bras tendus… et bascule dans l'oubliette avec un bruit de casserole géante. (+50 XP)${h ? ` ${h}.` : ''}` };
        }
        const perte = blesser(p, '2D+2', rng);
        return recul(`Ta flèche ricoche sur son front. Le golem t'envoie une baffe de fer (−${perte} PV).`);
      },
    },
    {
      libelle: "L'attirer vers l'oubliette",
      jet: jet('le faire tomber dans le piège', 'INT', -2),
      effet: (p, rng) => {
        if (reussit(p, 'INT', -2, rng)) {
          xp(p, 50);
          const h = hautFait(p, 'elite');
          return { texte: `Tu te places juste derrière la trappe. Le golem fonce, tu t'écartes au dernier moment : il plonge dans l'oubliette. (+50 XP)${h ? ` ${h}.` : ''}` };
        }
        const perte = blesser(p, '2D+2', rng);
        return recul(`Le golem s'arrête pile au bord de la trappe et te colle une baffe (−${perte} PV).`);
      },
    },
    { libelle: 'Le combattre', effet: (p) => ({ texte: 'Le golem lève ses poings de fer. Les lames lui font des chatouilles.', combat: { rencontre: combat(p, [E(M.golem)], false) } }) },
    { libelle: 'Reculer', effet: (p) => (reculer(p), recul('Le golem ne te suit pas : il garde la porte.')) },
  ],
);

const sceneGolbargh = sc(
  'golbargh',
  'Le Golbargh',
  "Au fond de l'antre, un démon immense se lève. Quatre bras, une queue pleine de piquants, une peau d'écailles rouges et bleues, et des yeux qui brillent d'une intelligence mauvaise. Le Golbargh. Il penche la tête : « Tiens. De la visite. Ça faisait longtemps. »",
  [
    {
      libelle: 'Lui parler de Zangdar',
      jet: jet('jouer sur sa haine de Zangdar', 'CHA', -2, 'negocier'),
      effet: (p, rng) => {
        if (aMarque(p, 'ddn:golbargh-ami')) return recul("« Reviens quand ce sorcier de pacotille sera mort », gronde le Golbargh. « Et joue faux. Très faux. »");
        if (reussit(p, 'CHA', -2, rng, 'negocier')) {
          marquer(p, 'ddn:golbargh-ami', 'ddn:faiblesse');
          p.sac.push('tambourin-en-yakak-a-grelots-d-argents');
          return recul(
            "Le Golbargh éclate d'un rire qui fait trembler les murs. « Zangdar ! Ce minable m'a maudit pour que je ne puisse plus prendre un escalier ! Trente ans ! » Il fouille dans un coffre et te lance un tambourin en peau de yack à grelots d'argent. « Il ne supporte pas la musique mal jouée. Joue-lui ça. Très faux. Avec d'autres. Au moins quatre instruments. »",
          );
        }
        const perte = blesser(p, '2D+4', rng);
        reculer(p);
        return recul(`Le Golbargh s'ennuie déjà. Une de ses quatre mains t'envoie valser dans le couloir (−${perte} PV).`);
      },
    },
    {
      libelle: "L'attaquer",
      effet: (p) => ({
        texte: 'Le Golbargh sourit de toutes ses dents. Il frappe et pare deux fois par assaut. Tu aurais dû écouter les rumeurs.',
        combat: { rencontre: combat(p, [E(M.golbargh)], false), victoire: (q) => (marquer(q, 'ddn:golbargh-mort'), "Le Golbargh s'effondre. Trente ans de rancune s'éteignent dans ses yeux. Son coffre est à toi.") },
        regle: false,
      }),
    },
    { libelle: 'Reculer sur la pointe des pieds', effet: (p) => (reculer(p), recul('Le Golbargh se rassoit et retourne méditer sur sa malchance.')) },
  ],
);

const scenePoulet = sc(
  'poulet',
  'Un poulet',
  "Au milieu du couloir désert, un coq maigre picore la poussière. Il te regarde de côté, d'un air nerveux.",
  [
    {
      libelle: 'Lui donner du pain',
      possible: (p) => (p.sac.includes('rations') ? null : 'Il faut une ration.'),
      effet: (p) => {
        p.sac.splice(p.sac.indexOf('rations'), 1);
        return recul('Le coq se jette sur ton pain et te suit sur trois pas, puis t\'oublie. Il reste un poulet.');
      },
    },
    {
      libelle: 'Lui parler (comprendre les animaux)',
      visible: (p) => aTalent(p, 'Comprendre les animaux'),
      effet: () => recul("Le coq t'apprend que l'étage est abandonné et qu'on n'y trouve pas facilement de graines. Ça te fait une belle jambe."),
    },
    {
      libelle: "Le tuer. Il DOIT mourir.",
      effet: (p) => ({
        texte: "Le coq gonfle ses plumes. À partir de maintenant, c'est toi ou lui.",
        combat: { rencontre: combat(p, [E(M.poulet)], false), victoire: (q) => (marquer(q, 'ddn:poulet-mort'), q.sac.push('rations'), 'Le poulet est mort. Tu as de quoi faire un repas.') },
        regle: false,
      }),
    },
  ],
);

const sceneDomestiques = (etage: string, info: string) =>
  sc(
    `domestiques-${etage}`,
    'Des domestiques',
    'Quelques domestiques se reposent entre deux services. En te voyant, ils lâchent leurs chaussettes à repriser et regardent la porte : ils vont sonner l\'alerte.',
    [
      {
        libelle: 'Les interroger en roulant des mécaniques',
        jet: jet('les impressionner', 'CHA', 2, 'negocier'),
        effet: (p, rng) => {
          if (reussit(p, 'CHA', 2, rng, 'negocier')) {
            if (etage === 'n1' && !p.sac.includes('cle-domestique')) p.sac.push('cle-domestique');
            return { texte: info };
          }
          return { texte: "Un domestique file en hurlant « Alerte ! ». Deux orques arrivent en courant.", combat: { rencontre: combat(p, [E(M.orque, 1, 1)]) } };
        },
      },
      {
        libelle: 'Les ligoter et les bâillonner',
        jet: jet('faire ça vite et bien', 'AD'),
        effet: (p, rng) =>
          reussit(p, 'AD', 0, rng)
            ? { texte: 'Les domestiques finissent ficelés comme des saucissons dans un placard. Personne ne sonnera l\'alerte.' }
            : { texte: "L'un d'eux t'échappe et court chercher la garde. Deux orques arrivent.", combat: { rencontre: combat(p, [E(M.orque, 1, 1)]) } },
      },
      { libelle: 'Les laisser tranquilles', effet: (p) => (reculer(p), recul('Tu refermes la porte. Avec un peu de chance, ils n\'ont rien vu.')) },
    ],
  );

const sceneLaver = sc('bain', 'Se laver', "Une cuvette, de l'eau tiède, un savon qui sent la violette. De quoi retrouver un peu de dignité.", [
  {
    libelle: 'Faire ses ablutions',
    effet: (p) => {
      passerTemps(p, 0.25);
      return recul(seLaver(p) ? 'Tu frottes, tu rinces, tu refrottes. Les odeurs s\'en vont, ta dignité revient.' : 'Tu te débarbouilles. Tu sentais déjà la rose, mais ça ne fait pas de mal.');
    },
  },
]);

const sceneLatrines = (texte: string) =>
  sc('latrines', 'Les latrines', texte, [
    {
      libelle: 'Y faire une pause',
      effet: (p) => {
        passerTemps(p, 1 / 12);
        malus(p, 'Odeur des latrines', { CHA: -1 }, { jours: 1 });
        return recul("Cinq minutes, c'était trop. L'odeur s'accroche à tes vêtements : CHA −1 jusqu'à demain (ou jusqu'à un bon bain).");
      },
    },
  ]);

/** Le bureau administratif et celui du bourreau : des plans d'étages sans indications précises. */
const revelerNiveaux = (p: Partie, niveaux: string[]) => {
  const e = p.donjon!;
  for (const s of SALLES) if (s.niveau && niveaux.includes(s.niveau) && !e.vues.includes(s.id)) e.vues.push(s.id);
};

// --- Niveau 0 : l'entrée ------------------------------------------------------------------------

const N0: Salle[] = [
  {
    id: 'n0-entree',
    nom: "Le hall d'entrée",
    niveau: 'n0',
    px: 52.5,
    py: 90,
    x: 0,
    y: 0,
    sortie: 'Ressortir par la grande porte',
    description:
      "Une grosse porte cloutée, quatre colonnes, et un couloir qui file tout droit vers le cœur du donjon. Ça sent la poussière, la torche et l'orque. Un aventurier attentif remarquera qu'une pierre du mur de droite est plus lisse que les autres.",
    vers: ['n0-2', 'n0-1'],
    portes: { 'n0-1': { texte: 'une étrange pierre à enfoncer, dans le mur de droite', cachee: { carac: 'INT', modif: 0 } } },
  },
  {
    id: 'n0-1',
    nom: 'La salle des zombies (1)',
    niveau: 'n0',
    px: 66,
    py: 79,
    x: 0,
    y: 0,
    description: 'Une salle froide qui sent la viande avariée. Sur le mur du fond, un renfoncement aux joints bizarres.',
    vers: ['n0-entree', 'n0-alcove'],
    contenu: bagarre('Des zombies se retournent lentement vers toi en gémissant. Ils ne frappent qu\'une fois sur deux, mais ils n\'ont peur de rien.', [E(M.zombie, 1, 1)], {
      pensants: false,
      gagne: ['cle-zombie'],
    }),
    portes: { 'n0-alcove': { texte: 'une porte cachée dans le renfoncement', cachee: { carac: 'INT', modif: -2 } } },
  },
  {
    id: 'n0-alcove',
    nom: 'Une alcôve secrète',
    niveau: 'n0',
    px: 74.5,
    py: 74,
    x: 0,
    y: 0,
    description: 'Une petite alcôve poussiéreuse avec un coffre ferré.',
    vers: ['n0-1'],
    tresor: {
      or: 35,
      objets: ['potion-soin', 'corde'],
      texte: 'Dans le coffre : quelques goodies.',
      serrure: { texte: 'un coffre fermé à clé', cle: 'cle-zombie', crochetage: 0, force: -2 },
    },
  },
  {
    id: 'n0-2',
    nom: 'La célèbre intersection (2)',
    niveau: 'n0',
    px: 52.5,
    py: 61,
    x: 0,
    y: 0,
    description:
      "La célèbre intersection, avec « plusieurs choix qui s'offrent à nous ». À droite ? En arrière ? Tout droit vers l'escalier ? Ou bien on choisit la direction de l'Elfe…",
    vers: ['n0-entree', 'n0-3', 'n0-6', 'n0-7'],
  },
  {
    id: 'n0-3',
    nom: "La dalle de l'oubliette (3)",
    niveau: 'n0',
    px: 65.5,
    py: 57.5,
    x: 0,
    y: 0,
    description: 'Un couloir vers la droite, une dalle de pierre étrange, et un trou noir carré : l\'oubliette.',
    vers: ['n0-2', 'n0-4'],
    contenu: piege('AD', 0, '1D', 'Une dalle de pierre bascule sous tes pieds : l\'oubliette ! Trois mètres de chute.', 'Tu te rattrapes au bord au dernier moment.', 'Tu tombes au fond de l\'oubliette et tu remontes comme tu peux, couvert de bleus.'),
  },
  {
    id: 'n0-4',
    nom: "L'écriteau (4)",
    niveau: 'n0',
    px: 78,
    py: 60,
    x: 0,
    y: 0,
    description: 'Un cul-de-sac, et sur le mur un écriteau gravé. Une porte secrète doit bien s\'ouvrir quelque part.',
    vers: ['n0-3', 'n0-5'],
    portes: { 'n0-5': { texte: "le mur au bout du couloir, sous l'écriteau", enigme: 1 } },
  },
  {
    id: 'n0-5',
    nom: "L'escalier savonné (5)",
    niveau: 'n0',
    px: 85,
    py: 58,
    x: 0,
    y: 0,
    description: 'Un escalier qui descend vers la cave. Les marches brillent bizarrement.',
    vers: ['n0-4', 'cave-1'],
    contenu: piege('AD', -1, '1D+1', 'Les marches sont savonnées ! Tu avances avec prudence…', 'Tu descends marche par marche, en te tenant au mur. Ouf.', 'Tes pieds partent devant, ta tête derrière : tu dévales tout l\'escalier sur le dos.'),
  },
  {
    id: 'n0-6',
    nom: "L'escalier tout droit (6)",
    niveau: 'n0',
    px: 52.5,
    py: 37,
    x: 0,
    y: 0,
    description: "Pas d'embûche ici : il est bien connu que « les aventuriers ne vont jamais tout droit ». L'escalier monte à travers le niveau 1 jusqu'au niveau 2, chez Zangdar.",
    vers: ['n0-2', 'n2-18'],
  },
  {
    id: 'n0-7',
    nom: 'La double porte (7)',
    niveau: 'n0',
    px: 32.5,
    py: 60,
    x: 0,
    y: 0,
    description: "Une porte à double battant qui sert à mettre un peu de suspense. Elle n'est pas fermée.",
    vers: ['n0-2', 'n0-8', 'n0-9'],
  },
  {
    id: 'n0-8',
    nom: 'Les latrines (8)',
    niveau: 'n0',
    px: 34,
    py: 72,
    x: 0,
    y: 0,
    description: "Des latrines. Tu peux les fouiller si tu n'as pas d'amour-propre, et tu n'y trouveras rien.",
    vers: ['n0-7'],
    contenu: { type: 'scene', permanente: true, scene: sceneLatrines('Les latrines du rez-de-chaussée. Elles ne sont pas mieux entretenues que le reste.') },
  },
  {
    id: 'n0-9',
    nom: 'La dalle aux arbalètes (9)',
    niveau: 'n0',
    px: 28.5,
    py: 49,
    x: 0,
    y: 0,
    description: 'Un couloir qui remonte vers la salle des rituels. Les murs sont percés de petites meurtrières.',
    vers: ['n0-7', 'n0-10', 'n0-12'],
    contenu: piege('INT', 0, '1D+4', 'Une dalle un peu étrange au milieu du couloir…', 'Tu repères la dalle et tu l\'enjambes. Les arbalètes cachées dans les murs restent muettes.', 'Clac ! Des carreaux d\'arbalète jaillissent des murs.'),
  },
  {
    id: 'n0-10',
    nom: "L'escalier de la cave (10)",
    niveau: 'n0',
    px: 23.5,
    py: 37,
    x: 0,
    y: 0,
    description: "Un escalier en colimaçon qui descend directement à la cave, sans piège, sans énigme et sans savon. La porte du bas est fermée.",
    vers: ['n0-9', 'cave-11'],
  },
  {
    id: 'n0-11',
    nom: 'La salle des gardes orques (11)',
    niveau: 'n0',
    px: 30.5,
    py: 27,
    x: 0,
    y: 0,
    description: "La salle de surveillance du rez-de-chaussée. Des tabourets, une table couverte de dés et d'écuelles sales. Dans un coin, un mur dont une pierre semble avoir beaucoup servi.",
    vers: ['n0-12', 'n0-dortoir', 'n0-13'],
    contenu: bagarre("Des plantons orques et leur chef lèvent le nez de leurs dés. « Des aventuriers ! » Ils empoignent leurs armes.", [E(M.orqueChef), E(M.orque, 1, 1)], {
      gagne: ['cle-coffre-orques', 'cle-cave'],
    }),
    portes: { 'n0-13': { texte: 'une porte secrète derrière la pierre usée', cachee: { carac: 'INT', modif: -2 } } },
  },
  {
    id: 'n0-dortoir',
    nom: 'Le dortoir de la garde',
    niveau: 'n0',
    px: 39,
    py: 45.5,
    x: 0,
    y: 0,
    description: 'Des paillasses qui sentent les pieds, des écuelles sales, des vieux slips. Et un coffre fermé à clé.',
    vers: ['n0-11'],
    tresor: {
      or: 60,
      objets: ['maracas-de-mendiant', 'gri-gri-orque'],
      texte: 'Dans le coffre des gardes, sous les slips : leurs économies.',
      serrure: { texte: 'le coffre des gardes', cle: 'cle-coffre-orques', crochetage: -1, force: -2 },
    },
  },
  {
    id: 'n0-12',
    nom: 'La salle des rituels (12)',
    niveau: 'n0',
    px: 22,
    py: 28.5,
    x: 0,
    y: 0,
    description: 'Un grand pentacle sur le sol et des piliers sculptés de motifs horribles. La salle est connue dans le milieu de la magie : son architecte l\'a conçue pour qu\'elle soit optimale.',
    vers: ['n0-9', 'n0-11'],
    variantes: [{ quand: HEURES_OUVRABLES, contenu: { type: 'scene', scene: sceneAssistant } }],
  },
  {
    id: 'n0-13',
    nom: 'Le long couloir obscur (13)',
    niveau: 'n0',
    px: 46,
    py: 9,
    x: 0,
    y: 0,
    description: 'Un long couloir non éclairé qui fait le tour de l\'étage. Au bout, un cul-de-sac et une pierre visiblement usée.',
    vers: ['n0-11', 'n0-14'],
    portes: { 'n0-14': { texte: 'une autre porte secrète, derrière la pierre usée du cul-de-sac', cachee: { carac: 'INT', modif: 0 } } },
  },
  {
    id: 'n0-14',
    nom: 'La salle du limon (14)',
    niveau: 'n0',
    px: 65,
    py: 43.5,
    x: 0,
    y: 0,
    description: "Une salle humide aux dalles rongées. Dans un coin, un petit coffret avec un écriteau. Au fond, un escalier qui monte.",
    vers: ['n0-13', 'n0-bidon'],
    contenu: { type: 'scene', scene: sceneLimon, bloque: true },
    tresor: {
      or: 80,
      objets: ['potion-soin-forte', 'potion-de-courage-d-ulgur'],
      texte: 'Dans le petit coffret : des objets sympas, car il n\'est pas facile d\'arriver jusqu\'ici.',
      serrure: { texte: 'le petit coffret à énigme', enigme: 2, crochetage: -5 },
    },
  },
  {
    id: 'n0-bidon',
    nom: "L'escalier bidon",
    niveau: 'n0',
    px: 70.5,
    py: 24,
    x: 0,
    y: 0,
    description: "L'escalier monte… et s'arrête contre un mur. Un cul-de-sac. Tu peux t'escrimer à chercher une issue cachée, il n'y en a pas.",
    vers: ['n0-14'],
    contenu: {
      type: 'scene',
      permanente: true,
      scene: sc('bidon', "L'escalier bidon", "Le mur du haut de l'escalier est désespérément plein.", [
        { libelle: 'Chercher une issue cachée', effet: (p) => (passerTemps(p, 0.5), recul('Une demi-heure à tâter chaque pierre. Rien. Absolument rien. Quelque part, un architecte fou ricane.')) },
      ]),
    },
  },
];

// --- Niveau −1 : la cave -------------------------------------------------------------------------

const MAGASIN = ['potion-soin', 'potion-plaies', 'potion-soin-forte', 'potion-de-mana-des-bitos', 'torche', 'corde', 'lampe', 'flacon-d-huile', 'outils-crochetage', 'rations', 'dague-qualite', 'epee-correcte', 'bouclier-de-base', 'casque-de-cuir', 'plastron-cuir-bouilli', 'instrument', 'triangle-en-alliage', 'tambourin-de-base-en-peau', 'guitare-de-base', 'cor-de-base'];

const sceneMagasinFerme = sc(
  'magasin-ferme',
  'Le magasin, fermé',
  "Le magasin de Zangdar est plongé dans le noir. Les étagères croulent sous les potions, les armes et les instruments. Personne. Juste une sonnette, et le silence.",
  [
    {
      libelle: 'Rafler ce qui est à portée de main',
      effet: (p, rng) => {
        const pris = [0, 1, 2].map(() => MAGASIN[lancer(MAGASIN.length, rng) - 1]);
        p.sac.push(...pris);
        malConduire(p, 'ddn:magasin-pille');
        return {
          texte: "Tu remplis ton sac et tu écris un gros mot sur le mur, tant qu'à faire. Une cloche se met à sonner dans tout le donjon : Reivax envoie ses gardes !",
          combat: { rencontre: combat(p, [E(M.orqueChef), E(M.orque, 1, 1)]) },
        };
      },
    },
    { libelle: 'Repartir sans rien toucher', effet: (p) => (reculer(p), recul('Tu refermes doucement la porte. Le magasin rouvre à 9 h.')) },
  ],
);

const CAVE: Salle[] = [
  {
    id: 'cave-1',
    nom: 'La « putain de porte » (1)',
    niveau: 'cave',
    px: 86.5,
    py: 48,
    x: 0,
    y: 0,
    description: "En bas de l'escalier savonné, une porte fermée, solide, et sans serrure : elle s'ouvre de l'autre côté. La fameuse « putain de porte ».",
    vers: ['n0-5', 'cave-2'],
    portes: { 'cave-2': { texte: 'la « putain de porte », sans serrure', force: -4, sensUnique: true } },
  },
  {
    id: 'cave-2',
    nom: 'La salle des orques (2)',
    niveau: 'cave',
    px: 72.5,
    py: 51,
    x: 0,
    y: 0,
    description: 'Une salle de garde de la cave. Un petit coffre pas fermé, et sur le mur, une torche bizarrement inclinée.',
    vers: ['cave-1', 'cave-3', 'cave-14'],
    contenu: bagarre("Encore des orques. Ça ne coûte pas cher à Zangdar et c'est toujours festif.", [E(M.orque, 2, 1)]),
    tresor: { or: 8, objets: ['babiole-gobeline'], texte: 'Dans le petit coffre : des babioles et du matériel pourri.' },
    portes: {
      'cave-3': { texte: 'une porte cachée, qui s\'ouvre en actionnant la torche inclinée', cachee: { carac: 'INT', modif: -1 } },
      'cave-14': { texte: 'la grosse porte du magasin, au crâne de bronze (serrure complexe et piégée)', libre: HEURES_OUVRABLES, crochetage: -3, piege: '3D' },
    },
  },
  {
    id: 'cave-3',
    nom: 'Derrière la torche (3)',
    niveau: 'cave',
    px: 68,
    py: 61,
    x: 0,
    y: 0,
    description: 'Un couloir étroit, derrière la porte cachée, qui dessert trois salles.',
    vers: ['cave-2', 'cave-4', 'cave-5', 'cave-6'],
  },
  {
    id: 'cave-4',
    nom: 'Les sorciers fous (4)',
    niveau: 'cave',
    px: 74,
    py: 70,
    x: 0,
    y: 0,
    description: 'Des chaudrons, des fioles, des grimoires mal rangés : une salle où l\'on prépare des potions en cachette.',
    vers: ['cave-3'],
    contenu: bagarre("De jeunes sorciers fous préparent des potions en cachette. Ils lèvent leurs bâtons en psalmodiant des sorts de niveau 1.", [E(M.sorcierFou, 1, 1)]),
    tresor: { or: 20, objets: ['potion-soin', 'potion-de-mana-des-bitos'], texte: 'Sur l\'établi, quelques potions qui ont l\'air réussies.' },
  },
  {
    id: 'cave-5',
    nom: 'Le débarras à saloperies (5)',
    niveau: 'cave',
    px: 61,
    py: 70,
    x: 0,
    y: 0,
    description: 'Des générations de gardes ont jeté ici tout leur vieux matériel usagé. Une fouille approfondie et un coup de chance pourraient révéler quelque chose.',
    vers: ['cave-3'],
    tresor: {
      or: 25,
      objets: ['tambour-de-mendicite-en-peau-de-rat', 'potion-plaies'],
      texte: 'Sous une montagne de casques troués : un trésor ignoré par les monstres stupides.',
      cachee: { carac: 'INT', modif: -3 },
      heures: 1,
    },
  },
  {
    id: 'cave-6',
    nom: 'Les kobolds farceurs (6)',
    niveau: 'cave',
    px: 46.5,
    py: 77.5,
    x: 0,
    y: 0,
    description: 'Une grande salle. Au fond, une dalle un peu différente des autres. Dans un coin, un coffret avec un écriteau débile.',
    vers: ['cave-3', 'cave-7'],
    contenu: { type: 'scene', scene: sceneKobolds, bloque: true },
    tresor: {
      or: 45,
      objets: ['potion-d-adresse-de-furlac'],
      texte: 'Dans le coffret : des objets de valeur moyenne.',
      serrure: { texte: 'le coffret à l\'écriteau', enigme: 3, force: 0 },
    },
  },
  {
    id: 'cave-7',
    nom: 'Les lutteurs gobelins (7)',
    niveau: 'cave',
    px: 42,
    py: 59,
    x: 0,
    y: 0,
    description: 'Un petit ring circulaire. Une trappe dans le sol, avec une échelle, descend vers les souterrains.',
    vers: ['cave-6', 'cave-8', 'sout-1'],
    contenu: bagarre("Deux lutteurs gobelins encagoulés se battent sur le ring. On ne comprend pas un mot de ce qu'ils racontent. Ils se retournent vers toi.", [E(M.lutteur, 2)]),
  },
  {
    id: 'cave-8',
    nom: 'Le tripot clandestin (8)',
    niveau: 'cave',
    px: 45,
    py: 41,
    x: 0,
    y: 0,
    description: 'Le tripot des gardes : ça sent mauvais, car c\'est presque collé aux latrines. Un râtelier d\'armes, des dés, des chopes.',
    vers: ['cave-7', 'cave-latrines', 'cave-9'],
    contenu: bagarre("Des orques avinés se disputent une partie de dés. Leurs armes sont au râtelier, et ils ne pensaient pas qu'on viendrait jusqu'ici.", [E(M.orqueAvine, 2, 1)]),
    tresor: { or: 14, texte: 'Sur la table : les mises de la partie, des piécettes.' },
  },
  {
    id: 'cave-latrines',
    nom: 'Les latrines de la cave',
    niveau: 'cave',
    px: 34,
    py: 55,
    x: 0,
    y: 0,
    description: 'Des latrines. On n\'y trouve que des maladies.',
    vers: ['cave-8'],
    contenu: { type: 'scene', permanente: true, scene: sceneLatrines('Les latrines du tripot. On peut les fouiller, mais il faut du courage.') },
  },
  {
    id: 'cave-9',
    nom: 'Le gaz hilarant (9)',
    niveau: 'cave',
    px: 30.5,
    py: 31,
    x: 0,
    y: 0,
    description: 'Un carrefour de couloirs. Une dalle un peu branlante au milieu.',
    vers: ['cave-8', 'cave-10', 'cave-12'],
    contenu: piege('INT', 0, '2', 'Une dalle un peu branlante…', 'Tu la repères et tu passes à côté.', 'Pschhh ! Un jet de gaz hilarant. Tu ris pendant dix bonnes minutes, à en avoir mal aux côtes.', (p) => (passerTemps(p, 1 / 6), '')),
  },
  {
    id: 'cave-10',
    nom: 'Le puits des âmes damnées (10)',
    niveau: 'cave',
    px: 17,
    py: 22.5,
    x: 0,
    y: 0,
    description: 'Une salle ronde autour d\'un grand puits noir. Il paraît qu\'on peut y parler aux âmes.',
    vers: ['cave-9', 'cave-11'],
    contenu: { type: 'scene', scene: scenePredicateur, bloque: true },
    portes: { 'cave-11': { texte: 'une porte fermée à clé', cle: 'cle-cave', crochetage: 0 } },
  },
  {
    id: 'cave-11',
    nom: "L'escalier du rez-de-chaussée (11)",
    niveau: 'cave',
    px: 25,
    py: 50,
    x: 0,
    y: 0,
    description: 'Un couloir et un escalier en colimaçon qui remonte au niveau 0.',
    vers: ['cave-10', 'n0-10'],
  },
  {
    id: 'cave-12',
    nom: 'Les rats géants (12)',
    niveau: 'cave',
    px: 46.5,
    py: 22.5,
    x: 0,
    y: 0,
    description: 'Une pièce pleine de paille dégoûtante et d\'ossements. Une des pierres du mur est un peu plus claire que les autres.',
    vers: ['cave-9', 'cave-13'],
    contenu: bagarre('Des rats géants surgissent de la paille.', [E(M.ratGeant, 2, 1)], { pensants: false }),
    portes: {
      'cave-9': { texte: 'une porte fermée à clé (une serrure de rien du tout)', crochetage: 2, force: 0 },
      'cave-13': { texte: 'une porte secrète, derrière la pierre plus claire', cachee: { carac: 'INT', modif: -2 } },
    },
  },
  {
    id: 'cave-13',
    nom: "L'alcôve secrète (13)",
    niveau: 'cave',
    px: 45,
    py: 9,
    x: 0,
    y: 0,
    description: 'Une alcôve secrète. Un magnifique coffret capitonné.',
    vers: ['cave-12'],
    tresor: { objets: ['dague-durandil'], texte: 'Dans le coffret capitonné : une arme d\'artisan renommé. Une Durandil !' },
  },
  {
    id: 'cave-14',
    nom: 'Le magasin de Zangdar (14)',
    niveau: 'cave',
    px: 61,
    py: 18,
    x: 0,
    y: 0,
    description: 'Une grosse porte avec un crâne en bronze et une petite sonnette. Derrière, des étagères pleines. Une trappe dans le sol, et la porte de la réserve.',
    vers: ['cave-2', 'cave-reserve', 'sout-9'],
    contenu: { type: 'scene', scene: sceneMagasinFerme },
    variantes: [
      {
        quand: HEURES_OUVRABLES,
        contenu: {
          type: 'boutique',
          nom: 'Le magasin de Zangdar',
          texte: "Ding ! Une vendeuse souriante t'accueille entre deux vigiles balaises qui te regardent sans sourire. « Bienvenue au magasin du Donjon de Naheulbeuk ! Tout pour l'aventurier, aux tarifs en vigueur. »",
          stock: MAGASIN,
        },
        description: "Le magasin est ouvert (9 h – 18 h). Une vendeuse, deux vigiles balaises. Ils n'attaquent que si l'on menace la vendeuse.",
      },
    ],
  },
  {
    id: 'cave-reserve',
    nom: 'La réserve du magasin',
    niveau: 'cave',
    px: 60.5,
    py: 34.5,
    x: 0,
    y: 0,
    description: 'Des caisses, des tonneaux, des étagères. Le stock du magasin.',
    vers: ['cave-14'],
    tresor: { objets: ['torche', 'rations', 'potion-soin', 'flacon-d-huile'], texte: 'Dans une caisse mal fermée.' },
  },
];

// --- Niveau −2 : les souterrains ---------------------------------------------------------------

const SOUT: Salle[] = [
  {
    id: 'sout-1',
    nom: "L'arrivée des souterrains (1)",
    niveau: 'sout',
    px: 56.5,
    py: 74,
    x: 0,
    y: 0,
    description: "Une petite échelle depuis la trappe des lutteurs gobelins. Des couloirs étroits, bas de plafond, pas éclairés du tout : c'est un labyrinthe. Mieux vaut dessiner un plan.",
    vers: ['cave-7', 'sout-2', 'sout-23'],
  },
  {
    id: 'sout-2',
    nom: 'La tanière du chamane (2)',
    niveau: 'sout',
    px: 73.5,
    py: 73.5,
    x: 0,
    y: 0,
    description: "Une salle éclairée par un feu, pleine de plumes et de fumée. Dans un coin, un écriteau au-dessus d'une dalle descellée.",
    vers: ['sout-1', 'sout-3', 'sout-4'],
    contenu: { type: 'scene', scene: sceneChamane },
    tresor: { objets: ['epee-bonne'], texte: "Sous la dalle : une arme de bonne qualité, cachée là par on ne sait qui.", serrure: { texte: "la dalle à l'écriteau", enigme: 4 } },
  },
  {
    id: 'sout-3',
    nom: 'Les guerriers maudits (3)',
    niveau: 'sout',
    px: 87,
    py: 72.5,
    x: 0,
    y: 0,
    description: 'Une salle froide où plane une odeur de brûlé. Un siège de pierre contre le mur du fond.',
    vers: ['sout-2'],
    contenu: bagarre(
      "Attention, danger. Dans les ténèbres, un guerrier maudit sort de sa méditation. Engoncé dans une armure qui ne laisse filtrer que son regard malveillant, il a vendu son âme à un dieu chaotique. Ce n'est pas un rigolo.",
      [E(M.guerrierMaudit)],
      { pensants: false },
    ),
    tresor: {
      or: 150,
      objets: ['potion-de-force-des-barbares', 'bague-d-absorption-des-critiques'],
      texte: 'En actionnant le siège du guerrier maudit, une alcôve s\'ouvre : un coffret.',
      cachee: { carac: 'INT', modif: -1 },
    },
  },
  {
    id: 'sout-4',
    nom: 'Une dalle piégée (4)',
    niveau: 'sout',
    px: 80.5,
    py: 57,
    x: 0,
    y: 0,
    description: 'Un couloir qui serpente.',
    vers: ['sout-2', 'sout-5', 'sout-23'],
    contenu: piege('INT', 0, '1D', 'Une dalle un peu enfoncée…', 'Tu la repères et tu l\'enjambes.', 'Des dards empoisonnés sifflent hors du mur et te piquent.'),
  },
  {
    id: 'sout-5',
    nom: 'La chanson de Do\'rotaï (5)',
    niveau: 'sout',
    px: 86,
    py: 44,
    x: 0,
    y: 0,
    description: 'Un couloir qui remonte vers une grotte enfumée.',
    vers: ['sout-4', 'sout-6'],
    contenu: piege('INT', 0, '0', 'Une dalle qui fait « clic »…', 'Tu passes vite avant la fin du premier couplet.', "Une chanson de Do'rotaï se met à résonner dans le couloir. Elle parle de trucs débiles, et tu restes là à l'écouter jusqu'au bout.", (p) => {
      if (lancer(6) < 5) return 'Tu t\'en remets.';
      malus(p, "Chanson de Do'rotaï", { INT: -1 }, { jours: 1 });
      return 'Tu perds 1 point d\'Intelligence jusqu\'à demain.';
    }),
  },
  {
    id: 'sout-6',
    nom: 'La harpie hyppie (6)',
    niveau: 'sout',
    px: 74.5,
    py: 33,
    x: 0,
    y: 0,
    description: 'Une grotte assez haute de plafond, enfumée par une herbe hallucinogène qui ralentit les réflexes. Un coffre dans un coin.',
    vers: ['sout-5', 'sout-7', 'sout-8', 'sout-11'],
    contenu: bagarre("La harpie hyppie fond sur toi du plafond, serres en avant, en ricanant entre deux bouffées. Dans sa fumée, tes réflexes sont ralentis.", [E({ ...M.harpie, nom: 'Harpie hyppie (dans sa fumée)', at: 12, prd: 10 })], { pensants: false }),
    tresor: { or: 70, objets: ['potion-de-vitesse'], texte: 'Dans le coffre de la harpie.' },
  },
  {
    id: 'sout-7',
    nom: 'Les gobelins aveugles (7)',
    niveau: 'sout',
    px: 90.5,
    py: 28,
    x: 0,
    y: 0,
    description: 'Une grotte parcourue de courants d\'air violents.',
    vers: ['sout-6'],
    contenu: { type: 'scene', scene: sceneAveugles, bloque: true },
    tresor: { or: 12, objets: ['babiole-gobeline'], texte: 'Dans un nid de chiffons.' },
  },
  {
    id: 'sout-8',
    nom: 'Le piège à doigts (8)',
    niveau: 'sout',
    px: 81,
    py: 14.5,
    x: 0,
    y: 0,
    description: 'Le fond d\'un couloir inutile. Un petit orifice dans le mur, à hauteur de doigt.',
    vers: ['sout-6'],
    contenu: {
      type: 'scene',
      permanente: true,
      scene: sc('doigts', "L'orifice", 'Un petit trou rond dans le mur. Il y a peut-être quelque chose dedans.', [
        {
          libelle: 'Y glisser un doigt',
          effet: (p) => {
            malus(p, 'Deux phalanges en moins', { AD: -1 }, { jours: 7 });
            p.ev -= 2;
            return recul('CHLAC ! Le piège à doigts te coupe deux phalanges. AD −1 pendant une semaine, et −2 PV.');
          },
        },
        { libelle: 'Ne pas y toucher', effet: () => recul('Sage décision.') },
      ]),
    },
  },
  {
    id: 'sout-9',
    nom: "L'escalier du magasin (9)",
    niveau: 'sout',
    px: 62,
    py: 28,
    x: 0,
    y: 0,
    description: 'Un escalier très étroit qui monte vers le magasin de Zangdar. La trappe du haut est fermée par un verrou, de l\'autre côté.',
    vers: ['sout-10', 'cave-14'],
    portes: { 'cave-14': { texte: 'la trappe du magasin, verrouillée de l\'intérieur', force: -2, sensUnique: true } },
  },
  {
    id: 'sout-10',
    nom: 'Le couloir long, chiant et moche (10)',
    niveau: 'sout',
    px: 39,
    py: 31,
    x: 0,
    y: 0,
    description: 'Le long couloir dans lequel des aventuriers célèbres ont fui pour échapper aux monstres. Un emplacement privilégié pour un piège.',
    vers: ['sout-9', 'sout-11', 'sout-21', 'sout-22'],
    contenu: piege('INT', -2, '2D', 'Une rune gravée sur une dalle, à moitié effacée…', 'Tu reconnais une rune de protection de l\'empire Kundar et tu la contournes.', 'La rune de protection de l\'empire Kundar s\'illumine et t\'envoie une décharge.'),
  },
  {
    id: 'sout-11',
    nom: 'Le labyrinthe (11)',
    niveau: 'sout',
    px: 38,
    py: 13.5,
    x: 0,
    y: 0,
    description: 'Des couloirs tarabiscotés qui reviennent sur eux-mêmes. Tu es dans un labyrinthe.',
    vers: ['sout-10', 'sout-12', 'sout-6'],
    contenu: piege('INT', 0, '0', 'Les couloirs se ressemblent tous…', 'Tu repères tes marques et tu retrouves ton chemin.', 'Tu tournes en rond pendant une heure avant de retrouver ton chemin.', (p) => (passerTemps(p, 1), '')),
  },
  {
    id: 'sout-12',
    nom: 'Une dalle piégée (12)',
    niveau: 'sout',
    px: 26,
    py: 13,
    x: 0,
    y: 0,
    description: 'Un couloir étroit.',
    vers: ['sout-11', 'sout-13'],
    contenu: piege('INT', 0, '1D', 'Une dalle un peu enfoncée…', 'Tu l\'enjambes.', 'Des dards empoisonnés jaillissent des murs.'),
  },
  {
    id: 'sout-13',
    nom: "L'antre des chapichapos (13)",
    niveau: 'sout',
    px: 8,
    py: 13,
    x: 0,
    y: 0,
    description: 'Une pièce encombrée d\'objets, pleine de planques.',
    vers: ['sout-12', 'sout-14'],
    variantes: [{ si: (p) => aMarque(p, 'chapichapos-tues') }],
    contenu: bagarre(
      "Deux petites créatures de 50 cm, en pyjama rose et bleu, avec de grands chapeaux ronds, se chamaillent sur la meilleure façon de te tuer. Puis elles se mettent d'accord. Les chapichapos maléfiques !",
      [E(M.chapichapo, 2)],
      { pensants: false, marque: 'chapichapos-tues' },
    ),
    tresor: { or: 90, objets: ['potion-soin'], texte: 'Dans le fatras des chapichapos : quelques trésors.' },
  },
  {
    id: 'sout-14',
    nom: 'Le bourbier (14)',
    niveau: 'sout',
    px: 9,
    py: 27,
    x: 0,
    y: 0,
    description: 'Une salle aux dalles bizarres. Ceux qui sentent le danger ont la chair de poule.',
    vers: ['sout-13', 'sout-15', 'sout-19'],
    contenu: piege('INT', 0, '1D', 'Tu sens comme un danger…', 'Tu restes au bord de la salle. Quelques secondes plus tard, son centre se change en sables mouvants !', 'Le centre de la salle se transforme en sables mouvants sous tes pieds. Tu t\'en sors en rampant, épuisé.'),
  },
  {
    id: 'sout-15',
    nom: 'La tanière des gobelins (15)',
    niveau: 'sout',
    px: 14,
    py: 42,
    x: 0,
    y: 0,
    description: 'Une tanière de gobelins, avec un coffre.',
    vers: ['sout-14', 'sout-16', 'sout-17'],
    contenu: bagarre('Des gobelins embusqués te sautent dessus en piaillant.', [E(M.gobelin, 2, 1)], { gagne: ['cle-grille'] }),
    tresor: { or: 18, objets: ['babiole-gobeline'], texte: 'Dans le coffre des gobelins.' },
  },
  {
    id: 'sout-16',
    nom: 'La fosse à purin (16)',
    niveau: 'sout',
    px: 24,
    py: 42,
    x: 0,
    y: 0,
    description: 'Un cul-de-sac. De la paille sur le sol.',
    vers: ['sout-15'],
    contenu: piege('AD', 0, '1', 'De la paille sur le sol, au bout du cul-de-sac…', 'Tu sens la trappe bouger sous la paille et tu sautes en arrière.', 'Une trappe s\'ouvre : tu tombes dans une fosse à purin.', (p) => {
      malus(p, 'Odeur de purin', { CHA: -2 }, { jours: 3 });
      return 'CHA −2 jusqu\'à ton prochain bain.';
    }),
  },
  {
    id: 'sout-17',
    nom: 'La grille (17)',
    niveau: 'sout',
    px: 24,
    py: 57,
    x: 0,
    y: 0,
    description: 'Une grille solide avec une serrure. Ça ne sent pas très bon : on approche de la tanière du troll.',
    vers: ['sout-15', 'sout-18'],
    portes: { 'sout-18': { texte: 'une grille solide, avec une serrure', cle: 'cle-grille', crochetage: -1 } },
  },
  {
    id: 'sout-18',
    nom: 'Le troll enchaîné (18)',
    niveau: 'sout',
    px: 30.5,
    py: 67,
    x: 0,
    y: 0,
    description: 'Une grande caverne qui pue. Un troll géant y est enchaîné. Il a un coffre, et il le surveille.',
    vers: ['sout-17', 'sout-19'],
    variantes: [{ si: pas('ddn:troll-mort'), contenu: { type: 'scene', scene: sceneTroll, permanente: true } }],
  },
  {
    id: 'sout-19',
    nom: 'La grotte aux mouches (19)',
    niveau: 'sout',
    px: 9,
    py: 58,
    x: 0,
    y: 0,
    description: 'Une grotte au sol couvert de dalles, dont certaines sont orange. Deux couloirs mènent à des culs-de-sac (« Ha ha ! »).',
    vers: ['sout-14', 'sout-18', 'sout-20'],
    contenu: piege('INT', -1, '2D', 'Des dalles orange, ici et là…', 'Tu évites soigneusement les dalles orange.', "Une trappe s'ouvre au plafond : un essaim de mouches venimeuses fond sur toi. Les armes ne servent à rien. Tu fuis en te protégeant la tête, piqué de partout."),
  },
  {
    id: 'sout-20',
    nom: 'Une salle inutile (20)',
    niveau: 'sout',
    px: 4.5,
    py: 39,
    x: 0,
    y: 0,
    description: 'Une des nombreuses salles inutiles des souterrains.',
    vers: ['sout-19'],
    contenu: { type: 'repos', pv: 2, texte: 'Rien ici, et c\'est reposant.' },
  },
  {
    id: 'sout-21',
    nom: 'Encore des gobelins (21)',
    niveau: 'sout',
    px: 46,
    py: 29,
    x: 0,
    y: 0,
    description: 'Une tanière en foutoir.',
    vers: ['sout-10'],
    contenu: bagarre('Quelques gobelins encore, qui jouaient avec un banjo.', [E(M.gobelin, 2, 1)]),
    tresor: { or: 22, objets: ['banjo-frappecrane-des-gobs'], texte: 'Dans un coffret, et à côté : le banjo des gobelins.' },
  },
  {
    id: 'sout-22',
    nom: "L'écriteau du couloir (22)",
    niveau: 'sout',
    px: 37,
    py: 38,
    x: 0,
    y: 0,
    description: 'Une petite salle avec un écriteau, au-dessus d\'une dalle de pierre.',
    vers: ['sout-10', 'sout-23'],
    tresor: { objets: ['hache-1-main-durandil-1-main-pour-nain'], texte: 'La dalle pivote : une petite cachette, et une arme de bonne qualité.', serrure: { texte: "la dalle sous l'écriteau", enigme: 5 } },
  },
  {
    id: 'sout-23',
    nom: "L'escalier de la taverne (23)",
    niveau: 'sout',
    px: 59.5,
    py: 57,
    x: 0,
    y: 0,
    description: "Un escalier qui remonte vers le niveau 1, dans un couloir près de la taverne et des latrines. C'est par là que passe Reivax pour vérifier les installations.",
    vers: ['sout-1', 'sout-4', 'sout-22', 'n1-18'],
  },
];

// --- Niveau 1 : la taverne ---------------------------------------------------------------------

const sceneCuisines = sc(
  'cuisines',
  'Les cuisines',
  'Des cuisiniers et un chef cuisinier, des gens simples et craintifs, s\'activent autour des marmites. Ils se figent en te voyant.',
  [
    {
      libelle: 'Les questionner',
      jet: jet('les rassurer et les faire parler', 'CHA', 0, 'negocier'),
      effet: (p, rng) =>
        reussit(p, 'CHA', 0, rng, 'negocier')
          ? { texte: "Ils ne savent pas grand-chose. Le chef garde la clé de sa chambre dans sa poche (« on n'y entre pas, il y range sa recette de l'ours à la bière »), Gérard le bourreau boit le soir, et il ne faut jamais monter par l'escalier de la salle commune : il est gardé.", regle: false }
          : { texte: 'Un marmiton crie « Au voleur ! ». Le chef cuisinier empoigne ses deux hachoirs.', combat: { rencontre: combat(p, [E(M.chefCuisinier), E(M.cuisinier)]), victoire: (q) => (q.sac.push('cle-chef-cuisinier'), 'Sur le chef : la clé de ses appartements.') } },
    },
    {
      libelle: 'Piller les provisions',
      effet: (p) => {
        p.sac.push('rations', 'rations');
        const h = hautFait(p, 'casse-croute');
        return { texte: `Tu remplis ton sac de saucisses et de pain. Les cuisiniers, terrifiés, s'enfuient par l'autre porte.${h ? ` ${h}.` : ''}` };
      },
    },
    {
      libelle: 'Neutraliser le chef cuisinier',
      effet: (p) => ({ texte: 'Le chef cuisinier sort ses deux hachoirs. Il en a vu d\'autres.', combat: { rencontre: combat(p, [E(M.chefCuisinier)]), victoire: (q) => (q.sac.push('cle-chef-cuisinier'), 'Sur le chef : la clé de ses appartements.') } }),
    },
  ],
);

const sceneLave = sc(
  'lave',
  'La piscine de pierre',
  'Derrière la porte cachée, un genre de piscine en pierre vide, cernée de petites ouvertures. Au fond de la cuve, une dalle. Une joyeuseté de l\'esprit tordu de Reivax.',
  [
    {
      libelle: 'Descendre au fond de la cuve',
      effet: () => ({
        texte: 'Ta botte touche la dalle. Les ouvertures se mettent à cracher de la lave, et la porte secrète se referme derrière toi !',
        suite: sc('lave-2', 'La lave monte !', 'La lave coule au fond de la cuve. Il faut forcer la porte, vite, sans glisser.', [
          {
            libelle: 'Forcer la porte',
            jet: jet('forcer la porte à temps', 'FO'),
            effet: (p, rng) => {
              if (reussit(p, 'FO', 0, rng)) return { texte: 'La porte cède sous ton épaule. Tu sors en sentant tes semelles fumer.' };
              const perte = blesser(p, '2D', rng, false);
              return { texte: `La porte résiste, tu glisses : un pied dans la lave (−${perte} PV, vêtements brûlés). Au deuxième essai, elle cède enfin.` };
            },
          },
        ]),
      }),
    },
    { libelle: 'Ne pas toucher à la dalle', effet: () => recul('Les créatures qui sentent le danger n\'ont aucune envie d\'entrer ici. Tu es une créature qui sent le danger.') },
  ],
);

const N1: Salle[] = [
  {
    id: 'n1-1',
    nom: 'Le bar (1)',
    niveau: 'n1',
    px: 89,
    py: 51,
    x: 0,
    y: 0,
    sortie: 'Ressortir par la porte de la taverne',
    description:
      "L'entrée publique de la taverne, en haut d'un escalier extérieur. Le bar, où les habitués consomment debout, un accès à la salle commune et un autre au carré V.I.P., devant lequel se tiennent deux orques d'élite pas commodes.",
    vers: ['n1-2', 'n1-3'],
    variantes: [
      {
        quand: TAVERNE_OUVERTE,
        contenu: {
          type: 'taverne',
          texte: "Le barman essuie un verre avec un torchon douteux : « Qu'est-ce que je vous sers ? »",
          chope: 1,
          repas: 3,
          rumeurs: RUMEURS,
        },
      },
    ],
  },
  {
    id: 'n1-2',
    nom: 'Le carré V.I.P. (2)',
    niveau: 'n1',
    px: 89,
    py: 70,
    x: 0,
    y: 0,
    description: "Une salle plus cossue : les rendez-vous d'affaires et les soirées privées de Zangdar. Quelques tables, et un escalier vers le niveau 4, l'« étage abandonné » : la sortie de secours de Zangdar.",
    vers: ['n1-1', 'n4-2'],
    contenu: bagarre("Les deux orques d'élite te barrent la route : « C'est privé. » Ils ne sont pas là pour discuter.", [E(M.orqueElite, 2)]),
  },
  {
    id: 'n1-3',
    nom: 'La salle commune (3)',
    niveau: 'n1',
    px: 71,
    py: 42,
    x: 0,
    y: 0,
    description:
      "La salle commune de la taverne, spacieuse, chauffée par trois cheminées. Des tables, des chaises, une petite scène dans un coin. Un escalier monte vers le niveau 2 : il est toujours gardé.",
    vers: ['n1-1', 'n1-esc2', 'n1-4', 'n1-couloir-nord', 'n1-17'],
    variantes: [
      {
        quand: TAVERNE_OUVERTE,
        contenu: {
          type: 'taverne',
          texte: 'Une serveuse bien sympa passe entre les tables. Des orques surveillent la salle d\'un œil morne. Ce soir, un barde massacre une ballade sur la petite scène.',
          chope: 1,
          repas: 3,
          rumeurs: RUMEURS,
        },
      },
    ],
  },
  {
    id: 'n1-esc2',
    nom: "L'escalier du niveau 2",
    niveau: 'n1',
    px: 86,
    py: 25,
    x: 0,
    y: 0,
    description: "L'escalier qui monte au niveau 2, et de là à tous les autres. C'est par là que des aventuriers célèbres ont fui après avoir mis le feu à la taverne.",
    vers: ['n1-3', 'n2-1'],
    contenu: bagarre('Des orques gardent l\'escalier. « On passe pas. »', [E(M.orque, 2, 1)]),
  },
  {
    id: 'n1-4',
    nom: 'Les cuisines (4)',
    niveau: 'n1',
    px: 71,
    py: 61,
    x: 0,
    y: 0,
    description: 'Les cuisines, réservées au personnel : couteaux, marmites, épices.',
    vers: ['n1-3', 'n1-5', 'n1-couloir-sud'],
    contenu: { type: 'scene', scene: sceneCuisines },
    tresor: { objets: ['rations', 'couteau-qualite'], texte: 'Dans les placards : des saucisses, du pain, et un bon couteau.', hautFait: 'casse-croute' },
  },
  {
    id: 'n1-5',
    nom: 'La réserve (5)',
    niveau: 'n1',
    px: 66,
    py: 77,
    x: 0,
    y: 0,
    description: 'La nourriture, les assiettes, le mobilier et tous les alcools qu\'on n\'a pas trouvés au bar.',
    vers: ['n1-4', 'n1-6'],
    tresor: { objets: ['rations', 'rations'], texte: 'De quoi manger, et une bouteille qu\'il vaut mieux laisser.', hautFait: 'casse-croute' },
  },
  {
    id: 'n1-6',
    nom: 'Le dortoir du personnel (6)',
    niveau: 'n1',
    px: 52,
    py: 69,
    x: 0,
    y: 0,
    description: 'Des lits, des armoires, des tables : les locaux du personnel de la taverne. Il y a toujours quelqu\'un qui se repose entre deux services.',
    vers: ['n1-couloir-sud', 'n1-5', 'n1-8', 'n1-7'],
    contenu: {
      type: 'scene',
      scene: sceneDomestiques(
        'n1',
        "Un domestique, terrifié, t'explique que le coffret du débarras leur sert à cacher les objets oubliés par les clients et les pourboires, loin des orques cupides. « C'est la crise pour tout le monde, mon bon monsieur. » Il te donne la clé pour que tu le laisses tranquille.",
      ),
    },
    tresor: { or: 9, texte: 'Les effets personnels des domestiques : un peu d\'argent, des bricoles.' },
  },
  {
    id: 'n1-7',
    nom: 'Le débarras (7)',
    niveau: 'n1',
    px: 55,
    py: 90,
    x: 0,
    y: 0,
    description: 'Des tas de bricoles. Et, bien caché, un petit coffret.',
    vers: ['n1-6', 'n1-8'],
    tresor: {
      or: 160,
      objets: ['instrument', 'potion-soin', 'bague-de-lumiere-bleue'],
      texte: 'Le trésor des domestiques : pas mal d\'or, et des objets perdus par les clients.',
      serrure: { texte: 'le coffret caché des domestiques', cle: 'cle-domestique', crochetage: -2 },
    },
  },
  {
    id: 'n1-8',
    nom: 'Le second dortoir (8)',
    niveau: 'n1',
    px: 38,
    py: 70,
    x: 0,
    y: 0,
    description: 'Une autre pièce d\'habitation des domestiques, sans plus d\'intérêt que la première.',
    vers: ['n1-6', 'n1-7'],
    tresor: { or: 6, texte: 'Sous un matelas.' },
  },
  {
    id: 'n1-9',
    nom: 'Les appartements du chef (9)',
    niveau: 'n1',
    px: 45.5,
    py: 51,
    x: 0,
    y: 0,
    description: 'Les appartements du chef cuistot, un homme influent qui dirige un peu la taverne. Un coffret, un bureau couvert de papiers gras.',
    vers: ['n1-couloir-sud'],
    variantes: [{ quand: [[2, 11], [14, 18]], description: 'La taverne est fermée : le chef se repose chez lui, porte ouverte. Il ronfle dans son fauteuil.' }],
    portes: { 'n1-couloir-sud': { texte: 'la porte du chef, fermée à clé pendant le service', cle: 'cle-chef-cuisinier', crochetage: -1, libre: [[2, 11], [14, 18]] } },
    tresor: { or: 30, texte: 'Dans le coffret du chef : quelques trésors de moindre valeur.' },
  },
  {
    id: 'n1-10',
    nom: 'La piscine de lave (10)',
    niveau: 'n1',
    px: 33,
    py: 51,
    x: 0,
    y: 0,
    description: 'Une piscine en pierre vide, cernée de petites ouvertures.',
    vers: ['n1-couloir-sud'],
    contenu: { type: 'scene', scene: sceneLave, permanente: true },
    portes: { 'n1-couloir-sud': { texte: "une porte cachée, avec une énigme gravée à côté", cachee: { carac: 'INT', modif: 0 }, enigme: 6 } },
  },
  {
    id: 'n1-11',
    nom: 'Les mercenaires (11)',
    niveau: 'n1',
    px: 23.5,
    py: 46,
    x: 0,
    y: 0,
    description: 'Les appartements des mercenaires, prévus en renfort en cas de problème à la taverne.',
    vers: ['n1-couloir-ouest'],
    variantes: [{ quand: [[22, 32]], contenu: bagarre('Les mercenaires se réveillent en sursaut et empoignent leurs boucliers.', [E(M.mercenaire, 1, 1)]) }],
    tresor: { or: 45, objets: ['epee-correcte', 'casque-de-cuir'], texte: 'Dans les coffres des mercenaires : quelques armes et protections, un peu d\'or.' },
  },
  {
    id: 'n1-12',
    nom: "La salle d'entraînement (12)",
    niveau: 'n1',
    px: 17,
    py: 20,
    x: 0,
    y: 0,
    description: "Une grande salle ronde avec des râteliers, des mannequins, des cibles et des punching-balls. Des armes moyennes, et des cuirasses pour gobelins ou des casques pour ogres, rares en magasin.",
    vers: ['n1-couloir-ouest'],
    variantes: [{ quand: HEURES_OUVRABLES, contenu: bagarre("Des mercenaires s'entraînent. Ils sont armés et ravis d'avoir un vrai adversaire.", [E(M.mercenaire, 1, 1)]) }],
    tresor: { objets: ['bouclier-de-base', 'lance-base'], texte: 'Sur les râteliers : des armes et des protections de qualité moyenne.' },
  },
  {
    id: 'n1-13',
    nom: 'Le gaz toxique (13)',
    niveau: 'n1',
    px: 20,
    py: 61,
    x: 0,
    y: 0,
    description: "Un coin de couloir, et un escalier qui monte vers le niveau 3, non loin du bureau de Reivax.",
    vers: ['n1-couloir-ouest', 'n1-couloir-sud', 'n3-15'],
    contenu: piege('INT', 0, '3', 'Une dalle, et un léger bruit sifflant…', 'Tu entends le sifflement et tu te jettes à terre : le gaz passe au-dessus de toi.', 'Un gaz toxique se répand. Tu pleures pendant un quart d\'heure.', (p) => (passerTemps(p, 0.25), '')),
  },
  {
    id: 'n1-14',
    nom: 'Le dortoir des orques (14)',
    niveau: 'n1',
    px: 39,
    py: 20,
    x: 0,
    y: 0,
    description: 'Les dortoirs des orques, désordonnés et malodorants. Un petit coffret fermé à clé.',
    vers: ['n1-couloir-nord'],
    variantes: [{ quand: [[2, 11], [14, 18]], contenu: bagarre("La taverne est fermée : les orques de garde se reposent ici. Plus maintenant.", [E(M.orque, 2, 1)], { gagne: ['cle-coffre-taverne'] }) }],
    tresor: {
      or: 55,
      objets: ['gri-gri-orque', 'epee-perrave'],
      texte: 'Quelques armes, du matériel de mauvaise qualité, et des richesses dans le petit coffret.',
      serrure: { texte: 'le petit coffret des orques', cle: 'cle-coffre-taverne', crochetage: -1, force: -2 },
    },
  },
  {
    id: 'n1-15',
    nom: "L'escalier du niveau 3 (15)",
    niveau: 'n1',
    px: 43.5,
    py: 37,
    x: 0,
    y: 0,
    description: "Un escalier qui monte directement au niveau 3, l'étage de Reivax et de ses gobelins.",
    vers: ['n1-couloir-nord', 'n3-21'],
  },
  {
    id: 'n1-16',
    nom: "L'alcôve aux dards (16)",
    niveau: 'n1',
    px: 55,
    py: 49,
    x: 0,
    y: 0,
    description: 'Une alcôve inutile.',
    vers: ['n1-couloir-nord'],
    contenu: piege('INT', 0, '1D', 'Une dalle un peu enfoncée…', 'Tu l\'enjambes.', 'Des lanceurs de dards empoisonnés crachent dans ta direction.'),
  },
  {
    id: 'n1-17',
    nom: 'Les toilettes (17)',
    niveau: 'n1',
    px: 54,
    py: 12,
    x: 0,
    y: 0,
    description: "Les toilettes de l'étage, très mal entretenues.",
    vers: ['n1-3', 'n1-18'],
    contenu: { type: 'scene', permanente: true, scene: sceneLatrines("Les toilettes de la taverne. Ça ne sert à rien d'y stagner.") },
  },
  {
    id: 'n1-18',
    nom: "L'escalier des souterrains (18)",
    niveau: 'n1',
    px: 58,
    py: 31,
    x: 0,
    y: 0,
    description: 'Un escalier qui descend vers les souterrains.',
    vers: ['n1-17', 'n1-couloir-nord', 'sout-23'],
  },
  {
    id: 'n1-couloir-nord',
    nom: 'Le couloir du personnel',
    niveau: 'n1',
    px: 42,
    py: 44,
    x: 0,
    y: 0,
    description: 'Le couloir du personnel, derrière la salle commune.',
    vers: ['n1-3', 'n1-couloir-ouest', 'n1-14', 'n1-15', 'n1-16', 'n1-18', 'n1-couloir-sud'],
  },
  {
    id: 'n1-couloir-ouest',
    nom: "Le couloir de l'ouest",
    niveau: 'n1',
    px: 19.5,
    py: 44,
    x: 0,
    y: 0,
    description: "Un couloir qui longe les appartements des mercenaires, entre la salle d'entraînement et l'escalier du niveau 3.",
    vers: ['n1-couloir-nord', 'n1-12', 'n1-11', 'n1-13'],
  },
  {
    id: 'n1-couloir-sud',
    nom: 'Le couloir des cuisines',
    niveau: 'n1',
    px: 40,
    py: 58,
    x: 0,
    y: 0,
    description: 'Un couloir qui passe devant les dortoirs et les appartements du chef. Près de la piscine, une porte que rien ne signale.',
    vers: ['n1-couloir-nord', 'n1-13', 'n1-9', 'n1-6', 'n1-4', 'n1-10'],
  },
];

// --- Niveau 2 : Zangdar ---------------------------------------------------------------------------

const N2: Salle[] = [
  {
    id: 'n2-1',
    nom: 'Le palier de la statue (1)',
    niveau: 'n2',
    px: 90,
    py: 31,
    x: 0,
    y: 0,
    description: "Un palier propre et bien éclairé par des lanternes. Une statue de Zangdar, l'air sévère, trône dans une niche.",
    vers: ['n1-esc2', 'n3-1', 'n2-2', 'n2-couloir'],
    contenu: {
      type: 'scene',
      permanente: true,
      scene: sc('statue', 'La statue de Zangdar', 'Une statue de Zangdar en pied, plus grande et plus belle que nature. Le socle est brillant, comme si on le touchait souvent.', [
        {
          libelle: 'Toucher la statue',
          effet: (p, rng) => {
            const v = volee(p, 4, '1D+4', rng);
            return recul(`Clac-clac-clac-clac ! Quatre arbalètes dissimulées dans les murs${v.touches ? ` : ${v.touches} carreau${v.touches > 1 ? 'x' : ''} te touche${v.touches > 1 ? 'nt' : ''} (−${v.total} PV)` : ', et tous les carreaux te ratent'}.`);
          },
        },
        {
          libelle: 'Examiner les murs',
          jet: jet('repérer le piège', 'INT', 0, 'piege'),
          effet: (p, rng) => recul(reussit(p, 'INT', 0, rng, 'piege') ? 'Quatre petites meurtrières, pointées sur la statue. Mieux vaut ne pas la toucher.' : 'Des murs. Propres.'),
        },
      ]),
    },
  },
  {
    id: 'n2-2',
    nom: 'La salle de garde (2)',
    niveau: 'n2',
    px: 93,
    py: 47,
    x: 0,
    y: 0,
    description: "Une petite salle de garde. La pierre est usée au sol et sur un pan de mur : un passage souvent emprunté.",
    vers: ['n2-1', 'n2-3'],
    contenu: bagarre('Un maigre contingent d\'orques te botte le train.', [E(M.orque, 1, 1)]),
    tresor: { objets: ['casque-de-cuir'], texte: 'Des armes et protections de mauvaise qualité.' },
    portes: { 'n2-3': { texte: 'un mur coulissant, là où la pierre est usée', cachee: { carac: 'INT', modif: 0 } } },
  },
  {
    id: 'n2-3',
    nom: 'Le dortoir du personnel (3)',
    niveau: 'n2',
    px: 79,
    py: 54,
    x: 0,
    y: 0,
    description: 'Un dortoir et des appartements pour le personnel de l\'étage.',
    vers: ['n2-2', 'n2-4', 'n2-5'],
    contenu: {
      type: 'scene',
      scene: sceneDomestiques(
        'n2',
        "Les domestiques te disent tout : les maraudeurs, la garde d'élite de Zangdar, traînent autour du bureau administratif ; il ne faut pas faire de bruit. Zangdar travaille dans son bureau de 9 h à 18 h, lit le soir dans sa bibliothèque et dort la nuit. Le golem de son antichambre ne dort jamais.",
      ),
    },
    tresor: { or: 40, objets: ['harmonica-du-donjon'], texte: 'Sous un lit, un coffret : quelques objets de valeur.', cachee: { carac: 'INT', modif: 0 } },
  },
  {
    id: 'n2-4',
    nom: 'Les latrines piégées (4)',
    niveau: 'n2',
    px: 69.5,
    py: 72,
    x: 0,
    y: 0,
    description: 'Des latrines. L\'urinoir du fond a l\'air un peu trop propre.',
    vers: ['n2-3'],
    contenu: piege('INT', 0, '2D', 'Tu t\'approches de l\'urinoir…', 'Deux petits trous dans le mur, juste à la bonne hauteur. Tu t\'abstiens.', 'Deux dards empoisonnés te percent quand tu t\'approches de trop près.'),
  },
  {
    id: 'n2-5',
    nom: 'Le bureau administratif (5)',
    niveau: 'n2',
    px: 69.5,
    py: 41,
    x: 0,
    y: 0,
    description: 'Le petit bureau où Reivax organise la vie du donjon : des classeurs, des listings de personnel, des factures.',
    vers: ['n2-couloir', 'n2-3'],
    portes: { 'n2-3': { texte: 'une porte fermée à clé', cle: 'cle-reivax', crochetage: 0 } },
    contenu: {
      type: 'scene',
      scene: sc('classeurs', 'Les classeurs de Reivax', 'Des piles de classeurs, des listings de monstres et d\'employés, des factures de nourriture pour rats mutants.', [
        {
          libelle: 'Fouiller les classeurs',
          jet: jet('trouver quelque chose d\'utile', 'INT'),
          effet: (p, rng) => {
            passerTemps(p, 0.5);
            if (!reussit(p, 'INT', 0, rng)) return recul('Une demi-heure de factures de rats mutants. Rien d\'utile.');
            revelerNiveaux(p, ['n4', 'n5', 'n6']);
            return { texte: 'Des plans du donjon, sans indications précises : les niveaux 4, 5 et 6. Tu les recopies (ils apparaissent sur ta carte).' };
          },
        },
      ]),
    },
  },
  {
    id: 'n2-6',
    nom: 'Le placard à balais (6)',
    niveau: 'n2',
    px: 78,
    py: 39,
    x: 0,
    y: 0,
    description: 'Un placard à balais, qui contient des balais. Normal.',
    vers: ['n2-couloir'],
  },
  {
    id: 'n2-7',
    nom: 'La garde d\'élite (7)',
    niveau: 'n2',
    px: 64,
    py: 25,
    x: 0,
    y: 0,
    description: 'La salle des maraudeurs. Au bout, une petite salle derrière une double porte très solide : le trésor.',
    vers: ['n2-couloir', 'n2-tresor'],
    contenu: bagarre("Attention, danger : la garde d'élite de Zangdar, les maraudeurs. Ce ne sont pas des rigolos.", [E(M.maraudeur, 1, 1)], { gagne: ['cle-maraudeur'] }),
    tresor: { objets: ['epee-bonne', 'casque-de-metal-de-base'], texte: 'De bonnes armes et des protections.' },
    portes: { 'n2-tresor': { texte: 'une double porte très solide, deux serrures ensorcelées (impossible à briser)', cle: ['cle-maraudeur', 'cle-reivax'], crochetage: -5 } },
  },
  {
    id: 'n2-tresor',
    nom: 'Le trésor de Zangdar',
    niveau: 'n2',
    px: 75,
    py: 21,
    x: 0,
    y: 0,
    description: 'Une petite salle forte. Zangdar est un peu fauché, mais quand même.',
    vers: ['n2-7'],
    tresor: { or: 900, objets: ['lingot-de-berylium-pese-500-grammes'], texte: 'Des pièces d\'or, un lingot et quelques objets précieux.' },
  },
  {
    id: 'n2-couloir',
    nom: 'Le grand couloir',
    niveau: 'n2',
    px: 50,
    py: 36,
    x: 0,
    y: 0,
    description: "Le grand couloir de l'étage de Zangdar, plus propre et plus cossu que les autres, bien éclairé par des lanternes.",
    vers: ['n2-1', 'n2-5', 'n2-6', 'n2-7', 'n2-8', 'n2-9', 'n2-13', 'n2-14', 'n2-16', 'n2-19'],
  },
  {
    id: 'n2-8',
    nom: 'La chambre de Zangdar (8)',
    niveau: 'n2',
    px: 52,
    py: 50,
    x: 0,
    y: 0,
    description: 'Les appartements maléfiques de Zangdar : quelques vêtements de sorcier, rien de bien intéressant.',
    vers: ['n2-couloir', 'n2-9'],
    portes: { 'n2-couloir': { texte: 'la porte de la chambre de Zangdar, fermée à clé', cle: 'trousseau-zangdar', crochetage: -2 } },
    variantes: [zangdar([[23, 33]], 'pyjama', 'C\'est la nuit : Zangdar dort ici.')],
    tresor: { or: 15, texte: 'Dans les poches d\'une robe de sorcier.' },
  },
  {
    id: 'n2-9',
    nom: 'La bibliothèque apocalyptique (9)',
    niveau: 'n2',
    px: 31,
    py: 47,
    x: 0,
    y: 0,
    description: "Une bibliothèque et une salle de gym. Des tas de livres de magie et d'ouvrages pour érudits, des haltères. Un chandelier au mur, particulièrement lustré.",
    vers: ['n2-couloir', 'n2-8', 'n2-10'],
    portes: {
      'n2-couloir': { texte: 'la porte de la bibliothèque, fermée à clé', cle: 'trousseau-zangdar', crochetage: -2 },
      'n2-8': { texte: 'une porte secrète, en actionnant le chandelier lustré', cachee: { carac: 'INT', modif: -1 } },
      'n2-10': { texte: 'la belle porte du laboratoire', cle: 'trousseau-zangdar', crochetage: -2 },
    },
    variantes: [zangdar([[18, 23]], 'lecture', 'C\'est le soir : Zangdar lit ici.')],
  },
  {
    id: 'n2-10',
    nom: 'Le laboratoire sublime (10)',
    niveau: 'n2',
    px: 40,
    py: 78,
    x: 0,
    y: 0,
    description: "Fioles, cornues, marmites : un laboratoire alchimique. Sur un mur, une statue horrible de Zangdar dont un œil a une drôle de forme. Dans un coin, un coffre vide.",
    vers: ['n2-9', 'n2-11', 'n2-12'],
    portes: { 'n2-11': { texte: "l'œil de la statue de Zangdar : un trou de serrure tarabiscoté", cachee: { carac: 'INT', modif: -2 }, cle: 'trousseau-zangdar', crochetage: -3 } },
    tresor: { objets: ['potion-de-mana-des-bitos', 'potion-soin', 'cornue-d-alchimiste'], texte: 'Des ingrédients de base, et quelques potions. Les mages feront leur marché.' },
  },
  {
    id: 'n2-11',
    nom: 'Le laboratoire secret (11)',
    niveau: 'n2',
    px: 57,
    py: 76,
    x: 0,
    y: 0,
    description: "Le laboratoire des expériences interdites, que Zangdar ne veut pas montrer aux inspecteurs de la Caisse des Donjons. Une gargouille avec un trou de serrure dans l'oreille.",
    vers: ['n2-10'],
    tresor: { objets: ['potion-soin-forte', 'potion-de-mana-rouge', 'potion-de-resistance-magique'], texte: 'Des objets plus chers et plus rares.' },
  },
  {
    id: 'n2-12',
    nom: 'Le balcon fourbe (12)',
    niveau: 'n2',
    px: 52,
    py: 91,
    x: 0,
    y: 0,
    sortie: 'Descendre le long du mur (2 cordes)',
    sortieSi: avecCorde(2),
    description: 'Un balcon, visible depuis l\'extérieur. Les étages sont hauts dans ce donjon.',
    vers: ['n2-10'],
  },
  {
    id: 'n2-13',
    nom: 'La salle de bains terrifiante (13)',
    niveau: 'n2',
    px: 34,
    py: 28,
    x: 0,
    y: 0,
    description: 'La salle de bains de Zangdar : même le lavabo est décoré de gargouilles, et le robinet est en forme de serpent.',
    vers: ['n2-couloir'],
    contenu: { type: 'scene', permanente: true, scene: sceneLaver },
  },
  {
    id: 'n2-14',
    nom: "L'antichambre du golem (14)",
    niveau: 'n2',
    px: 21.5,
    py: 28,
    x: 0,
    y: 0,
    description: "L'antichambre du bureau de Zangdar. Pas une table, pas une chaise : le golem n'a besoin de rien. Au fond, une oubliette.",
    vers: ['n2-couloir', 'n2-15'],
    contenu: { type: 'scene', scene: sceneGolem, bloque: true },
  },
  {
    id: 'n2-15',
    nom: 'Le bureau néfaste de Zangdar (15)',
    niveau: 'n2',
    px: 22,
    py: 13,
    x: 0,
    y: 0,
    description:
      "Le bureau de Zangdar. Un placard à statuettes prophétiques, un guéridon avec une poterie grotesque, et à droite une porte de sortie avec un énorme verrou enchanté.",
    vers: ['n2-14', 'n2-18', 'n2-cachette'],
    variantes: [zangdar(HEURES_OUVRABLES, 'bureau', 'Heures ouvrables : Zangdar est à son bureau.')],
    portes: { 'n2-cachette': { texte: 'une serrure dissimulée dans le socle de la poterie grotesque', cachee: { carac: 'INT', modif: -3 }, cle: 'trousseau-zangdar', crochetage: -4 } },
  },
  {
    id: 'n2-cachette',
    nom: 'Le coffre personnel de Zangdar',
    niveau: 'n2',
    px: 17,
    py: 3,
    x: 0,
    y: 0,
    description: 'Un réduit secret et un coffre personnel.',
    vers: ['n2-15'],
    tresor: { or: 120, objets: ['potion-d-invisibilite-de-zubilii', 'baguette-de-zorlaki', 'bague-de-lumiere-bleue'], texte: 'Le coffre personnel de Zangdar : quelques objets magiques.' },
  },
  {
    id: 'n2-16',
    nom: 'La volière à corbeaux (16)',
    niveau: 'n2',
    px: 13,
    py: 27,
    x: 0,
    y: 0,
    description: 'Des dizaines de corbeaux qui croassent : les espions de Reivax.',
    vers: ['n2-couloir'],
    contenu: {
      type: 'scene',
      scene: sc('corbeaux', 'Les corbeaux', 'Les corbeaux te fixent de leurs yeux noirs. Ils ont l\'air de parler entre eux.', [
        {
          libelle: 'Déchiffrer le code des corbeaux',
          jet: jet('comprendre quelque chose', 'INT', -4),
          effet: (p, rng) => {
            if (!reussit(p, 'INT', -4, rng)) return recul('« Croâ. » Tu ne comprends rien, et l\'un d\'eux te fiente dessus.');
            marquer(p, 'ddn:faiblesse');
            return { texte: "À force d'écouter, et sur un malentendu, tu comprends qu'un corbeau se moque de Zangdar : « Croâ… musique… faux… quatre… CROÂ ! » Zangdar ne supporte pas la musique mal jouée." };
          },
        },
      ]),
    },
  },
  {
    id: 'n2-17',
    nom: 'Le balcon mauvais (17)',
    niveau: 'n2',
    px: 38.5,
    py: 9,
    x: 0,
    y: 0,
    sortie: 'Descendre le long du mur (2 cordes)',
    sortieSi: avecCorde(2),
    description: "Un balcon sur l'arrière du donjon. En contrebas, à droite, l'entrée de la taverne.",
    vers: ['n2-18'],
  },
  {
    id: 'n2-18',
    nom: "L'escalier du rez-de-chaussée (18)",
    niveau: 'n2',
    px: 41,
    py: 19,
    x: 0,
    y: 0,
    description: "L'escalier qui descend tout droit au rez-de-chaussée. En haut, la porte du bureau de Zangdar et son énorme verrou enchanté.",
    vers: ['n0-6', 'n2-17', 'n2-15'],
    portes: { 'n2-15': { texte: "l'énorme verrou enchanté de la porte de Zangdar (facile à ouvrir de l'autre côté)", cle: 'passe-cdd', crochetage: -6, sensUnique: true } },
  },
  {
    id: 'n2-19',
    nom: "L'escalier du niveau 3 (19)",
    niveau: 'n2',
    px: 54,
    py: 30,
    x: 0,
    y: 0,
    description: "Un escalier qui monte au niveau 3, chez Reivax.",
    vers: ['n2-couloir', 'n3-23'],
  },
];

// --- Niveau 3 : Reivax -------------------------------------------------------------------------------

const N3: Salle[] = [
  {
    id: 'n3-1',
    nom: 'Le palier (1)',
    niveau: 'n3',
    px: 79.5,
    py: 33,
    x: 0,
    y: 0,
    description: "Un palier. On entend un vacarme et des braillements venant de la cuisine des gobelins : ils testent des recettes grotesques. Moins propre et beaucoup moins rangé que chez Zangdar.",
    vers: ['n2-1', 'n4-1', 'n3-2', 'n3-3', 'n3-4', 'n3-21', 'n3-22'],
  },
  {
    id: 'n3-2',
    nom: 'Les rats mutants (2)',
    niveau: 'n3',
    px: 91,
    py: 45,
    x: 0,
    y: 0,
    description: "L'enclos des rats mutants : paille infecte, débris, une odeur à faire pleurer. Au bout du couloir, un tas d'ossements.",
    vers: ['n3-1'],
    contenu: bagarre('Deux rats mutants, spécialement entraînés pour le combat, se jettent sur toi.', [E(M.ratMutant, 2)], { pensants: false }),
    tresor: { or: 35, objets: ['triangle-en-fer-mediocre'], texte: 'Dans le tas d\'ossements, une cassette rouillée.' },
  },
  {
    id: 'n3-3',
    nom: 'Le foutoir de merdier bordélique (3)',
    niveau: 'n3',
    px: 72,
    py: 70,
    x: 0,
    y: 0,
    description: "Une double salle très encombrée : les gobelins y jettent des trucs inutiles depuis plus de trente ans. Il faudra un très long moment pour fouiller.",
    vers: ['n3-1'],
    tresor: { or: 15, objets: ['peluche-d-ourson-qui-fait-heuin', 'potion-de-courage-d-ulgur'], texte: 'Après deux heures de fouille, sous un tas de bonnets sales : quelques trésors jetés par des gobelins qui ne sont pas de grands connaisseurs.', heures: 2 },
  },
  {
    id: 'n3-4',
    nom: 'La cuisine des gobelins (4)',
    niveau: 'n3',
    px: 73.5,
    py: 51.5,
    x: 0,
    y: 0,
    description: 'Une cuisine très désordonnée. Ça sent le chou brûlé et autre chose.',
    vers: ['n3-1', 'n3-5'],
    contenu: bagarre('Des gobelins affairés à une préparation douteuse lâchent leurs louches et sortent leurs couteaux.', [E(M.gobelin, 2, 1)]),
    tresor: { objets: ['rations'], texte: 'De quoi manger (si tu as faim).', hautFait: 'casse-croute' },
  },
  {
    id: 'n3-5',
    nom: 'Le dortoir des gobelins (5)',
    niveau: 'n3',
    px: 58,
    py: 42,
    x: 0,
    y: 0,
    description: "Le foutoir le plus invraisemblable : paillasses, hamacs, placards. Une cheminée.",
    vers: ['n3-4', 'n3-6'],
    variantes: [{ quand: [[22, 32]], contenu: bagarre('Des gobelins dorment un peu partout. Ils se réveillent en piaillant.', [E(M.gobelin, 3, 1)]) }],
    contenu: bagarre('Quelques gobelins se reposent. Ils se jettent sur toi.', [E(M.gobelin, 1, 1)]),
    tresor: { or: 70, objets: ['potion-soin'], texte: 'Près de la cheminée, un petit coffre caché.', cachee: { carac: 'INT', modif: -1 } },
  },
  {
    id: 'n3-6',
    nom: "La pancarte de l'escalier (6)",
    niveau: 'n3',
    px: 48,
    py: 57,
    x: 0,
    y: 0,
    description: "Une pancarte au mur, et derrière ce mur l'escalier du niveau 4. C'est ici que des aventuriers célèbres ont dit « chaussette ».",
    vers: ['n3-5', 'n3-9', 'n3-7', 'n4-8'],
    portes: { 'n4-8': { texte: 'le mur sous la pancarte', enigme: 7 } },
  },
  {
    id: 'n3-7',
    nom: 'Les toilettes des gobelins (7)',
    niveau: 'n3',
    px: 46.5,
    py: 64.5,
    x: 0,
    y: 0,
    description: 'Des toilettes pour gobelins. On te passe les détails.',
    vers: ['n3-6'],
    contenu: { type: 'scene', permanente: true, scene: sceneLatrines('Des toilettes pour gobelins. Un elfe n\'y mettrait jamais les pieds.') },
  },
  {
    id: 'n3-8',
    nom: 'La deuxième énigme (8)',
    niveau: 'n3',
    px: 34,
    py: 60,
    x: 0,
    y: 0,
    description: "Une autre énigme sur un mur gris. Derrière, une partie du niveau plus périlleuse que la moyenne : ceux qui ont l'instinct du danger le sentent.",
    vers: ['n3-9', 'n3-15', 'n3-10'],
    portes: { 'n3-10': { texte: 'le mur gris de l\'énigme', enigme: 8 } },
  },
  {
    id: 'n3-9',
    nom: 'La garde de Reivax (9)',
    niveau: 'n3',
    px: 34.5,
    py: 54.5,
    x: 0,
    y: 0,
    description: 'Le « poste de garde » de Reivax.',
    vers: ['n3-6', 'n3-8'],
    contenu: bagarre("La garde personnelle de Reivax : des gobelins qui sortent du poste en t'entendant dans le couloir.", [E(M.gobelin, 2, 1)]),
  },
  {
    id: 'n3-10',
    nom: 'Le couloir qui descend (10)',
    niveau: 'n3',
    px: 34.5,
    py: 72,
    x: 0,
    y: 0,
    description: "Un couloir qui descend. D'un côté, le couloir des chompeurs ; de l'autre, un détour par des salles sombres.",
    vers: ['n3-8', 'n3-chompeurs', 'n3-11'],
  },
  {
    id: 'n3-chompeurs',
    nom: 'Le couloir des chompeurs',
    niveau: 'n3',
    px: 46,
    py: 70,
    x: 0,
    y: 0,
    description: 'Un couloir où de gros blocs de pierre tombent du plafond à intervalles réguliers.',
    vers: ['n3-10', 'n3-13'],
    contenu: { type: 'scene', scene: sceneChompeurs, bloque: true },
  },
  {
    id: 'n3-11',
    nom: 'Une pièce presque vide (11)',
    niveau: 'n3',
    px: 37,
    py: 81,
    x: 0,
    y: 0,
    description: 'Une pièce à peu près vide.',
    vers: ['n3-10', 'n3-12'],
    contenu: piege('INT', 0, '1D', 'Une dalle un peu enfoncée…', 'Tu l\'enjambes.', 'Des dards empoisonnés jaillissent des murs.'),
  },
  {
    id: 'n3-12',
    nom: 'Le serpent (12)',
    niveau: 'n3',
    px: 45,
    py: 86,
    x: 0,
    y: 0,
    description: 'Une petite salle plongée dans la pénombre, encombrée de paille détrempée. Un petit tunnel humide au ras du sol.',
    vers: ['n3-11', 'n3-13'],
    contenu: bagarre("Un serpent constricteur sort du tunnel et cherche à t'enserrer dans ses anneaux.", [E(M.serpent)], { pensants: false }),
    tresor: { objets: ['epee-bonne'], texte: 'Dans la paille : une belle arme, perdue ici par un guerrier décédé.' },
  },
  {
    id: 'n3-13',
    nom: 'Les rats de l\'espace (13)',
    niveau: 'n3',
    px: 58,
    py: 70,
    x: 0,
    y: 0,
    description: 'Une salle avec un coffre. Et des petits shorts verts.',
    vers: ['n3-12', 'n3-chompeurs'],
    contenu: bagarre("Des rats mutants zombies venimeux de l'espace en short. Ils sont gros, morts-vivants, vêtus de petits shorts verts, et leur morsure est venimeuse.", [E(M.ratZombie, 1, 1)], { pensants: false }),
    tresor: { or: 60, objets: ['bague-d-absorption-des-critiques'], texte: 'Dans le coffre : quelques beaux objets.' },
  },
  {
    id: 'n3-14',
    nom: "L'armurerie (14)",
    niveau: 'n3',
    px: 24,
    py: 52.5,
    x: 0,
    y: 0,
    description: 'Une armurerie utilisée surtout par les gobelins : un peu de tout, mais surtout des armes usagées et médiocres.',
    vers: ['n3-15'],
    portes: { 'n3-15': { texte: "la porte de l'armurerie, fermée à clé", crochetage: 0, force: -1 } },
    tresor: { objets: ['hache-correcte', 'bouclier-de-base', 'lance-base'], texte: 'Sur les râteliers : des armes de qualité très médiocre.' },
  },
  {
    id: 'n3-15',
    nom: 'Les jets de vomi (15)',
    niveau: 'n3',
    px: 19.5,
    py: 49,
    x: 0,
    y: 0,
    description: "Un couloir percé de petits trous dans le mur. Un escalier descend vers le niveau 1.",
    vers: ['n3-8', 'n3-14', 'n3-16', 'n3-21', 'n1-13'],
    contenu: piege('INT', 0, '0', 'Des petits trous dans le mur, et une dalle…', 'Tu repères la dalle et tu l\'évites.', 'Des jets de vomi jaillissent des trous du mur et t\'aspergent.', (p) => {
      malus(p, 'Odeur de vomi', { CHA: -1 }, { jours: 3 });
      return 'CHA −1 jusqu\'à ta prochaine toilette.';
    }),
  },
  {
    id: 'n3-16',
    nom: 'Le bureau de Reivax (16)',
    niveau: 'n3',
    px: 22,
    py: 27,
    x: 0,
    y: 0,
    description: 'Le bureau personnel de Reivax. Des armoires, des tiroirs, des papiers en désordre.',
    vers: ['n3-15', 'n3-17'],
    portes: { 'n3-15': { texte: 'la porte du bureau de Reivax, fermée à clé', cle: 'cle-reivax', crochetage: 0 } },
    variantes: [{ quand: HEURES_OUVRABLES, si: (p) => !aMarque(p, 'ddn:reivax-vaincu') && !aMarque(p, 'ddn:reivax-allie'), contenu: { type: 'scene', scene: sceneReivax, bloque: true } }],
    contenu: {
      type: 'scene',
      scene: sc('tiroirs', 'Les tiroirs de Reivax', 'Des armoires et des tiroirs pleins de papiers.', [
        {
          libelle: 'Fouiller les armoires et les tiroirs',
          jet: jet('trouver ce qui compte', 'INT', 0, 'cachette'),
          effet: (p, rng) => {
            passerTemps(p, 0.5);
            if (!reussit(p, 'INT', 0, rng, 'cachette')) return recul('Des factures de nourriture pour rats mutants, des plannings de garde, des réclamations de gobelins. Rien d\'utile.');
            marquer(p, 'ddn:indice-7', 'ddn:indice-8', 'ddn:levier');
            revelerNiveaux(p, ['n3']);
            return { texte: "Un plan de l'étage, les réponses des énigmes du couloir (« Chaussette » et « un homme qui suit un cercueil »), et une note : « Chompeurs : penser à graisser le levier, près du sol. »" };
          },
        },
      ]),
    },
  },
  {
    id: 'n3-17',
    nom: 'La chambre miteuse de Reivax (17)',
    niveau: 'n3',
    px: 27,
    py: 14.5,
    x: 0,
    y: 0,
    description: "La chambre de Reivax sent le renfermé. Des vêtements presque propres. Sur une étagère, des dizaines de robinets alignés : sa collection.",
    vers: ['n3-16', 'n3-19'],
    tresor: { or: 30, objets: ['potion-d-adresse-de-furlac'], texte: 'Sous le lit, un coffret dissimulé : de petits objets magiques.', cachee: { carac: 'INT', modif: -1 } },
  },
  {
    id: 'n3-18',
    nom: 'Le balcon nase de Reivax (18)',
    niveau: 'n3',
    px: 47,
    py: 6,
    x: 0,
    y: 0,
    sortie: 'Descendre le long du mur (3 cordes)',
    sortieSi: avecCorde(3),
    description: 'Un petit balcon pour surveiller les alentours, un peu au-dessus de celui de Zangdar.',
    vers: ['n3-19'],
  },
  {
    id: 'n3-19',
    nom: 'La salle de bains sordide (19)',
    niveau: 'n3',
    px: 46,
    py: 19,
    x: 0,
    y: 0,
    description: 'La salle de bains de Reivax. Pas grand-chose à dire, sauf qu\'on peut s\'y laver.',
    vers: ['n3-17', 'n3-18', 'n3-23'],
    contenu: { type: 'scene', permanente: true, scene: sceneLaver },
  },
  {
    id: 'n3-20',
    nom: "La salle d'ennui (20)",
    niveau: 'n3',
    px: 30,
    py: 34,
    x: 0,
    y: 0,
    description: "Quelques chaises. Les gens y viennent quand ils ont envie de s'ennuyer. Il y règne un tel climat d'inutilité qu'elle en est presque dangereuse.",
    vers: ['n3-21'],
    contenu: {
      type: 'scene',
      permanente: true,
      scene: sc('ennui', "La salle d'ennui", 'Des chaises. Rien d\'autre. Le temps semble s\'étirer.', [
        {
          libelle: "S'asseoir un moment",
          effet: (p) => {
            passerTemps(p, 1 / 12);
            malus(p, "Ennui profond", { INT: -1 }, { heures: 3 });
            return recul('Cinq minutes, et tu as l\'impression d\'avoir perdu une année. INT −1 pour les trois prochaines heures.');
          },
        },
      ]),
    },
  },
  {
    id: 'n3-21',
    nom: 'Les boules puantes (21)',
    niveau: 'n3',
    px: 39,
    py: 27,
    x: 0,
    y: 0,
    description: "Le bout d'un couloir, un placard à balais, et l'escalier qui descend au niveau 1.",
    vers: ['n3-1', 'n3-15', 'n3-20', 'n1-15'],
    contenu: piege('INT', 0, '0', 'Une dalle au bout du couloir…', 'Tu l\'évites.', 'Une averse de boules puantes te tombe dessus.', (p) => {
      malus(p, 'Odeur de boules puantes', { CHA: -2 }, { jours: 3 });
      return 'CHA −2 jusqu\'à ta prochaine toilette.';
    }),
  },
  {
    id: 'n3-22',
    nom: 'La patinoire des gobelins (22)',
    niveau: 'n3',
    px: 69,
    py: 18,
    x: 0,
    y: 0,
    description: 'Une salle ronde au sol complètement gelé depuis une expérience magique de Zangdar.',
    vers: ['n3-1', 'n3-23', 'n3-24'],
    variantes: [{ quand: [[14, 20]], contenu: bagarre("Des gobelins glissent en criant « youpiiee » et « wizzz ». Ils te foncent dessus, en patins.", [E(M.gobelin, 2)]) }],
  },
  {
    id: 'n3-23',
    nom: "L'escalier du niveau 2 (23)",
    niveau: 'n3',
    px: 52.5,
    py: 14,
    x: 0,
    y: 0,
    description: "L'escalier qui descend vers le niveau 2.",
    vers: ['n3-22', 'n3-19', 'n2-19'],
  },
  {
    id: 'n3-24',
    nom: 'Le cul-de-sac (24)',
    niveau: 'n3',
    px: 57,
    py: 5,
    x: 0,
    y: 0,
    description: 'Un cul-de-sac. Une petite meurtrière permet de regarder le temps qu\'il fait dehors.',
    vers: ['n3-22'],
  },
];

// --- Niveau 4 : l'étage abandonné ---------------------------------------------------------------------

const lichePresente = (texte: string): Contenu => ({ type: 'combat', texte, ennemis: [E(M.liche)], unique: true, marque: 'ddn:liche-morte', gagne: ['cle-liche'] });

const N4: Salle[] = [
  {
    id: 'n4-1',
    nom: 'Le palier (1)',
    niveau: 'n4',
    px: 90,
    py: 33.5,
    x: 0,
    y: 0,
    description: "Rien de rien avec rien. Le désert total et un silence impressionnant. Les couloirs sont encombrés des reliquats de terribles batailles : squelettes, meubles brisés, armes en morceaux.",
    vers: ['n3-1', 'n5-1', 'n4-6', 'n4-couloir'],
  },
  {
    id: 'n4-6',
    nom: 'Le couloir plus large (6)',
    niveau: 'n4',
    px: 56,
    py: 26,
    x: 0,
    y: 0,
    description: "Le grand couloir qui mène à l'antre du Golbargh. Il ne faut pas faire le malin ici. Des traces de griffes au plafond.",
    vers: ['n4-1', 'n4-antre', 'n4-7', 'n4-8'],
  },
  {
    id: 'n4-antre',
    nom: "L'antre du Golbargh",
    niveau: 'n4',
    px: 54,
    py: 16,
    x: 0,
    y: 0,
    description: "L'antre du plus terrible des monstres du donjon, coincé dans l'étage par un sortilège stupide de Zangdar. Un coffre au fond.",
    vers: ['n4-6'],
    variantes: [{ si: pas('ddn:golbargh-mort'), contenu: { type: 'scene', scene: sceneGolbargh, bloque: true, permanente: true } }],
    tresor: { or: 500, objets: ['lingot-de-berylium-pese-500-grammes', 'potion-d-invincibilite-de-gargalor', 'fibule-des-coups-puissants'], texte: 'Le coffre du Golbargh : plusieurs objets de grande valeur.' },
  },
  {
    id: 'n4-7',
    nom: 'La salle sale (7)',
    niveau: 'n4',
    px: 67,
    py: 40,
    x: 0,
    y: 0,
    description: "Une salle particulièrement sale. Quelque chose saute sur le sol.",
    vers: ['n4-6'],
    contenu: {
      type: 'scene',
      permanente: true,
      scene: sc('puces', 'La salle sale', 'Des détritus partout. Il y a peut-être quelque chose à trouver.', [
        {
          libelle: 'Fouiller les détritus',
          effet: (p) => {
            passerTemps(p, 1 / 6);
            malus(p, 'Puces', { AD: -1 }, { jours: 2 });
            p.or += 3;
            return recul("Tu trouves 3 PO… et des puces, qui n'avaient pas mangé depuis un temps fou. Tu te grattes : AD −1 pendant deux jours.");
          },
        },
      ]),
    },
  },
  {
    id: 'n4-8',
    nom: "L'escalier du niveau 3 (8)",
    niveau: 'n4',
    px: 44,
    py: 45,
    x: 0,
    y: 0,
    description: "Un escalier qui descend vers le niveau 3, jusqu'à un mur fermé par une énigme.",
    vers: ['n4-6', 'n3-6'],
  },
  {
    id: 'n4-couloir',
    nom: 'Le couloir des salles abandonnées',
    niveau: 'n4',
    px: 60,
    py: 60,
    x: 0,
    y: 0,
    description: "Un long couloir désert, entre des salles abandonnées. Une grosse porte, du côté de la liche.",
    vers: ['n4-1', 'n4-3', 'n4-4', 'n4-tinbanque', 'n4-abandonnee'],
    variantes: [
      {
        quand: [[20, 30]],
        si: pas('ddn:liche-morte'),
        contenu: lichePresente("Quand vient la nuit, la liche hante les couloirs. La voilà, en chemise de nuit et en babouches, qui lève son bâton de mage vers toi."),
        description: 'C\'est la nuit : la liche se promène.',
      },
    ],
  },
  {
    id: 'n4-3',
    nom: 'La demeure de la liche (3)',
    niveau: 'n4',
    px: 47,
    py: 66,
    x: 0,
    y: 0,
    description: "La demeure de la liche en babouches : des livres d'histoire, un fauteuil, un petit coffret.",
    vers: ['n4-couloir'],
    portes: { 'n4-couloir': { texte: 'une grosse porte. La serrure est protégée par un claptor de Mazrok', cle: 'cle-liche', crochetage: -2, piege: '5D' } },
    variantes: [{ quand: [[6, 20]], si: pas('ddn:liche-morte'), contenu: lichePresente('La liche lève le nez de son livre d\'histoire. Pas de discussion possible : elle combat aussitôt.') }],
    tresor: { objets: ['flute-en-or-de-folonariel'], texte: 'Dans le petit coffret : une flûte en or, et des livres sans intérêt.' },
  },
  {
    id: 'n4-4',
    nom: 'Le couloir du poulet (4)',
    niveau: 'n4',
    px: 36,
    py: 55,
    x: 0,
    y: 0,
    description: 'Un couloir poussiéreux. Il traîne ici un poulet, ou plus précisément un coq.',
    vers: ['n4-couloir', 'n4-5', 'n4-desertique'],
    variantes: [{ si: pas('ddn:poulet-mort'), contenu: { type: 'scene', scene: scenePoulet, permanente: true } }],
  },
  {
    id: 'n4-5',
    nom: 'La salle abandonnée (5)',
    niveau: 'n4',
    px: 21,
    py: 32,
    x: 0,
    y: 0,
    description: "Une salle abandonnée, avec un coffre qui n'a pas été fracturé pendant la « guerre du Golbargh ». Entre les joints des pierres, un bouton caché.",
    vers: ['n4-4', 'n4-esc5'],
    portes: { 'n4-esc5': { texte: 'une porte secrète, avec un bouton caché entre les joints', cachee: { carac: 'INT', modif: -1 } } },
    tresor: { or: 80, objets: ['casque-de-metal-lebohaum', 'potion-soin-forte'], texte: 'Le coffre a survécu à la guerre.' },
  },
  {
    id: 'n4-esc5',
    nom: "L'escalier du niveau 5",
    niveau: 'n4',
    px: 31,
    py: 13,
    x: 0,
    y: 0,
    description: 'Un escalier qui monte vers le niveau 5.',
    vers: ['n4-5', 'n5-ouest'],
  },
  {
    id: 'n4-tinbanque',
    nom: 'La salle Tinbanque',
    niveau: 'n4',
    px: 72.5,
    py: 70,
    x: 0,
    y: 0,
    description: 'Une salle abandonnée, au calme. Un bon endroit pour se reposer.',
    vers: ['n4-couloir', 'n4-2'],
    contenu: { type: 'repos', pv: 6, pa: 8, heures: 1, texte: "Tu t'assois contre le mur. Le silence de l'étage est presque reposant." },
  },
  {
    id: 'n4-2',
    nom: 'Le recoin (2)',
    niveau: 'n4',
    px: 63,
    py: 77,
    x: 0,
    y: 0,
    description: "Un recoin. Une issue cachée, protégée par une énigme : la position de repli de Zangdar, vers la salle V.I.P. de la taverne.",
    vers: ['n4-tinbanque', 'n1-2'],
    portes: { 'n1-2': { texte: "une issue cachée, avec une énigme gravée dans la pierre", cachee: { carac: 'INT', modif: -1 }, enigme: 9 } },
  },
  {
    id: 'n4-desertique',
    nom: 'La salle désertique',
    niveau: 'n4',
    px: 35,
    py: 70,
    x: 0,
    y: 0,
    description: 'Une salle vide. Des squelettes, des meubles brisés. Le Golbargh est passé par là.',
    vers: ['n4-4'],
  },
  {
    id: 'n4-abandonnee',
    nom: 'Une salle abandonnée',
    niveau: 'n4',
    px: 59,
    py: 49,
    x: 0,
    y: 0,
    description: 'Une salle abandonnée, pleine d\'armes en morceaux.',
    vers: ['n4-couloir'],
    tresor: { or: 6, objets: ['epee-perrave'], texte: 'Dans les débris, une épée qui a vu des jours meilleurs.' },
  },
];

// --- Niveau 5 : les cachots et les services -----------------------------------------------------------

const FORGE = ['epee-bonne', 'hache-correcte', 'marteau-correct', 'bouclier-de-base', 'grand-bouclier-de-base', 'casque-de-metal-de-base', 'plastron-cuir-renforce', 'cotte-sans-manches'];
const HERBORISTE = ['potion-soin', 'potion-plaies', 'potion-soin-forte', 'onguent-magnifique-de-niptuk', 'potion-de-mana-des-bitos', 'sirop-de-boulorne', 'potion-de-courage-d-ulgur'];

const N5: Salle[] = [
  {
    id: 'n5-1',
    nom: 'Le palier (1)',
    niveau: 'n5',
    px: 79.5,
    py: 33,
    x: 0,
    y: 0,
    description: "Un palier. D'un côté, une grosse porte fermée ; de l'autre, l'espace « services » du donjon. On entend le marteau du forgeron dans tout l'étage.",
    vers: ['n4-1', 'n6-1', 'n5-2', 'n5-couloir'],
    portes: { 'n5-2': { texte: 'la grosse porte des cachots (mécanisme coriace)', cle: 'trousseau-geolier', crochetage: -3 } },
  },
  {
    id: 'n5-2',
    nom: 'La porte des cachots (2)',
    niveau: 'n5',
    px: 77.5,
    py: 16,
    x: 0,
    y: 0,
    description: 'Le bout du couloir des cachots, derrière la grosse porte.',
    vers: ['n5-1', 'n5-3'],
    variantes: [{ quand: [[8, 20]], contenu: bagarre('Un geôlier en faction lève sa lance.', [E(M.geolier)]) }],
  },
  {
    id: 'n5-3',
    nom: 'Les cachots (3)',
    niveau: 'n5',
    px: 50,
    py: 18,
    x: 0,
    y: 0,
    description: "Le couloir des cachots : de petites cellules avec une couchette en bois et un trou pour les besoins naturels. Des barreaux solides, des serrures coriaces.",
    vers: ['n5-2', 'n5-4', 'n5-ouest'],
    portes: {
      'n5-4': { texte: 'la porte du bureau des geôliers', cle: 'trousseau-geolier', crochetage: -3 },
      'n5-ouest': { texte: 'la porte ouest des cachots', cle: 'trousseau-geolier', crochetage: -3 },
    },
  },
  {
    id: 'n5-4',
    nom: 'Le bureau des geôliers (4)',
    niveau: 'n5',
    px: 44,
    py: 31,
    x: 0,
    y: 0,
    description: 'Le bureau des geôliers : des dés, des armes, de l\'équipement, et un coffre.',
    vers: ['n5-3'],
    variantes: [{ quand: [[8, 20]], contenu: bagarre('Les geôliers lâchent leurs dés. Ils prennent leur travail très au sérieux.', [E(M.geolier, 1, 1), E(M.geolier)], { gagne: ['trousseau-geolier'] }) }],
    contenu: bagarre('La nuit, il ne reste qu\'un geôlier, qui somnole.', [E(M.geolier)], { gagne: ['trousseau-geolier'] }),
    tresor: { or: 60, texte: 'Dans le coffre : un double des clés et des pièces d\'or.', serrure: { texte: 'le coffre des geôliers', cle: 'trousseau-geolier', crochetage: -3 } },
  },
  {
    id: 'n5-ouest',
    nom: 'Le palier ouest',
    niveau: 'n5',
    px: 31,
    py: 20,
    x: 0,
    y: 0,
    description: "Le haut de l'escalier secret qui vient du niveau 4. Un couloir mène aux appartements de Gérard le Terrible.",
    vers: ['n4-esc5', 'n5-3', 'n5-18', 'n5-couloir-ouest'],
  },
  {
    id: 'n5-18',
    nom: 'Les appartements de Gérard le Terrible (18)',
    niveau: 'n5',
    px: 21,
    py: 22.5,
    x: 0,
    y: 0,
    description: "Un lit, une armoire, une petite table, des bouteilles vides. Ce n'est pas fermé : Gérard estime que personne n'aura le courage de venir lui chercher des noises. Près de la cheminée, un coffret.",
    vers: ['n5-ouest'],
    variantes: [
      { quand: [[20, 26]], si: pas('ddn:gerard-vaincu'), contenu: { type: 'scene', scene: sceneGerardIvre, bloque: true, permanente: true }, description: "C'est le soir : Gérard boit." },
      { quand: [[2, 9]], si: pas('ddn:gerard-vaincu'), contenu: gerardSobre("Gérard le Terrible se réveille, sobre et de très mauvaise humeur. Il attrape sa hache.") },
    ],
    tresor: { or: 90, objets: ['potion-de-force-des-barbares'], texte: 'Dans le coffret près de la cheminée : quelques objets précieux.' },
  },
  {
    id: 'n5-couloir-ouest',
    nom: "Le couloir de l'herboriste",
    niveau: 'n5',
    px: 23.5,
    py: 62,
    x: 0,
    y: 0,
    description: 'Un couloir entre la couturière, les toilettes et la salle des tortures.',
    vers: ['n5-ouest', 'n5-17', 'n5-19', 'n5-14', 'n5-couloir'],
  },
  {
    id: 'n5-19',
    nom: 'Les toilettes presque propres (19)',
    niveau: 'n5',
    px: 32,
    py: 36,
    x: 0,
    y: 0,
    description: 'Des toilettes presque propres, pour Gérard et les commerçants de l\'étage.',
    vers: ['n5-couloir-ouest'],
    contenu: { type: 'scene', permanente: true, scene: sceneLaver },
  },
  {
    id: 'n5-17',
    nom: 'La couturière (17)',
    niveau: 'n5',
    px: 19,
    py: 49,
    x: 0,
    y: 0,
    description: "L'atelier de la couturière : des pantalons et des chaussettes à recoudre.",
    vers: ['n5-couloir-ouest'],
    variantes: [
      {
        quand: HEURES_OUVRABLES,
        contenu: {
          type: 'scene',
          permanente: true,
          scene: sc('couturiere', 'La couturière', "Une vieille femme raccommode une chaussette en marmonnant : « Ils m'espionnent… Moi, je devrais diriger ce donjon… Au lieu de ça, des chaussettes, des chaussettes… »", [
            {
              libelle: 'Lui faire réparer tes vêtements (5 PO)',
              possible: (p) => (p.or >= 5 ? null : 'Il faut 5 PO.'),
              effet: (p) => {
                p.or -= 5;
                seLaver(p);
                return recul("Elle recoud, elle lave, elle repasse, en se plaignant du salaire, de Zangdar et des pigeons qui l'espionnent. Tes vêtements sont comme neufs (et ne sentent plus rien).");
              },
            },
            { libelle: 'Écouter ses théories', effet: () => recul("Les corbeaux sont des espions (c'est vrai, en fait). Reivax lui vole ses aiguilles. Le bourreau pleure le soir. Zangdar ne sait pas tenir un donjon.") },
          ]),
        },
      },
    ],
  },
  {
    id: 'n5-16',
    nom: "L'herboriste (16)",
    niveau: 'n5',
    px: 28,
    py: 55,
    x: 0,
    y: 0,
    description: "Le bureau de l'herboriste : des bocaux, des herbes qui sèchent, une odeur de foin mouillé.",
    vers: ['n5-couloir'],
    variantes: [
      {
        quand: HEURES_OUVRABLES,
        contenu: {
          type: 'boutique',
          nom: "L'herboriste",
          texte: "L'herboriste, un salarié plutôt sympathique qui ne veut pas d'ennuis, t'accueille avec un sourire prudent : onguents, potions de soin, ingrédients magiques.",
          stock: HERBORISTE,
          ragots: {
            prix: 10,
            marque: 'ddn:faiblesse',
            textes: [
              "Pour 10 PO, il baisse la voix : « Gérard, le bourreau, il est terrible le matin. Mais le soir, il boit, et il devient tout tendre. Il parle de Zangdar… La musique mal jouée, il ne la supporte pas. Il faut au moins quatre instruments. »",
            ],
          },
        },
      },
    ],
  },
  {
    id: 'n5-14',
    nom: 'La salle des tortures (14)',
    niveau: 'n5',
    px: 42,
    py: 72,
    x: 0,
    y: 0,
    description: 'Du matériel de torture, de petits outils bien pratiques (pinces, tenailles, scie, couteaux) et des braséros pleins de charbons ardents.',
    vers: ['n5-couloir-ouest', 'n5-couloir', 'n5-15'],
    variantes: [{ quand: [[9, 20]], si: pas('ddn:gerard-vaincu'), contenu: gerardSobre("Gérard le Terrible prépare son matériel. Il se retourne, la hache à la main : « Un volontaire ? »") }],
    tresor: { objets: ['outils-crochetage'], texte: 'Parmi les pinces et les tenailles, de petits outils très pratiques pour les serrures.' },
  },
  {
    id: 'n5-15',
    nom: "L'entrepôt (15)",
    niveau: 'n5',
    px: 51,
    py: 87,
    x: 0,
    y: 0,
    description: 'Le vieux matériel de torture : siège à pointes, vierge de fer… Dans un coin, de vieilles couvertures.',
    vers: ['n5-14'],
    tresor: { or: 50, objets: ['potion-soin-forte'], texte: 'Sous les vieilles couvertures, un coffre.', cachee: { carac: 'INT', modif: 0 } },
  },
  {
    id: 'n5-9',
    nom: 'Le bureau du bourreau (9)',
    niveau: 'n5',
    px: 47,
    py: 65,
    x: 0,
    y: 0,
    description: 'Le petit bureau de Gérard, chichement meublé.',
    vers: ['n5-couloir'],
    contenu: {
      type: 'scene',
      scene: sc('bureau-gerard', 'Le bureau du bourreau', 'Un bureau, une chaise, des papiers.', [
        {
          libelle: 'Fouiller le bureau',
          jet: jet('trouver quelque chose', 'INT'),
          effet: (p, rng) => {
            passerTemps(p, 1 / 6);
            if (!reussit(p, 'INT', 0, rng)) return recul('Des listes de prisonniers, des factures de charbon. Rien d\'utile.');
            marquer(p, 'ddn:faiblesse');
            revelerNiveaux(p, ['n5']);
            return { texte: "Un plan de l'étage, et une lettre de Reivax : « Mon vieux Gérard, ne répète à personne que Zangdar ne supporte pas la musique mal jouée. Quatre instruments faux et sa sphère tombe. Brûle cette lettre. » Gérard ne l'a pas brûlée." };
          },
        },
      ]),
    },
  },
  {
    id: 'n5-7',
    nom: 'La forge (7)',
    niveau: 'n5',
    px: 48,
    py: 49,
    x: 0,
    y: 0,
    description: 'La forge du donjon. Une enclume, un soufflet, des armes en réparation.',
    vers: ['n5-couloir'],
    variantes: [
      {
        quand: HEURES_OUVRABLES,
        contenu: {
          type: 'boutique',
          nom: 'Le forgeron',
          texte: "Le forgeron, un brave homme, pose son marteau : « Je suis pas là pour faire le sale boulot. Mais si vous voulez de la bonne camelote… »",
          stock: FORGE,
          ragots: {
            prix: 5,
            textes: [
              "« Le golem de l'antichambre de Zangdar n'a qu'un œil valide. Et il y a une oubliette au fond de la salle. Je dis ça… »",
              "« Le trésor de Zangdar, au 2e, il faut deux clés : une sur un maraudeur, l'autre sur Reivax. »",
              "« La liche du 4e, sa porte est piégée : un claptor de Mazrok. Prends sa clé sur elle, si tu la croises la nuit. »",
            ],
          },
        },
      },
    ],
  },
  {
    id: 'n5-6',
    nom: 'La salle de réunion (6)',
    niveau: 'n5',
    px: 59,
    py: 50,
    x: 0,
    y: 0,
    description: 'Une grande table et de nombreuses chaises : c\'est là qu\'ont lieu les réunions stratégiques.',
    vers: ['n5-couloir'],
  },
  {
    id: 'n5-5',
    nom: "L'entraînement des larbins (5)",
    niveau: 'n5',
    px: 64,
    py: 31,
    x: 0,
    y: 0,
    description: 'Haltères, tapis de gym, mannequins, cibles.',
    vers: ['n5-couloir'],
    variantes: [{ quand: HEURES_OUVRABLES, contenu: bagarre('Un mercenaire en pleine séance d\'abdos se relève, ravi de la distraction.', [E(M.mercenaire)]) }],
  },
  {
    id: 'n5-8',
    nom: 'La salle de fouettage (8)',
    niveau: 'n5',
    px: 72,
    py: 69,
    x: 0,
    y: 0,
    description: 'Des poteaux de fouettage et des fouets. On amène ici les domestiques qui font mal leur travail.',
    vers: ['n5-couloir'],
  },
  {
    id: 'n5-10',
    nom: 'Les latrines (10)',
    niveau: 'n5',
    px: 68,
    py: 84,
    x: 0,
    y: 0,
    description: "Les toilettes de l'étage. Rien à faire ici à part attraper la nausée.",
    vers: ['n5-couloir'],
  },
  {
    id: 'n5-11',
    nom: 'La salle pour pleurer (11)',
    niveau: 'n5',
    px: 82,
    py: 69,
    x: 0,
    y: 0,
    description: 'Les larbins fouettés viennent ici pleurer sur leur condition.',
    vers: ['n5-couloir', 'n5-12'],
    contenu: {
      type: 'scene',
      scene: sc('larbin', 'Un larbin qui pleure', 'Un domestique sanglote dans un coin, le dos zébré de marques de fouet.', [
        {
          libelle: 'Le consoler',
          jet: jet('le réconforter', 'CHA', 2, 'negocier'),
          effet: (p, rng) =>
            reussit(p, 'CHA', 2, rng, 'negocier')
              ? { texte: "Il renifle : « Merci… Vous savez, Gérard, le bourreau, il n'est pas méchant. Le soir, il boit, il pleure aussi. Il dit qu'il a pas d'amis. Si on l'écoute, il raconte tout, même les secrets de Zangdar. »" }
              : recul('Il se méfie et file en reniflant.'),
        },
      ]),
    },
  },
  {
    id: 'n5-12',
    nom: 'Le bazar (12)',
    niveau: 'n5',
    px: 94,
    py: 61,
    x: 0,
    y: 0,
    description: 'Un tas d\'objets plus ou moins utiles rangés là pour ne pas traîner dans les couloirs : assiettes, chaises, lanternes, cordes, jarres.',
    vers: ['n5-11'],
    tresor: { objets: ['corde', 'corde', 'torche', 'guitare-de-mendiant'], texte: 'Des trucs communs, et une vieille guitare.' },
  },
  {
    id: 'n5-13',
    nom: 'Le dortoir des larbins (13)',
    niveau: 'n5',
    px: 93,
    py: 40,
    x: 0,
    y: 0,
    description: 'Encore un dortoir pour le personnel.',
    vers: ['n5-couloir'],
    variantes: [
      {
        quand: [[22, 31]],
        contenu: {
          type: 'scene',
          scene: sceneDomestiques('n5', "Les domestiques réveillés te supplient de ne pas les tuer. Ils te disent que les geôliers ne sont qu'un la nuit, et que Gérard le bourreau boit le soir dans sa chambre, à l'ouest."),
        },
      },
    ],
    tresor: { or: 45, texte: 'Un petit coffret caché : quelques objets de valeur moyenne.', cachee: { carac: 'INT', modif: 0 } },
  },
  {
    id: 'n5-couloir',
    nom: 'Le couloir des services',
    niveau: 'n5',
    px: 62,
    py: 57,
    x: 0,
    y: 0,
    description: "Le couloir de l'espace « services » : forge, herboriste, réunion, fouettage.",
    vers: ['n5-1', 'n5-5', 'n5-6', 'n5-7', 'n5-8', 'n5-9', 'n5-10', 'n5-11', 'n5-13', 'n5-14', 'n5-16', 'n5-couloir-ouest'],
  },
];

// --- Niveau 6 : le sommet et les ingénieurs -------------------------------------------------------------

const sceneIngenieurs = sc(
  'ingenieurs',
  'Les ingénieurs gobelins',
  "Des gobelins en tablier, lunettes de protection sur le nez, s'affairent autour de machins bizarres : une tronçonneuse à gnôle, un lance-flammes, un deltaplane. Ils te regardent avec inquiétude : ce ne sont pas des combattants.",
  [
    {
      libelle: 'Discuter avec eux',
      jet: jet('se faire comprendre', 'INT', 0, 'connaissance'),
      effet: (p, rng) =>
        reussit(p, 'INT', 0, rng, 'connaissance')
          ? { texte: "À force de gestes, tu comprends : le dirigeable gobelin est amarré sur la plateforme. Il faut un pilote. Ils t'expliquent aussi le maniement de leurs engins, avec beaucoup de schémas.", regle: false }
          : recul('Ils parlent tous en même temps, en gobelin, avec des mots techniques. Tu n\'y comprends rien.'),
    },
    {
      libelle: 'Capturer un ingénieur pour piloter le dirigeable',
      jet: jet('en attraper un', 'AD'),
      effet: (p, rng) => {
        if (!reussit(p, 'AD', 0, rng)) return recul('Ils s\'éparpillent en piaillant entre les machines. Tu n\'attrapes qu\'un tablier.');
        marquer(p, 'ddn:ingenieur-otage');
        return { texte: "Tu attrapes un petit ingénieur par le col. « Toi, tu sais piloter le ballon ? » Il hoche la tête très vite. Il te suivra jusqu'à la plateforme." };
      },
    },
    {
      libelle: 'Bricoler avec eux (bricolo du dimanche)',
      visible: (p) => aTalent(p, 'Bricolo du dimanche'),
      jet: jet('mettre au point une invention', 'AD'),
      effet: (p, rng) => {
        passerTemps(p, 2);
        if (!reussit(p, 'AD', 0, rng)) return recul("Deux heures de travail, une explosion, des sourcils en moins. L'invention n'a pas survécu.");
        p.sac.push('nunchaku-de-brouzli');
        marquer(p, 'ddn:ingenieur-otage');
        return { texte: "Deux heures plus tard, vous avez mis au point une arme bizarre et mortelle. Ils te la laissent, et l'un d'eux propose de te faire faire un tour en dirigeable quand tu veux." };
      },
    },
    { libelle: 'Les chasser', effet: (p) => ({ texte: 'Les ingénieurs se défendent mollement avec des clés à molette.', combat: { rencontre: combat(p, [E(M.ingenieur, 2, 1)]) } }) },
  ],
);

const N6: Salle[] = [
  {
    id: 'n6-1',
    nom: 'Le balcon du coin (1)',
    niveau: 'n6',
    px: 92,
    py: 33,
    x: 0,
    y: 0,
    description: "Le dernier étage, en partie à ciel ouvert. Plein de courants d'air. Pas de portes : on court aisément, et on peut projeter un ennemi par-dessus le parapet.",
    vers: ['n5-1', 'n6-2', 'n6-7', 'n6-6'],
  },
  {
    id: 'n6-2',
    nom: 'Le hangar de bidouillage (2)',
    niveau: 'n6',
    px: 52,
    py: 19,
    x: 0,
    y: 0,
    description: "Le hangar des ingénieurs gobelins, encombré de machins bizarres. Un petit balcon au nord pour surveiller la météo.",
    vers: ['n6-1', 'n6-3'],
    contenu: { type: 'scene', scene: sceneIngenieurs, permanente: true },
  },
  {
    id: 'n6-3',
    nom: 'La plateforme à engins volants (3)',
    niveau: 'n6',
    px: 18,
    py: 22,
    x: 0,
    y: 0,
    sortie: "S'envoler à bord du dirigeable gobelin",
    sortieSi: (p) => (aMarque(p, 'ddn:ingenieur-otage') ? null : 'Il faut un ingénieur gobelin pour piloter le dirigeable. Aucun aigle géant ne viendra te chercher.'),
    description: "Une plateforme d'où l'on peut s'élancer dans le vide. Le dirigeable gobelin, une baudruche hideuse, y est amarré.",
    vers: ['n6-2', 'n6-4'],
  },
  {
    id: 'n6-4',
    nom: "Le balcon à l'ouest (4)",
    niveau: 'n6',
    px: 26,
    py: 64,
    x: 0,
    y: 0,
    description: 'Encore un balcon pour observer les environs.',
    vers: ['n6-3', 'n6-5'],
  },
  {
    id: 'n6-5',
    nom: 'Le balcon de surveillance sud (5)',
    niveau: 'n6',
    px: 53,
    py: 87,
    x: 0,
    y: 0,
    description: 'Tout pareil.',
    vers: ['n6-4', 'n6-6'],
  },
  {
    id: 'n6-6',
    nom: "Le balcon à l'est (6)",
    niveau: 'n6',
    px: 91,
    py: 70,
    x: 0,
    y: 0,
    description: 'Et toujours un balcon.',
    vers: ['n6-5', 'n6-1'],
  },
  {
    id: 'n6-7',
    nom: 'La salle des inventions (7)',
    niveau: 'n6',
    px: 46,
    py: 47,
    x: 0,
    y: 0,
    description: 'Un autre atelier des ingénieurs, où l\'on trouve à peu près n\'importe quoi et de nombreux outils.',
    vers: ['n6-1', 'n6-8', 'n6-9'],
    tresor: { or: 40, objets: ['trompette-krakoreille-des-gobs', 'baguette-de-zorlaki'], texte: 'Un coffret caché dans un coin : quelques trésors.', cachee: { carac: 'INT', modif: 0 } },
  },
  {
    id: 'n6-8',
    nom: 'Le vomissoir et fatras (8)',
    niveau: 'n6',
    px: 32.5,
    py: 42,
    x: 0,
    y: 0,
    description: 'Une réserve affreusement mal rangée, dans laquelle quelqu\'un a récemment vomi.',
    vers: ['n6-7'],
  },
  {
    id: 'n6-9',
    nom: 'Le dortoir étrange (9)',
    niveau: 'n6',
    px: 67,
    py: 55,
    x: 0,
    y: 0,
    description: 'Des lits suspendus par des bras articulés, des mobiles tarabiscotés au plafond, des automates qui font n\'importe quoi.',
    vers: ['n6-7'],
    tresor: { or: 30, objets: ['potion-de-vitesse'], texte: 'Dans un petit coffre, dans un coin.' },
  },
];

export const SALLES: Salle[] = [...N0, ...CAVE, ...SOUT, ...N1, ...N2, ...N3, ...N4, ...N5, ...N6];

export const DDN: Donjon = {
  id: ID_DDN,
  nom: 'Le Donjon de Naheulbeuk',
  ou: 'monde:donjon-naheulbeuk',
  niveaux: [
    { id: 'n6', nom: 'Niveau 6 : le sommet' },
    { id: 'n5', nom: 'Niveau 5 : bourreau, domestiques' },
    { id: 'n4', nom: 'Niveau 4 : étage abandonné' },
    { id: 'n3', nom: 'Niveau 3 : Reivax' },
    { id: 'n2', nom: 'Niveau 2 : Zangdar' },
    { id: 'n1', nom: 'Niveau 1 : la taverne' },
    { id: 'n0', nom: "Niveau 0 : l'entrée" },
    { id: 'cave', nom: 'Niveau −1 : la cave' },
    { id: 'sout', nom: 'Niveau −2 : les souterrains' },
  ],
  entrees: [
    { salle: 'n0-entree', libelle: 'Frapper à la grande porte' },
    { salle: 'n1-1', libelle: 'Entrer par la taverne, à l\'arrière', ouverte: TAVERNE_OUVERTE },
  ],
  intro:
    "Le Donjon de Naheulbeuk se dresse dans une zone poussiéreuse et semi-aride, entre quelques arbres rachitiques. Six niveaux, une cave, des souterrains, reliés par l'architecte fou d'une façon un peu chaotique. Personne ne répond quand tu frappes, mais la porte n'est pas fermée.",
  salles: SALLES,
  entree: 'n0-entree',
  finale: '',
  conclusion: '',
};

/** Les heures où la taverne est ouverte (pour l'affichage). */
export const HORAIRES_TAVERNE = '11 h – 14 h et 18 h – 2 h';
