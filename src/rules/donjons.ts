import { creature } from './bestiaire';
import { ea, eaMax } from './magie';
import { lancer, type Rng } from './des';
import { arrondirOr } from './monnaie';
import { objet } from './objets';
import { epreuve, lancerExpression, niveau, noter, passerTemps, soigner, type Partie } from './partie';
import { valeurEpreuve, type CaracQuete } from './epreuves';
import type { LigneRencontre, Rencontre } from './rencontres';
import type { Evenement } from './evenements';
import { DDN } from './ddn-salles';
import { CHATEAU_VALTORDU } from './chateau-valtordu';
import { pauseEssai, quandReessayer, rater, reussir } from './essais';
import { AHOKD, genererAhokd, OU_AHOKD } from './ahokd';

// Donjons : une suite de salles reliées entre elles, montrées sur une mini-carte façon Darkest Dungeon.
// On avance de salle en salle (dix minutes à chaque fois) ; chaque salle peut cacher un combat, un piège,
// un coin pour souffler ou un trésor. Le donjon est terminé quand la salle finale est nettoyée.

export interface Ennemis {
  ligne: LigneRencontre;
  nombre: number;
  /** Renforts par compagnon du héros (le manuel : « calculez les ennemis selon votre équipe »). */
  parCompagnon?: number;
}

/** Plage horaire [début, fin[ en heures ; la fin peut dépasser 24 (« 18 à 26 » : de 18 h à 2 h du matin). */
export type Horaire = [number, number];

export const dansHoraire = (heure: number, hs: Horaire[]) => hs.some(([a, b]) => (heure >= a && heure < b) || (heure + 24 >= a && heure + 24 < b));

export type Contenu =
  | {
      type: 'combat';
      ennemis: Ennemis[];
      texte: string;
      /** Créatures pensantes : on peut se rendre plutôt que mourir. */
      pensants?: boolean;
      /** Un adversaire qui ne revient pas (Zangdar, la liche…) : la salle ne se repeuple pas. */
      unique?: boolean;
      /** Ce qu'on trouve sur eux une fois vaincus (une clé…), en plus du butin ordinaire. */
      gagne?: string[];
      /** Marque posée à la victoire (« ddn:liche-morte »). */
      marque?: string;
    }
  /** Une scène écrite (un PNJ, une énigme, un piège bizarre) : des choix, parfois un dé, parfois un combat. */
  | {
      type: 'scene';
      scene: Evenement;
      /** Rejouable (un PNJ qu'on revoit) ; sinon la salle est réglée après un choix. */
      permanente?: boolean;
      /** Il faut la régler avant d'aller plus loin. */
      bloque?: boolean;
      unique?: boolean;
    }
  /** Une taverne : chope (avec une rumeur), repas, aux heures d'ouverture. */
  | { type: 'taverne'; texte: string; chope: number; repas: number; rumeurs: string[] }
  /** Une échoppe : on y achète au prix du catalogue. */
  | { type: 'boutique'; nom: string; texte: string; stock: string[]; /** Des ragots contre quelques pièces. */ ragots?: { prix: number; textes: string[]; marque?: string } }
  | { type: 'piege'; carac: CaracQuete; modif?: number; degats: string; texte: string; evite: string; subit: string; /** Effet en plus des dégâts (marque…). */ suite?: (p: Partie) => string }
  | { type: 'repos'; pv: number; texte: string; /** Points astraux rendus aux mages. */ pa?: number; /** Durée de la pause (30 minutes par défaut). */ heures?: number };

/** Une serrure (porte ou coffre) : clé, crochetage, épaule ou énigme. */
export interface Serrure {
  /** Ce qu'on en voit. */
  texte: string;
  /** La clé (objet) qui l'ouvre ; plusieurs clés : il les faut toutes. */
  cle?: string | string[];
  /** Crochetage possible : épreuve d'Adresse avec ce modificateur (−3 sans la compétence Serrurier). */
  crochetage?: number;
  /** Peut s'enfoncer ou se fracasser : épreuve de Force avec ce modificateur. */
  force?: number;
  /** Dégâts si le crochetage rate (serrure piégée) ; triplés sur un 20. */
  piege?: string;
  /** S'ouvre en répondant à cette énigme (numéro dans ENIGMES de ddn.ts). */
  enigme?: number;
}

