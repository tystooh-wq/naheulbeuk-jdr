import type { Personnage } from '../rules/creation';

const CLE = 'naheulbeuk.personnage';

// Le stockage du navigateur peut être indisponible (navigation privée, aperçu) : le jeu doit rester jouable.

export const sauvegarder = (p: Personnage): boolean => {
  try {
    localStorage.setItem(CLE, JSON.stringify(p));
    return true;
  } catch {
    return false;
  }
};

export const charger = (): Personnage | null => {
  try {
    const brut = localStorage.getItem(CLE);
    if (!brut) return null;
    const p = JSON.parse(brut) as Personnage;
    return p.version === 1 ? p : null;
  } catch {
    return null;
  }
};
