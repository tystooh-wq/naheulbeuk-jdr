import { describe, expect, it } from 'vitest';
import type { Personnage } from '../src/rules/creation';
import { creerCombat, heros, planSort, tourSuivant } from '../src/rules/combat';
import { GRIMOIRES, sortGrimoire } from '../src/rules/grimoires';
import { ea, etudierGrimoire, grimoiresAEtudier, lancerSort, sortsConnus, sortAutomatique, valeurSort } from '../src/rules/magie';
import { equipementDepart, nouvellePartie } from '../src/rules/partie';
import { TABLE_TERRES_SAUVAGES } from '../src/rules/rencontres';
import { appliquerSort, lancerSortAllie } from '../src/rules/sorts';

const perso = (p: Partial<Personnage>): Personnage => ({
  version: 1,
  nom: 'Test',
  sexe: 'Femme',
  jets: { COU: 12, INT: 13, CHA: 13, AD: 12, FO: 12 },
  origineId: 'humain',
  metierId: 'mage',
  competencesChoisies: [],
  ajustements: {},
  destin: 1,
  or: 50,
  jetsOr: [[2, 3]],
  ...p,
});

const rencontre = { ligne: TABLE_TERRES_SAUVAGES[8], nombre: 2, d20: 9 };

describe('grimoires', () => {
  it('les grimoires officiels sont relevés : 646 sorts, des écoles de mage et de prêtre', () => {
    expect(GRIMOIRES.length).toBeGreaterThan(600);
    expect(new Set(GRIMOIRES.map((s) => s.id)).size).toBe(GRIMOIRES.length);
    expect(sortGrimoire('pretre-youclidh:apposition-de-la-main-de-youclidh')?.effet).toMatchObject({ type: 'soin', parPA: 1 });
  });

  it('un mage du feu connaît la magie généraliste et sa spécialité ; un prêtre, son dieu seulement', () => {
    const feu = nouvellePartie(perso({ magie: { ecoles: ['feu'] } }));
    const ecoles = new Set(sortsConnus(feu).map((s) => s.ecole));
    expect([...ecoles].sort()).toEqual(['feu', 'generaliste']);
    const pretre = nouvellePartie(perso({ metierId: 'pretre', magie: { ecoles: ['pretre-dlul'] } }));
    expect(new Set(sortsConnus(pretre).map((s) => s.ecole))).toEqual(new Set(['pretre-dlul']));
  });

  it("l'épreuve n'est plus nécessaire au-dessus du niveau indiqué", () => {
    const s = sortGrimoire('combat:boule-de-feu-mineure')!;
    expect(s.jusqua).toBe(6);
    expect(sortAutomatique(s, 6)).toBe(false);
    expect(sortAutomatique(s, 7)).toBe(true);
  });

  it('un paladin sans relique ne peut pas lancer ses prodiges ; il part avec celle de son dieu', () => {
    const pal = perso({ metierId: 'paladin', jets: { COU: 13, INT: 11, CHA: 12, AD: 11, FO: 12 }, magie: { ecoles: ['paladin-dlul'] } });
    expect(equipementDepart(pal).sac).toContain('relique-dlul');
    const p = nouvellePartie(pal);
    const s = sortsConnus(p).find((x) => x.effet.type === 'frappe')!;
    p.sac = p.sac.filter((o) => !o.startsWith('relique'));
    expect(lancerSort(p, s, 2)).toMatch(/relique/i);
  });

  it('une deuxième spécialité au niveau 5, avec le grimoire', () => {
    const p = nouvellePartie(perso({ magie: { ecoles: ['combat'] } }));
    p.sac.push('grimoire-feu');
    expect(grimoiresAEtudier(p)[0].refus).toMatch(/niveau 5/);
    p.xp = 2000;
    p.perso = { ...p.perso, progression: { niveau: 5, ev: 0, caracs: {}, at: 0, prd: 0 } };
    expect(etudierGrimoire(p, 'feu')).toMatch(/feu/);
    expect(sortsConnus(p).some((s) => s.ecole === 'feu')).toBe(true);
  });
});

describe('sorts en combat', () => {
  it('un bonus de groupe se pose sur tous les alliés, et un bonus de quelques assauts s’en va', () => {
    const p = nouvellePartie(perso({ metierId: 'pretre', magie: { ecoles: ['pretre-youclidh'] } }));
    const c = creerCombat(p, rencontre);
    const h = heros(c);
    const pr = h.pr;
    const armure = sortGrimoire('combat:armure-de-glace') ?? sortGrimoire('eau-glace:armure-de-glace')!;
    appliquerSort(c, { x: h, niveau: 1, bonusInt: 0, paDispo: 20 }, armure, 'heros', 'reussi');
    expect(h.pr).toBe(pr + 2);
    const bouclier = sortGrimoire('feu:coup-de-bouclier-de-flammes')!;
    const prd = h.prd;
    appliquerSort(c, { x: h, niveau: 1, bonusInt: 0, paDispo: 20 }, bouclier, 'heros', 'reussi');
    expect(h.prd).toBe(prd + 4);
    for (let i = 0; i < c.ordre.length; i++) tourSuivant(c);
    expect(h.prd).toBe(prd);
    expect(h.pr).toBe(pr + 2);
  });

  it('un malus entrave l’ennemi, et la résistance à la magie peut l’arrêter', () => {
    const p = nouvellePartie(perso({}));
    const c = creerCombat(p, rencontre);
    const e = c.combattants.find((x) => x.camp === 'ennemi')!;
    e.rm = 0;
    const s = sortGrimoire('tzinntch:compression-des-gonades')!;
    appliquerSort(c, { x: heros(c), niveau: 1, bonusInt: 0, paDispo: 20 }, s, e.id, 'reussi', () => 0.5);
    expect(e.rate).toBeGreaterThan(0);
    const autre = c.combattants.filter((x) => x.camp === 'ennemi')[1];
    autre.rm = 20;
    const r = appliquerSort(c, { x: heros(c), niveau: 1, bonusInt: 0, paDispo: 20 }, s, autre.id, 'reussi', () => 0.5);
    expect(r.lignes[0]).toMatch(/résiste/);
    expect(autre.rate).toBe(0);
  });

  it('un compagnon prêtre soigne le héros en danger', () => {
    const p = nouvellePartie(perso({ metierId: 'guerrier', ajustements: { guerrierEchange: 'aucun', guerrierBonus: 'AT' } }));
    p.compagnons = [{ id: 'anselme', ev: 20, evMax: 20 }];
    const c = creerCombat(p, rencontre);
    const a = c.combattants.find((x) => x.compagnon === 'anselme')!;
    expect(a.magie?.voie).toBe('pretre');
    heros(c).ev = 3;
    const plan = planSort(c, a, c.combattants.filter((x) => x.camp === 'ennemi'));
    expect(plan?.cible).toBe('heros');
    const avant = heros(c).ev;
    lancerSortAllie(c, a, plan!.sort!, 'heros', 5);
    expect(heros(c).ev).toBeGreaterThan(avant);
  });

  it('la valeur d’épreuve suit la caractéristique du sort (MagiePsy des prêtres)', () => {
    const p = nouvellePartie(perso({ metierId: 'pretre', magie: { ecoles: ['pretre-dlul'] } }));
    const s = sortsConnus(p).find((x) => x.carac === 'MagiePsy')!;
    expect(valeurSort(p, s)).toBe(13 + s.modif);
    expect(ea(p)).toBe(20);
  });
});
