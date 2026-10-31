/** Les actions qu'on pourrait répéter à l'infini (crocheter, fouiller les murs, s'évader) : après trop de ratés, il faut attendre. */
import { formatHeure, type Partie } from './partie';

/** L'heure absolue (jour × 24 + heure). */
export const maintenant = (p: Partie) => p.jour * 24 + p.heure;

/** Si l'action est en pause, l'heure absolue à laquelle on pourra la retenter. */
export const pauseEssai = (p: Partie, cle: string): number | null => {
  const t = p.donjon?.essais?.[cle]?.jusqu;
  return t !== undefined && t > maintenant(p) + 1e-6 ? t : null;
};

/** « à 14 h 30 », « demain à 9 h »… */
export const quandReessayer = (p: Partie, t: number) => {
  const jours = Math.floor(t / 24) - p.jour;
  const h = formatHeure(t % 24);
  return jours <= 0 ? `à ${h}` : jours === 1 ? `demain à ${h}` : `dans ${jours} jours, à ${h}`;
};

/** Un essai raté : au bout de `max` ratés d'affilée, l'action est en pause pendant `heures`. */
export const rater = (p: Partie, cle: string, max: number, heures: number): number | null => {
  const essais = (p.donjon!.essais ??= {});
  const n = (essais[cle]?.rates ?? 0) + 1;
  if (n >= max) {
    essais[cle] = { rates: 0, jusqu: maintenant(p) + heures };
    return essais[cle].jusqu!;
  }
  essais[cle] = { rates: n };
  return null;
};

export const reussir = (p: Partie, cle: string) => {
  if (p.donjon?.essais) delete p.donjon.essais[cle];
};

