import { calculerFiche, cleCompetence } from './creation';
import { lancer, type Rng } from './des';
import { lancerExpression, mainGauche, valeursCombat, type EtatCompagnon, type Partie } from './partie';
import { singulier, type LigneRencontre, type Rencontre } from './rencontres';
import { tirCompagnon, vueCompagnon, type Ordre } from './compagnons';
import { fouiller, type Fouille } from './butin';
import { objet } from './objets';
import {
  BLESSURES,
  PARADE_CRITIQUE,
  blessure as tirerBlessure,
  casse as armeCasse,
  decrireBlessure,
  familleMonstre,
  familleObjet,
  ligne,
  tableCritique,
  tableMaladresse,
  type BlessureGrave,
  type Famille,
} from './critiques';

// Combat au contact, règles V4 (chapitres 8 et 10) :
// - initiative : le plus grand Courage frappe le premier, l'Adresse départage, « Chercher des noises » passe devant ;
// - un Assaut : chacun attaque une fois (D20 ≤ AT) et ne peut parer (D20 ≤ PRD) ou esquiver (D20 ≤ AD) qu'une fois ;
// - dégâts au D6 moins la Protection, sauf sur une attaque critique ;
// - 1 au D20 : critique, 20 : maladresse, avec les tables de l'écran Baston selon l'arme (voir critiques.ts) ;
// - trois ennemis au plus au contact d'un même combattant ;
// - un monstre à 3 PV ou moins peut paniquer et s'enfuir (il rapporte quand même son XP).
// Placement (choix du jeu, les règles n'ont pas de plateau) : un terrain en cases ; à son tour, chacun peut
// avancer de PAS cases (diagonales comprises) puis agir. On frappe une case voisine ; on tire ou on lance
// un sort tant qu'aucun ennemi n'est au contact. Les compagnons et alliés jouent seuls, comme les ennemis.

export type Camp = 'heros' | 'ennemi';
export type Etat = 'actif' | 'reserve' | 'mort' | 'fui';
export type ModeDefense = 'parade' | 'esquive';

export interface Combattant {
  id: string;
  nom: string;
  camp: Camp;
  /** Case du terrain (colonne, ligne). */
  x: number;
  y: number;
  /** Compagnon du héros (identifiant de compagnons.ts) : il se bat seul, à ses côtés. */
  compagnon?: string;
  /** Allié de passage (des elfes en difficulté…), du côté du héros. */
  allie?: boolean;
  at: number;
  prd: number;
  ad: number;
  pr: number;
  cou: number;
  degats: string;
  ev: number;
  evMax: number;
  xp: number;
  etat: Etat;
  /** Ses coups ne se parent pas : il faut les esquiver (« Parade impossible »). */
  imparable?: boolean;
  /** Ne peut pas parer (héros à mains nues, sans Bourre-pif) : seulement esquiver. */
  sansParade?: boolean;
  /** Poison : si le coup passe l'armure, +1D6. */
  poison?: boolean;
  /** Assauts d'attaque à rater (après une esquive, une maladresse…). */
  rate: number;
  /** A déjà paré ou esquivé pendant cet assaut. */
  defendu: boolean;
  /** Armé d'un arc ou d'une arbalète : il tire tant que personne n'est à son contact. */
  tireur?: { ad: number; degats: string };
  /** Compétences du héros qui jouent en combat (voir talents.ts). */
  talents?: {
    vicieux?: boolean;
    superEsquive?: boolean;
    esquiveNaturelle?: boolean;
    bricABrac?: boolean;
    /** Truc de mauviette : ce point de protection compte même contre un critique. */
    prNaturelle?: number;
    rempailleur?: boolean;
    renforts?: boolean;
    poubelles?: boolean;
  };
  /** Frapper lâchement : les dégâts de la prochaine attaque réussie sont doublés. */
  lachement?: boolean;
  /** Famille de son arme : elle choisit les tables de critiques et de maladresses. */
  famille: Famille;
  /** Point de rupture de son arme (« 1à4 », « Non »). */
  rupture?: string;
  /** Peut faire des critiques à mains nues (Bourre-pif ; les monstres, toujours). */
  bourrePif?: boolean;
  /** Cases parcourues par tour (jambe blessée : moins). */
  mv?: number;
  /** Assauts sans connaissance : il ne frappe pas et ne se défend pas. */
  inconscient?: number;
  /** Hémorragie : assaut où elle a commencé (1D6 PV par minute, soit tous les 30 assauts). */
  hemorragie?: number;
  /** Blessures graves reçues pendant ce combat. */
  blessures?: BlessureGrave[];
  /** Ambidextrie : la deuxième arme, pour une deuxième attaque à chaque assaut (AT déjà à −5). */
  mainGauche?: { nom: string; at: number; degats: string; famille: Famille; rupture?: string };
}

/** Un D20 lancé sur une table de l'écran : par qui, sur quelle table, avec quel effet. */
export interface TirageTable {
  lanceur: string;
  table: string;
  de: number;
  texte: string;
  effet: string;
}

export type IssueJet = 'critique' | 'reussi' | 'rate' | 'maladresse';

export interface Defense {
  mode: ModeDefense;
  de: number;
  valeur: number;
  issue: IssueJet;
}

export interface Action {
  attaquant: string;
  cible: string;
  de: number;
  valeur: number;
  issue: IssueJet;
  defense?: Defense;
  /** Pourquoi la cible n'a pas pu se défendre. */
  sansDefense?: string;
  degats?: { des: number[]; total: number; pr: number; blessure: number; poison?: number[]; bonus?: number };
  /** Conséquences des critiques et maladresses, en clair. */
  effets: string[];
  /** Les D20 lancés sur les tables de critiques et de maladresses, dans l'ordre. */
  tables?: TirageTable[];
  /** Un tir (arc, arbalète, arme de jet) plutôt qu'un coup au contact. */
  tir?: boolean;
  /** Les dégâts d'un sort. */
  sort?: boolean;
}

