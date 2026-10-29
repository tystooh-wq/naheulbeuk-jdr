// Catalogue d'objets du prototype, tiré des tableaux officiels : Armement V2.3, Armures et protections V3.0,
// Matériel et services V3.0, Potions et accessoires magiques V3.0, S'équiper (mages), Instruments,
// plus les suppléments « Armement des soldats », « Matériel pour les soldats » et « Armement de Fernol ».
// Les objets marqués `estime` n'apparaissent dans aucun tableau : leurs valeurs sont provisoires.
// Les objets à moins d'une pièce d'or sont vendus par lots.

export type TypeObjet = 'arme' | 'armure' | 'potion' | 'materiel';

export type Modif = 'AT' | 'PRD' | 'COU' | 'CHA' | 'AD';

export interface Objet {
  id: string;
  nom: string;
  type: TypeObjet;
  prix: number;
  description: string;
  /** Dégâts au D6, par exemple « 1D+3 ». */
  degats?: string;
  mains?: 1 | 2;
  /** Arme « de bourrin » : demande la compétence du même nom (sauf Nain). */
  bourrin?: boolean;
  /** Arme légère autorisée aux mages et ménestrels (bâton, dague, gourdin). */
  legere?: boolean;
  pr?: number;
  mods?: Partial<Record<Modif, number>>;
  /** Points de vie rendus (potions). */
  soin?: string;
  estime?: boolean;
}

