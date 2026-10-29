// Carte du monde : la Terre de Fangh (carte officielle de John Lang, 3000 × 2000 pixels).
// Les positions sont en pixels de cette carte. Les pistes suivent les pointillés de la carte ;
// celles marquées « hors piste » traversent la lande ou les dunes, là où la carte n'a pas de chemin.

export type Point = [number, number];

export const CARTE_MONDE = { largeur: 3000, hauteur: 2000 };

/** Échelle de la carte : la barre de 60 km mesure 558 pixels. */
export const PX_PAR_KM = 558.5 / 60;

export type Terrain = 'sentier' | 'plaine' | 'dunes';

/** Supplément « Déplacements et transport », voyage à pied (km par jour). */
export const KM_PAR_JOUR: Record<Terrain, { normale: number; forcee: number }> = {
  sentier: { normale: 30, forcee: 45 },
  plaine: { normale: 30, forcee: 45 },
  // « Désert chaud » : les dunes waldorgaises sont arides mais petites.
  dunes: { normale: 26, forcee: 38 },
};

/** Une journée de voyage compte une dizaine d'heures de route, pauses comprises. */
export const HEURES_DE_ROUTE_PAR_JOUR = 10;
/** La nuit tombe à 20 h ; on ne repart pas avant 6 h. */
export const CREPUSCULE = 20;
export const AUBE = 6;

export const NOM_TERRAIN: Record<Terrain, string> = { sentier: 'piste', plaine: 'hors piste, lande', dunes: 'hors piste, dunes' };

export type TypeLieuMonde = 'ville' | 'village' | 'campement' | 'grotte' | 'bac';

export interface LieuMonde {
  id: string;
  nom: string;
  type: TypeLieuMonde;
  x: number;
  y: number;
  description: string;
  /** Une auberge de campagne (tarifs du tableau « Matériel et services » : auberge pourrie ou de qualité). */
  auberge?: { nom: string; repas: number; chambre: number; confort: 'mauvais' | 'normal' | 'excellent' };
  /** On peut y acheter des rations. */
  rations?: number;
  /** Nom absent de la carte officielle : il a été inventé pour le jeu. */
  inventeNom?: boolean;
}

export const LIEUX_MONDE: LieuMonde[] = [
  {
    id: 'waldorg',
    nom: 'Waldorg',
    type: 'ville',
    x: 2442,
    y: 1325,
    description: "La capitale de la Terre de Fangh, au bord du fleuve Syé et de la mer d'Embarh. Ses tours se voient de loin, ses impôts aussi.",
  },
  {
    id: 'grangu',
    nom: 'Grangu',
    type: 'village',
    x: 2335,
    y: 1282,
    description: 'Un gros village côtier à l\'ouest de Waldorg. Des pêcheurs, des filets qui sèchent et une odeur de poisson qui ne part jamais vraiment.',
    auberge: { nom: 'Auberge du Hareng Fatigué', repas: 1, chambre: 2, confort: 'normal' },
    rations: 4,
  },
  {
    id: 'sival',
    nom: 'Sival',
    type: 'village',
    x: 2515,
    y: 1240,
    description: 'Village côtier au nord-est de Waldorg, à l\'embouchure de la Nervi. On dit que l\'eau de la rivière sent parfois les pieds d\'orque.',
    auberge: { nom: 'Taverne de la Nervi', repas: 1, chambre: 2, confort: 'normal' },
    rations: 4,
  },
  {
    id: 'hameau',
    nom: 'Hameau de la côte',
    type: 'village',
    x: 2280,
    y: 1264,
    inventeNom: true,
    description: "Quelques maisons de pêcheurs, là où la piste de Fierpâté rejoint la côte. Ici, on loue une paillasse et on ne pose pas de questions.",
    auberge: { nom: 'Paillasse chez la veuve Moule', repas: 1, chambre: 1, confort: 'mauvais' },
  },
  {
    id: 'bac',
    nom: 'Embarcadère du bac',
    type: 'bac',
    x: 2554,
    y: 1167,
    inventeNom: true,
    description: "Un ponton sur le fleuve Syé, en face de Jeanlaf. Le passeur fait traverser vers la Caladie, quand il n'a pas trop bu.",
  },
  {
    id: 'campement',
    nom: 'Campement de nomades',
    type: 'campement',
    x: 2482,
    y: 1075,
    description: 'Des tentes colorées au bord des Terres Sauvages. Les nomades des dunes y vendent du thé à la menthe et des tapis qui ne volent pas.',
    rations: 4,
  },
  {
    id: 'biouro',
    nom: 'Biouro',
    type: 'village',
    x: 2425,
    y: 992,
    description: 'Un village de bûcherons à la lisière du bois N\'talamela. Les elfes du bois viennent y râler contre le bruit des haches.',
    auberge: { nom: 'Le Copeau Joyeux', repas: 1, chambre: 2, confort: 'normal' },
    rations: 4,
  },
  {
    id: 'fierpate',
    nom: 'Fierpâté',
    type: 'village',
    x: 2100,
    y: 1007,
    description: 'Le village des semi-hommes, célèbre pour sa charcuterie, ses fromages et ses plats cuisinés. On y mange six fois par jour, au minimum.',
    auberge: { nom: 'La Panse Comblée', repas: 2, chambre: 6, confort: 'excellent' },
    rations: 4,
  },
  {
    id: 'grottes',
    nom: 'Grottes de Fariliik',
    type: 'grotte',
    x: 2395,
    y: 1182,
    description:
      "Une zone rocheuse qui émerge des dunes. Les cavernes abritent parfois de grandes créatures, et parfois des peaux-vertes : orques, gobelins, et même trogylorks. L'armée les a « nettoyées » plusieurs fois. Ils reviennent toujours.",
  },
];

