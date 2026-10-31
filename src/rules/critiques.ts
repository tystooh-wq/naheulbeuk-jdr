import { lancer, type Rng } from './des';
import type { Objet } from './objets';

// Tables des critiques et maladresses de l'écran « Baston » (V3.5), et conséquences des blessures graves (V2.5).
// Attaque critique (1 au D20) : imparable, l'armure ne compte pas, et l'attaquant lance un D20 sur la table de son arme.
// Maladresse (20 au D20) : le maladroit lance un D20 sur la table des maladresses. Parade critique : le défenseur lance
// un D20 sur la table des parades critiques. Les animaux n'ont pas de table (bestiaire : « éviter d'utiliser les tables
// lorsqu'elles ne sont pas adaptées ») : leur critique est imparable et ignore l'armure, leur maladresse les déséquilibre.

/** La famille d'arme décide de la table de critiques et de maladresses. */
export type Famille = 'tranchante' | 'contondante' | 'projectile' | 'mains-nues' | 'griffes' | 'bete';

export type CaracBlessure = 'AD' | 'CHA' | 'COU' | 'FO' | 'AT' | 'PRD' | 'INT';

export interface BlessureGrave {
  nom: string;
  mods: Partial<Record<CaracBlessure, number>>;
  /** Déplacement restant, en part du normal (0,5 : moitié). */
  mv?: number;
  /** Durée en jours ; absente : permanent. */
  jours?: number;
}

const B = (nom: string, mods: BlessureGrave['mods'], jours?: number, mv?: number): BlessureGrave => ({ nom, mods, jours, mv });

/** Conséquences des blessures graves (écran, V2.5). La deuxième « Bras droit tranché » de l'écran est le bras gauche. */
export const BLESSURES: Record<string, BlessureGrave> = {
  'oeil-creve': B('Un œil crevé', { AD: -1, CHA: -3, AT: -1, PRD: -2 }),
  'yeux-creves': B('Tous les yeux crevés', { AD: -6, CHA: -6, COU: -6, AT: -5, PRD: -8 }),
  'genou-luxe': B('Genou luxé', { AD: -2, AT: -1, PRD: -2 }, 7, 0.5),
  'epaule-droite-luxee': B('Coude ou épaule droite luxé', { AD: -2, FO: -2, AT: -3, PRD: -3 }, 7),
  'epaule-gauche-luxee': B('Coude ou épaule gauche luxé', { AD: -1, FO: -1, AT: -1, PRD: -2 }, 7),
  'pied-ecrase': B('Pied écrasé', { AD: -2, AT: -2, PRD: -2 }, 14, 0.5),
  // Le pied tranché n'a pas de ligne : celle du pied écrasé, pour toujours.
  'pied-tranche': B('Pied tranché', { AD: -2, AT: -2, PRD: -2 }, undefined, 0.5),
  'jambe-cassee': B('Une jambe cassée', { AD: -4, COU: -3, FO: -3, AT: -4, PRD: -6 }, 21, 0.25),
  'jambe-tranchee': B('Une jambe tranchée', { AD: -4, COU: -3, FO: -3, AT: -4, PRD: -6 }, undefined, 0.25),
  'bras-droit-casse': B('Bras droit cassé', { AD: -4, COU: -2, FO: -4, AT: -5, PRD: -6 }, 21),
  'bras-droit-tranche': B('Bras droit tranché', { AD: -2, COU: -4, FO: -4, AT: -5, PRD: -6, CHA: -5 }),
  'main-droite-cassee': B('Main droite cassée', { AD: -4, COU: -1, FO: -2, AT: -5, PRD: -6 }, 21),
  'main-droite-tranchee': B('Main droite tranchée', { AD: -4, COU: -1, FO: -2, AT: -5, PRD: -6 }),
  'bras-gauche-casse': B('Bras gauche cassé', { AD: -2, COU: -1, FO: -2, AT: -2, PRD: -3 }, 21),
  'bras-gauche-tranche': B('Bras gauche tranché', { AD: -2, COU: -2, FO: -2, AT: -3, PRD: -4 }),
  'main-gauche-cassee': B('Main gauche cassée', { AD: -2, COU: -1, FO: -1, AT: -2, PRD: -3 }, 21),
  'main-gauche-tranchee': B('Main gauche tranchée', { AD: -2, COU: -1, FO: -1, AT: -2, PRD: -3 }),
  'organes-genitaux': B('Organes génitaux endommagés', { AD: -2, COU: -5 }, undefined, 0.5),
  doigt: B("Perte d'un doigt", { AD: -2 }, 30),
};

