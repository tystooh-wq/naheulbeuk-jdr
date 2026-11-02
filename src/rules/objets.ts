// Catalogue d'objets du prototype, tiré des tableaux officiels : Armement V2.3, Armures et protections V3.0,
// Matériel et services V3.0, Potions et accessoires magiques V3.0, S'équiper (mages), Instruments,
// plus les suppléments « Armement des soldats », « Matériel pour les soldats » et « Armement de Fernol ».
// Les objets marqués `estime` n'apparaissent dans aucun tableau : leurs valeurs sont provisoires.
// Les objets à moins d'une pièce d'or sont vendus par lots.

import CATALOGUE from './catalogue.json';

export type TypeObjet = 'arme' | 'armure' | 'potion' | 'materiel' | 'service';

/** Où se porte une protection. Les armures complètes couvrent tout (torse, tête, bras, jambes, mains, pieds). */
export type Emplacement = 'torse' | 'tete' | 'bras' | 'jambes' | 'mains' | 'pieds' | 'bouclier' | 'complete';

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
  /** Potion de mana : PA d'énergie astrale rendus. */
  mana?: number;
  estime?: boolean;
  /** Protections : où elles se portent (torse par défaut). */
  emplacement?: Emplacement;
  /** Tableau officiel et section d'origine, pour l'encyclopédie. */
  source?: string;
  categorie?: string;
  /** Effets tels qu'écrits dans le tableau (malus, bonus, durée…). */
  effets?: string;
  /** Point de rupture (« 1à4 », « Non »). */
  rupture?: string;
  /** Hors des boutiques : on ne le trouve que sur un cadavre ou dans un coffre. */
  catalogueSeul?: boolean;
  /** Objet de quête : ne se vend pas, ne se jette pas. */
  quete?: boolean;
  /** Arme à distance (règles V4, 8.11 à 8.14). */
  tir?: Tir;
  /** Projectile (flèche, carreau) : se consomme au tir. */
  munition?: Munition;
  /** Bonus aux dégâts du projectile (« Degâts +2 »). */
  bonusDegats?: number;
  /** Modificateur d'Adresse au tir (colonne d'effets « AD-2* »). */
  modTir?: number;
  /** Vendu par lot : l'achat met `nombre` exemplaires de `id` dans le sac. */
  lot?: { id: string; nombre: number };
}

export type Munition = 'fleche' | 'carreau';