export interface Piste {
  de: string;
  vers: string;
  terrain: Terrain;
  points: Point[];
}

export const PISTES: Piste[] = [
  { de: 'waldorg', vers: 'grangu', terrain: 'sentier', points: [[2442, 1325], [2405, 1342], [2370, 1330], [2335, 1282]] },
  { de: 'waldorg', vers: 'sival', terrain: 'sentier', points: [[2442, 1325], [2480, 1300], [2502, 1285], [2515, 1240]] },
  { de: 'grangu', vers: 'sival', terrain: 'sentier', points: [[2335, 1282], [2400, 1277], [2450, 1268], [2485, 1255], [2515, 1240]] },
  { de: 'grangu', vers: 'hameau', terrain: 'sentier', points: [[2335, 1282], [2300, 1268], [2280, 1264]] },
  {
    de: 'hameau',
    vers: 'fierpate',
    terrain: 'sentier',
    points: [[2280, 1264], [2262, 1235], [2253, 1200], [2250, 1160], [2240, 1130], [2220, 1100], [2190, 1080], [2150, 1060], [2120, 1035], [2100, 1007]],
  },
  { de: 'sival', vers: 'bac', terrain: 'sentier', points: [[2515, 1240], [2530, 1215], [2545, 1190], [2554, 1167]] },
  { de: 'bac', vers: 'campement', terrain: 'sentier', points: [[2554, 1167], [2520, 1158], [2497, 1130], [2492, 1100], [2482, 1075]] },
  { de: 'campement', vers: 'biouro', terrain: 'sentier', points: [[2482, 1075], [2490, 1050], [2480, 1025], [2460, 1005], [2425, 992]] },
  // Hors piste : la carte ne trace aucun chemin jusqu'aux grottes.
  { de: 'waldorg', vers: 'grottes', terrain: 'dunes', points: [[2442, 1325], [2440, 1290], [2425, 1240], [2405, 1205], [2395, 1182]] },
  { de: 'sival', vers: 'grottes', terrain: 'dunes', points: [[2515, 1240], [2480, 1220], [2440, 1200], [2395, 1182]] },
  { de: 'grangu', vers: 'grottes', terrain: 'dunes', points: [[2335, 1282], [2345, 1260], [2370, 1220], [2395, 1182]] },
  { de: 'grottes', vers: 'campement', terrain: 'plaine', points: [[2395, 1182], [2430, 1130], [2482, 1075]] },
];

export const lieuMonde = (id: string): LieuMonde => {
  const l = LIEUX_MONDE.find((x) => x.id === id);
  if (!l) throw new Error(`Lieu inconnu : ${id}`);
  return l;
};

const longueurPx = (pts: Point[]) => pts.slice(1).reduce((s, [x, y], i) => s + Math.hypot(x - pts[i][0], y - pts[i][1]), 0);

