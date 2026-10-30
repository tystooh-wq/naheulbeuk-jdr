import type { Cite } from './cites';
import { lancerExpression, noter, valeursCombat, type Partie } from './partie';
import type { Rng } from './des';

// Droits d'entrée des cités (Chnafon, Jambfer) : la porte réclame son dû, par personne, à chaque arrivée.
// À Chnafon, le garde invente le tarif (1D6+2 PO) et on peut le discuter (épreuve de Charisme) :
// réussi, il baisse de moitié ; 1, il laisse passer pour rien ; raté, il ne bouge pas ; 20, il ajoute 2 PO pour l'insolence.

export interface Peage {
  /** Prix par personne et dés du garde (vide si le prix est fixe). */
  prix: number;
  des: number[];
  /** Le joueur a discuté le prix : son D20 et le résultat. */
  discussion?: { de: number; texte: string };
}

export const personnes = (p: Partie) => 1 + (p.compagnons?.length ?? 0);

export const peageDu = (p: Partie, c: Cite) => !!c.peage && p.peage !== c.id;

export const fixerPeage = (c: Cite, rng?: Rng): Peage => {
  const t = c.peage!.prix;
  if (typeof t === 'number') return { prix: t, des: [] };
  const j = lancerExpression(t, rng);
  return { prix: j.total, des: j.des };
};

export const totalPeage = (p: Partie, g: Peage) => g.prix * personnes(p);

/** Discuter le prix avec le garde : épreuve de Charisme sur le D20 du joueur. */
export const discuterPeage = (p: Partie, g: Peage, de: number): Peage => {
  const cha = valeursCombat(p).cha;
  let prix = g.prix;
  let texte: string;
  if (de === 1) {
    prix = 0;
    texte = "Réussite critique : le garde éclate de rire, te tape dans le dos et te laisse passer pour rien. « Un comme toi, on n'en voit pas souvent. »";
  } else if (de === 20) {
    prix += 2;
    texte = "Maladresse : ta remarque sur sa mère passe mal. Le prix augmente de 2 PO par personne, « pour l'insolence ».";
  } else if (de <= cha) {
    prix = Math.ceil(prix / 2);
    texte = `Réussi (${de} pour ${cha} de Charisme) : le garde soupire et coupe la poire en deux.`;
  } else texte = `Raté (${de} pour ${cha} de Charisme) : le garde croise les bras. Le prix ne bouge pas.`;
  return { ...g, prix, discussion: { de, texte } };
};

/** Paie et passe. Renvoie le refus s'il manque de l'or. */
export const payerPeage = (p: Partie, c: Cite, g: Peage): string | null => {
  const total = totalPeage(p, g);
  if (p.or < total) return `Il te manque ${total - p.or} PO. Le garde ne fait pas crédit.`;
  p.or -= total;
  p.peage = c.id;
  noter(p, `paie ${total} PO de droit d'entrée à ${c.nom}.`);
  return null;
};
