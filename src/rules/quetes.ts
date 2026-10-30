import { bonusSituation, type Situation } from './talents';
import { recruter } from './compagnons';
import { changerReputation, quetesRefusees, villeDe } from './reputation';
import { calculerFiche } from './creation';
import { arrondirOr } from './monnaie';
import { epreuve, noter, valeursCombat, type Partie } from './partie';
import { TABLE_TERRES_SAUVAGES, type LigneRencontre, type Rencontre } from './rencontres';

// Quêtes : un donneur, des étapes qui se jouent à des endroits précis (un lieu de ville, un lieu de la carte,
// un donjon), et une récompense à la fin. Les endroits s'écrivent « ville:<ville>:<lieu> », « monde:<lieu> »
// ou « donjon:<donjon> ».

export type CaracQuete = 'COU' | 'INT' | 'CHA' | 'AD' | 'FO';

export interface EtapeQuete {
  ou: string;
  /** Ce qu'il faut faire, pour le journal des quêtes. */
  objectif: string;
  /** Le bouton proposé sur place. */
  action: string;
  /** Ce qui se passe quand l'étape réussit. */
  recit: string;
  /** Épreuve à réussir (le joueur lance le D20) ; en cas d'échec, on peut réessayer. */
  epreuve?: { carac: CaracQuete; modif?: number; echec: string; pvEchec?: number; orEchec?: number; situation?: Situation };
  /** Combat à gagner. */
  combat?: { ligne: LigneRencontre; nombre: number };
  /** L'étape se valide en terminant ce donjon (voir donjons.ts). */
  donjon?: string;
  /** Objet de quête remis (au début de l'étape) ou repris (à la fin). */
  donne?: string;
  reprend?: string;
  /** Mauvaise conduite ajoutée en réussissant l'étape. */
  malConduite?: number;
}

export interface Quete {
  id: string;
  titre: string;
  /** Lieu où l'on accepte la quête. */
  donneur: string;
  /** Qui la propose, en une ligne. */
  qui: string;
  /** La proposition, lue avant d'accepter. */
  proposition: string;
  etapes: EtapeQuete[];
  recompense: { or: number; xp: number; objets?: string[]; texte: string; /** Un compagnon rejoint le groupe (compagnons.ts). */ compagnon?: string };
  /** Coût d'entrée (le Donjon Facile se paie). */
  prix?: number;
  /** Niveau conseillé, affiché avant d'accepter. */
  niveau?: number;
}

const rencontre = (ligne: LigneRencontre, nombre: number, approche = 1): Rencontre => ({ ligne, nombre, d20: ligne.d20, approche });

