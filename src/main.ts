import './style.css';
import { calculerFiche, type Personnage } from './rules/creation';
import { nouvellePartie, type Partie } from './rules/partie';
import { ecranCreation } from './ui/creation';
import { installerEncyclopedie } from './ui/encyclopedie';
import { ecranFiche } from './ui/fiche';
import { echapper } from './ui/outils';
import { charger, chargerPartie, effacerTout, sauvegarderPartie } from './ui/sauvegarde';
import { ecranMonde } from './ui/monde';
import { ecranVille } from './ui/ville';

const app = document.querySelector<HTMLDivElement>('#app')!;

const ficheAvantDepart = (perso: Personnage, enregistre = true) =>
  ecranFiche(app, calculerFiche(perso), accueil, {
    enregistre,
    suite: { libelle: 'Partir pour Waldorg', action: () => jouer(nouvellePartie(perso)) },
  });

const jouer = (partie: Partie) => {
  sauvegarderPartie(partie);
  const fiche = (retour: () => void, libelle: string) => () =>
    ecranFiche(app, calculerFiche(partie.perso), accueil, {
      enJeu: { or: partie.or, ev: partie.ev },
      suite: { libelle, action: retour },
    });
  const ville = () => {
    partie.zone = 'ville';
    sauvegarderPartie(partie);
    ecranVille(app, partie, fiche(ville, 'Retour en ville'), accueil, () => {
      partie.lieuMonde = 'waldorg';
      monde();
    });
  };
  const monde = () => {
    partie.zone = 'monde';
    sauvegarderPartie(partie);
    ecranMonde(app, partie, {
      ouvrirFiche: fiche(monde, 'Retour à la carte'),
      retourAccueil: accueil,
      entrerVille: () => {
        partie.lieu = 'porte';
        ville();
      },
      finDePartie: () => {
        effacerTout();
        accueil();
      },
    });
  };
  if (partie.zone === 'monde') monde();
  else ville();
};

export const accueil = () => {
  const partie = chargerPartie();
  const perso = partie?.perso ?? charger();
  app.innerHTML = `
    <div class="page">
      <h1>Naheulbeuk</h1>
      <p class="sous-titre">Le jeu de rôle où le MJ, c'est l'ordinateur. Et il n'est pas plus gentil qu'un vrai.</p>
      <p>En Terre de Fangh, on part à l'aventure avec ce qu'on a. Les dés décident de ton destin, et ils ne sont pas réputés pour leur bienveillance.</p>
      <div class="actions">
        ${perso ? `<button class="secondaire" id="continuer">Continuer avec ${echapper(perso.nom)}</button>` : '<span></span>'}
        <button id="nouvelle" class="droite">Créer un personnage</button>
      </div>
      <div id="confirmation" class="detail-choix" style="margin-top:20px" hidden>
        <p>Créer un nouveau personnage remplacera <b>${perso ? echapper(perso.nom) : ''}</b> et sa partie. On continue ?</p>
        <div class="actions" style="margin-top:12px">
          <button class="secondaire" id="annuler">Garder mon héros</button>
          <button class="droite" id="remplacer">Créer un nouveau personnage</button>
        </div>
      </div>
    </div>`;
  const creer = () => ecranCreation(app, accueil, ficheAvantDepart);
  const confirmation = app.querySelector<HTMLElement>('#confirmation')!;
  app.querySelector('#nouvelle')!.addEventListener('click', () => {
    if (perso) confirmation.hidden = false;
    else creer();
  });
  app.querySelector('#annuler')!.addEventListener('click', () => (confirmation.hidden = true));
  app.querySelector('#remplacer')!.addEventListener('click', creer);
  app.querySelector('#continuer')?.addEventListener('click', () => (partie ? jouer(partie) : ficheAvantDepart(perso!)));
};

installerEncyclopedie();
accueil();
