import type { Idee } from './idees';

// Idées des joueurs écrites pour de bon dans le jeu (30/10). Elles se jouent comme les idées validées
// (bouton dans le lieu, épreuve au D20 lancée par le joueur), avec leurs conséquences complètes.
// D'autres idées intégrées vivent directement dans les règles : la source de Fariliik (donjons.ts),
// « embrouiller » l'ogre (rencontres.ts), la bourse piégée et l'écureuil blessé (evenements.ts).

const date = '2026-10-30T12:00:00.000Z';

export const IDEES_JEU: Idee[] = [
  {
    id: 'jeu:chateau-presenter',
    contexte: { type: 'lieu', id: 'valtordu:chateau', titre: 'Château de Valtordu (Valtordu)' },
    texte: 'Se présenter au seigneur local',
    date,
    statut: 'validee',
    libelle: 'Se présenter au seigneur Hubert Jeanfort',
    epreuve: 'CHA',
    reussite:
      "Le majordome t'annonce. Hubert Jeanfort, en pantoufles, t'offre un verre de cidre et t'écoute raconter tes exploits (en partie inventés). « Valtordu a besoin de gens comme vous. Enfin, peut-être. » Églantine, la fille du guérisseur, te sourit en passant.",
    echec:
      "Le majordome te toise de la tête aux pieds, s'attarde sur tes bottes, et referme la porte. « Monsieur ne reçoit pas les gens qui sentent le boudin. » Tu as perdu une heure à attendre dans le vestibule.",
    xpReussite: 5,
    heuresReussite: 1,
    heuresEchec: 1,
    reputation: { ville: 'valtordu', reussite: 1 },
    uneFois: true,
  },
  {
    id: 'jeu:chateau-infiltrer',
    contexte: { type: 'lieu', id: 'valtordu:chateau', titre: 'Château de Valtordu (Valtordu)' },
    texte: "Tenter d'infiltrer les quartiers privés",
    date,
    statut: 'validee',
    libelle: 'Se glisser dans les quartiers privés',
    epreuve: 'AD',
    modif: -2,
    situation: 'vol',
    reussite:
      "Un couloir, une tapisserie, une porte mal fermée : le bureau du seigneur. Dans un tiroir, une bourse oubliée et une fiole de soin. Personne ne t'a vu. Enfin, tu crois.",
    echec:
      "Églantine te surprend la main sur une poignée. Elle crie, le sargent Melchior arrive avec deux gardes, et tu ressors du château plus vite que tu n'y es entré, à coups de hampe de hallebarde. Tout Valtordu le saura avant ce soir.",
    orReussite: 30,
    objetsReussite: ['potion-soin'],
    pvEchec: -3,
    malConduite: 1,
    reputation: { ville: 'valtordu', echec: -2 },
    uneFois: true,
  },
];
