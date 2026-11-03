import { calculerFiche, type Personnage } from './creation';
import { lancer, type Rng } from './des';
import { ecole, GRIMOIRES, type CaracSort, type SortGrimoire } from './grimoires';
import { evMax, lancerExpression, niveau, type Partie } from './partie';

// La magie (« Règles concernant la Magie fanghienne », v3.2, et les grimoires officiels) :
// - chaque sort coûte des points astraux (PA), pris dans l'énergie astrale (EA) ;
// - on le lance par une épreuve (MagiePhys = moyenne INT/AD, MagiePsy = moyenne INT/CHA, arrondies au-dessus ;
//   ou INT, CHA, AT, PRD selon le sort), avec un bonus ou un malus ;
// - l'épreuve n'est demandée que jusqu'à un certain niveau (« jusqu'au niveau N ») : au-delà, le sort part tout seul ;
// - 1 : réussite critique, effets doublés ; échec : on perd la moitié des PA (au moins 1) ; 20 : maladresse ;
// - +1 aux dégâts des sorts qui le disent par point d'INTELLIGENCE au-dessus de 12 ;
// - l'EA revient en se reposant.
// Le mage connaît la magie généraliste (sauf l'invocateur) et sa spécialité ; le prêtre et le paladin, les prodiges
// de leur dieu (épreuve sur MagiePsy le plus souvent ; le paladin a besoin d'une relique).

export type Sort = SortGrimoire;
export type CaracMagie = CaracSort;

export type VoieMagie = 'mage' | 'pretre' | 'paladin';

export const voieDe = (perso: Personnage): VoieMagie | undefined =>
  perso.metierId === 'mage' || perso.metierId === 'pretre' || perso.metierId === 'paladin' ? perso.metierId : undefined;

/** Écoles par défaut des vieilles sauvegardes (avant le choix à la création). */
const ECOLES_DEFAUT: Record<VoieMagie, string[]> = { mage: ['combat'], pretre: ['pretre-youclidh'], paladin: ['paladin-braav'] };

/** Les grimoires du personnage : spécialités du mage, ou manuel de son dieu. */
export const ecolesDe = (perso: Personnage): string[] => {
  const v = voieDe(perso);
  if (!v) return [];
  return perso.magie?.ecoles?.length ? perso.magie.ecoles : ECOLES_DEFAUT[v];
};

/** Le dieu d'un prêtre ou d'un paladin. */
export const culteDe = (perso: Personnage) => {
  const v = voieDe(perso);
  return v && v !== 'mage' ? ecole(ecolesDe(perso)[0]) : undefined;
};

/** Les sorts qu'un personnage connaît à ce niveau (un sort présent dans deux grimoires : la version de sa spécialité). */
export const sortsDePerso = (perso: Personnage, niv: number): Sort[] => {
  const v = voieDe(perso);
  if (!v) return [];
  const ecoles = ecolesDe(perso);
  const livres = v === 'mage' && !ecoles.includes('invocation') ? [...ecoles, 'generaliste'] : ecoles;
  const vus = new Set<string>();
  const res: Sort[] = [];
  for (const l of livres)
    for (const s of GRIMOIRES)
      if (s.ecole === l && s.niveau <= niv && !vus.has(s.nom.toLowerCase())) {
        vus.add(s.nom.toLowerCase());
        res.push(s);
      }
  return res.sort((a, b) => a.niveau - b.niveau || livres.indexOf(a.ecole) - livres.indexOf(b.ecole));
};

export const sort = (id: string): Sort => GRIMOIRES.find((s) => s.id === id || s.id.endsWith(`:${id}`))!;

/** Le héros manie-t-il la magie (mage, prêtre ou paladin) ? */
export const estMage = (p: Partie) => !!voieDe(p.perso);

export const eaMax = (p: Partie) => calculerFiche(p.perso).ea;

/** Énergie astrale actuelle (les vieilles sauvegardes n'en ont pas : réservoir plein). */
export const ea = (p: Partie) => p.ea ?? eaMax(p);

/** Valeur d'une caractéristique de magie pour un personnage (fiche complète, progression comprise). */
export const caracMagiePerso = (perso: Personnage, c: CaracMagie) => {
  const f = calculerFiche(perso);
  const k = f.caracs;
  switch (c) {
    case 'INT':
      return k.INT;
    case 'CHA':
      return k.CHA;
    case 'AT':
      return f.at;
    case 'PRD':
      return f.prd;
    case 'MagiePsy':
      return Math.ceil((k.INT + k.CHA) / 2);
    default:
      return Math.ceil((k.INT + k.AD) / 2);
  }
};

