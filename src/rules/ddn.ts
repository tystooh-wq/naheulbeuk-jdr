import { lancer, type Rng } from './des';
import { ajouterBlessure, epreuve, niveauPour, noter, passerTemps, type Equipement, type Partie } from './partie';
import { valeurEpreuve, type CaracQuete } from './epreuves';
import { aMarque } from './evenements';
import { objet } from './objets';
import type { Situation } from './talents';
import type { BlessureGrave } from './critiques';
import type { LigneRencontre, Rencontre } from './rencontres';
import type { Ennemis } from './donjons';

// Le Donjon de Naheulbeuk (manuel du MJ, rencontres, énigmes et achievements officiels) : ce qui ne tient pas
// dans les salles elles-mêmes. Les monstres avec leurs caractéristiques du document « Monstres et rencontres »,
// les neuf énigmes, les hauts faits de Licoy, et ce qui arrive quand on se rend : les cachots du niveau 5.

export const ID_DDN = 'naheulbeuk';

// --- Petits outils ---------------------------------------------------------------------------

export const marquer = (p: Partie, ...marques: string[]) => {
  p.marques = [...new Set([...(p.marques ?? []), ...marques])];
};

export const valeur = (p: Partie, carac: CaracQuete, modif = 0, situation?: Situation) => valeurEpreuve(p, { carac, modif, situation });

/** Épreuve avec le dé du joueur (le premier tirage de `rng`). */
export const reussit = (p: Partie, carac: CaracQuete, modif = 0, rng?: Rng, situation?: Situation) => epreuve(valeur(p, carac, modif, situation), rng).reussi;

export const xp = (p: Partie, points: number) => {
  p.xp = (p.xp ?? 0) + points;
};

/** Un malus passager (odeur tenace, puces…), rangé avec les blessures : il s'efface tout seul. Sans durée : permanent. */
export const malus = (p: Partie, nom: string, mods: BlessureGrave['mods'], duree?: { jours?: number; heures?: number }) => {
  p.blessures = (p.blessures ?? []).filter((b) => b.nom !== nom);
  if (!duree) return ajouterBlessure(p, { nom, mods });
  p.blessures.push({ nom, mods, jours: duree.jours ?? 1, jusqua: p.jour + (p.heure + (duree.heures ?? 0)) / 24 + (duree.jours ?? 0) });
};

/** Un bon bain efface les odeurs (vomi, boules puantes, purin, latrines). */
export const seLaver = (p: Partie) => {
  const avant = p.blessures?.length ?? 0;
  p.blessures = (p.blessures ?? []).filter((b) => !b.nom.startsWith('Odeur'));
  return avant - (p.blessures?.length ?? 0);
};

export const entre = (h: number, a: number, b: number) => (h >= a && h < b) || (h + 24 >= a && h + 24 < b);

export const estInstrument = (id: string) => id === 'instrument' || !!objet(id).categorie?.startsWith('Instruments');

/** Les instruments du sac : il en faut quatre, joués très faux, pour agacer Zangdar. */
export const instruments = (p: Partie) => p.sac.filter(estInstrument).length;

export const INSTRUMENTS_ZANGDAR = 4;

// --- Les monstres et les gens du donjon (document « Monstres et rencontres ») -------------------

const L = (nom: string, at: number, prd: number, ev: number, pr: number, degats: string, cou: number, xp: number, notes = ''): LigneRencontre => ({
  d20: 0,
  rencontre: nom,
  nombre: '1',
  nom,
  at,
  prd,
  ev,
  pr,
  degats,
  cou,
  xp,
  notes,
});

