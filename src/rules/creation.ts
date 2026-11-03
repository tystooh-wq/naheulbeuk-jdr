import competencesData from './competences.json';
import { METIERS, SANS_METIER } from './metiers';
import { ORIGINES } from './origines';
import { CARACS, NOM_CARAC, type Carac, type Criteres, type Metier, type Origine, type Scores } from './types';
import { VILLE_DEPART } from './villes';

// Règles de création du personnage, d'après les règles de base V4 (chapitre 2)
// et le livret des origines et métiers V3.2.

export interface Competence {
  nom: string;
  stat: string;
  texte: string;
}

const COMPETENCES = competencesData as Record<string, { stat: string; texte: string }>;

/** Les compétences génériques sont celles listées avant « Agile » dans le livret. */
const NOMS_COMPETENCES = Object.keys(COMPETENCES);
const COMPETENCES_GENERIQUES = NOMS_COMPETENCES.slice(0, NOMS_COMPETENCES.indexOf('AGILE'));

const ALIAS: Record<string, string> = {
  'ARMES DE BOURRIN': 'ARMES DE BOURRIN',
  'ARME DE BOURRIN': 'ARMES DE BOURRIN',
  'ARNAQUES ET CARAMBOUILLE': 'ARNAQUE ET CARAMBOUILLE',
  'BOURRE PIF': 'BOURRE-PIF',
  'RUNE BIZARRE': 'RUNES BIZARRES',
  'LANGUE DES MONSTRES': 'LANGUES DES MONSTRES',
  'VENTRE SUR PATTE': 'VENTRE SUR PATTES',
  "J'AI LE BRAS LONG": 'J’AI LE BRAS LONG',
  "CONTACT DANS L'IMPORT-EXPORT": 'CONTACT DANS L’IMPORT-EXPORT',
};

export const cleCompetence = (nom: string): string => {
  const cle = nom.toUpperCase().trim();
  return ALIAS[cle] ?? cle;
};

export const trouverCompetence = (nom: string): Competence => {
  const data = COMPETENCES[cleCompetence(nom)];
  return { nom, stat: data?.stat ?? '', texte: data?.texte ?? 'Description à venir.' };
};

/** Retire les compétences en double (une origine et un métier peuvent donner la même). */
export const sansDoublons = (noms: string[]): string[] => {
  const vus = new Set<string>();
  return noms.filter((n) => !vus.has(cleCompetence(n)) && !!vus.add(cleCompetence(n)));
};

const titre = (cle: string) => cle.charAt(0) + cle.slice(1).toLowerCase();

export const competencesGeneriques = (): string[] => COMPETENCES_GENERIQUES.map(titre);

export const toutesCompetences = (): string[] => NOMS_COMPETENCES.map(titre);

// --- Caractéristiques -------------------------------------------------------

/** Vérifie des critères de création. Renvoie la liste des raisons de refus (vide = autorisé). */
export const verifierCriteres = (scores: Scores, criteres: Criteres): string[] => {
  const raisons: string[] = [];
  for (const c of CARACS) {
    const borne = criteres[c];
    if (!borne) continue;
    if (borne.min !== undefined && scores[c] < borne.min) raisons.push(`${NOM_CARAC[c]} ${borne.min} minimum`);
    if (borne.max !== undefined && scores[c] > borne.max) raisons.push(`${NOM_CARAC[c]} ${borne.max} maximum`);
  }
  return raisons;
};

export const raisonsOrigine = (jets: Scores, origine: Origine): string[] => verifierCriteres(jets, origine.criteres);

export const raisonsMetier = (scores: Scores, origine: Origine, metier: Metier): string[] => {
  const raisons = verifierCriteres(scores, metier.criteres);
  if (metier.magique && origine.sansMagie) raisons.push(`un ${origine.nom} ne pratique pas la magie`);
  if (metier.pretrise && origine.sansPretrise) raisons.push(`un ${origine.nom} ne peut pas entrer en prêtrise`);
  return raisons;
};

// --- Le personnage ----------------------------------------------------------

export type Sexe = 'Homme' | 'Femme';

export interface Ajustements {
  /** Adresse > 12 (bonus) ou ≤ 8 (malus) : à appliquer sur l'AT ou la PRD. */
  adresse?: 'AT' | 'PRD';
  guerrierEchange?: 'aucun' | 'AT>PRD' | 'PRD>AT';
  guerrierBonus?: 'AT' | 'PRD';
  retrait?: 'AT' | 'PRD';
  ajout?: Carac;
  rangerDe?: Carac;
  rangerVers?: Carac;
  ogreAT?: number;
  ogrePRD?: number;
}

