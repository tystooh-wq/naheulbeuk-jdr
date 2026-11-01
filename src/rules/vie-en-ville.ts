// La vie des compagnons en ville (choix maison) : quand le groupe est en ville, chacun vaque à ses occupations.
// Blessé, il va se faire soigner ; le soir, il est à la taverne ; la nuit, il dort à l'auberge ; le jour,
// il fait les boutiques ou traîne au marché. Certains ont leurs habitudes (Gaston aide ses parents à Valtordu).
// Ce qu'ils font compte : les soins leur rendent des PV, une bonne soirée plaît aux gourmands.
import type { Cite } from './cites';
import { apprecier, compagnon, groupe } from './compagnons';
import { maintenant } from './essais';
import type { EtatCompagnon, Partie } from './partie';
import type { Lieu, TypeLieu } from './waldorg';

export type Activite = 'soins' | 'taverne' | 'boutique' | 'famille' | 'dort';

export interface Occupation {
  lieu: Lieu;
  activite: Activite;
  /** « se fait soigner », « aide ses parents à la boucherie »… */
  texte: string;
}

const hacher = (s: string) => {
  let h = 2166136261;
  for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
};

/** PV rendus par heure passée chez le guérisseur (il paie de sa poche). */
export const SOIN_PAR_HEURE = 3;

/** Ses habitudes : un lieu précis, à certaines heures, dans une ville donnée. */
const HABITUDES: { id: string; ville: string; lieu: string; de: number; a: number; texte: string }[] = [
  { id: 'gaston', ville: 'valtordu', lieu: 'boucherie-jobard', de: 8, a: 18, texte: 'aide ses parents à la boucherie (et goûte le boudin)' },
];

/** Où est ce compagnon, et ce qu'il y fait, à cette heure-là (jour et heure donnés). */
export const occupationA = (e: EtatCompagnon, c: Cite, jour: number, heure: number): Occupation | null => {
  const d = compagnon(e.id);
  const de = (types: TypeLieu[]) => c.lieux.filter((l) => types.includes(l.type));
  // Il ne change pas d'avis toutes les heures : le choix tient pour une tranche de la journée.
  const choisir = (ls: Lieu[], tranche: string) => (ls.length ? ls[hacher(`${e.id}:${tranche}:${Math.floor(jour)}`) % ls.length] : undefined);
  const gourmand = d.valeurs.includes('gourmand');
  if (e.ev < e.evMax && heure >= 8 && heure < 20) {
    const l = choisir(de(['soins']), 'soins');
    if (l) return { lieu: l, activite: 'soins', texte: `se fait soigner (${e.ev}/${e.evMax} PV)` };
  }
  if (heure >= 23 || heure < 7) {
    const l = choisir(de(['auberge']), 'nuit') ?? choisir(de(['bar']), 'nuit');
    return l ? { lieu: l, activite: 'dort', texte: 'dort comme un loir' } : null;
  }
  const habitude = HABITUDES.find((x) => x.id === e.id && x.ville === c.id && heure >= x.de && heure < x.a);
  const lieuHabitude = habitude && c.lieux.find((l) => l.id === habitude.lieu);
  if (habitude && lieuHabitude) return { lieu: lieuHabitude, activite: 'famille', texte: habitude.texte };
  if (heure >= 18) {
    const l = choisir(de(gourmand ? ['auberge', 'bar'] : ['bar', 'auberge']), 'soir');
    if (l) return { lieu: l, activite: 'taverne', texte: gourmand ? 'dîne copieusement et boit un coup' : 'boit un coup en écoutant les ragots' };
  }
  const l = choisir(de(['boutique', 'marche']), `jour${Math.floor(heure / 3)}`) ?? choisir(de(['bar', 'auberge']), 'jour');
  if (!l) return null;
  return { lieu: l, activite: 'boutique', texte: l.type === 'marche' ? 'flâne au marché' : 'fait les boutiques (et marchande pour la forme)' };
};

export const occupation = (p: Partie, e: EtatCompagnon, c: Cite) => occupationA(e, c, p.jour, p.heure);

/**
 * Le temps a passé en ville : chacun a vécu sa vie. Renvoie les lignes à montrer (appréciation qui change).
 * On rejoue heure par heure depuis la dernière fois (48 heures au plus).
 */
export const vivreEnVille = (p: Partie, c: Cite): string[] => {
  const t = maintenant(p);
  const avant = p.vieVille?.ville === c.id ? p.vieVille.t : t;
  p.vieVille = { ville: c.id, t };
  const lignes: string[] = [];
  for (let h = Math.max(avant, t - 48); h + 1 <= t + 1e-6; h += 1) {
    const jour = Math.floor(h / 24);
    const heure = h - jour * 24;
    for (const e of groupe(p)) {
      const o = occupationA(e, c, jour, heure);
      if (o?.activite === 'soins') e.ev = Math.min(e.evMax, e.ev + SOIN_PAR_HEURE);
      if (o?.activite === 'taverne' && compagnon(e.id).valeurs.includes('gourmand') && e.soiree !== jour) {
        e.soiree = jour;
        const l = apprecier(p, e, 1, 'une bonne soirée à la taverne');
        if (l) lignes.push(l);
      }
    }
  }
  return lignes;
};

/** Quand le groupe quitte la ville, on repart de zéro la prochaine fois. */
export const quitterVieVille = (p: Partie) => {
  p.vieVille = undefined;
};
