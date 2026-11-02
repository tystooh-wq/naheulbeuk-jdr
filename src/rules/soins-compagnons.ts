// Les blessures graves des compagnons, soignées en grande ville (choix maison, à valider par Sedy) :
// - en arrivant dans une grande ville, chaque compagnon blessé passe chez le guérisseur et paie de sa bourse ;
// - s'il n'a pas assez, il demande au groupe : chacun donne selon son goût pour l'or (le cupide rien, le bon cœur
//   la moitié de sa bourse) ; le héros complète le reste, ou le laisse avec ses blessures (il ne redemande pas le même jour).
import { appliquerSoin, soinsDe, SPECIALISTES, type SoinGrave } from './chirurgie';
import type { Cite } from './cites';
import { apprecier, appetit, blessuresCompagnon, bourseDe, compagnon, groupe, prenom } from './compagnons';
import { arrondirOr } from './monnaie';
import { noter, type EtatCompagnon, type Partie } from './partie';

/** Les grandes villes : on y trouve un guérisseur digne de ce nom (les villages n'en ont pas le savoir-faire). */
export const GRANDES_VILLES = ['waldorg', 'glargh', 'tulamor', 'kjaniouf', 'chnafon', 'jambfer', 'mliuej'];

export interface Don {
  id: string;
  montant: number;
}

/** Un compagnon qui n'a pas de quoi payer ses soins : ce qu'il a, ce que donnent les autres, ce qu'il manque. */
export interface DemandeSoin {
  id: string;
  soins: SoinGrave[];
  prix: number;
  lieu: string;
  /** Ce qu'il met lui-même (toute sa bourse). */
  sienne: number;
  dons: Don[];
  /** Ce que le héros doit ajouter. */
  reste: number;
}

/** La part de sa bourse qu'un compagnon donne pour les soins d'un autre. */
export const generosite = (e: EtatCompagnon) => {
  const v = compagnon(e.id).valeurs;
  if (v.includes('cupide')) return 0;
  if (v.includes('bonte')) return 0.5;
  if (v.includes('honneur')) return 0.3;
  return appetit(e) > 0 ? 0.1 : 0.2;
};

/** Le guérisseur de la ville : la clinique qui recolle les membres s'il y en a une, sinon le premier venu. */
const guerisseur = (c: Cite) => {
  const special = c.lieux.find((l) => SPECIALISTES.some((s) => s.ou === `${c.id}:${l.id}`));
  const l = special ?? c.lieux.find((x) => x.type === 'soins' && x.prixSoin);
  return l ? { lieu: l, ou: `${c.id}:${l.id}`, prixSoin: l.prixSoin ?? 2 } : undefined;
};

const soigner = (p: Partie, e: EtatCompagnon, soins: SoinGrave[]) => {
  // Du dernier au premier : réparer retire la blessure de la liste sans décaler les suivantes.
  for (const s of [...soins].sort((a, b) => b.index - a.index)) e.blessures = appliquerSoin(e.blessures ?? [], s, p.jour);
  noter(p, `${prenom(e.id)} fait soigner : ${soins.map((s) => s.nom.toLowerCase()).join(', ')}.`);
};

const texteSoins = (soins: SoinGrave[]) => soins.map((s) => `${s.nom.toLowerCase()} (${s.type === 'reparer' ? 'recollé' : 'remis en place'})`).join(', ');

/**
 * En arrivant dans une grande ville : ceux qui peuvent payer se font soigner tout de suite ;
 * les autres font une demande au groupe (ou y arrivent grâce aux dons des copains).
 */
export const soinsEnVille = (p: Partie, c: Cite): { lignes: string[]; demandes: DemandeSoin[] } => {
  const lignes: string[] = [];
  const demandes: DemandeSoin[] = [];
  if (!GRANDES_VILLES.includes(c.id)) return { lignes, demandes };
  const g = guerisseur(c);
  if (!g) return { lignes, demandes };
  for (const e of groupe(p)) {
    const blessures = blessuresCompagnon(p, e);
    if (!blessures.length || e.soinRefuse === p.jour) continue;
    const { possibles } = soinsDe(blessures, p.jour, g.ou, g.prixSoin);
    if (!possibles.length) continue;
    const prix = possibles.reduce((s, x) => s + x.prix, 0);
    const bourse = bourseDe(e);
    if (bourse >= prix) {
      e.bourse = arrondirOr(bourse - prix);
      soigner(p, e, possibles);
      lignes.push(`${prenom(e.id)} file chez le guérisseur (${g.lieu.nom}) et paie ${prix} PO de sa bourse : ${texteSoins(possibles)}.`);
      continue;
    }
    // Pas assez : il vide sa bourse et fait passer le chapeau.
    let manque = prix - bourse;
    const dons: Don[] = [];
    for (const o of groupe(p)) {
      if (o.id === e.id || manque <= 0) continue;
      const montant = Math.min(manque, Math.floor(bourseDe(o) * generosite(o)));
      dons.push({ id: o.id, montant });
      manque -= montant;
    }
    const demande: DemandeSoin = { id: e.id, soins: possibles, prix, lieu: g.lieu.nom, sienne: bourse, dons, reste: Math.max(0, arrondirOr(manque)) };
    if (demande.reste === 0) {
      lignes.push(payerSoins(p, demande));
      continue;
    }
    demandes.push(demande);
  }
  return { lignes, demandes };
};

/** Tout le monde paie sa part (le héros, le reste) et le compagnon est soigné. Renvoie le récit. */
export const payerSoins = (p: Partie, d: DemandeSoin): string => {
  if (p.or < d.reste) return `Il te manque ${arrondirOr(d.reste - p.or)} PO.`;
  const e = groupe(p).find((x) => x.id === d.id);
  if (!e) return '';
  p.or = arrondirOr(p.or - d.reste);
  e.bourse = Math.max(0, arrondirOr(bourseDe(e) - d.sienne));
  for (const don of d.dons) {
    const o = groupe(p).find((x) => x.id === don.id);
    if (o) o.bourse = Math.max(0, arrondirOr(bourseDe(o) - don.montant));
  }
  soigner(p, e, d.soins);
  const donneurs = d.dons.filter((x) => x.montant > 0).map((x) => `${prenom(x.id)} ${x.montant} PO`);
  const merci = d.reste > 0 ? apprecier(p, e, 2, 'tu as payé ses soins') : '';
  return `${prenom(e.id)} file chez le guérisseur, ${d.lieu} (${d.prix} PO : ${[`lui ${d.sienne} PO`, ...donneurs, ...(d.reste ? [`toi ${d.reste} PO`] : [])].join(', ')}) : ${texteSoins(d.soins)}.${merci ? ` ${merci}` : ''}`;
};

/** Le héros ne complète pas : le compagnon garde ses blessures, et il s'en souvient. */
export const refuserSoins = (p: Partie, d: DemandeSoin): string => {
  const e = groupe(p).find((x) => x.id === d.id);
  if (!e) return '';
  e.soinRefuse = p.jour;
  return apprecier(p, e, -1, 'tu ne l\'as pas aidé à payer ses soins') || `${prenom(e.id)} garde ses blessures.`;
};
