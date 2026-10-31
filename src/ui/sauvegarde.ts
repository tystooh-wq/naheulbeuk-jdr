import { objet } from '../rules/objets';
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
  const p = lire<Partie | (Omit<Partie, 'version' | 'heure' | 'zone' | 'lieuMonde'> & { version: 2 })>(CLE_PARTIE);
  // Version 2 : avant la carte du monde, on était forcément dans Waldorg.
  if (p?.version === 2) return nettoyer({ ...p, version: 3, heure: 9, zone: 'ville', lieuMonde: 'waldorg' });
  return p?.version === 3 ? nettoyer(p) : null;
};

/** Un objet qui n'existe plus dans le jeu (renommé, retiré) ne doit pas faire planter le sac. */
const existe = (id: string) => {
  try {
    objet(id);
    return true;
  } catch {
    return false;
  }
};
const nettoyer = (p: Partie): Partie => {
  p.sac = (p.sac ?? []).filter(existe);
  for (const k of Object.keys(p.equipe ?? {}) as (keyof Partie['equipe'])[]) if (p.equipe[k] && !existe(p.equipe[k]!)) p.equipe[k] = undefined;
  return p;
};

/** Fin de l'aventure : le héros et sa partie disparaissent. */
export const effacerTout = () => {
  effacer(CLE_PARTIE);
  effacer(CLE_PERSO);
};
