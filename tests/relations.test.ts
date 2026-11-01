import { describe, expect, it } from 'vitest';
import type { Personnage } from '../src/rules/creation';
import { ajouterButin, partDue, payerPart, rancune, appreciation, discuter, garderButin, obeit, valeurObeissance, partagerButin, payerTournee, reagir, recruter, seuilDepart } from '../src/rules/compagnons';
import { bilanCompagnons, creerCombat, deplacer, heros, planifier, verifier } from '../src/rules/combat';
import { cite } from '../src/rules/cites';
import { donjon, entrerDonjon, fouiller, quitterDonjon, regler, repeuplement, REPEUPLEMENT } from '../src/rules/donjons';
import { dormir, nouvellePartie, type Partie } from '../src/rules/partie';
import { discuterPeage, fixerPeage, payerPeage, peageDu, totalPeage } from '../src/rules/peage';
import { TABLE_TERRES_SAUVAGES } from '../src/rules/rencontres';

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
  or: 200,
  jetsOr: [],
};

const avec = (...ids: string[]): Partie => {
  const p = nouvellePartie(perso);
  p.or = 500;
  for (const id of ids) recruter(p, id);
  return p;
};
const etat = (p: Partie, id: string) => p.compagnons!.find((e) => e.id === id)!;

describe('appréciation des compagnons', () => {
  it('part de 0, monte avec une victoire, baisse avec une fuite (sauf le prudent Gaston)', () => {
    const p = avec('gaston', 'bralk');
    expect(appreciation(etat(p, 'gaston'))).toBe(0);
    reagir(p, { type: 'victoire', betes: false, difficile: true });
    expect(appreciation(etat(p, 'gaston'))).toBe(1);
    expect(appreciation(etat(p, 'bralk'))).toBe(2); // la gloire : une grosse bagarre lui plaît double
    reagir(p, { type: 'fuite' });
    expect(appreciation(etat(p, 'gaston'))).toBe(1);
    expect(appreciation(etat(p, 'bralk'))).toBe(0);
  });

  it("Elwyn n'aime pas qu'on tue des bêtes", () => {
    const p = avec('elwyn');
    reagir(p, { type: 'victoire', betes: true, difficile: false });
    expect(appreciation(etat(p, 'elwyn'))).toBe(-1);
  });

  it('le partage du butin fait plaisir, le garder fâche (surtout le cupide)', () => {
    const p = avec('gaston', 'bralk');
    ajouterButin(p, 30);
    const or = p.or;
    partagerButin(p);
    expect(p.or).toBe(or - 20);
    expect(appreciation(etat(p, 'bralk'))).toBe(2);
    expect(appreciation(etat(p, 'gaston'))).toBe(1);
    ajouterButin(p, 30);
    garderButin(p);
    expect(appreciation(etat(p, 'bralk'))).toBe(-1);
    expect(p.butin).toBeUndefined();
  });

  it('un butin pas partagé avant la nuit compte comme gardé', () => {
    const p = avec('bralk');
    ajouterButin(p, 12);
    dormir(p, 'normal');
    // 6 PO, peu à côté de ses 40 PO d'embauche, mais Bralk est cupide.
    expect(appreciation(etat(p, 'bralk'))).toBe(-2);
    expect(etat(p, 'bralk').souvenirs?.[0].texte).toMatch(/sa part/);
    expect(p.butin).toBeUndefined();
  });

  it('on paie chacun sa part : les radins, et on garde celle des moins regardants', () => {
    const p = avec('gaston', 'bralk');
    ajouterButin(p, 30);
    expect(partDue(p, etat(p, 'bralk'))).toBe(10);
    expect(rancune(p, etat(p, 'bralk'))).toBe(3);
    expect(rancune(p, etat(p, 'gaston'))).toBeLessThan(3);
    const or = p.or;
    payerPart(p, etat(p, 'bralk'));
    expect(p.or).toBe(or - 10);
    expect(partDue(p, etat(p, 'bralk'))).toBe(0);
    expect(p.butin).toBe(10);
    const avant = appreciation(etat(p, 'gaston'));
    const r = rancune(p, etat(p, 'gaston'));
    garderButin(p);
    expect(appreciation(etat(p, 'gaston'))).toBe(avant - r);
    expect(p.butin).toBeUndefined();
  });

  it('seul, il n’y a rien à partager', () => {
    const p = avec();
    ajouterButin(p, 12);
    expect(p.butin).toBeUndefined();
  });

  it('une maladresse qui blesse gravement un compagnon coûte cher ; trop bas, il part', () => {
    const p = avec('bralk');
    expect(seuilDepart('bralk')).toBe(-4);
    const l = reagir(p, { type: 'frappe', id: 'bralk', grave: true });
    expect(l[0]).toMatch(/s'en va/);
    expect(p.compagnons).toEqual([]);
  });

  it('discuter rapporte une fois par jour, et pas au-delà de 3 ; la tournée plaît double aux gourmands', () => {
    const p = avec('gaston');
    const e = etat(p, 'gaston');
    expect(discuter(p, e).ligne).not.toBe('');
    expect(discuter(p, e).ligne).toBe('');
    expect(appreciation(e)).toBe(1);
    payerTournee(p, e);
    expect(appreciation(e)).toBe(3);
    expect(payerTournee(p, e)).toMatch(/déjà/);
  });

  it("obéit sur un D20 sous le Charisme du héros plus l'appréciation", () => {
    const p = avec('gaston');
    const e = etat(p, 'gaston');
    const v = valeurObeissance(p, e);
    expect(obeit(p, e, v)).toBe(true);
    expect(obeit(p, e, v + 1)).toBe(false);
    e.appreciation = 3;
    expect(valeurObeissance(p, e)).toBe(v + 3);
    expect(obeit(p, e, v + 3)).toBe(true);
    expect(obeit(p, e, 20)).toBe(false);
    expect(obeit(p, e, 1)).toBe(true);
  });

  it('un compagnon qui a reçu un ordre attaque la cible désignée', () => {
    const p = avec('bralk');
    const c = creerCombat(p, { ligne: TABLE_TERRES_SAUVAGES[8], nombre: 3, d20: 9 });
    const b = c.combattants.find((x) => x.compagnon === 'bralk')!;
    const ennemis = c.combattants.filter((x) => x.camp === 'ennemi');
    // Deux ennemis au contact de Bralk : sans ordre, il tape le plus amoché ; avec un ordre, celui qu'on lui désigne.
    const [x1, x2] = ennemis;
    for (const x of ennemis) x.x = 99;
    b.x = 5;
    b.y = 2;
    x1.x = 6;
    x1.y = 2;
    x1.ev = 30;
    x2.x = 6;
    x2.y = 3;
    x2.ev = 2;
    expect(planifier(c, b).cible).toBe(x2.id);
    c.ordres = { [b.id]: { ordre: 'cible', cible: x1.id } };
    expect(planifier(c, b).cible).toBe(x1.id);
    void deplacer;
  });
});

describe('donjons persistants', () => {
  it("ce qui est vidé et pillé le reste une semaine, même en ressortant", () => {
    const p = avec();
    const d = donjon('donjon-facile');
    const e = entrerDonjon(p, d.id);
    const coffre = d.salles.find((s) => s.tresor && s.contenu?.type === 'combat')!;
    const combat = coffre;
    regler(e, combat.id, p.jour);
    e.salle = coffre.id;
    e.vues.push(coffre.id);
    expect(fouiller(p)).not.toBeNull();
    quitterDonjon(p);
    expect(p.donjon).toBeUndefined();

    p.jour += REPEUPLEMENT - 1;
    const e2 = entrerDonjon(p, d.id);
    expect(e2.reglees).toContain(combat.id);
    expect(e2.fouillees).toContain(coffre.id);
    expect(e2.salle).toBe(d.entree);
    expect(repeuplement(e2)).toBe(p.jour + 1);
    quitterDonjon(p);

    p.jour += 1;
    const e3 = entrerDonjon(p, d.id);
    expect(e3.reglees).not.toContain(combat.id);
    expect(e3.fouillees).not.toContain(coffre.id);
    expect(e3.vues).toContain(coffre.id); // le plan, lui, reste en mémoire
  });

  it('le Donjon Facile repart de zéro quand on y tombe (on est secouru dehors)', () => {
    const p = avec();
    const e = entrerDonjon(p, 'donjon-facile');
    regler(e, 'couloir', p.jour);
    quitterDonjon(p, true);
    expect(entrerDonjon(p, 'donjon-facile').reglees).toEqual([]);
  });
});

describe("droits d'entrée", () => {
  it('Jambfer : 5 PO par personne, chaque compagnon paie sa place', () => {
    const p = avec('bralk');
    const c = cite('jambfer');
    expect(peageDu(p, c)).toBe(true);
    const g = fixerPeage(c);
    expect(totalPeage(p, g)).toBe(5);
    const or = p.or;
    expect(payerPeage(p, c, g)).toBeNull();
    expect(p.or).toBe(or - 5);
    expect(peageDu(p, c)).toBe(false);
    expect(peageDu(p, cite('valtordu'))).toBe(false);
  });

  it('Chnafon : le garde invente un prix, on peut le discuter', () => {
    const p = avec();
    const c = cite('chnafon');
    const g = fixerPeage(c, () => 0.5);
    expect(g.prix).toBe(6);
    expect(discuterPeage(p, g, 2).prix).toBe(3);
    expect(discuterPeage(p, g, 19).prix).toBe(6);
    expect(discuterPeage(p, g, 1).prix).toBe(0);
    expect(discuterPeage(p, g, 20).prix).toBe(8);
    p.or = 2;
    expect(payerPeage(p, c, g)).toMatch(/manque/);
    p.or = 50;
    expect(payerPeage(p, c, g)).toBeNull();
    p.peage = undefined;
    p.jour += 6;
    expect(peageDu(p, c)).toBe(false);
    p.jour += 2;
    expect(peageDu(p, c)).toBe(true);
  });
});

describe('mort des compagnons et du héros', () => {
  it('un compagnon tombé use un point de destin, puis meurt pour de bon', () => {
    const p = avec('gaston');
    const e = p.compagnons![0];
    e.destin = 1;
    const c = creerCombat(p, { ligne: TABLE_TERRES_SAUVAGES[8], nombre: 1, d20: 9 });
    const x = c.combattants.find((y) => y.compagnon === 'gaston')!;
    x.ev = -3;
    expect(bilanCompagnons(c, p)[0]).toMatch(/destin/);
    expect(e.ev).toBe(1);
    expect(e.destin).toBe(0);
    const c2 = creerCombat(p, { ligne: TABLE_TERRES_SAUVAGES[8], nombre: 1, d20: 9 });
    c2.combattants.find((y) => y.compagnon === 'gaston')!.ev = 0;
    expect(bilanCompagnons(c2, p)[0]).toMatch(/mort/);
    expect(p.compagnons).toEqual([]);
  });

  it('un compagnon recruté reçoit 1D4−1 points de destin', () => {
    const p = avec('gaston');
    expect(p.compagnons![0].destin).toBeGreaterThanOrEqual(0);
    expect(p.compagnons![0].destin).toBeLessThanOrEqual(3);
  });

  it('le héros tombé, ses compagnons continuent ; le combat finit quand un camp est à terre', () => {
    const p = avec('gaston');
    const c = creerCombat(p, { ligne: TABLE_TERRES_SAUVAGES[8], nombre: 1, d20: 9 });
    heros(c).ev = 0;
    verifier(c);
    expect(c.fin).toBeUndefined();
    for (const x of c.combattants) if (x.camp === 'ennemi') x.ev = 0;
    verifier(c);
    expect(c.fin).toBe('defaite');
    expect(c.vengeance).toBe(true);
  });
});
