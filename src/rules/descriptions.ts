import type { Carac } from './types';

// Ce que vaut un score de caractéristique, de 8 (très bas) à 13 (exceptionnel), dans le ton de la Terre de Fangh.
const TEXTES: Record<Carac, Record<number, string>> = {
  COU: {
    8: "Mauviette. Tu sursautes quand une souris éternue, et tu fuis avant même qu'on sorte une épée.",
    9: "Prudent, pour être poli. Tu te bats si tu n'as vraiment pas le choix, et de préférence en dernier.",
    10: "Courage moyen : tu tiendras ta place dans la mêlée, tant que personne ne crie trop fort.",
    11: "Plutôt brave. Tu ouvres les portes de donjon sans trembler, enfin presque.",
    12: "Téméraire. Tu fonces dans le tas, ce qui fait de toi un excellent premier rang… et une cible.",
    13: "Héroïque, ou complètement inconscient. Tu toises les dragons et tu tapes le premier.",
  },
  INT: {
    8: "Tu comptes sur tes doigts, et tu en perds parfois. Lire une enseigne de taverne est un exploit.",
    9: "Pas le plus vif du groupe. Tu comprends les plans, à condition qu'on te les explique deux fois.",
    10: "Intelligence moyenne : tu sais lire une carte, tant qu'on ne te la donne pas à l'envers.",
    11: "Futé. Tu remarques les pièges grossiers et tu as toujours une idée, parfois bonne.",
    12: "Érudit. Les grimoires ne te font pas peur, et les énigmes de sphinx encore moins.",
    13: "Un cerveau rare en Terre de Fangh. Les mages t'envient, les barbares se méfient de toi.",
  },
  CHA: {
    8: "Même les rats t'évitent. Les marchands doublent leurs prix en te voyant arriver.",
    9: "On t'oublie dès que tu quittes la pièce, et parfois même avant.",
    10: "Charisme moyen : on t'écoute poliment, puis on fait ce qu'on voulait faire.",
    11: "Avenant. Les aubergistes te font crédit et les gardes te laissent parfois passer.",
    12: "Séduisant et convaincant. Tu obtiens des rabais, des confidences et des rendez-vous.",
    13: "Irrésistible. Les foules t'acclament, les bardes chantent ton nom (mal, mais quand même).",
  },
  AD: {
    8: "Maladroit notoire. Tu trébuches sur ton ombre et ton épée est un danger pour tes amis.",
    9: "Pas très adroit. Tu rates souvent la marche, et parfois la cible.",
    10: "Moyennement adroit : tu pourrais servir dans une auberge, mais oublie le cirque.",
    11: "Habile de tes mains. Tu crochètes une serrure simple et tu rattrapes ta chope au vol.",
    12: "Agile comme un chat. Tu jongles, tu grimpes, tu esquives avec style.",
    13: "Une adresse d'acrobate elfique. Tu atteins une pomme à cinquante pas, les yeux bandés.",
  },
  FO: {
    8: "La force d'un flan aux fruits. Porter ton propre sac est déjà une aventure.",
    9: "Pas bien costaud. Tu soulèves une chope pleine, mais tu évites les tonneaux.",
    10: "Force moyenne : tu portes ton équipement sans te plaindre, du moins pas trop.",
    11: "Solide. Tu enfonces une porte vermoulue et tu gagnes au bras de fer contre un nain fatigué.",
    12: "Costaud. Tu portes un camarade blessé sur ton dos et tu manies les grosses haches.",
    13: "Une force de taureau. Tes coups font mal, très mal, et les portes n'ont qu'à bien se tenir.",
  },
};

export const descriptionCarac = (c: Carac, score: number): string =>
  TEXTES[c][Math.min(13, Math.max(8, score))] +
  (score > 13 ? ' Et même au-delà : on parlera de toi dans les tavernes.' : '') +
  (score < 8 ? ' En pire.' : '');