export interface Combat {
  combattants: Combattant[];
  /** Ordre d'initiative (identifiants). */
  ordre: string[];
  tour: number;
  assaut: number;
  journal: string[];
  fin?: 'victoire' | 'defaite' | 'fuite' | 'reddition';
  /** Taille du terrain, en cases. */
  largeur: number;
  hauteur: number;
  /** Le combattant dont c'est le tour s'est déjà déplacé. */
  deplace?: boolean;
  /** Assauts avant que l'arme à distance du héros soit rechargée. */
  recharge: number;
  /** L'arme de jet du héros est partie (on la ramasse après une victoire). */
  armeLancee?: boolean;
  /** Projectiles tirés par le héros (identifiants d'objets). */
  projectiles: string[];
  /** L'arme de tir du héros est tombée ou cassée : plus de tir dans ce combat. */
  tirPerdu?: boolean;
  /** Armes du héros cassées pendant le combat (elles disparaissent de son équipement). */
  armesCassees?: ('arme' | 'armeGauche' | 'distance')[];
  /** Compagnons frappés par le héros (maladresse) : ils s'en souviendront. */
  frappesAllies?: { id: string; grave: boolean }[];
  /** Ordres donnés aux compagnons (identifiant du combattant), suivis jusqu'à nouvel ordre. */
  ordres?: Record<string, { ordre: Ordre; cible?: string }>;
}

export const AU_CONTACT = 3;
/** Cases parcourues à chaque tour. */
export const PAS = 2;
export const LARGEUR = 10;
export const HAUTEUR = 5;

const aCompetence = (p: Partie, nom: string) => {
  const c = calculerFiche(p.perso).competences;
  return [...c.naissance, ...c.heritees, ...c.choisies].some((n) => cleCompetence(n) === cleCompetence(nom));
};

/** Esquive, modificateurs conseillés sur l'Adresse selon la PR (règles V4, 8.18). Null : impossible. */
export const modEsquive = (pr: number): number | null =>
  pr <= 1 ? 1 : pr === 2 ? 0 : pr <= 4 ? -2 : pr === 5 ? -4 : pr === 6 ? -5 : pr === 7 ? -6 : null;

const deuxiemeArme = (p: Partie): Combattant['mainGauche'] => {
  const g = mainGauche(p);
  if (!g || 'refus' in g) return undefined;
  return { nom: g.arme.nom, at: g.at, degats: g.degats, famille: familleObjet(g.arme), rupture: g.arme.rupture };
};

export const creerHeros = (p: Partie, id = 'heros', evMax?: number): Combattant => {
  const v = valeursCombat(p);
  const armee = !!p.equipe.arme;
  const bourrePif = aCompetence(p, 'Bourre-pif');
  const arme = p.equipe.arme ? objet(p.equipe.arme) : undefined;
  // Blessures graves en cours : déplacement réduit.
  const mv = Math.min(1, ...(p.blessures ?? []).filter((b) => b.jusqua === undefined || b.jusqua > p.jour).map((b) => b.mv ?? 1));
  return {
    id,
    nom: p.perso.nom,
    camp: 'heros',
    x: 0,
    y: 0,
    // À mains nues (8.10) : AT −4 et 1D−2 de dégâts, sauf avec Bourre-pif (1D + bonus de FO).
    at: armee || bourrePif ? v.at : v.at - 4,
    prd: v.prd,
    ad: v.ad,
    pr: v.pr,
    cou: v.cou,
    degats: armee ? v.degats : bourrePif ? v.degats.replace(/^1D-2/, '1D') : v.degats,
    ev: p.ev,
    evMax: evMax ?? calculerFiche(p.perso).ev,
    xp: 0,
    etat: 'actif',
    sansParade: !armee,
    rate: 0,
    defendu: false,
    famille: familleObjet(arme),
    rupture: arme?.rupture,
    bourrePif,
    mv: mv < 1 ? Math.round(PAS * mv) : undefined,
    mainGauche: deuxiemeArme(p),
    talents: {
      vicieux: aCompetence(p, 'Vicieux'),
      superEsquive: aCompetence(p, 'Super esquive'),
      esquiveNaturelle: aCompetence(p, 'Esquive naturelle'),
      bricABrac: aCompetence(p, 'Bric-à-brac'),
      prNaturelle: aCompetence(p, 'Truc de mauviette') ? 1 : 0,
      rempailleur: aCompetence(p, 'Chance du rempailleur'),
      renforts: aCompetence(p, 'Appel des renforts'),
      poubelles: aCompetence(p, 'Fouiller dans les poubelles'),
    },
  };
};

/** « Armé d'un arc et d'une dague - AD 11 », « Arc : 1D+3, AD : 9 » : un tireur, avec son Adresse et ses dégâts au tir. */
const tireurDe = (notes: string, degats: string, ad: number) => {
  if (!/\barc\b|arbalète/i.test(notes)) return undefined;
  const d = /Arc\s*:\s*(\d*D[+-]?\d*)/i.exec(notes)?.[1];
  const a = Number(/AD\s*:?\s*(\d+)/.exec(notes)?.[1] ?? ad);
  return { ad: a, degats: d ?? degats.replace('*', '') };
};

/** Un compagnon du héros, avec sa fiche et son équipement. */
export const creerCompagnon = (p: Partie, e: EtatCompagnon): Combattant => {
  const x = creerHeros(vueCompagnon(p, e), `c-${e.id}`, e.evMax);
  const t = tirCompagnon(p, e);
  return { ...x, compagnon: e.id, tireur: t ? { ad: t.ad, degats: t.degats } : undefined };
};

const depuisLignes = (groupes: { ligne: LigneRencontre; nombre: number }[], camp: Camp, prefixe: string): Combattant[] => {
  const tous = groupes.flatMap(({ ligne: l, nombre }) => {
    const ad = Number(/AD (\d+)/.exec(l.notes)?.[1] ?? 10);
    const base = singulier(l);
    return Array.from({ length: nombre }, (_, i) => ({
      nom: nombre > 1 ? `${base} ${i + 1}` : base,
      camp,
      x: 0,
      y: 0,
      at: l.at,
      prd: l.prd,
      ad,
      pr: l.pr,
      cou: l.cou,
      degats: l.degats.replace('*', ''),
      ev: l.ev,
      evMax: l.ev,
      xp: l.xp,
        imparable: /parade impossible/i.test(l.notes),
      poison: /poison/i.test(l.notes),
      tireur: tireurDe(l.notes, l.degats, ad),
      famille: familleMonstre(l.nom, l.notes),
      bourrePif: true,
      rate: 0,
      defendu: false,
    }));
  });
  return tous.map((c, i) => ({ ...c, id: `${prefixe}${i + 1}`, etat: 'actif' as Etat, allie: camp === 'heros' || undefined }));
};