export const caracMagie = (p: Partie, c: CaracMagie) => caracMagiePerso(p.perso, c);

export const bonusIntPerso = (perso: Personnage) => Math.max(0, calculerFiche(perso).caracs.INT - 12);
export const bonusInt = (p: Partie) => bonusIntPerso(p.perso);

export const sortsConnus = (p: Partie) => sortsDePerso(p.perso, niveau(p));

/** Le jeu sait jouer ce sort en combat (coût connu, effet géré). */
export const enCombat = (s: Sort) => s.cout !== null && ['degats', 'malus', 'bonus', 'soin', 'frappe'].includes(s.effet.type);

/** Un sort de soin qu'on peut lancer hors combat. */
export const soinHorsCombat = (s: Sort) => s.cout !== null && s.effet.type === 'soin';

/** Pas d'épreuve : sort sans caractéristique, ou lanceur au-dessus du niveau « jusqu'au niveau N ». */
export const sortAutomatique = (s: Sort, niv: number) => s.carac === 'aucune' || (s.jusqua !== null && niv > s.jusqua);

export const valeurSortPerso = (perso: Personnage, s: Sort) => (s.carac === 'aucune' ? 20 : caracMagiePerso(perso, s.carac) + s.modif);
export const valeurSort = (p: Partie, s: Sort) => valeurSortPerso(p.perso, s);

/** Les dés de dégâts d'un sort pour un lanceur de ce niveau, avec son bonus d'INT si le sort le prévoit. */
export const formuleDegats = (s: Sort, niv: number, bonus: number) => {
  if (s.effet.type !== 'degats') return '';
  let des = s.effet.des;
  for (const [n, d] of s.effet.parNiveau ?? []) if (niv >= n) des = d;
  const [d, fixe] = des.split(/(?=[+-])/);
  const total = Number(fixe ?? 0) + (s.effet.bonusInt ? bonus : 0);
  return `${d}${total ? (total > 0 ? `+${total}` : `${total}`) : ''}`;
};

export const degatsSort = (p: Partie, s: Sort) => formuleDegats(s, niveau(p), bonusInt(p));

/** Bonus de frappe bénie au niveau du lanceur. */
export const frappeA = (s: Sort, niv: number) => {
  if (s.effet.type !== 'frappe') return { at: 0, degats: 0 };
  let d = s.effet.degats;
  for (const [n, v] of s.effet.parNiveau ?? []) if (niv >= n) d = v;
  return { at: s.effet.at, degats: d };
};

/** Le prodige demande-t-il une relique (paladin) ? Renvoie la raison du refus, ou rien. */
export const refusRelique = (p: Partie) => {
  if (voieDe(p.perso) !== 'paladin') return undefined;
  const culte = culteDe(p.perso);
  const tout = [...p.sac, ...Object.values(p.equipe ?? {})];
  return tout.some((o) => typeof o === 'string' && o.startsWith('relique')) ? undefined : `Sans relique de ${culte?.dieu ?? 'ton dieu'}, pas de prodige.`;
};

export type IssueSort = 'critique' | 'reussi' | 'rate' | 'maladresse';

export const issueSort = (de: number, valeur: number, auto: boolean): IssueSort =>
  de === 1 ? 'critique' : auto ? 'reussi' : de === 20 ? 'maladresse' : de <= valeur ? 'reussi' : 'rate';

/** PA payés : tout sur un succès, la moitié (au moins 1) sur un échec. */
export const coutPaye = (cout: number, issue: IssueSort) => (issue === 'rate' ? Math.max(cout ? 1 : 0, Math.floor(cout / 2)) : cout);

export interface LancementSort {
  issue: IssueSort;
  /** PA réellement dépensés. */
  cout: number;
  texte: string;
  /** Blessure au lanceur sur une maladresse. */
  blessure?: number;
}

/**
 * Le héros lance un sort avec son dé et paie son coût. Les effets s'appliquent ensuite (sorts.ts en combat).
 * Maladresse : la table générique manque (seuls les grimoires d'entropie en ont), on applique une version simple :
 * tous les PA sont perdus et le sort explose au visage du lanceur (1D).
 */
