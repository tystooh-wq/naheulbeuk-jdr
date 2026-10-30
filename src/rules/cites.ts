import { LIEUX_CHNAFON, RESEAU_CHNAFON, RUMEURS_CHNAFON } from './chnafon';
import { LIEUX_FQUIEPOU, RESEAU_FQUIEPOU, RUMEURS_FQUIEPOU } from './fquiepou';
import { LIEUX_GLARGH, RESEAU_GLARGH, RUMEURS_GLARGH } from './glargh';
import { LIEUX_JAMBFER, RESEAU_JAMBFER, RUMEURS_JAMBFER } from './jambfer';
import { LIEUX_KJANIOUF, RESEAU_KJANIOUF, RUMEURS_KJANIOUF } from './kjaniouf';
import { LIEUX_LOUBET, RESEAU_LOUBET, RUMEURS_LOUBET } from './loubet';
import { LIEUX_MLIUEJ, RESEAU_MLIUEJ, RUMEURS_MLIUEJ } from './mliuej';
import { LIEUX_TULAMOR, RESEAU_TULAMOR, RUMEURS_TULAMOR } from './tulamor';
import { longueur, pointA, RAPPORT_PLAN, trajet, type Point } from './rues';
import { LIEUX_VALTORDU, RESEAU_VALTORDU, RUMEURS_VALTORDU } from './valtordu';
import { LIEUX, RUMEURS_LOUCHES, RUMEURS_NORMALES, type Lieu } from './waldorg';

// Les villes jouables, avec leur plan officiel : Waldorg (la capitale), Valtordu (le village des débutants)
// et les autres villes et villages cartographiés de la Terre de Fangh.

export interface Cite {
  id: string;
  nom: string;
  sousTitre: string;
  lieux: Lieu[];
  /** Rapport largeur / hauteur du plan. */
  rapport: number;
  /** Trajets précalculés le long des rues (Waldorg), ou réseau de rues relevé à la main (Valtordu). */
  trajets?: Record<string, Point[]>;
  reseau?: { noeuds: Record<string, Point>; aretes: [string, string][]; acces?: Record<string, string> };
  /** Lieu de la carte du monde où l'on se retrouve en sortant. */
  lieuMonde: string;
  rumeurs: { normales: string[]; louches: string[] };
  /** Récit d'arrivée, paragraphe par paragraphe. */
  arrivee: string[];
  /** Heures de marche pour traverser le plan de part en part. */
  heuresTraversee: number;
  sortie: string;
  /** Droit d'entrée réclamé à la porte, par personne : la fenêtre de la porte s'ouvre d'elle-même tant qu'il n'est pas réglé. */
  peage?: Peage;
}

export interface Peage {
  /** Ce que dit le garde. */
  texte: string;
  /** Prix par personne : un nombre fixe, ou des dés que le garde lance (« 1D6+2 »). */
  prix: number | string;
  /** Peut-on discuter le prix (épreuve de Charisme) ? */
  marchandable: boolean;
}