/** Une porte entre deux salles : cachée, fermée à clé, coincée ou fermée par une énigme. Une fois ouverte, elle le reste. */
export interface Porte extends Serrure {
  /** Passage secret : invisible tant qu'on ne l'a pas trouvé (épreuve du joueur, en cherchant). */
  cachee?: { carac: CaracQuete; modif?: number };
  /** La porte ne gêne que depuis la salle où elle est décrite (de l'autre côté, on ouvre sans peine). */
  sensUnique?: boolean;
  /** Ouverte d'office à ces heures-là (une boutique pendant les heures d'ouverture). */
  libre?: Horaire[];
}

/** Une autre version de la salle, selon l'heure ou la partie (la taverne fermée, Zangdar qui dort…). */
export interface Variante {
  quand?: Horaire[];
  si?: (p: Partie) => boolean;
  contenu?: Contenu;
  /** Ce qui change dans la description. */
  description?: string;
}

export interface Salle {
  id: string;
  nom: string;
  /** Case de la mini-carte (colonne, ligne), pour les donjons sans plan. */
  x: number;
  y: number;
  /** Donjon sur plans officiels : l'étage, et la position sur son plan (en % de la largeur et de la hauteur). */
  niveau?: string;
  px?: number;
  py?: number;
  /** Portes vers certaines salles voisines (identifiant de la salle d'en face). */
  portes?: Record<string, Porte>;
  /** On peut quitter le donjon d'ici (entrée, porte de la taverne, balcon avec une corde) : le libellé du bouton. */
  sortie?: string;
  /** Ce qui manque pour sortir par là (une corde assez longue…), ou null. */
  sortieSi?: (p: Partie) => string | null;
  description: string;
  vers: string[];
  contenu?: Contenu;
  /** Versions de la salle selon l'heure : la première qui convient remplace `contenu`. */
  variantes?: Variante[];
  /** Trouvé en fouillant la salle, une fois son contenu réglé. */
  tresor?: Tresor;
}

export interface Tresor {
  or?: number;
  objets?: string[];
  texte: string;
  /** Dans un coffre fermé. */
  serrure?: Serrure;
  /** Planqué : il faut d'abord le trouver (en cherchant, comme un passage secret). */
  cachee?: { carac: CaracQuete; modif?: number };
  /** Une fouille qui prend du temps (le foutoir des gobelins…), en heures. */
  heures?: number;
  /** Haut fait gagné en fouillant ici (Pause casse-croûte). */
  hautFait?: string;
}

export interface Niveau {
  id: string;
  nom: string;
}

export interface Donjon {
  id: string;
  nom: string;
  /** Étages dessinés sur les plans officiels (sinon : mini-carte en cases). */
  niveaux?: Niveau[];
  /** Plusieurs façons d'entrer (porte principale, taverne…), parfois à certaines heures seulement. */
  entrees?: { salle: string; libelle: string; ouverte?: Horaire[] }[];
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
  /** Portes ouvertes (« salleA|salleB », dans l'ordre alphabétique), coffres ouverts (« coffre:salle ») et cachettes trouvées (« vu: ») : ils le restent. */
  ouvertes?: string[];
  /** Le héros croupit dans un cachot (il s'est rendu) ; ses affaires sont au bureau des geôliers. */
  prisonnier?: boolean;
  confisque?: { sac: string[]; equipe: Partie['equipe']; or: number };
  /** Jour de la capture, et jours déjà passés au cachot (pain sec, torture). */
  capture?: number;
  /** Niveau du héros en entrant (haut fait « Massive level up »). */
  niveauEntree?: number;
  /** Or trouvé dans les coffres de ce donjon (haut fait « Chasseurs de trésors »). */
  orTrouve?: number;
  /** Essais ratés d'affilée (« serrure:… », « chercher:… », « evasion:… ») et heure (jour × 24 + heure) avant laquelle on ne peut pas recommencer. */
  essais?: Record<string, { rates: number; jusqu?: number }>;
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
  DDN,
  CHATEAU_VALTORDU,
];

/** Les grottes d'Ahokd déjà tirées (une par graine). */
const GROTTES = new Map<string, Donjon>();