export const creerEnnemis = (r: Rencontre): Combattant[] => depuisLignes([{ ligne: r.ligne, nombre: r.nombre }, ...(r.avec ?? [])], 'ennemi', 'e');

/** Ordre d'initiative : Courage, puis Adresse ; le héros qui cherche des noises frappe toujours le premier. */
export const initiative = (cs: Combattant[], noises = false): string[] =>
  [...cs]
    .sort((a, b) => {
      if (noises && (a.camp === 'heros') !== (b.camp === 'heros')) return a.camp === 'heros' ? -1 : 1;
      return b.cou - a.cou || b.ad - a.ad || (a.camp === 'heros' ? -1 : b.camp === 'heros' ? 1 : 0);
    })
    .map((c) => c.id);

/**
 * Place les deux camps face à face : le héros et les siens à gauche, les ennemis à droite, à autant
 * d'assauts de marche que l'approche de la rencontre (au contact s'ils attaquent par surprise).
 */
const placer = (c: Combat, approche: number) => {
  const lignes = [2, 1, 3, 0, 4];
  const ranger = (cs: Combattant[], colonne: number, sens: 1 | -1) =>
    cs.forEach((x, i) => {
      x.x = Math.max(0, Math.min(c.largeur - 1, colonne + sens * Math.floor(i / c.hauteur)));
      x.y = lignes[i % c.hauteur];
    });
  const amis = c.combattants.filter((x) => x.camp === 'heros');
  // Les tireurs restent en retrait, les autres en première ligne.
  ranger([...amis.filter((x) => !x.tireur || x.id === 'heros'), ...amis.filter((x) => x.tireur && x.id !== 'heros')], 1, -1);
  ranger(ennemis(c), Math.min(c.largeur - 1, 2 + PAS * approche), 1);
};

export const creerCombat = (p: Partie, r: Rencontre): Combat => {
  const compagnons = (p.compagnons ?? []).filter((e) => e.ev > 0).map((e) => creerCompagnon(p, e));
  const allies = depuisLignes(r.allies ?? [], 'heros', 'a');
  const ennemisDuCombat = creerEnnemis(r);
  const combattants = [creerHeros(p), ...compagnons, ...allies, ...ennemisDuCombat];
  const ordre = initiative(combattants, aCompetence(p, 'Chercher des noises'));
  const c: Combat = {
    combattants,
    // Surprise : les ennemis frappent les premiers.
    ordre: r.surprise ? [...ordre.filter((id) => id.startsWith('e')), ...ordre.filter((id) => !id.startsWith('e'))] : ordre,
    tour: 0,
    assaut: 1,
    journal: [],
    largeur: LARGEUR,
    hauteur: HAUTEUR,
    recharge: 0,
    projectiles: [],
  };
  placer(c, r.surprise ? 0 : (r.approche ?? 2));
  return c;
};

export const combattant = (c: Combat, id: string) => c.combattants.find((x) => x.id === id)!;
export const heros = (c: Combat) => combattant(c, 'heros');
export const ennemis = (c: Combat) => c.combattants.filter((x) => x.camp === 'ennemi');
/** Le camp du héros : lui, ses compagnons et ses alliés. */
export const amis = (c: Combat) => c.combattants.filter((x) => x.camp === 'heros');
export const enLice = (x: Combattant) => x.etat === 'actif';
export const adversaires = (c: Combat, x: Combattant) => c.combattants.filter((y) => y.camp !== x.camp && enLice(y));

// --- Le terrain ------------------------------------------------------------------------------------

/** Distance en cases (les diagonales comptent pour une). */
export const ecart = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
export const voisins = (a: Combattant, b: Combattant) => ecart(a, b) === 1;
/** Les adversaires au contact de ce combattant. */
export const contacts = (c: Combat, x: Combattant) => adversaires(c, x).filter((y) => voisins(x, y));
/** Ennemis au contact du héros. */
export const auContact = (c: Combat) => contacts(c, heros(c));
export const occupant = (c: Combat, x: number, y: number) => c.combattants.find((z) => enLice(z) && z.x === x && z.y === y);

/** Cases où ce combattant peut aller ce tour-ci (sans traverser personne), avec leur distance en pas. */
export const casesAccessibles = (c: Combat, x: Combattant, pas = x.mv ?? PAS): Map<string, number> => {
  const vues = new Map<string, number>([[`${x.x},${x.y}`, 0]]);
  let front = [[x.x, x.y]];
  for (let d = 1; d <= pas; d++) {
    const suivant: number[][] = [];
    for (const [cx, cy] of front)
      for (let dx = -1; dx <= 1; dx++)
        for (let dy = -1; dy <= 1; dy++) {
          const nx = cx + dx;
          const ny = cy + dy;
          const k = `${nx},${ny}`;
          if (nx < 0 || ny < 0 || nx >= c.largeur || ny >= c.hauteur || vues.has(k) || occupant(c, nx, ny)) continue;
          vues.set(k, d);
          suivant.push([nx, ny]);
        }
    front = suivant;
  }
  vues.delete(`${x.x},${x.y}`);
  return vues;
};

export const deplacer = (c: Combat, id: string, x: number, y: number): boolean => {
  const z = combattant(c, id);
  if (!casesAccessibles(c, z).has(`${x},${y}`)) return false;
  z.x = x;
  z.y = y;
  c.deplace = true;
  return true;
};

/** Ce que fait un combattant qui joue seul (ennemi, compagnon, allié) : où il va, puis qui il frappe ou vise. */
export interface Plan {
  vers?: { x: number; y: number };
  cible?: string;
  tir?: boolean;
}

