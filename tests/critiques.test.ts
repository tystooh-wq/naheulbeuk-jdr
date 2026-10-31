import { describe, expect, it } from 'vitest';
import { attaquer, combattant, creerCombat, prendreArme, ramasserArme, tirer } from '../src/rules/combat';
import type { Personnage } from '../src/rules/creation';
import {
  CRITIQUE_CONTONDANTE,
  CRITIQUE_MAINS_NUES,
  CRITIQUE_PROJECTILE,
  CRITIQUE_TRANCHANTE,
  MALADRESSE_ARME,
  MALADRESSE_JET,
  MALADRESSE_MAINS_NUES,
  PARADE_CRITIQUE,
  BLESSURES,
  familleMonstre,
  familleObjet,
  casse,
} from '../src/rules/critiques';
import { objet } from '../src/rules/objets';
import { ajouterBlessure, blessuresActives, equiper, essaiEquiper, mainGauche, nouvellePartie, valeursCombat } from '../src/rules/partie';
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
const brigand = TABLE_TERRES_SAUVAGES.find((l) => /brigands de base/.test(l.nom))!;
const rencontre = (): Rencontre => ({ ligne: brigand, nombre: 1, d20: brigand.d20, approche: 0 });

/** Un générateur qui rend ces dés, dans l'ordre : [valeur, faces]. */
const des = (...suite: [number, number][]) => {
  let i = 0;
  return () => {
    const [v, f] = suite[i++] ?? [1, 6];
    return (v - 0.5) / f;
  };
};

describe('tables de l’écran Baston', () => {
  it('chaque table couvre le D20 de 1 à 20, sans trou ni doublon', () => {
    for (const t of [CRITIQUE_TRANCHANTE, CRITIQUE_CONTONDANTE, CRITIQUE_MAINS_NUES, CRITIQUE_PROJECTILE, MALADRESSE_ARME, MALADRESSE_JET, MALADRESSE_MAINS_NUES, PARADE_CRITIQUE]) {
      const vus = t.flatMap((l) => Array.from({ length: l.de[1] - l.de[0] + 1 }, (_, k) => l.de[0] + k));
      expect(vus).toEqual(Array.from({ length: 20 }, (_, k) => k + 1));
    }
  });

  it('la famille de l’arme choisit la table', () => {
    expect(familleObjet(objet('gourdin'))).toBe('contondante');
    expect(familleObjet(objet('dague-base'))).toBe('tranchante');
    expect(familleObjet(undefined)).toBe('mains-nues');
    expect(familleMonstre('Ogre débile', 'FO 16, AD 6, utilise une massue')).toBe('contondante');
    expect(familleMonstre('orques miteux', 'Armés de fendoirs rouillés')).toBe('tranchante');
    expect(familleMonstre('Ogre mutant débile', 'Il combat à mains nues')).toBe('mains-nues');
    expect(familleMonstre('rats pesteux', 'S’il parvient à mordre')).toBe('bete');
  });

  it('point de rupture : « 1à4 » casse sur 1 à 4, « Non » jamais', () => {
    expect(casse('1à4', 4)).toBe(true);
    expect(casse('1à4', 5)).toBe(false);
    expect(casse('Non', 1)).toBe(false);
  });
});

