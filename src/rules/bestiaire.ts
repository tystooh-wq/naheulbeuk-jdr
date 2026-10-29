import DONNEES from './bestiaire.json';

// Bestiaire tiré des tableaux officiels « Les monstres en Terre de Fangh » (V3.0) et
// « Humains et rencontres urbaines » (V2.0), avec les fiches du Guide des monstres succinct (V2.5).
// Généré par scripts/bestiaire.py. Les valeurs restent du texte : certaines sont « * » ou « 10 à 60 ».

export interface Creature {
  nom: string;
  niveau: string;
  famille: string;
  at: string;
  prd: string;
  ev: string;
  pr: string;
  degats: string;
  cou: string;
  xp: string;
  notes: string[];
  /** Titre de la fiche du guide succinct qui la décrit. */
  fiche?: string;
}

export const CREATURES = DONNEES.creatures as Creature[];
export const FICHES = DONNEES.fiches as Record<string, string>;

export const creature = (nom: string): Creature => {
  const c = CREATURES.find((x) => x.nom === nom);
  if (!c) throw new Error(`Créature inconnue : ${nom}`);
  return c;
};
