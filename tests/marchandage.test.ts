import { describe, expect, it } from 'vitest';
import { choisirCadeau, marchander } from '../src/rules/marchandage';

const stock = ['epee-bonne', 'dague-base', 'rations', 'corde', 'torche'];
/** Rend toujours la même face d'un D6. */
const d6 = (face: number) => () => (face - 0.5) / 6;

describe('marchandage', () => {
  it('réussi : 10 % de remise ; raté : 10 % de plus', () => {
    expect(marchander(12, stock, 8)).toMatchObject({ reussi: true, taux: -0.1 });
    expect(marchander(12, stock, 15)).toMatchObject({ reussi: false, taux: 0.1 });
  });

  it('réussite critique, D6 du MJ de 1 à 3 : 30 % de remise', () => {
    expect(marchander(12, stock, 1, d6(2))).toMatchObject({ critique: 'remise', taux: -0.3, deMJ: 2 });
  });

  it('réussite critique, D6 du MJ de 4 à 6 : un cadeau parmi les moins chers', () => {
    const m = marchander(12, stock, 1, d6(5));
    expect(m).toMatchObject({ critique: 'cadeau', taux: -0.1 });
    expect(['rations', 'corde', 'torche', 'dague-base']).toContain(m.cadeau);
    expect(m.cadeau).not.toBe('epee-bonne');
  });

  it('maladresse : +25 %', () => {
    expect(marchander(12, stock, 20)).toMatchObject({ maladresse: true, taux: 0.25 });
  });

  it('le cadeau ne sort pas des trois objets les moins chers', () => {
    for (let f = 1; f <= 6; f++) expect(stock).toContain(choisirCadeau(stock, d6(f)));
  });
});
