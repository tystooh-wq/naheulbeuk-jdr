import { describe, expect, it } from 'vitest';
import {
  calculerFiche,
  metierParId,
  origineParId,
  raisonsMetier,
  raisonsOrigine,
  reservesCompetences,
  trouverCompetence,
  type Personnage,
} from '../src/rules/creation';
import { METIERS } from '../src/rules/metiers';
import { ORIGINES } from '../src/rules/origines';
import type { Scores } from '../src/rules/types';
import { VILLE_DEPART } from '../src/rules/villes';

const scores = (COU: number, INT: number, CHA: number, AD: number, FO: number): Scores => ({ COU, INT, CHA, AD, FO });

const perso = (p: Partial<Personnage>): Personnage => ({
  version: 1,
  nom: 'Test',
  sexe: 'Homme',
  jets: scores(10, 10, 10, 10, 10),
  origineId: 'humain',
  metierId: 'aucun',
  competencesChoisies: [],
  ajustements: {},
  destin: 1,
  or: 70,
  jetsOr: [[3, 4]],
  ...p,
});

describe('critères des origines', () => {
  it("l'Humain est toujours possible", () => {
    expect(raisonsOrigine(scores(8, 8, 8, 8, 8), origineParId('humain'))).toEqual([]);
  });

  it('le Barbare demande COU 12 et FO 13', () => {
    expect(raisonsOrigine(scores(12, 8, 8, 8, 13), origineParId('barbare'))).toEqual([]);
    expect(raisonsOrigine(scores(11, 8, 8, 8, 12), origineParId('barbare'))).toEqual(['Courage 12 minimum', 'Force 13 minimum']);
  });

  it("l'Orque refuse les intelligents", () => {
    expect(raisonsOrigine(scores(10, 9, 8, 10, 12), origineParId('orque'))).toEqual(['Intelligence 8 maximum']);
  });

  it('chaque origine a une ville de départ', () => {
    for (const o of ORIGINES) expect(VILLE_DEPART[o.id], o.id).toBeTruthy();
  });
});

describe('critères des métiers', () => {
  it('un Nain ne peut pas être mage', () => {
    expect(raisonsMetier(scores(12, 13, 10, 10, 13), origineParId('nain'), metierParId('mage'))).toContain(
      'un Nain ne pratique pas la magie',
    );
  });

  it('le Traîne-patins est ouvert à tous', () => {
    expect(raisonsMetier(scores(8, 8, 8, 8, 8), origineParId('gobelin'), metierParId('traine-patins'))).toEqual([]);
  });
});

describe('fiche calculée', () => {
  it('un Humain sans métier : AT 8, PRD 10, EV 30', () => {
    const f = calculerFiche(perso({}));
    expect([f.at, f.prd, f.ev, f.rm, f.bonusDegats, f.ville]).toEqual([8, 10, 30, 10, 0, 'Waldorg']);
  });

  it('un Barbare guerrier : EV 35+5, AT/PRD 9/9 puis ajustements', () => {
    const f = calculerFiche(
      perso({
        origineId: 'barbare',
        metierId: 'guerrier',
        jets: scores(12, 9, 9, 10, 13),
        ajustements: { guerrierEchange: 'PRD>AT', guerrierBonus: 'AT' },
      }),
    );
    expect([f.ev, f.at, f.prd, f.bonusDegats]).toEqual([40, 11, 8, 1]);
  });

  it("l'Adresse > 12 donne +1 en AT ou PRD, sauf pour l'assassin", () => {
    expect(calculerFiche(perso({ jets: scores(10, 10, 10, 13, 10), ajustements: { adresse: 'PRD' } })).prd).toBe(11);
    const assassin = calculerFiche(
      perso({ jets: scores(10, 10, 10, 13, 10), metierId: 'assassin', ajustements: { adresse: 'AT' } }),
    );
    expect([assassin.at, assassin.prd]).toEqual([11, 8]);
  });

  it("le mage non humain perd 30 % d'EV", () => {
    const f = calculerFiche(perso({ origineId: 'haut-elfe', metierId: 'mage', jets: scores(10, 12, 12, 12, 10) }));
    expect([f.ev, f.ea, f.prMax]).toEqual([18, 30, 2]);
  });

  it("l'Homme-Bête applique sa version", () => {
    const f = calculerFiche(perso({ origineId: 'homme-bete', versionHB: 4, jets: scores(10, 9, 9, 10, 12) }));
    expect([f.nomVersionHB, f.ev, f.caracs.FO, f.caracs.INT, f.bonusDegats]).toEqual(['Homme-Taureau', 45, 14, 7, 2]);
  });

  it("l'Ogre convertit jusqu'à 3 points d'AT/PRD en dégâts", () => {
    const f = calculerFiche(
      perso({ origineId: 'ogre', jets: scores(10, 8, 8, 9, 13), ajustements: { ogreAT: 2, ogrePRD: 3 } }),
    );
    expect([f.at, f.prd, f.bonusDegats]).toEqual([7, 8, 4]);
  });

  it('le guerrier augmente de 1 la PR max de son origine', () => {
    const f = calculerFiche(perso({ origineId: 'elfe-noir', metierId: 'guerrier', jets: scores(12, 12, 10, 13, 12) }));
    expect(f.prMax).toBe(4);
  });
});

describe('compétences', () => {
  it('toutes les compétences des fiches ont une description', () => {
    const manquantes = new Set<string>();
    for (const n of [...ORIGINES.flatMap((o) => [...o.naissance, ...o.auChoix]), ...METIERS.flatMap((m) => [...m.heritees, ...m.auChoix])]) {
      if (trouverCompetence(n).texte === 'Description à venir.') manquantes.add(n);
    }
    expect([...manquantes]).toEqual([]);
  });

  it('un Humain sans métier choisit 3 compétences génériques', () => {
    const [r] = reservesCompetences(origineParId('humain'), metierParId('aucun'), []);
    expect(r.nombre).toBe(3);
    expect(r.options).not.toContain('Appel du sauvage');
    expect(r.options).toContain('Ambidextrie');
  });

  it("les autres choisissent 2 compétences dans leurs fiches, sans celles qu'ils ont déjà", () => {
    const o = origineParId('nain');
    const m = metierParId('guerrier');
    const [r] = reservesCompetences(o, m, [...o.naissance, ...m.heritees]);
    expect(r.nombre).toBe(2);
    expect(r.options).not.toContain('Bourre-pif');
    expect(r.options).toContain('Forgeron');
  });
});

describe('doublons', () => {
  it("une compétence donnée par l'origine et le métier n'apparaît qu'une fois", () => {
    const f = calculerFiche(perso({ origineId: 'barbare', metierId: 'guerrier', jets: scores(12, 9, 9, 10, 13) }));
    expect(f.competences.heritees).not.toContain('Bourre-pif');
    expect(f.competences.naissance).toContain('Bourre-pif');
  });
});