/** Une ligne de table : l'effet et ce qu'il fait en jeu. */
export interface Ligne {
  de: [number, number];
  texte: string;
  /** Ce qu'en dit la colonne de droite de l'écran. */
  effet: string;
  degats?: number;
  /** Pièce d'armure abîmée : PR en moins. */
  armure?: number;
  /** Pièce d'armure détruite. */
  armureDetruite?: boolean;
  /** Blessure grave ; « {cote} » : droite sur 1 à 3 au D6, gauche sur 4 à 6. */
  blessure?: string;
  hemorragie?: boolean;
  deces?: boolean;
  inconscient?: boolean;
  /** Assauts d'étourdissement (n'attaque pas, ne se défend pas). */
  etourdi?: number;
  /** Malus pour la suite du combat (tables des projectiles). */
  malus?: Partial<Record<CaracBlessure, number>>;
  /** Déplacement réduit pour le combat. */
  mv?: number;
  muet?: boolean;
}

const L = (min: number, max: number, texte: string, effet: string, x: Partial<Ligne> = {}): Ligne => ({ de: [min, max], texte, effet, ...x });

export const CRITIQUE_TRANCHANTE: Ligne[] = [
  L(1, 2, 'Incision profonde', 'Dégâts +1', { degats: 1 }),
  L(3, 4, 'Incision vraiment profonde', 'Dégâts +2', { degats: 2 }),
  L(5, 6, "Plaie impressionnante et dommages à l'armure", "Dégâts +3, pièce d'armure PR −1", { degats: 3, armure: 1 }),
  L(7, 8, "Coup précis et dommages à l'armure", "Dégâts +4, pièce d'armure PR −2", { degats: 4, armure: 2 }),
  L(9, 10, "Coup précis de bourrin et dommages à l'armure", "Dégâts +5, pièce d'armure PR −3", { degats: 5, armure: 3 }),
  L(11, 11, "Une partie de l'armure est détruite", 'Pièce d\'armure concernée PR = 0', { armureDetruite: true }),
  L(12, 12, 'Œil crevé', 'Dégâts +5 et blessure grave', { degats: 5, blessure: 'oeil-creve' }),
  L(13, 13, 'Main tranchée', 'Dégâts +6 et blessure grave', { degats: 6, blessure: 'main-{cote}-tranchee' }),
  L(14, 14, 'Pied tranché', 'Dégâts +6 et blessure grave', { degats: 6, blessure: 'pied-tranche' }),
  L(15, 15, 'Bras tranché', 'Dégâts +7 et blessure grave', { degats: 7, blessure: 'bras-{cote}-tranche' }),
  L(16, 16, 'Jambe tranchée', 'Dégâts +8 et blessure grave', { degats: 8, blessure: 'jambe-tranchee' }),
  L(17, 17, 'Organes génitaux endommagés', 'Dégâts +5 et hémorragie', { degats: 5, hemorragie: true }),
  L(18, 18, 'Organe vital endommagé', 'Dégâts +9 et hémorragie', { degats: 9, hemorragie: true }),
  L(19, 19, 'Blessure au cœur', 'Décès', { deces: true }),
  L(20, 20, 'Blessure grave à la tête', 'Décès', { deces: true }),
];