export const M = {
  vendeuse: L('Vendeuse', 6, 3, 13, 1, '1D', 4, 5, 'Armée d\'un bâton'),
  domestique: L('Domestique', 6, 5, 13, 1, '1D+1', 8, 6, 'Armé d\'un tabouret'),
  ivrogne: L('Ivrogne', 7, 5, 14, 1, '1D+2', 8, 6, 'Armé d\'une bouteille cassée'),
  cuisinier: L('Cuisinier', 7, 7, 14, 1, '1D+1', 7, 6, 'Armé d\'un couteau'),
  chamane: L('Chamane lubrique', 7, 6, 12, 1, '1D+1', 7, 6, 'Armé d\'un bâton'),
  predicateur: L('Prédicateur hystérique', 7, 6, 12, 1, '1D+1', 7, 6, 'Armé d\'un bâton'),
  barman: L('Barman', 9, 7, 14, 1, '1D+2', 10, 7, 'Armé d\'un gourdin à clous'),
  assistant: L('Assistant sorcier', 8, 6, 18, 2, '1D+3', 8, 8, 'Armé d\'une dague'),
  geolier: L('Geôlier', 10, 8, 18, 3, '1D+3', 12, 10, 'Armé d\'une lance et d\'un bouclier'),
  sorcierFou: L('Jeune sorcier fou', 8, 7, 20, 1, '1D+1', 12, 11, 'Lance des sorts de niveau 1, armé d\'un bâton'),
  reivax: L('Reivax', 10, 6, 25, 2, '1D+3', 8, 12, 'Armé d\'une dague'),
  forgeron: L('Forgeron', 10, 10, 19, 3, '1D+3', 11, 12, 'Armé d\'une épée'),
  vigile: L('Vigile balaise', 11, 10, 20, 3, '1D+4', 12, 13, 'Armé d\'une hallebarde à deux mains'),
  mercenaire: L('Mercenaire', 10, 13, 25, 4, '1D+2', 14, 13, 'Épée et bouclier'),
  chefCuisinier: L('Chef cuisinier', 10, 13, 25, 3, '1D+2', 14, 15, 'Deux hachoirs'),
  maraudeur: L('Maraudeur', 11, 9, 28, 4, '1D+5', 12, 25, 'Bourrin, armé d\'une épée'),
  gerard: L('Gérard le Terrible', 13, 11, 35, 3, '1D+5', 13, 32, 'Bourreau, armé d\'une hache'),
  gerardIvre: L('Gérard le Terrible (pinté)', 9, 6, 35, 3, '1D+5', 13, 32, 'Bourreau ivre, armé d\'une hache'),
  guerrierMaudit: L('Guerrier maudit', 12, 12, 40, 5, '2D+2', 18, 40, 'Arme à deux mains, résistance à la magie 13'),
  zangdar: L('Zangdar', 9, 11, 35, 4, '1D+4', 16, 50, 'Sorcier, combat avec un bâton quand il ne peut plus faire autrement'),
  gobelinAveugle: L('Gobelin aveugle', 4, 2, 13, 2, '1D+1', 4, 3, 'Armé d\'un couteau'),
  gobelinAveugleNoir: L('Gobelin aveugle (dans le noir)', 9, 7, 13, 2, '1D+1', 4, 3, 'Armé d\'un couteau ; le héros n\'y voit rien'),
  ingenieur: L('Gobelin ingénieur', 7, 5, 12, 2, '1D', 4, 3, 'Pas armé, mains nues'),
  lutteur: L('Gobelin lutteur', 11, 8, 14, 1, '1D', 5, 8, 'Combat à mains nues'),
  gobelin: L('Gobelin', 8, 6, 12, 2, '1D+2', 5, 5, 'Armé d\'un couteau'),
  orqueAvine: L('Orque aviné', 7, 7, 12, 2, '1D+1', 7, 7, 'Sans arme, mains nues'),
  orque: L('Orque garde', 9, 7, 15, 2, '1D+4', 8, 8, 'Armé d\'une épée rouillée'),
  orqueChef: L('Orque chef', 10, 8, 25, 3, '1D+5', 10, 13, 'Bourrin, armé d\'une hache'),
  orqueElite: L("Orque d'élite", 11, 9, 28, 4, '1D+5', 12, 25, 'Bourrin, armé d\'une épée'),
  chapichapo: L('Chapichapo maléfique', 12, 6, 12, 2, '1D+4', 20, 15, 'Hachoir de torture très effilé'),
  kobold: L('Kobold farceur', 16, 4, 20, 1, '1D', 10, 15, 'Armé d\'une dague, lance des sorts'),
  troll: L('Troll géant', 5, 5, 50, 3, '3D', 18, 22, 'Armé d\'une massue'),
  ratGeant: L('Rat géant', 9, 5, 10, 1, '1D+1', 8, 8, ''),
  ratMutant: L('Rat mutant', 9, 5, 15, 2, '1D+2', 8, 12, ''),
  serpent: L('Serpent constricteur', 8, 0, 20, 2, '3', 15, 20, 'Enserre sa proie'),
  poulet: L('Poulet nerveux', 10, 4, 4, 0, '1', 3, 1, 'Bec, ailes et pattes'),
  golbargh: L('Golbargh', 14, 12, 90, 4, '2D+4', 40, 120, 'Démon à quatre bras et queue à piquants, griffes'),
  zombie: L('Zombie', 8, 0, 20, 1, '1D+1', 1000, 6, 'Lent, frappe à mains nues'),
  liche: L('Liche en babouches', 9, 6, 30, 2, '1D+4', 1000, 30, 'Combat avec son bâton de mage'),
  golem: L('Golem de fer', 8, 8, 50, 10, '2D+2', 1000, 50, 'Poings de fer, mains nues'),
  ratZombie: L('Rat mutant zombie venimeux de l\'espace en short', 8, 4, 20, 1, '1D+2', 40, 15, 'Morsure venimeuse'),
  harpie: L('Harpie hyppie', 10, 8, 25, 3, '1D+5', 10, 13, 'Serres puissantes, griffes'),
};

