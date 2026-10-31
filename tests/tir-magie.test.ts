import { describe, expect, it } from 'vitest';
import type { Personnage } from '../src/rules/creation';
import { creerCombat, deplacer, ecart, heros, planifier, tirer, toucherParSort, tourSuivant } from '../src/rules/combat';
import { ea, lancerSort, sort, sortsConnus, soinLeger, valeurSort } from '../src/rules/magie';
import { objet } from '../src/rules/objets';
import { acheter, dormir, equiper, nouvellePartie } from '../src/rules/partie';
import { TABLE_TERRES_SAUVAGES } from '../src/rules/rencontres';
import { valeursTir } from '../src/rules/tir';

const perso = (p: Partial<Personnage>): Personnage => ({
  version: 1,
  nom: 'Test',
  sexe: 'Femme',
  jets: { COU: 12, INT: 13, CHA: 10, AD: 12, FO: 13 },
  origineId: 'humain',
  metierId: 'guerrier',
  competencesChoisies: [],
  ajustements: { guerrierEchange: 'aucun', guerrierBonus: 'AT' },
  destin: 1,
  or: 50,
  jetsOr: [[2, 3]],
  ...p,
});

describe('armes à distance', () => {
  it('arcs et flèches viennent du catalogue avec leur rechargement', () => {
    expect(objet('arc-court-de-qualite-correcte').tir).toMatchObject({ recharge: 3, munition: 'fleche' });
    expect(objet('arbalete-de-qualite-correcte').tir).toMatchObject({ recharge: 6, munition: 'carreau', mecanique: true });
    expect(objet('javelot-de-base').tir?.lancee).toBe(true);
    expect(objet('fleche-de-base')).toMatchObject({ munition: 'fleche', modTir: -1 });
  });

  it("sans « Tirer correctement », on tire à AD-4 ; un lot de flèches en donne dix", () => {
    const p = nouvellePartie(perso({}));
    p.sac.push('arc-court-de-qualite-correcte');
    expect(equiper(p, 'arc-court-de-qualite-correcte')).toBeNull();
    expect(p.equipe.distance).toBe('arc-court-de-qualite-correcte');
    expect(valeursTir(p)!.aSec).toBe(true);
    p.or = 100;
    acheter(p, 'fleches-lot', 5);
    expect(p.sac.filter((id) => id === 'fleche-de-base')).toHaveLength(10);
    const t = valeursTir(p)!;
    expect(t.aSec).toBe(false);
    expect(t.ad).toBe(12 - 4 - 1);
    expect(t.degats).toBe('1D+3');
  });

  it("on tire tant que personne n'est au contact ; l'ennemi avance de deux cases par tour", () => {
    const p = nouvellePartie(perso({}));
    const c = creerCombat(p, { ligne: TABLE_TERRES_SAUVAGES[8], nombre: 1, d20: 9, approche: 2 });
    const e = c.combattants[1];
    expect(ecart(heros(c), e)).toBe(5);
    const a = tirer(c, 'heros', 'e1', 2, { ad: 10, degats: '1D+2' }, { desDegats: [4] });
    expect(a.degats?.blessure).toBe(6 - e.pr);
    const plan = planifier(c, e);
    expect(plan.vers).toBeDefined();
    deplacer(c, e.id, plan.vers!.x, plan.vers!.y);
    expect(ecart(heros(c), e)).toBe(3);
  });

  it('les brigands archers tirent', () => {
    const p = nouvellePartie(perso({}));
    const c = creerCombat(p, { ligne: TABLE_TERRES_SAUVAGES[5], nombre: 1, d20: 6 });
    expect(c.combattants[1].tireur).toMatchObject({ ad: 11, degats: '1D+3', recharge: 3 });
  });

  it("à l'arc, on tire une fois tous les trois assauts (rechargement 3), héros comme ennemis", () => {
    const p = nouvellePartie(perso({}));
    const c = creerCombat(p, { ligne: TABLE_TERRES_SAUVAGES[5], nombre: 1, d20: 6, approche: 4 });
    const archer = c.combattants[1];
    const tirs: number[] = [];
    for (let assaut = 0; assaut < 9; assaut++) {
      if (!planifier(c, archer).recharge) {
        tirs.push(c.assaut);
        tirer(c, archer.id, 'heros', 19, archer.tireur!);
      }
      for (let i = 0; i < c.ordre.length; i++) tourSuivant(c);
    }
    expect(tirs.map((a) => a - tirs[0])).toEqual([0, 3, 6]);
  });
});

describe('magie', () => {
  it('un mage de niveau 1 connaît la boule de feu, le tourbillon et le soin ; un guerrier rien', () => {
    expect(sortsConnus(nouvellePartie(perso({})))).toHaveLength(0);
    const p = nouvellePartie(perso({ metierId: 'mage' }));
    expect(sortsConnus(p).map((s) => s.id)).toEqual(['boule-de-feu-mineure', 'tourbillon-de-wazaa', 'soin-blessures-legeres']);
    expect(ea(p)).toBe(30);
    // MagiePhys = moyenne INT 13 / AD 12, arrondie au-dessus : 13 ; +3 pour la boule de feu.
    expect(valeurSort(p, sort('boule-de-feu-mineure'))).toBe(16);
  });

  it('un sort raté coûte la moitié des PA ; réussi, tout ; puis le repos les rend', () => {
    const p = nouvellePartie(perso({ metierId: 'mage' }));
    const t = sort('tourbillon-de-wazaa');
    expect(lancerSort(p, t, 19)).toMatchObject({ issue: 'rate', cout: 5 });
    expect(ea(p)).toBe(25);
    expect(lancerSort(p, t, 2)).toMatchObject({ issue: 'reussi', cout: 10 });
    expect(ea(p)).toBe(15);
    p.ea = 9;
    expect(typeof lancerSort(p, t, 2)).toBe('string');
    dormir(p, 'normal');
    expect(ea(p)).toBe(30);
  });

  it('les dégâts de sort sont doublés sur un critique, moins l’armure', () => {
    const p = nouvellePartie(perso({ metierId: 'mage' }));
    const c = creerCombat(p, { ligne: TABLE_TERRES_SAUVAGES[8], nombre: 1, d20: 9 });
    const pr = c.combattants[1].pr;
    const a = toucherParSort(c, 'e1', '3', true);
    expect(a.degats?.blessure).toBe(6 - pr);
    expect(heros(c).ev).toBeGreaterThan(0);
  });

  it('le soin léger convertit des PA en PV, deux fois par heure au plus', () => {
    const p = nouvellePartie(perso({ metierId: 'mage' }));
    p.ev -= 10;
    const r = soinLeger(p, () => 0.99);
    expect(r).toMatchObject({ rendu: 6 });
    soinLeger(p, () => 0.99);
    expect(typeof soinLeger(p)).toBe('string');
  });
});
