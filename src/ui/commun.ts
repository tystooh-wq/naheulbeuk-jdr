import { calculerFiche } from '../rules/creation';
import { formatMods, objet, type Objet } from '../rules/objets';
import {
  boirePotion,
  desequiper,
  EMPLACEMENTS,
  type CleEquipement,
  equiper,
  evMax,
  formatHeure,
  noter,
  peutManier,
  peutPorter,
  valeursCombat,
  type Partie,
} from '../rules/partie';
import { de, echapper } from './outils';

// Éléments partagés par la ville et la carte du monde : bandeau du héros, sac, journal, vitesse.

// --- Vitesse de marche ------------------------------------------------------------

const VITESSES = [1, 2, 4];
const CLE_VITESSE = 'naheulbeuk.vitesse';

/** Réglage propre à chaque joueur, retenu dans son navigateur s'il le permet. */
const lireVitesse = (): number => {
  try {
    const v = Number(localStorage.getItem(CLE_VITESSE));
    return VITESSES.includes(v) ? v : 1;
  } catch {
    return 1;
  }
};

let vitesseChoisie = lireVitesse();

export const vitesse = () => vitesseChoisie;

export const boutonsVitesse = () =>
  `<span class="vitesse" role="group" aria-label="Vitesse de marche">Vitesse ${VITESSES.map(
    (v) => `<button class="secondaire petit ${v === vitesseChoisie ? 'actif' : ''}" data-vitesse="${v}" aria-pressed="${v === vitesseChoisie}">×${v}</button>`,
  ).join('')}</span>`;

export const lierVitesse = (app: HTMLElement) =>
  app.querySelectorAll<HTMLElement>('[data-vitesse]').forEach((el) =>
    el.addEventListener('click', () => {
      vitesseChoisie = Number(el.dataset.vitesse);
      try {
        localStorage.setItem(CLE_VITESSE, String(vitesseChoisie));
      } catch {
        // Pas de stockage : le réglage vaut pour cette visite seulement.
      }
      // Pas de nouveau rendu : le héros est peut-être en train de marcher.
      app.querySelectorAll<HTMLElement>('[data-vitesse]').forEach((b) => {
        const actif = Number(b.dataset.vitesse) === vitesseChoisie;
        b.classList.toggle('actif', actif);
        b.setAttribute('aria-pressed', String(actif));
      });
    }),
  );

// --- Bandeau du héros -------------------------------------------------------------

export const bandeau = (p: Partie, vue: string, nomCarte: string) => {
  const f = calculerFiche(p.perso);
  return `<div class="bandeau">
    <div><b class="nom-court">${echapper(p.perso.nom)}</b> <span class="note">${echapper(f.nomVersionHB ?? f.origine.nom)}</span></div>
    <div class="jauges">
      <span title="Énergie vitale">❤ <b>${p.ev}</b>/${evMax(p)}</span>
      <span title="Pièces d'or">● <b>${p.or}</b> PO</span>
      <span title="Points de destin">✦ <b>${p.perso.destin}</b></span>
      <span title="Expérience">★ <b>${p.xp ?? 0}</b> XP</span>
      <span title="Jour et heure" id="horloge">${p.heure >= 20 || p.heure < 6 ? '☾' : '☼'} jour <b>${p.jour}</b>, ${formatHeure(p.heure)}</span>
    </div>
    <div class="onglets">
      <button class="secondaire petit ${vue === 'lieu' ? 'actif' : ''}" data-vue="lieu">${nomCarte}</button>
      <button class="secondaire petit ${vue === 'sac' ? 'actif' : ''}" data-vue="sac">Sac et équipement</button>
      <button class="secondaire petit ${vue === 'journal' ? 'actif' : ''}" data-vue="journal">Journal</button>
      <button class="secondaire petit" id="fiche">Fiche</button>
    </div>
  </div>`;
};

/** Met à jour l'horloge sans tout redessiner (pendant un voyage). */
export const majHorloge = (app: HTMLElement, p: Partie) => {
  const h = app.querySelector('#horloge');
  if (h) h.innerHTML = `${p.heure >= 20 || p.heure < 6 ? '☾' : '☼'} jour <b>${p.jour}</b>, ${formatHeure(p.heure)}`;
};

// --- Objets, sac et journal --------------------------------------------------------

