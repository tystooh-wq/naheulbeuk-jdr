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

describe('hors des routes', () => {
  it('le trajet direct est plus court que la route et traverse les dunes vers les grottes', async () => {
    const { itineraireDirect } = await import('../src/rules/monde');
    const route = itineraire('hameau', 'biouro')!;
    const direct = itineraireDirect('hameau', 'biouro');
    expect(direct.km).toBeLessThan(route.km * 0.75);
    expect(itineraireDirect('waldorg', 'grottes').troncons.some((t) => t.terrain === 'dunes')).toBe(true);
  });

  it('hors piste, le MJ tire deux fois plus de rencontres et d\'embûches', async () => {
    const { controler } = await import('../src/rules/evenements');
    const de = (n: number) => () => (n - 0.5) / 6;
    expect(controler('plaine', false, de(2), false).type).toBe('evenement');
    expect(controler('plaine', false, de(2), true).type).toBe('rencontre');
    expect(controler('plaine', false, de(4), true).type).toBe('evenement');
    expect(controler('plaine', false, de(5), true).type).toBe('rien');
  });
});
