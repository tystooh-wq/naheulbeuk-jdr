import { describe, expect, it } from 'vitest';
import type { Personnage } from '../src/rules/creation';
import { CHATEAU_VALTORDU } from '../src/rules/chateau-valtordu';
import { appelsQuetes, quetesProposees } from '../src/rules/quetes';
import { nouvellePartie } from '../src/rules/partie';
import { objet } from '../src/rules/objets';
import { LIEUX_VALTORDU, RESEAU_VALTORDU } from '../src/rules/valtordu';
import MASQUES from '../src/assets/chateau-valtordu/masques.json';

const perso = {
  version: 1, nom: 'Test', sexe: 'Femme', jets: { COU: 12, INT: 10, CHA: 10, AD: 10, FO: 13 }, origineId: 'humain', metierId: 'guerrier',
  competencesChoisies: [], ajustements: { guerrierEchange: 'aucun', guerrierBonus: 'AT' }, destin: 1, or: 200, jetsOr: [],
} as Personnage;

describe('Le château de Valtordu', () => {
  const d = CHATEAU_VALTORDU;
  const ids = new Set(d.salles.map((s) => s.id));
  it('salles reliées dans les deux sens, toutes sur un plan, avec leur brouillard', () => {
    for (const s of d.salles) {
      expect(s.niveau && d.niveaux!.some((n) => n.id === s.niveau)).toBeTruthy();
      expect((MASQUES.salles as Record<string, unknown>)[s.id], s.id).toBeTruthy();
      for (const v of s.vers) {
        expect(ids.has(v), `${s.id} → ${v}`).toBe(true);
        expect(d.salles.find((x) => x.id === v)!.vers, `${v} ← ${s.id}`).toContain(s.id);
      }
      for (const o of [...(s.tresor?.objets ?? []), ...(s.contenu?.type === 'combat' ? (s.contenu.gagne ?? []) : [])]) expect(() => objet(o)).not.toThrow();
    }
  });
  it('on peut aller des deux entrées jusqu\'aux otages', () => {
    for (const depart of [d.entree, ...d.entrees!.map((e) => e.salle)]) {
      const vus = new Set([depart]);
      const file = [depart];
      while (file.length) {
        const ici = file.shift()!;
        for (const v of d.salles.find((s) => s.id === ici)!.vers)
          if (!vus.has(v)) {
            vus.add(v);
            file.push(v);
          }
      }
      expect(vus.has(d.finale)).toBe(true);
    }
  });
});

describe('Rendez-nous nos impôts !', () => {
  it('le vieux Bertrand ne fait signe qu\'à un groupe apprécié, et une seule fois', () => {
    const p = nouvellePartie(perso);
    expect(quetesProposees(p, 'ville:valtordu:arbre')).toHaveLength(0);
    expect(appelsQuetes(p, 'valtordu')).toHaveLength(0);
    p.reputation = { valtordu: 2 };
    expect(quetesProposees(p, 'ville:valtordu:arbre').map((q) => q.id)).toEqual(['impots-valtordu']);
    expect(appelsQuetes(p, 'valtordu')).toHaveLength(1);
    expect(appelsQuetes(p, 'valtordu')).toHaveLength(0);
  });
  it('les nouveaux lieux ont une porte sur le réseau des rues', () => {
    for (const l of LIEUX_VALTORDU) expect(RESEAU_VALTORDU.noeuds[RESEAU_VALTORDU.acces[l.id]], l.id).toBeTruthy();
  });
});