export interface Tir {
  /** Assauts avant de pouvoir tirer à nouveau (tableau « Armes à distance usuelles »). */
  recharge: number;
  /** Ce qu'il faut dans le sac pour tirer ; sinon, c'est l'arme elle-même qu'on lance. */
  munition?: Munition;
  /** Arme de jet : lancée, elle reste par terre jusqu'à la fin du combat. */
  lancee?: boolean;
  /** Arme mécanique : pas de bonus de Force aux dégâts, +1 AD avec « Tirer correctement ». */
  mecanique?: boolean;
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
  // --- Spécialités de Valtordu (Valtordu pour le MJ, prix sur place) ---------------------------
  { id: 'feuille-boucher', nom: 'Feuille de boucher des Jobard', type: 'arme', prix: 25, degats: '1D+2', mains: 1, mods: { PRD: -1 }, estime: true, description: "Le grand couperet de la boucherie familiale. Tranche le jarret de porc comme le jarret de gobelin. Pare mal." },
  { id: 'boudin-valtordu', nom: 'Boudin de Valtordu, nature (petit)', type: 'materiel', prix: 1, soin: '2', source: 'Valtordu pour le MJ', categorie: 'Denrées locales', effets: '+1 COU pendant 4 h (non géré)', description: "Très bon et très riche : rend 2 PV au lieu du simple PV d'un repas. Se conserve 3 jours. Ailleurs, il se revend deux fois plus cher." },
  { id: 'boudin-epices', nom: 'Boudin aux épices (petit)', type: 'materiel', prix: 2, soin: '2', source: 'Valtordu pour le MJ', categorie: 'Denrées locales', description: 'Se conserve 7 jours. Rend 2 PV.' },
  { id: 'boudin-oignons', nom: 'Boudin aux oignons (petit)', type: 'materiel', prix: 2, soin: '2', source: 'Valtordu pour le MJ', categorie: 'Denrées locales', description: 'Rend 2 PV. Haleine garantie.' },
  { id: 'boudin-special', nom: 'Boudin « spécial » (petit)', type: 'materiel', prix: 3, soin: '2', source: 'Valtordu pour le MJ', categorie: 'Denrées locales', description: 'La recette est secrète. Rend 2 PV.' },
  { id: 'pull-valtordu', nom: 'Authentique pull de Valtordu', type: 'armure', prix: 40, pr: 1, mods: { CHA: -1, AD: -1 }, emplacement: 'torse', estime: true, source: 'Valtordu pour le MJ', categorie: 'Denrées locales', description: "Épais, chaud, lourd et affreux (sauf pour les vieilles dames). Immunité totale contre le rhume des pierres. La protection de 1 est une estimation." },
  // --- Projectiles par lots (prix unitaires du tableau d'armement) -----------------------------
  { id: 'fleches-lot', nom: 'Flèches de base (lot de 10)', type: 'materiel', prix: 5, lot: { id: 'fleche-de-base', nombre: 10 }, description: 'Dix flèches de base dans un carquois de fortune (0,5 PO pièce).' },
  { id: 'carreaux-lot', nom: 'Carreaux de base (lot de 10)', type: 'materiel', prix: 10, lot: { id: 'carreau-de-base', nombre: 10 }, description: "Dix carreaux d'arbalète de base (1 PO pièce)." },
  // --- Objets de quête ------------------------------------------------------------------------
  { id: 'colis-ozonuc', nom: "Colis d'herbes d'Archibald", type: 'materiel', prix: 0, quete: true, estime: true, description: 'À porter à la rebouteuse de Loubet. Ne pas manger.' },
  { id: 'lettre-loubet', nom: 'Lettre cachetée de la rebouteuse', type: 'materiel', prix: 0, quete: true, estime: true, description: 'Pour Archibald Ozonuc, à Valtordu. Elle sent la lavande.' },
  { id: 'foulard-brigand', nom: 'Foulard du chef des brigands', type: 'materiel', prix: 0, quete: true, estime: true, description: 'La preuve attendue par le seigneur de Valtordu.' },
  { id: 'certificat-donjon-facile', nom: 'Certificat du Donjon Facile', type: 'materiel', prix: 0, quete: true, estime: true, description: "« Aventurier certifié Donjon Facile ». Ça n'impressionne personne, mais c'est joli au mur." },
  { id: 'champignons-orange', nom: 'Champignons orange', type: 'materiel', prix: 2, estime: true, description: "Ramassés au bord du chemin. Comestibles ? Hallucinogènes ? Mortels ? Un alchimiste le saurait." },
  // --- Donjon de Naheulbeuk : clés et objets de quête (manuel du MJ, quêtes volume 1) -----------------
  { id: 'cle-chateau-valtordu', nom: 'Double de la clé du château de Valtordu', type: 'materiel', prix: 0, quete: true, estime: true, description: 'Prêté par le serrurier du village : la grande porte du château.' },
  { id: 'cle-souterrains-valtordu', nom: 'Clé des souterrains du château', type: 'materiel', prix: 0, quete: true, estime: true, description: 'Prise au chef des gardes du château de Valtordu : la grosse porte des souterrains.' },
  { id: 'cle-zombie', nom: 'Petite clé gluante', type: 'materiel', prix: 0, quete: true, estime: true, description: "Trouvée sur un zombie du rez-de-chaussée. Elle ouvre sûrement un coffre pas loin." },
  { id: 'cle-coffre-orques', nom: 'Clé du coffre des gardes', type: 'materiel', prix: 0, quete: true, estime: true, description: 'Prise au chef des orques du rez-de-chaussée : le coffre de leur dortoir.' },
  { id: 'cle-cave', nom: 'Grosse clé de la cave', type: 'materiel', prix: 0, quete: true, estime: true, description: "Prise au chef des orques : la porte entre l'escalier du rez-de-chaussée et la cave." },
  { id: 'cle-grille', nom: 'Clé de la grille', type: 'materiel', prix: 0, quete: true, estime: true, description: 'Une clé de gobelin, qui sent le troll. Elle ouvre la grille des souterrains.' },
  { id: 'cle-coffre-taverne', nom: 'Clé du coffre des orques de la taverne', type: 'materiel', prix: 0, quete: true, estime: true, description: 'Le petit coffre du dortoir des gardes, au niveau 1.' },
  { id: 'cle-chef-cuisinier', nom: 'Clé du chef cuisinier', type: 'materiel', prix: 0, quete: true, estime: true, description: 'La clé de ses appartements, au niveau 1. Elle sent l\'oignon.' },
  { id: 'cle-domestique', nom: 'Petite clé du domestique', type: 'materiel', prix: 0, quete: true, estime: true, description: 'Le coffret caché du débarras de la taverne : la cagnotte des domestiques.' },
  { id: 'cle-maraudeur', nom: 'Clé ensorcelée du maraudeur', type: 'materiel', prix: 0, quete: true, estime: true, description: 'Une des deux clés du trésor de Zangdar. L\'autre est sur Reivax.' },
  { id: 'cle-reivax', nom: 'Clé de Reivax', type: 'materiel', prix: 0, quete: true, estime: true, description: 'Son bureau, le bureau administratif, et la seconde serrure du trésor de Zangdar.' },
  { id: 'trousseau-zangdar', nom: 'Trousseau de Zangdar', type: 'materiel', prix: 0, quete: true, estime: true, description: 'Chambre, bibliothèque, laboratoires, et la serrure cachée de son bureau.' },
  { id: 'cle-liche', nom: 'Clé de la liche', type: 'materiel', prix: 0, quete: true, estime: true, description: 'La porte de sa demeure, au niveau 4. Sans elle, attention au claptor de Mazrok.' },
  { id: 'trousseau-geolier', nom: 'Trousseau des geôliers', type: 'materiel', prix: 0, quete: true, estime: true, description: 'Toutes les serrures des cachots du niveau 5.' },
  { id: 'statuette-zangdar', nom: 'Statuette de Gladeulfeurha', type: 'materiel', prix: 0, quete: true, estime: true, description: "Une statuette prophétique du placard de Zangdar. Elle est moche, et elle a l'air de te regarder." },
  { id: 'poudre-luzur', nom: 'Poudre bénite de Chnafon', type: 'materiel', prix: 0, quete: true, estime: true, description: 'À disperser dans le puits des âmes damnées, en lisant la formule. Ne pas éternuer.' },
  { id: 'bague-heritier', nom: "Bague de l'héritier", type: 'materiel', prix: 0, quete: true, estime: true, description: 'Un bijou de valeur, à échanger contre la broche que garde le troll enchaîné.' },
  { id: 'broche-blason', nom: 'Broche en or au blason', type: 'materiel', prix: 0, quete: true, estime: true, description: "La preuve qu'attend le notaire de Tulamor." },
  { id: 'recette-ours', nom: "Recette de l'ours à la bière", type: 'materiel', prix: 0, quete: true, estime: true, description: 'Pliée en quatre, tachée de sauce. Gros Didier va pleurer de joie.' },
  { id: 'passe-cdd', nom: 'Passe de la Caisse des Donjons', type: 'materiel', prix: 0, quete: true, estime: true, description: 'Un passe spécial, confié par un employé de la C.D.D.' },
  { id: 'dossier-factures', nom: 'Dossier de factures de Zangdar', type: 'materiel', prix: 0, quete: true, estime: true, description: 'Des factures « arrangées ». La preuve que la C.D.D. attendait.' },
  { id: 'bestiaire-interdit', nom: 'Bestiaire Démoniaque Interdit', type: 'materiel', prix: 0, quete: true, estime: true, description: 'Un livre rare et lourd, dont les pages chuchotent.' },
  { id: 'notes-protection', nom: 'Notes sur les sortilèges de protection', type: 'materiel', prix: 0, quete: true, estime: true, description: 'Les recherches de Zangdar, recopiées à la hâte.' },
  { id: 'gravure-robinet', nom: 'Gravure du Robinet Miraculeux', type: 'materiel', prix: 0, quete: true, estime: true, description: 'Pour le reconnaître parmi les robinets de Reivax.' },
  { id: 'robinet-miraculeux', nom: 'Robinet Miraculeux', type: 'materiel', prix: 0, quete: true, estime: true, description: "De l'eau tiède à toute heure. Un objet magique de grand prix, et un cadeau d'anniversaire." },
  { id: 'lettre-saril', nom: 'Lettre de change de Saril', type: 'materiel', prix: 0, quete: true, estime: true, description: "1000 PO payables à l'herboriste du donjon, pour du mélange Olitric." },
  { id: 'melange-olitric', nom: 'Mélange Olitric', type: 'materiel', prix: 0, quete: true, estime: true, description: "Une poudre d'herbes à l'odeur de foin mouillé, pour l'alchimiste Saril." },
  { id: 'plans-dirigeable', nom: 'Plans du dirigeable gobelin', type: 'materiel', prix: 0, quete: true, estime: true, description: 'Des schémas pleins de flèches, de taches de graisse et de mots gobelins.' },
  { id: 'gilderoy', nom: 'Gilderoy (qui te suit en râlant)', type: 'materiel', prix: 0, quete: true, estime: true, description: 'Le fils indigne, délivré des cachots. Il se plaint du froid, de ses pieds, et de toi.' },
  // --- Trophées de chasse et babioles (butin des combats ; valeurs estimées, à revendre) --------
  { id: 'peau-coyote', nom: 'Peau de coyote', type: 'materiel', prix: 3, estime: true, description: 'Mitée, mais un tanneur en donnera quelque chose.' },
  { id: 'corne-bouc', nom: 'Corne de bouc', type: 'materiel', prix: 4, estime: true, description: "Torsadée et pointue. Les sorciers en font de la poudre, les ménestrels des cors." },
  { id: 'dard-scorpion', nom: 'Dard de scorpion', type: 'materiel', prix: 6, estime: true, description: 'Encore plein de venin. À manipuler avec des gants, ou avec les doigts de quelqu\'un d\'autre.' },
  { id: 'queue-rat', nom: 'Queue de rat pesteux', type: 'materiel', prix: 1, estime: true, description: 'Certains apothicaires les achètent. Ne demande pas pourquoi.' },
  { id: 'jambon-mutant', nom: 'Jambon de cochon mutant', type: 'materiel', prix: 6, estime: true, description: 'Il a trois couennes et brille un peu dans le noir. Ça se mange, paraît-il.' },
  { id: 'plumes-chapon', nom: 'Plumes de chapon fanghien', type: 'materiel', prix: 5, estime: true, description: 'Très recherchées pour les chapeaux de ménestrel.' },
  { id: 'oeuf-chapon', nom: 'Œuf de chapon fanghien', type: 'materiel', prix: 15, estime: true, description: "Gros comme une tête de nain. Une omelette pour dix, ou un poussin très en colère." },
  { id: 'dent-ogre', nom: "Dent d'ogre", type: 'materiel', prix: 8, estime: true, description: 'Jaune, énorme, et un peu cariée. Un trophée qui impressionne en taverne.' },
  { id: 'cuir-aurochs', nom: "Cuir d'aurochs", type: 'materiel', prix: 20, estime: true, description: 'Épais et solide : de quoi faire un plastron chez un bon artisan.' },
  { id: 'laine-brebiphant', nom: 'Laine de brebiphant', type: 'materiel', prix: 12, estime: true, description: 'Un ballot de laine grise, chaude, et qui sent la trompe.' },
  { id: 'musc-dantragor', nom: 'Glande à musc de dantragor', type: 'materiel', prix: 25, estime: true, description: "Les parfumeurs de Glargh se l'arrachent. Le reste du monde la fuit." },
  { id: 'fourrure-morshleg', nom: 'Fourrure de morshleg', type: 'materiel', prix: 30, estime: true, description: 'Longue, rousse, et pleine de choses vivantes.' },
  { id: 'ecaille-dragon', nom: 'Écaille de jeune dragon', type: 'materiel', prix: 60, estime: true, description: 'Dure comme l\'acier et irisée. Un forgeron nain saurait quoi en faire.' },
  { id: 'gri-gri-orque', nom: "Gri-gri d'orque", type: 'materiel', prix: 2, estime: true, description: 'Un os, trois plumes et une ficelle. Porte bonheur, ou pas.' },
  { id: 'babiole-gobeline', nom: 'Babiole gobeline', type: 'materiel', prix: 1, estime: true, description: 'Un bouton, une cuillère tordue, une dent. Le trésor d\'un gobelin.' },
  { id: 'sac', nom: 'Sac à dos de base', type: 'materiel', prix: 4, description: 'Charge maximale : 10 kilos.' },
  { id: 'briquet', nom: 'Briquet', type: 'materiel', prix: 1, description: "Ne supporte pas l'immersion. Sinon, le MJ se barre." },
  { id: 'couverture', nom: "Couverture d'aventurier", type: 'materiel', prix: 2, description: 'En extérieur, permet une récupération normale.' },
  { id: 'gourde', nom: 'Outre de cuir (1 litre)', type: 'materiel', prix: 2, description: "Contient de l'eau. Ou autre chose." },
  { id: 'chaussettes', nom: 'Chaussettes (3 paires)', type: 'materiel', prix: 0.09, description: 'Hé ! Chaussette !!! Essentiel, et trop souvent oublié.' },
  { id: 'rations', nom: 'Rations de voyage (2 repas)', type: 'materiel', prix: 4, description: "Le dîner et le petit déjeuner d'un bivouac (2 PO le repas). Se conservent 7 jours." },
  { id: 'corde', nom: 'Corde standard (10 m)', type: 'materiel', prix: 10, description: 'Charge maximale : 80 kilos.' },
  { id: 'torche', nom: 'Torches (lot de 10)', type: 'materiel', prix: 0.1, description: 'Une heure de lumière chacune.' },
  { id: 'lampe', nom: 'Lampe à huile', type: 'materiel', prix: 5, description: 'Brûle 24 heures avec un flacon d\'huile.' },
  { id: 'matelas', nom: 'Matelas de camping', type: 'materiel', prix: 5, description: 'Améliore la récupération : +1 PV par heure de sommeil.' },
  { id: 'outils-crochetage', nom: 'Outils de crochetage', type: 'materiel', prix: 25, description: 'Pour les serrures récalcitrantes.', estime: true },
  { id: 'instrument', nom: 'Flûte en bois', type: 'materiel', prix: 20, description: 'Instrument qui produit un son correct.' },
];