export const CRITIQUE_CONTONDANTE: Ligne[] = [
  L(1, 2, 'Hématome impressionnant', 'Dégâts +1', { degats: 1 }),
  L(3, 4, "Hématome et luxation d'un membre", 'Dégâts +2', { degats: 2 }),
  L(5, 6, 'Fracture de côte', 'Dégâts +3', { degats: 3 }),
  L(7, 8, "Coup précis et dommages à l'armure", "Dégâts +4, pièce d'armure PR −1", { degats: 4, armure: 1 }),
  L(9, 10, "Coup précis de bourrin et dommages à l'armure", "Dégâts +5, pièce d'armure PR −2", { degats: 5, armure: 2 }),
  L(11, 11, "Une partie de l'armure est détruite", "Pièce d'armure concernée PR = 0", { armureDetruite: true }),
  L(12, 12, 'Luxation du genou', 'Dégâts +3 et blessure grave', { degats: 3, blessure: 'genou-luxe' }),
  L(13, 13, 'Main cassée', 'Dégâts +3 et blessure grave', { degats: 3, blessure: 'main-{cote}-cassee' }),
  L(14, 14, 'Pied écrasé', 'Dégâts +3 et blessure grave', { degats: 3, blessure: 'pied-ecrase' }),
  L(15, 15, 'Bras cassé', 'Dégâts +4 et blessure grave', { degats: 4, blessure: 'bras-{cote}-casse' }),
  L(16, 16, 'Jambe cassée', 'Dégâts +5 et blessure grave', { degats: 5, blessure: 'jambe-cassee' }),
  L(17, 17, 'Organes génitaux écrasés', 'Dégâts +5 et blessure grave', { degats: 5, blessure: 'organes-genitaux' }),
  L(18, 18, 'Assommé', 'Inconscient', { inconscient: true }),
  L(19, 19, 'Fracture ouverte du crâne', 'Décès', { deces: true }),
  L(20, 20, "Écrasement violent d'un organe vital", 'Décès', { deces: true }),
];

export const CRITIQUE_MAINS_NUES: Ligne[] = [
  L(1, 2, 'Hématome impressionnant', 'Dégâts +1', { degats: 1 }),
  L(3, 4, "Hématome et luxation d'un membre", 'Dégâts +2', { degats: 2 }),
  L(5, 6, 'Fracture du nez, hémorragie nasale', 'Dégâts +3', { degats: 3 }),
  L(7, 8, 'Fracture de côte', 'Dégâts +4', { degats: 4 }),
  L(9, 10, 'Coup précis de bourrin dans la tempe', 'Dégâts +2, cible étourdie 3 assauts', { degats: 2, etourdi: 3 }),
  L(11, 11, 'Coup précis au sternum', 'Cible étourdie 4 assauts', { etourdi: 4 }),
  L(12, 12, 'Luxation du genou', 'Dégâts +3 et blessure grave', { degats: 3, blessure: 'genou-luxe' }),
  L(13, 13, 'Main cassée', 'Dégâts +3 et blessure grave', { degats: 3, blessure: 'main-{cote}-cassee' }),
  L(14, 14, 'Mâchoire brisée', 'Dégâts +3, incapable de parler', { degats: 3, muet: true }),
  L(15, 15, 'Bras cassé', 'Dégâts +4 et blessure grave', { degats: 4, blessure: 'bras-{cote}-casse' }),
  L(16, 17, 'Organes génitaux écrasés, houlala', 'Dégâts +5 et blessure grave', { degats: 5, blessure: 'organes-genitaux' }),
  L(18, 19, 'Assommé', 'Inconscient', { inconscient: true }),
  L(20, 20, 'Enfoncement du nez dans le cerveau', 'Décès', { deces: true }),
];