export interface Personnage {
  version: 1;
  nom: string;
  sexe: Sexe;
  jets: Scores;
  origineId: string;
  /** Homme-Bête : index de la version tirée au D6 (0 à 5). */
  versionHB?: number;
  metierId: string;
  competencesChoisies: string[];
  ajustements: Ajustements;
  destin: number;
  or: number;
  /** Détail des jets de fortune, pour l'affichage. */
  jetsOr: number[][];
  /** Gains des passages de niveau (règles V4, 15). */
  progression?: Progression;
  /** Mage : ses spécialités (grimoires) ; prêtre et paladin : le manuel de son dieu (voir grimoires.ts). */
  magie?: { ecoles: string[] };
}

export interface Progression {
  niveau: number;
  /** EV gagnée (1D6 par niveau). */
  ev: number;
  /** EA gagnée : à chaque niveau, le D6 va à l'EV ou à l'EA, au choix (règles V4, 15). */
  ea?: number;
  /** Points ajoutés aux caractéristiques (niveaux pairs). */
  caracs: Partial<Scores>;
  /** Points ajoutés à l'attaque et à la parade (niveaux impairs). */
  at: number;
  prd: number;
}

export const origineParId = (id: string): Origine => {
  const o = ORIGINES.find((x) => x.id === id);
  if (!o) throw new Error(`Origine inconnue : ${id}`);
  return o;
};

export const metierParId = (id: string): Metier =>
  id === SANS_METIER.id ? SANS_METIER : (METIERS.find((x) => x.id === id) ?? SANS_METIER);

/** Scores après l'origine (versions d'Homme-Bête), avant les ajustements de métier. */
export const scoresApresOrigine = (jets: Scores, origine: Origine, versionHB?: number): Scores => {
  const s = { ...jets };
  const v = versionHB !== undefined ? origine.versions?.[versionHB] : undefined;
  if (v) for (const c of CARACS) s[c] += v.mods[c] ?? 0;
  return s;
};

/** Quels ajustements le joueur doit-il choisir pour cette combinaison ? */
export const ajustementsRequis = (scores: Scores, origine: Origine, metier: Metier) => {
  const adresseFinale = (a: Ajustements) => caracsFinales(scores, metier, a).AD;
  return {
    guerrier: metier.ajustement === 'guerrier',
    retraitAjout:
      metier.ajustement === 'ingenieur'
        ? (['INT', 'AD'] as Carac[])
        : metier.ajustement === 'marchand'
          ? (['INT', 'CHA'] as Carac[])
          : null,
    ranger: metier.ajustement === 'ranger',
    ogre: !!origine.superBourrin,
    /** L'assassin a déjà son bonus d'Adresse compris dans son AT de 11. */
    adresse: (a: Ajustements) => metier.id !== 'assassin' && (adresseFinale(a) > 12 || adresseFinale(a) <= 8),
  };
};

const caracsFinales = (scores: Scores, metier: Metier, a: Ajustements): Scores => {
  const s = { ...scores };
  if ((metier.ajustement === 'ingenieur' || metier.ajustement === 'marchand') && a.ajout) s[a.ajout] += 1;
  if (metier.ajustement === 'ranger' && a.rangerDe && a.rangerVers && a.rangerDe !== a.rangerVers) {
    s[a.rangerDe] -= 1;
    s[a.rangerVers] += 1;
  }
  return s;
};

export interface Fiche {
  personnage: Personnage;
  origine: Origine;
  metier: Metier;
  nomVersionHB?: string;
  caracs: Scores;
  ev: number;
  ea: number;
  at: number;
  prd: number;
  rm: number;
  bonusDegats: number;
  prMax: number | null;
  charge: string;
  competences: { naissance: string[]; heritees: string[]; choisies: string[] };
  restrictions: string[];
  bonus: string[];
  ville: string;
}

