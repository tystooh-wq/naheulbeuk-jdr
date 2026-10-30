import { creature } from './bestiaire';
import { ea, eaMax } from './magie';
import { lancer, type Rng } from './des';
import { arrondirOr } from './monnaie';
import { epreuve, lancerExpression, noter, passerTemps, soigner, type Partie } from './partie';
import { valeurEpreuveQuete, type CaracQuete } from './quetes';
import type { LigneRencontre, Rencontre } from './rencontres';

// Donjons : une suite de salles reliées entre elles, montrées sur une mini-carte façon Darkest Dungeon.
// On avance de salle en salle (dix minutes à chaque fois) ; chaque salle peut cacher un combat, un piège,
// un coin pour souffler ou un trésor. Le donjon est terminé quand la salle finale est nettoyée.

export interface Ennemis {
  ligne: LigneRencontre;
  nombre: number;
}

export type Contenu =
  | { type: 'combat'; ennemis: Ennemis[]; texte: string }
  | { type: 'piege'; carac: CaracQuete; modif?: number; degats: string; texte: string; evite: string; subit: string }
  | { type: 'repos'; pv: number; texte: string; /** Points astraux rendus aux mages. */ pa?: number; /** Durée de la pause (30 minutes par défaut). */ heures?: number };

export interface Salle {
  id: string;
  nom: string;
  /** Case de la mini-carte (colonne, ligne). */
  x: number;
  y: number;
  description: string;
  vers: string[];
  contenu?: Contenu;
  /** Trouvé en fouillant la salle, une fois son contenu réglé. */
  tresor?: { or?: number; objets?: string[]; texte: string };
}

export interface Donjon {
  id: string;
  nom: string;
  /** Où se trouve l'entrée (même notation que les quêtes). */
  ou: string;
  intro: string;
  salles: Salle[];
  entree: string;
  /** Nettoyer cette salle termine le donjon. */
  finale: string;
  conclusion: string;
  /** Donjon surveillé : en cas de défaite, on est tiré dehors au lieu de mourir. */
  secours?: string;
}

export interface EtatDonjon {
  id: string;
  salle: string;
  /** Salle d'où l'on vient (pour battre en retraite). */
  precedente?: string;
  vues: string[];
  /** Salles dont le contenu est réglé. */
  reglees: string[];
  fouillees: string[];
  /** Jour où chaque salle a été réglée (« r:salle ») ou fouillée (« f:salle ») : le donjon se repeuple après une semaine. */
  quand?: Record<string, number>;
}

/** Jours avant que les monstres reviennent et que les coffres se remplissent. */
export const REPEUPLEMENT = 7;

/** Une ligne de combat tirée du bestiaire officiel, renommée pour le donjon. */
const bete = (nom: string, surnom?: string): LigneRencontre => {
  const c = creature(nom);
  const n = (v: string) => Number(/\d+/.exec(v)?.[0] ?? 0);
  return {
    d20: 0,
    rencontre: surnom ?? c.nom,
    nombre: '1',
    nom: surnom ?? c.nom,
    at: n(c.at),
    prd: n(c.prd),
    ev: n(c.ev),
    pr: n(c.pr),
    degats: c.degats,
    cou: n(c.cou),
    xp: n(c.xp),
    notes: c.notes.join(' '),
  };
};

