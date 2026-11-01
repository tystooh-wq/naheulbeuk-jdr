import { describe, expect, it } from 'vitest';
import { itineraire, LIEUX_MONDE, positionApres } from '../src/rules/monde';
import { nouvellePartie } from '../src/rules/partie';
import type { Personnage } from '../src/rules/creation';

const partie = () =>
  nouvellePartie({
    version: 1, nom: 'Test', sexe: 'Femme', jets: { COU: 12, INT: 10, CHA: 10, AD: 10, FO: 13 }, origineId: 'humain', metierId: 'guerrier',
    competencesChoisies: [], ajustements: { guerrierEchange: 'aucun', guerrierBonus: 'AT' }, destin: 1, or: 200, jetsOr: [],
  } as Personnage);

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

  it('hors piste, le danger double ; près des villes, il baisse', async () => {
    const { danger } = await import('../src/rules/evenements');
    const { LIEUX_MONDE } = await import('../src/rules/monde');
    expect(danger('terres-sauvages', true)).toBe(2 * danger('terres-sauvages', false));
    expect(danger('foret')).toBeGreaterThan(danger('campagne'));
    const waldorg = LIEUX_MONDE.find((l) => l.id === 'waldorg')!;
    expect(danger('terres-sauvages', false, [waldorg.x, waldorg.y])).toBeLessThan(danger('terres-sauvages'));
  });

  it("après une rencontre, 8 à 12 h de répit, puis la tension remonte", async () => {
    const { controler, tension } = await import('../src/rules/evenements');
    const p = partie();
    const toujours = () => 0;
    expect(controler('plaine', false, toujours, false, p, 'terres-sauvages').type).toBe('rencontre');
    expect(tension(p)).toBe(0);
    for (let i = 0; i < 50; i++) expect(controler('plaine', false, toujours, false, p, 'terres-sauvages').type).not.toBe('rencontre');
    p.heure += 12;
    expect(tension(p)).toBeLessThan(1);
    p.jour += 2;
    expect(tension(p)).toBe(1);
  });

  it("un événement ne revient pas dans le mois ; les petits vont au journal", async () => {
    const { controler, marquerVu, EVENEMENTS, tirerEvenement } = await import('../src/rules/evenements');
    const p = partie();
    for (const e of EVENEMENTS) marquerVu(p, e.id);
    for (let i = 0; i < 30; i++) {
      const ev = tirerEvenement('sentier', undefined, p, 'terres-sauvages');
      expect(ev === null || ev.prioritaire).toBe(true);
    }
    p.jour += 31;
    expect(tirerEvenement('sentier', () => 0.3, p, 'terres-sauvages')).not.toBeNull();
    const q = partie();
    const c = controler('sentier', false, () => 0.99, false, q, 'campagne');
    expect(c.type).toBe('petit');
  });
});

describe('changer de cap en chemin', () => {
  it('demi-tour : le chemin du retour est celui déjà parcouru', async () => {
    const { changerCap, itineraireVoyage } = await import('../src/rules/monde');
    const it = itineraire('valtordu', 'tulamor')!;
    const v = { etapes: it.etapes, allure: 'normale' as const, fait: it.heures * 0.6 };
    const retour = changerCap(v, 'valtordu', 'normale', false)!;
    const r = itineraireVoyage(retour);
    expect(r.heures).toBeCloseTo(v.fait, 1);
    expect(positionApres(r, 0)[0]).toBeCloseTo(positionApres(it, v.fait)[0], 3);
    expect(positionApres(r, r.heures)).toEqual(positionApres(it, 0));
  });

  it('vers une autre destination, on repart du lieu le plus commode', async () => {
    const { changerCap, itineraireVoyage } = await import('../src/rules/monde');
    const it = itineraire('valtordu', 'tulamor')!;
    const v = { etapes: it.etapes, allure: 'normale' as const, fait: 1 };
    const t = changerCap(v, 'loubet', 'normale', false)!;
    expect(t.etapes[t.etapes.length - 1]).toBe('loubet');
    const r = itineraireVoyage(t);
    expect(positionApres(r, 0)[0]).toBeCloseTo(positionApres(it, 1)[0], 3);
    // Hors piste : tout droit depuis la position actuelle.
    const d = itineraireVoyage(changerCap(v, 'loubet', 'normale', true)!);
    expect(d.horsPiste).toBe(true);
    const loubet = LIEUX_MONDE.find((l) => l.id === 'loubet')!;
    expect(positionApres(d, d.heures)[0]).toBeCloseTo(loubet.x, 3);
  });
});

