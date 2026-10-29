// Monnaie de la Terre de Fangh, telle que Sedy la fixe pour le jeu : 1 pièce d'or (PO) = 100 pièces
// d'argent (PA) = 1000 pièces de cuivre (PC). (Le tableau « Matériel et services » dit 10 PA et 100 PC.)
// Les sommes sont gardées en PO, avec des décimales : 0,01 PO = 1 PA, 0,001 PO = 1 PC.

export const PA_PAR_PO = 100;
export const PC_PAR_PO = 1000;

/** Arrondit une somme à la pièce de cuivre près. */
export const arrondirOr = (po: number) => Math.round(po * PC_PAR_PO) / PC_PAR_PO;

/** « 12 PO 5 PA 3 PC », sans les pièces absentes. */
export const formatOr = (po: number): string => {
  const cuivre = Math.round(Math.abs(po) * PC_PAR_PO);
  if (cuivre === 0) return '0 PO';
  const or = Math.floor(cuivre / PC_PAR_PO);
  const argent = Math.floor((cuivre % PC_PAR_PO) / (PC_PAR_PO / PA_PAR_PO));
  const reste = cuivre % (PC_PAR_PO / PA_PAR_PO);
  const morceaux = [or ? `${or} PO` : '', argent ? `${argent} PA` : '', reste ? `${reste} PC` : ''].filter(Boolean);
  return `${po < 0 ? '−' : ''}${morceaux.join(' ')}`;
};