export const DONJONS: Donjon[] = [
  {
    id: 'donjon-facile',
    nom: 'Le Donjon Facile',
    ou: 'ville:valtordu:donjon-facile',
    intro:
      "Une porte en chêne peinte en rouge, un panneau « Bienvenue ! Sortie de secours à gauche ». Burgal, le vétéran, te souhaite bonne chance en mâchonnant une pomme. Les monstres sont payés au mois, les pièges sont vérifiés tous les lundis.",
    entree: 'vestibule',
    finale: 'tresor',
    conclusion: "Tu as traversé le Donjon Facile. Ce n'était pas si facile, mais tu n'en diras rien à personne.",
    secours: "Tout devient noir… Le Donjon Facile n'a pas été si facile. Burgal accourt, mais il arrive un peu tard.",
    salles: [
      { id: 'vestibule', nom: 'Vestibule', x: 0, y: 1, vers: ['couloir'], description: "Un vestiaire, un porte-manteau, une affiche « Interdit de tuer les monstres le dimanche ». Une torche brûle déjà." },
      {
        id: 'couloir',
        nom: 'Couloir du fil tendu',
        x: 1,
        y: 1,
        vers: ['vestibule', 'rats', 'fontaine'],
        description: 'Un couloir étroit et trop propre pour être honnête.',
        contenu: {
          type: 'piege',
          carac: 'AD',
          modif: 2,
          degats: '1D-2',
          texte: "Un fil tendu au ras du sol, à peine caché. L'épreuve d'Adresse est facile (+2) : c'est le Donjon Facile.",
          evite: "Tu enjambes le fil avec élégance. Un seau d'eau reste sagement accroché au plafond.",
          subit: "Le fil se tend, un seau te tombe sur la tête. Ce n'est pas de l'eau.",
        },
      },
      {
        id: 'rats',
        nom: 'Cellier aux rats',
        x: 2,
        y: 0,
        vers: ['couloir', 'squelette'],
        description: "Des étagères de fromages entamés. Ça couine.",
        contenu: { type: 'combat', ennemis: [{ ligne: bete('Rat pesteux'), nombre: 2 }], texte: 'Deux rats pesteux défendent le fromage avec une conviction remarquable.' },
        tresor: { or: 3, texte: 'Sous une étagère, quelqu\'un a perdu quelques pièces.' },
      },
      {
        id: 'fontaine',
        nom: 'La fontaine',
        x: 2,
        y: 2,
        vers: ['couloir', 'squelette'],
        description: 'Une petite fontaine murmure dans une alcôve. Un panneau : « Eau potable, garantie sans malédiction (ou presque) ».',
        contenu: { type: 'repos', pv: 3, texte: "Tu bois, tu t'asperges le visage, tu souffles un peu." },
      },
      {
        id: 'squelette',
        nom: 'Salle du squelette',
        x: 3,
        y: 1,
        vers: ['rats', 'fontaine', 'tresor'],
        description: "Des os partout. Une chaise. Sur la chaise, un squelette qui se lève en grinçant.",
        contenu: { type: 'combat', ennemis: [{ ligne: bete('Squelette de base', 'Squelette fatigué'), nombre: 1 }], texte: "« Encore un ? » soupire le squelette (on ne sait pas comment). Les armes contondantes lui font plus mal." },
        tresor: { objets: ['potion-soin'], texte: 'Une fiole poussiéreuse, oubliée par un aventurier moins chanceux.' },
      },
      {
        id: 'tresor',
        nom: 'Salle du trésor',
        x: 4,
        y: 1,
        vers: ['squelette'],
        description: 'Un coffre doré, un tapis rouge, et un gobelin en armure de carton bouilli qui garde le tout.',
        contenu: { type: 'combat', ennemis: [{ ligne: bete('Gobelin', 'Gobelin gardien'), nombre: 1 }], texte: "« Halte ! Le trésor est à moi ! Enfin, à Léonard. Mais je le garde ! »" },
        tresor: { or: 5, texte: 'Le coffre contient 5 PO et des pièces en chocolat (déjà mangées par le gobelin).' },
      },
    ],
  },
  {
    id: 'fariliik',
    nom: 'Les grottes de Fariliik',
    ou: 'monde:grottes',
    intro:
      "L'entrée des grottes est cachée entre deux dunes, gardée par un épouvantail en os de poulet. Ça sent la plume mouillée et le gobelin pas lavé. Quelque part dans le noir, quelqu'un rote.",
    entree: 'entree',
    finale: 'antre',
    conclusion: "Les gobelins survivants s'enfuient en couinant. Le poulailler du fermier Barnabé dormira tranquille.",
    salles: [
      { id: 'entree', nom: 'Entrée des grottes', x: 0, y: 1, vers: ['sentinelle'], description: 'Des plumes, des os de poulet, des empreintes de petits pieds. La lumière du jour s\'arrête ici.' },
      {
        id: 'sentinelle',
        nom: 'Le poste de garde',
        x: 1,
        y: 1,
        vers: ['entree', 'carrefour'],
        description: 'Un tabouret, une lanterne, un gobelin qui ronflait il y a une seconde.',
        contenu: { type: 'combat', ennemis: [{ ligne: bete('Gobelin', 'Gobelin sentinelle'), nombre: 1 }], texte: "« ALERTE ! Euh… » Il n'a prévenu personne, mais il a une lance." },
      },
      { id: 'carrefour', nom: 'Le carrefour', x: 2, y: 1, vers: ['sentinelle', 'reserve', 'fosse', 'source'], description: 'Trois galeries partent dans le noir. Des flèches peintes à la suie : « MANJÉ », « DODO », « CHEF ».' },
      {
        id: 'reserve',
        nom: 'La réserve',
        x: 2,
        y: 0,
        vers: ['carrefour'],
        description: 'Des cages à poules (vides), des sacs de grain, un tonneau de quelque chose qui fermente.',
        tresor: { objets: ['rations', 'potion-soin'], texte: 'Dans un sac, des provisions volées et une potion de soin (volée aussi).' },
      },
      {
        id: 'fosse',
        nom: 'La galerie piégée',
        x: 3,
        y: 2,
        vers: ['carrefour', 'dortoir'],
        description: 'Le sol est couvert de paille. Trop de paille.',
        contenu: {
          type: 'piege',
          carac: 'AD',
          degats: '1D',
          texte: 'Une fosse cachée sous la paille, avec des pieux au fond (taillés grossièrement, mais pointus).',
          evite: 'Tu sautes au dernier moment. La paille tombe dans la fosse, toi non.',
          subit: 'Tu passes à travers la paille et tu goûtes aux pieux gobelins.',
        },
      },
      {
        id: 'dortoir',
        nom: 'Le dortoir',
        x: 4,
        y: 2,
        vers: ['fosse', 'source'],
        description: 'Des paillasses puantes, des chaussettes dépareillées. Deux gobelins se réveillent en grognant.',
        contenu: { type: 'combat', ennemis: [{ ligne: bete('Gobelin'), nombre: 2 }], texte: 'Ils attrapent leurs couteaux, en pyjama.' },
        tresor: { or: 8, objets: ['babiole-gobeline'], texte: 'Sous une paillasse, un petit magot et une babiole qui brille.' },
      },
      {
        id: 'source',
        nom: 'La source',
        x: 3,
        y: 1,
        vers: ['carrefour', 'dortoir', 'antre'],
        description: "Un filet d'eau claire coule de la roche. Même les gobelins ne l'ont pas salie.",
        // Idée de Sedy : une heure au calme près de l'eau pure rend 10 PA aux mages.
        contenu: { type: 'repos', pv: 4, pa: 10, heures: 1, texte: "Tu bois, tu te reposes une heure, l'oreille tendue. Le murmure de l'eau pure apaise l'esprit." },
      },
      {
        id: 'antre',
        nom: "L'antre du Grand Zgrot",
        x: 4,
        y: 0,
        vers: ['source'],
        description: "Un trône en cageots, une collection de casques d'aventuriers sur des piques, et le Grand Zgrot, qui écume.",
        contenu: { type: 'combat', ennemis: [{ ligne: bete('Chef gobelin dément', 'Le Grand Zgrot'), nombre: 1 }], texte: "« TON CASQUE ! JE VEUX TON CASQUE ! » Il est fou, rapide et très motivé." },
        tresor: { or: 25, objets: ['babiole-gobeline'], texte: "Le trésor du Grand Zgrot : 25 PO, des babioles, et des casques trop cabossés pour être revendus." },
      },
    ],
  },
];

