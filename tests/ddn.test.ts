import { describe, expect, it } from 'vitest';
import type { Personnage } from '../src/rules/creation';
import {
  accessibles,
  avancer,
  chercher,
  contenuIci,
  DONJONS,
  entrerDonjon,
  forcerSerrure,
  ouvrirAvecCle,
  passable,
  porteEntre,
  salle,
} from '../src/rules/donjons';
import { capturer, ENIGMES, evader, hautFait, instruments, recupererAffaires } from '../src/rules/ddn';
import { DDN, SALLES } from '../src/rules/ddn-salles';
import { objet } from '../src/rules/objets';
import { nouvellePartie } from '../src/rules/partie';
import { accepterQuete, etapesIci, progresserQuetes, tenterEtape } from '../src/rules/quetes';

const perso: Personnage = {
  version: 1,
  nom: 'Test',
  sexe: 'Femme',
  jets: { COU: 12, INT: 12, CHA: 11, AD: 12, FO: 13 },
  origineId: 'humain',
  metierId: 'guerrier',
  competencesChoisies: [],
  ajustements: { guerrierEchange: 'aucun', guerrierBonus: 'AT' },
  destin: 1,
  or: 50,
  jetsOr: [[2, 3]],
};

const partie = (heure = 10) => {
  const p = nouvellePartie(perso);
  p.heure = heure;
  entrerDonjon(p, 'naheulbeuk');
  return p;
};

/** Téléporte le héros (pour les tests). */
const aller = (p: ReturnType<typeof partie>, id: string) => {
  p.donjon!.salle = id;
  if (!p.donjon!.vues.includes(id)) p.donjon!.vues.push(id);
};

