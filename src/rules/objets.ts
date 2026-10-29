// Catalogue d'objets du prototype.
// Prix et valeurs « officiel » : tableaux « Armement des soldats » et « Matériel pour les soldats » V1.0,
// et « Armement de Fernol » V1.0. Les objets marqués `estime` n'ont pas encore de source officielle :
// leurs valeurs sont provisoires, à remplacer par les tableaux d'équipement de base.

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
  // --- Armes -----------------------------------------------------------------
  { id: 'baton', nom: 'Bâton de marche', type: 'arme', prix: 8, degats: '1D+1', mains: 2, legere: true, description: "Un bon bout de bois. Sert aussi à tâter le sol des donjons.", estime: true },
  { id: 'gourdin', nom: 'Gourdin', type: 'arme', prix: 5, degats: '1D+2', mains: 1, legere: true, mods: { PRD: -1 }, description: "Une branche noueuse. Rustique, mais ça cogne.", estime: true },
  { id: 'dague-bleusaille', nom: 'Dague de bleusaille', type: 'arme', prix: 15, degats: '1D+2', mains: 1, legere: true, mods: { AT: -1, PRD: -2 }, description: "Dague réglementaire des recrues. Le fil laisse à désirer." },
  { id: 'dague-recourbee', nom: 'Dague recourbée de Lapaille', type: 'arme', prix: 50, degats: '1D+2', mains: 1, legere: true, mods: { PRD: -2 }, description: 'Une dague fernolienne en bon acier, bien affûtée.' },
  { id: 'dague-premiere', nom: 'Dague de première classe', type: 'arme', prix: 50, degats: '1D+2', mains: 1, legere: true, mods: { PRD: -2 }, description: 'Une dague militaire correcte.' },
  { id: 'glaive-allonge', nom: 'Glaive allongé de Lapaille', type: 'arme', prix: 100, degats: '1D+3', mains: 1, mods: { PRD: -1 }, description: 'Une lame courte et solide, venue de Fernol.' },
  { id: 'glaive-bleusaille', nom: 'Glaive de bleusaille', type: 'arme', prix: 100, degats: '1D+4', mains: 1, mods: { COU: -1 }, description: "Le glaive des recrues de Waldorg. Il tape fort, mais il a une sale réputation." },
  { id: 'hache-bleusaille', nom: 'Hache de bleusaille', type: 'arme', prix: 100, degats: '1D+3', mains: 1, mods: { AT: 1, PRD: -1 }, description: 'Hache militaire pensée pour les nains.' },
  { id: 'hache-longue-bleusaille', nom: 'Hache longue de bleusaille', type: 'arme', prix: 100, degats: '1D+4', mains: 1, mods: { COU: -1 }, description: 'Une hache à long manche, utilisable à une main.' },
  { id: 'batarde', nom: 'Bâtarde de la Jolienne', type: 'arme', prix: 150, degats: '1D+4', mains: 2, bourrin: true, mods: { AT: -1, PRD: -1 }, description: 'Épée longue à deux mains, lourde et peu maniable.' },
  { id: 'claymore-bleusaille', nom: 'Claymore de bleusaille', type: 'arme', prix: 200, degats: '1D+6', mains: 2, bourrin: true, mods: { AT: -1, PRD: -2 }, description: 'La grande épée des soldats lourds. Il faut du bras.' },

  // --- Armures -----------------------------------------------------------------
  { id: 'vetements-rembourres', nom: 'Vêtements rembourrés', type: 'armure', prix: 15, pr: 1, mods: { CHA: -1 }, description: "Des habits épais, un peu ridicules, qui amortissent les coups de bâton.", estime: true },
  { id: 'veste-cuir', nom: 'Veste de cuir', type: 'armure', prix: 40, pr: 2, description: 'Cuir épais et ceinture large. Le minimum syndical de l\'aventurier.', estime: true },
  { id: 'tenue-eclaireur', nom: "Tenue d'éclaireur (surplus militaire)", type: 'armure', prix: 100, pr: 3, mods: { CHA: -1 }, description: 'Plastron, tabard, bottes et casque léger. Les couleurs de l\'unité ont été grattées.' },
  { id: 'tenue-lourde', nom: 'Tenue lourde (surplus militaire)', type: 'armure', prix: 100, pr: 5, mods: { CHA: -1 }, description: 'Plastron, cotte de mailles, casque renforcé. Nage impossible.' },

  // --- Potions -------------------------------------------------------------------
  { id: 'potion-soin', nom: 'Petite potion de soin', type: 'potion', prix: 20, soin: '1D+2', description: 'Une fiole qui sent la menthe et le pied. Rend un peu de vie.', estime: true },
  { id: 'potion-soin-forte', nom: 'Potion de soin', type: 'potion', prix: 45, soin: '2D+4', description: 'La vraie potion des aventuriers prudents.', estime: true },

  // --- Matériel ------------------------------------------------------------------
  { id: 'sac', nom: "Sac d'aventurier", type: 'materiel', prix: 4, description: 'Pour transporter ses bricoles.', estime: true },
  { id: 'briquet', nom: 'Briquet', type: 'materiel', prix: 2, description: 'Sinon, le MJ se barre.', estime: true },
  { id: 'couverture', nom: 'Couverture', type: 'materiel', prix: 3, description: 'Pour dormir à la belle étoile sans geler.', estime: true },
  { id: 'gourde', nom: 'Gourde', type: 'materiel', prix: 2, description: 'Contient de l\'eau. Ou autre chose.', estime: true },
  { id: 'chaussettes', nom: 'Chaussettes de rechange', type: 'materiel', prix: 1, description: 'Essentiel, et trop souvent oublié.', estime: true },
  { id: 'rations', nom: 'Rations (3 jours)', type: 'materiel', prix: 3, description: 'Pain sec, fromage dur et lard. Ça cale.', estime: true },
  { id: 'corde', nom: 'Corde (10 m)', type: 'materiel', prix: 5, description: 'On en a toujours besoin, surtout quand on ne l\'a pas.', estime: true },
  { id: 'torche', nom: 'Torche', type: 'materiel', prix: 1, description: 'Une heure de lumière dans les ténèbres.', estime: true },
  { id: 'outils-crochetage', nom: 'Outils de crochetage', type: 'materiel', prix: 25, description: 'Pour les serrures récalcitrantes.', estime: true },
  { id: 'instrument', nom: 'Luth de voyage', type: 'materiel', prix: 60, description: 'Un instrument de ménestrel, presque accordé.', estime: true },
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