export const calculerFiche = (p: Personnage): Fiche => {
  const origine = origineParId(p.origineId);
  const metier = metierParId(p.metierId);
  const version = p.versionHB !== undefined ? origine.versions?.[p.versionHB] : undefined;
  const a = p.ajustements;

  const caracs = caracsFinales(scoresApresOrigine(p.jets, origine, p.versionHB), metier, a);
  const prog = p.progression;
  for (const [k, v] of Object.entries(prog?.caracs ?? {})) caracs[k as Carac] += v ?? 0;

  const evOrigine = version?.ev ?? origine.ev;
  const ev = metier.ev(evOrigine, origine.id) + (prog?.ev ?? 0);

  let [at, prd] = metier.atPrd ?? origine.atPrd ?? [8, 10];
  at += prog?.at ?? 0;
  prd += prog?.prd ?? 0;

  if (metier.ajustement === 'guerrier') {
    if (a.guerrierEchange === 'AT>PRD') { at -= 1; prd += 1; }
    if (a.guerrierEchange === 'PRD>AT') { at += 1; prd -= 1; }
    if (a.guerrierBonus === 'AT') at += 1;
    if (a.guerrierBonus === 'PRD') prd += 1;
  }
  if ((metier.ajustement === 'ingenieur' || metier.ajustement === 'marchand') && a.retrait) {
    if (a.retrait === 'AT') at -= 1; else prd -= 1;
  }
  if (metier.id !== 'assassin' && a.adresse) {
    const delta = caracs.AD > 12 ? 1 : caracs.AD <= 8 ? -1 : 0;
    if (a.adresse === 'AT') at += delta; else prd += delta;
  }

  let bonusDegats = caracs.FO > 12 ? caracs.FO - 12 : caracs.FO <= 8 ? -1 : 0;
  if (origine.superBourrin) {
    const ogreAT = Math.max(0, a.ogreAT ?? 0);
    const ogrePRD = Math.max(0, Math.min(3 - ogreAT, a.ogrePRD ?? 0));
    at -= ogreAT;
    prd -= ogrePRD;
    bonusDegats += ogreAT + ogrePRD;
  }

  const limites = [origine.prMax, metier.prMax].filter((x): x is number => x !== null);
  let prMax: number | null = limites.length ? Math.min(...limites) : null;
  if (metier.prBonus && prMax !== null) prMax += metier.prBonus;

  const naissance = sansDoublons([...origine.naissance, ...(version?.bonus ?? [])]);
  const heritees = metier.heritees.filter((n) => !naissance.some((x) => cleCompetence(x) === cleCompetence(n)));

  return {
    personnage: p,
    origine,
    metier,
    nomVersionHB: version?.nom,
    caracs,
    ev,
    ea: metier.ea ? metier.ea + (prog?.ea ?? 0) : 0,
    at,
    prd,
    rm: Math.round((caracs.COU + caracs.INT + caracs.FO) / 3),
    bonusDegats,
    prMax,
    charge: metier.id === 'mage' ? '10 kilos (ou moins selon l\'origine)' : origine.charge,
    competences: { naissance, heritees, choisies: p.competencesChoisies },
    restrictions: [...origine.restrictions, ...metier.restrictions, ...(version ? [version.note] : [])],
    bonus: metier.bonus,
    ville: VILLE_DEPART[origine.id] ?? 'Waldorg',
  };
};

// --- Compétences au choix ---------------------------------------------------

export interface ReserveCompetences {
  titre: string;
  options: string[];
  nombre: number;
}

/**
 * Livret p. 3 : 2 compétences au choix dans les fiches d'origine et de métier.
 * Humain sans métier : 3 parmi toutes les compétences génériques (sauf Appel du sauvage).
 * Humain avec métier : 2 dans celles du métier et 1 au choix (sauf Appel du sauvage).
 */
export const reservesCompetences = (origine: Origine, metier: Metier, dejaAcquises: string[]): ReserveCompetences[] => {
  const acquises = new Set(dejaAcquises.map(cleCompetence));
  const interdites = new Set<string>(['APPEL DU SAUVAGE']);
  if (metier.id === 'traine-patins' || origine.id === 'homme-bete') interdites.add('ÉRUDITION');
  const filtrer = (liste: string[]) => {
    const vus = new Set<string>();
    return liste.filter((n) => {
      const k = cleCompetence(n);
      if (acquises.has(k) || interdites.has(k) || vus.has(k)) return false;
      vus.add(k);
      return true;
    });
  };

  if (origine.id === 'humain') {
    if (metier.id === SANS_METIER.id) {
      return [{ titre: 'Toutes les compétences', options: filtrer(competencesGeneriques()), nombre: 3 }];
    }
    return [
      { titre: `Compétences du métier ${metier.nom}`, options: filtrer(metier.auChoix), nombre: 2 },
      { titre: 'Une compétence au choix', options: filtrer(competencesGeneriques()), nombre: 1 },
    ];
  }
  const titreReserve = metier.id === SANS_METIER.id ? `Compétences ${origine.nom}` : `Compétences ${origine.nom} et ${metier.nom}`;
  return [{ titre: titreReserve, options: filtrer([...origine.auChoix, ...metier.auChoix]), nombre: 2 }];
};