export const lancerSort = (p: Partie, s: Sort, de: number, rng?: Rng, coutVoulu?: number): LancementSort | string => {
  const base = coutVoulu ?? s.cout ?? 0;
  if (ea(p) < base) return `Pas assez d'énergie astrale (${ea(p)} PA, il en faut ${base}).`;
  const relique = refusRelique(p);
  if (relique) return relique;
  const auto = sortAutomatique(s, niveau(p));
  const issue = issueSort(de, valeurSort(p, s), auto);
  const cout = coutPaye(base, issue);
  p.ea = ea(p) - cout;
  if (issue === 'maladresse') {
    const b = lancerExpression('1D', rng).total;
    p.ev -= b;
    return { issue, cout, blessure: b, texte: `Maladresse ! Le sort explose au visage du lanceur : −${b} PV, et ${cout} PA perdus.` };
  }
  if (issue === 'rate') return { issue, cout, texte: `L'incantation échoue : la moitié des PA est perdue (${cout} PA).` };
  return {
    issue,
    cout,
    texte: issue === 'critique' ? 'Réussite critique : les effets sont doublés !' : auto ? (s.carac === 'aucune' ? 'Le sort part (pas d\'épreuve pour celui-ci).' : 'Le sort part tout seul (plus besoin d\'épreuve à ce niveau).') : 'Le sort part.',
  };
};

/** Deux soins magiques par heure au plus, sur une même personne (règles des soins). */
const soinsRecents = (p: Partie) => (p.soinsMagiques ?? []).filter((t) => p.jour * 24 + p.heure - t < 1);

/**
 * Un soin hors combat sur le héros ou un compagnon (sans épreuve hors combat, on prend le temps).
 * PA convertis en PV (« 1 PA = 1 PV ») ou dés de soin ; renvoie ce qui est rendu.
 */
export const soignerHorsCombat = (
  p: Partie,
  s: Sort,
  cible: { ev: number; evMax: number; soigner: (n: number) => void; nom: string },
  rng?: Rng,
): { rendu: number; cout: number; texte: string } | string => {
  if (s.effet.type !== 'soin') return 'Ce sort ne soigne pas.';
  if (!sortsConnus(p).some((x) => x.id === s.id)) return 'Tu ne connais pas ce sort.';
  const relique = refusRelique(p);
  if (relique) return relique;
  const manque = cible.evMax - cible.ev;
  if (manque <= 0) return `${cible.nom} est en pleine forme.`;
  if (ea(p) <= 0) return "Plus d'énergie astrale.";
  const recents = soinsRecents(p);
  if (recents.length >= 2) return "Deux soins dans l'heure, c'est le maximum : attends un peu, sinon gare aux complications.";
  const e = s.effet;
  let rendu: number;
  let cout: number;
  let detail: string;
  if (e.parPA) {
    const plafond = e.max ? lancerExpression(e.max, rng).total : manque;
    rendu = Math.min(plafond, manque, ea(p) * e.parPA);
    cout = Math.ceil(rendu / e.parPA);
    detail = `${e.parPA > 1 ? `1 PA = ${e.parPA} PV` : '1 PA = 1 PV'}${e.max ? `, au plus ${plafond} (${e.max})` : ''}`;
  } else {
    if (ea(p) < (s.cout ?? 0)) return `Pas assez d'énergie astrale (${ea(p)} PA, il en faut ${s.cout}).`;
    const j = e.des && e.des !== '0' ? lancerExpression(e.des, rng).total : 0;
    rendu = Math.min(manque, j);
    cout = s.cout ?? 0;
    detail = e.des && e.des !== '0' ? `${e.des} = ${j}` : 'soin des blessures graves';
  }
  p.ea = ea(p) - cout;
  cible.soigner(rendu);
  p.soinsMagiques = [...recents, p.jour * 24 + p.heure];
  return { rendu, cout, texte: `${s.nom} sur ${cible.nom} : +${rendu} PV (${detail}), ${cout} PA.` };
};

/** Soin des blessures légères sur le héros (raccourci de la fiche). */
export const soinLeger = (p: Partie, rng?: Rng): { rendu: number; de: number } | string => {
  const s = sortsConnus(p).find((x) => soinHorsCombat(x));
  if (!s) return 'Tu ne connais pas de sort de soin.';
  const r = soignerHorsCombat(p, s, { ev: p.ev, evMax: evMax(p), nom: 'toi', soigner: (n) => (p.ev += n) }, rng);
  return typeof r === 'string' ? r : { rendu: r.rendu, de: r.rendu };
};

/** Nom lisible de l'école d'un sort. */
export const nomEcole = (s: Sort) => ecole(s.ecole)?.nom ?? s.ecole;

/** Un D20 pour qui n'a pas de dé du joueur. */
export const d20 = (rng?: Rng) => lancer(20, rng);

