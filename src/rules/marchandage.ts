import { lancer, type Rng } from './des';
import { objet } from './objets';
import { epreuve } from './partie';

// Marchandage (épreuve de Charisme) : 10 % de remise si réussi, 10 % de plus si raté.
// Réussite critique (1) : le MJ lance un D6. 1 à 3, grosse remise de 30 % ; 4 à 6, remise normale
// et un petit cadeau glissé avec le premier achat. Maladresse (20) : le marchand se sent insulté, +25 %.

export interface Marchandage {
  de: number;
  reussi: boolean;
  /** Variation des prix d'achat, en fraction (−0,1 = 10 % de remise). */
  taux: number;
  critique?: 'remise' | 'cadeau';
  maladresse?: boolean;
  /** Le D6 du MJ sur une réussite critique. */
  deMJ?: number;
  /** Objet offert avec le premier achat. */
  cadeau?: string;
}

/** Le cadeau : un des trois objets les moins chers de la boutique. */
export const choisirCadeau = (stock: string[], rng?: Rng): string => {
  const moinsChers = [...stock].sort((a, b) => objet(a).prix - objet(b).prix).slice(0, 3);
  return moinsChers[lancer(moinsChers.length, rng) - 1];
};

export const marchander = (charisme: number, stock: string[], de: number, rng?: Rng): Marchandage => {
  const { reussi } = epreuve(charisme, rng, de);
  if (de === 1) {
    const deMJ = lancer(6, rng);
    return deMJ <= 3
      ? { de, reussi, taux: -0.3, critique: 'remise', deMJ }
      : { de, reussi, taux: -0.1, critique: 'cadeau', deMJ, cadeau: choisirCadeau(stock, rng) };
  }
  if (de === 20) return { de, reussi, taux: 0.25, maladresse: true };
  return { de, reussi, taux: reussi ? -0.1 : 0.1 };
};
