import { describe, expect, it } from 'vitest';
import { itineraire, LIEUX_MONDE, positionApres } from '../src/rules/monde';

describe('carte du monde', () => {
  it('tous les lieux sont reliés à Waldorg', () => {
    for (const l of LIEUX_MONDE) if (l.id !== 'waldorg') expect(itineraire('waldorg', l.id), l.id).not.toBeNull();
  });

  it("les distances collent à l'échelle officielle", () => {
    // Supplément « Déplacements et transport » : Waldorg-Fierpâté, 58 km en Terres Sauvages.
    const fierpate = itineraire('waldorg', 'fierpate')!;
    expect(fierpate.km).toBeGreaterThan(50);
    expect(fierpate.km).toBeLessThan(66);
    // Côte Waldorgaise : les grottes sont à moins d'une journée de marche.
    const grottes = itineraire('waldorg', 'grottes')!;
    expect(grottes.km).toBeGreaterThan(12);
    expect(grottes.heures).toBeLessThan(10);
  });

  it('la marche forcée va plus vite', () => {
    expect(itineraire('waldorg', 'biouro', 'forcee')!.heures).toBeLessThan(itineraire('waldorg', 'biouro')!.heures);
  });

  it('le voyageur avance le long du chemin', () => {
    const it = itineraire('waldorg', 'sival')!;
    expect(positionApres(it, 0)).toEqual([2442, 1325]);
    expect(positionApres(it, it.heures)).toEqual([2515, 1240]);
  });
});
