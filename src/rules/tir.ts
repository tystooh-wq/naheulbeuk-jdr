import { calculerFiche, cleCompetence } from './creation';
import { objet, type Objet } from './objets';
import { valeursCombat, type Partie } from './partie';

// Armes à distance (règles V4, 8.11 à 8.14) :
// - tirer, c'est une épreuve d'Adresse, modifiée par l'arme et le projectile ;
// - sans la compétence « Tirer correctement », l'épreuve se fait à AD-4 ; avec, +1 aux armes mécaniques ;
// - on ne tire pas à l'arc sur un ennemi qui vous agresse au contact : on tire pendant qu'il approche ;
// - chaque arme a son temps de rechargement (en assauts), et les projectiles s'épuisent ;
// - bonus de Force aux dégâts, sauf pour les armes mécaniques (arbalètes).

export const aTirerCorrectement = (p: Partie) => {
  const c = calculerFiche(p.perso).competences;
  return [...c.naissance, ...c.heritees, ...c.choisies].some((n) => cleCompetence(n) === cleCompetence('Tirer correctement'));
};

export interface ValeursTir {
  arme: Objet;
  /** Valeur à ne pas dépasser au D20. */
  ad: number;
  degats: string;
  recharge: number;
  /** Projectile qui partira au prochain tir (le premier du sac), ou null s'il n'en faut pas. */
  projectile: Objet | null;
  /** Il faut des projectiles et il n'y en a plus. */
  aSec: boolean;
  details: string[];
}

export const valeursTir = (p: Partie): ValeursTir | null => {
  if (!p.equipe.distance) return null;
  const arme = objet(p.equipe.distance);
  const t = arme.tir!;
  const f = calculerFiche(p.perso);
  const projectileId = t.munition ? p.sac.find((id) => objet(id).munition === t.munition) : undefined;
  const projectile = projectileId ? objet(projectileId) : null;
  const details: string[] = [];
  let ad = valeursCombat(p).ad;
  if (aTirerCorrectement(p)) {
    if (t.mecanique) {
      ad += 1;
      details.push('+1 Tirer correctement (arme mécanique)');
    }
  } else {
    ad -= 4;
    details.push('−4 sans « Tirer correctement »');
  }
  if (arme.modTir) {
    ad += arme.modTir;
    details.push(`${arme.modTir > 0 ? '+' : ''}${arme.modTir} arme`);
  }
  if (projectile?.modTir) {
    ad += projectile.modTir;
    details.push(`${projectile.modTir > 0 ? '+' : ''}${projectile.modTir} projectile`);
  }
  const [des, fixe] = (arme.degats ?? '1D').split(/(?=[+-])/);
  const total = Number(fixe ?? 0) + (t.mecanique ? 0 : f.bonusDegats) + (projectile?.bonusDegats ?? 0);
  return {
    arme,
    ad,
    degats: `${des}${total === 0 ? '' : total > 0 ? `+${total}` : total}`,
    recharge: t.recharge,
    projectile,
    aSec: !!t.munition && !projectile,
    details,
  };
};

/** Retire du sac le projectile tiré. */
export const consommerProjectile = (p: Partie, id: string) => {
  const i = p.sac.indexOf(id);
  if (i >= 0) p.sac.splice(i, 1);
};
