import { noter, type Partie } from './partie';

// Réputation du héros dans chaque ville, de −10 (honni) à +10 (héros du coin).
// Les quêtes rendues la font monter ; les vols, rackets et coups fourrés la font baisser.

export const REPUTATION_MIN = -10;
export const REPUTATION_MAX = 10;

export interface Rang {
  nom: string;
  /** Ce que la réputation change, en une phrase. */
  effet: string;
}

export const reputation = (p: Partie, ville: string) => p.reputation?.[ville] ?? 0;

export const rangReputation = (n: number): Rang =>
  n <= -6
    ? { nom: 'Honni', effet: 'Les commerçants te font payer 20 % de plus et personne ne te confie de quête.' }
    : n <= -2
    ? { nom: 'Mal vu', effet: 'Les commerçants te font payer 10 % de plus.' }
    : n < 2
    ? { nom: 'Inconnu', effet: 'Un étranger parmi d\'autres : prix normaux.' }
    : n < 6
    ? { nom: 'Apprécié', effet: 'Les commerçants te font 5 % de remise.' }
    : { nom: 'Héros du coin', effet: 'Les commerçants te font 10 % de remise.' };

/** Coefficient appliqué aux prix des boutiques de la ville. */
export const facteurPrix = (n: number) => (n <= -6 ? 1.2 : n <= -2 ? 1.1 : n < 2 ? 1 : n < 6 ? 0.95 : 0.9);

/** Plus personne ne confie de quête à un héros honni. */
export const quetesRefusees = (p: Partie, ville: string) => reputation(p, ville) <= -6;

/** Ville d'un lieu noté « ville:valtordu:forge » (ou null hors des villes). */
export const villeDe = (ou: string) => (ou.startsWith('ville:') ? ou.split(':')[1] : null);

/** Fait varier la réputation et le note au journal. Rend le changement réel (borné). */
export const changerReputation = (p: Partie, ville: string, delta: number, raison: string) => {
  const avant = reputation(p, ville);
  const apres = Math.max(REPUTATION_MIN, Math.min(REPUTATION_MAX, avant + delta));
  if (apres === avant) return 0;
  p.reputation = { ...(p.reputation ?? {}), [ville]: apres };
  const nomVille = ville.charAt(0).toUpperCase() + ville.slice(1);
  noter(p, `réputation à ${nomVille} ${apres > avant ? '+' : ''}${apres - avant} (${raison}).`);
  return apres - avant;
};
