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

const mouvementReduit = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/**
 * Le dé est jeté sur la page : il arrive en roulant de plus loin, rebondit et s'arrête à sa place.
 * Chaque dé part d'un point un peu différent, et tourne dans un sens au hasard.
 */
const jeter = (el: HTMLElement, duree: number) => {
  if (mouvementReduit() || !el.animate) return el.classList.add('roule');
  const angle = Math.PI * (0.15 + Math.random() * 0.7);
  const distance = 170 + Math.random() * 120;
  const dx = Math.cos(angle) * distance * (Math.random() < 0.5 ? -1 : 1);
  const dy = Math.sin(angle) * distance * 0.6;
  const tours = (Math.random() < 0.5 ? -1 : 1) * (540 + Math.round(Math.random() * 360));
  const pos = (f: number, saut = 0, r = 1) => `translate(${dx * f}px, ${dy * f - saut}px) rotate(${tours * f * r}deg)`;
  el.classList.add('jete');
  el.animate(
    [
      { transform: `${pos(1, 0)} scale(1.15)`, offset: 0 },
      { transform: pos(0.45, 22), offset: 0.45 },
      { transform: pos(0.12, 0), offset: 0.7 },
      { transform: pos(0.04, 7), offset: 0.85 },
      { transform: 'none', offset: 1 },
    ],
    { duration: duree, easing: 'cubic-bezier(.25,.6,.35,1)' },
  ).finished.then(() => el.classList.remove('jete'), () => el.classList.remove('jete'));
};

/**
 * Anime des dés qui roulent sur la page pendant un court instant, puis affiche les valeurs finales.
 * Les valeurs sont tirées avant l'animation : l'animation ne fait que les révéler.
 */
export const animerDes = (conteneurs: HTMLElement[], faces: number, finales: number[], duree = 700): Promise<void> =>
  new Promise((resolve) => {
    duree = Math.max(duree, 750);
    conteneurs.forEach((el) => jeter(el, duree));
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

/**
 * Les dés que le joueur lance (classe `a-lancer`) se lancent en cliquant dessus : le bouton qui fait le
 * lancer est juste après le dé, ou dans le bloc `[data-lanceur]` qui l'entoure, et il est caché.
 * Le dé devient un vrai bouton pour le clavier (Entrée ou Espace).
 */
export const installerDesCliquables = () => {
  const declencheur = (d: HTMLElement): HTMLButtonElement | null => {
    const suivant = d.nextElementSibling;
    if (suivant instanceof HTMLButtonElement) return suivant;
    return d.closest('[data-lanceur]')?.querySelector<HTMLButtonElement>('button') ?? null;
  };
  const lancerDepuis = (d: HTMLElement) => {
    const b = declencheur(d);
    if (!b || b.disabled) return;
    const groupe = d.closest('[data-lanceur]') ?? d.parentElement;
    groupe?.querySelectorAll('.de.a-lancer').forEach((x) => {
      x.classList.remove('a-lancer');
      x.removeAttribute('tabindex');
      x.removeAttribute('role');
    });
    b.click();
  };
  const preparer = () =>
    document.querySelectorAll<HTMLElement>('.de.a-lancer:not([role])').forEach((d) => {
      const b = declencheur(d);
      if (!b) return;
      b.classList.add('lance-par-de');
      d.setAttribute('role', 'button');
      d.tabIndex = 0;
      d.title = `${b.textContent?.replace('🎲', '').trim() || 'Lancer'} : clique sur le dé`;
      d.setAttribute('aria-label', d.title);
    });
  new MutationObserver(preparer).observe(document.body, { childList: true, subtree: true });
  preparer();
  document.addEventListener('click', (e) => {
    const d = (e.target as HTMLElement).closest<HTMLElement>('.de.a-lancer[role=button]');
    if (d) lancerDepuis(d);
  });
  document.addEventListener('keydown', (e) => {
    const d = (e.target as HTMLElement).closest?.<HTMLElement>('.de.a-lancer[role=button]');
    if (d && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      lancerDepuis(d);
    }
  });
};
