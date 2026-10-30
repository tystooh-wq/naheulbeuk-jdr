import { describe, expect, it } from 'vitest';
import { CITES, trajetCite } from '../src/rules/cites';
import { LIEUX_MONDE } from '../src/rules/monde';
import { objet } from '../src/rules/objets';

const objetConnu = (id: string) => {
  try {
    return !!objet(id);
  } catch {
    return false;
  }
};

describe('villes jouables', () => {
  it('dix villes, chacune reliée à son lieu de la carte du monde', () => {
    expect(CITES.map((c) => c.id)).toEqual(['waldorg', 'valtordu', 'loubet', 'fquiepou', 'kjaniouf', 'tulamor', 'mliuej', 'chnafon', 'glargh', 'jambfer']);
    for (const c of CITES) expect(LIEUX_MONDE.find((l) => l.id === c.lieuMonde)?.ville, c.id).toBe(c.id);
  });

  for (const c of CITES.filter((x) => x.reseau)) {
    it(`${c.nom} : une porte, des lieux uniques, des portes de lieux dans le réseau, des rues reliées`, () => {
      const { noeuds, aretes, acces } = c.reseau!;
      expect(c.lieux.filter((l) => l.type === 'porte').map((l) => l.id)).toEqual(['porte']);
      expect(new Set(c.lieux.map((l) => l.id)).size).toBe(c.lieux.length);
      for (const [a, b] of aretes) expect(noeuds[a] && noeuds[b], `${a}-${b}`).toBeTruthy();
      for (const l of c.lieux) {
        expect(noeuds[acces![l.id]], `${c.id}:${l.id}`).toBeTruthy();
        expect(l.x).toBeGreaterThanOrEqual(0);
        expect(l.y).toBeLessThanOrEqual(100);
        for (const o of l.boutique?.stock ?? []) expect(objetConnu(o), `${c.id}:${l.id} vend ${o}`).toBe(true);
      }
      // Toutes les rues se rejoignent : depuis la porte, on atteint chaque carrefour.
      const vus = new Set([acces!.porte]);
      for (let encore = true; encore; ) {
        encore = false;
        for (const [a, b] of aretes)
          if (vus.has(a) !== vus.has(b)) {
            vus.add(a).add(b);
            encore = true;
          }
      }
      expect(Object.keys(noeuds).filter((n) => !vus.has(n)), c.id).toEqual([]);
      const porte = c.lieux[0];
      for (const b of c.lieux.slice(1)) expect(trajetCite(c, porte, b).length, `${c.id} : porte → ${b.id}`).toBeGreaterThan(2);
    });
  }
});