export const CITES: Cite[] = [
  {
    id: 'waldorg',
    nom: 'Waldorg',
    sousTitre: 'Capitale de la Terre de Fangh, épicentre de la magie de haut niveau. On peut tout y acheter, à condition que ce soit cher.',
    lieux: LIEUX,
    rapport: RAPPORT_PLAN,
    lieuMonde: 'waldorg',
    rumeurs: { normales: RUMEURS_NORMALES, louches: RUMEURS_LOUCHES },
    arrivee: [
      "Après une longue marche, {nom} traverse le souk de la banlieue, où un marchand de tapis tente de lui vendre un chameau. Aux portes de la ville, un garde mâchonne une saucisse et l'examine de la tête aux pieds.",
      "« Aventurier, hein ? Bienvenue à Waldorg. Pas de bagarre, pas de magie dans les rues, et si vous mourez, c'est à vos frais. »",
    ],
    heuresTraversee: 1.6,
    sortie: 'Quitter Waldorg et partir sur les routes',
  },
  {
    id: 'valtordu',
    nom: 'Valtordu',
    sousTitre: "Son boudin, ses pulls. Un village tranquille à l'extrême sud-ouest de la Terre de Fangh, parfait pour commencer une carrière d'aventurier.",
    lieux: LIEUX_VALTORDU,
    rapport: 1600 / 1130,
    reseau: RESEAU_VALTORDU,
    lieuMonde: 'valtordu',
    rumeurs: { normales: RUMEURS_VALTORDU, louches: RUMEURS_VALTORDU },
    arrivee: [
      "{nom} arrive par le chemin de l'Est, passe le vieux moulin et découvre Valtordu : des toits de chaume, des moutons partout, et une odeur de boudin grillé qui flotte jusqu'au pont des Tricoteuses.",
      "Une vieille dame en pull affreux te dévisage. « Encore un aventurier. Le Donjon Facile, c'est au bout de la rue Chafouin. Et essuie tes bottes. »",
    ],
    heuresTraversee: 0.4,
    sortie: "Quitter Valtordu par le chemin de l'Est",
  },
  {
    id: 'loubet',
    nom: 'Loubet',
    sousTitre: "La ville sans histoires, sur la Glandebruine. Il ne s'y passe rien, et c'est sa fierté.",
    lieux: LIEUX_LOUBET,
    rapport: 1600 / 1131,
    reseau: RESEAU_LOUBET,
    lieuMonde: 'loubet',
    rumeurs: { normales: RUMEURS_LOUBET, louches: RUMEURS_LOUBET },
    arrivee: [
      "{nom} descend la route de Valtordu entre deux champs de choux. Loubet somnole au bord de la Glandebruine : un chat traverse la rue, s'arrête au milieu, et décide que ça ne vaut pas la peine de continuer.",
      "Un vieux assis devant sa porte te regarde passer. « Un aventurier ? Ici ? » Il réfléchit longuement. « Le musée du Fauteuil est ouvert. Enfin, je crois. »",
    ],
    heuresTraversee: 0.35,
    sortie: 'Quitter Loubet par la route de Valtordu',
  },
  {
    id: 'fquiepou',
    nom: 'Fquiepou',
    sousTitre: "« Joyau de l'Est », la ville du savon, au confluent de la Syé et de la Zoc. Riche, propre, et jalouse de ses recettes.",
    lieux: LIEUX_FQUIEPOU,
    rapport: 2304 / 3219,
    reseau: RESEAU_FQUIEPOU,
    lieuMonde: 'fquiepou',
    rumeurs: { normales: RUMEURS_FQUIEPOU, louches: RUMEURS_FQUIEPOU },
    arrivee: [
      "{nom} arrive par la route de Waldorg, entre les fermes et les champs. Pas de rempart à Fquiepou : juste une odeur de savon qui flotte sur toute la ville, et des tours de guet le long du fleuve contre les pirates d'eau douce.",
      "Un enfant te tend un prospectus : « Savonnerie Gilbert, la vraie recette ! » Un autre, plus loin, t'en tend un autre : « Savonnerie Marcellin, la VRAIE vraie recette ! »",
    ],
    heuresTraversee: 0.6,
    sortie: 'Quitter Fquiepou par la route de Waldorg',
  },
  {
    id: 'kjaniouf',
    nom: 'Kjaniouf',
    sousTitre: "Le « Comptoir du Centre », ville de marchands près de l'embouchure de l'Elibed. On y vend de tout, on y vole de tout.",
    lieux: LIEUX_KJANIOUF,
    rapport: 1600 / 1131,
    reseau: RESEAU_KJANIOUF,
    lieuMonde: 'kjaniouf',
    rumeurs: { normales: RUMEURS_KJANIOUF, louches: RUMEURS_KJANIOUF },
    arrivee: [
      "{nom} entre à Kjaniouf par l'avenue Caddyro. Pas de rempart, mais des tours et des gardes partout, qui te regardent comme un voleur potentiel. Ce qui, à Kjaniouf, est un compliment.",
      "Sur la Grand'Place, une statue du seigneur Jean-Yves Chafouin te contemple d'un air satisfait. Un marchand te propose des Goudilles « parfum rare ».",
    ],
    heuresTraversee: 0.7,
    sortie: 'Quitter Kjaniouf par l’avenue Caddyro',
  },
  {
    id: 'tulamor',
    nom: 'Tulamor',
    sousTitre: 'La « Croisée des grandes routes », au sud de la forêt de Schlipak. Saucisses sèches, dinde fumée et monstres errants.',
    lieux: LIEUX_TULAMOR,
    rapport: 2269 / 1604,
    reseau: RESEAU_TULAMOR,
    lieuMonde: 'tulamor',
    rumeurs: { normales: RUMEURS_TULAMOR, louches: RUMEURS_TULAMOR },
    arrivee: [
      "{nom} passe le poste de garde de la route Farfelue et traverse la Spirloutte. Tulamor sent la saucisse sèche, la dinde fumée et l'alcool de la distillerie Kelkannie.",
      "Un soldat t'arrête : « Avec Marzol, tu fais pas ton mariolle ! » Puis il te laisse passer en ricanant.",
    ],
    heuresTraversee: 0.5,
    sortie: 'Quitter Tulamor par la route Farfelue',
  },
  {
    id: 'mliuej',
    nom: 'Mliuej',
    sousTitre: 'La « Cité de la bière », au pied des montagnes du Nord. Plus de 500 bières, et des rues larges pour les ivrognes.',
    lieux: LIEUX_MLIUEJ,
    rapport: 1600 / 1130,
    reseau: RESEAU_MLIUEJ,
    lieuMonde: 'mliuej',
    rumeurs: { normales: RUMEURS_MLIUEJ, louches: RUMEURS_MLIUEJ },
    arrivee: [
      "{nom} arrive à Mliuej par l'avenue d'Odilderay, juste à l'heure où toute la ville quitte les brasseries pour les tavernes. Un « bouchon » de badauds à demi ivres t'emporte jusqu'au marché aux bières.",
      "Un nain te tape sur l'épaule. « Première fois ? Commence par la Goulize, finis par la Kanterbouref, et ne t'approche pas du Tabouret à l'Envers. »",
    ],
    heuresTraversee: 0.6,
    sortie: "Quitter Mliuej par l'avenue d'Odilderay",
  },
  {
    id: 'chnafon',
    nom: 'Chnafon',
    sousTitre: "Une ville fortifiée sur la rive ouest du lac de Zblouf. Ses habitants sont fâchés avec tout le monde, et ses gardes ont faim de pièces.",
    lieux: LIEUX_CHNAFON,
    rapport: 1600 / 1130,
    reseau: RESEAU_CHNAFON,
    lieuMonde: 'chnafon',
    rumeurs: { normales: RUMEURS_CHNAFON, louches: RUMEURS_CHNAFON },
    arrivee: [
      "{nom} arrive à la porte ouest de Chnafon. Une pancarte porte le nom de la ville ; quelqu'un a ajouté en dessous « À vos souhaits ».",
      "Le garde tend la main. « Droit de passage. » Il n'y a pas de tarif affiché. Il n'y en a jamais eu.",
    ],
    heuresTraversee: 0.5,
    sortie: 'Quitter Chnafon par la porte ouest',
    peage: {
      texte: "Le garde de la porte ouest se gratte le menton, compte tes bagages du regard, et annonce un prix. Par personne. Il le trouve sans doute raisonnable.",
      prix: '1D+2',
      marchandable: true,
    },
  },
  {
    id: 'glargh',
    nom: 'Glargh',
    sousTitre: "La « capitale de l'aventure », à l'embouchure de l'Elibed. Moines, marchands, gladiateurs, et tout ce qui se vend, même ce qui n'existe pas.",
    lieux: LIEUX_GLARGH,
    rapport: 2000 / 1399,
    reseau: RESEAU_GLARGH,
    lieuMonde: 'glargh',
    rumeurs: { normales: RUMEURS_GLARGH, louches: RUMEURS_GLARGH },
    arrivee: [
      "{nom} entre dans Glargh par la rue de l'Est, au milieu des chariots, des camelots de la place des Kundars et des supporters de Brute-Balle qui chantent faux.",
      "Un marchand te prend par le bras : « Une relique authentique de Crôm ? Un billet pour le Stade ? Un plan de la ville avec les toilettes ? » Bienvenue à Glargh.",
    ],
    heuresTraversee: 1.2,
    sortie: "Quitter Glargh par la rue de l'Est",
  },
  {
    id: 'jambfer',
    nom: 'Jambfer',
    sousTitre: "La mine de Jambfer, cité naine sous les montagnes du Nord. Tout le monde y est chiant et radin, et tout est payant.",
    lieux: LIEUX_JAMBFER,
    rapport: 2200 / 1555,
    reseau: RESEAU_JAMBFER,
    lieuMonde: 'jambfer',
    rumeurs: { normales: RUMEURS_JAMBFER, louches: RUMEURS_JAMBFER },
    arrivee: [
      "{nom} grimpe au-dessus du village de Birtek jusqu'au poste de garde de la galerie piétonnière. Les gardes nains examinent ton équipement en marmonnant, puis encaissent la taxe d'entrée.",
      "Une centaine de mètres de galerie plus loin, l'air devient une soupe de fumées et d'odeurs. Il n'y a aucun panneau en langage commun : demander son chemin, c'est payant.",
    ],
    heuresTraversee: 0.15,
    peage: {
      texte: "Au poste extérieur, un garde nain tape sur un écriteau gravé en runes : la taxe d'entrée, 5 pièces d'or par personne. Il n'y a rien à discuter, et il le fait savoir.",
      prix: 5,
      marchandable: false,
    },
    sortie: "Ressortir de la mine par la galerie de l'extérieur",
  },
];

