export type Carac = 'COU' | 'INT' | 'CHA' | 'AD' | 'FO';

export const CARACS: Carac[] = ['COU', 'INT', 'CHA', 'AD', 'FO'];

export const NOM_CARAC: Record<Carac, string> = {
  COU: 'Courage',
  INT: 'Intelligence',
  CHA: 'Charisme',
  AD: 'Adresse',
  FO: 'Force',
};

export type Scores = Record<Carac, number>;

/** Bornes de création : minimum et/ou maximum naturel par caractéristique. */
export type Criteres = Partial<Record<Carac, { min?: number; max?: number }>>;

export interface VersionHommeBete {
  nom: string;
  ev: number;
  mods: Partial<Scores>;
  bonus: string[];
  note: string;
}

export interface Origine {
  id: string;
  nom: string;
  surnom: string;
  description: string;
  criteres: Criteres;
  ev: number;
  /** EV gagnée par niveau quand elle est limitée (1D4). */
  evParNiveau?: string;
  /** AT/PRD de départ quand l'origine les impose. */
  atPrd?: [number, number];
  prMax: number | null;
  charge: string;
  /** L'origine ne pratique aucune magie : pas de métier de mage. */
  sansMagie: boolean;
  /** Ni magie ni prêtrise (Homme-Bête). */
  sansPretrise?: boolean;
  restrictions: string[];
  naissance: string[];
  auChoix: string[];
  versions?: VersionHommeBete[];
  /** Ogre : peut convertir jusqu'à 3 points d'AT/PRD en bonus de dégâts. */
  superBourrin?: boolean;
}

export type AjustementMetier =
  | 'guerrier'
  | 'ingenieur'
  | 'marchand'
  | 'ranger';

export interface Metier {
  id: string;
  nom: string;
  description: string;
  criteres: Criteres;
  /** Calcul de l'EV à partir de celle de l'origine. */
  ev: (evOrigine: number, origineId: string) => number;
  evTexte: string;
  ea?: number;
  atPrd?: [number, number];
  prMax: number | null;
  /** Le guerrier augmente de 1 le PR max de son origine. */
  prBonus?: number;
  magique?: boolean;
  pretrise?: boolean;
  restrictions: string[];
  bonus: string[];
  heritees: string[];
  auChoix: string[];
  ajustement?: AjustementMetier;
  fortuneDouble?: boolean;
}
