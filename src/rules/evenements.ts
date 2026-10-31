import { aTalent, bonusSituation, savoir } from './talents';
import { dansGroupe, reagir, recruter } from './compagnons';
import { calculerFiche } from './creation';
import { lancer, type Rng } from './des';
import type { Terrain } from './monde';
import { epreuve, lancerExpression, soigner, valeursCombat, type Partie } from './partie';
import { ligneEnnemi, TABLE_TERRES_SAUVAGES, TABLES, type LigneRencontre, type Rencontre, type Zone } from './rencontres';

// Événements écrits pour les routes autour de Waldorg. Ils ne viennent pas des règles officielles :
// ce sont les « surprises » du MJ, bonnes ou mauvaises, tirées au hasard pendant le voyage.

export interface Resultat {
  texte: string;
  /** Heures perdues (ou gagnées) sur le trajet. */
  heures?: number;
  /** L'événement tourne à la bagarre : le combat suit, puis `victoire` s'applique si le héros gagne. */
  combat?: { rencontre: Rencontre; victoire?: (p: Partie) => string };
  /** L'histoire continue : « Continuer » ouvre cet événement. */
  suite?: Evenement;
  /** Dans un donjon : false si la scène n'est pas réglée pour autant (on a reculé, raté, fui…). */
  regle?: boolean;
}

export interface Choix {
  libelle: string;
  /** Le joueur lance lui-même ce dé avant que l'effet ne s'applique (c'est le premier dé de `effet`). */
  jet?: { faces: 6 | 20; pour: string; valeur?: (p: Partie) => number };
  /** Raison pour laquelle ce choix est impossible, ou null. */
  possible?: (p: Partie) => string | null;
  /** Choix réservé à certains héros (une compétence…) : caché aux autres. */
  visible?: (p: Partie) => boolean;
  effet: (p: Partie, rng?: Rng) => Resultat;
}

export interface Evenement {
  id: string;
  titre: string;
  texte: string;
  /** Terrains où il peut arriver (tous par défaut). */
  terrains?: Terrain[];
  /** Zones de rencontre où il peut arriver (forêt…) ; toutes par défaut. */
  zones?: Zone[];
  /** Seulement en suite d'un autre événement, jamais tiré au hasard. */
  suiteSeule?: boolean;
  /** L'événement n'arrive que si la partie le permet (suite d'une histoire, mauvaise conduite…). */
  condition?: (p: Partie) => boolean;
  /** Une suite d'histoire en attente passe devant les événements ordinaires (une chance sur deux). */
  prioritaire?: boolean;
  choix: Choix[];
}

/** Marque une mauvaise action : le monde s'en souviendra. */
export const malConduire = (p: Partie, marque: string, points = 1) => {
  p.mauvaiseConduite = (p.mauvaiseConduite ?? 0) + points;
  p.marques = [...new Set([...(p.marques ?? []), marque])];
  reagir(p, { type: 'conduite' });
};

export const aMarque = (p: Partie, marque: string) => !!p.marques?.includes(marque);

const oterMarque = (p: Partie, marque: string) => {
  p.marques = (p.marques ?? []).filter((m) => m !== marque);
};

/** Le marchand blessé, s'il faut en venir aux mains. Il est faible, mais il défend sa bourse. */
export const MARCHAND_BLESSE: LigneRencontre = {
  d20: 0,
  rencontre: 'Marchand blessé',
  nombre: '1',
  nom: 'Marchand blessé',
  at: 7,
  prd: 5,
  ev: 6,
  pr: 0,
  degats: '1D-1',
  cou: 7,
  xp: 2,
  notes: 'Blessé à la jambe, armé d\'un bâton',
};

const brigands = (nombre: number): Rencontre => ({ ligne: TABLE_TERRES_SAUVAGES[4], d20: 5, nombre });

const perdre = (p: Partie, n: number) => {
  p.ev -= n;
  return n;
};

const retirer = (p: Partie, id: string) => {
  const i = p.sac.indexOf(id);
  if (i >= 0) p.sac.splice(i, 1);
  return i >= 0;
};