export const OBJETS: Objet[] = [
  // --- Armes : récupération et lames courtes (Armement V2.3) ---------------
  { id: 'gourdin', nom: 'Bonne branche, gourdin', type: 'arme', prix: 1, degats: '1D', mains: 1, legere: true, mods: { PRD: -2, CHA: -1 }, description: "Gratuit pour qui sait ramasser du bois. Le bazar le vend quand même." },
  { id: 'baton', nom: 'Bâton de marche', type: 'arme', prix: 8, degats: '1D+1', mains: 2, legere: true, description: "Un bon bout de bois. Sert aussi à tâter le sol des donjons.", estime: true },
  { id: 'couteau-qualite', nom: 'Couteau de qualité', type: 'arme', prix: 5, degats: '1D', mains: 1, legere: true, mods: { AT: -3, PRD: -3, CHA: -1 }, description: 'Parfait pour le saucisson. Moins pour les orques.' },
  { id: 'poignard-base', nom: 'Poignard de base', type: 'arme', prix: 10, degats: '1D+1', mains: 1, legere: true, mods: { AT: -2, PRD: -4, CHA: -1 }, description: 'Prévu pour le jet, mais ça pique aussi au contact.' },
  { id: 'dague-base', nom: 'Dague de base', type: 'arme', prix: 15, degats: '1D+2', mains: 1, legere: true, mods: { AT: -1, PRD: -2, CHA: -1 }, description: 'La dague de tout le monde, celle qu\'on perd sans pleurer.' },
  { id: 'dague-qualite', nom: 'Dague de bonne qualité', type: 'arme', prix: 50, degats: '1D+2', mains: 1, legere: true, mods: { PRD: -2 }, description: 'Bien équilibrée, bien affûtée.' },
  // --- Armes militaires (Armement des soldats, Armement de Fernol) ---------
  { id: 'dague-bleusaille', nom: 'Dague de bleusaille', type: 'arme', prix: 15, degats: '1D+2', mains: 1, legere: true, mods: { AT: -1, PRD: -2 }, description: "Dague réglementaire des recrues. Le fil laisse à désirer." },
  { id: 'dague-recourbee', nom: 'Dague recourbée de Lapaille', type: 'arme', prix: 50, degats: '1D+2', mains: 1, legere: true, mods: { PRD: -2 }, description: 'Une dague fernolienne en bon acier, bien affûtée.' },
  { id: 'dague-premiere', nom: 'Dague de première classe', type: 'arme', prix: 50, degats: '1D+2', mains: 1, legere: true, mods: { PRD: -2 }, description: 'Une dague militaire correcte.' },
  { id: 'glaive-allonge', nom: 'Glaive allongé de Lapaille', type: 'arme', prix: 100, degats: '1D+3', mains: 1, mods: { PRD: -1 }, description: 'Une lame courte et solide, venue de Fernol.' },
  { id: 'glaive-bleusaille', nom: 'Glaive de bleusaille', type: 'arme', prix: 100, degats: '1D+4', mains: 1, mods: { COU: -1 }, description: "Le glaive des recrues de Waldorg. Il tape fort, mais il a une sale réputation." },
  { id: 'hache-bleusaille', nom: 'Hache de bleusaille', type: 'arme', prix: 100, degats: '1D+3', mains: 1, mods: { AT: 1, PRD: -1 }, description: 'Hache militaire pensée pour les nains.' },
  { id: 'hache-longue-bleusaille', nom: 'Hache longue de bleusaille', type: 'arme', prix: 100, degats: '1D+4', mains: 1, mods: { COU: -1 }, description: 'Une hache à long manche, utilisable à une main.' },
  { id: 'batarde', nom: 'Bâtarde de la Jolienne', type: 'arme', prix: 150, degats: '1D+4', mains: 2, bourrin: true, mods: { AT: -1, PRD: -1 }, description: 'Épée longue à deux mains, lourde et peu maniable.' },
  { id: 'claymore-bleusaille', nom: 'Claymore de bleusaille', type: 'arme', prix: 200, degats: '1D+6', mains: 2, bourrin: true, mods: { AT: -1, PRD: -2 }, description: 'La grande épée des soldats lourds. Il faut du bras.' },
  // --- Armes 1 main et 2 mains (Armement V2.3) ------------------------------
  { id: 'epee-perrave', nom: 'Épée 1 main perrave', type: 'arme', prix: 50, degats: '1D+3', mains: 1, mods: { CHA: -1, COU: -1, PRD: -1 }, description: 'Elle a l\'air d\'avoir déjà servi. À ouvrir des huîtres.' },
  { id: 'epee-correcte', nom: 'Épée 1 main correcte', type: 'arme', prix: 100, degats: '1D+3', mains: 1, mods: { PRD: -1 }, description: 'Une épée honnête, sans prétention.' },
  { id: 'epee-bonne', nom: 'Épée 1 main de bonne qualité', type: 'arme', prix: 200, degats: '1D+4', mains: 1, description: 'Bel acier, bonne prise en main.' },
  { id: 'hache-correcte', nom: 'Hache 1 main correcte', type: 'arme', prix: 100, degats: '1D+3', mains: 1, mods: { PRD: -2 }, description: 'Fend le bois comme les boucliers. Les nains la manient mieux (AT+1).' },
  { id: 'marteau-correct', nom: 'Marteau 1 main correct', type: 'arme', prix: 100, degats: '1D+3', mains: 1, mods: { PRD: -2 }, description: 'Pour les arguments contondants.' },
  { id: 'lance-base', nom: 'Lance de base', type: 'arme', prix: 20, degats: '1D+3', mains: 2, mods: { AT: -1, PRD: -2 }, description: 'Un bâton avec un bout pointu. Garde les ennuis à distance.' },
  { id: 'epee-2m-base', nom: 'Épée 2 mains de base', type: 'arme', prix: 100, degats: '1D+5', mains: 2, bourrin: true, mods: { AT: -3, PRD: -4 }, description: 'Lourde, mal équilibrée, mais elle coupe en deux.' },
  { id: 'hache-2m-grossiere', nom: 'Hache 2 mains grossière', type: 'arme', prix: 100, degats: '1D+5', mains: 2, bourrin: true, mods: { AT: -3, PRD: -4 }, description: 'Forgée à la va-vite par un bûcheron ambitieux.' },
  // --- Bâtons de mage (S'équiper : Mages et Sorciers) -----------------------
  { id: 'baton-sorcier-perrave', nom: 'Bâton de sorcier perrave', type: 'arme', prix: 40, degats: '1D', mains: 2, legere: true, mods: { CHA: -1, COU: -1 }, description: 'Un bâton de mage de niveau 1. Il permet de lancer des sorts, pas de se faire respecter.' },
  { id: 'baton-sorcier', nom: 'Bâton de sorcier de qualité moyenne', type: 'arme', prix: 80, degats: '1D+1', mains: 2, legere: true, description: 'Un vrai bâton de mage, qui frappe aussi correctement.' },

  // --- Armures (Armures et protections V3.0, torse) -------------------------
  { id: 'vetements-rembourres', nom: 'Gambison de base avec manches', type: 'armure', prix: 20, pr: 2, mods: { CHA: -1 }, description: "Une veste matelassée qui gratte. Amortit les coups de bâton." },
  { id: 'veste-cuir', nom: 'Veste de toile renforcée avec manches', type: 'armure', prix: 30, pr: 2, description: "Le minimum syndical de l'aventurier." },
  { id: 'gambison-correct', nom: 'Gambison correct avec manches', type: 'armure', prix: 50, pr: 2, description: 'Matelassé proprement, il ne gratte presque pas.' },
  { id: 'plastron-cuir', nom: 'Plastron de cuir de base', type: 'armure', prix: 30, pr: 3, mods: { CHA: -1 }, description: 'Du cuir épais, qui sent encore un peu la vache.' },
  { id: 'plastron-cuir-bouilli', nom: 'Plastron de cuir bouilli correct', type: 'armure', prix: 50, pr: 3, description: 'Dur comme du bois, et bien ajusté.' },
  { id: 'plastron-cuir-renforce', nom: 'Plastron de cuir renforcé métal', type: 'armure', prix: 200, pr: 4, mods: { AD: -1 }, description: 'Des plaques rivetées sur le cuir. Ça protège, ça gêne un peu.' },
  { id: 'cotte-sans-manches', nom: 'Cotte de mailles basique sans manches', type: 'armure', prix: 500, pr: 4, mods: { AD: -1 }, description: 'Des milliers d\'anneaux d\'acier. Ça cliquette.' },
  // Surplus militaire (Matériel pour les soldats)
  { id: 'tenue-eclaireur', nom: "Tenue d'éclaireur (surplus militaire)", type: 'armure', prix: 100, pr: 3, mods: { CHA: -1 }, description: 'Plastron, tabard, bottes et casque léger. Les couleurs de l\'unité ont été grattées.' },
  { id: 'tenue-lourde', nom: 'Tenue lourde (surplus militaire)', type: 'armure', prix: 100, pr: 5, mods: { CHA: -1 }, description: 'Plastron, cotte de mailles, casque renforcé. Nage impossible.' },

  // --- Potions (Potions et accessoires magiques V3.0) -----------------------
  { id: 'potion-soin', nom: 'Potion de soin effet léger', type: 'potion', prix: 30, soin: '5', description: 'Une fiole qui sent la menthe et le pied. Rend 5 PV.' },
  { id: 'potion-plaies', nom: 'Potion de réduction des plaies', type: 'potion', prix: 40, soin: '2', description: 'Rend 2 PV, stoppe les hémorragies et réduit les fractures.' },
  { id: 'potion-soin-forte', nom: 'Potion de soin effet majeur', type: 'potion', prix: 100, soin: '15', description: 'La vraie potion des aventuriers prudents. Rend 15 PV.' },

  // --- Matériel (Matériel et services V3.0) ----------------------------------
  { id: 'sac', nom: 'Sac à dos de base', type: 'materiel', prix: 4, description: 'Charge maximale : 10 kilos.' },
  { id: 'briquet', nom: 'Briquet', type: 'materiel', prix: 1, description: "Ne supporte pas l'immersion. Sinon, le MJ se barre." },
  { id: 'couverture', nom: "Couverture d'aventurier", type: 'materiel', prix: 2, description: 'En extérieur, permet une récupération normale.' },
  { id: 'gourde', nom: 'Outre de cuir (1 litre)', type: 'materiel', prix: 2, description: "Contient de l'eau. Ou autre chose." },
  { id: 'chaussettes', nom: 'Chaussettes (3 paires)', type: 'materiel', prix: 1, description: 'Hé ! Chaussette !!! Essentiel, et trop souvent oublié.' },
  { id: 'rations', nom: 'Rations de voyage (2 repas)', type: 'materiel', prix: 4, description: "Le dîner et le petit déjeuner d'un bivouac (2 PO le repas). Se conservent 7 jours." },
  { id: 'corde', nom: 'Corde standard (10 m)', type: 'materiel', prix: 10, description: 'Charge maximale : 80 kilos.' },
  { id: 'torche', nom: 'Torches (lot de 10)', type: 'materiel', prix: 1, description: 'Une heure de lumière chacune.' },
  { id: 'lampe', nom: 'Lampe à huile', type: 'materiel', prix: 5, description: 'Brûle 24 heures avec un flacon d\'huile.' },
  { id: 'matelas', nom: 'Matelas de camping', type: 'materiel', prix: 5, description: 'Améliore la récupération : +1 PV par heure de sommeil.' },
  { id: 'outils-crochetage', nom: 'Outils de crochetage', type: 'materiel', prix: 25, description: 'Pour les serrures récalcitrantes.', estime: true },
  { id: 'instrument', nom: 'Flûte en bois', type: 'materiel', prix: 20, description: 'Instrument qui produit un son correct.' },
];

export const objet = (id: string): Objet => {
  const o = OBJETS.find((x) => x.id === id);
  if (!o) throw new Error(`Objet inconnu : ${id}`);
  return o;
};

export const formatMods = (mods?: Partial<Record<Modif, number>>): string =>
  Object.entries(mods ?? {})
    .map(([k, v]) => `${k} ${v! > 0 ? '+' : ''}${v}`)
    .join(', ');
