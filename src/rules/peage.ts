import type { Cite } from './cites';
import { lancerExpression, noter, valeursCombat, type Partie } from './partie';
import type { Rng } from './des';
import { maintenant } from './essais';

// Droits d'entrée des cités (Chnafon, Jambfer) : la porte réclame son dû, par personne, à chaque arrivée.
// Le héros ne paie que sa place : le butin est partagé, chaque compagnon paie la sienne de sa poche.
// Le garde de Chnafon reconnaît pendant une semaine ceux qui ont déjà payé.
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

/** Jusqu'à quand (heure absolue) le garde se souvient de nous, s'il s'en souvient encore. */
export const reconnuJusqua = (p: Partie, c: Cite) => {
  const t = p.peagesPayes?.[c.id];
  return t !== undefined && t > maintenant(p) ? t : null;
};

export const peageDu = (p: Partie, c: Cite) => !!c.peage && p.peage !== c.id && reconnuJusqua(p, c) === null;

export const fixerPeage = (c: Cite, rng?: Rng): Peage => {
  const t = c.peage!.prix;
  if (typeof t === 'number') return { prix: t, des: [] };
  const j = lancerExpression(t, rng);
  return { prix: j.total, des: j.des };
};

/** Ce que le héros sort de sa bourse : sa seule place. */
export const totalPeage = (_p: Partie, g: Peage) => g.prix;

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
  if (c.peage?.souvenir) p.peagesPayes = { ...p.peagesPayes, [c.id]: maintenant(p) + c.peage.souvenir };
  const n = personnes(p) - 1;
  noter(p, `paie ${total} PO de droit d'entrée à ${c.nom}${n ? ` ; ${n > 1 ? 'ses compagnons paient' : 'son compagnon paie'} sa place` : ''}.`);
  return null;
};
