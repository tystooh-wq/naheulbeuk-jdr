import { describe, expect, it } from 'vitest';
import { date, dateCourte, dateLongue, periode } from '../src/rules/calendrier';

describe('calendrier de la Terre de Fangh', () => {
  it("l'aventure commence un Obouloserin 5 avril, décade de Phytgar Ranald", () => {
    expect(dateLongue(1)).toBe('Obouloserin 5 avril');
    expect(periode(1)).toBe('décade de Phytgar Ranald');
  });

  it('les jours de la semaine tournent sur sept, les mois s’enchaînent', () => {
    expect(date(8).semaine).toBe('Obouloserin');
    expect(date(7).semaine).toBe('Dlulerin');
    expect(dateCourte(27)).toBe('1er mai');
  });

  it('les fêtes entre deux décades', () => {
    expect(periode(11)).toBe('Fête des giboulées');
    expect(periode(22)).toBe('Fête des grenouilles');
    expect(periode(11 + 365)).toBe('Fête des giboulées');
    expect(date(1 + 365).annee).toBe(1);
  });
});

describe('jours avec une fraction', () => {
  it("une blessure qui guérit en cours de journée n'empêche pas d'afficher la date", () => {
    expect(dateCourte(7.5)).toBe(dateCourte(7));
    expect(dateLongue(7.25)).toBe(dateLongue(7));
  });
});
