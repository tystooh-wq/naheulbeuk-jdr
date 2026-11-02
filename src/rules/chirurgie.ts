// Les blessures graves chez le guérisseur (choix maison, à valider) :
// - fractures, luxations, doigt perdu : n'importe quel guérisseur les remet en place, la guérison va deux fois plus vite ;
// - œil crevé, membre tranché, organes abîmés : seul un mage soigneur sait recoller ou faire repousser,
//   à la Clinique du Secours de Glargh ou de Waldorg. Les autres guérisseurs y envoient.
import { BLESSURES, type BlessureGrave } from './critiques';
import { blessuresActives, noter, type Partie } from './partie';

/** Les cliniques qui recollent les membres (« ville:lieu ») et leur tarif, en part du prix de Glargh. */
export const SPECIALISTES: { ou: string; ville: string; lieu: string; facteur: number }[] = [
  { ou: 'glargh:clinique', ville: 'Glargh', lieu: 'Clinique du Secours (D10)', facteur: 1 },
  { ou: 'waldorg:clinique', ville: 'Waldorg', lieu: 'Clinique du Secours (Sud-Est)', facteur: 1.5 },
];

/** Prix à Glargh pour faire repousser ou recoller ce qui a été perdu. */
const PRIX_REPARATION: Record<string, number> = {
  'oeil-creve': 300,
  'yeux-creves': 800,
  'pied-tranche': 400,
  'jambe-tranchee': 600,
  'bras-droit-tranche': 600,
  'main-droite-tranchee': 400,
  'bras-gauche-tranche': 600,
  'main-gauche-tranchee': 400,
  'organes-genitaux': 250,
};

const cleDe = (b: BlessureGrave) => Object.entries(BLESSURES).find(([, x]) => x.nom === b.nom)?.[0];

/** Perdu pour de bon tant qu'un mage soigneur n'y a pas mis les mains. */
export const irreparableIci = (b: BlessureGrave) => {
  const k = cleDe(b);
  return !!k && k in PRIX_REPARATION;
};

export interface SoinGrave {
  /** Rang dans p.blessures. */
  index: number;
  nom: string;
  type: 'reparer' | 'remettre';
  prix: number;
}

/** Ce que ce guérisseur peut faire pour les blessures graves du héros, et ce qu'il faut aller faire soigner ailleurs. */
export const soinsGraves = (p: Partie, ou: string, prixSoin: number) => soinsDe(blessuresActives(p), p.jour, ou, prixSoin);

/** Pareil pour une liste de blessures (celles d'un compagnon). */
export const soinsDe = (blessures: (BlessureGrave & { jusqua?: number; soignee?: boolean })[], jour: number, ou: string, prixSoin: number) => {
  const specialiste = SPECIALISTES.find((s) => s.ou === ou);
  const possibles: SoinGrave[] = [];
  const ailleurs: string[] = [];
  blessures.forEach((b, index) => {
    const k = cleDe(b);
    if (k && k in PRIX_REPARATION) {
      if (specialiste) possibles.push({ index, nom: b.nom, type: 'reparer', prix: Math.round(PRIX_REPARATION[k] * specialiste.facteur) });
      else ailleurs.push(b.nom);
    } else if (b.jusqua !== undefined && !b.soignee && b.jusqua - jour >= 2) possibles.push({ index, nom: b.nom, type: 'remettre', prix: 10 * prixSoin });
  });
  return { possibles, ailleurs, specialiste };
};

/** Où aller pour ce qui ne se soigne pas ici. */
export const adressesSpecialistes = () => SPECIALISTES.map((s) => `${s.lieu}, à ${s.ville}`);

/** Applique un soin à une liste de blessures (sans rien payer) ; renvoie la liste à jour. */
export const appliquerSoin = <T extends BlessureGrave & { jusqua?: number; soignee?: boolean }>(blessures: T[], s: SoinGrave, jour: number): T[] => {
  const b = blessures[s.index];
  if (!b || b.nom !== s.nom) return blessures;
  if (s.type === 'reparer') return blessures.filter((_, i) => i !== s.index);
  b.jusqua = jour + Math.ceil((b.jusqua! - jour) / 2);
  b.soignee = true;
  return blessures;
};

/** Le guérisseur s'occupe de la blessure. Renvoie le texte du soin, ou le refus. */
export const soignerGrave = (p: Partie, s: SoinGrave): string => {
  if (p.or < s.prix) return `Il te manque ${s.prix - p.or} PO. « Ici, on paie avant. »`;
  const b = p.blessures?.[s.index];
  if (!b || b.nom !== s.nom) return 'Cette blessure ne te fait déjà plus souffrir.';
  p.or -= s.prix;
  if (s.type === 'reparer') {
    p.blessures = p.blessures!.filter((_, i) => i !== s.index);
    noter(p, `fait réparer : ${b.nom.toLowerCase()} (${s.prix} PO).`);
    return `Le mage marmonne, ça picote, ça brûle, puis plus rien : ${b.nom.toLowerCase()}, c'est de l'histoire ancienne. Les malus disparaissent.`;
  }
  const reste = b.jusqua! - p.jour;
  b.jusqua = p.jour + Math.ceil(reste / 2);
  b.soignee = true;
  noter(p, `fait soigner : ${b.nom.toLowerCase()} (${s.prix} PO).`);
  return `Le guérisseur remet tout en place avec un craquement sinistre, puis bande serré. Ça guérira deux fois plus vite : encore ${Math.ceil(reste / 2)} jour${Math.ceil(reste / 2) > 1 ? 's' : ''}.`;
};