export const donjon = (id: string): Donjon => {
  if (id === AHOKD || id.startsWith(`${AHOKD}:`)) {
    if (!GROTTES.has(id)) GROTTES.set(id, genererAhokd(Number(id.split(':')[1] ?? 0), bete));
    return GROTTES.get(id)!;
  }
  const d = DONJONS.find((x) => x.id === id);
  if (!d) throw new Error(`Donjon inconnu : ${id}`);
  return d;
};

export const donjonIci = (ou: string) => (ou === OU_AHOKD ? donjon(AHOKD) : DONJONS.find((d) => d.ou === ou));

export const salle = (d: Donjon, id: string): Salle => d.salles.find((s) => s.id === id)!;

/** Ce qui est encore vide ou pillé : on oublie ce qui a été réglé ou fouillé il y a une semaine ou plus. */
export const purger = (e: EtatDonjon, jour: number) => {
  const q = e.quand ?? {};
  const frais = (cle: string) => q[cle] === undefined || jour - q[cle] < REPEUPLEMENT;
  e.reglees = e.reglees.filter((s) => frais(`r:${s}`));
  e.fouillees = e.fouillees.filter((s) => frais(`f:${s}`));
  for (const cle of Object.keys(q)) if (!frais(cle)) delete q[cle];
};

