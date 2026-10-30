import { describe, expect, it } from 'vitest';
import type { Personnage } from '../src/rules/creation';
import { metierParId, origineParId, raisonsMetier, raisonsOrigine, reservesCompetences, scoresApresOrigine } from '../src/rules/creation';
import { COMPAGNONS, ficheCompagnon, recruter, valeursCompagnon } from '../src/rules/compagnons';
import { creerCombat, planifier } from '../src/rules/combat';
import { EVENEMENTS } from '../src/rules/evenements';
import { nouvellePartie } from '../src/rules/partie';
import { TABLE_TERRES_SAUVAGES } from '../src/rules/rencontres';
import { accepterQuete, validerEtape } from '../src/rules/quetes';

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
  jetsOr: [],
};

describe('compagnons', () => {
  it('chaque compagnon respecte les règles de création (critères, compétences au choix)', () => {
    for (const c of COMPAGNONS) {
      const o = origineParId(c.perso.origineId);
      const m = metierParId(c.perso.metierId);
      expect(raisonsOrigine(c.perso.jets, o), c.id).toEqual([]);
      expect(raisonsMetier(scoresApresOrigine(c.perso.jets, o), o, m), c.id).toEqual([]);
      const reserves = reservesCompetences(o, m, [...o.naissance, ...m.heritees]);
      const options = reserves.flatMap((r) => r.options);
      for (const n of c.perso.competencesChoisies) expect(options, `${c.id} : ${n}`).toContain(n);
      expect(c.perso.competencesChoisies).toHaveLength(reserves.reduce((s, r) => s + r.nombre, 0));
    }
  });

  it('les fiches tiennent la route', () => {
    expect(ficheCompagnon('gaston')).toMatchObject({ ev: 28, at: 7, prd: 8 });
    expect(ficheCompagnon('bralk')).toMatchObject({ ev: 40, at: 9, prd: 10 });
    expect(ficheCompagnon('elwyn').ev).toBe(25);
  });

  it("Bralk s'engage contre 40 PO ; il combat aux côtés du héros", () => {
    const p = nouvellePartie(perso);
    p.or = 39;
    expect(recruter(p, 'bralk')).toMatch(/40/);
    p.or = 100;
    expect(recruter(p, 'bralk')).toBeNull();
    expect(p.or).toBe(60);
    const v = valeursCompagnon(p, p.compagnons![0]);
    expect(v.degats).toBe('1D+5');
    const c = creerCombat(p, { ligne: TABLE_TERRES_SAUVAGES[8], nombre: 1, d20: 9 });
    const b = c.combattants.find((x) => x.compagnon === 'bralk')!;
    expect(b.camp).toBe('heros');
    expect(planifier(c, b).vers).toBeDefined();
  });

  it('Gaston rejoint le groupe à la fin de la quête du boudin Plandu', () => {
    const p = nouvellePartie(perso);
    accepterQuete(p, 'secret-boudin');
    validerEtape(p, 'secret-boudin');
    const fin = validerEtape(p, 'secret-boudin');
    expect(fin.finie).toBe(true);
    expect(p.compagnons?.map((c) => c.id)).toEqual(['gaston']);
  });

  it("l'écureuil mène aux elfes, et les aider fait combattre deux elfes à tes côtés", () => {
    const p = nouvellePartie(perso);
    const ev = EVENEMENTS.find((e) => e.id === 'ecureuil')!;
    const r = ev.choix[2].effet(p);
    expect(r.suite?.id).toBe('elfes-en-difficulte');
    const aide = r.suite!.choix[0].effet(p);
    const c = creerCombat(p, aide.combat!.rencontre);
    expect(c.combattants.filter((x) => x.allie)).toHaveLength(2);
    expect(c.combattants.filter((x) => x.camp === 'ennemi')).toHaveLength(4);
    expect(aide.combat!.victoire!(p)).toMatch(/Elwyn/);
    expect(p.compagnons?.some((x) => x.id === 'elwyn')).toBe(true);
  });
});
