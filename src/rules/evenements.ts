import { calculerFiche } from './creation';
import { lancer, type Rng } from './des';
import type { Terrain } from './monde';
import { epreuve, lancerExpression, soigner, valeursCombat, type Partie } from './partie';
import { TABLE_TERRES_SAUVAGES, type LigneRencontre, type Rencontre } from './rencontres';

// Événements écrits pour les routes autour de Waldorg. Ils ne viennent pas des règles officielles :
// ce sont les « surprises » du MJ, bonnes ou mauvaises, tirées au hasard pendant le voyage.

export interface Resultat {
  texte: string;
  /** Heures perdues (ou gagnées) sur le trajet. */
  heures?: number;
  /** L'événement tourne à la bagarre : le combat suit, puis `victoire` s'applique si le héros gagne. */
  combat?: { rencontre: Rencontre; victoire?: (p: Partie) => string };
}

export interface Choix {
  libelle: string;
  /** Le joueur lance lui-même ce dé avant que l'effet ne s'applique (c'est le premier dé de `effet`). */
  jet?: { faces: 6 | 20; pour: string; valeur?: (p: Partie) => number };
  /** Raison pour laquelle ce choix est impossible, ou null. */
  possible?: (p: Partie) => string | null;
  effet: (p: Partie, rng?: Rng) => Resultat;
}

export interface Evenement {
  id: string;
  titre: string;
  texte: string;
  /** Terrains où il peut arriver (tous par défaut). */
  terrains?: Terrain[];
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

export const EVENEMENTS: Evenement[] = [
  {
    id: 'bourse',
    titre: 'Une bourse dans le fossé',
    texte: "Au bord du chemin, une petite bourse en cuir dépasse des herbes. Son propriétaire n'est visible nulle part. Ou alors il est très bien caché.",
    choix: [
      {
        libelle: 'La ramasser',
        jet: { faces: 6, pour: "compter les pièces d'or" },
        effet: (p, rng) => {
          const or = lancer(6, rng);
          p.or += or;
          return { texte: `Elle contient ${or} pièces d'or et un bouton de culotte. Tu gardes les deux.` };
        },
      },
      { libelle: "Passer ton chemin, c'est sûrement un piège", effet: () => ({ texte: 'Tu ne sauras jamais. Ça va te travailler toute la journée.' }) },
    ],
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

export const tirerEvenement = (terrain: Terrain, rng?: Rng, p?: Partie): Evenement => {
  const possibles = EVENEMENTS.filter((e) => (!e.terrains || e.terrains.includes(terrain)) && (e.condition ? !!p && e.condition(p) : true));
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

export const controler = (terrain: Terrain, nuit: boolean, rng?: Rng, horsPiste = false, p?: Partie): Controle => {
  const d = lancer(6, rng);
  // Hors des routes, loin des patrouilles et des villages : rencontres et embûches deux fois plus probables.
  if (d === 1 || (horsPiste && d === 2)) return { type: 'rencontre' };
  if (!nuit && (horsPiste ? d <= 4 : d === 2)) return { type: 'evenement', evenement: tirerEvenement(terrain, rng, p) };
  return { type: 'rien' };
};
