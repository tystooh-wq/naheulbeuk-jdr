import { describe, expect, it } from 'vitest';
import type { Personnage } from '../src/rules/creation';
import { attaquer, creerCombat, heros, tenterFuite } from '../src/rules/combat';
import { bivouaquer, nouvellePartie, valeursCombat } from '../src/rules/partie';
import { TABLE_TERRES_SAUVAGES, tactiquesPossibles, valeurTactique } from '../src/rules/rencontres';
import { bonusSituation, empechement, priseCompetence, TALENTS_ACTIFS, utiliserTalent } from '../src/rules/talents';

const perso = (competencesChoisies: string[]): Personnage => ({
  version: 1,
  nom: 'Test',
  sexe: 'Femme',
  jets: { COU: 12, INT: 13, CHA: 10, AD: 12, FO: 13 },
  origineId: 'humain',
  metierId: 'guerrier',
  competencesChoisies,
  ajustements: { guerrierEchange: 'aucun', guerrierBonus: 'AT' },
  destin: 1,
  or: 50,
  jetsOr: [[2, 3]],
});

const rencontre = { ligne: TABLE_TERRES_SAUVAGES[0], d20: 1, nombre: 1 };

describe('compétences', () => {
  it('Radin et Fariboles ne se cumulent pas au marchandage', () => {
    const p = nouvellePartie(perso(['Radin', 'Fariboles']));
    expect(bonusSituation(p, 'marchandage')).toEqual({ total: 4, details: ['+4 Radin'] });
    expect(valeurTactique(p, 'negocier')).toBe(valeursCombat(p).cha + 3);
  });

  it('Truc de mauviette : +1 PR, même contre un critique ; Vicieux ignore 1 point', () => {
    const p = nouvellePartie(perso(['Truc de mauviette']));
    const sans = nouvellePartie(perso([]));
    expect(valeursCombat(p).pr).toBe(valeursCombat(sans).pr + 1);
    const c = creerCombat(p, rencontre);
    const e = c.combattants.find((x) => x.camp === 'ennemi')!;
    const a = attaquer(c, e.id, 'heros', 1, { desDegats: [6] });
    expect(a.degats!.pr).toBe(1);
  });

  it('Appel des renforts : la fuite réussit sans épreuve', () => {
    const c = creerCombat(nouvellePartie(perso(['Appel des renforts'])), rencontre);
    expect(tenterFuite(c, 20)).toBe(true);
    expect(heros(c).talents?.renforts).toBe(true);
  });

  it('Intimider : nouvelle tactique contre un adversaire moins courageux', () => {
    const p = nouvellePartie(perso(['Intimider']));
    const l = { ...TABLE_TERRES_SAUVAGES[0], cou: 2 };
    expect(tactiquesPossibles(p, l)).toContain('menacer');
    expect(tactiquesPossibles(p, { ...l, cou: 30 })).not.toContain('menacer');
  });

  it('Premiers soins : une fois par heure, et seulement blessé', () => {
    const p = nouvellePartie(perso(['Premiers soins']));
    const t = TALENTS_ACTIFS.find((x) => x.id === 'premiers-soins')!;
    expect(empechement(p, t, 'monde')).toBe('Tu es en pleine forme.');
    p.ev -= 5;
    expect(empechement(p, t, 'monde')).toBeNull();
    utiliserTalent(p, 'premiers-soins', 1, () => 0.99);
    expect(p.ev).toBeGreaterThan(0);
    expect(empechement(p, t, 'monde')).toMatch(/heure/);
  });

  it('Mendier : en ville seulement, une fois par jour', () => {
    const p = nouvellePartie(perso(['Mendier et pleurnicher']));
    const t = TALENTS_ACTIFS.find((x) => x.id === 'mendier')!;
    expect(empechement(p, t, 'monde')).toBe('pas ici');
    const or = p.or;
    utiliserTalent(p, 'mendier', 12);
    expect(p.or).toBe(or + 12);
    expect(empechement(p, t, 'ville')).toMatch(/aujourd/);
  });

  it('Camping réussi : +2 PV à la nuit', () => {
    const a = nouvellePartie(perso(['Camping tout-terrain']));
    const b = nouvellePartie(perso([]));
    a.ev = b.ev = 5;
    utiliserTalent(a, 'camping', 1);
    expect(a.campQualite).toBe(true);
    expect(bivouaquer(a).rendu).toBe(bivouaquer(b).rendu + 2);
  });

  it('chaque compétence a un statut lisible', () => {
    expect(priseCompetence('Tirer correctement')[0]).toBe('auto');
    expect(priseCompetence('Nager')[0]).toBe('non');
  });
});

describe('énergie astrale', () => {
  it("au passage de niveau, le D6 peut aller à l'EA ; les potions de mana la rechargent", async () => {
    const { monterNiveau, boirePotion } = await import('../src/rules/partie');
    const { eaMax, ea } = await import('../src/rules/magie');
    const p = nouvellePartie({ ...perso([]), metierId: 'mage', jets: { COU: 10, INT: 13, CHA: 12, AD: 12, FO: 9 } });
    const avant = eaMax(p);
    expect(avant).toBeGreaterThan(0);
    p.xp = 100;
    expect(monterNiveau(p, 4, 'INT', true)).toBeNull();
    expect(eaMax(p)).toBe(avant + 4);
    expect(ea(p)).toBe(avant + 4);
    p.ea = 0;
    p.sac.push('potion-de-mana-des-bitos');
    expect(boirePotion(p, 'potion-de-mana-des-bitos')).toMatchObject({ rendu: 5, pa: true });
  });
});