export const planifier = (c: Combat, x: Combattant): Plan => {
  let opp = adversaires(c, x);
  if (!opp.length) return {};
  // Un compagnon qui a accepté un ordre s'y tient : une cible désignée, ceux qui menacent le héros, ou rester à distance.
  const ord = c.ordres?.[x.id];
  if (ord?.ordre === 'cible') {
    const v = opp.find((y) => y.id === ord.cible);
    if (v) opp = [v];
  }
  if (ord?.ordre === 'proteger') {
    const h = c.combattants.find((y) => y.id === 'heros');
    const menaces = h ? contacts(c, h).filter((y) => y.camp !== x.camp) : [];
    if (menaces.length) opp = menaces;
  }
  if (ord?.ordre === 'distance') {
    const proches = contacts(c, x);
    if (proches.length) return { cible: proches.sort((a, b) => a.ev - b.ev)[0].id };
    if (x.tireur) return { cible: [...opp].sort((a, b) => ecart(x, a) - ecart(x, b))[0].id, tir: true };
    return {};
  }
  // Le plus faible de ceux qui sont au contact (le héros d'abord, pour les ennemis : c'est lui qu'ils veulent).
  const choisir = (cs: Combattant[]) =>
    [...cs].sort((a, b) => (x.camp === 'ennemi' ? Number(b.id === 'heros') - Number(a.id === 'heros') : 0) || a.ev - b.ev)[0];
  const proches = contacts(c, x);
  const vises = proches.filter((y) => opp.includes(y));
  if (vises.length) return { cible: choisir(vises).id };
  // Au contact d'un autre que celui qu'on lui a désigné : il ne peut pas filer, il frappe ce qu'il a devant lui.
  if (proches.length) return { cible: choisir(proches).id };
  if (x.tireur) return { cible: [...opp].sort((a, b) => ecart(x, a) - ecart(x, b))[0].id, tir: true };
  // Sinon il marche vers l'adversaire le plus proche qui n'a pas déjà trois ennemis sur le dos.
  const libres = opp.filter((o) => contacts(c, o).length < AU_CONTACT);
  const cibles = (libres.length ? libres : opp).sort((a, b) => ecart(x, a) - ecart(x, b));
  const cases = [...casesAccessibles(c, x).keys()].map((k) => k.split(',').map(Number));
  for (const o of cibles) {
    const aCote = cases.filter(([cx, cy]) => ecart({ x: cx, y: cy }, o) === 1).sort((a, b) => ecart({ x: a[0], y: a[1] }, x) - ecart({ x: b[0], y: b[1] }, x));
    if (aCote.length) return { vers: { x: aCote[0][0], y: aCote[0][1] }, cible: o.id };
  }
  const o = cibles[0];
  const meilleure = cases.sort((a, b) => ecart({ x: a[0], y: a[1] }, o) - ecart({ x: b[0], y: b[1] }, o))[0];
  return meilleure && ecart({ x: meilleure[0], y: meilleure[1] }, o) < ecart(x, o) ? { vers: { x: meilleure[0], y: meilleure[1] } } : {};
};
export const acteur = (c: Combat) => combattant(c, c.ordre[c.tour]);

const jet = (de: number, valeur: number): IssueJet =>
  de === 1 ? 'critique' : de === 20 ? 'maladresse' : de <= valeur ? 'reussi' : 'rate';

/** Valeur de défense, ou null si ce mode est impossible contre cet attaquant. */
export const valeurDefense = (cible: Combattant, mode: ModeDefense, attaquant?: Combattant): number | null => {
  if (mode === 'esquive') {
    // Bric-à-brac : l'armure ne gêne pas l'esquive.
    const m = cible.talents?.bricABrac ? Math.max(0, modEsquive(cible.pr) ?? 0) : modEsquive(cible.pr);
    return m === null ? null : cible.ad + m;
  }
  if (cible.sansParade || attaquant?.imparable) return null;
  return cible.prd;
};

/** La cible peut-elle encore se défendre de ce coup (ni critique, ni déjà défendue cet assaut) ? */
export const peutSeDefendre = (cible: Combattant, deAttaque: number, valeurAttaque: number) =>
  !cible.defendu && !cible.inconscient && jet(deAttaque, valeurAttaque) === 'reussi';

// --- Critiques et maladresses (tables de l'écran Baston, voir critiques.ts) -----------------------

/** Lance un D20 sur une table et le note dans l'action, pour l'afficher. */
const tirage = <T extends { de: [number, number]; texte: string; effet: string }>(
  action: Action,
  lanceur: Combattant,
  table: { nom: string; lignes: T[] },
  rng?: Rng,
): T => {
  const d = lancer(20, rng);
  const l = ligne(table.lignes, d);
  (action.tables ??= []).push({ lanceur: lanceur.id, table: table.nom, de: d, texte: l.texte, effet: l.effet });
  return l;
};

/** Un coup porté par `a` sur `x` : dégâts de son arme (plus un bonus), moins l'armure, sauf sur un critique. */
const coup = (a: Combattant, x: Combattant, rng: Rng | undefined, o: { critique?: boolean; bonus?: number; expr?: string } = {}) => {
  const expr = o.expr ?? a.degats;
  const j = lancerExpression(expr, rng);
  const total = Math.max(0, j.total + (o.bonus ?? 0));
  const pr = o.critique ? (x.talents?.prNaturelle ?? 0) : x.pr;
  const blessure = Math.max(0, total - pr);
  x.ev -= blessure;
  // « −4 PV (1D+3 : 6, moins 2 d'armure) » : le détail du jet, pour qu'on suive le calcul.
  return `−${blessure} PV (${expr}${o.bonus ? ` +${o.bonus}` : ''} : ${total}${pr ? `, moins ${pr} d'armure` : o.critique ? ', armure ignorée' : ''})`;
};

const tuer = (x: Combattant, effets: string[]) => {
  x.ev = Math.min(x.ev, 0);
  effets.push(`${x.nom} ne s'en relèvera pas.`);
};