export interface Troncon {
  terrain: Terrain;
  points: Point[];
  km: number;
  heures: number;
}

export interface Itineraire {
  etapes: string[];
  troncons: Troncon[];
  km: number;
  heures: number;
}

const troncon = (piste: Piste, sens: 1 | -1, allure: 'normale' | 'forcee'): Troncon => {
  const points = sens === 1 ? piste.points : [...piste.points].reverse();
  const km = longueurPx(points) / PX_PAR_KM;
  return { terrain: piste.terrain, points, km, heures: (km / KM_PAR_JOUR[piste.terrain][allure]) * HEURES_DE_ROUTE_PAR_JOUR };
};

/** Le chemin le plus rapide (Dijkstra sur les pistes), ou null si aucun ne relie les deux lieux. */
export const itineraire = (de: string, vers: string, allure: 'normale' | 'forcee' = 'normale'): Itineraire | null => {
  const duree = new Map<string, number>([[de, 0]]);
  const venu = new Map<string, { depuis: string; t: Troncon }>();
  const restants = new Set(LIEUX_MONDE.map((l) => l.id));
  while (restants.size) {
    let ici: string | undefined;
    for (const id of restants) if (duree.has(id) && (ici === undefined || duree.get(id)! < duree.get(ici)!)) ici = id;
    if (ici === undefined || ici === vers) break;
    restants.delete(ici);
    for (const p of PISTES) {
      const sens = p.de === ici ? 1 : p.vers === ici ? -1 : 0;
      if (!sens) continue;
      const autre = sens === 1 ? p.vers : p.de;
      const t = troncon(p, sens, allure);
      const d = duree.get(ici)! + t.heures;
      if (d < (duree.get(autre) ?? Infinity)) {
        duree.set(autre, d);
        venu.set(autre, { depuis: ici, t });
      }
    }
  }
  if (de === vers || !venu.has(vers)) return null;
  const etapes = [vers];
  const troncons: Troncon[] = [];
  while (etapes[0] !== de) {
    const v = venu.get(etapes[0])!;
    troncons.unshift(v.t);
    etapes.unshift(v.depuis);
  }
  return {
    etapes,
    troncons,
    km: troncons.reduce((s, t) => s + t.km, 0),
    heures: troncons.reduce((s, t) => s + t.heures, 0),
  };
};

/** Où en est le voyageur après `h` heures de marche. */
export const positionApres = (it: Itineraire, h: number): Point => {
  let reste = Math.max(0, h);
  for (const t of it.troncons) {
    if (reste <= t.heures) {
      let px = (reste / t.heures) * longueurPx(t.points);
      for (let i = 1; i < t.points.length; i++) {
        const [x0, y0] = t.points[i - 1];
        const [x1, y1] = t.points[i];
        const l = Math.hypot(x1 - x0, y1 - y0);
        if (px <= l) return [x0 + ((x1 - x0) * px) / l, y0 + ((y1 - y0) * px) / l];
        px -= l;
      }
      return t.points[t.points.length - 1];
    }
    reste -= t.heures;
  }
  const dernier = it.troncons[it.troncons.length - 1];
  return dernier.points[dernier.points.length - 1];
};

/** Le terrain sous les pieds du voyageur après `h` heures de marche. */
export const terrainApres = (it: Itineraire, h: number): Terrain => {
  let reste = h;
  for (const t of it.troncons) {
    if (reste <= t.heures) return t.terrain;
    reste -= t.heures;
  }
  return it.troncons[it.troncons.length - 1].terrain;
};

/** Rebâtit un itinéraire à partir de la liste de ses étapes (pour reprendre un voyage sauvegardé). */
export const itineraireEtapes = (etapes: string[], allure: 'normale' | 'forcee' = 'normale'): Itineraire => {
  const troncons = etapes.slice(1).map((vers, i) => {
    const de = etapes[i];
    const piste = PISTES.find((p) => (p.de === de && p.vers === vers) || (p.de === vers && p.vers === de));
    if (!piste) throw new Error(`Pas de piste entre ${de} et ${vers}`);
    return troncon(piste, piste.de === de ? 1 : -1, allure);
  });
  return { etapes, troncons, km: troncons.reduce((s, t) => s + t.km, 0), heures: troncons.reduce((s, t) => s + t.heures, 0) };
};
