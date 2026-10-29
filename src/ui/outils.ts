import { trouverCompetence } from '../rules/creation';
import { lancer } from '../rules/des';

export const echapper = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export const liste = (items: string[]): string =>
  items.length ? `<ul>${items.map((i) => `<li>${echapper(i)}</li>`).join('')}</ul>` : '<p class="note">Aucune.</p>';

/** Une compétence dépliable avec sa description du livret. */
export const competence = (nom: string): string => {
  const c = trouverCompetence(nom);
  const stat = c.stat ? ` <span class="pastille">(${echapper(c.stat)})</span>` : '';
  return `<details class="competence"><summary>${echapper(nom)}${stat}</summary><p>${echapper(c.texte)}</p></details>`;
};

export const competences = (noms: string[]): string =>
  noms.length ? noms.map(competence).join('') : '<p class="note">Aucune.</p>';

export const de = (valeur: number | string, classe = ''): string => `<span class="de ${classe}">${valeur}</span>`;

/**
 * Anime des dés qui roulent pendant un court instant, puis affiche les valeurs finales.
 * Les valeurs sont tirées avant l'animation : l'animation ne fait que les révéler.
 */
export const animerDes = (conteneurs: HTMLElement[], faces: number, finales: number[], duree = 700): Promise<void> =>
  new Promise((resolve) => {
    conteneurs.forEach((el) => el.classList.add('roule'));
    const minuteur = setInterval(() => conteneurs.forEach((el) => (el.textContent = String(lancer(faces)))), 70);
    setTimeout(() => {
      clearInterval(minuteur);
      conteneurs.forEach((el, i) => {
        el.classList.remove('roule');
        el.textContent = String(finales[i]);
      });
      resolve();
    }, duree);
  });