export const CRITIQUE_PROJECTILE: Ligne[] = [
  L(1, 2, 'Projectile bien placé', 'Dégâts +1', { degats: 1 }),
  L(3, 4, 'Projectile magistralement placé', 'Dégâts +2', { degats: 2 }),
  L(5, 6, "Projectile dans une articulation du bras", 'Dégâts +3, AT/PRD −2', { degats: 3, malus: { AT: -2, PRD: -2 } }),
  L(7, 8, "Projectile dans une articulation de la jambe", 'Dégâts +3, déplacement −50 %', { degats: 3, mv: 0.5 }),
  L(9, 11, 'Projectile dans un poumon', 'Dégâts +3, toutes caracs −1', { degats: 3, malus: { AD: -1, COU: -1, FO: -1, CHA: -1, AT: -1, PRD: -1 } }),
  L(12, 16, 'Projectile de maître', 'Dégâts +5', { degats: 5 }),
  L(17, 17, 'En plein dans les organes génitaux, bien fait !', 'Dégâts +5 et hémorragie', { degats: 5, hemorragie: true }),
  L(18, 18, 'Organe vital endommagé', 'Dégâts +6 et hémorragie', { degats: 6, hemorragie: true }),
  L(19, 19, 'Cœur transpercé', 'Décès', { deces: true }),
  L(20, 20, 'Œil et cerveau transpercés, bien fait !', 'Décès', { deces: true }),
];

/** Ce qui arrive au maladroit. */
export interface LigneMaladresse {
  de: [number, number];
  texte: string;
  effet: string;
  rien?: boolean;
  rate?: number;
  allie?: 'gauche' | 'droite' | 'loin';
  /** Lâche son arme : mains nues (il la ramasse après le combat). */
  lache?: boolean;
  /** Casse son arme, selon son point de rupture. */
  casse?: boolean;
  /** Se blesse avec sa propre arme (bonus éventuel). */
  seBlesse?: number;
  /** Se blesse gravement : sa propre arme, comme un critique. */
  critiqueSurSoi?: boolean;
  /** Dégâts fixes (« 3BL » : 3 points de vie). */
  pv?: number;
  blessure?: string;
  /** Perd un œil (1-2 au D6) ou un doigt. */
  oeilOuDoigt?: boolean;
  /** Crève l'œil de l'allié le plus proche. */
  oeilAllie?: boolean;
  inconscient?: boolean;
  /** Le projectile n'atteint pas sa cible : l'arme de tir reste utilisable. */
  manque?: boolean;
}

const M = (min: number, max: number, texte: string, effet: string, x: Partial<LigneMaladresse> = {}): LigneMaladresse => ({ de: [min, max], texte, effet, ...x });

export const MALADRESSE_ARME: LigneMaladresse[] = [
  M(1, 2, 'Rattrape son erreur in extremis', "L'attaque échoue seulement", { rien: true }),
  M(3, 5, 'Trébuche et chute maladroitement', 'Le maladroit rate 2 assauts', { rate: 2 }),
  M(6, 7, 'Frappe un allié proche vers la gauche', "Dégâts sur l'allié", { allie: 'gauche' }),
  M(8, 9, 'Frappe un allié proche vers la droite', "Dégâts sur l'allié", { allie: 'droite' }),
  M(10, 12, 'Lâche son arme comme un loser', 'Combat à mains nues', { lache: true }),
  M(13, 15, 'Casse son arme (ou pas, selon son point de rupture)', 'Combat à mains nues', { casse: true }),
  M(16, 18, 'Se blesse tout seul comme un cake', 'Dégâts sur le combattant', { seBlesse: 0 }),
  M(19, 19, 'Se blesse très sévèrement de façon atroce et douloureuse', 'Dégâts sur le combattant (critique)', { critiqueSurSoi: true }),
  M(20, 20, 'Perd un œil (1-2 au D6) ou un doigt (3-6)', 'Blessure grave', { oeilOuDoigt: true }),
];

export const MALADRESSE_JET: LigneMaladresse[] = [
  M(1, 2, 'Rattrape son erreur in extremis', "Le projectile n'atteint pas la cible", { rien: true, manque: true }),
  M(3, 5, 'Lâche son arme comme un loser', 'Combat à mains nues, change d\'arme', { lache: true }),
  M(6, 7, 'Frappe un allié proche vers la gauche', "Dégâts sur l'allié", { allie: 'gauche' }),
  M(8, 9, 'Frappe un allié proche vers la droite', "Dégâts sur l'allié", { allie: 'droite' }),
  M(10, 12, "Frappe l'allié le plus lointain", "Dégâts sur l'allié", { allie: 'loin' }),
  M(13, 15, 'Casse son arme (ou pas, selon son point de rupture)', 'Combat à mains nues', { casse: true }),
  M(16, 18, 'Se tire dans le pied', "Dégâts de l'arme +2", { seBlesse: 2 }),
  M(19, 19, 'Se blesse très sévèrement dans un grand cri haineux', 'Dégâts sur le combattant (critique)', { critiqueSurSoi: true }),
  M(20, 20, "Crève l'œil de l'allié le plus proche", 'Blessure grave', { oeilAllie: true }),
];

