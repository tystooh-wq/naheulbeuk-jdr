import { bonusSituation, type Situation } from './talents';
import { calculerFiche } from './creation';
import { blessuresActives, valeursCombat, type Partie } from './partie';

// La valeur d'une épreuve du héros : sa caractéristique (avec l'équipement et les malus passagers),
// le modificateur de la situation et les bonus de compétences.

export type CaracQuete = 'COU' | 'INT' | 'CHA' | 'AD' | 'FO';

export const NOM_CARAC: Record<CaracQuete, string> = { COU: 'Courage', INT: 'Intelligence', CHA: 'Charisme', AD: 'Adresse', FO: 'Force' };

export const valeurEpreuve = (p: Partie, e: { carac: CaracQuete; modif?: number; situation?: Situation }) => {
  const v = valeursCombat(p);
  const f = calculerFiche(p.perso);
  // Les malus passagers (odeur tenace, salle d'ennui…) comptent aussi pour l'Intelligence et la Force.
  const passager = (k: 'INT' | 'FO') => blessuresActives(p).reduce((s, b) => s + (b.mods[k] ?? 0), 0);
  return { COU: v.cou, INT: f.caracs.INT + passager('INT'), CHA: v.cha, AD: v.ad, FO: f.caracs.FO + passager('FO') }[e.carac] + (e.modif ?? 0) + (e.situation ? bonusSituation(p, e.situation).total : 0);
};