describe('en combat', () => {
  it('attaque critique tranchante, 13 : main tranchée, +6 aux dégâts, armure ignorée, malus tout de suite', () => {
    const c = creerCombat(nouvellePartie(perso), rencontre());
    combattant(c, 'heros').famille = 'tranchante';
    const e = combattant(c, 'e1');
    const at = e.at;
    // D20 de la table : 13 ; D6 du côté : 2 (droite).
    const a = attaquer(c, 'heros', 'e1', 1, { desDegats: [3], rng: des([13, 20], [2, 6]) });
    expect(a.tables?.[0]).toMatchObject({ lanceur: 'heros', table: 'Attaque critique, arme tranchante', de: 13, texte: 'Main tranchée' });
    expect(a.degats?.bonus).toBe(6);
    expect(a.degats?.pr).toBe(0);
    expect(e.blessures?.[0].nom).toBe('Main droite tranchée');
    expect(e.at).toBe(at - 5);
  });

  it('attaque critique contondante, 18 : l’ennemi est assommé, hors de combat', () => {
    const c = creerCombat(nouvellePartie(perso), rencontre());
    combattant(c, 'heros').famille = 'contondante';
    attaquer(c, 'heros', 'e1', 1, { desDegats: [1], rng: des([18, 20]) });
    expect(combattant(c, 'e1').ev).toBeLessThanOrEqual(0);
  });

  it('maladresse, 10 à 12 : le héros lâche son arme et se bat à mains nues', () => {
    const c = creerCombat(nouvellePartie(perso), rencontre());
    const h = combattant(c, 'heros');
    h.famille = 'tranchante';
    h.bourrePif = false;
    const at = h.at;
    const a = attaquer(c, 'heros', 'e1', 20, { rng: des([11, 20]) });
    expect(a.tables?.[0].table).toBe('Maladresse attaque ou parade');
    expect(h.famille).toBe('mains-nues');
    expect(h.at).toBe(at - 4);
    expect(h.sansParade).toBe(true);
    expect(c.armesCassees).toBeUndefined();
    expect(c.armeAuSol).toBeDefined();
    ramasserArme(c);
    expect(h.famille).toBe('tranchante');
    expect(h.at).toBe(at);
    expect(h.sansParade).toBeFalsy();
    expect(c.armeAuSol).toBeUndefined();
  });

  it("après avoir lâché son arme, on peut en sortir une autre du sac", () => {
    const p = nouvellePartie(perso);
    const c = creerCombat(p, rencontre());
    const h = combattant(c, 'heros');
    h.bourrePif = false;
    attaquer(c, 'heros', 'e1', 20, { rng: des([11, 20]) });
    expect(h.famille).toBe('mains-nues');
    const avant = p.equipe.arme;
    p.sac.push('dague-base');
    expect(equiper(p, 'dague-base', 'arme')).toBeNull();
    prendreArme(c, p);
    expect(h.famille).not.toBe('mains-nues');
    expect(h.degats).toBe(valeursCombat(p).degats);
    if (avant) expect(p.sac).toContain(avant);
  });

  it('maladresse au tir, 13 à 15 : l’arc casse selon son point de rupture', () => {
    const c = creerCombat(nouvellePartie(perso), rencontre());
    tirer(c, 'heros', 'e1', 20, { ad: 10, degats: '1D+2', rupture: '1à2' }, { rng: des([14, 20], [2, 6]) });
    expect(c.tirPerdu).toBe(true);
    expect(c.armesCassees).toEqual(['distance']);
  });

  it('les bêtes n’ont pas de table : leur maladresse les déséquilibre', () => {
    const rats = TABLE_TERRES_SAUVAGES.find((l) => /rats pesteux/.test(l.nom))!;
    const c = creerCombat(nouvellePartie(perso), { ligne: rats, nombre: 1, d20: rats.d20, approche: 0 });
    const a = attaquer(c, 'e1', 'heros', 20);
    expect(a.tables).toBeUndefined();
    expect(combattant(c, 'e1').rate).toBe(1);
  });
});

describe('blessures graves du héros', () => {
  it('comptent dans ses valeurs de combat, puis guérissent', () => {
    const p = nouvellePartie(perso);
    const avant = valeursCombat(p);
    ajouterBlessure(p, BLESSURES['bras-droit-casse']);
    expect(valeursCombat(p).at).toBe(avant.at - 5);
    expect(valeursCombat(p).prd).toBe(avant.prd - 6);
    p.jour += 21;
    expect(blessuresActives(p)).toHaveLength(0);
    expect(valeursCombat(p).at).toBe(avant.at);
  });
});

describe('ambidextrie', () => {
  const voleur: Personnage = { ...perso, jets: { COU: 12, INT: 10, CHA: 10, AD: 13, FO: 13 }, competencesChoisies: [] };
  const avecAmbidextrie = () => {
    const p = nouvellePartie(voleur);
    // La compétence et le niveau 2, comme si le héros l'avait apprise.
    p.perso.competencesChoisies = [...p.perso.competencesChoisies, 'Ambidextrie'];
    p.perso.progression = { ...(p.perso.progression ?? { niveau: 1, ev: 0, at: 0, prd: 0, caracs: {} }), niveau: 2 } as never;
    p.equipe.arme = 'dague-base';
    p.equipe.bouclier = undefined;
    p.sac.push('dague-base');
    return p;
  };

  it('sans la compétence et le niveau 2, pas d’arme en main gauche', () => {
    const p = nouvellePartie(perso);
    p.sac.push('dague-base');
    expect(essaiEquiper(p, 'dague-base', 'armeGauche').refus).toMatch(/Ambidextrie/);
  });

  it('une arme dans chaque main ; pas de bouclier ni d’arme à deux mains avec', () => {
    const p = avecAmbidextrie();
    expect(equiper(p, 'dague-base', 'armeGauche')).toBeNull();
    expect(p.equipe.armeGauche).toBe('dague-base');
    p.sac.push('bouclier-de-base');
    expect(essaiEquiper(p, 'bouclier-de-base').refus).toMatch(/main gauche/);
  });

  it('deuxième attaque seulement avec AD 14, à AT −5', () => {
    const p = avecAmbidextrie();
    equiper(p, 'dague-base', 'armeGauche');
    const g = mainGauche(p);
    expect(g && 'refus' in g && g.refus).toMatch(/AD 14/);
    p.perso.jets.AD = 14;
    const g2 = mainGauche(p)!;
    expect('refus' in g2).toBe(false);
    if (!('refus' in g2)) expect(g2.at).toBe(valeursCombat(p).at - 5);
    const c = creerCombat(p, rencontre());
    expect(combattant(c, 'heros').mainGauche?.at).toBe(valeursCombat(p).at - 5);
  });
});