export const E = (ligne: LigneRencontre, nombre = 1, parCompagnon = 0): Ennemis => ({ ligne, nombre, parCompagnon: parCompagnon || undefined });

/** Un combat lancé depuis une scène (créatures pensantes : on peut se rendre). */
export const combat = (p: Partie, ennemis: Ennemis[], pensants = true): Rencontre => {
  const [a, ...b] = ennemis.map((x) => ({ ligne: x.ligne, nombre: x.nombre + (x.parCompagnon ?? 0) * (p.compagnons?.length ?? 0) }));
  return { ligne: a.ligne, nombre: a.nombre, d20: 0, table: 'Donjon de Naheulbeuk', avec: b, approche: 1, reddition: pensants || undefined };
};

// --- Les énigmes (document « Énigmes du Donjon ») ---------------------------------------------

export interface Enigme {
  texte: string;
  solution: string;
  bonne: (reponse: string) => boolean;
}

const normaliser = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const mot = (re: RegExp) => (r: string) => re.test(normaliser(r));

export const ENIGMES: Record<number, Enigme> = {
  1: { texte: "Prononcez l'allocution habituelle des situations désastreuses.", solution: 'Merde !', bonne: mot(/\bmerde\b/) },
  2: {
    texte: 'Nous sommes nés de la même mère, la même année, le même mois, le même jour et à la même heure. Pourtant nous ne sommes pas jumeaux, ni même jumelles. Pourquoi ?',
    solution: 'Nous sommes des triplés.',
    bonne: mot(/tripl/),
  },
  3: { texte: '3 nains vont travailler à la mine. Le groupe s\'en va. Le deuxième prend la pelle, le troisième prend la pioche. Que prend le premier ?', solution: 'Il prend la tête (du groupe).', bonne: mot(/\btete\b/) },
  4: { texte: "On me jette lorsqu'on a besoin de moi et on me ramasse lorsqu'on n'en a plus besoin.", solution: "L'ancre d'un bateau.", bonne: mot(/\bancres?\b/) },
  5: { texte: 'Les quatre façades d\'une même maison sont exposées au sud. Comment est-ce possible ?', solution: 'Elle se situe au pôle Nord.', bonne: mot(/\bpole\b/) },
  6: { texte: "Je suis dans l'étang et au fond du jardin, je commence la nuit et finis le matin et j'apparais deux fois dans l'année. Qui suis-je ?", solution: 'La lettre N.', bonne: mot(/^(la )?(lettre )?n$|lettre n\b/) },
  7: {
    texte:
      "Jamais je ne suis loin de mon autre jumelle, on m'associe souvent au parfum vomitif d'une partie du corps qui n'est pas vraiment belle, localisée fort loin de l'organe olfactif.",
    solution: 'Chaussette !',
    bonne: mot(/chaussette/),
  },
  8: {
    texte: 'Je suis ce que je suis, mais je ne suis pas ce que je suis. Car si je suis ce que je suis, je ne suis plus ce que je suis.',
    solution: "Un homme qui suit un cercueil lors d'un enterrement.",
    bonne: mot(/cercueil|enterrement|corbillard|funebre|mort/),
  },
  9: {
    texte: 'Un mage prétend pouvoir répondre avec exactitude à toutes les questions qu\'on lui pose sur le futur. Que pourriez-vous lui demander pour être sûr que sa réponse sera inexacte ?',
    solution: '« Le prochain mot que tu diras sera-t-il non ? »',
    bonne: mot(/(prochain|diras?|dire)\b.*\bnon\b|\bnon\b.*(prochain|diras?)/),
  },
};

/** La réponse est connue (Reivax a parlé, le troll aussi, ou on l'a déjà résolue une fois). */
export const indiceEnigme = (p: Partie, n: number) => aMarque(p, `ddn:indice-${n}`) || aMarque(p, `ddn:enigme-${n}`);

