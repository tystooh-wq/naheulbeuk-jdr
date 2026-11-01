import { describe, expect, it } from 'vitest';
import { avecDe } from '../src/rules/des';
import {
  attaquer,
  degres,
  ecart,
  opportunites,
  auContact,
  contacts,
  planifier,
  creerCombat,
  creerEnnemis,
  heros,
  initiative,
  modEsquive,
  panique,
  tourSuivant,
  verifier,
  xpGagnee,
  combattant,
} from '../src/rules/combat';
import type { Personnage } from '../src/rules/creation';
import { nouvellePartie } from '../src/rules/partie';
import { TABLE_TERRES_SAUVAGES, type Rencontre } from '../src/rules/rencontres';

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

const ligne = (d20: number) => TABLE_TERRES_SAUVAGES[d20 - 1];
const rencontre = (d20: number, nombre: number): Rencontre => ({ ligne: ligne(d20), nombre, d20 });
/** Un générateur qui rend toujours la même face. */
const fixe = (face: number, faces = 6) => () => (face - 0.5) / faces;

describe('mise en place', () => {
  it('le plus courageux frappe le premier, l’Adresse départage', () => {
    const cs = [
      { id: 'a', cou: 10, ad: 9, camp: 'heros' },
      { id: 'b', cou: 12, ad: 5, camp: 'ennemi' },
      { id: 'c', cou: 10, ad: 12, camp: 'ennemi' },
    ] as never[];
    expect(initiative(cs)).toEqual(['b', 'c', 'a']);
    expect(initiative(cs, true)).toEqual(['a', 'b', 'c']);
  });

  it('les deux camps se font face ; surprise : les ennemis au contact et premiers', () => {
    const c = creerCombat(nouvellePartie(perso), rencontre(9, 4));
    expect(c.combattants.filter((x) => x.camp === 'ennemi').every((x) => x.etat === 'actif' && x.x === 6)).toBe(true);
    expect(auContact(c)).toHaveLength(0);
    const s = creerCombat(nouvellePartie(perso), { ...rencontre(9, 2), surprise: true });
    expect(s.ordre.slice(0, 2)).toEqual(['e1', 'e2']);
    expect(auContact(s).length).toBeGreaterThan(0);
  });

  it("un héros acculé dans un coin : ceux qui n'ont plus de place ne peuvent pas le frapper", () => {
    const c = creerCombat(nouvellePartie(perso), { ...rencontre(9, 4), surprise: true });
    const h = heros(c);
    h.x = 0;
    h.y = 0;
    // Dans le coin, une case hexagonale n'a que deux voisines : il n'y a plus de place pour les autres.
    const [a, b, d, e] = c.combattants.filter((x) => x.camp === 'ennemi');
    Object.assign(a, { x: 1, y: 0 });
    Object.assign(b, { x: 0, y: 1 });
    Object.assign(d, { x: 6, y: 5 });
    Object.assign(e, { x: 4, y: 3 });
    expect(contacts(c, h)).toHaveLength(2);
    expect(planifier(c, a).cible).toBe('heros');
    expect(planifier(c, e).cible).not.toBe('heros');
  });

  it('le bouc ne se pare pas, le scorpion empoisonne', () => {
    expect(creerEnnemis(rencontre(1, 1))[0]).toMatchObject({ imparable: true, nom: 'Bouc en colère' });
    expect(creerEnnemis(rencontre(4, 2))[0]).toMatchObject({ poison: true, degats: '1D-1' });
  });

  it("l'esquive dépend de l'armure", () => {
    expect([0, 2, 3, 5, 7, 8].map(modEsquive)).toEqual([1, 0, -2, -4, -6, null]);
  });
});

describe('un assaut', () => {
  it('attaque réussie, parade ratée : dégâts moins la PR', () => {
    const c = creerCombat(nouvellePartie(perso), rencontre(9, 1));
    const orque = combattant(c, 'e1');
    const a = attaquer(c, 'heros', 'e1', 5, { rng: () => 0.99, desDegats: [4] });
    // L'orque a tiré 20 en parade (rng à 0.99) : maladresse, puis il encaisse.
    expect(a.issue).toBe('reussi');
    expect(a.defense).toMatchObject({ mode: 'parade', issue: 'maladresse' });
    expect(a.degats!.pr).toBe(2);
    expect(orque.ev).toBeLessThan(15);
  });

  it("l'attaque critique ignore la parade et l'armure", () => {
    const c = creerCombat(nouvellePartie(perso), rencontre(9, 1));
    const a = attaquer(c, 'heros', 'e1', 1, { desDegats: [3] });
    expect(a.issue).toBe('critique');
    expect(a.defense).toBeUndefined();
    expect(a.degats!.pr).toBe(0);
  });

  it('une seule défense par assaut', () => {
    const c = creerCombat(nouvellePartie(perso), rencontre(9, 2));
    attaquer(c, 'e1', 'heros', 3, { defense: { mode: 'parade', de: 2 } });
    expect(heros(c).defendu).toBe(true);
    // Règles V2 : la parade de l'assaut sert aussi contre la deuxième attaque, sans nouveau jet.
    const a = attaquer(c, 'e2', 'heros', 3, { desDegats: [6] });
    expect(a.defense).toMatchObject({ reprise: true, de: 2 });
    expect(a.opposition!.degresDefense).toBe(degres(heros(c).prd - 2));
    // Nouvel assaut : on peut de nouveau se défendre.
    c.ordre.forEach(() => tourSuivant(c));
    expect(heros(c).defendu).toBe(false);
  });

  it('esquiver fait reculer de deux cases, loin de l’attaquant', () => {
    const c = creerCombat(nouvellePartie(perso), rencontre(1, 1));
    const e = combattant(c, 'e1');
    Object.assign(heros(c), { x: 5, y: 3 });
    Object.assign(e, { x: 6, y: 3 });
    const a = attaquer(c, 'e1', 'heros', 3, { defense: { mode: 'esquive', de: 2 } });
    expect(a.defense).toMatchObject({ mode: 'esquive', issue: 'reussi' });
    expect(ecart(heros(c), e)).toBe(3);
    expect(heros(c).rate).toBe(0);
  });

  it("quitter le contact offre une attaque d'opportunité", () => {
    const c = creerCombat(nouvellePartie(perso), rencontre(9, 1));
    const e = combattant(c, 'e1');
    Object.assign(heros(c), { x: 5, y: 3 });
    Object.assign(e, { x: 6, y: 3 });
    expect(opportunites(c, 'heros', 4, 3).map((x) => x.id)).toEqual(['e1']);
    // Rester à son contact (case voisine de l'orque) : pas d'attaque gratuite.
    expect(opportunites(c, 'heros', 6, 2)).toEqual([]);
  });

  it('parade critique : D20 sur la table, 3 à 5 : l’attaquant est repoussé et rate son prochain assaut', () => {
    const c = creerCombat(nouvellePartie(perso), rencontre(9, 1));
    const a = attaquer(c, 'e1', 'heros', 3, { defense: { mode: 'parade', de: 1 }, rng: avecDe(4, 20) });
    expect(a.tables).toEqual([expect.objectContaining({ lanceur: 'heros', table: 'Parade critique', de: 4 })]);
    expect(combattant(c, 'e1').rate).toBe(1);
  });
});