const nomMod: Record<string, string> = { at: 'AT', prd: 'PRD', pr: 'PR', cou: 'COU', degats: 'dégâts', fuite: 'fuite', prTir: 'PR contre les tirs', degatsMainsNues: 'dégâts à mains nues' };
const ETATS: Record<string, string> = { immobile: 'entrave', 'au-sol': 'fait tomber', aveugle: 'aveugle (AT/PRD −5)', peur: 'fait fuir', faible: 'affaiblit' };

/** L'effet d'un sort en quelques mots, pour un bouton. */
export const resumeEffet = (s: Sort, niv: number, bonus: number) => {
  const e = s.effet;
  const duree = (n: number) => (n >= 99 ? 'tout le combat' : `${n} assaut${n > 1 ? 's' : ''}`);
  const mods = (m: Record<string, unknown>) =>
    Object.entries(m)
      .filter(([k, v]) => k !== 'riposte' && v !== undefined)
      .map(([k, v]) => `${nomMod[k] ?? k} ${v === 'niveau' ? `+${niv}` : (v as number) > 0 ? `+${v}` : v}`)
      .join(', ');
  switch (e.type) {
    case 'degats':
      return `dégâts ${formuleDegats(s, niv, bonus)}${e.zone ? ', zone' : ''}${e.ignoreArmure ? ', ignore l\'armure' : ''}${e.rm ? ', résistible' : ''}`;
    case 'malus':
      return `${ETATS[e.etat]}${e.mods ? ` (${mods(e.mods)})` : ''}, ${duree(e.assauts)}${e.zone ? ', zone' : ''}${e.rm ? ', résistible' : ''}`;
    case 'bonus':
      return `${e.cible === 'groupe' ? 'groupe' : e.cible === 'soi' ? 'soi' : 'un allié'} : ${mods(e.mods) || 'effet spécial'}, ${duree(e.assauts)}`;
    case 'soin':
      return `soin ${e.parPA ? `${e.parPA} PV par PA${e.max ? `, ${e.max} au plus` : ''}` : e.des && e.des !== '0' ? e.des : ''}${e.groupe ? ', tout le groupe' : ''}${e.graves ? ', arrête les hémorragies' : ''}`;
    case 'frappe': {
      const f = frappeA(s, niv);
      return `coup béni : AT +${f.at}, dégâts +${f.degats}`;
    }
    default:
      return 'hors combat';
  }
};

/** Nombre de spécialités qu'un mage peut avoir à ce niveau (une au départ, deux au niveau 5, trois au niveau 10). */
export const specialitesMax = (niv: number) => (niv >= 10 ? 3 : niv >= 5 ? 2 : 1);

/** Les grimoires du sac qu'un mage peut étudier maintenant (avec la raison si non). */
export const grimoiresAEtudier = (p: Partie): { ecole: string; refus?: string }[] => {
  if (voieDe(p.perso) !== 'mage') return [];
  const ecoles = ecolesDe(p.perso);
  return [...new Set(p.sac.filter((o) => o.startsWith('grimoire-')).map((o) => o.slice('grimoire-'.length)))]
    .filter((id) => !ecoles.includes(id))
    .map((id) => {
      const e = ecole(id);
      const unique = ecoles.some((x) => ecole(x)?.unique);
      const refus = !e
        ? 'grimoire inconnu'
        : e.unique || unique
          ? 'la nécromancie et la magie de Tzinntch ne se partagent pas'
          : ecoles.length >= specialitesMax(niveau(p))
            ? `il faut le niveau ${ecoles.length >= 2 ? 10 : 5} pour une ${ecoles.length + 1 === 2 ? 'deuxième' : 'troisième'} spécialité`
            : ecoles.includes('invocation') && ecoles.length >= 2
              ? "l'invocateur s'arrête à deux spécialités"
              : undefined;
      return { ecole: id, refus };
    });
};

/** Étudie un grimoire du sac : une spécialité de plus (le livre reste, on peut le revendre). */
export const etudierGrimoire = (p: Partie, id: string): string => {
  const g = grimoiresAEtudier(p).find((x) => x.ecole === id);
  if (!g) return "Tu n'as pas ce grimoire.";
  if (g.refus) return `Impossible : ${g.refus}.`;
  p.perso = { ...p.perso, magie: { ecoles: [...ecolesDe(p.perso), id] } };
  return `Des nuits d'étude plus tard, tu maîtrises une nouvelle spécialité : ${ecole(id)!.nom}.`;
};
