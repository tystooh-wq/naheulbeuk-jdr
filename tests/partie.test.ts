import { describe, expect, it } from 'vitest';
import type { Personnage } from '../src/rules/creation';
import { OBJETS } from '../src/rules/objets';
import {
  acheter,
  boirePotion,
  dormir,
  equipementDepart,
  equiper,
  lancerExpression,
  nouvellePartie,
  valeursCombat,
  vendre,
} from '../src/rules/partie';
import { LIEUX } from '../src/rules/waldorg';

const perso = (p: Partial<Personnage>): Personnage => ({
  version: 1,
  nom: 'Test',
  sexe: 'Femme',
  jets: { COU: 12, INT: 10, CHA: 10, AD: 10, FO: 13 },
  origineId: 'humain',
  metierId: 'guerrier',
  competencesChoisies: [],
  ajustements: { guerrierEchange: 'aucun', guerrierBonus: 'AT' },
  destin: 1,
  or: 50,
  jetsOr: [[2, 3]],
  ...p,
});

describe('équipement de départ', () => {
  it('un guerrier de classe moyenne part avec un glaive et une veste de cuir, sans dépenser son or', () => {
    const partie = nouvellePartie(perso({}));
    expect(partie.equipe).toEqual({ arme: 'glaive-allonge', armure: 'veste-cuir' });
    expect(partie.or).toBe(50);
    expect(partie.sac).toContain('briquet');
  });

  it('un mage pauvre part avec un bâton de sorcier perrave', () => {
    const { equipe } = equipementDepart(perso({ metierId: 'mage', jets: { COU: 10, INT: 12, CHA: 10, AD: 10, FO: 10 }, or: 20 }));
    expect(equipe.arme).toBe('baton-sorcier-perrave');
  });

  it("l'armure respecte la limite de PR de l'origine", () => {
    const { equipe } = equipementDepart(
      perso({ origineId: 'gnome', metierId: 'aucun', jets: { COU: 10, INT: 10, CHA: 10, AD: 13, FO: 8 }, or: 120, ajustements: {} }),
    );
    expect(equipe.armure).toBe('veste-cuir');
    expect(equipe.arme).toBe('dague-bleusaille');
  });
});

describe('valeurs de combat', () => {
  it("l'arme et l'armure modifient AT, PRD, dégâts et protection", () => {
    const partie = nouvellePartie(perso({}));
    // Guerrier humain : AT 8+1, PRD 10 ; glaive allongé PRD-1, 1D+3 ; FO 13 : +1 dégât.
    expect(valeursCombat(partie)).toMatchObject({ at: 9, prd: 9, degats: '1D+4', pr: 2 });
  });

  it('à mains nues, on frappe à 1D-2 plus le bonus de force', () => {
    const partie = nouvellePartie(perso({}));
    partie.equipe.arme = undefined;
    expect(valeursCombat(partie).degats).toBe('1D-1');
  });
});

describe('commerce et sac', () => {
  it("on n'achète pas sans or, et on revend ce qu'on a", () => {
    const partie = nouvellePartie(perso({ or: 20 }));
    expect(acheter(partie, 'claymore-bleusaille', 200)).toMatch(/assez d'or/);
    expect(acheter(partie, 'torche', 1)).toBeNull();
    expect(partie.or).toBe(19);
    expect(vendre(partie, 'torche', 1)).toBeNull();
    expect(partie.or).toBe(20);
  });

  it("une claymore demande la compétence Armes de bourrin, que le guerrier possède", () => {
    const guerrier = nouvellePartie(perso({}));
    guerrier.sac.push('claymore-bleusaille');
    expect(equiper(guerrier, 'claymore-bleusaille')).toBeNull();
    expect(guerrier.sac).toContain('glaive-allonge');

    const voleur = nouvellePartie(perso({ metierId: 'voleur', jets: { COU: 10, INT: 10, CHA: 10, AD: 12, FO: 10 }, ajustements: {} }));
    voleur.sac.push('claymore-bleusaille');
    expect(equiper(voleur, 'claymore-bleusaille')).toMatch(/Armes de bourrin/);
  });

  it('les potions soignent sans dépasser le maximum', () => {
    const partie = nouvellePartie(perso({}));
    partie.ev = 10;
    partie.sac.push('potion-soin');
    const r = boirePotion(partie, 'potion-soin', () => 0.99);
    expect(r).toEqual({ rendu: 5, des: [] });
    expect(partie.ev).toBe(15);
  });

  it('une nuit en excellentes conditions rend 8 PV et fait passer un jour', () => {
    const partie = nouvellePartie(perso({}));
    partie.ev = 5;
    expect(dormir(partie, 'excellent')).toBe(8);
    expect(partie.jour).toBe(2);
  });
});

describe('données', () => {
  it('les expressions de dés sont comprises', () => {
    expect(lancerExpression('2D+4', () => 0).total).toBe(6);
    expect(lancerExpression('1D-2', () => 0).total).toBe(0);
  });

  it('chaque objet vendu en ville existe et chaque lieu est sur le plan', () => {
    const ids = new Set(OBJETS.map((o) => o.id));
    for (const l of LIEUX) {
      for (const id of l.boutique?.stock ?? []) expect(ids.has(id), `${l.id} → ${id}`).toBe(true);
      expect(l.x).toBeGreaterThan(0);
      expect(l.x).toBeLessThan(100);
      expect(l.y).toBeGreaterThan(0);
      expect(l.y).toBeLessThan(100);
    }
  });
});