// --- Le catalogue complet ----------------------------------------------------------
// Tous les objets des tableaux officiels (scripts/catalogue.py). Ceux que le jeu décrit déjà à la main
// ci-dessus gardent leur fiche ; les autres sont convertis tels quels.

interface LigneCatalogue {
  id: string;
  nom: string;
  fichier: string;
  type: TypeObjet;
  categorie: string;
  prix: number;
  degats?: string | null;
  pr?: number | null;
  effets?: string;
  rupture?: string | null;
  emplacement?: Emplacement;
  deuxMains?: boolean;
  duree?: string | null;
}

/** Objets décrits à la main qui existent aussi dans le catalogue : on ne les compte qu'une fois. */
const DOUBLONS: Record<string, string> = {
  gourdin: 'bonne-branche-gourdin-pied-de-chaise',
  'couteau-qualite': 'couteau-de-qualite',
  'poignard-base': 'poignard-de-base',
  'dague-base': 'dague-de-base',
  'dague-qualite': 'dague-bonne-qualite',
  'epee-perrave': 'epee-rapiere-sabre-1-main-perrave',
  'epee-correcte': 'epee-rapiere-sabre-1-main-correcte',
  'epee-bonne': 'epee-rapiere-sabre-1-main-bonne-qualite',
  'hache-correcte': 'hache-1-main-correcte',
  'marteau-correct': 'marteau-masse-1-main-correcte',
  'lance-base': 'lance-de-base',
  'epee-2m-base': 'epee-2-mains-de-base',
  'hache-2m-grossiere': 'hache-2-mains-grossiere',
  'baton-sorcier-perrave': 'baton-de-sorcier-perrave-niveau-1',
  'baton-sorcier': 'baton-de-sorcier-de-qualite-moyenne',
  'vetements-rembourres': 'gambison-de-base-avec-manches',
  'veste-cuir': 'veste-toile-renforcee-avec-manches',
  'gambison-correct': 'gambison-correct-avec-manches',
  'plastron-cuir': 'plastron-de-cuir-de-base',
  'plastron-cuir-bouilli': 'plastron-de-cuir-bouilli-correct',
  'plastron-cuir-renforce': 'plastron-de-cuir-renforce-metal',
  'cotte-sans-manches': 'cotte-de-mailles-basique-sans-manches',
  'potion-soin': 'potion-de-soin-effet-leger',
  'potion-plaies': 'potion-de-reduction-des-plaies',
  'potion-soin-forte': 'potion-de-soin-effet-majeur',
  sac: 'sac-a-dos-de-base',
  briquet: 'briquet',
  couverture: 'couverture-d-aventurier-2-kilos',
  gourde: 'outre-de-cuir-1-litre',
  chaussettes: 'chaussettes-he-chaussette',
  rations: 'ration-complete-de-voyage-1-repas',
  corde: 'corde-standard-le-metre',
  torche: 'torche',
  lampe: 'lampe-a-huile',
  matelas: 'matelas-de-camping-3-kilos',
  instrument: 'flute-en-bois',
};