/** Accepte aussi les vieilles sauvegardes, où la ville s'écrivait « Waldorg ». */
export const cite = (id: string): Cite => CITES.find((c) => c.id === id.toLowerCase()) ?? CITES[0];

export const lieuCite = (c: Cite, id: string): Lieu => {
  const l = c.lieux.find((x) => x.id === id);
  if (!l) throw new Error(`Lieu inconnu à ${c.nom} : ${id}`);
  return l;
};

const distance = (c: Cite, a: Point, b: Point) => Math.hypot(a[0] - b[0], (a[1] - b[1]) / c.rapport);

/** Plus court chemin dans le réseau de rues (Dijkstra, il y a une quinzaine de carrefours). */
const parLesRues = (c: Cite, a: Lieu, b: Lieu): Point[] => {
  const { noeuds, aretes, acces } = c.reseau!;
  const depart: Point = [a.x, a.y];
  const arrivee: Point = [b.x, b.y];
  const proche = (pt: Point) => Object.keys(noeuds).reduce((m, k) => (distance(c, noeuds[k], pt) < distance(c, noeuds[m], pt) ? k : m));
  const de = acces?.[a.id] ?? proche(depart);
  const vers = acces?.[b.id] ?? proche(arrivee);
  const dist: Record<string, number> = { [de]: 0 };
  const avant: Record<string, string> = {};
  const restants = new Set(Object.keys(noeuds));
  while (restants.size) {
    const n = [...restants].reduce((m, k) => ((dist[k] ?? Infinity) < (dist[m] ?? Infinity) ? k : m));
    restants.delete(n);
    if (n === vers || dist[n] === undefined) break;
    for (const [a, b] of aretes) {
      const voisin = a === n ? b : b === n ? a : null;
      if (!voisin || !restants.has(voisin)) continue;
      const d = dist[n] + distance(c, noeuds[n], noeuds[voisin]);
      if (d < (dist[voisin] ?? Infinity)) {
        dist[voisin] = d;
        avant[voisin] = n;
      }
    }
  }
  const etapes: string[] = [vers];
  while (etapes[0] !== de && avant[etapes[0]]) etapes.unshift(avant[etapes[0]]);
  return [depart, ...etapes.map((k) => noeuds[k]), arrivee];
};

export const trajetCite = (c: Cite, a: Lieu, b: Lieu): Point[] => {
  if (a.id === b.id) return [[a.x, a.y]];
  if (c.reseau) return parLesRues(c, a, b);
  return trajet(a, b, c.trajets);
};

export const longueurCite = (c: Cite, chemin: Point[]) => longueur(chemin, c.rapport);
export const pointCite = (c: Cite, chemin: Point[], t: number) => pointA(chemin, t, c.rapport);
