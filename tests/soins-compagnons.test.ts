import { describe, expect, it } from 'vitest';
import type { Personnage } from '../src/rules/creation';
import { cite as citeParId } from '../src/rules/cites';
import { BLESSURES } from '../src/rules/critiques';
import { nouvellePartie } from '../src/rules/partie';
import { payerSoins, refuserSoins, soinsEnVille } from '../src/rules/soins-compagnons';
import { valeursCompagnon } from '../src/rules/compagnons';

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

const partie = () => {
  const p = nouvellePartie(perso);
  const genou = { ...BLESSURES['genou-luxe'], jusqua: p.jour + 7 };
  p.compagnons = [
    { id: 'gaston', ev: 20, evMax: 28, bourse: 0, blessures: [genou] },
    { id: 'elwyn', ev: 20, evMax: 20, bourse: 40 },
    { id: 'bralk', ev: 20, evMax: 20, bourse: 100 },
  ];
  return p;
};

describe('soins des compagnons', () => {
  it('ses blessures pèsent sur ses valeurs, pas sur celles du héros', () => {
    const p = partie();
    const [gaston, elwyn] = p.compagnons!;
    const sans = valeursCompagnon(p, { ...gaston, blessures: [] });
    expect(valeursCompagnon(p, gaston).at).toBe(sans.at - 1);
    p.blessures = [{ ...BLESSURES['genou-luxe'], jusqua: p.jour + 7 }];
    expect(valeursCompagnon(p, elwyn).at).toBe(valeursCompagnon({ ...p, blessures: [] }, elwyn).at);
  });

  it('rien dans les villages', () => {
    expect(soinsEnVille(partie(), citeParId('valtordu')!).demandes).toHaveLength(0);
  });

  it('sans le sou : le chapeau passe, le cupide ne donne rien, le héros complète', () => {
    const p = partie();
    const { demandes, lignes } = soinsEnVille(p, citeParId('waldorg')!);
    expect(lignes).toHaveLength(0);
    const d = demandes[0];
    expect(d.id).toBe('gaston');
    expect(d.dons.find((x) => x.id === 'bralk')!.montant).toBe(0);
    expect(d.dons.find((x) => x.id === 'elwyn')!.montant).toBeGreaterThan(0);
    const or = p.or;
    payerSoins(p, d);
    expect(p.or).toBe(or - d.reste);
    expect(p.compagnons![0].blessures![0].soignee).toBe(true);
  });

  it('refuser : il garde ses blessures et ne redemande pas le même jour', () => {
    const p = partie();
    const d = soinsEnVille(p, citeParId('waldorg')!).demandes[0];
    refuserSoins(p, d);
    expect(p.compagnons![0].appreciation).toBe(-1);
    expect(soinsEnVille(p, citeParId('waldorg')!).demandes).toHaveLength(0);
  });

  it('avec de quoi payer : il y va tout seul', () => {
    const p = partie();
    p.compagnons![0].bourse = 200;
    const { demandes, lignes } = soinsEnVille(p, citeParId('waldorg')!);
    expect(demandes).toHaveLength(0);
    expect(lignes[0]).toContain('Gaston');
    expect(p.compagnons![0].bourse).toBeLessThan(200);
  });
});

describe('compagnon mage', () => {
  it('Berthe lance ses sorts de combat et dépense son énergie astrale', async () => {
    const { creerCombat, planifier, lancerSortAllie, combattant } = await import('../src/rules/combat');
    const { TABLE_TERRES_SAUVAGES } = await import('../src/rules/rencontres');
    const p = nouvellePartie(perso);
    p.compagnons = [{ id: 'berthe', ev: 20, evMax: 20 }];
    const c = creerCombat(p, { ligne: TABLE_TERRES_SAUVAGES[0], nombre: 1 } as never);
    const b = c.combattants.find((x) => x.compagnon === 'berthe')!;
    expect(b.magie?.sorts.length).toBeGreaterThan(0);
    const plan = planifier(c, b);
    expect(plan.sort).toBeDefined();
    const ea = b.magie!.ea;
    const r = lancerSortAllie(c, b, plan.sort!, plan.cible!, 2);
    expect(b.magie!.ea).toBeLessThan(ea);
    expect(r.actions.length).toBe(1);
    expect(combattant(c, plan.cible!).ev).toBeLessThanOrEqual(combattant(c, plan.cible!).evMax);
  });
});
