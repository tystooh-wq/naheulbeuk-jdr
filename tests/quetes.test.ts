import { describe, expect, it } from 'vitest';
import type { Personnage } from '../src/rules/creation';
import { CITES, lieuCite, trajetCite } from '../src/rules/cites';
import { accessibles, affronterPiege, avancer, combatSalle, DONJONS, entrerDonjon, fouiller, regler, salle, termine } from '../src/rules/donjons';
import { LIEUX_MONDE } from '../src/rules/monde';
import { objet } from '../src/rules/objets';
import { nouvellePartie, vendre } from '../src/rules/partie';
import { accepterQuete, donjonTermine, etapesIci, QUETES, quetesProposees, tenterEtape, validerEtape } from '../src/rules/quetes';
import { creerEnnemis } from '../src/rules/combat';
import { changerReputation, facteurPrix, reputation } from '../src/rules/reputation';

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

/** Vérifie qu'un endroit de quête existe vraiment. */
const existe = (ou: string) => {
  const [type, a, b] = ou.split(':');
  if (type === 'monde') return LIEUX_MONDE.some((l) => l.id === a);
  if (type === 'ville') return CITES.some((c) => c.id === a && c.lieux.some((l) => l.id === b));
  return false;
};

describe('quêtes', () => {
  it('chaque quête se donne et se joue à des endroits qui existent, avec des objets connus', () => {
    for (const q of QUETES) {
      expect(existe(q.donneur), q.id).toBe(true);
      for (const e of q.etapes) {
        expect(existe(e.ou), `${q.id} ${e.ou}`).toBe(true);
        for (const id of [e.donne, e.reprend].filter(Boolean)) expect(() => objet(id!)).not.toThrow();
        if (e.donjon) expect(DONJONS.some((d) => d.id === e.donjon)).toBe(true);
      }
      for (const id of q.recompense.objets ?? []) expect(() => objet(id)).not.toThrow();
    }
  });

  it('le colis du guérisseur : accepter, livrer à Loubet, revenir, être payé', () => {
    const p = nouvellePartie(perso);
    expect(p.ville).toBe('valtordu');
    expect(quetesProposees(p, 'ville:valtordu:guerisseur').map((q) => q.id)).toContain('colis-loubet');
    expect(accepterQuete(p, 'colis-loubet')).toBeNull();
    expect(p.sac).toContain('colis-ozonuc');
    expect(vendre(p, 'colis-ozonuc', 5)).not.toBeNull();
    expect(etapesIci(p, 'ville:loubet:herboriste')).toHaveLength(1);
    validerEtape(p, 'colis-loubet');
    expect(p.sac).not.toContain('colis-ozonuc');
    expect(p.sac).toContain('lettre-loubet');
    const or = p.or;
    const fin = validerEtape(p, 'colis-loubet');
    expect(fin.finie).toBe(true);
    expect(p.quetes['colis-loubet']).toBe('terminee');
    expect(reputation(p, 'valtordu')).toBe(2);
    expect(p.or).toBe(or + 25);
    expect(p.xp).toBe(40);
    expect(p.sac).not.toContain('lettre-loubet');
  });

  it("l'épreuve d'une étape : un échec coûte des PV sans tuer, une réussite avance", () => {
    const p = nouvellePartie(perso);
    accepterQuete(p, 'secret-boudin');
    p.ev = 1;
    const rate = tenterEtape(p, 'secret-boudin', 20);
    expect(rate.reussi).toBe(false);
    expect(p.ev).toBe(1);
    const ok = tenterEtape(p, 'secret-boudin', 1);
    expect(ok.reussi).toBe(true);
    expect(p.mauvaiseConduite).toBe(1);
  });

  it('le Donjon Facile se paie à l\'entrée', () => {
    const p = nouvellePartie(perso);
    p.or = 5;
    expect(accepterQuete(p, 'donjon-facile')).not.toBeNull();
    p.or = 12;
    expect(accepterQuete(p, 'donjon-facile')).toBeNull();
    expect(p.or).toBe(2);
  });
});

