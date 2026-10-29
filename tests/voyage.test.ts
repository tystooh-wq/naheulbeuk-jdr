import { describe, expect, it } from 'vitest';
import type { Personnage } from '../src/rules/creation';
import { EVENEMENTS } from '../src/rules/evenements';
import { bivouaquer, epreuve, nouvellePartie, passerTemps } from '../src/rules/partie';
import { resoudre, TABLE_TERRES_SAUVAGES, tirerNombre } from '../src/rules/rencontres';

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

describe('temps et bivouac', () => {
  it("l'horloge passe minuit et change de jour", () => {
    const p = nouvellePartie(perso);
    p.heure = 22;
    passerTemps(p, 3);
    expect(p).toMatchObject({ jour: 2, heure: 1 });
  });

  it('une nuit dehors avec couverture et ration rend 4 PV et mange la ration', () => {
    const p = nouvellePartie(perso);
    p.ev = 10;
    p.heure = 20;
    const nb = p.sac.filter((x) => x === 'rations').length;
    expect(bivouaquer(p)).toMatchObject({ rendu: 4, confort: 'normal', mange: true });
    expect(p.sac.filter((x) => x === 'rations').length).toBe(nb - 1);
    expect(p).toMatchObject({ jour: 2, heure: 6 });
  });

  it('sans couverture ni ration, la nuit rend peu', () => {
    const p = nouvellePartie(perso);
    p.sac = [];
    p.ev = 10;
    expect(bivouaquer(p).rendu).toBe(1);
  });
});

describe('rencontres', () => {
  it('la table officielle a 20 lignes et les nombres se tirent', () => {
    expect(TABLE_TERRES_SAUVAGES).toHaveLength(20);
    expect(tirerNombre('1 à 3', () => 0.99)).toBe(3);
    expect(tirerNombre('1 ou 2', () => 0)).toBe(1);
    expect(tirerNombre('1D6', () => 0.99)).toBe(6);
  });

  it("le 20 rate toujours l'épreuve, le 1 la réussit toujours", () => {
    expect(epreuve(30, () => 0.99).reussi).toBe(false);
    expect(epreuve(0, () => 0).reussi).toBe(true);
  });

  it("une fuite ratée coûte un coup par adversaire, l'armure en moins", () => {
    const p = nouvellePartie(perso);
    const avant = p.ev;
    const orques = { ligne: TABLE_TERRES_SAUVAGES[8], nombre: 2, d20: 9 };
    const issue = resoudre(p, orques, 'fuir', () => 0.99);
    expect(issue.epreuve.reussi).toBe(false);
    // 1D+4 au maximum = 10, moins PR 2 de la veste : 8 par coup.
    expect(issue.coups.map((c) => c.blessure)).toEqual([8, 8]);
    expect(p.ev).toBe(avant - 16);
  });

  it('chaque événement a au moins un choix toujours possible', () => {
    for (const e of EVENEMENTS) {
      const p = nouvellePartie(perso);
      p.or = 0;
      p.sac = [];
      expect(e.choix.some((c) => !c.possible?.(p)), e.id).toBe(true);
    }
  });
});