export const QUETES: Quete[] = [
  // --- Valtordu ------------------------------------------------------------------------------------
  {
    id: 'rats-cave',
    titre: 'Des rats dans la cave',
    donneur: 'ville:valtordu:trois-boudins',
    qui: 'Gros Didier, le patron des Trois Boudins',
    proposition:
      "« T'as une arme ? Parfait. Y a des rats dans ma cave, des gros, des pesteux. Ils mangent mes boudins et ils ont fait fuir la serveuse. Tu descends, tu les écrases, je te paie. Et je te nourris. »",
    etapes: [
      {
        ou: 'ville:valtordu:trois-boudins',
        objectif: 'Descendre dans la cave des Trois Boudins et tuer les rats.',
        action: 'Descendre à la cave, une torche à la main',
        recit: 'La cave sent le boudin et la mort de rat. Il ne reste plus que des cadavres et un tonneau grignoté.',
        combat: { ligne: TABLE_TERRES_SAUVAGES[2], nombre: 2 },
      },
      {
        ou: 'ville:valtordu:trois-boudins',
        objectif: 'Annoncer à Gros Didier que la cave est propre.',
        action: 'Annoncer à Gros Didier que la cave est libre',
        recit: "Gros Didier descend vérifier, remonte, et te tape dans le dos à te décrocher un poumon. « Bon boulot ! Tiens, ta paie, et un boudin pour la route. »",
      },
    ],
    recompense: { or: 15, xp: 30, objets: ['boudin-valtordu', 'boudin-valtordu'], texte: '15 PO, 2 boudins de Valtordu' },
  },
  {
    id: 'colis-loubet',
    titre: 'Le colis du guérisseur',
    donneur: 'ville:valtordu:guerisseur',
    qui: 'Archibald Ozonuc, le guérisseur',
    proposition:
      "« Ma collègue de Loubet attend ces herbes depuis trois semaines. Le coursier s'est cassé une jambe, ce qui est ironique pour un client de guérisseur. Tu suis la Glandebruine vers le sud, c'est à une demi-journée. Ne mange pas les herbes. »",
    etapes: [
      {
        ou: 'ville:loubet:herboriste',
        objectif: "Porter le colis d'herbes à la vieille herboriste de Loubet, au sud en suivant la rivière.",
        action: "Remettre le colis d'herbes à la rebouteuse",
        recit:
          "La rebouteuse de Loubet ouvre le colis, renifle, et sourit de toutes ses dents (il en reste quatre). « Enfin ! Dis à Archibald que je lui dois une fiole. » Elle te confie une lettre cachetée pour lui.",
        donne: 'lettre-loubet',
        reprend: 'colis-ozonuc',
      },
      {
        ou: 'ville:valtordu:guerisseur',
        objectif: 'Rapporter la lettre de la rebouteuse à Archibald Ozonuc, à Valtordu.',
        action: 'Remettre la lettre à Archibald',
        recit: "Archibald lit la lettre, rougit, la range très vite. « Hum. Merci. Voilà ta paie, et une potion : on ne sait jamais, sur les routes. »",
        reprend: 'lettre-loubet',
      },
    ],
    recompense: { or: 25, xp: 40, objets: ['potion-soin'], texte: '25 PO et une potion de soin' },
  },
  {
    id: 'secret-boudin',
    titre: 'Le secret du boudin Plandu',
    donneur: 'ville:valtordu:boucherie-jobard',
    qui: 'Maître Jobard, boucher sur la place des Pendus',
    proposition:
      "« Le concours du meilleur boudin, c'est dans un mois. Et ce traître de Plandu gagne tous les ans avec sa recette secrète. Tu vas dans son arrière-boutique, rue du Vieux Bélier, tu recopies la recette, tu reviens. Personne ne saura rien. Enfin, toi tu sauras. »",
    etapes: [
      {
        ou: 'ville:valtordu:boucherie-plandu',
        objectif: "Recopier la recette secrète dans l'arrière-boutique de la boucherie Plandu, rue du Vieux Bélier, sans se faire prendre.",
        action: "Se glisser dans l'arrière-boutique (épreuve d'Adresse)",
        recit: "Entre deux jambons, un carnet graisseux : « Boudin spécial : sang de mouton, oignons, et une pincée de poudre de… » Tu recopies tout. Personne ne t'a vu.",
        epreuve: { carac: 'AD', situation: 'vol', echec: 'Plandu te surprend la main dans le carnet et te chasse à coups de saucisson sec !', pvEchec: 2 },
        malConduite: 1,
      },
      {
        ou: 'ville:valtordu:boucherie-jobard',
        objectif: 'Rapporter la recette à Maître Jobard, place des Pendus.',
        action: 'Donner la recette à Maître Jobard',
        recit:
          "« Une pincée de QUOI ? Le saligaud ! » Jobard te paie en riant et te glisse deux boudins. « Pas un mot. Et puisque tu sais te débrouiller… emmène mon Gaston. Il rêve d'aventure, et moi de silence dans ma boutique. Il apprendra la vie avec toi. »",
      },
    ],
    recompense: { or: 20, xp: 30, objets: ['boudin-valtordu', 'boudin-valtordu'], compagnon: 'gaston', texte: '20 PO, 2 boudins de Valtordu, et Gaston Jobard rejoint ton groupe' },
  },
  {
    id: 'brigands-tronville',
    titre: 'Les brigands de la route de Tronville',
    donneur: 'ville:valtordu:chateau',
    qui: 'Hubert Jeanfort, seigneur de Valtordu',
    proposition:
      "« Des brigands détroussent les marchands de pulls sur la route de Tronville, au nord-est. Mes gardes sont occupés à garder. Ramène-moi la preuve que ces vauriens ne nuiront plus, et le château saura se montrer reconnaissant. »",
    etapes: [
      {
        ou: 'monde:tronville',
        objectif: 'Trouver les brigands qui rôdent près de Tronville, au nord-est de Valtordu, et les mettre hors d\'état de nuire.',
        action: 'Chercher le repaire des brigands près de Tronville',
        recit: "Les deux brigands gisent au milieu de ballots de pulls volés. Tu ramasses le foulard de leur chef, comme preuve.",
        combat: { ligne: TABLE_TERRES_SAUVAGES[4], nombre: 2 },
        donne: 'foulard-brigand',
      },
      {
        ou: 'ville:valtordu:chateau',
        objectif: 'Rapporter le foulard du chef des brigands au seigneur Hubert Jeanfort.',
        action: 'Présenter le foulard au seigneur',
        recit: "Hubert Jeanfort examine le foulard avec dégoût. « C'est bien eux. Valtordu te remercie. » Un intendant te compte ta récompense, en vérifiant deux fois chaque pièce.",
        reprend: 'foulard-brigand',
      },
    ],
    recompense: { or: 40, xp: 60, texte: '40 PO' },
    niveau: 2,
  },
  {
    id: 'donjon-facile',
    titre: 'Le Donjon Facile',
    donneur: 'ville:valtordu:donjon-facile',
    qui: 'Léonard Boudu, patron du Donjon Facile',
    proposition:
      "« Le Donjon Facile ! Le premier donjon d'entraînement de la Terre de Fangh ! Des vrais monstres (un peu fatigués), des vrais pièges (un peu rouillés), un vrai trésor (un peu en chocolat). 10 PO l'entrée, certificat d'aventurier à la sortie. Burgal surveille, en cas de pépin. »",
    prix: 10,
    etapes: [
      {
        ou: 'ville:valtordu:donjon-facile',
        objectif: 'Traverser le Donjon Facile jusqu\'à la salle du trésor.',
        action: 'Entrer dans le Donjon Facile',
        recit: 'Tu ressors du Donjon Facile, poussiéreux mais vivant. Burgal applaudit mollement.',
        donjon: 'donjon-facile',
      },
      {
        ou: 'ville:valtordu:donjon-facile',
        objectif: 'Réclamer ton certificat à Léonard Boudu.',
        action: 'Réclamer le certificat',
        recit: "Léonard Boudu signe le certificat avec une plume qui gratte. « Félicitations ! Tu es maintenant un aventurier certifié Donjon Facile. Ça n'impressionne personne, mais c'est joli au mur. »",
      },
    ],
    recompense: { or: 0, xp: 50, objets: ['certificat-donjon-facile'], texte: 'le certificat du Donjon Facile' },
  },
  // --- Waldorg ---------------------------------------------------------------------------------------
  {
    id: 'gobelins',
    titre: 'Les poules du fermier Barnabé',
    donneur: 'ville:waldorg:emplois',
    qui: 'Le Bureau des emplois de Waldorg',
    proposition:
      "Le fermier Barnabé se plaint de gobelins qui pillent son poulailler depuis les grottes de Fariliik, dans les dunes au nord de Waldorg. Mission : chasser les gobelins, ou au moins les convaincre d'aller voler ailleurs. Récompense : 60 pièces d'or, et une douzaine d'œufs.",
    etapes: [
      {
        ou: 'monde:grottes',
        objectif: 'Entrer dans les grottes de Fariliik (au nord de Waldorg, dans les dunes) et chasser le chef des gobelins.',
        action: 'Entrer dans les grottes',
        recit: 'Le Grand Zgrot est vaincu, les gobelins détalent dans les dunes. Tu récupères un panier de poules ébouriffées.',
        donjon: 'fariliik',
      },
      {
        ou: 'ville:waldorg:emplois',
        objectif: 'Annoncer au Bureau des emplois de Waldorg que les grottes sont nettoyées.',
        action: 'Réclamer la prime au Bureau des emplois',
        recit: "L'employé tamponne trois formulaires, en perd un, le retrouve, et te paie. Le fermier Barnabé a fait déposer une douzaine d'œufs (dont deux cassés).",
      },
    ],
    recompense: { or: 60, xp: 80, objets: ['rations'], texte: "60 PO et des œufs (une ration)" },
    niveau: 2,
  },
];

