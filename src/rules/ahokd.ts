import type { Contenu, Donjon, Salle, Tresor } from './donjons';
import type { LigneRencontre } from './rencontres';

// La grotte d'Ahokd : un donjon tiré au sort (premier essai de donjon procédural).
// Chaque expédition a sa graine : la même graine redonne la même grotte (pour les sauvegardes) ;
// une fois l'antre du ronfleur nettoyé, la grotte suivante est différente (éboulements, nouvelles galeries).
//
// Construction : un couloir principal de 6 à 8 salles, qui avance vers l'est sur une grille en serpentant,
// plus 2 à 4 culs-de-sac sur le côté. Chaque salle reçoit un type (combat, piège, source, vide) et un décor
// tirés dans des tables ; les culs-de-sac cachent plus souvent un trésor. Au bout : l'antre de l'ogre qui ronfle.
// Les monstres viennent du bestiaire officiel (rats, gobelins, araignées, squelettes ; un ogre au fond).

export const AHOKD = 'ahokd';
export const OU_AHOKD = 'monde:ahokd';

/** Générateur pseudo-aléatoire à graine (mulberry32). */
const alea = (graine: number) => {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

type Bete = (nom: string, surnom?: string) => LigneRencontre;

const NOMS = [
  'Galerie suintante',
  'Boyau étroit',
  'Salle aux stalactites',
  'Caverne des échos',
  'Grotte aux champignons',
  'Passage des courants d’air',
  'Salle effondrée',
  'Puits naturel',
  'Galerie des ossements',
  'Chambre aux cristaux ternes',
  'Couloir des chauves-souris',
  'Grotte du lac noir',
  'Salle aux graffitis gobelins',
  'Cheminée de pierre',
];

const DECORS = [
  "L'eau goutte du plafond dans des flaques qui sentent le soufre.",
  'Le passage se resserre : il faut avancer de profil, en rentrant le ventre.',
  'Des stalactites pendent comme des dents. Certaines ont l’air pressées de tomber.',
  "Chaque pas résonne trois fois. Quelque part au fond, quelque chose ronfle, et ça s'entend même ici.",
  'Des champignons phosphorescents éclairent la salle en vert. Personne ne veut savoir s’ils se mangent.',
  'Un courant d’air froid fait vaciller la torche. Il vient de quelque part, c’est déjà ça.',
  'Une partie du plafond s’est effondrée il y a longtemps. Ou la semaine dernière.',
  'Un trou dans le sol descend dans le noir. On y jette un caillou ; on ne l’entend pas tomber.',
  'Des os rongés, des crânes de chèvre, et un crâne qui n’est pas de chèvre.',
  'Des cristaux ternes tapissent les parois. Un nain dirait qu’ils ne valent rien, et il aurait raison.',
  'Des centaines de chauves-souris dorment au plafond. Il est conseillé de ne pas éternuer.',
  'Un petit lac d’eau noire et immobile. Quelque chose y fait des bulles, de temps en temps.',
  "Sur la paroi, des dessins gobelins : un ogre, une flèche, et un gobelin qui court. Le message est clair.",
  'Une cheminée naturelle monte vers le haut ; on aperçoit un minuscule bout de ciel.',
];

/** Les bandes qu'on croise dans les galeries, de la plus faible à la plus forte. */
const BANDES: { ennemis: [string, string, number][]; texte: string }[] = [
  { ennemis: [['Rat pesteux', 'Rat pesteux', 3]], texte: 'Trois rats pesteux se disputent un vieux bout de cuir. Ils décident que tu as meilleur goût.' },
  { ennemis: [['Rat géant', 'Rat géant', 2]], texte: 'Deux rats géants, gros comme des chiens, sortent d’une fissure en couinant.' },
  { ennemis: [['Gobelin', 'Gobelin fouineur', 2]], texte: "Deux gobelins fouillaient les os de la salle. « C'est à nous ! » crient-ils, sans préciser quoi." },
  { ennemis: [['Araignée tranchante de base', 'Araignée tranchante', 1]], texte: 'Une araignée grosse comme un bouclier descend du plafond sur son fil. Ses pattes font un bruit de ciseaux.' },
  { ennemis: [['Squelette de base', 'Squelette d’aventurier', 1]], texte: "Le squelette d'un aventurier moins chanceux se relève, sa vieille épée à la main. Il a l'air vexé d'être mort ici." },
  { ennemis: [['Gobelin costaud', 'Gobelin costaud', 1], ['Gobelin', 'Gobelin', 1]], texte: 'Un gobelin costaud et son petit frère montent la garde, très mal, autour d’un feu de crottes séchées.' },
];

const PIEGES: Extract<Contenu, { type: 'piege' }>[] = [
  {
    type: 'piege',
    carac: 'AD',
    degats: '1D+1',
    texte: 'Le sol est couvert de cailloux qui roulent. Une épreuve d’Adresse pour ne pas tomber dans la pente.',
    evite: 'Tu descends en équilibre, les bras écartés, avec une certaine classe.',
    subit: 'Tu dévales la pente sur les fesses, et les cailloux avec toi.',
  },
  {
    type: 'piege',
    carac: 'AD',
    modif: -1,
    degats: '1D+2',
    texte: 'Une stalactite craque juste au-dessus de toi. Épreuve d’Adresse (−1) pour l’éviter.',
    evite: 'La stalactite se plante dans le sol, à un pied de ta botte.',
    subit: 'La stalactite te tombe dessus. Heureusement, ce n’était qu’une petite.',
  },
  {
    type: 'piege',
    carac: 'FO',
    degats: '1D',
    texte: 'Un passage bouché par un éboulis : il faut dégager les rochers. Épreuve de Force.',
    evite: 'Tu dégages les rochers sans te faire mal au dos. Un exploit.',
    subit: 'Un rocher te retombe sur le pied. Tu passes quand même, en sautillant.',
  },
  {
    type: 'piege',
    carac: 'COU',
    degats: '1D-1',
    texte: 'Un nuage de chauves-souris te fonce dessus en hurlant. Épreuve de Courage pour ne pas paniquer.',
    evite: 'Tu restes immobile, les chauves-souris passent. L’une d’elles te laisse un souvenir sur l’épaule.',
    subit: 'Tu cours en agitant les bras et tu te cognes dans la paroi.',
  },
  {
    type: 'piege',
    carac: 'INT',
    degats: '1D',
    texte: 'Des bulles de gaz remontent d’une flaque. Épreuve d’Intelligence pour comprendre qu’il ne faut pas approcher la torche.',
    evite: 'Tu éloignes la torche juste à temps. La flaque fait « pouf », sans plus.',
    subit: 'Tu te penches avec la torche pour mieux voir. La flaque fait « BOUM ».',
  },
];

const TRESORS: Tresor[] = [
  { or: 12, texte: 'Une bourse moisie, coincée sous un rocher.' },
  { objets: ['potion-soin'], texte: 'Une fiole intacte dans le sac d’un aventurier qui, lui, ne l’est plus.' },
  { or: 20, objets: ['torche'], texte: 'Un petit trésor gobelin : des pièces, des boutons, et des torches.' },
  { objets: ['rations', 'corde'], texte: 'Un vieux paquetage oublié : des rations encore bonnes et une corde.' },
  { or: 8, objets: ['potion-de-mana-des-bitos'], texte: 'Une poche de mage déchirée : quelques pièces et une potion bleue.' },
  { or: 25, texte: 'Des pièces anciennes dans une fissure, à l’effigie d’un roi dont personne ne se souvient.', cachee: { carac: 'INT' } },
];

/** Les cases de la grotte : un chemin principal vers l'est, puis des culs-de-sac. */
const plan = (r: () => number) => {
  const pris = new Set<string>();
  const cle = (x: number, y: number) => `${x},${y}`;
  const principal: [number, number][] = [[0, 2]];
  pris.add(cle(0, 2));
  const longueur = 6 + Math.floor(r() * 3);
  while (principal.length < longueur) {
    const [x, y] = principal[principal.length - 1];
    // Vers l'est la plupart du temps, parfois vers le haut ou le bas.
    const essais: [number, number][] = r() < 0.6 ? [[x + 1, y], [x, y + (r() < 0.5 ? 1 : -1)]] : [[x, y + (r() < 0.5 ? 1 : -1)], [x + 1, y]];
    const suivant = essais.find(([a, b]) => b >= 0 && b <= 4 && !pris.has(cle(a, b))) ?? [x + 1, y];
    pris.add(cle(...suivant));
    principal.push(suivant);
  }
  const culs: { case: [number, number]; depuis: number }[] = [];
  const nombre = 2 + Math.floor(r() * 3);
  for (let i = 0; i < 40 && culs.length < nombre; i++) {
    const depuis = 1 + Math.floor(r() * (principal.length - 2));
    const [x, y] = principal[depuis];
    const voisins: [number, number][] = [[x, y - 1], [x, y + 1], [x + 1, y], [x - 1, y]];
    const libre = voisins.filter(([a, b]) => a >= 0 && b >= 0 && b <= 4 && !pris.has(cle(a, b)));
    if (!libre.length) continue;
    const c = libre[Math.floor(r() * libre.length)];
    pris.add(cle(...c));
    culs.push({ case: c, depuis });
  }
  return { principal, culs };
};

/** Une grotte d'Ahokd, toujours la même pour une même graine. */
export const genererAhokd = (graine: number, bete: Bete): Donjon => {
  const r = alea(graine);
  const tirer = <T>(t: T[]) => t[Math.floor(r() * t.length)];
  const { principal, culs } = plan(r);
  const decors = [...NOMS.keys()].sort(() => r() - 0.5);
  let d = 0;
  const salles: Salle[] = [];
  const id = (i: number) => (i === 0 ? 'entree' : i === principal.length - 1 ? 'antre' : `s${i}`);
  principal.forEach(([x, y], i) => {
    const s: Salle = { id: id(i), nom: '', x, y, vers: [], description: '' };
    if (i === 0) {
      s.nom = 'Entrée de la grotte';
      s.description = "Une bouche noire dans l'éperon rocheux. Une odeur de fauve et de vieille soupe. Au fond, très loin, un ronflement fait trembler les cailloux.";
    } else if (i === principal.length - 1) {
      s.nom = "L'antre du ronfleur";
      s.description = "Une vaste caverne jonchée d'os, de tonneaux défoncés et de chaussures dépareillées. Au milieu, un ogre énorme dort sur un tas de fourrures. Il ronfle. Puis il ne ronfle plus.";
      s.contenu = {
        type: 'combat',
        ennemis: [{ ligne: bete('Ogre débile', "Ogre d'Ahokd"), nombre: 1 }],
        texte: "L'ogre ouvre un œil, puis l'autre, puis la bouche. « MIAM ? » Il attrape son gourdin, qui est un tronc d'arbre.",
      };
      s.tresor = { or: 40 + Math.floor(r() * 41), objets: ['potion-soin'], texte: "Sous les fourrures, le magot de l'ogre : des pièces de toutes les époques, et une potion qu'il prenait pour du sirop." };
    } else {
      const k = decors[d++ % decors.length];
      s.nom = NOMS[k];
      s.description = DECORS[k];
      const t = r();
      // Plus on avance, plus les bandes sont fortes.
      const force = Math.min(BANDES.length - 1, Math.floor((i / principal.length) * BANDES.length + r() * 2));
      if (t < 0.5) {
        const b = BANDES[force];
        s.contenu = { type: 'combat', ennemis: b.ennemis.map(([nom, surnom, nombre]) => ({ ligne: bete(nom, surnom), nombre })), texte: b.texte, pensants: b.ennemis.some(([n]) => /gobelin/i.test(n)) || undefined };
        if (r() < 0.4) s.tresor = tirer(TRESORS);
      } else if (t < 0.75) s.contenu = tirer(PIEGES);
      else if (t < 0.85) s.contenu = { type: 'repos', pv: 2, texte: "Une source fraîche coule entre deux rochers. Tu bois, tu remplis ta gourde, tu soignes tes bosses." };
    }
    salles.push(s);
  });
  for (let i = 0; i + 1 < principal.length; i++) {
    salles[i].vers.push(salles[i + 1].id);
    salles[i + 1].vers.push(salles[i].id);
  }
  culs.forEach((c, j) => {
    const k = decors[d++ % decors.length];
    const s: Salle = { id: `c${j + 1}`, nom: NOMS[k], x: c.case[0], y: c.case[1], vers: [salles[c.depuis].id], description: DECORS[k] };
    salles[c.depuis].vers.push(s.id);
    // Un cul-de-sac : souvent un trésor, parfois gardé, parfois une source.
    const t = r();
    if (t < 0.45) {
      const b = BANDES[Math.floor(r() * 4)];
      s.contenu = { type: 'combat', ennemis: b.ennemis.map(([nom, surnom, nombre]) => ({ ligne: bete(nom, surnom), nombre })), texte: b.texte };
    } else if (t < 0.6) s.contenu = { type: 'repos', pv: 3, texte: 'Une petite source, à l’abri des courants d’air : un bon coin pour souffler.' };
    s.tresor = r() < 0.75 ? tirer(TRESORS) : undefined;
    salles.push(s);
  });
  return {
    id: graine ? `${AHOKD}:${graine}` : AHOKD,
    nom: "La grotte d'Ahokd",
    ou: OU_AHOKD,
    intro:
      "La grotte s'ouvre dans l'éperon rocheux, entre Tronville et Boladar. Les gens du coin disent que les galeries changent à chaque éboulement, et qu'au fond dort quelque chose qui ronfle. Ils disent aussi de ne pas y aller, mais ils disent ça de tout.",
    entree: 'entree',
    finale: 'antre',
    conclusion: "L'ogre d'Ahokd ne ronflera plus. Les galeries grondent : un éboulement se prépare, la grotte ne sera plus la même la prochaine fois.",
    salles,
  };
};