/** Une blessure grave : ses malus comptent tout de suite (AT, PRD, AD, COU, déplacement). */
const blesser = (x: Combattant, b: BlessureGrave, effets: string[]) => {
  x.at += b.mods.AT ?? 0;
  x.prd += b.mods.PRD ?? 0;
  x.ad += b.mods.AD ?? 0;
  x.cou += b.mods.COU ?? 0;
  if (b.mv !== undefined) x.mv = Math.min(x.mv ?? PAS, Math.round(PAS * b.mv));
  (x.blessures ??= []).push(b);
  effets.push(`Blessure grave pour ${x.nom} : ${b.nom.toLowerCase()}, ${decrireBlessure(b)}.`);
};

/** Assommé : un ennemi est hors de combat ; un héros ou un compagnon reste sans connaissance 1D6+4 assauts. */
const assommer = (x: Combattant, effets: string[], rng?: Rng) => {
  if (x.camp === 'ennemi') {
    x.ev = Math.min(x.ev, 0);
    effets.push(`${x.nom} s'écroule, assommé : il ne se relèvera pas avant la fin du combat.`);
    return;
  }
  const n = lancer(6, rng) + 4;
  x.inconscient = n;
  x.rate = Math.max(x.rate, n);
  effets.push(`${x.nom} perd connaissance pour ${n} assauts, sans défense en attendant.`);
};

/** Le combattant n'a plus d'arme : mains nues (AT −4, 1D−2, pas de parade ; Bourre-pif : pas de malus, 1D). */
const desarmer = (c: Combat, x: Combattant, cassee: boolean, effets: string[]) => {
  if (x.famille === 'mains-nues' || x.famille === 'bete' || x.famille === 'griffes') {
    effets.push(`${x.nom} n'a pas d'arme à perdre.`);
    return;
  }
  if (cassee && x.id === 'heros') (c.armesCassees ??= []).push('arme');
  const pif = x.camp === 'heros' && !x.allie && x.bourrePif;
  x.famille = 'mains-nues';
  x.degats = pif ? '1D' : '1D-2';
  if (!pif) x.at -= 4;
  x.sansParade = true;
  effets.push(
    cassee
      ? `L'arme de ${x.nom} se brise : il continue à mains nues.`
      : `${x.nom} lâche son arme et continue à mains nues${x.id === 'heros' ? ' (tu la ramasseras après le combat)' : ''}.`,
  );
};

/** Plus de tir pour ce combat : l'arc ou l'arme de jet est tombé, ou cassé. */
const perdreTir = (c: Combat, x: Combattant, cassee: boolean, effets: string[]) => {
  if (x.id === 'heros') {
    c.tirPerdu = true;
    if (cassee) (c.armesCassees ??= []).push('distance');
  } else x.tireur = undefined;
  effets.push(cassee ? `L'arme de tir de ${x.nom} est cassée.` : `${x.nom} lâche son arme de tir : plus de tir pour ce combat.`);
};

/** Casse son arme… ou pas : D6 contre le point de rupture du tableau de l'armement. */
const casser = (c: Combat, x: Combattant, effets: string[], rng: Rng | undefined, tir?: { rupture?: string }) => {
  if (!tir && (x.famille === 'mains-nues' || x.famille === 'bete' || x.famille === 'griffes')) return desarmer(c, x, true, effets);
  const d6 = lancer(6, rng);
  if (!armeCasse(tir ? tir.rupture : x.rupture, d6)) {
    effets.push(`Point de rupture (D6 : ${d6}) : l'arme tient le choc, ouf.`);
    return;
  }
  effets.push(`Point de rupture (D6 : ${d6}) : craac.`);
  if (tir) perdreTir(c, x, true, effets);
  else desarmer(c, x, true, effets);
};

/** L'allié qui prend le coup : à côté (à gauche ou à droite), ou le plus lointain. */
const allieDe = (c: Combat, x: Combattant, sens: 'gauche' | 'droite' | 'loin') => {
  const autres = c.combattants.filter((y) => y.camp === x.camp && y.id !== x.id && enLice(y));
  if (sens === 'loin') return autres.sort((a, b) => ecart(x, b) - ecart(x, a))[0];
  const proches = autres.filter((y) => ecart(x, y) <= 1).sort((a, b) => a.y - b.y);
  return sens === 'gauche' ? proches[0] : proches[proches.length - 1];
};

/**
 * Attaque critique : `a` lance un D20 sur la table de son arme. Les effets (armure, blessures, saignement…)
 * s'appliquent à `x` ; renvoie le bonus de dégâts et s'il en meurt.
 */
const critiqueSur = (c: Combat, action: Action, a: Combattant, x: Combattant, famille: Famille, rng?: Rng) => {
  const table = tableCritique(famille);
  if (!table) return { bonus: 0, deces: false };
  const l = tirage(action, a, table, rng);
  const effets = action.effets;
  if (l.armure) {
    const n = Math.min(x.pr, l.armure);
    x.pr -= n;
    effets.push(n ? `L'armure de ${x.nom} est abîmée : PR −${n} jusqu'à la fin du combat.` : `${x.nom} n'a pas d'armure à abîmer.`);
  }
  if (l.armureDetruite) {
    const n = Math.ceil(x.pr / 2);
    x.pr -= n;
    effets.push(n ? `Une pièce d'armure de ${x.nom} est détruite : PR −${n}.` : `${x.nom} n'a pas d'armure à détruire.`);
  }
  if (l.blessure) blesser(x, tirerBlessure(l.blessure, rng), effets);
  if (l.malus) {
    x.at += l.malus.AT ?? 0;
    x.prd += l.malus.PRD ?? 0;
    x.ad += l.malus.AD ?? 0;
    x.cou += l.malus.COU ?? 0;
    effets.push(`${x.nom} : ${l.effet.replace(/^Dégâts \+\d+, /, '')} jusqu'à la fin du combat.`);
  }
  if (l.mv !== undefined) {
    x.mv = Math.min(x.mv ?? PAS, Math.round(PAS * l.mv));
    effets.push(`${x.nom} boite : il se déplace moins vite.`);
  }
  if (l.hemorragie) {
    x.hemorragie ??= c.assaut;
    effets.push(`${x.nom} saigne abondamment : 1D6 PV par minute jusqu'à ce qu'on le soigne.`);
  }
  if (l.etourdi) {
    x.rate = Math.max(x.rate, l.etourdi);
    effets.push(`${x.nom} est étourdi pendant ${l.etourdi} assauts.`);
  }
  if (l.muet) effets.push(`${x.nom} a la mâchoire brisée : impossible de parler.`);
  if (l.inconscient) assommer(x, effets, rng);
  return { bonus: l.degats ?? 0, deces: !!l.deces };
};