const MODIFS: Modif[] = ['AT', 'PRD', 'COU', 'CHA', 'AD'];

/** Rechargement des armes à distance par famille (règles V4, tableau 8.12). */
const TIRS: [RegExp, Tir][] = [
  [/^Arcs/, { recharge: 2, munition: 'fleche' }], // règle maison (Sedy, 1/11) : officiel 3 assauts
  [/^Arbalètes/, { recharge: 4, munition: 'carreau', mecanique: true }], // règle maison : officiel 6
  [/^Haches de jet/, { recharge: 2, lancee: true }],
  [/^Javelots/, { recharge: 2, lancee: true }],
  [/^Sarbacane/, { recharge: 3 }],
  [/^Lance-pierre/, { recharge: 3 }],
  [/^Boomerang/, { recharge: 2 }],
  [/^Flèches pour arc|^Carreaux arbalète/, { recharge: 0 }],
];

/**
 * Lit les modificateurs permanents d'une colonne d'effets (« AT-2 PRD-4 CHA-1 · COU+1 »). On écarte ceux
 * qui ne valent que dans un cas précis : au jet (« AD+1* »), entre parenthèses (« AD+1 (discrétion) »)
 * ou réservés aux Nains (« Nain : AT+1 »).
 */
export const lireMods = (effets = ''): Partial<Record<Modif, number>> | undefined => {
  const texte = effets.split(/Nain :|\/ Nain/)[0];
  const mods: Partial<Record<Modif, number>> = {};
  for (const m of texte.matchAll(/\b(AT\/PRD|AT|PRD|AD|CHA|COU)([+-]\d+)(?![\d*])(?!\s*\()/g)) {
    const v = Number(m[2]);
    for (const k of m[1] === 'AT/PRD' ? (['AT', 'PRD'] as Modif[]) : [m[1] as Modif]) if (MODIFS.includes(k)) mods[k] = (mods[k] ?? 0) + v;
  }
  return Object.keys(mods).length ? mods : undefined;
};

const legere = (l: LigneCatalogue) => /Lames courtes|Bâtons|Récupération/.test(l.categorie) || /dague|poignard|couteau|gourdin|bâton/i.test(l.nom);

const depuisCatalogue = (l: LigneCatalogue): Objet => {
  const o: Objet = {
    id: l.id,
    nom: l.nom,
    type: l.type,
    prix: l.prix,
    description: [l.effets, l.duree && l.duree !== 'Permanent' ? `durée : ${l.duree}` : ''].filter(Boolean).join(' · ') || l.categorie,
    source: l.fichier,
    categorie: l.categorie,
    effets: l.effets,
    rupture: l.rupture ?? undefined,
    catalogueSeul: true,
  };
  const tir = TIRS.find(([motif]) => motif.test(l.categorie) || motif.test(l.nom));
  if (l.type === 'arme' && tir && !/Flèches|Carreaux/.test(l.categorie)) {
    const t = { ...tir[1] };
    if (/Temps recharg\. doublé/.test(l.effets ?? '')) t.recharge *= 2;
    o.tir = t;
    o.modTir = Number(/AD([+-]\d+)\*/.exec(l.effets ?? '')?.[1] ?? 0) || undefined;
  }
  if (/Flèches pour arc|Carreaux arbalète/.test(l.categorie)) {
    o.munition = /Flèches/.test(l.categorie) ? 'fleche' : 'carreau';
    o.modTir = Number(/AD([+-]\d+)\*/.exec(l.effets ?? '')?.[1] ?? 0) || undefined;
    o.bonusDegats = Number(/Deg[âa]ts \+(\d+)(?!D)/.exec(l.effets ?? '')?.[1] ?? 0) || undefined;
    o.type = 'materiel';
    return o;
  }
  if (l.type === 'arme') {
    // « 1D+2/1D+3* » : la seconde valeur est pour le jet ; « 2D+6 (feu) » : on garde les dés.
    o.degats = (l.degats ?? '1D').split(/[/ ]/)[0].replace('1+poison', '1');
    o.mains = l.deuxMains ? 2 : 1;
    o.bourrin = !!l.deuxMains && /Lames 2|Haches 2|Marteaux 2/.test(l.categorie);
    o.legere = legere(l);
    o.mods = lireMods(l.effets);
  }
  if (l.type === 'armure') {
    o.pr = l.pr ?? 0;
    o.emplacement = l.emplacement ?? 'torse';
    o.mods = lireMods(l.effets);
  }
  if (l.type === 'potion') {
    const soin = /Récup\. (\d+) ?PV/.exec(l.effets ?? '');
    if (soin) o.soin = soin[1];
    const mana = /Récup\. (\d+) ?PA/.exec(l.effets ?? '');
    if (mana) o.mana = Number(mana[1]);
  }
  return o;
};

const dejaDecrits = new Set(Object.values(DOUBLONS));
for (const [id, cat] of Object.entries(DOUBLONS)) {
  const o = OBJETS.find((x) => x.id === id);
  const l = (CATALOGUE as LigneCatalogue[]).find((x) => x.id === cat);
  if (o && l) Object.assign(o, { source: l.fichier, categorie: l.categorie, effets: l.effets, rupture: l.rupture ?? undefined });
}
OBJETS.push(...(CATALOGUE as LigneCatalogue[]).filter((l) => !dejaDecrits.has(l.id)).map(depuisCatalogue));

const PAR_ID = new Map(OBJETS.map((o) => [o.id, o]));

export const objet = (id: string): Objet => {
  const o = PAR_ID.get(id);
  if (!o) throw new Error(`Objet inconnu : ${id}`);
  return o;
};

export const formatMods = (mods?: Partial<Record<Modif, number>>): string =>
  Object.entries(mods ?? {})
    .map(([k, v]) => `${k} ${v! > 0 ? '+' : ''}${v}`)
    .join(', ');
