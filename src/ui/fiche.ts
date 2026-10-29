import type { Fiche } from '../rules/creation';
import { CARACS, NOM_CARAC } from '../rules/types';
import { competences, echapper, liste } from './outils';

export const ecranFiche = (app: HTMLElement, f: Fiche, retourAccueil: () => void, enregistre = true) => {
  const p = f.personnage;
  const valeur = (titre: string, v: string | number) => `<div><b>${echapper(String(v))}</b><span>${echapper(titre)}</span></div>`;
  const signe = (n: number) => (n >= 0 ? `+${n}` : String(n));
  const identite = [f.nomVersionHB ?? f.origine.nom, f.metier.id === 'aucun' ? 'sans métier' : f.metier.nom.toLowerCase()].join(', ');

  app.innerHTML = `
    <div class="page">
      <div class="fiche-entete">
        <div>
          <div class="nom-heros">${echapper(p.nom)}</div>
          <div>${echapper(p.sexe)} · ${echapper(identite)} · niveau 1</div>
        </div>
        <div style="text-align:right">
          <div><b>${p.or}</b> pièces d'or</div>
          <div><b>${p.destin}</b> point${p.destin > 1 ? 's' : ''} de destin</div>
        </div>
      </div>

      <h3>Caractéristiques</h3>
      <div class="valeurs">${CARACS.map((c) => valeur(NOM_CARAC[c], f.caracs[c])).join('')}</div>

      <h3>Combat et énergies</h3>
      <div class="valeurs">
        ${valeur('Énergie vitale', f.ev)}
        ${f.ea ? valeur('Énergie astrale', f.ea) : ''}
        ${valeur('Attaque', f.at)}
        ${valeur('Parade', f.prd)}
        ${valeur('Bonus de dégâts', signe(f.bonusDegats))}
        ${valeur('Résistance magie', f.rm)}
        ${valeur('Armure max', f.prMax === null ? 'Libre' : `PR ${f.prMax}`)}
        ${valeur('Expérience', 0)}
      </div>

      <div class="colonnes">
        <div>
          <h3>Compétences</h3>
          ${competences([...f.competences.naissance, ...f.competences.heritees, ...f.competences.choisies])}
        </div>
        <div>
          <h3>Restrictions</h3>
          ${liste(f.restrictions)}
          ${f.bonus.length ? `<h3>Particularités</h3>${liste(f.bonus)}` : ''}
          <p><b>Charge maximale :</b> ${echapper(f.charge)}</p>
        </div>
      </div>

      <p class="note">${
        enregistre
          ? 'Ton héros est sauvegardé dans ce navigateur.'
          : "Ce navigateur ne permet pas de sauvegarder : ton héros sera perdu si tu fermes la page."
      }</p>

      <div class="actions">
        <button class="secondaire" id="accueil">Accueil</button>
        <button class="droite" id="aventure">Partir pour ${echapper(f.ville)}</button>
      </div>
      <div id="suite"></div>
    </div>`;

  app.querySelector('#accueil')!.addEventListener('click', retourAccueil);
  app.querySelector('#aventure')!.addEventListener('click', () => {
    app.querySelector('#suite')!.innerHTML = `
      <div class="detail-choix" style="margin-top:20px">
        <h3>La suite au prochain épisode</h3>
        <p>Ton héros arrivera à <b>${echapper(f.ville)}</b> avec ${p.or} pièces d'or en poche, pour y faire ses achats et trouver sa première quête.
        La ville et la carte du monde arrivent à l'étape 2 du prototype.</p>
      </div>`;
  });
};