export const MALADRESSE_MAINS_NUES: LigneMaladresse[] = [
  M(1, 2, 'Rattrape son erreur in extremis', "L'attaque échoue seulement", { rien: true }),
  M(3, 10, "Tombe et s'écrase le nez par terre", 'Perd 2 assauts, 2 PV', { rate: 2, pv: 2 }),
  M(11, 12, 'Frappe un allié proche vers la gauche', "Dégâts sur l'allié", { allie: 'gauche' }),
  M(13, 14, 'Frappe un allié proche vers la droite', "Dégâts sur l'allié", { allie: 'droite' }),
  M(15, 16, 'Se brise la main tout seul comme une tanche', '3 PV, blessure grave', { pv: 3, blessure: 'main-{cote}-cassee' }),
  M(17, 19, 'Se casse un bras bêtement', '6 PV, blessure grave', { pv: 6, blessure: 'bras-{cote}-casse' }),
  M(20, 20, "Tombe en arrière et s'assomme", 'Perte de connaissance', { inconscient: true }),
];

/** Ce que le défenseur fait subir à l'attaquant sur une parade critique. */
export interface LigneParade {
  de: [number, number];
  texte: string;
  effet: string;
  rien?: boolean;
  rate?: number;
  /** Attaques imparables que l'attaquant subit. */
  imparables?: number;
  lache?: boolean;
  casse?: boolean;
  /** Il reçoit un coup de l'arme du défenseur. */
  coup?: boolean;
  /** Coup critique avec l'arme du défenseur. */
  critique?: boolean;
  /** Coup critique avec sa propre arme. */
  critiqueSurSoi?: boolean;
}

const P = (min: number, max: number, texte: string, effet: string, x: Partial<LigneParade> = {}): LigneParade => ({ de: [min, max], texte, effet, ...x });

export const PARADE_CRITIQUE: LigneParade[] = [
  P(1, 2, 'Mais non en fait : la parade était normale', 'Résolution normale de parade', { rien: true }),
  P(3, 5, "L'ennemi est repoussé", 'Il rate un assaut', { rate: 1 }),
  P(6, 7, "L'ennemi trébuche", 'Il subit 1 attaque imparable', { imparables: 1 }),
  P(8, 9, "L'ennemi tombe", 'Il subit 2 attaques imparables', { imparables: 2 }),
  P(10, 12, "L'ennemi lâche son arme à 1D6 mètres", 'Il combat à mains nues', { lache: true }),
  P(13, 15, "L'ennemi casse son arme", 'Il combat à mains nues', { casse: true }),
  P(16, 18, "L'ennemi reçoit un coup de votre arme", 'Il subit des dégâts', { coup: true }),
  P(19, 19, "L'ennemi subit un coup critique avec votre arme", 'Il subit des dégâts : table critique', { critique: true }),
  P(20, 20, "L'ennemi, ce loser, subit un coup critique avec son arme", 'Il subit des dégâts : table critique', { critiqueSurSoi: true }),
];

export const TABLES_CRITIQUES: Record<'tranchante' | 'contondante' | 'projectile' | 'mains-nues', { nom: string; lignes: Ligne[] }> = {
  tranchante: { nom: 'Attaque critique, arme tranchante', lignes: CRITIQUE_TRANCHANTE },
  contondante: { nom: 'Attaque critique, arme contondante', lignes: CRITIQUE_CONTONDANTE },
  projectile: { nom: 'Attaque critique aux projectiles', lignes: CRITIQUE_PROJECTILE },
  'mains-nues': { nom: 'Attaque critique à mains nues', lignes: CRITIQUE_MAINS_NUES },
};