export const donjon = (id: string): Donjon => {
  const d = DONJONS.find((x) => x.id === id);
  if (!d) throw new Error(`Donjon inconnu : ${id}`);
  return d;
};

export const donjonIci = (ou: string) => DONJONS.find((d) => d.ou === ou);

export const salle = (d: Donjon, id: string): Salle => d.salles.find((s) => s.id === id)!;

/** Ce qui est encore vide ou pillé : on oublie ce qui a été réglé ou fouillé il y a une semaine ou plus. */
const purger = (e: EtatDonjon, jour: number) => {
  const q = e.quand ?? {};
  const frais = (cle: string) => q[cle] === undefined || jour - q[cle] < REPEUPLEMENT;
  e.reglees = e.reglees.filter((s) => frais(`r:${s}`));
  e.fouillees = e.fouillees.filter((s) => frais(`f:${s}`));
  for (const cle of Object.keys(q)) if (!frais(cle)) delete q[cle];
};

/** Entre dans un donjon. Les salles vidées et pillées depuis moins d'une semaine le restent ; le plan déjà vu aussi. */
export const entrerDonjon = (p: Partie, id: string): EtatDonjon => {
  const d = donjon(id);
  const m = p.memoireDonjons?.[id];
  if (m) {
    purger(m, p.jour);
    p.donjon = { ...m, salle: d.entree, precedente: undefined, vues: m.vues.includes(d.entree) ? m.vues : [d.entree, ...m.vues] };
  } else p.donjon = { id, salle: d.entree, vues: [d.entree], reglees: [], fouillees: [], quand: {} };
  noter(p, `entre dans ${d.nom}.`);
  return p.donjon;
};

/** Ressort du donjon en gardant son état en mémoire (oublier : le donjon repart de zéro). */
export const quitterDonjon = (p: Partie, oublier = false) => {
  const e = p.donjon;
  if (!e) return;
  p.memoireDonjons ??= {};
  if (oublier) delete p.memoireDonjons[e.id];
  else p.memoireDonjons[e.id] = { ...e, precedente: undefined };
  p.donjon = undefined;
};

/** Le jour où le donjon se repeuplera (la plus ancienne salle vidée revient en premier), ou null s'il est intact. */
export const repeuplement = (e: EtatDonjon): number | null => {
  const jours = Object.values(e.quand ?? {});
  return jours.length ? Math.min(...jours) + REPEUPLEMENT : null;
};

