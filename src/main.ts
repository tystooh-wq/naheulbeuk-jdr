import './style.css';
import { ecranCreation } from './ui/creation';
import { charger } from './ui/sauvegarde';
import { ecranFiche } from './ui/fiche';
import { calculerFiche } from './rules/creation';
import { echapper } from './ui/outils';

const app = document.querySelector<HTMLDivElement>('#app')!;

export const accueil = () => {
  const sauvegarde = charger();
  app.innerHTML = `
    <div class="page">
      <h1>Naheulbeuk</h1>
      <p class="sous-titre">Le jeu de rôle où le MJ, c'est l'ordinateur. Et il n'est pas plus gentil qu'un vrai.</p>
      <p>En Terre de Fangh, on part à l'aventure avec ce qu'on a. Les dés décident de ton destin, et ils ne sont pas réputés pour leur bienveillance.</p>
      <div class="actions">
        ${sauvegarde ? '<button class="secondaire" id="continuer">Continuer avec mon héros</button>' : '<span></span>'}
        <button id="nouvelle" class="droite">Créer un personnage</button>
      </div>
      <div id="confirmation" class="detail-choix" style="margin-top:20px" hidden>
        <p>Créer un nouveau personnage remplacera <b>${sauvegarde ? echapper(sauvegarde.nom) : ''}</b>. On continue ?</p>
        <div class="actions" style="margin-top:12px">
          <button class="secondaire" id="annuler">Garder mon héros</button>
          <button class="droite" id="remplacer">Créer un nouveau personnage</button>
        </div>
      </div>
    </div>`;
  const confirmation = app.querySelector<HTMLElement>('#confirmation')!;
  app.querySelector('#nouvelle')!.addEventListener('click', () => {
    if (sauvegarde) confirmation.hidden = false;
    else ecranCreation(app, accueil);
  });
  app.querySelector('#annuler')!.addEventListener('click', () => (confirmation.hidden = true));
  app.querySelector('#remplacer')!.addEventListener('click', () => ecranCreation(app, accueil));
  app.querySelector('#continuer')?.addEventListener('click', () => ecranFiche(app, calculerFiche(sauvegarde!), accueil));
};

accueil();
