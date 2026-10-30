// Calendrier ordinaire de la Terre de Fangh (document officiel « Calendrier de la Terre de Fangh, ordinaire et
// lunaire ») : les mois sont ceux qu'on connaît, mais l'année se découpe en décades nommées, avec des fêtes entre elles,
// et la semaine compte sept jours aux noms des dieux. Le document ne donne ni ère ni année : le jeu n'en affiche pas.
// Choix du jeu : l'aventure commence le 5 avril (décade de Phytgar Ranald, début de la saison des aventuriers),
// un Obouloserin. `Partie.jour` reste un compteur (1 = premier jour de l'aventure) ; ce module le traduit en date.

export const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const LONGUEURS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export const SEMAINE: [string, string][] = [
  ['Obouloserin', 'jour du Grand Travail'],
  ['Crômerin', 'jour de la Grosse Baston'],
  ['Menestrin', 'jour des Belles Rimes'],
  ['Ilshidrin', 'jour de la Grosse Tête'],
  ['Lafounerin', 'jour des Belles Amours'],
  ['Caddyrin', 'jour de la Longue Liste'],
  ['Dlulerin', 'jour du Grand Repos'],
];

/** [mois (1-12), jour, mois, jour, nom] : du premier au dernier jour inclus. */
type Periode = [number, number, number, number, string];

export const DECADES: Periode[] = [
  [1, 1, 1, 10, 'Sbroz'],
  [1, 11, 1, 20, "Th'ungi"],
  [1, 21, 1, 30, 'Uhien le Velu'],
  [2, 1, 2, 10, 'Lakkan'],
  [2, 11, 2, 20, 'Sblortz'],
  [2, 21, 3, 2, 'Gzor, la maudite'],
  [3, 3, 3, 12, 'des Champignons'],
  [3, 16, 3, 25, "Kzaranagax l'Archi-Mage"],
  [3, 26, 4, 4, 'des Géraniums en pot'],
  [4, 5, 4, 14, 'Phytgar Ranald'],
  [4, 16, 4, 25, 'des Géraniums gelés'],
  [4, 27, 5, 6, 'des Pieds humides'],
  [5, 7, 5, 16, 'Zaralbak'],
  [5, 17, 5, 25, 'la petite décade de Ravsgalat'],
  [5, 26, 6, 4, 'Swimaf'],
  [6, 5, 6, 14, 'Vontorz'],
  [6, 15, 6, 24, 'Lasinjan'],
  [6, 25, 7, 4, 'des Premières moissons'],
  [7, 8, 7, 17, 'de la Truite'],
  [7, 18, 7, 27, 'du Grand Khan Ikul'],
  [7, 29, 7, 29, 'des Grands Départs'],
  [7, 30, 8, 8, 'des Pèlerins de Dlul'],
  [8, 9, 8, 18, 'des Grands Retours'],
  [8, 20, 8, 29, 'des Moissons tardives'],
  [8, 31, 9, 9, 'des Vendanges'],
  [9, 10, 9, 19, 'des Bonnes résolutions'],
  [9, 20, 9, 29, 'des Trolls'],
  [10, 2, 10, 11, 'Kazarmon'],
  [10, 13, 10, 22, 'des Liches'],
  [10, 23, 11, 1, 'des Barbares Drombards'],
  [11, 2, 11, 11, 'des Barbares Moriacs'],
  [11, 12, 11, 21, 'des Barbares Syldériens'],
  [11, 23, 12, 2, 'des Cochons'],
  [12, 3, 12, 12, 'des Boules de neige'],
  [12, 13, 12, 22, 'de Saint Taklauss'],
  [12, 23, 12, 31, 'des Jours Sacrés'],
];

export const FETES: Periode[] = [
  [1, 1, 1, 1, 'Nouvelle année'],
  [1, 31, 1, 31, "Fête d'Honslépêle, jour du Sameule"],
  [3, 13, 3, 15, 'Dékhon, les trois jours du con d’or'],
  [4, 15, 4, 15, 'Fête des giboulées'],
  [4, 26, 4, 26, 'Fête des grenouilles'],
  [7, 5, 7, 7, 'Fête de la bière de printemps'],
  [7, 28, 7, 28, 'Fête de Dlul'],
  [8, 19, 8, 19, "Fête d'Oboulos"],
  [8, 30, 8, 30, "Fête de la bière d'automne"],
  [9, 30, 9, 30, 'Fête du vin nouveau frelaté'],
  [10, 1, 10, 1, 'Jour chômé du Mal de tête'],
  [10, 12, 10, 12, 'Fête des pommes'],
  [11, 22, 11, 22, 'Fête de la Baston'],
  [12, 2, 12, 2, 'Fête du gras jambon'],
  [12, 13, 12, 22, 'Saint Taklauss, fête du solstice d’hiver'],
  [12, 23, 12, 31, 'Jours Sacrés de la Grande Binouze'],
];

/** Jour de l'an (0 = 1er janvier) d'une date. */
const rang = (mois: number, jour: number) => LONGUEURS.slice(0, mois - 1).reduce((s, n) => s + n, 0) + jour - 1;

/** Premier jour de l'aventure : le 5 avril. */
export const DEBUT = rang(4, 5);

const dans = (p: Periode, r: number) => r >= rang(p[0], p[1]) && r <= rang(p[2], p[3]);

export interface DateFangh {
  /** Nom du jour de la semaine (Obouloserin…) et sa devise. */
  semaine: string;
  devise: string;
  quantieme: number;
  mois: string;
  /** Décade en cours (« Phytgar Ranald », « des Trolls »), absente les jours de fête entre deux décades. */
  decade?: string;
  fete?: string;
  /** Années passées depuis le début de l'aventure. */
  annee: number;
  saison: 'printemps' | 'été' | 'automne' | 'hiver';
}

/** La date d'un jour de l'aventure (`Partie.jour`, 1 = premier jour). */
export const date = (jour: number): DateFangh => {
  const n = DEBUT + Math.max(0, jour - 1);
  const r = n % 365;
  let m = 0;
  while (r >= rang(m + 2, 1) && m < 11) m++;
  const [semaine, devise] = SEMAINE[(jour - 1 + 7 * 1000) % 7];
  const saison = r < rang(3, 20) || r >= rang(12, 21) ? 'hiver' : r < rang(6, 21) ? 'printemps' : r < rang(9, 22) ? 'été' : 'automne';
  return {
    semaine,
    devise,
    quantieme: r - rang(m + 1, 1) + 1,
    mois: MOIS[m],
    decade: DECADES.find((d) => dans(d, r))?.[4],
    fete: FETES.find((f) => dans(f, r))?.[4],
    annee: Math.floor(n / 365) - Math.floor(DEBUT / 365),
    saison,
  };
};

/** « 5 avril » (avec « 1er » pour le premier du mois). */
export const dateCourte = (jour: number) => {
  const d = date(jour);
  return `${d.quantieme === 1 ? '1er' : d.quantieme} ${d.mois}`;
};

/** « Obouloserin 5 avril ». */
export const dateLongue = (jour: number) => `${date(jour).semaine} ${dateCourte(jour)}`;

/** « décade de Phytgar Ranald », « décade des Trolls », ou la fête du jour. */
export const periode = (jour: number) => {
  const d = date(jour);
  const decade = !d.decade ? '' : d.decade.includes('décade') ? d.decade : `décade ${/^(des|du|de) /.test(d.decade) ? d.decade : `de ${d.decade}`}`;
  return [d.fete, decade].filter(Boolean).join(' · ');
};
