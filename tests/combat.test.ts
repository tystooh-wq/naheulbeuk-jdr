import { describe, expect, it } from 'vitest';
import { avecDe } from '../src/rules/des';
import {
  attaquer,
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

  it("pas plus de trois ennemis sur le même combattant : le quatrième contourne s'il peut", () => {
    const c = creerCombat(nouvellePartie(perso), { ...rencontre(9, 4), surprise: true });
    const h = heros(c);
    h.x = 0;
    h.y = 0;
    // Trois orques collés au héros dans son coin : il n'y a plus de place pour le quatrième.
    const [a, b, d, e] = c.combattants.filter((x) => x.camp === 'ennemi');
    Object.assign(a, { x: 1, y: 0 });
    Object.assign(b, { x: 0, y: 1 });
    Object.assign(d, { x: 1, y: 1 });
    Object.assign(e, { x: 4, y: 3 });
    expect(contacts(c, h)).toHaveLength(3);
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
    const a = attaquer(c, 'e2', 'heros', 3, { desDegats: [6] });
    expect(a.sansDefense).toMatch(/déjà/);
    expect(a.degats!.blessure).toBe(6 + 4 - heros(c).pr);
    // Nouvel assaut : on peut de nouveau se défendre.
    c.ordre.forEach(() => tourSuivant(c));
    expect(heros(c).defendu).toBe(false);
  });

  it("esquiver fait rater l'attaque suivante", () => {
    const c = creerCombat(nouvellePartie(perso), rencontre(1, 1));
    const a = attaquer(c, 'e1', 'heros', 3, { defense: { mode: 'esquive', de: 2 } });
    expect(a.defense).toMatchObject({ mode: 'esquive', issue: 'reussi' });
    expect(heros(c).rate).toBe(1);
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
    expect(a.degats!.blessure).toBe(Math.max(0, 4 - heros(c).pr));
  });
});
