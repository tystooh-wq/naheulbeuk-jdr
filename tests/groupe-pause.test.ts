import { describe, expect, it } from 'vitest';
import type { Personnage } from '../src/rules/creation';
import { nouvellePartie } from '../src/rules/partie';
import { donnerObjet, equipeDe, ficheCompagnon, niveauCompagnon, reprendreObjet, sacDe, volonte, xpCompagnon } from '../src/rules/compagnons';
import { casserCroute, entrerDonjon, refusCamp, reposUneHeure } from '../src/rules/donjons';
import { avecDe } from '../src/rules/des';

const perso: Personnage = {
  version: 1,
  nom: 'Test',
  sexe: 'Femme',
  jets: { COU: 12, INT: 10, CHA: 10, AD: 10, FO: 13 },
  origineId: 'humain',
  metierId: 'guerrier',
  competencesChoisies: [],
  ajustements: { guerrierEchange: 'aucun', guerrierBonus: 'AT' },
  destin: 1,
  or: 500,
  jetsOr: [],
};

describe('compagnons : niveaux et équipement', () => {
  it('un combattant gagne 1D6 PV et un point au passage de niveau', () => {
    const p = nouvellePartie(perso);
    p.compagnons = [{ id: 'gaston', ev: 20, evMax: 28 }];
    const g = p.compagnons[0];
    const recits = xpCompagnon(p, g, 120, avecDe(4, 6));
    expect(niveauCompagnon(g)).toBe(2);
    expect(g.evMax).toBe(32);
    expect(g.ev).toBe(24);
    expect(recits[0]).toMatch(/niveau 2/);
  });

  it('une mage met son D6 en énergie astrale', () => {
    const p = nouvellePartie(perso);
    p.compagnons = [{ id: 'berthe', ev: 20, evMax: 20, ea: 10 }];
    const b = p.compagnons[0];
    xpCompagnon(p, b, 100, avecDe(5, 6));
    expect(ficheCompagnon('berthe', b).ea).toBe(35);
    expect(b.ea).toBe(15);
    expect(b.evMax).toBe(20);
  });

  it('on lui donne une arme, il l\'équipe ; on peut la reprendre', () => {
    const p = nouvellePartie(perso);
    p.compagnons = [{ id: 'gaston', ev: 20, evMax: 28 }];
    const g = p.compagnons[0];
    const avant = equipeDe(g).arme!;
    p.sac.push('dague-base');
    expect(donnerObjet(p, g, 'dague-base')).toMatch(/s'équipe/);
    expect(equipeDe(g).arme).toBe('dague-base');
    expect(sacDe(g)).toContain(avant);
    reprendreObjet(p, g, 'dague-base', 'arme');
    expect(equipeDe(g).arme).toBeUndefined();
    expect(p.sac).toContain('dague-base');
  });

  it('la volonté propre : le glorieux refuse de rester derrière, le prudent aime ça', () => {
    expect(volonte({ id: 'gaston', ev: 1, evMax: 1 }, 'distance').modif).toBeGreaterThan(0);
  });
});

describe('pause en donjon', () => {
  it('casser la croûte rend 3 PV, pas deux fois de suite', () => {
    const p = nouvellePartie(perso);
    p.ev = 10;
    p.sac.push('rations', 'rations');
    entrerDonjon(p, 'donjon-facile');
    expect(casserCroute(p)).toMatch(/3 PV/);
    expect(p.ev).toBe(13);
    expect(casserCroute(p)).toMatch(/faim/);
    expect(reposUneHeure(p)).toMatch(/1 PV/);
  });

  it("pas de camp dans une salle où il reste des monstres", () => {
    const p = nouvellePartie(perso);
    entrerDonjon(p, 'chateau-valtordu');
    p.donjon!.salle = 'cv-gardes';
    expect(refusCamp(p)).toMatch(/sûre/);
  });
});
