export type Rng = () => number;

export const lancer = (faces: number, rng: Rng = Math.random): number => 1 + Math.floor(rng() * faces);

export const lancerPlusieurs = (nombre: number, faces: number, rng: Rng = Math.random): number[] =>
  Array.from({ length: nombre }, () => lancer(faces, rng));

/** Un générateur qui rend d'abord le dé lancé par le joueur (`valeur` sur `faces`), puis du hasard. */
export const avecDe = (valeur: number, faces: number, ensuite: Rng = Math.random): Rng => {
  let premier = true;
  return () => {
    if (!premier) return ensuite();
    premier = false;
    return (valeur - 0.5) / faces;
  };
};

export const somme = (des: number[]): number => des.reduce((a, b) => a + b, 0);
