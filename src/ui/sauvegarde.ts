import type { Personnage } from '../rules/creation';
import type { Partie } from '../rules/partie';

const CLE_PERSO = 'naheulbeuk.personnage';
const CLE_PARTIE = 'naheulbeuk.partie';

// Le stockage du navigateur peut être indisponible (navigation privée, aperçu) : le jeu doit rester jouable.

const ecrire = (cle: string, valeur: unknown): boolean => {
  try {
    localStorage.setItem(cle, JSON.stringify(valeur));
    return true;
  } catch {
    return false;
  }
};

const lire = <T>(cle: string): T | null => {
  try {
    const brut = localStorage.getItem(cle);
    return brut ? (JSON.parse(brut) as T) : null;
  } catch {
    return null;
  }
};

const effacer = (cle: string) => {
  try {
    localStorage.removeItem(cle);
  } catch {
    // Rien à effacer si le stockage est indisponible.
  }
};

/** Un nouveau héros remplace l'ancien et sa partie. */
export const sauvegarder = (p: Personnage): boolean => {
  effacer(CLE_PARTIE);
  return ecrire(CLE_PERSO, p);
};

export const charger = (): Personnage | null => {
  const p = lire<Personnage>(CLE_PERSO);
  return p?.version === 1 ? p : null;
};

export const sauvegarderPartie = (p: Partie): boolean => ecrire(CLE_PARTIE, p);

export const chargerPartie = (): Partie | null => {
  const p = lire<Partie>(CLE_PARTIE);
  return p?.version === 2 ? p : null;
};