/** Un coup critique porté avec l'arme de `a` (parade critique, maladresse atroce) : sans armure, plus la table. */
const coupCritique = (c: Combat, action: Action, a: Combattant, x: Combattant, rng?: Rng, tir?: { degats: string }) => {
  const k = critiqueSur(c, action, a, x, tir ? 'projectile' : a.famille, rng);
  action.effets.push(`${x.nom} : ${coup(a, x, rng, { critique: true, bonus: k.bonus, expr: tir?.degats })}.`);
  if (k.deces) tuer(x, action.effets);
};

/** Le héros a touché un compagnon par maladresse. */
const frappeAllie = (c: Combat, x: Combattant, y: Combattant, grave: boolean) => {
  if (x.id === 'heros' && y.compagnon) (c.frappesAllies ??= []).push({ id: y.compagnon, grave });
};

/** Maladresse (20 au D20) : le maladroit lance un D20 sur la table des maladresses de son arme. */
const maladresse = (
  c: Combat,
  action: Action,
  x: Combattant,
  rng: Rng | undefined,
  o: { esquive?: boolean; tir?: { degats: string; rupture?: string } } = {},
) => {
  const effets = action.effets;
  const table = o.esquive ? undefined : tableMaladresse(x.famille, !!o.tir);
  // Pas de table pour une esquive ratée, ni pour les bêtes : on perd l'équilibre.
  if (!table) {
    x.rate += 1;
    effets.push(`${x.nom} ${o.esquive ? 'glisse en esquivant' : "perd l'équilibre"} et ratera son prochain assaut.`);
    return;
  }
  const l = tirage(action, x, table, rng);
  if (l.rien) {
    effets.push(`${x.nom} se rattrape de justesse.`);
    return;
  }
  if (l.rate) {
    x.rate += l.rate;
    effets.push(`${x.nom} ratera ${l.rate} assauts.`);
  }
  if (l.pv) {
    x.ev -= l.pv;
    effets.push(`${x.nom} : −${l.pv} PV.`);
  }
  if (l.allie) {
    const y = allieDe(c, x, l.allie);
    effets.push(y ? `${y.nom} prend le coup de ${x.nom} : ${coup(x, y, rng, { expr: o.tir?.degats })}.` : 'Personne à côté : le coup part dans le vide.');
    if (y) frappeAllie(c, x, y, y.ev <= 0);
  }
  if (l.lache) {
    if (o.tir) perdreTir(c, x, false, effets);
    else desarmer(c, x, false, effets);
  }
  if (l.casse) casser(c, x, effets, rng, o.tir);
  if (l.seBlesse !== undefined) effets.push(`${x.nom} se blesse avec sa propre arme : ${coup(x, x, rng, { bonus: l.seBlesse, expr: o.tir?.degats })}.`);
  if (l.critiqueSurSoi) coupCritique(c, action, x, x, rng, o.tir);
  if (l.blessure) blesser(x, tirerBlessure(l.blessure, rng), effets);
  if (l.oeilOuDoigt) blesser(x, lancer(6, rng) <= 2 ? BLESSURES['oeil-creve'] : BLESSURES.doigt, effets);
  if (l.oeilAllie) {
    const y = allieDe(c, x, 'gauche');
    if (y) {
      blesser(y, BLESSURES['oeil-creve'], effets);
      frappeAllie(c, x, y, true);
    } else effets.push('Personne à côté, heureusement.');
  }
  if (l.inconscient) assommer(x, effets, rng);
};

/** Parade critique : le défenseur lance un D20 sur la table des parades critiques. */
const paradeCritique = (c: Combat, action: Action, def: Combattant, a: Combattant, rng?: Rng) => {
  const l = tirage(action, def, { nom: 'Parade critique', lignes: PARADE_CRITIQUE }, rng);
  const effets = action.effets;
  if (l.rien) effets.push(`${def.nom} pare, sans plus.`);
  if (l.rate) {
    a.rate += l.rate;
    effets.push(`${a.nom} est repoussé et ratera son prochain assaut.`);
  }
  for (let i = 0; i < (l.imparables ?? 0); i++) {
    const d = lancer(20, rng);
    const touche = d === 1 || (d !== 20 && d <= def.at);
    effets.push(`Coup imparable de ${def.nom} (D20 : ${d}) : ${touche ? `${a.nom} ${coup(def, a, rng)}` : 'raté'}.`);
  }
  if (l.lache) desarmer(c, a, false, effets);
  if (l.casse) desarmer(c, a, true, effets);
  if (l.coup) effets.push(`${a.nom} reçoit un coup de ${def.nom} : ${coup(def, a, rng)}.`);
  if (l.critique) coupCritique(c, action, def, a, rng);
  if (l.critiqueSurSoi) coupCritique(c, action, a, a, rng);
};

/**
 * Résout une attaque. Le dé d'attaque est fourni (celui du joueur, ou celui tiré pour le monstre) ;
 * la défense aussi quand c'est le joueur qui la lance, sinon elle est tirée ici.
 */