// --- Les hauts faits (achievements de Licoy) -------------------------------------------------------

export interface HautFait {
  id: string;
  nom: string;
  condition: string;
  xp: number;
  /** Se gagne encore (moins cher) les fois suivantes. */
  ensuite?: number;
}

export const HAUTS_FAITS: HautFait[] = [
  { id: 'premier', nom: 'Get an achievement', condition: 'Obtenir un haut fait du donjon pour la première fois', xp: 5 },
  { id: 'air-connu', nom: 'Un air déjà connu', condition: 'Trouver un instrument', xp: 5 },
  { id: 'biere', nom: "L'appel de la bière", condition: 'Faire une pause à la taverne du donjon (sans mettre le feu)', xp: 5 },
  { id: 'casse-croute', nom: 'Pause casse-croûte', condition: 'Piller les cuisines du donjon', xp: 5 },
  { id: 'poulet', nom: 'Poulet, poulet…', condition: "À partir de maintenant, c'est vous ou lui ! Il DOIT mourir !", xp: 5 },
  { id: 'providence', nom: 'Divine providence', condition: "Revenir à la vie à l'aide d'un point de destin", xp: 20 },
  { id: 'ruse', nom: 'La ruse', condition: 'Fuir un combat sans que personne ne meure', xp: 10 },
  { id: 'prisonniers', nom: 'Les prisonniers', condition: "S'évader des cachots", xp: 30 },
  { id: 'chaussette', nom: 'Chaussette', condition: 'Résoudre une énigme', xp: 10, ensuite: 5 },
  { id: 'timing', nom: 'Question de timing', condition: 'Traverser sans dommage les chompeurs du 3e étage', xp: 15 },
  { id: 'peaux-vertes', nom: 'Massacre de peaux-vertes', condition: 'Vaincre au moins 15 orques et/ou gobelins', xp: 15 },
  { id: 'mecanique', nom: 'Expert ès mécanique', condition: 'Désamorcer trois pièges sans les déclencher', xp: 15 },
  { id: 'level-up', nom: 'Massive level up', condition: "Gagner un niveau à l'intérieur du donjon", xp: 20 },
  { id: 'dernier-souffle', nom: 'Dernier souffle', condition: "Trouver la liche de l'étage abandonné et lui régler son compte", xp: 20 },
  { id: 'chaos', nom: 'Défaite du chaos', condition: 'Survivre au combat contre des guerriers maudits dans les souterrains', xp: 20 },
  { id: 'tresors', nom: 'Chasseurs de trésors', condition: 'Gagner plus de 10 000 PO parmi les trésors disséminés dans le donjon', xp: 40 },
  { id: 'elite', nom: 'Monstre élite', condition: "Vaincre un monstre dont la classe d'XP est de 50 ou plus", xp: 20 },
  { id: 'bourreau', nom: 'Bourreau de métier', condition: 'Vaincre Gérard le Terrible', xp: 15 },
  { id: 'sbire', nom: 'Sbire du donjon', condition: "Vaincre Reivax, l'assistant de Zangdar, ou le retourner dans votre camp", xp: 20 },
  { id: 'boss', nom: 'Boss de niveau', condition: 'Vaincre Zangdar, le Maître du donjon', xp: 30 },
];

/** Gagne un haut fait (et son XP) ; null s'il est déjà acquis et ne se regagne pas. */
export const hautFait = (p: Partie, id: string): string | null => {
  const h = HAUTS_FAITS.find((x) => x.id === id)!;
  const fois = p.hautsFaits?.[id] ?? 0;
  if (fois && !h.ensuite) return null;
  const premierDeTous = !Object.keys(p.hautsFaits ?? {}).length;
  p.hautsFaits = { ...(p.hautsFaits ?? {}), [id]: fois + 1 };
  const gain = fois ? h.ensuite! : h.xp;
  xp(p, gain);
  noter(p, `haut fait « ${h.nom} » (+${gain} XP).`);
  const texte = `🏆 Haut fait : « ${h.nom} » (+${gain} XP)`;
  return premierDeTous && id !== 'premier' ? `${texte} · ${hautFait(p, 'premier')}` : texte;
};

const compter = (p: Partie, cle: string, n = 1) => {
  p.compteurs = { ...(p.compteurs ?? {}), [cle]: (p.compteurs?.[cle] ?? 0) + n };
  return p.compteurs[cle];
};

