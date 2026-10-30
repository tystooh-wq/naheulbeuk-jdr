import { objet, type Objet } from '../rules/objets';
import { calculerFiche } from '../rules/creation';
import { ambidextre, emplacementDe, essaiEquiper, mainGauche, type CleEquipement, type Partie } from '../rules/partie';
import { echapper } from './outils';

// Le bonhomme d'équipement, d'après la fiche de personnage officielle : un emplacement par localisation
// (tête, torse, bras, mains, jambes, pieds), le bouclier, une arme dans chaque main et l'arme à distance.
// Survoler un objet du sac allume les emplacements où il irait : vert s'il y va, rouge sinon (avec la raison).

const CASES: [CleEquipement, string][] = [
  ['distance', 'Dos (tir)'],
  ['tete', 'Tête'],
  ['bouclier', 'Bouclier'],
  ['arme', 'Main droite'],
  ['armure', 'Torse'],
  ['armeGauche', 'Main gauche'],
  ['mains', 'Mains'],
  ['bras', 'Bras'],
  ['jambes', 'Jambes'],
  ['pieds', 'Pieds'],
];

const PIECES: CleEquipement[] = ['tete', 'bras', 'jambes', 'mains', 'pieds'];

/** Pourquoi cet emplacement est fermé en ce moment (null : libre ou occupé normalement). */
const verrou = (p: Partie, cle: CleEquipement): string | null => {
  const e = p.equipe;
  const complete = e.armure && objet(e.armure).emplacement === 'complete';
  if (complete && PIECES.includes(cle)) return "Couvert par l'armure complète";
  const deuxMains = e.arme && objet(e.arme).mains === 2;
  if (cle === 'bouclier' && !e.bouclier) {
    if (deuxMains) return 'Arme à deux mains';
    if (e.armeGauche) return 'Main gauche armée';
  }
  if (cle === 'armeGauche' && !e.armeGauche) {
    if (!ambidextre(p)) return 'Ambidextrie, niveau 2';
    if (deuxMains) return 'Arme à deux mains';
    if (e.bouclier) return 'Le bouclier y est';
  }
  if (cle === 'distance' && !e.distance && calculerFiche(p.perso).metier.id === 'mage') return 'Pas pour un mage';
  return null;
};

const resume = (o: Objet) => [o.degats ? `${o.degats}` : '', o.pr ? `PR ${o.pr}` : '', o.mains === 2 ? '2 mains' : ''].filter(Boolean).join(' · ');

const caseHtml = (p: Partie, cle: CleEquipement, titre: string) => {
  const id = p.equipe[cle];
  const ferme = id ? null : verrou(p, cle);
  const o = id ? objet(id) : undefined;
  let note = '';
  if (cle === 'armeGauche' && id) {
    const g = mainGauche(p);
    note = g && 'refus' in g ? g.refus : g ? `2e attaque à AT ${g.at}` : '';
  }
  return `<div class="case-equipement ${o ? 'pleine' : ferme ? 'fermee' : 'vide'}" data-case-equipement="${cle}" style="grid-area:${cle}">
    <span class="titre-case">${titre}</span>
    ${
      o
        ? `<b>${echapper(o.nom)}</b><span class="note">${echapper(resume(o))}</span>${note ? `<span class="note">${echapper(note)}</span>` : ''}<button class="secondaire petit retirer" data-emplacement="${cle}">Retirer</button>`
        : `<span class="note">${echapper(ferme ?? (cle === 'arme' ? 'Mains nues (1D-2)' : 'Libre'))}</span>`
    }
  </div>`;
};

/** Le bonhomme et ses emplacements. */
export const poupee = (p: Partie) => {
  const complete = p.equipe.armure && objet(p.equipe.armure).emplacement === 'complete';
  return `<div class="poupee">
    <svg class="silhouette" viewBox="0 0 100 200" aria-hidden="true">
      <circle cx="50" cy="22" r="15" />
      <path d="M30 42 h40 q8 0 9 9 l9 52 q1 6 -5 7 q-5 1 -6 -5 l-8 -40 v42 l5 85 q0 6 -7 6 q-6 0 -7 -6 l-9 -70 l-9 70 q-1 6 -7 6 q-7 0 -7 -6 l5 -85 v-42 l-8 40 q-1 6 -6 5 q-6 -1 -5 -7 l9 -52 q1 -9 9 -9 z" />
    </svg>
    ${CASES.map(([cle, titre]) => caseHtml(p, cle, cle === 'armure' && complete ? 'Armure complète' : titre)).join('')}
    <p class="apercu-equipement note" aria-live="polite">Survole un objet du sac pour voir où il irait.</p>
  </div>`;
};

/** Où cet objet du sac pourrait aller, pour l'aperçu sur le bonhomme : [emplacement, raison du refus ou ''][]. */
export const apercu = (p: Partie, id: string): [CleEquipement, string][] => {
  const o = objet(id);
  const cle = emplacementDe(o);
  if (!cle) return [];
  const cases: CleEquipement[] = cle === 'arme' && o.mains !== 2 ? ['arme', 'armeGauche'] : [cle];
  return cases.map((k) => {
    const e = essaiEquiper(p, id, k);
    return [k, e.refus ?? ''];
  });
};

/** Allume les emplacements quand on survole (ou qu'on parcourt au clavier) un objet du sac. */
export const lierPoupee = (app: HTMLElement) => {
  const texte = app.querySelector<HTMLElement>('.apercu-equipement');
  const eteindre = () => {
    app.querySelectorAll('.case-equipement').forEach((c) => c.classList.remove('apercu-oui', 'apercu-non'));
    if (texte) texte.textContent = 'Survole un objet du sac pour voir où il irait.';
  };
  app.querySelectorAll<HTMLElement>('[data-apercu]').forEach((ligne) => {
    const allumer = () => {
      eteindre();
      const cases = JSON.parse(ligne.dataset.apercu!) as [CleEquipement, string][];
      const nom = ligne.querySelector('b')?.textContent ?? '';
      const lignes: string[] = [];
      for (const [cle, refus] of cases) {
        const c = app.querySelector(`[data-case-equipement="${cle}"]`);
        c?.classList.add(refus ? 'apercu-non' : 'apercu-oui');
        const titre = c?.querySelector('.titre-case')?.textContent ?? cle;
        lignes.push(refus ? `${titre} : non, ${refus.charAt(0).toLowerCase()}${refus.slice(1)}` : `${titre} : oui`);
      }
      if (texte) texte.textContent = `${nom}. ${lignes.join(' · ')}`;
    };
    ligne.addEventListener('mouseenter', allumer);
    ligne.addEventListener('focusin', allumer);
    ligne.addEventListener('mouseleave', eteindre);
  });
};
