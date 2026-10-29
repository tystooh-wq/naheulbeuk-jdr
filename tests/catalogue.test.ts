import { describe, expect, it } from 'vitest';
import { fouiller, TABLES_BUTIN } from '../src/rules/butin';
import type { Personnage } from '../src/rules/creation';
import { lireMods, objet, OBJETS } from '../src/rules/objets';
import { equiper, nouvellePartie, protectionTotale, valeursCombat } from '../src/rules/partie';

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
  or: 50,
  jetsOr: [[2, 3]],
};

describe('catalogue complet', () => {
  it('plus de 700 objets, identifiants uniques', () => {
    expect(OBJETS.length).toBeGreaterThan(700);
    expect(new Set(OBJETS.map((o) => o.id)).size).toBe(OBJETS.length);
  });

  it('les objets décrits à la main ne sont pas en double', () => {
    expect(OBJETS.filter((o) => o.nom === 'Dague de base')).toHaveLength(1);
    expect(objet('dague-base').source).toBe('Armement V2.3');
  });

  it('armes et protections du tableau sont converties', () => {
    expect(objet('hache-1-main-daubesque')).toMatchObject({ type: 'arme', degats: '1D+3', mods: { CHA: -1, PRD: -2 } });
    expect(objet('casque-de-metal-de-base')).toMatchObject({ type: 'armure', pr: 1, emplacement: 'tete', mods: { CHA: -1, AD: -1, COU: 1 } });
    expect(objet('bouclier-de-base')).toMatchObject({ emplacement: 'bouclier', mods: { AD: -1, AT: -2, PRD: 1 } });
    expect(objet('potion-de-courage-d-ulgur').type).toBe('potion');
  });

  it('les modificateurs conditionnels sont ignorés', () => {
    expect(lireMods('AT-1 PRD-3 · AD+4* CHA+1')).toEqual({ AT: -1, PRD: -3, CHA: 1 });
    expect(lireMods('PRD-2 / Nain : PRD-1 · Nain : AT+1')).toEqual({ PRD: -2 });
    expect(lireMods('AD+1 (discrétion)')).toBeUndefined();
    expect(lireMods('AT/PRD+2')).toEqual({ AT: 2, PRD: 2 });
  });
});

describe('équipement par localisation', () => {
  it('casque et plastron se cumulent', () => {
    const p = nouvellePartie(perso);
    p.equipe.armure = undefined;
    p.sac.push('plastron-cuir', 'casque-de-metal-de-base');
    expect(equiper(p, 'plastron-cuir')).toBeNull();
    expect(equiper(p, 'casque-de-metal-de-base')).toBeNull();
    expect(protectionTotale(p)).toBe(4);
    expect(valeursCombat(p).pr).toBe(4);
  });

  it("pas de bouclier avec une arme à deux mains", () => {
    const p = nouvellePartie(perso);
    p.sac.push('lance-base', 'bouclier-de-base');
    expect(equiper(p, 'lance-base')).toBeNull();
    expect(equiper(p, 'bouclier-de-base')).toMatch(/deux mains/);
  });

  it('une armure complète remplace les pièces séparées', () => {
    const p = nouvellePartie(perso);
    p.sac.push('casque-de-cuir', 'set-armure-de-cuir-orque-troupier');
    equiper(p, 'casque-de-cuir');
    expect(equiper(p, 'set-armure-de-cuir-orque-troupier')).toBeNull();
    expect(p.equipe.tete).toBeUndefined();
    expect(p.sac).toContain('casque-de-cuir');
  });
});

describe('butin', () => {
  it('toutes les tables renvoient à des objets existants', () => {
    for (const t of TABLES_BUTIN) for (const l of t.lots) if (l.objet) expect(() => objet(l.objet!)).not.toThrow();
  });

  it('un brigand a toujours un peu d’or', () => {
    const f = fouiller('Brigand de base 1', () => 0.6);
    expect(f.or).toBeGreaterThan(0);
    expect(f.de).toBe(13);
    expect(f.objet).toBe('epee-perrave');
  });

  it('une bête inconnue ne donne rien', () => {
    expect(fouiller('Machin bizarre')).toEqual({ ennemi: 'Machin bizarre', or: 0 });
  });
});
