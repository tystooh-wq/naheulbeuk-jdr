import { lancer, type Rng } from './des';
import {
  appliquerMods,
  combattant,
  ecart,
  enLice,
  ennemis,
  rmDe,
  toucherParSort,
  verifier,
  type Action,
  type Combat,
  type Combattant,
  type EffetActif,
} from './combat';
import { sortGrimoire, type Mods, type SortGrimoire } from './grimoires';
import { coutPaye, formuleDegats, frappeA, issueSort, type IssueSort } from './magie';
import { lancerExpression } from './partie';

// Les effets des sorts en combat, pour le héros comme pour ses compagnons :
// - dégâts (une cible, ou la cible et ses voisins pour un sort de zone), armure comprise ou ignorée ;
// - malus sur l'ennemi : entravé ou à terre (il perd ses attaques), aveuglé (AT et PRD −5), effrayé (il fuit),
//   affaibli (malus du sort) ; quand le sort le prévoit, la cible résiste sur un D20 sous sa résistance à la magie ;
// - bonus sur soi, un allié ou le groupe (AT, PRD, PR, COU, dégâts), pour quelques assauts ou tout le combat ;
// - soins (dés, ou PA convertis en PV) ;
// - frappe bénie des paladins : AT et dégâts en plus pour le coup qui suit, sans perdre l'assaut.
// Un sort long (incantation de plusieurs assauts) part tout de suite, mais le lanceur passe ensuite ses tours
// (simplification : les règles le font partir à la fin de l'incantation).

/** Ce qu'il faut savoir du lanceur pour appliquer un sort. */
export interface Lanceur {
  x: Combattant;
  niveau: number;
  bonusInt: number;
  /** PA disponibles pour un soin « 1 PA = 1 PV » (après le coût du sort). */
  paDispo: number;
}

export interface ResultatSort {
  lignes: string[];
  actions: Action[];
  /** Le lanceur garde son action (frappe bénie, sort « gratuit »). */
  garde?: boolean;
  /** PA dépensés en plus du coût (soins « 1 PA = 1 PV »). */
  paSoin?: number;
}

const MODS_GERES = ['at', 'prd', 'pr', 'cou', 'degats'] as const;

/** Traduit les modificateurs du grimoire (nombre ou « niveau ») en modificateurs applicables. */
const resoudreMods = (mods: Mods, niveau: number, double: boolean): EffetActif['mods'] => {
  const res: EffetActif['mods'] = {};
  for (const k of MODS_GERES) {
    const v = mods[k];
    if (v === undefined) continue;
    const n = v === 'niveau' ? niveau : v;
    res[k] = double ? n * 2 : n;
  }
  return res;
};

const texteMods = (m: EffetActif['mods']) =>
  Object.entries(m)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k === 'degats' ? 'dégâts' : k.toUpperCase()} ${v! > 0 ? '+' : ''}${v}`)
    .join(', ');

const ajouterEffet = (c: Combat, x: Combattant, nom: string, mods: EffetActif['mods'], assauts: number, malus = false) => {
  // Le même sort ne se cumule pas : on remplace l'ancien.
  const ancien = (x.effets ?? []).find((e) => e.nom === nom);
  if (ancien) appliquerMods(x, ancien.mods, -1);
  appliquerMods(x, mods, 1);
  x.effets = [...(x.effets ?? []).filter((e) => e !== ancien), { nom, mods, fin: c.assaut + Math.max(1, assauts), malus: malus || undefined }];
};

/** La cible résiste-t-elle (D20 sous sa résistance à la magie) ? Jamais sur une réussite critique. */
const resiste = (cible: Combattant, critique: boolean, lignes: string[], rng?: Rng) => {
  if (critique) return false;
  const rm = rmDe(cible);
  const d = lancer(20, rng);
  if (d <= rm) {
    lignes.push(`${cible.nom} résiste au sort (D20 : ${d}, résistance ${rm}).`);
    return true;
  }
  return false;
};

/** Les ennemis touchés : la cible, et ses voisins pour un sort de zone. */
const ciblesEnnemies = (c: Combat, visee: Combattant, zone?: boolean) => [
  visee,
  ...(zone ? c.combattants.filter((e) => e.camp === visee.camp && enLice(e) && e !== visee && ecart(e, visee) === 1) : []),
];

const appliquerEtat = (c: Combat, cible: Combattant, nom: string, e: Extract<SortGrimoire['effet'], { type: 'malus' }>, l: Lanceur, critique: boolean, lignes: string[]) => {
  const assauts = critique ? e.assauts * 2 : e.assauts;
  const duree = assauts >= 99 ? "jusqu'à la fin du combat" : `${assauts} assaut${assauts > 1 ? 's' : ''}`;
  switch (e.etat) {
    case 'immobile':
    case 'au-sol':
      cible.rate = Math.max(cible.rate, Math.min(assauts, 6));
      lignes.push(`${cible.nom} est ${e.etat === 'au-sol' ? 'à terre' : 'entravé'} : il perd ${Math.min(assauts, 6)} assaut${Math.min(assauts, 6) > 1 ? 's' : ''} d'attaque.`);
      break;
    case 'aveugle':
      ajouterEffet(c, cible, nom, { at: -5, prd: -5 }, assauts, true);
      lignes.push(`${cible.nom} est aveuglé : AT et PRD −5 (${duree}).`);
      break;
    case 'peur':
      if (cible.camp === 'ennemi') {
        cible.etat = 'fui';
        lignes.push(`${cible.nom}, pris de panique, s'enfuit !`);
      } else lignes.push(`${cible.nom} frissonne, mais tient bon.`);
      break;
    default: {
      const mods = resoudreMods(e.mods ?? { at: -2, prd: -2 }, l.niveau, false);
      ajouterEffet(c, cible, nom, mods, assauts, true);
      lignes.push(`${cible.nom} est affaibli : ${texteMods(mods)} (${duree}).`);
    }
  }
};

