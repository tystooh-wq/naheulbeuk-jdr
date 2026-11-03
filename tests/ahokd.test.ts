import { describe, expect, it } from 'vitest';
import type { Personnage } from '../src/rules/creation';
import { donjon, donjonIci, entrerDonjon, quitterDonjon } from '../src/rules/donjons';
import { nouvellePartie } from '../src/rules/partie';

const perso: Personnage = {
  version: 1,
  nom: 'Test',
  sexe: 'Femme',
  jets: { COU: 12, INT: 12, CHA: 10, AD: 12, FO: 12 },
  origineId: 'humain',
  metierId: 'guerrier',
  competencesChoisies: [],
  ajustements: { guerrierEchange: 'aucun', guerrierBonus: 'AT' },
  destin: 1,
  or: 50,
  jetsOr: [[2, 3]],
};

describe("grotte d'Ahokd (donjon tiré au sort)", () => {
  it('une même graine donne la même grotte ; deux graines, deux grottes', () => {
    const a = donjon('ahokd:42');
    expect(donjon('ahokd:42')).toBe(a);
    const plan = (id: string) => donjon(id).salles.map((s) => `${s.id}@${s.x},${s.y}`).join(' ');
    expect(plan('ahokd:43')).not.toEqual(plan('ahokd:42'));
  });

  it('toutes les salles sont reliées, sans chevauchement, et l’antre de l’ogre est au bout', () => {
    for (let g = 1; g <= 60; g++) {
      const d = donjon(`ahokd:${g}`);
      const ids = new Set(d.salles.map((s) => s.id));
      expect(new Set(d.salles.map((s) => `${s.x},${s.y}`)).size, `graine ${g}`).toBe(d.salles.length);
      for (const s of d.salles) for (const v of s.vers) expect(ids.has(v)).toBe(true);
      const vus = new Set([d.entree]);
      const file = [d.entree];
      while (file.length) {
        const ici = file.shift();
        for (const v of d.salles.find((s) => s.id === ici)!.vers) if (!vus.has(v)) vus.add(v), file.push(v);
      }
      expect(vus.size, `graine ${g}`).toBe(d.salles.length);
      expect(d.salles.find((s) => s.id === d.finale)?.contenu?.type).toBe('combat');
      expect(d.salles.length).toBeGreaterThanOrEqual(8);
    }
  });

  it("on entre par la carte du monde ; l'expédition en cours est reprise", () => {
    expect(donjonIci('monde:ahokd')?.id).toBe('ahokd');
    const p = nouvellePartie(perso);
    const e = entrerDonjon(p, 'ahokd');
    expect(e.id).toMatch(/^ahokd:\d+$/);
    quitterDonjon(p);
    expect(entrerDonjon(p, 'ahokd').id).toBe(e.id);
  });
});