describe('Donjon de Naheulbeuk', () => {
  it('est enregistré, et ses salles forment un plan cohérent', () => {
    expect(DONJONS).toContain(DDN);
    const ids = new Set(SALLES.map((s) => s.id));
    expect(ids.size).toBe(SALLES.length);
    for (const s of SALLES) {
      expect(DDN.niveaux!.some((n) => n.id === s.niveau), s.id).toBe(true);
      expect(s.px! >= 0 && s.px! <= 100 && s.py! >= 0 && s.py! <= 100, s.id).toBe(true);
      for (const v of s.vers) {
        expect(ids.has(v), `${s.id} → ${v}`).toBe(true);
        expect(salle(DDN, v).vers, `${v} ← ${s.id}`).toContain(s.id);
      }
      for (const v of Object.keys(s.portes ?? {})) expect(s.vers, `porte ${s.id}|${v}`).toContain(v);
      for (const id of s.tresor?.objets ?? []) expect(() => objet(id), id).not.toThrow();
      const c = s.contenu;
      if (c?.type === 'boutique') for (const id of c.stock) expect(() => objet(id), id).not.toThrow();
      if (c?.type === 'combat') for (const id of c.gagne ?? []) expect(() => objet(id), id).not.toThrow();
    }
    // Tout se rejoint depuis la grande porte.
    const vus = new Set(['n0-entree']);
    const file = ['n0-entree'];
    while (file.length) for (const v of salle(DDN, file.pop()!).vers) if (!vus.has(v)) vus.add(v), file.push(v);
    expect(vus.size).toBe(SALLES.length);
  });

  it('on entre par la grande porte ou par la taverne', () => {
    const p = nouvellePartie(perso);
    entrerDonjon(p, 'naheulbeuk', 'n1-1');
    expect(p.donjon!.salle).toBe('n1-1');
  });

  it("un passage secret se cherche avant de s'emprunter", () => {
    const p = partie();
    const d = DDN;
    expect(accessibles(p.donjon!, d, p)).not.toContain('n0-1');
    chercher(p, 1);
    expect(accessibles(p.donjon!, d, p)).toContain('n0-1');
  });

  it('la « putain de porte » ne s\'ouvre que de l\'autre côté', () => {
    const p = partie();
    expect(passable(p.donjon!, DDN, 'cave-1', 'cave-2', p)).toBe(false);
    expect(passable(p.donjon!, DDN, 'cave-2', 'cave-1', p)).toBe(true);
    aller(p, 'cave-1');
    const r = forcerSerrure(p, { porte: 'cave-2' }, 'enfoncer', 1);
    expect(r.reussi).toBe(true);
    expect(passable(p.donjon!, DDN, 'cave-1', 'cave-2', p)).toBe(true);
  });

  it('le magasin de la cave est ouvert en journée, verrouillé la nuit', () => {
    const p = partie(10);
    expect(passable(p.donjon!, DDN, 'cave-2', 'cave-14', p)).toBe(true);
    expect(contenuIci(salle(DDN, 'cave-14'), p).contenu?.type).toBe('boutique');
    p.heure = 22;
    expect(passable(p.donjon!, DDN, 'cave-2', 'cave-14', p)).toBe(false);
    expect(contenuIci(salle(DDN, 'cave-14'), p).contenu?.type).toBe('scene');
  });

  it('une clé ouvre sa serrure ; le trésor de Zangdar en demande deux', () => {
    const p = partie();
    aller(p, 'n2-7');
    expect(ouvrirAvecCle(p, { porte: 'n2-tresor' })).toBeTruthy();
    p.sac.push('cle-maraudeur');
    expect(ouvrirAvecCle(p, { porte: 'n2-tresor' })).toBeTruthy();
    p.sac.push('cle-reivax');
    expect(ouvrirAvecCle(p, { porte: 'n2-tresor' })).toBeNull();
    expect(porteEntre(DDN, 'n2-7', 'n2-tresor')).toBeDefined();
  });

  it('les énigmes officielles reconnaissent les bonnes réponses', () => {
    expect(ENIGMES[1].bonne('Merde !')).toBe(true);
    expect(ENIGMES[7].bonne('une chaussette')).toBe(true);
    expect(ENIGMES[5].bonne('au pôle nord')).toBe(true);
    expect(ENIGMES[6].bonne('N')).toBe(true);
    expect(ENIGMES[6].bonne('nain')).toBe(false);
    expect(ENIGMES[7].bonne('pied')).toBe(false);
  });

  it('Zangdar est à son bureau le jour, dans sa chambre la nuit, et plus nulle part une fois vaincu', () => {
    const p = partie(10);
    const bureau = salle(DDN, 'n2-15');
    expect(contenuIci(bureau, p).contenu?.type).toBe('scene');
    p.heure = 2;
    expect(contenuIci(bureau, p).contenu).toBeUndefined();
    expect(contenuIci(salle(DDN, 'n2-8'), p).contenu?.type).toBe('scene');
    p.marques = ['ddn:zangdar-vaincu'];
    expect(contenuIci(salle(DDN, 'n2-8'), p).contenu).toBeUndefined();
  });

  it('se rendre mène aux cachots ; on peut s\'évader et récupérer ses affaires', () => {
    const p = partie();
    p.sac.push('corde');
    const or = p.or;
    capturer(p);
    expect(p.donjon!.salle).toBe('n5-3');
    expect(p.sac).toEqual([]);
    expect(accessibles(p.donjon!, DDN, p)).toEqual([]);
    expect(evader(p, 'serrure', 1).reussi).toBe(true);
    expect(accessibles(p.donjon!, DDN, p)).toContain('n5-4');
    expect(p.hautsFaits?.prisonniers).toBe(1);
    expect(recupererAffaires(p)).toBeTruthy();
    expect(p.sac).toContain('corde');
    expect(p.or).toBe(or);
  });

  it('un haut fait rapporte de l\'XP, et le tout premier en rapporte un de plus', () => {
    const p = partie();
    const xp = p.xp ?? 0;
    expect(hautFait(p, 'biere')).toContain('Get an achievement');
    expect(p.xp).toBe(xp + 10);
    expect(hautFait(p, 'biere')).toBeNull();
  });

  it('le puits des âmes damnées : la poudre, la formule, la paye', () => {
    const p = partie();
    accepterQuete(p, 'ddn-puits');
    expect(p.sac).toContain('poudre-luzur');
    aller(p, 'cave-10');
    expect(etapesIci(p, 'donjon:naheulbeuk:cave-10').map((x) => x.quete.id)).toContain('ddn-puits');
    expect(tenterEtape(p, 'ddn-puits', 1).reussi).toBe(true);
    expect(p.sac).not.toContain('poudre-luzur');
  });

  it('la statuette : la faiblesse de Zangdar et les instruments font avancer la quête tout seuls', () => {
    const p = partie();
    accepterQuete(p, 'ddn-statuette');
    expect(progresserQuetes(p)).toEqual([]);
    p.marques = ['ddn:faiblesse'];
    p.sac.push('instrument', 'triangle-en-alliage', 'harmonica-du-donjon', 'banjo-frappecrane-des-gobs');
    expect(instruments(p)).toBe(4);
    expect(progresserQuetes(p)).toHaveLength(2);
    expect(p.etapesQuetes!['ddn-statuette']).toBe(2);
    expect(avancer(p, 'n0-2')).toBeNull();
  });
});