/**
 * Applique un sort réussi (ou critique : effets doublés) sur la cible désignée.
 * desDegats : les dés du joueur pour les dégâts (sinon tirés ici).
 */
export const appliquerSort = (c: Combat, l: Lanceur, s: SortGrimoire, idCible: string, issue: IssueSort, rng?: Rng): ResultatSort => {
  const critique = issue === 'critique';
  const lignes: string[] = [];
  const actions: Action[] = [];
  const e = s.effet;
  const visee = combattant(c, idCible);
  switch (e.type) {
    case 'degats': {
      const formule = formuleDegats(s, l.niveau, l.bonusInt);
      for (const cible of ciblesEnnemies(c, visee, e.zone)) {
        if (e.rm && resiste(cible, critique, lignes, rng)) continue;
        const a = toucherParSort(c, cible.id, formule, critique, rng, l.x.id, !!e.ignoreArmure);
        actions.push(a);
        const g = a.degats!;
        lignes.push(`${cible.nom} : ${formule}${critique ? ' ×2' : ''} = ${g.total}${g.pr ? `, moins ${g.pr} d'armure` : e.ignoreArmure ? " (l'armure ne compte pas)" : ''}, −${g.blessure} PV.`);
        if (e.vol && g.blessure) {
          l.x.ev = Math.min(l.x.evMax, l.x.ev + g.blessure);
          lignes.push(`${l.x.nom} récupère ${g.blessure} PV.`);
        }
        if (cible.ev > 0) {
          if (e.armure) {
            cible.pr = Math.max(0, cible.pr + e.armure);
            lignes.push(`L'armure de ${cible.nom} est rongée (PR ${e.armure}).`);
          }
          if (e.chute) {
            cible.rate = Math.max(cible.rate, e.chute);
            lignes.push(`${cible.nom} tombe : il perd ${e.chute} assaut${e.chute > 1 ? 's' : ''} d'attaque.`);
          }
          if (e.immobilise) {
            cible.rate = Math.max(cible.rate, Math.min(e.immobilise, 4));
            lignes.push(`${cible.nom} est pris dans le sort : il perd ${Math.min(e.immobilise, 4)} assauts d'attaque.`);
          }
        }
      }
      verifier(c);
      break;
    }
    case 'malus': {
      for (const cible of ciblesEnnemies(c, visee, e.zone)) {
        if (e.rm && resiste(cible, critique, lignes, rng)) continue;
        appliquerEtat(c, cible, s.nom, e, l, critique, lignes);
      }
      verifier(c);
      break;
    }
    case 'bonus': {
      const cibles = e.cible === 'soi' ? [l.x] : e.cible === 'groupe' ? c.combattants.filter((y) => y.camp === l.x.camp && enLice(y)) : [visee];
      const mods = resoudreMods(e.mods, l.niveau, critique);
      const assauts = e.assauts >= 99 ? 999 : critique ? e.assauts * 2 : e.assauts;
      const t = texteMods(mods);
      for (const y of cibles) ajouterEffet(c, y, s.nom, mods, assauts);
      const duree = assauts >= 99 ? "jusqu'à la fin du combat" : `${assauts} assaut${assauts > 1 ? 's' : ''}`;
      lignes.push(
        t
          ? `${cibles.map((y) => y.nom).join(', ')} : ${t} (${duree}).`
          : `${cibles.map((y) => y.nom).join(', ')} : effet sans conséquence en combat dans le jeu (${s.nom}).`,
      );
      return { lignes, actions, garde: e.gratuit };
    }
    case 'soin': {
      const cibles = e.groupe ? c.combattants.filter((y) => y.camp === l.x.camp && enLice(y)) : [e.soi ? l.x : visee];
      let paSoin = 0;
      for (const y of cibles) {
        if (e.graves && y.hemorragie !== undefined) {
          y.hemorragie = undefined;
          lignes.push(`L'hémorragie de ${y.nom} s'arrête.`);
        }
        const manque = y.evMax - y.ev;
        let rendu = 0;
        if (e.parPA) {
          const plafond = e.max ? lancerExpression(e.max, rng).total : manque;
          rendu = Math.min(plafond, manque, (l.paDispo - paSoin) * e.parPA);
          paSoin += Math.ceil(rendu / e.parPA);
        } else if (e.des && e.des !== '0') {
          const j = lancerExpression(e.des, rng).total * (critique ? 2 : 1);
          rendu = Math.min(manque, j);
        }
        y.ev += rendu;
        if (rendu || !e.graves) lignes.push(`${y.nom} : +${rendu} PV${e.parPA ? ` (${Math.ceil(rendu / e.parPA)} PA)` : ''}.`);
      }
      return { lignes, actions, paSoin };
    }
    case 'frappe': {
      const f = frappeA(s, l.niveau);
      const mods = { at: f.at, degats: critique ? f.degats * 2 : f.degats };
      ajouterEffet(c, l.x, s.nom, mods, 1);
      lignes.push(`${l.x.nom} : AT +${mods.at}, dégâts +${mods.degats} pour le coup qui suit.`);
      return { lignes, actions, garde: true };
    }
    default:
      lignes.push(`${s.nom} n'a pas d'effet en combat dans le jeu.`);
  }
  return { lignes, actions };
};