/** Après un combat gagné dans le donjon : peaux-vertes, monstres d'élite, guerriers maudits. */
export const apresVictoire = (p: Partie, vaincus: LigneRencontre[]): string[] => {
  const textes: (string | null)[] = [];
  const verts = vaincus.filter((l) => /orque|gobelin/i.test(l.nom)).length;
  if (verts && compter(p, 'peaux-vertes', verts) >= 15) textes.push(hautFait(p, 'peaux-vertes'));
  if (vaincus.some((l) => l.xp >= 50)) textes.push(hautFait(p, 'elite'));
  if (vaincus.some((l) => /guerrier maudit/i.test(l.nom))) textes.push(hautFait(p, 'chaos'));
  if (vaincus.some((l) => /liche/i.test(l.nom))) textes.push(hautFait(p, 'dernier-souffle'));
  if (vaincus.some((l) => /g[ée]rard/i.test(l.nom))) textes.push(hautFait(p, 'bourreau'));
  if (vaincus.some((l) => /reivax/i.test(l.nom))) textes.push(hautFait(p, 'sbire'));
  if (vaincus.some((l) => /zangdar/i.test(l.nom))) textes.push(hautFait(p, 'boss'));
  if (vaincus.some((l) => /poulet/i.test(l.nom))) textes.push(hautFait(p, 'poulet'));
  return textes.filter((t): t is string => !!t);
};

/** Un piège désamorcé sans le déclencher (au troisième : Expert ès mécanique). */
export const piegeDesamorce = (p: Partie) => (compter(p, 'desamorces') >= 3 ? hautFait(p, 'mecanique') : null);

/** Ce qui se vérifie à tout moment : premier instrument, niveau gagné dans le donjon, trésors amassés. */
export const verifierHautsFaits = (p: Partie): string[] => {
  const e = p.donjon;
  if (e?.id !== ID_DDN) return [];
  const textes: (string | null)[] = [];
  if (instruments(p)) textes.push(hautFait(p, 'air-connu'));
  if (e.niveauEntree !== undefined && niveauPour(p.xp ?? 0) > e.niveauEntree) textes.push(hautFait(p, 'level-up'));
  if ((e.orTrouve ?? 0) > 10000) textes.push(hautFait(p, 'tresors'));
  return textes.filter((t): t is string => !!t);
};

// --- Se rendre : les cachots du niveau 5 -------------------------------------------------------------

export const CACHOT = 'n5-3';
export const BUREAU_GEOLIERS = 'n5-4';

/**
 * Le héros se rend à des créatures pensantes (manuel, page 1) : il finit dans les geôles du niveau 5,
 * privé de son équipement (rangé au bureau des geôliers), nourri au pain sec.
 */
export const capturer = (p: Partie): string => {
  const e = p.donjon!;
  e.confisque = {
    sac: [...(e.confisque?.sac ?? []), ...p.sac],
    equipe: { ...(e.confisque?.equipe ?? {}), ...p.equipe },
    or: (e.confisque?.or ?? 0) + p.or,
  };
  p.sac = [];
  p.equipe = {} as Equipement;
  p.or = 0;
  p.ev = Math.max(1, p.ev);
  e.precedente = undefined;
  e.salle = CACHOT;
  if (!e.vues.includes(CACHOT)) e.vues.push(CACHOT);
  e.prisonnier = true;
  e.capture = p.jour;
  marquer(p, 'ddn:capture');
  noter(p, 'est jeté dans les cachots du Donjon de Naheulbeuk.');
  return "On te désarme, on te fouille jusque dans les chaussettes, et deux geôliers te traînent dans les étages jusqu'au niveau 5. La porte de ta cellule claque. Une couchette en bois, un trou dans le sol, et le silence. Tes affaires sont parties au bureau des geôliers, juste à côté.";
};

/** Une journée de plus au cachot : 2 PV de moins, et la torture tous les deux jours (5 PV). */
export const croupir = (p: Partie): string => {
  const e = p.donjon!;
  passerTemps(p, 24);
  const jours = p.jour - (e.capture ?? p.jour);
  let perte = 2;
  let texte = 'Une journée de pain sec et d\'eau tiède.';
  if (jours > 0 && jours % 2 === 0) {
    perte += 5;
    texte += " On vient te chercher pour la salle des tortures. Personne ne te pose de question, c'est presque le pire.";
  }
  p.ev -= perte;
  noter(p, `croupit au cachot (−${perte} PV).`);
  return `${texte} Tu perds ${perte} PV.`;
};