export const quete = (id: string) => {
  const q = QUETES.find((x) => x.id === id);
  if (!q) throw new Error(`Quête inconnue : ${id}`);
  return q;
};

export const etapeEnCours = (p: Partie, id: string): number => p.etapesQuetes?.[id] ?? 0;

/** Quêtes qu'on peut accepter ici. */
export const quetesProposees = (p: Partie, ou: string) => {
  const ville = villeDe(ou);
  if (ville && quetesRefusees(p, ville)) return [];
  return QUETES.filter((q) => q.donneur === ou && !p.quetes[q.id]);
};

/** Étapes de quêtes en cours qui se jouent ici. */
export const etapesIci = (p: Partie, ou: string) =>
  QUETES.filter((q) => p.quetes[q.id] === 'acceptee' && q.etapes[etapeEnCours(p, q.id)]?.ou === ou).map((q) => ({
    quete: q,
    etape: q.etapes[etapeEnCours(p, q.id)],
  }));

export const accepterQuete = (p: Partie, id: string): string | null => {
  const q = quete(id);
  if (p.quetes[id]) return 'Quête déjà acceptée.';
  if (q.prix && p.or < q.prix) return `Il faut ${q.prix} PO.`;
  if (q.prix) p.or = arrondirOr(p.or - q.prix);
  p.quetes[id] = 'acceptee';
  p.etapesQuetes = { ...(p.etapesQuetes ?? {}), [id]: 0 };
  if (id === 'colis-loubet') p.sac.push('colis-ozonuc');
  noter(p, `accepte la quête « ${q.titre} ».`);
  return null;
};