/** Un long sort : le lanceur passe ses prochains tours à finir l'incantation. */
export const occuperLanceur = (x: Combattant, s: SortGrimoire) => {
  if (s.incantation > 1) x.incante = s.incantation - 1;
};

/**
 * Un allié lance un sort (mêmes règles que le héros : 1, critique, effets doublés ; échec, moitié des PA ;
 * 20, le sort lui explose au visage, 1D). Ses dés roulent tout seuls.
 */
export const lancerSortAllie = (c: Combat, x: Combattant, i: number, idCible: string, de: number, rng?: Rng): { texte: string; actions: Action[]; garde?: boolean } => {
  const so = x.magie!.sorts[i];
  const s = sortGrimoire(so.id)!;
  const issue = issueSort(de, so.valeur, so.auto);
  const base = s.cout ?? 0;
  const cout = coutPaye(base, issue);
  x.magie!.ea = Math.max(0, x.magie!.ea - cout);
  const verbe = x.magie!.voie === 'mage' ? 'incante' : 'invoque son dieu :';
  const debut = `${x.nom} ${verbe} ${s.nom}${so.auto ? '' : ` (D20 : ${de}, il faut ${so.valeur})`}`;
  if (issue === 'maladresse') {
    const b = lancerExpression('1D', rng).total;
    x.ev -= b;
    verifier(c);
    return { texte: `${debut} : maladresse ! Le sort lui explose au visage, −${b} PV.`, actions: [] };
  }
  if (issue === 'rate') return { texte: `${debut} : raté, ${cout} PA perdus.`, actions: [] };
  const r = appliquerSort(c, { x, niveau: x.magie!.niveau, bonusInt: x.magie!.bonusInt, paDispo: x.magie!.ea }, s, idCible, issue, rng);
  x.magie!.ea = Math.max(0, x.magie!.ea - (r.paSoin ?? 0));
  occuperLanceur(x, s);
  return { texte: `${debut}${issue === 'critique' ? ' : critique, effets doublés' : ''}. ${r.lignes.join(' ')}`, actions: r.actions, garde: r.garde };
};

/** Les cibles qu'un sort peut viser (ennemis pour une attaque ou un malus ; alliés pour un soin ou un bonus). */
export const ciblesSort = (c: Combat, x: Combattant, s: SortGrimoire): Combattant[] => {
  const e = s.effet;
  if (e.type === 'degats' || e.type === 'malus') return ennemis(c).filter(enLice);
  if (e.type === 'frappe' || (e.type === 'bonus' && e.cible !== 'allie') || (e.type === 'soin' && (e.groupe || e.soi))) return [x];
  const allies = c.combattants.filter((y) => y.camp === x.camp && enLice(y));
  // Un soin : seulement les blessés.
  return e.type === 'soin' ? allies.filter((y) => y.ev < y.evMax || (e.graves && y.hemorragie !== undefined)) : allies;
};