// La bourse dans le fossé : une fois sur trois, c'est l'appât d'un piège à mâchoires.
// Idée de Sedy : avec la compétence Détecter, on peut d'abord étudier les alentours.
const valeurDetecter = (p: Partie) => calculerFiche(p.perso).caracs.INT + bonusSituation(p, 'piege').total;
const CHOIX_BOURSE = (detecter: boolean): Choix[] => [
  {
    libelle: 'La ramasser',
    jet: { faces: 6, pour: 'voir ce qui arrive (1 ou 2 : il y avait un piège)' },
    effet: (p, rng) => {
      const d = lancer(6, rng);
      const or = lancer(6, rng);
      p.or += or;
      if (d > 2) return { texte: `Dé : ${d}. Elle contient ${or} pièces d'or et un bouton de culotte. Tu gardes les deux.` };
      const blessure = lancer(6, rng);
      perdre(p, blessure);
      return { texte: `Dé : ${d}. CLAC ! Un piège à mâchoires caché sous les herbes se referme sur ta main : −${blessure} PV. La bourse contenait quand même ${or} pièces d'or.` };
    },
  },
  ...(detecter
    ? [
        {
          libelle: "Étudier les alentours d'abord (Détecter, épreuve d'Intelligence)",
          visible: (p: Partie) => aTalent(p, 'Détecter'),
          jet: { faces: 20 as const, pour: "l'épreuve d'Intelligence", valeur: valeurDetecter },
          effet: (p: Partie, rng?: Rng) => {
            const e = epreuve(valeurDetecter(p), rng);
            if (!e.reussi)
              return { texte: `Dé : ${e.de}. Tu tournes autour, tu tâtes l'herbe du bout du pied… Rien de suspect. Ou alors c'est très bien caché.`, suite: BOURSE_SANS_DETECTER };
            const or = lancer(6, rng) + 2;
            p.or += or;
            return { texte: `Dé : ${e.de}. Un fil fin, presque invisible, part de la bourse vers un piège à mâchoires enfoui dans l'herbe. Tu le déclenches du bout de ton arme (CLAC !) et ramasses la bourse en toute sécurité : ${or} pièces d'or.` };
          },
        },
      ]
    : []),
  { libelle: "Passer ton chemin, c'est sûrement un piège", effet: () => ({ texte: 'Tu ne sauras jamais. Ça va te travailler toute la journée.' }) },
];

const BOURSE_SANS_DETECTER: Evenement = {
  id: 'bourse',
  titre: 'Une bourse dans le fossé',
  texte: 'La bourse est toujours là, au bord du chemin. Alors ?',
  suiteSeule: true,
  choix: CHOIX_BOURSE(false),
};

// L'écureuil blessé (proposition de Sedy) : un écureuil a vu des gobelins attaquer des elfes.
// Les compléments du MJ : n'importe qui peut aller voir d'où il vient (une heure à chercher),
// et laisser les elfes se faire écraser rapporte un peu… et se paie en réputation de salaud.
const ELFES_SYLVAINS: LigneRencontre = {
  d20: 0,
  rencontre: 'Elfes sylvains blessés',
  nombre: '2',
  nom: 'Elfes sylvains blessés',
  at: 10,
  prd: 9,
  ev: 10,
  pr: 2,
  degats: '1D+2',
  cou: 10,
  xp: 0,
  notes: 'Arc : 1D+2, AD : 13',
};