export const valeurEpreuveQuete = (p: Partie, e: NonNullable<EtapeQuete['epreuve']>) => {
  const v = valeursCombat(p);
  const f = calculerFiche(p.perso);
  return { COU: v.cou, INT: f.caracs.INT, CHA: v.cha, AD: v.ad, FO: f.caracs.FO }[e.carac] + (e.modif ?? 0) + (e.situation ? bonusSituation(p, e.situation).total : 0);
};

export interface IssueEtape {
  reussi: boolean;
  texte: string;
  /** La quête est terminée et la récompense versée. */
  finie?: boolean;
}

/** Valide l'étape en cours (après le combat ou le donjon gagnés, ou directement s'il n'y a rien à réussir). */
export const validerEtape = (p: Partie, id: string): IssueEtape => {
  const q = quete(id);
  const i = etapeEnCours(p, id);
  const e = q.etapes[i];
  if (e.reprend) {
    const k = p.sac.indexOf(e.reprend);
    if (k >= 0) p.sac.splice(k, 1);
  }
  if (e.donne) p.sac.push(e.donne);
  if (e.malConduite) {
    p.mauvaiseConduite = (p.mauvaiseConduite ?? 0) + e.malConduite;
    p.marques = [...new Set([...(p.marques ?? []), `quete:${id}`])];
  }
  const suivante = i + 1;
  p.etapesQuetes = { ...(p.etapesQuetes ?? {}), [id]: suivante };
  if (suivante < q.etapes.length) {
    noter(p, `${q.titre} : ${e.objectif.charAt(0).toLowerCase()}${e.objectif.slice(1, 70)}… fait.`);
    return { reussi: true, texte: e.recit };
  }
  p.quetes[id] = 'terminee';
  p.or = arrondirOr(p.or + q.recompense.or);
  p.xp = (p.xp ?? 0) + q.recompense.xp;
  p.sac.push(...(q.recompense.objets ?? []));
  if (q.recompense.compagnon) recruter(p, q.recompense.compagnon);
  noter(p, `termine la quête « ${q.titre} » (${q.recompense.texte}, +${q.recompense.xp} XP).`);
  const ville = villeDe(q.donneur);
  const renom = ville && changerReputation(p, ville, 2, `quête « ${q.titre} »`) ? ' On parle de toi en ville : ta réputation monte.' : '';
  return { reussi: true, finie: true, texte: `${e.recit} Quête terminée : ${q.recompense.texte} et ${q.recompense.xp} points d'expérience.${renom}` };
};

/** Tente l'épreuve de l'étape avec le dé lancé par le joueur. Un échec coûte, mais on peut réessayer. */
export const tenterEtape = (p: Partie, id: string, de: number): IssueEtape => {
  const e = quete(id).etapes[etapeEnCours(p, id)];
  if (!e.epreuve) return validerEtape(p, id);
  const valeur = valeurEpreuveQuete(p, e.epreuve);
  if (epreuve(valeur, undefined, de).reussi) {
    const r = validerEtape(p, id);
    return { ...r, texte: `Dé : ${de} contre ${valeur}. ${r.texte}` };
  }
  // Un échec de quête fait mal, mais ne tue pas : on se relève et on réessaiera.
  if (e.epreuve.pvEchec) p.ev = Math.max(1, p.ev - e.epreuve.pvEchec);
  if (e.epreuve.orEchec) p.or = Math.max(0, arrondirOr(p.or - e.epreuve.orEchec));
  // Pris la main dans le sac : la ville s'en souviendra.
  const ville = villeDe(e.ou);
  const honte = e.epreuve.situation === 'vol' && ville && changerReputation(p, ville, -1, 'pris à voler') ? ' La nouvelle fait le tour du quartier : ta réputation baisse.' : '';
  const pertes = [e.epreuve.pvEchec ? `−${e.epreuve.pvEchec} PV` : '', e.epreuve.orEchec ? `−${e.epreuve.orEchec} PO` : ''].filter(Boolean).join(', ');
  return { reussi: false, texte: `Dé : ${de} contre ${valeur}. ${e.epreuve.echec}${pertes ? ` (${pertes})` : ''}${honte} Tu pourras réessayer plus tard.` };
};

/** Le combat d'une étape, prêt pour l'écran de combat. */
export const combatEtape = (e: EtapeQuete): Rencontre | null => (e.combat ? rencontre(e.combat.ligne, e.combat.nombre, e.ou.startsWith('monde:') ? 2 : 1) : null);

/** Finit l'étape « donjon » si le donjon terminé est celui qu'elle attend. */
export const donjonTermine = (p: Partie, donjon: string): IssueEtape | null => {
  const q = QUETES.find((x) => p.quetes[x.id] === 'acceptee' && x.etapes[etapeEnCours(p, x.id)]?.donjon === donjon);
  return q ? validerEtape(p, q.id) : null;
};