/** Entre dans un donjon. Les salles vidées et pillées depuis moins d'une semaine le restent ; le plan déjà vu aussi. */
export const entrerDonjon = (p: Partie, id: string, par?: string): EtatDonjon => {
  // La grotte d'Ahokd : on reprend l'expédition en cours, sinon on tire une nouvelle grotte.
  if (id === AHOKD) {
    const enCours = Object.keys(p.memoireDonjons ?? {}).find((k) => k.startsWith(`${AHOKD}:`) && !termine(p.memoireDonjons![k]));
    for (const k of Object.keys(p.memoireDonjons ?? {})) if (k.startsWith(`${AHOKD}:`) && k !== enCours) delete p.memoireDonjons![k];
    id = enCours ?? `${AHOKD}:${(Math.floor(p.jour) * 7919 + lancer(100000)) % 2147483647}`;
  }
  const d = donjon(id);
  const entree = par && d.entrees?.some((x) => x.salle === par) ? par : d.entree;
  const m = p.memoireDonjons?.[id];
  if (m) {
    purger(m, p.jour);
    p.donjon = { ...m, salle: entree, precedente: undefined, prisonnier: undefined, vues: m.vues.includes(entree) ? m.vues : [...m.vues, entree] };
  } else p.donjon = { id, salle: entree, vues: [entree], reglees: [], fouillees: [], quand: {} };
  p.donjon.niveauEntree = niveau(p);
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

/** Ce que contient la salle en ce moment : la première variante qui convient, sinon le contenu ordinaire. */
export const contenuIci = (s: Salle, p?: Partie): { contenu?: Contenu; cle: string; description?: string } => {
  if (p && s.variantes) {
    const i = s.variantes.findIndex((v) => (!v.quand || dansHoraire(p.heure, v.quand)) && (!v.si || v.si(p)));
    if (i >= 0) return { contenu: s.variantes[i].contenu, cle: `${s.id}#${i}`, description: s.variantes[i].description };
  }
  return { contenu: s.contenu, cle: s.id };
};

/** Le contenu de la salle est-il déjà réglé (combat gagné, piège passé…) ? */
export const reglee = (e: EtatDonjon, s: Salle, p?: Partie) => e.reglees.includes(contenuIci(s, p).cle);

/** Le contenu de la salle reste à régler : on ne peut pas passer, seulement reculer. */
export const bloquee = (e: EtatDonjon, s: Salle, p?: Partie) => {
  const { contenu: c, cle } = contenuIci(s, p);
  if (!c || e.reglees.includes(cle)) return false;
  if (c.type === 'combat' || c.type === 'piege') return true;
  return c.type === 'scene' && !!c.bloque;
};

const clePorte = (a: string, b: string) => [a, b].sort().join('|');

/** La porte entre deux salles, vue depuis `de` (une porte à sens unique ne gêne que de son côté). */
export const porteEntre = (d: Donjon, de: string, vers: string): Porte | undefined => {
  const ici = salle(d, de).portes?.[vers];
  if (ici) return ici;
  const enFace = salle(d, vers).portes?.[de];
  return enFace && !enFace.sensUnique ? enFace : undefined;
};

export const estOuverte = (e: EtatDonjon, a: string, b: string) => !!e.ouvertes?.includes(clePorte(a, b));

const marquer = (e: EtatDonjon, cle: string) => {
  if (!e.ouvertes?.includes(cle)) (e.ouvertes ??= []).push(cle);
};

export const ouvrir = (e: EtatDonjon, a: string, b: string) => marquer(e, clePorte(a, b));

const aVerrou = (s: Serrure) => s.cle !== undefined || s.crochetage !== undefined || s.force !== undefined || s.enigme !== undefined;

/** Un passage secret déjà repéré. */
export const trouvee = (e: EtatDonjon, a: string, b: string) => !!e.ouvertes?.includes(`vu:${clePorte(a, b)}`);

/** Peut-on passer de `de` à `vers` (porte ouverte, passage trouvé, boutique ouverte…) ? */
export const passable = (e: EtatDonjon, d: Donjon, de: string, vers: string, p?: Partie) => {
  const porte = porteEntre(d, de, vers);
  if (!porte || estOuverte(e, de, vers)) return true;
  if (porte.libre && p && dansHoraire(p.heure, porte.libre)) return true;
  if (porte.cachee && !trouvee(e, de, vers)) return false;
  return !aVerrou(porte);
};

/** Les portes fermées autour de la salle que le héros connaît (on ne voit pas les passages secrets pas encore trouvés). */
export const portesAutour = (e: EtatDonjon, d: Donjon, p?: Partie) => {
  const s = salle(d, e.salle);
  return s.vers
    .map((v) => ({ vers: v, porte: porteEntre(d, s.id, v) }))
    .filter((x): x is { vers: string; porte: Porte } => !!x.porte && !passable(e, d, s.id, x.vers, p) && (!x.porte.cachee || trouvee(e, s.id, x.vers)));
};

/** Reste-t-il ici un passage secret ou une cachette à trouver ? */
export const secretsIci = (e: EtatDonjon, d: Donjon) => {
  const s = salle(d, e.salle);
  const passages = s.vers.filter((v) => porteEntre(d, s.id, v)?.cachee && !trouvee(e, s.id, v));
  const cachette = !!s.tresor?.cachee && !e.ouvertes?.includes(`vu:coffre:${s.id}`);
  return { passages, cachette };
};

/** Une seule fouille des murs par salle et par jour : si on n'a rien trouvé, on y reviendra. */
export const cleRecherche = (e: EtatDonjon) => `chercher:${e.salle}`;
export const ESSAIS_SERRURE = 3;
export const cleSerrure = (e: EtatDonjon, cible: Cible, facon: 'crocheter' | 'enfoncer') =>
  `serrure:${e.salle}:${'porte' in cible ? cible.porte : 'coffre'}:${facon}`;

/** Le héros cherche un passage secret ou une cachette (son D20 contre la caractéristique de chacun). */
export const chercher = (p: Partie, de: number): { trouves: string[]; texte: string } => {
  const e = p.donjon!;
  const d = donjon(e.id);
  const s = salle(d, e.salle);
  const pause = pauseEssai(p, cleRecherche(e));
  if (pause !== null) return { trouves: [], texte: `Tu as déjà tâté chaque pierre de cette salle. Tu y verras plus clair ${quandReessayer(p, pause)}.` };
  passerTemps(p, 1 / 6);
  const { passages, cachette } = secretsIci(e, d);
  const trouves: string[] = [];
  for (const v of passages) {
    const c = porteEntre(d, s.id, v)!.cachee!;
    if (epreuve(valeurEpreuve(p, { carac: c.carac, modif: c.modif, situation: 'cachette' }), undefined, de).reussi) {
      marquer(e, `vu:${clePorte(s.id, v)}`);
      trouves.push(v);
    }
  }
  if (cachette) {
    const c = s.tresor!.cachee!;
    if (epreuve(valeurEpreuve(p, { carac: c.carac, modif: c.modif, situation: 'cachette' }), undefined, de).reussi) {
      marquer(e, `vu:coffre:${s.id}`);
      trouves.push('coffre');
    }
  }
  const textes = trouves.map((v) => (v === 'coffre' ? `une cachette : ${s.tresor!.texte.split('.')[0].toLowerCase()}` : porteEntre(d, s.id, v)!.texte));
  return {
    trouves,
    texte: trouves.length
      ? `Tu trouves ${textes.join(', et ')} !`
      : `Tu tâtes les murs, tu soulèves les tapis, tu tapotes les pierres… Rien. Ou alors c'est très bien caché. (Tu pourras refouiller cette salle ${quandReessayer(p, rater(p, cleRecherche(e), 1, 24)!)}.)`,
  };
};

/** Une serrure à ouvrir ici : la porte vers `vers`, ou le coffre de la salle. */
export type Cible = { porte: string } | { coffre: true };

export const serrureDe = (d: Donjon, e: EtatDonjon, cible: Cible): Serrure | undefined =>
  'porte' in cible ? porteEntre(d, e.salle, cible.porte) : salle(d, e.salle).tresor?.serrure;

const deverrouiller = (e: EtatDonjon, cible: Cible) => ('porte' in cible ? ouvrir(e, e.salle, cible.porte) : marquer(e, `coffre:${e.salle}`));

export const coffreOuvert = (e: EtatDonjon, id: string) => !!e.ouvertes?.includes(`coffre:${id}`);

const cles = (s: Serrure) => (s.cle === undefined ? [] : Array.isArray(s.cle) ? s.cle : [s.cle]);

/** Les clés qui manquent pour cette serrure (vide : on a tout). */
export const clesManquantes = (p: Partie, s: Serrure) => cles(s).filter((c) => !p.sac.includes(c));

export const ouvrirAvecCle = (p: Partie, cible: Cible): string | null => {
  const e = p.donjon!;
  const s = serrureDe(donjon(e.id), e, cible);
  if (!s || !cles(s).length) return 'Pas de serrure à clé ici.';
  if (clesManquantes(p, s).length) return 'Il te manque la clé.';
  deverrouiller(e, cible);
  return null;
};

/** Valeur du crochetage : Adresse + modificateur de la serrure, −3 sans Serrurier, −2 sans outils. */
export const valeurCrochetage = (p: Partie, s: Serrure) =>
  valeurEpreuve(p, { carac: 'AD', modif: (s.crochetage ?? 0) - 3 - (p.sac.includes('outils-crochetage') ? 0 : 2), situation: 'serrure' });

export const valeurForce = (p: Partie, s: Serrure) => valeurEpreuve(p, { carac: 'FO', modif: s.force ?? 0 });

export interface Effraction {
  reussi: boolean;
  valeur: number;
  degats: number;
  des: number[];
  texte: string;
}

/** Crocheter (Adresse) ou enfoncer (Force) une serrure, avec le D20 du joueur. Dix minutes à chaque essai. */
export const forcerSerrure = (p: Partie, cible: Cible, facon: 'crocheter' | 'enfoncer', de: number, rng?: Rng): Effraction => {
  const e = p.donjon!;
  const s = serrureDe(donjon(e.id), e, cible)!;
  const valeur = facon === 'crocheter' ? valeurCrochetage(p, s) : valeurForce(p, s);
  const cle = cleSerrure(e, cible, facon);
  const pause = pauseEssai(p, cle);
  if (pause !== null)
    return { reussi: false, valeur, degats: 0, des: [], texte: `${facon === 'crocheter' ? 'Tes doigts tremblent encore' : 'Ton épaule est en compote'}. Réessaie ${quandReessayer(p, pause)}.` };
  passerTemps(p, 1 / 6);
  if (epreuve(valeur, undefined, de).reussi) {
    reussir(p, cle);
    deverrouiller(e, cible);
    return { reussi: true, valeur, degats: 0, des: [], texte: facon === 'crocheter' ? 'Clic. La serrure cède.' : 'Dans un grand fracas, ça cède !' };
  }
  const pauseApres = rater(p, cle, ESSAIS_SERRURE, 1);
  const repos = pauseApres !== null ? ` C'est le ${ESSAIS_SERRURE}e raté : il faut souffler, réessaie ${quandReessayer(p, pauseApres)}.` : '';
  if (facon === 'enfoncer') {
    p.ev = Math.max(0, p.ev - 1);
    return { reussi: false, valeur, degats: 1, des: [], texte: `Ça ne bouge pas d'un pouce. Ton épaule, elle, a bougé. Et tout l'étage a entendu.${repos}` };
  }
  if (s.piege) {
    const jet = lancerExpression(s.piege, rng);
    const degats = de === 20 ? jet.total * 3 : jet.total;
    p.ev -= degats;
    noter(p, `se fait électrocuter par une serrure piégée (−${degats} PV).`);
    return { reussi: false, valeur, degats, des: jet.des, texte: (de === 20 ? 'Raté, et en beauté : le piège te part en pleine figure, dégâts triplés !' : 'Raté : la serrure était piégée !') + repos };
  }
  return { reussi: false, valeur, degats: 0, des: [], texte: `Raté : le mécanisme résiste.${repos || ' Tu peux réessayer.'}` };
};

/** Ouvre une serrure à énigme si la réponse est la bonne. */
export const repondreSerrure = (p: Partie, cible: Cible, bonne: boolean): boolean => {
  const e = p.donjon!;
  passerTemps(p, 1 / 12);
  if (bonne) deverrouiller(e, cible);
  return bonne;
};

/** Les salles où l'on peut aller d'ici. */
export const accessibles = (e: EtatDonjon, d: Donjon, p?: Partie): string[] => {
  if (e.prisonnier) return [];
  const s = salle(d, e.salle);
  if (bloquee(e, s, p)) return e.precedente ? [e.precedente] : [];
  return s.vers.filter((v) => passable(e, d, s.id, v, p));
};

/** Une salle déjà visitée dont le contenu est réglé (ou vide) : on peut la traverser sans s'arrêter. */
export const nettoyee = (e: EtatDonjon, s: Salle, p?: Partie) => e.vues.includes(s.id) && (!contenuIci(s, p).contenu || reglee(e, s, p));

/**
 * Les salles déjà visitées qu'on peut rejoindre d'un coup, avec le chemin le plus court (sans la salle de départ) :
 * on ne traverse que des salles visitées et nettoyées, par des portes ouvertes. La destination, elle, peut ne pas l'être.
 */
export const destinations = (e: EtatDonjon, d: Donjon, p?: Partie): Map<string, string[]> => {
  const chemins = new Map<string, string[]>([[e.salle, []]]);
  const file = [e.salle];
  while (file.length) {
    const ici = file.shift()!;
    const suivantes = ici === e.salle ? accessibles(e, d, p) : nettoyee(e, salle(d, ici), p) ? salle(d, ici).vers.filter((v) => passable(e, d, ici, v, p)) : [];
    for (const v of suivantes) {
      if (chemins.has(v) || !e.vues.includes(v)) continue;
      chemins.set(v, [...chemins.get(ici)!, v]);
      file.push(v);
    }
  }
  chemins.delete(e.salle);
  return chemins;
};

/** Traverse plusieurs salles d'un coup ; s'arrête si quelque chose bloque en route. Renvoie le nombre de salles parcourues. */
export const voyager = (p: Partie, vers: string): { pas: number; refus: string | null } => {
  const e = p.donjon!;
  const chemin = destinations(e, donjon(e.id), p).get(vers);
  if (!chemin) return { pas: 0, refus: 'Pas de chemin sûr jusque-là.' };
  let pas = 0;
  for (const id of chemin) {
    const refus = avancer(p, id);
    if (refus) return { pas, refus };
    pas++;
  }
  return { pas, refus: null };
};

export const avancer = (p: Partie, vers: string): string | null => {
  const e = p.donjon!;
  const d = donjon(e.id);
  if (!accessibles(e, d, p).includes(vers)) return 'Pas par là.';
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
    ? valeurEpreuve(p, { carac: 'AD', modif: c.modif, situation: 'desamorcer' })
    : valeurEpreuve(p, { carac: c.carac, modif: c.modif, situation: 'piege' });

export const affronterPiege = (
  p: Partie,
  de: number,
  rng?: Rng,
  desamorcer = false,
): { reussi: boolean; valeur: number; degats: number; des: number[]; texte: string } => {
  const e = p.donjon!;
  const s = salle(donjon(e.id), e.salle);
  const { contenu: c, cle } = contenuIci(s, p);
  if (c?.type !== 'piege') throw new Error('Pas de piège ici.');
  const valeur = valeurPiege(p, c, desamorcer);
  regler(e, cle, p.jour);
  if (epreuve(valeur, rng, de).reussi)
    return { reussi: true, valeur, degats: 0, des: [], texte: desamorcer ? 'Clic. Tu bloques le mécanisme avec la pointe de ta dague : le piège ne fera plus de mal à personne.' : c.evite };
  const jet = lancerExpression(c.degats, rng);
  p.ev -= jet.total;
  noter(p, `tombe dans un piège (${s.nom}) : −${jet.total} PV.`);
  const suite = c.suite?.(p);
  return { reussi: false, valeur, degats: jet.total, des: jet.des, texte: suite ? `${c.subit} ${suite}` : c.subit };
};

export const seReposer = (p: Partie): { pv: number; pa: number } => {
  const e = p.donjon!;
  const s = salle(donjon(e.id), e.salle);
  const { contenu: c, cle } = contenuIci(s, p);
  if (c?.type !== 'repos' || e.reglees.includes(cle)) return { pv: 0, pa: 0 };
  regler(e, cle, p.jour);
  passerTemps(p, c.heures ?? 0.5);
  const avant = ea(p);
  if (c.pa && eaMax(p)) p.ea = Math.min(eaMax(p), avant + c.pa);
  return { pv: soigner(p, c.pv), pa: ea(p) - avant };
};

// --- Faire une pause dans un donjon --------------------------------------------------------
// Pour ne pas devoir remonter à la taverne à chaque égratignure (choix de Sedy, valeurs maison) :
// - casser la croûte (il faut de quoi manger) : 30 minutes, +3 PV et +3 PA pour tout le groupe, une fois toutes les 3 heures ;
// - se reposer une heure : +1 PV et +2 PA (repos inconfortable, règles V4 5.2) ;
// - camper jusqu'à l'aube, comme un bivouac : seulement dans une salle calme et sûre, loin des monstres.

/** De quoi manger : rations, boudins et autres denrées qui rendent des PV. */
export const estNourriture = (id: string) => /ration/.test(id) || (objet(id).type === 'materiel' && !!objet(id).soin);

/** Le premier en-cas du sac (le moins cher). */
export const encas = (p: Partie) => [...p.sac].filter(estNourriture).sort((a, b) => objet(a).prix - objet(b).prix)[0];

export const DELAI_CASSE_CROUTE = 3;

const maintenant = (p: Partie) => p.jour * 24 + p.heure;

/** La salle est-elle calme (rien à régler ici) ? */
export const salleCalme = (e: EtatDonjon, s: Salle, p: Partie) => {
  const c = contenuIci(s, p).contenu;
  return !c || reglee(e, s, p) || c.type === 'repos' || c.type === 'taverne' || c.type === 'boutique';
};

/** Pourquoi on ne peut pas camper ici (null : c'est bon). */
export const refusCamp = (p: Partie): string | null => {
  const e = p.donjon!;
  const d = donjon(e.id);
  const s = salle(d, e.salle);
  if (!salleCalme(e, s, p)) return "La salle n'est pas sûre : règle d'abord ce qui s'y trouve.";
  if (/couloir|escalier|puits|passage|corridor|échelle|pont|trappe/i.test(s.nom)) return "Pas de quoi s'installer dans un lieu de passage : il faut une vraie salle.";
  const proches = s.vers.filter((v) => {
    const x = salle(d, v);
    const c = contenuIci(x, p).contenu;
    return c?.type === 'combat' && !reglee(e, x, p);
  });
  if (proches.length) return 'Trop près des monstres : on les entend remuer dans une salle voisine.';
  return null;
};

export interface Pause {
  type: 'croute' | 'heure' | 'camp';
  texte: string;
}

const reposGroupe = (p: Partie, pv: number, pa: number) => {
  for (const c of p.compagnons ?? []) {
    c.ev = Math.min(c.evMax, c.ev + pv);
    if (c.ea !== undefined) c.ea += pa;
  }
};

/** Casser la croûte : un en-cas, 30 minutes, +3 PV et +3 PA pour tout le monde. */
export const casserCroute = (p: Partie): string => {
  const id = encas(p);
  if (!id) return "Rien à manger dans le sac : il faudrait des rations, un boudin…";
  const depuis = p.casseCroute === undefined ? Infinity : maintenant(p) - p.casseCroute;
  if (depuis < DELAI_CASSE_CROUTE) return `Vous avez mangé il y a moins de ${DELAI_CASSE_CROUTE} heures : personne n'a faim.`;
  p.sac.splice(p.sac.indexOf(id), 1);
  p.casseCroute = maintenant(p);
  passerTemps(p, 0.5);
  const pv = soigner(p, 3);
  const avant = ea(p);
  if (eaMax(p)) p.ea = Math.min(eaMax(p), avant + 3);
  reposGroupe(p, 3, 3);
  return `Assis sur une pierre, vous partagez ${objet(id).nom.toLowerCase()}. Tu récupères ${pv} PV${eaMax(p) ? ` et ${ea(p) - avant} PA` : ''} ; les compagnons, 3 PV chacun.`;
};

/** Se poser une heure, l'oreille tendue. */
export const reposUneHeure = (p: Partie): string => {
  passerTemps(p, 1);
  const pv = soigner(p, 1);
  const avant = ea(p);
  if (eaMax(p)) p.ea = Math.min(eaMax(p), avant + 2);
  reposGroupe(p, 1, 2);
  return `Une heure assis contre le mur, à écouter les bruits du donjon. Tu récupères ${pv} PV${eaMax(p) ? ` et ${ea(p) - avant} PA` : ''}.`;
};

export const fouiller = (p: Partie): Salle['tresor'] | null => {
  const e = p.donjon!;
  const s = salle(donjon(e.id), e.salle);
  if (!peutFouiller(e, s, p)) return null;
  e.fouillees.push(s.id);
  (e.quand ??= {})[`f:${s.id}`] = p.jour;
  // Les objets comptent aussi pour « Chasseurs de trésors », à leur prix.
  e.orTrouve = (e.orTrouve ?? 0) + (s.tresor!.or ?? 0) + (s.tresor!.objets ?? []).reduce((t, id) => t + objet(id).prix, 0);
  if (s.tresor!.heures) passerTemps(p, s.tresor!.heures);
  p.or = arrondirOr(p.or + (s.tresor!.or ?? 0));
  p.sac.push(...(s.tresor!.objets ?? []));
  return s.tresor!;
};

/** Le trésor de la salle est-il à portée (trouvé, coffre ouvert, salle calme) ? */
export const peutFouiller = (e: EtatDonjon, s: Salle, p?: Partie) =>
  !!s.tresor &&
  !e.fouillees.includes(s.id) &&
  !bloquee(e, s, p) &&
  (!s.tresor.cachee || !!e.ouvertes?.includes(`vu:coffre:${s.id}`)) &&
  (!s.tresor.serrure || coffreOuvert(e, s.id));

/** Le combat de la salle, prêt pour l'écran de combat. */
export const combatSalle = (s: Salle, p?: Partie): Rencontre | null => {
  const c = contenuIci(s, p).contenu;
  if (c?.type !== 'combat') return null;
  const n = (x: Ennemis) => ({ ligne: x.ligne, nombre: x.nombre + (x.parCompagnon ?? 0) * (p?.compagnons?.length ?? 0) });
  const [premier, ...autres] = c.ennemis.map(n);
  return { ligne: premier.ligne, nombre: premier.nombre, d20: 0, table: s.nom, avec: autres, approche: 1, reddition: c.pensants || undefined };
};

/** L'étage d'une salle (donjon sur plans). */
export const niveauDe = (d: Donjon, id: string) => d.niveaux?.find((n) => n.id === salle(d, id).niveau);

export const termine = (e: EtatDonjon) => e.reglees.includes(donjon(e.id).finale);

/** Petit bruit de fond pour les salles déjà vides. */
export const ambiance = (rng?: Rng) =>
  ['Une goutte tombe quelque part.', 'Un courant d\'air froid te frôle la nuque.', 'Au loin, quelque chose gratte.', 'Ta torche crépite.'][lancer(4, rng) - 1];