export const ligneObjet = (p: Partie, o: Objet, droite: string) => {
  const fiche = calculerFiche(p.perso);
  const refus = o.type === 'arme' ? peutManier(fiche, o) : o.type === 'armure' ? peutPorter(fiche, o) : null;
  const details = [
    o.degats ? `Dégâts ${o.degats}` : '',
    o.pr ? `PR ${o.pr}` : '',
    o.mains === 2 ? '2 mains' : '',
    o.soin ? `Rend ${o.soin} PV` : '',
    formatMods(o.mods),
  ].filter(Boolean);
  return `<div class="objet">
    <div class="objet-texte">
      <b>${echapper(o.nom)}</b>${o.estime ? ' <span class="pastille" title="Valeurs provisoires : aucun tableau officiel">(estimé)</span>' : ''}
      ${details.length ? `<div class="pastille">${echapper(details.join(' · '))}</div>` : ''}
      <div class="note">${echapper(o.description)}</div>
      ${refus ? `<div class="alerte petit-texte">${echapper(refus)}</div>` : ''}
    </div>
    <div class="objet-action">${droite}</div>
  </div>`;
};

export const panneauSac = (p: Partie, message?: string) => {
  const v = valeursCombat(p);
  const emplacement = (titre: string, cle: CleEquipement) => {
    const id = p.equipe[cle];
    if (!id && cle !== 'arme' && cle !== 'armure') return '';
    return ligneObjet(
      p,
      id ? objet(id) : { id: '', nom: 'Rien', type: 'materiel', prix: 0, description: cle === 'arme' ? 'Tu te bats à mains nues (1D-2).' : 'Aucune protection.' },
      id ? `<button class="secondaire petit retirer" data-emplacement="${cle}">Retirer</button>` : '',
    ).replace('<b>', `<span class="pastille">${titre}</span><br /><b>`);
  };
  const ids = [...new Set(p.sac)];
  return `<div class="panneau">
    <h2>Sac et équipement</h2>
    <div class="valeurs">
      <div><b>${v.at}</b><span>Attaque</span></div>
      <div><b>${v.prd}</b><span>Parade</span></div>
      <div><b>${echapper(v.degats)}</b><span>Dégâts</span></div>
      <div><b>${v.pr}</b><span>Protection</span></div>
      <div><b>${v.cha}</b><span>Charisme</span></div>
    </div>
    ${EMPLACEMENTS.map(([cle, titre]) => emplacement(cle === 'armure' && p.equipe.armure && objet(p.equipe.armure).emplacement === 'complete' ? 'Armure complète' : titre, cle)).join('')}
    <h3 style="margin-top:16px">Dans le sac</h3>
    ${
      ids.length
        ? ids
            .map((id) => {
              const o = objet(id);
              const nb = p.sac.filter((x) => x === id).length;
              const bouton =
                o.type === 'arme' || o.type === 'armure'
                  ? `<button class="secondaire petit equiper" data-id="${id}">Équiper</button>`
                  : o.type === 'potion' && o.soin
                    ? `<button class="secondaire petit boire" data-id="${id}">Boire</button>`
                    : '';
              return ligneObjet(p, o, `<span class="pastille">×${nb}</span> ${bouton}`);
            })
            .join('')
        : '<p class="note">Ton sac est vide. Même pas une chaussette.</p>'
    }
    ${message ? `<div class="recit">${message}</div>` : ''}
  </div>`;
};

export const panneauJournal = (p: Partie) => `<div class="panneau">
  <h2>Journal</h2>
  <ul class="journal">${p.journal.map((j) => `<li>${echapper(j)}</li>`).join('')}</ul>
</div>`;

/** Boutons du sac : équiper, retirer, boire. `message` affiche le résultat et redessine. */
export const lierSac = (app: HTMLElement, p: Partie, message: (html: string) => void) => {
  const sur = (sel: string, fn: (el: HTMLElement) => void) =>
    app.querySelectorAll<HTMLElement>(sel).forEach((el) => el.addEventListener('click', () => fn(el)));
  sur('.equiper', (el) => {
    const o = objet(el.dataset.id!);
    const refus = equiper(p, o.id);
    message(refus ? `<span class="alerte">${echapper(refus)}</span>` : `Tu t'équipes : <b>${echapper(o.nom)}</b>.`);
  });
  sur('.retirer', (el) => {
    desequiper(p, el.dataset.emplacement as CleEquipement);
    message('Rangé dans le sac.');
  });
  sur('.boire', (el) => {
    const r = boirePotion(p, el.dataset.id!);
    if (typeof r === 'string') return message(echapper(r));
    noter(p, `boit une potion et récupère ${r.rendu} PV.`);
    message(`${r.des.map((d) => de(d)).join('')} Glou glou… Tu récupères <b>${r.rendu} PV</b>.`);
  });
};