describe('fin du combat', () => {
  it('tous les ennemis à terre : victoire et XP', () => {
    const c = creerCombat(nouvellePartie(perso), rencontre(9, 4));
    combattant(c, 'e1').ev = 0;
    verifier(c);
    expect(c.fin).toBeUndefined();
    for (const id of ['e2', 'e3', 'e4']) combattant(c, id).ev = 0;
    verifier(c);
    expect(c.fin).toBe('victoire');
    expect(xpGagnee(c)).toBe(4 * 8);
  });

  it('un monstre à bout de souffle peut fuir', () => {
    const c = creerCombat(nouvellePartie(perso), rencontre(9, 1));
    const o = combattant(c, 'e1');
    o.ev = 3;
    expect(panique(c, o, fixe(2))).toBe(true);
    expect(c.fin).toBe('victoire');
    expect(xpGagnee(c)).toBe(8);
  });

  it('le héros à 0 PV : défaite', () => {
    const c = creerCombat(nouvellePartie(perso), rencontre(11, 1));
    heros(c).ev = -2;
    verifier(c);
    expect(c.fin).toBe('defaite');
    expect(heros(c).ev).toBe(0);
  });
});

describe('encaisser', () => {
  it('on prend le coup sans défense, mais on garde son attaque', () => {
    const c = creerCombat(nouvellePartie(perso), rencontre(1, 1));
    const a = attaquer(c, 'e1', 'heros', 3, { encaisser: true, desDegats: [4] });
    expect(a.defense).toBeUndefined();
    expect(a.sansDefense).toMatch(/encaisse/);
    expect(heros(c).rate).toBe(0);
    // Sans défense : 0 degré ; l'écart s'ajoute aux dégâts.
    expect(a.opposition).toMatchObject({ degresDefense: 0, passe: true });
    expect(a.degats!.blessure).toBe(Math.max(0, 4 + a.opposition!.bonus - heros(c).pr));
  });
});

describe('règles V2 : attaque et défense en opposition', () => {
  it('degrés : marge ÷ 2 arrondie vers zéro', () => {
    expect([2, 0, -1, -9, -10, 7, -11].map(degres)).toEqual([1, 0, 0, -4, -5, 3, -5]);
  });

  const duel = (at: number, prd: number) => {
    const c = creerCombat(nouvellePartie(perso), rencontre(9, 1));
    Object.assign(combattant(c, 'e1'), { at });
    Object.assign(heros(c), { prd, pr: 0 });
    return c;
  };

  it('exemple 2 de la feuille : attaque ratée de 1, défense catastrophique → touché, +4', () => {
    const c = duel(5, 8);
    const a = attaquer(c, 'e1', 'heros', 6, { defense: { mode: 'parade', de: 19 }, desDegats: [3] });
    expect(a.opposition).toMatchObject({ degresAttaque: 0, degresDefense: -5, passe: true, bonus: 5 });
    expect(a.degats!.total).toBe(3 + 5 + Number(/[+-]\d+$/.exec(combattant(c, 'e1').degats)?.[0] ?? 0));
  });

  it("égalité : la défense gagne ; défense réussie et plus haute : paré", () => {
    const c = duel(9, 9);
    const a = attaquer(c, 'e1', 'heros', 2, { defense: { mode: 'parade', de: 2 } });
    expect(a.opposition).toMatchObject({ degresAttaque: 3, degresDefense: 3, passe: false });
    expect(a.degats).toBeUndefined();
  });

  it('défense ratée de peu (0 degré) : le coup passe avec l’écart en bonus (exemple 7)', () => {
    const c = duel(9, 9);
    const a = attaquer(c, 'e1', 'heros', 2, { defense: { mode: 'parade', de: 10 }, desDegats: [1] });
    expect(a.opposition).toMatchObject({ degresAttaque: 3, degresDefense: 0, defenseRatee: true, passe: true, bonus: 3 });
  });
});