const ELFES_EN_DIFFICULTE: Evenement = {
  id: 'elfes-en-difficulte',
  titre: 'Les elfes en mauvaise posture',
  texte:
    "Dans une clairière, deux Elfes sylvains blessés, dos à un chêne, tiennent tête à quatre gobelins qui ricanent. Ils ont été pris par surprise : l'une a encore son arc, l'autre saigne beaucoup.",
  suiteSeule: true,
  choix: [
    {
      libelle: 'Aider les elfes',
      effet: () => ({
        texte: 'Tu sors des fourrés en hurlant. Les gobelins se retournent ; les elfes reprennent courage.',
        combat: {
          rencontre: { ligne: ligneEnnemi('Gobelin')!, nombre: 4, d20: 0, approche: 1, allies: [{ ligne: ELFES_SYLVAINS, nombre: 2 }] },
          victoire: (p) => {
            const deja = dansGroupe(p, 'elwyn');
            if (!deja) recruter(p, 'elwyn');
            return deja
              ? 'Les elfes te remercient en chantant (faux).'
              : "L'archère essuie sa flèche : « Elwyn Courtebranche. Je te dois la vie, et chez nous, ça se rembourse. Je viens avec toi. » Elwyn rejoint ton groupe.";
          },
        },
      }),
    },
    {
      libelle: "Attendre qu'ils se fassent écraser",
      effet: (p, rng) => {
        const or = lancer(6, rng) + lancer(6, rng);
        p.or += or;
        malConduire(p, 'elfes-abandonnes');
        return {
          texte: `Tu attends, caché. Les gobelins finissent par assommer les elfes, les dépouillent et repartent en chantant. Tu fouilles derrière eux : ${or} pièces d'or tombées d'une bourse. Les elfes, eux, se souviendront de ta tête.`,
          heures: 1,
        };
      },
    },
    { libelle: 'Ne pas s\'en mêler', effet: () => ({ texte: "Ce ne sont pas tes affaires. Tu fais demi-tour avant qu'on te voie." }) },
  ],
};

const RECIT_ECUREUIL: Evenement = {
  id: 'ecureuil-recit',
  titre: "Ce que dit l'écureuil",
  texte: "L'écureuil accepte de te raconter. Il parle vite, avec les pattes, et saute du coq à l'âne (et du gland à la noisette).",
  suiteSeule: true,
  choix: [
    {
      libelle: "Suivre son récit (épreuve d'Intelligence)",
      jet: { faces: 20, pour: "l'épreuve d'Intelligence", valeur: (p) => calculerFiche(p.perso).caracs.INT },
      effet: (p, rng) => {
        const e = epreuve(calculerFiche(p.perso).caracs.INT, rng);
        if (!e.reussi) return { texte: `Dé : ${e.de}. Tu comprends « gland », « méchant » et « pas content ». L'écureuil soupire et s'en va boiter ailleurs.` };
        return {
          texte: `Dé : ${e.de}. Tu comprends : il vient d'échapper à une rixe entre des gobelins et des elfes, tout près d'ici. Il t'indique la direction d'un coup de queue.`,
          suite: {
            id: 'ecureuil-direction',
            titre: "Ce que dit l'écureuil",
            texte: 'Des gobelins et des elfes, à deux pas. Que fais-tu ?',
            suiteSeule: true,
            choix: [
              { libelle: 'Se rendre sur les lieux', effet: () => ({ texte: 'Tu suis la direction indiquée, à pas de loup.', suite: ELFES_EN_DIFFICULTE }) },
              { libelle: 'Ne pas s\'en mêler', effet: () => ({ texte: "Les histoires d'elfes, ça finit toujours en chansons. Tu passes ton chemin." }) },
            ],
          },
        };
      },
    },
  ],
};

const connaissanceChampignons = (p: Partie) => savoir(p, 'nature') ?? savoir(p, 'cuisine');
const valeurChampignons = (p: Partie) =>
  calculerFiche(p.perso).caracs.INT + Math.max(bonusSituation(p, 'nature').total, bonusSituation(p, 'cuisine').total);

