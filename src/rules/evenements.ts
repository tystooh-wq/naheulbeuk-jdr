import { calculerFiche } from './creation';
import { lancer, type Rng } from './des';
import type { Terrain } from './monde';
import { epreuve, lancerExpression, soigner, valeursCombat, type Partie } from './partie';

// Événements écrits pour les routes autour de Waldorg. Ils ne viennent pas des règles officielles :
// ce sont les « surprises » du MJ, bonnes ou mauvaises, tirées au hasard pendant le voyage.

export interface Resultat {
  texte: string;
  /** Heures perdues (ou gagnées) sur le trajet. */
  heures?: number;
}

export interface Choix {
  libelle: string;
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
  choix: Choix[];
}

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
    ],
  },
  {
    id: 'champignons',
    titre: 'Des champignons',
    texte: 'Un cercle de gros champignons orange, très appétissants. Enfin, appétissants pour des champignons.',
    choix: [
      {
        libelle: "En manger quelques-uns",
        effet: (p, rng) => {
          const d = lancer(6, rng);
          if (d <= 2) return { texte: `Dé : ${d}. Tu vois des licornes roses pendant une heure, puis tu vomis : −${perdre(p, 2)} PV.`, heures: 1 };
          if (d === 6) return { texte: `Dé : ${d}. Délicieux et nourrissant ! +${soigner(p, 3)} PV.` };
          return { texte: `Dé : ${d}. Ça a le goût de vieille éponge. Il ne se passe rien.` };
        },
      },
      { libelle: 'Ne pas y toucher', effet: () => ({ texte: 'Sage décision. Probablement.' }) },
    ],
  },
];

export const tirerEvenement = (terrain: Terrain, rng?: Rng): Evenement => {
  const possibles = EVENEMENTS.filter((e) => !e.terrains || e.terrains.includes(terrain));
  return possibles[lancer(possibles.length, rng) - 1];
};

export type Controle = { type: 'rien' } | { type: 'rencontre' } | { type: 'evenement'; evenement: Evenement };

/**
 * Le supplément « Déplacements et transport » propose une rencontre par demi-journée en Terre de Fangh.
 * Le MJ vérifie toutes les 2 h 30 de marche (deux fois par demi-journée) : 1 sur un D6, rencontre hostile ;
 * 2, un événement ; sinon rien. La nuit, seule la rencontre hostile est possible.
 */
export const INTERVALLE_CONTROLE = 2.5;

export const controler = (terrain: Terrain, nuit: boolean, rng?: Rng): Controle => {
  const d = lancer(6, rng);
  if (d === 1) return { type: 'rencontre' };
  if (d === 2 && !nuit) return { type: 'evenement', evenement: tirerEvenement(terrain, rng) };
  return { type: 'rien' };
};