describe('donjons', () => {
  it('toutes les salles sont reliées dans les deux sens et atteignables', () => {
    for (const d of DONJONS) {
      for (const s of d.salles) for (const v of s.vers) expect(salle(d, v).vers, `${d.id} ${s.id}→${v}`).toContain(s.id);
      const vues = new Set([d.entree]);
      const file = [d.entree];
      while (file.length) for (const v of salle(d, file.pop()!).vers) if (!vues.has(v)) vues.add(v), file.push(v);
      expect(vues.size).toBe(d.salles.length);
      for (const s of d.salles) if (s.contenu?.type === 'combat') expect(creerEnnemis(combatSalle(s)!).length).toBeGreaterThan(0);
    }
  });

  it("une salle à combattre bloque le passage ; on peut seulement reculer", () => {
    const p = nouvellePartie(perso);
    const e = entrerDonjon(p, 'fariliik');
    expect(avancer(p, 'sentinelle')).toBeNull();
    expect(accessibles(e, DONJONS[1])).toEqual(['entree']);
    regler(e, 'sentinelle');
    expect(accessibles(e, DONJONS[1])).toContain('carrefour');
  });

  it('piège, fouille et fin du donjon des gobelins avec la quête', () => {
    const p = nouvellePartie(perso);
    p.quetes.gobelins = 'acceptee';
    const e = entrerDonjon(p, 'fariliik');
    for (const s of ['sentinelle', 'carrefour']) {
      avancer(p, s);
      regler(e, s);
    }
    avancer(p, 'reserve');
    const t = fouiller(p);
    expect(t?.objets).toContain('potion-soin');
    expect(fouiller(p)).toBeNull();
    avancer(p, 'carrefour');
    avancer(p, 'fosse');
    const ev = p.ev;
    const r = affronterPiege(p, 20);
    expect(r.reussi).toBe(false);
    expect(p.ev).toBe(ev - r.degats);
    regler(e, 'antre');
    expect(termine(e)).toBe(true);
    expect(donjonTermine(p, 'fariliik')?.reussi).toBe(true);
    expect(p.etapesQuetes?.gobelins).toBe(1);
  });
});

describe('villes', () => {
  it('à Valtordu, chaque trajet suit les rues et relie bien les deux lieux', () => {
    const c = CITES.find((x) => x.id === 'valtordu')!;
    for (const a of c.lieux)
      for (const b of c.lieux) {
        if (a.id === b.id) continue;
        const t = trajetCite(c, a, b);
        expect(t[0]).toEqual([a.x, a.y]);
        expect(t[t.length - 1]).toEqual([b.x, b.y]);
      }
    expect(lieuCite(c, 'trois-boudins').auberge).toBeDefined();
    // Chaque lieu a sa porte, et l'on entre en ville par le pont des Tricoteuses.
    for (const l of c.lieux) expect(c.reseau!.acces![l.id], l.id).toBeDefined();
    const entree = trajetCite(c, lieuCite(c, 'porte'), lieuCite(c, 'trois-boudins'));
    expect(entree).toContainEqual(c.reseau!.noeuds.pontN);
    expect(entree).toContainEqual(c.reseau!.noeuds.pontS);
    for (const l of c.lieux) for (const id of l.boutique?.stock ?? []) expect(() => objet(id), id).not.toThrow();
  });

  it('une réputation de honni ferme les quêtes et fait grimper les prix', () => {
    const p = nouvellePartie(perso);
    expect(facteurPrix(reputation(p, 'valtordu'))).toBe(1);
    expect(changerReputation(p, 'valtordu', -30, 'test')).toBe(-10);
    expect(reputation(p, 'valtordu')).toBe(-10);
    expect(reputation(p, 'waldorg')).toBe(0);
    expect(quetesProposees(p, 'ville:valtordu:guerisseur')).toHaveLength(0);
    expect(facteurPrix(reputation(p, 'valtordu'))).toBe(1.2);
  });
});
