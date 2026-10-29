import { describe, expect, it } from 'vitest';
import { creature, CREATURES, FICHES } from '../src/rules/bestiaire';
import { OBJETS } from '../src/rules/objets';
import { longueur, pointA, trajet } from '../src/rules/rues';
import { LIEUX, lieu } from '../src/rules/waldorg';

describe('trajets dans Waldorg', () => {
  it('chaque paire de lieux a un trajet le long des rues, dans les deux sens', () => {
    for (const a of LIEUX)
      for (const b of LIEUX) {
        if (a.id === b.id) continue;
        const c = trajet(a, b);
        expect(c.length, `${a.id} → ${b.id}`).toBeGreaterThan(2);
        expect(c[0]).toEqual([a.x, a.y]);
        expect(c[c.length - 1]).toEqual([b.x, b.y]);
      }
  });

  it('le chemin à pied est plus long que la ligne droite', () => {
    const c = trajet(lieu('porte'), lieu('barcasse'));
    const droite = longueur([c[0], c[c.length - 1]]);
    expect(longueur(c)).toBeGreaterThan(droite);
    expect(pointA(c, 0)).toEqual(c[0]);
    expect(pointA(c, 1)).toEqual(c[c.length - 1]);
  });
});

describe('données officielles', () => {
  it('le bestiaire contient les gobelins des grottes', () => {
    expect(CREATURES.length).toBeGreaterThan(200);
    expect(creature('Gobelin')).toMatchObject({ at: '8', prd: '6', ev: '12', pr: '2', degats: '1D+2', cou: '5', xp: '5' });
    expect(FICHES[creature('Orque standard').fiche!]).toMatch(/pieds/);
  });

  it('seuls quelques objets restent sans source officielle (et les trophées de butin)', () => {
    const trophees = ['peau-coyote', 'corne-bouc', 'dard-scorpion', 'queue-rat', 'jambon-mutant', 'plumes-chapon', 'oeuf-chapon', 'dent-ogre', 'cuir-aurochs', 'laine-brebiphant', 'musc-dantragor', 'fourrure-morshleg', 'ecaille-dragon', 'gri-gri-orque', 'babiole-gobeline'];
    expect(OBJETS.filter((o) => o.estime && !trophees.includes(o.id)).map((o) => o.id)).toEqual(['baton', 'champignons-orange', 'outils-crochetage']);
    expect(new Set(OBJETS.map((o) => o.id)).size).toBe(OBJETS.length);
  });
});