/** La table de critiques d'une famille d'arme (les griffes coupent comme une lame ; les bêtes n'en ont pas). */
export const tableCritique = (f: Famille) => (f === 'bete' ? undefined : TABLES_CRITIQUES[f === 'griffes' ? 'tranchante' : f]);

export const tableMaladresse = (f: Famille, tir = false): { nom: string; lignes: LigneMaladresse[] } | undefined =>
  tir
    ? { nom: "Maladresse à l'arme de jet", lignes: MALADRESSE_JET }
    : f === 'mains-nues'
      ? { nom: 'Maladresse à mains nues', lignes: MALADRESSE_MAINS_NUES }
      : f === 'tranchante' || f === 'contondante' || f === 'projectile'
        ? { nom: 'Maladresse attaque ou parade', lignes: MALADRESSE_ARME }
        : undefined;

export const ligne = <T extends { de: [number, number] }>(lignes: T[], d: number): T => lignes.find((l) => d >= l.de[0] && d <= l.de[1])!;

/** Droite sur 1 à 3 au D6, gauche sur 4 à 6. */
export const cote = (rng?: Rng) => (lancer(6, rng) <= 3 ? 'droite' : 'gauche');

/** Résout « {cote} » dans une clé de blessure (main-{cote}-cassee), au D6. */
export const blessure = (cle: string, rng?: Rng): BlessureGrave => {
  const c = cote(rng);
  const k = cle.replace('{cote}', c).replace('bras-droite', 'bras-droit');
  return BLESSURES[k];
};

const CONTONDANT = /gourdin|branche|b[aâ]ton|massue|marteau|\bmasse\b|fl[eé]au|nunchaku|chaise|tabouret|manche|tisonnier|po[eê]le|matraque|morgenstern|maillet|chope|saucisson|cogneur|gourdin/i;

/** La famille d'une arme du catalogue (sans arme : mains nues). */
export const familleObjet = (o?: Objet): Famille => {
  if (!o) return 'mains-nues';
  if (o.tir) return 'projectile';
  return CONTONDANT.test(`${o.id} ${o.nom}`) ? 'contondante' : 'tranchante';
};

/** La famille d'arme d'un monstre, d'après son nom et les notes de sa fiche. */
export const familleMonstre = (nom: string, notes: string): Famille => {
  const t = `${nom} ${notes}`;
  if (/mains nues/i.test(t)) return 'mains-nues';
  if (CONTONDANT.test(t)) return 'contondante';
  if (/[eé]p[eé]e|dague|fendoir|hache|lance|sabre|arm[eé]|cimeterre|couteau|mortensen|brigand|orque|gobelin|kobold|garde|squelette|bandit|soldat|voleur|pillard|mercenaire|nain|elfe|humain|chef|guerrier|archer/i.test(t))
    return 'tranchante';
  if (/panth[eè]re|araign[eé]e tranchante|dragon|tigre|ours\b|loup|griffe/i.test(t)) return 'griffes';
  return 'bete';
};

/** Point de rupture : « 1à4 », l'arme casse sur 1 à 4 au D6 ; « Non », jamais. Sans indication : 1 à 3. */
export const casse = (rupture: string | undefined, d6: number) => {
  if (rupture === 'Non') return false;
  const m = /1\s*à\s*(\d)/.exec(rupture ?? '');
  return d6 <= (m ? Number(m[1]) : 3);
};

/** Texte court d'une blessure grave : « AD −1, CHA −3… (3 semaines) ». */
export const decrireBlessure = (b: BlessureGrave) => {
  const mods = Object.entries(b.mods).map(([k, v]) => `${k} ${v}`);
  if (b.mv !== undefined) mods.push(`déplacement ${b.mv === 0 ? 'impossible' : `${Math.round(b.mv * 100)} %`}`);
  const duree = b.jours === undefined ? 'permanent' : b.jours >= 30 ? '1 mois' : b.jours % 7 === 0 ? `${b.jours / 7} semaine${b.jours > 7 ? 's' : ''}` : `${b.jours} jours`;
  return `${mods.join(', ')} (${duree})`;
};
