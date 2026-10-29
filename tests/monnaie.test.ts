import { describe, expect, it } from 'vitest';
import { arrondirOr, formatOr } from '../src/rules/monnaie';
import { objet } from '../src/rules/objets';

describe('monnaie : 1 PO = 100 PA = 1000 PC', () => {
  it('affiche or, argent et cuivre', () => {
    expect(formatOr(12)).toBe('12 PO');
    expect(formatOr(12.053)).toBe('12 PO 5 PA 3 PC');
    expect(formatOr(0.002)).toBe('2 PC');
    expect(formatOr(0)).toBe('0 PO');
  });

  it('arrondit au cuivre', () => {
    expect(arrondirOr(0.1 + 0.2)).toBe(0.3);
  });

  it('les prix du tableau en PA et PC sont convertis', () => {
    expect(objet('tranche-de-pain').prix).toBe(0.005);
    expect(objet('miche-de-pain').prix).toBe(0.02);
  });
});