export const EVENEMENTS: Evenement[] = [
  {
    id: 'ecureuil',
    titre: 'Un écureuil blessé',
    texte: 'Non loin devant toi, un écureuil semble mal en point. Il boite, une oreille déchirée, et jette des regards inquiets derrière lui.',
    zones: ['foret'],
    choix: [
      { libelle: "L'ignorer et continuer", effet: () => ({ texte: "Un écureuil de plus ou de moins… Tu continues d'avancer." }) },
      {
        libelle: 'Tenter de comprendre ce qui lui arrive (Comprendre les animaux, épreuve de Charisme)',
        visible: (p) => aTalent(p, 'Comprendre les animaux'),
        jet: { faces: 20, pour: "l'épreuve de Charisme", valeur: (p) => valeursCombat(p).cha },
        effet: (p, rng) => {
          const e = epreuve(valeursCombat(p).cha, rng);
          if (!e.reussi) return { texte: `Dé : ${e.de}. L'écureuil te crache une coque de noisette au visage et file dans un arbre.` };
          return { texte: `Dé : ${e.de}. Tu t'accroupis et lui parles doucement. Il hésite, puis s'approche.`, suite: RECIT_ECUREUIL };
        },
      },
      {
        libelle: "Aller voir d'où il vient",
        effet: () => ({ texte: "Tu remontes ses traces (et les gouttes de sang) à travers les fourrés. Au bout d'une heure, des cris, des ricanements…", heures: 1, suite: ELFES_EN_DIFFICULTE }),
      },
    ],
  },
  {
    id: 'bourse',
    titre: 'Une bourse dans le fossé',
    texte: "Au bord du chemin, une petite bourse en cuir dépasse des herbes. Son propriétaire n'est visible nulle part. Ou alors il est très bien caché.",
    choix: CHOIX_BOURSE(true),
  },
  {
    id: 'colporteur',
    titre: 'Un colporteur',
    texte: 'Un petit homme courbé sous une hotte énorme te barre la route : « Potions, amulettes, chaussettes ! Tout doit disparaître, surtout moi avant la nuit ! »',
    choix: [
      {
        libelle: 'Acheter une potion de soin effet léger (35 PO)',
        possible: (p) => (p.or < 35 ? "Tu n'as pas assez d'or." : null),
        effet: (p) => {
          p.or -= 35;
          p.sac.push('potion-soin');
          return { texte: 'Un peu plus cher qu\'en ville, mais la fiole a l\'air authentique. Elle est dans ton sac.' };
        },
      },
      { libelle: 'Décliner poliment', effet: () => ({ texte: '« Tant pis pour vous ! » Il repart en cliquetant.' }) },
    ],
  },
  {
    id: 'nomades',
    titre: 'Le thé des nomades',
    texte: 'Des nomades ont planté une tente à l\'abri du vent. L\'un d\'eux te fait signe : « Assieds-toi, voyageur. Le thé est chaud et le désert est long. »',
    terrains: ['dunes', 'plaine'],
    choix: [
      {
        libelle: "S'asseoir une heure",
        effet: (p) => {
          const rendu = soigner(p, 2);
          return { texte: `Le thé à la menthe est brûlant et sucré à mourir. Tu repars requinqué${rendu ? ` (+${rendu} PV)` : ''}.`, heures: 1 };
        },
      },
      { libelle: "Remercier et continuer", effet: () => ({ texte: 'Ils haussent les épaules. Plus de thé pour eux.' }) },
    ],
  },
  {
    id: 'piege',
    titre: 'Un piège à loup',
    texte: 'Un claquement métallique sous ton pied ! Quelqu\'un a laissé un piège à loup au milieu du chemin.',
    choix: [
      {
        libelle: "Retirer ton pied à temps (épreuve d'Adresse)",
        jet: { faces: 20, pour: "l'épreuve d'Adresse", valeur: (p) => valeursCombat(p).ad },
        effet: (p, rng) => {
          const e = epreuve(valeursCombat(p).ad, rng);
          if (e.reussi) return { texte: `Dé : ${e.de}. Tu sautes en arrière, les mâchoires se referment sur le vide.` };
          const n = perdre(p, Math.max(1, lancerExpression('1D', rng).total));
          return { texte: `Dé : ${e.de}. Aïe ! Le piège te mord la cheville : −${n} PV. Tu boites un moment.`, heures: 0.5 };
        },
      },
    ],
  },
  {
    id: 'tempete',
    titre: 'Tempête de sable',
    texte: "Le vent se lève d'un coup. En quelques instants, on ne voit plus ses propres pieds, et le sable s'infiltre jusque dans les chaussettes.",
    terrains: ['dunes'],
    choix: [
      { libelle: "S'abriter derrière une dune (2 heures perdues)", effet: () => ({ texte: 'Tu attends, recroquevillé. La tempête finit par passer.', heures: 2 }) },
      {
        libelle: 'Avancer quand même (épreuve de Force)',
        jet: { faces: 20, pour: "l'épreuve de Force", valeur: (p) => calculerFiche(p.perso).caracs.FO },
        effet: (p, rng) => {
          const e = epreuve(calculerFiche(p.perso).caracs.FO, rng);
          if (e.reussi) return { texte: `Dé : ${e.de}. Tu avances courbé contre le vent, sans perdre de temps.` };
          const n = perdre(p, 2);
          return { texte: `Dé : ${e.de}. Le sable te fouette le visage et tu tournes en rond : −${n} PV et une heure perdue.`, heures: 1 };
        },
      },
    ],
  },
  {
    id: 'caravane',
    titre: 'Une caravane de Fierpâté',
    texte: "Trois chariots chargés de jambons et de fromages, escortés par des mercenaires qui s'ennuient. Le chef de caravane, un semi-homme rond comme une barrique, te salue.",
    choix: [
      {
        libelle: 'Lui acheter des rations (4 PO)',
        possible: (p) => (p.or < 4 ? "Tu n'as pas assez d'or." : null),
        effet: (p) => {
          p.or -= 4;
          p.sac.push('rations');
          return { texte: 'Il te vend deux repas et ajoute une tranche de saucisson « pour la route ». Elle ne passera pas la journée.' };
        },
      },
      {
        libelle: 'Lui demander des nouvelles de la région',
        effet: () => ({
          texte:
            "« Les grottes de Fariliik ? On les évite. Ces temps-ci, ça glousse là-dedans comme dans un poulailler. Des gobelins qui élèvent des poules, si c'est pas malheureux. »",
        }),
      },
    ],
  },
  {
    id: 'source',
    titre: 'Une source',
    texte: "Une petite source coule entre deux rochers. L'eau a l'air claire. Elle a aussi une légère odeur. Difficile de dire de quoi.",
    choix: [
      {
        libelle: 'Boire un coup',
        jet: { faces: 6, pour: 'voir ce que vaut cette eau (1 à 3 : bonne)' },
        effet: (p, rng) => {
          const d = lancer(6, rng);
          if (d <= 3) {
            const rendu = soigner(p, 1);
            return { texte: `Dé : ${d}. Fraîche et pure. ${rendu ? '+1 PV.' : 'Ça désaltère.'}` };
          }
          const n = perdre(p, 1);
          return { texte: `Dé : ${d}. Un arrière-goût de pied d'orque. Ton estomac proteste : −${n} PV.` };
        },
      },
      { libelle: 'Se méfier et garder sa soif', effet: () => ({ texte: 'Ta gourde fera l\'affaire.' }) },
    ],
  },
  {
    id: 'patrouille',
    titre: 'Une patrouille de Fort-Biluk',
    texte: '« Halte ! Contrôle des aventuriers ! Papiers, armes, et motif du voyage. » Le sergent a l\'air de chercher une raison de verbaliser.',
    terrains: ['sentier'],
    choix: [
      {
        libelle: 'Montrer patte blanche (épreuve de Charisme)',
        jet: { faces: 20, pour: "l'épreuve de Charisme", valeur: (p) => valeursCombat(p).cha },
        effet: (p, rng) => {
          const e = epreuve(valeursCombat(p).cha, rng);
          if (e.reussi) return { texte: `Dé : ${e.de}. « Bon, ça ira. Bonne route, et pas de grabuge. »` };
          const amende = Math.min(p.or, 5);
          p.or -= amende;
          return { texte: `Dé : ${e.de}. « Port d'arme sans formulaire B-12. Ce sera ${amende} PO d'amende. » Tu payes en serrant les dents.` };
        },
      },
    ],
  },
  {
    id: 'blesse',
    titre: 'Un voyageur blessé',
    texte: 'Un marchand est assis contre un arbre, la jambe en sang. « Des brigands… ils ont tout pris… sauf ma bourse, je l\'avais cachée dans ma chaussette. »',
    choix: [
      {
        libelle: 'Lui donner une potion de soin',
        possible: (p) => (p.sac.includes('potion-soin') || p.sac.includes('potion-soin-forte') || p.sac.includes('potion-plaies') ? null : "Tu n'as pas de potion."),
        effet: (p) => {
          for (const id of ['potion-plaies', 'potion-soin', 'potion-soin-forte']) if (retirer(p, id)) break;
          p.or += 20;
          return { texte: 'Il boit, se relève et te glisse 20 PO tièdes, sorties de la fameuse chaussette. « Que les dieux te le rendent ! »' };
        },
      },
      { libelle: 'Lui souhaiter bonne chance', effet: () => ({ texte: '« Merci… pour rien… » Tu entends encore ses gémissements au loin.' }) },
      {
        libelle: 'Le racketter : la bourse ou la vie (épreuve de Charisme)',
        jet: { faces: 20, pour: "l'épreuve de Charisme", valeur: (p) => valeursCombat(p).cha },
        effet: (p, rng) => {
          const e = epreuve(valeursCombat(p).cha, rng);
          if (e.reussi) {
            const or = lancerExpression('2D+10', rng).total;
            p.or += or;
            malConduire(p, 'marchand-rackette');
            return {
              texte: `Dé : ${e.de}. Il blêmit, sort la bourse de sa chaussette et te la lance : ${or} PO. « On se reverra, crapule. Je n'oublie jamais un visage. »`,
            };
          }
          return {
            texte: `Dé : ${e.de}. « Plutôt crever ! » Il attrape un bâton et se relève en grimaçant. Il est blessé, mais il va défendre sa bourse.`,
            combat: {
              rencontre: { ligne: MARCHAND_BLESSE, d20: 0, nombre: 1 },
              victoire: (p) => {
                const or = lancerExpression('2D+10', rng).total;
                p.or += or;
                malConduire(p, 'marchand-rackette', 2);
                return `Tu fouilles la chaussette du marchand inconscient : ${or} PO. Quelqu'un finira bien par le trouver… et par entendre son histoire.`;
              },
            },
          };
        },
      },
    ],
  },
  {
    id: 'vengeance',
    titre: 'Le marchand se souvient',
    texte: 'Une silhouette boiteuse te barre la route, flanquée de deux brutes. « Tiens, tiens. Je t\'avais dit qu\'on se reverrait. Les gars, c\'est lui. »',
    condition: (p) => aMarque(p, 'marchand-rackette'),
    prioritaire: true,
    choix: [
      {
        libelle: 'Rendre l\'argent, et un peu plus (30 PO)',
        possible: (p) => (p.or < 30 ? "Tu n'as pas assez d'or." : null),
        effet: (p) => {
          p.or -= 30;
          oterMarque(p, 'marchand-rackette');
          return { texte: '« Avec les intérêts. Bien. » Il compte les pièces, crache par terre et s\'en va. Les brutes ont l\'air déçues.' };
        },
      },
      {
        libelle: 'Se battre',
        effet: (p) => {
          oterMarque(p, 'marchand-rackette');
          return {
            texte: 'Le marchand recule à l\'abri d\'un arbre. Les deux brutes dégainent.',
            combat: { rencontre: brigands(2), victoire: () => 'Le marchand détale en boitant. Celui-là, tu ne le reverras plus.' },
          };
        },
      },
    ],
  },
  {
    id: 'champignons',
    titre: 'Des champignons',
    texte: 'Un cercle de gros champignons orange, très appétissants. Enfin, appétissants pour des champignons.',
    choix: [
      {
        libelle: "En manger quelques-uns",
        jet: { faces: 6, pour: 'voir ce que valent ces champignons (6 : délicieux, 1 ou 2 : aïe)' },
        effet: (p, rng) => {
          const d = lancer(6, rng);
          if (d <= 2) return { texte: `Dé : ${d}. Tu vois des licornes roses pendant une heure, puis tu vomis : −${perdre(p, 2)} PV.`, heures: 1 };
          if (d === 6) return { texte: `Dé : ${d}. Délicieux et nourrissant ! +${soigner(p, 3)} PV.` };
          return { texte: `Dé : ${d}. Ça a le goût de vieille éponge. Il ne se passe rien.` };
        },
      },
      {
        // Connaissances de la nature (+4), culinaires (+4) ou générales (+2) : on sait ce qu'on cueille.
        libelle: 'Les examiner (épreuve d\'Intelligence, avec tes connaissances)',
        visible: (p) => !!connaissanceChampignons(p),
        jet: { faces: 20, pour: "l'épreuve d'Intelligence", valeur: (p) => valeurChampignons(p) },
        effet: (p, rng) => {
          const e = epreuve(valeurChampignons(p), rng);
          if (!e.reussi)
            return { texte: `Dé : ${e.de}. Orange, rond, ça sent le champignon. Tu n'en sais pas plus. Mieux vaut ne pas y toucher, ou tenter ta chance.` };
          p.sac.push('champignons-orange');
          return {
            texte: `Dé : ${e.de}. Des chanterelles de Fangh, tout ce qu'il y a de comestible ! Tu en manges une poignée (+${soigner(p, 3)} PV) et tu en gardes un mouchoir plein.`,
          };
        },
      },
      {
        libelle: 'En ramasser, ça pourrait servir',
        effet: (p) => {
          p.sac.push('champignons-orange');
          return { texte: 'Tu en remplis un mouchoir. Un alchimiste ou un cuisinier saura peut-être quoi en faire. Ou un empoisonneur.' };
        },
      },
      { libelle: 'Ne pas y toucher', effet: () => ({ texte: 'Sage décision. Probablement.' }) },
    ],
  },
];