export type Evasion = 'barreaux' | 'serrure' | 'gerard';

export const gerardRode = (p: Partie) => entre(p.heure, 20, 26) && !aMarque(p, 'ddn:gerard-vaincu');

export const evasionPossible = (p: Partie, facon: Evasion): string | null => {
  if (facon === 'barreaux') return valeur(p, 'FO') < 16 ? 'Il faut au moins 16 en Force pour espérer tordre ces barreaux.' : null;
  if (facon === 'gerard') return gerardRode(p) ? null : "Gérard ne passe que le soir, quand il a bu (de 20 h à 2 h).";
  return null;
};

/** La valeur de l'épreuve d'évasion : Force (barreaux), Adresse −3 sans outils (serrure), Charisme (Gérard pinté). */
export const valeurEvasion = (p: Partie, facon: Evasion) =>
  facon === 'barreaux' ? valeur(p, 'FO', -2) : facon === 'serrure' ? valeur(p, 'AD', -3 - 3 - 2, 'serrure') : valeur(p, 'CHA', aMarque(p, 'ddn:ami-gerard') ? 4 : 0, 'negocier');

export const evader = (p: Partie, facon: Evasion, de: number): { reussi: boolean; texte: string } => {
  const e = p.donjon!;
  const v = valeurEvasion(p, facon);
  passerTemps(p, facon === 'gerard' ? 1 : 0.5);
  if (!epreuve(v, undefined, de).reussi) {
    if (facon === 'barreaux') p.ev = Math.max(1, p.ev - 1);
    return {
      reussi: false,
      texte: {
        barreaux: 'Tu tires, tu pousses, tu grimaces. Les barreaux, eux, ne grimacent pas. (−1 PV)',
        serrure: "Tu tritures la serrure avec l'arête de ta cuillère. La cuillère se tord, la serrure non.",
        gerard: "Gérard renifle, te regarde à travers les barreaux, puis repart en titubant en marmonnant que de toute façon, personne ne l'aime.",
      }[facon],
    };
  }
  e.prisonnier = false;
  // La porte du couloir vers le bureau des geôliers est restée entrouverte (ou Gérard l'ouvre).
  const porte = [BUREAU_GEOLIERS, CACHOT].sort().join('|');
  if (!e.ouvertes?.includes(porte)) (e.ouvertes ??= []).push(porte);
  if (facon === 'gerard') {
    marquer(p, 'ddn:ami-gerard', 'ddn:faiblesse');
    p.sac.push('trousseau-geolier');
  }
  noter(p, "s'évade des cachots du Donjon de Naheulbeuk.");
  const haut = hautFait(p, 'prisonniers');
  const texte = {
    barreaux: 'Dans un grincement atroce, deux barreaux finissent par s\'écarter. Tu te glisses dehors en laissant un peu de peau.',
    serrure: 'Clic ! Contre toute attente, la serrure cède. Tu es dans le couloir des cachots.',
    gerard:
      "Gérard s'assoit contre tes barreaux et te raconte sa vie. Personne ne l'aime, son métier le dégoûte, Reivax lui doit trois tournées… Tu l'écoutes, tu compatis. Il sanglote : « T'es mon seul ami. » Il t'ouvre, te tend le trousseau, et ajoute en hoquetant : « Et Zangdar, hein… la musique mal jouée, il supporte pas. Faut au moins quatre instruments. Chut. »",
  }[facon];
  return { reussi: true, texte: `${texte} La porte du bureau des geôliers est entrouverte : ton équipement doit y être.${haut ? ` ${haut}.` : ''}` };
};

/** Reprend l'équipement confisqué, au bureau des geôliers. */
export const recupererAffaires = (p: Partie): string | null => {
  const e = p.donjon!;
  const c = e.confisque;
  if (!c) return null;
  p.sac.push(...c.sac);
  for (const [k, v] of Object.entries(c.equipe) as [keyof Equipement, string | undefined][]) {
    if (!v) continue;
    if (p.equipe[k]) p.sac.push(v);
    else p.equipe[k] = v;
  }
  p.or += c.or;
  e.confisque = undefined;
  noter(p, 'récupère son équipement au bureau des geôliers.');
  return `Tout est là, rangé dans un coffre avec une étiquette à ton nom (mal orthographié) : ton équipement, ton sac et ${c.or} PO.`;
};

/** D6 pour les arbalètes et dards du donjon : touché sur 1, 2 ou 3. */
export const touche = (rng?: Rng) => lancer(6, rng) <= 3;