/** Le contenu de la salle reste à régler : on ne peut pas passer, seulement reculer. */
export const bloquee = (e: EtatDonjon, s: Salle) => !!s.contenu && s.contenu.type !== 'repos' && !e.reglees.includes(s.id);

/** Les salles où l'on peut aller d'ici. */
export const accessibles = (e: EtatDonjon, d: Donjon): string[] => {
  const s = salle(d, e.salle);
  if (bloquee(e, s)) return e.precedente ? [e.precedente] : [];
  return s.vers;
};

export const avancer = (p: Partie, vers: string): string | null => {
  const e = p.donjon!;
  const d = donjon(e.id);
  if (!accessibles(e, d).includes(vers)) return 'Pas par là.';
  e.precedente = e.salle;
  e.salle = vers;
  if (!e.vues.includes(vers)) e.vues.push(vers);
  passerTemps(p, 1 / 6);
  return null;
};

export const regler = (e: EtatDonjon, id: string, jour?: number) => {
  if (!e.reglees.includes(id)) e.reglees.push(id);
  if (jour !== undefined) (e.quand ??= {})[`r:${id}`] = jour;
};

/** Le piège de la salle : le joueur lance son D20 contre la caractéristique. */
/** Valeur de l'épreuve du piège : passer (Détecter +2 : on le repère à temps) ou le désamorcer (Adresse, Désamorcer +4). */
export const valeurPiege = (p: Partie, c: Extract<Contenu, { type: 'piege' }>, desamorcer = false) =>
  desamorcer
    ? valeurEpreuveQuete(p, { carac: 'AD', modif: c.modif, echec: '', situation: 'desamorcer' })
    : valeurEpreuveQuete(p, { carac: c.carac, modif: c.modif, echec: '', situation: 'piege' });

export const affronterPiege = (
  p: Partie,
  de: number,
  rng?: Rng,
  desamorcer = false,
): { reussi: boolean; valeur: number; degats: number; des: number[]; texte: string } => {
  const e = p.donjon!;
  const s = salle(donjon(e.id), e.salle);
  const c = s.contenu;
  if (c?.type !== 'piege') throw new Error('Pas de piège ici.');
  const valeur = valeurPiege(p, c, desamorcer);
  regler(e, s.id, p.jour);
  if (epreuve(valeur, rng, de).reussi)
    return { reussi: true, valeur, degats: 0, des: [], texte: desamorcer ? 'Clic. Tu bloques le mécanisme avec la pointe de ta dague : le piège ne fera plus de mal à personne.' : c.evite };
  const jet = lancerExpression(c.degats, rng);
  p.ev -= jet.total;
  noter(p, `tombe dans un piège (${s.nom}) : −${jet.total} PV.`);
  return { reussi: false, valeur, degats: jet.total, des: jet.des, texte: c.subit };
};

export const seReposer = (p: Partie): { pv: number; pa: number } => {
  const e = p.donjon!;
  const s = salle(donjon(e.id), e.salle);
  if (s.contenu?.type !== 'repos' || e.reglees.includes(s.id)) return { pv: 0, pa: 0 };
  regler(e, s.id, p.jour);
  passerTemps(p, s.contenu.heures ?? 0.5);
  const avant = ea(p);
  if (s.contenu.pa && eaMax(p)) p.ea = Math.min(eaMax(p), avant + s.contenu.pa);
  return { pv: soigner(p, s.contenu.pv), pa: ea(p) - avant };
};

export const fouiller = (p: Partie): Salle['tresor'] | null => {
  const e = p.donjon!;
  const s = salle(donjon(e.id), e.salle);
  if (!s.tresor || e.fouillees.includes(s.id) || bloquee(e, s)) return null;
  e.fouillees.push(s.id);
  (e.quand ??= {})[`f:${s.id}`] = p.jour;
  p.or = arrondirOr(p.or + (s.tresor.or ?? 0));
  p.sac.push(...(s.tresor.objets ?? []));
  return s.tresor;
};

/** Le combat de la salle, prêt pour l'écran de combat. */
export const combatSalle = (s: Salle): Rencontre | null => {
  if (s.contenu?.type !== 'combat') return null;
  const [premier, ...autres] = s.contenu.ennemis;
  return { ligne: premier.ligne, nombre: premier.nombre, d20: 0, table: s.nom, avec: autres, approche: 1 };
};

export const termine = (e: EtatDonjon) => e.reglees.includes(donjon(e.id).finale);

/** Petit bruit de fond pour les salles déjà vides. */
export const ambiance = (rng?: Rng) =>
  ['Une goutte tombe quelque part.', 'Un courant d\'air froid te frôle la nuque.', 'Au loin, quelque chose gratte.', 'Ta torche crépite.'][lancer(4, rng) - 1];