export const tirerEvenement = (terrain: Terrain, rng?: Rng, p?: Partie, zone?: Zone): Evenement => {
  const possibles = EVENEMENTS.filter(
    (e) => !e.suiteSeule && (!e.terrains || e.terrains.includes(terrain)) && (!e.zones || (!!zone && e.zones.includes(zone))) && (e.condition ? !!p && e.condition(p) : true),
  );
  const suites = possibles.filter((e) => e.prioritaire);
  if (suites.length && lancer(2, rng) === 1) return suites[lancer(suites.length, rng) - 1];
  const ordinaires = possibles.filter((e) => !e.prioritaire);
  return ordinaires[lancer(ordinaires.length, rng) - 1];
};

export type Controle = { type: 'rien' } | { type: 'rencontre' } | { type: 'evenement'; evenement: Evenement };

/**
 * Le supplément « Déplacements et transport » propose une rencontre par demi-journée en Terre de Fangh.
 * Le MJ vérifie toutes les 2 h 30 de marche (deux fois par demi-journée) : 1 sur un D6, rencontre hostile ;
 * 2, un événement ; sinon rien. La nuit, seule la rencontre hostile est possible.
 * Hors piste, les chances doublent : 1-2 rencontre, 3-4 événement.
 */
export const INTERVALLE_CONTROLE = 2.5;

export const controler = (terrain: Terrain, nuit: boolean, rng?: Rng, horsPiste = false, p?: Partie, zone?: Zone): Controle => {
  const d = lancer(6, rng);
  // Hors des routes, loin des patrouilles et des villages : rencontres et embûches deux fois plus probables.
  // En campagne paisible, une rencontre sur deux n'a finalement pas lieu.
  if (d === 1 || (horsPiste && d === 2)) return zone && TABLES[zone].paisible && lancer(2, rng) === 2 ? { type: 'rien' } : { type: 'rencontre' };
  if (!nuit && (horsPiste ? d <= 4 : d === 2)) return { type: 'evenement', evenement: tirerEvenement(terrain, rng, p, zone) };
  return { type: 'rien' };
};