export const attaquer = (
  c: Combat,
  idAttaquant: string,
  idCible: string,
  de: number,
  options: { defense?: { mode: ModeDefense; de: number }; encaisser?: boolean; rng?: Rng; desDegats?: number[] } = {},
): Action => {
  const a = combattant(c, idAttaquant);
  const cible = combattant(c, idCible);
  const { rng } = options;
  const action: Action = { attaquant: a.id, cible: cible.id, de, valeur: a.at, issue: jet(de, a.at), effets: [] };
  // Sans Bourre-pif, pas de coup critique à mains nues : le 1 est une simple réussite.
  if (action.issue === 'critique' && a.famille === 'mains-nues' && !a.bourrePif) {
    action.issue = 'reussi';
    action.effets.push('Pas de coup critique à mains nues sans Bourre-pif.');
  }

  if (action.issue === 'rate') return action;
  if (action.issue === 'maladresse') {
    maladresse(c, action, a, rng);
    return action;
  }

  const critique = action.issue === 'critique';
  if (critique) action.sansDefense = 'attaque critique, impossible à parer';
  else if (cible.inconscient) action.sansDefense = 'sans connaissance';
  else if (cible.defendu) action.sansDefense = 'déjà occupé à se défendre pendant cet assaut';
  // Encaisser : on serre les dents sans parer ni esquiver, mais on garde son attaque suivante.
  else if (options.encaisser) action.sansDefense = 'encaisse le coup en serrant les dents';
  else {
    // Les monstres parent ; ceux qui ne le peuvent pas (PRD nulle) esquivent comme ils peuvent.
    const mode: ModeDefense = options.defense?.mode ?? (valeurDefense(cible, 'parade', a) === null ? 'esquive' : 'parade');
    const valeur = valeurDefense(cible, mode, a);
    if (valeur === null) action.sansDefense = mode === 'parade' ? 'impossible de parer' : "trop d'armure pour esquiver";
    else {
      const d = options.defense?.de ?? lancer(20, rng);
      let issue = jet(d, valeur);
      // Super esquive : jamais de maladresse en esquivant.
      if (mode === 'esquive' && issue === 'maladresse' && cible.talents?.superEsquive) issue = 'rate';
      action.defense = { mode, de: d, valeur, issue };
      cible.defendu = true;
      if (mode === 'esquive' && issue !== 'critique') {
        // Super esquive : on attaque quand même ; Esquive naturelle : sur 4 à 6 au D6.
        const t = cible.talents;
        const d6 = t?.esquiveNaturelle && !t.superEsquive ? lancer(6, rng) : 0;
        if (t?.superEsquive) action.effets.push(`Super esquive : ${cible.nom} reste en position d'attaquer.`);
        else if (d6 >= 4) action.effets.push(`Esquive naturelle (D6 : ${d6}) : ${cible.nom} pourra attaquer quand même.`);
        else cible.rate = Math.max(cible.rate, 1);
      }
      if (issue === 'critique' && mode === 'parade') paradeCritique(c, action, cible, a, rng);
      if (issue === 'critique' && mode === 'esquive') action.effets.push(`Esquive critique : ${cible.nom} reste au contact et pourra attaquer.`);
      if (issue === 'maladresse') maladresse(c, action, cible, rng, { esquive: mode === 'esquive' });
      if (issue === 'critique' || issue === 'reussi') return action;
    }
  }

  // Attaque critique : table de l'arme (bonus de dégâts, blessures graves…).
  const k = critique ? critiqueSur(c, action, a, cible, a.famille, rng) : { bonus: 0, deces: false };
  // Dégâts : au D6, moins la PR (pas sur une attaque critique).
  const j = options.desDegats ? { des: options.desDegats, total: 0 } : lancerExpression(a.degats, rng);
  if (options.desDegats) {
    const fixe = Number(/[+-]\d+$/.exec(a.degats)?.[0] ?? 0);
    j.total = Math.max(0, options.desDegats.reduce((s, x) => s + x, 0) + fixe);
  }
  // Frapper lâchement : dégâts doublés, une fois.
  if (a.lachement) {
    j.total *= 2;
    a.lachement = false;
    action.effets.push(`Frappé lâchement : dégâts doublés (${j.total}).`);
  }
  j.total += k.bonus;
  // Critique : l'armure ne compte pas, sauf la protection naturelle (Truc de mauviette). Vicieux : 1 point d'armure ignoré.
  const pr = Math.max(0, (critique ? (cible.talents?.prNaturelle ?? 0) : cible.pr) - (a.talents?.vicieux ? 1 : 0));
  const blessure = Math.max(0, j.total - pr);
  action.degats = { des: j.des, total: j.total, pr, blessure, bonus: k.bonus || undefined };
  if (a.poison && blessure > 0) {
    const poison = lancerExpression('1D', rng);
    action.degats.poison = poison.des;
    action.degats.blessure += poison.total;
  }
  cible.ev -= action.degats.blessure;
  if (k.deces) tuer(cible, action.effets);
  return action;
};

/**
 * Deuxième attaque de l'ambidextre, avec l'arme de la main gauche (AT −5) : on prête au combattant les valeurs
 * de sa deuxième arme le temps du coup. Les critiques et maladresses suivent la table de cette arme.
 */
export const attaquerMainGauche = (c: Combat, idAttaquant: string, idCible: string, de: number, rng?: Rng): Action => {
  const a = combattant(c, idAttaquant);
  const g = a.mainGauche!;
  const droite = { at: a.at, degats: a.degats, famille: a.famille, rupture: a.rupture, sansParade: a.sansParade };
  const cassees = c.armesCassees?.length ?? 0;
  Object.assign(a, { at: g.at, degats: g.degats, famille: g.famille, rupture: g.rupture });
  const action = attaquer(c, idAttaquant, idCible, de, { rng });
  // Ce qui a changé l'AT pendant le coup (blessure grave…) compte pour les deux mains ; pas le passage à mains nues.
  const desarme = a.famille === 'mains-nues';
  const delta = a.at - g.at + (desarme && a.degats === '1D-2' ? 4 : 0);
  // C'est la deuxième arme qui est cassée, pas celle de la main droite.
  if (c.armesCassees && c.armesCassees.length > cassees) c.armesCassees[c.armesCassees.length - 1] = 'armeGauche';
  Object.assign(a, droite);
  a.at += delta;
  if (desarme) {
    a.mainGauche = undefined;
    action.effets.push('Plus de deuxième arme : fini les attaques des deux mains.');
  } else g.at += delta;
  return action;
};

