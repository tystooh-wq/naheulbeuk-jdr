export type Rng = () => number;

export const lancer = (faces: number, rng: Rng = Math.random): number => 1 + Math.floor(rng() * faces);

export const lancerPlusieurs = (nombre: number, faces: number, rng: Rng = Math.random): number[] =>
  Array.from({ length: nombre }, () => lancer(faces, rng));

export const somme = (des: number[]): number => des.reduce((a, b) => a + b, 0);
