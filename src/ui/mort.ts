import { evMax, noter, type Partie } from '../rules/partie';
import { boutonAutrement } from './idees';
import { echapper } from './outils';
import { sauvegarderPartie } from './sauvegarde';

// La mort, partout pareil (règles V4) : avec un point de destin, on peut revenir à la vie ;
// sans point de destin, c'est la fin de la partie.

export const ecranMort = (app: HTMLElement, p: Partie, recit: string, revivre: (texte: string) => void, finDePartie: () => void) => {
  p.ev = 0;
  sauvegarderPartie(p);
  const destin = p.perso.destin;
  app.innerHTML = `<div class="page">
    <h1>Ci-gît ${echapper(p.perso.nom)}</h1>
    <p>${echapper(recit)}</p>
    ${
      destin > 0
        ? `<p>Il te reste <b>${destin} point${destin > 1 ? 's' : ''} de destin</b>. Les dieux de Fangh peuvent te renvoyer parmi les vivants, une fois de plus.</p>
           <div class="actions"><button class="secondaire" id="abandonner">Abandonner la partie</button><button class="droite" id="revivre">Revenir à la vie (−1 point de destin)</button></div>`
        : `<p>Tu n'as plus de point de destin. C'est la fin de l'aventure. Le MJ range ta fiche dans le tiroir des héros disparus.</p>
           <div class="actions"><button class="droite" id="abandonner">Fin de la partie</button></div>`
    }
    <p>${boutonAutrement({ type: 'evenement', id: 'mort', titre: `Mort de ${p.perso.nom}` })}</p>
  </div>`;
  app.querySelector('#abandonner')!.addEventListener('click', finDePartie);
  app.querySelector('#revivre')?.addEventListener('click', () => {
    p.perso.destin -= 1;
    p.ev = Math.max(1, Math.floor(evMax(p) / 4));
    noter(p, 'meurt… puis revient à la vie grâce à un point de destin.');
    sauvegarderPartie(p);
    revivre(`Tu rouvres les yeux. Les dieux de Fangh ont encore besoin de toi (ou ils s'amusent) : tu reviens avec ${p.ev} PV et ${p.perso.destin} point${p.perso.destin > 1 ? 's' : ''} de destin.`);
  });
};