/** Met à jour les morts, fait monter les ennemis de réserve au contact et détecte la fin du combat. */
export const verifier = (c: Combat) => {
  for (const x of c.combattants) {
    if (x.ev <= 0 && (x.etat === 'actif' || x.etat === 'reserve')) {
      x.ev = 0;
      x.etat = 'mort';
      if (x.id !== 'heros') c.journal.push(x.camp === 'ennemi' ? `${x.nom} s'effondre.` : `${x.nom} tombe, assommé.`);
    }
  }
  if (heros(c).etat === 'mort') c.fin = 'defaite';
  else if (!ennemis(c).some(enLice)) c.fin = 'victoire';
};

/** Passe au combattant suivant ; un nouvel assaut remet les défenses à zéro. */
export const tourSuivant = (c: Combat) => {
  c.tour += 1;
  c.deplace = false;
  if (c.tour >= c.ordre.length) {
    c.tour = 0;
    c.assaut += 1;
    for (const x of c.combattants) {
      x.defendu = false;
      if (x.inconscient) x.inconscient -= 1;
      // Hémorragie : 1D6 PV par minute (30 assauts de 2 secondes).
      if (x.hemorragie !== undefined && enLice(x) && (c.assaut - x.hemorragie) % 30 === 0) {
        const d = lancer(6);
        x.ev -= d;
        c.journal.push(`${x.nom} saigne : −${d} PV.`);
      }
    }
    c.recharge = Math.max(0, c.recharge - 1);
  }
};

/**
 * Un tir (règles V4, 8.11) : épreuve d'Adresse du tireur. Pas de parade possible sans bouclier ;
 * critique : l'armure est ignorée, comme au contact ; maladresse : table de maladresse du jeu.
 */
export const tirer = (
  c: Combat,
  idTireur: string,
  idCible: string,
  de: number,
  tir: { ad: number; degats: string; rupture?: string },
  options: { rng?: Rng; desDegats?: number[] } = {},
): Action => {
  const a = combattant(c, idTireur);
  const cible = combattant(c, idCible);
  const action: Action = { attaquant: a.id, cible: cible.id, de, valeur: tir.ad, issue: jet(de, tir.ad), effets: [], tir: true };
  if (action.issue === 'rate') return action;
  if (action.issue === 'maladresse') {
    maladresse(c, action, a, options.rng, { tir });
    return action;
  }
  const critique = action.issue === 'critique';
  action.sansDefense = critique ? 'tir critique, en plein dans le mille' : 'on ne pare pas un projectile sans bouclier';
  // Tir critique : table des projectiles.
  const k = critique ? critiqueSur(c, action, a, cible, 'projectile', options.rng) : { bonus: 0, deces: false };
  const j = options.desDegats ? { des: options.desDegats, total: 0 } : lancerExpression(tir.degats, options.rng);
  if (options.desDegats) j.total = Math.max(0, options.desDegats.reduce((s, x) => s + x, 0) + Number(/[+-]\d+$/.exec(tir.degats)?.[0] ?? 0));
  j.total += k.bonus;
  const pr = Math.max(0, (critique ? (cible.talents?.prNaturelle ?? 0) : cible.pr) - (a.talents?.vicieux ? 1 : 0));
  const blessure = Math.max(0, j.total - pr);
  action.degats = { des: j.des, total: j.total, pr, blessure, bonus: k.bonus || undefined };
  cible.ev -= blessure;
  if (k.deces) tuer(cible, action.effets);
  return action;
};

/** Dégâts d'un sort sur une cible : au D6, doublés sur une réussite critique, moins l'armure. */
export const toucherParSort = (c: Combat, idCible: string, degats: string, critique: boolean, rng?: Rng): Action => {
  const cible = combattant(c, idCible);
  const j = lancerExpression(degats, rng);
  const total = critique ? j.total * 2 : j.total;
  const blessure = Math.max(0, total - cible.pr);
  cible.ev -= blessure;
  return {
    attaquant: 'heros',
    cible: idCible,
    de: 0,
    valeur: 0,
    issue: critique ? 'critique' : 'reussi',
    effets: [],
    sort: true,
    degats: { des: j.des, total, pr: cible.pr, blessure },
  };
};

/** Un monstre très blessé (3 PV ou moins) panique : 1 à 3 sur le D6, il prend la fuite. */
export const panique = (c: Combat, x: Combattant, rng?: Rng): boolean => {
  if (x.camp !== 'ennemi' || x.ev > 3) return false;
  const d = lancer(6, rng);
  if (d > 3) return false;
  x.etat = 'fui';
  c.journal.push(`${x.nom}, en sang, panique et s'enfuit (D6 : ${d}).`);
  verifier(c);
  return true;
};

/** Le héros tente de fuir en plein combat : épreuve d'Adresse (Appel des renforts : sans épreuve). */
/** Après la bataille, les compagnons assommés se relèvent avec 1 PV ; leurs PV restants sont gardés. */
export const bilanCompagnons = (c: Combat, p: Partie) => {
  for (const e of p.compagnons ?? []) {
    const x = c.combattants.find((y) => y.compagnon === e.id);
    if (x) e.ev = Math.max(1, x.ev);
  }
};

export const tenterFuite = (c: Combat, de: number): boolean => {
  const h = heros(c);
  const ok = !!h.talents?.renforts || de === 1 || (de !== 20 && de <= h.ad);
  if (ok) c.fin = 'fuite';
  return ok;
};

export const xpGagnee = (c: Combat) =>
  ennemis(c)
    .filter((x) => x.etat === 'mort' || x.etat === 'fui')
    .reduce((s, x) => s + x.xp, 0);

/** Fouille chaque ennemi resté à terre (ceux qui ont fui emportent leurs affaires). */
export const butin = (c: Combat, rng?: Rng): Fouille[] =>
  ennemis(c)
    .filter((x) => x.etat === 'mort')
    .map((x) => {
      const f = fouiller(x.nom, rng);
      if (!heros(c).talents?.poubelles) return f;
      // Fouiller dans les poubelles : deux fouilles, on garde la meilleure (D20 le plus haut).
      const g = fouiller(x.nom, rng);
      return (g.de ?? 0) > (f.de ?? 0) ? { ...g, poubelles: true } : { ...f, poubelles: true };
    });
