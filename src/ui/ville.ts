import planWaldorg from '../assets/waldorg.jpg';
import { calculerFiche } from '../rules/creation';
import { lancer } from '../rules/des';
import { objet, type Objet } from '../rules/objets';
import {
  acheter,
  dormir,
  epreuve,
  evMax,
  noter,
  passerTemps,
  prixVente,
  soigner,
  valeursCombat,
  vendre,
  type Partie,
} from '../rules/partie';
import { longueur, pointA, trajet } from '../rules/rues';
import { LIEUX, QUETE_GOBELINS, RUMEURS_LOUCHES, RUMEURS_NORMALES, lieu, type Lieu, type TypeLieu } from '../rules/waldorg';
import { bandeau, boutonsVitesse, lierSac, lierVitesse, ligneObjet, panneauJournal, panneauSac, vitesse } from './commun';
import { animerDes, de, echapper } from './outils';
import { marchander, type Marchandage } from '../rules/marchandage';
import { arrondirOr, formatOr } from '../rules/monnaie';
import { boutonAutrement } from './idees';
import { sauvegarderPartie } from './sauvegarde';

// Lettres sur le plan, dans l'esprit des symboles des cartes MJ (A, E, T…).
const ICONES: Record<TypeLieu, string> = {
  porte: 'P',
  info: 'i',
  marche: 'M',
  bar: 'T',
  auberge: 'H',
  emplois: 'Q',
  boutique: 'B',
  soins: '+',
  caisse: 'D',
};

const LEGENDE: [TypeLieu, string][] = [
  ['porte', 'Porte'],
  ['info', 'Informations'],
  ['marche', 'Marché'],
  ['bar', 'Taverne'],
  ['auberge', 'Auberge'],
  ['boutique', 'Boutique'],
  ['soins', 'Soins'],
  ['emplois', 'Missions'],
  ['caisse', 'Donjons'],
];

interface Visite {
  /** Résultat du marchandage pendant cette visite. */
  marchandage?: Marchandage;
  /** Le joueur a choisi de marchander et doit lancer son dé. */
  marchandageEnCours?: boolean;
  message?: string;
}

let echapActif: ((e: KeyboardEvent) => void) | undefined;

export const ecranVille = (
  app: HTMLElement,
  p: Partie,
  ouvrirFiche: () => void,
  retourAccueil: () => void,
  quitterVille: () => void,
) => {
  let visite: Visite = {};
  let vue: 'lieu' | 'sac' | 'journal' = 'lieu';
  /** La fenêtre du lieu est ouverte au-dessus du plan. */
  let popup = true;
  /** Le héros marche : on ignore les clics le temps du trajet. */
  let enRoute = false;
  let enregistre = true;

  const sauver = () => (enregistre = sauvegarderPartie(p));
  const fiche = () => calculerFiche(p.perso);

  // --- Plan --------------------------------------------------------------------

  const plan = () => {
    const ici = lieu(p.lieu);
    return `<div class="plan" id="plan">
      <img src="${planWaldorg}" alt="Plan de Waldorg" draggable="false" />
      ${LIEUX.map(
        (l) => `<button class="poi poi-${l.type} ${l.id === p.lieu ? 'ici' : ''}" style="left:${l.x}%;top:${l.y}%" data-lieu="${l.id}" title="${echapper(l.nom)}" aria-label="Aller à ${echapper(l.nom)}">
          <span>${ICONES[l.type]}</span><em>${echapper(l.nom)}</em>
        </button>`,
      ).join('')}
      <svg class="trace" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polyline id="trace" points="" /></svg>
      <div class="heros" id="heros" style="left:${ici.x}%;top:${ici.y}%" aria-hidden="true"></div>
    </div>
    <div class="legende">${LEGENDE.map(([t, nom]) => `<span><i class="poi-mini poi-${t}">${ICONES[t]}</i>${nom}</span>`).join('')}
      <span><i class="heros-mini"></i>${echapper(p.perso.nom)}</span>
      ${boutonsVitesse()}</div>`;
  };

  // --- Panneau du lieu -----------------------------------------------------------

  const prixAchat = (o: Objet, l: Lieu) => Math.max(0.001, arrondirOr(o.prix * l.boutique!.prix * (1 + (visite.marchandage?.taux ?? 0))));

  const texteMarchandage = (m: Marchandage) => {
    if (m.critique === 'remise')
      return `<b>Réussite critique !</b> Le marchand est sous le charme (D6 du MJ : ${m.deMJ}) : <b>30 % de remise</b> pendant cette visite.`;
    if (m.critique === 'cadeau')
      return `<b>Réussite critique !</b> Le marchand t'a à la bonne (D6 du MJ : ${m.deMJ}) : 10 % de remise, ${
        m.cadeau ? `et il glissera <b>${echapper(objet(m.cadeau).nom)}</b> en cadeau avec ton premier achat.` : 'et il t\'a déjà fait un cadeau.'
      }`;
    if (m.maladresse) return '<b>Maladresse !</b> Le marchand se sent insulté : +25 % pendant cette visite.';
    return m.reussi ? 'Réussi : 10 % de remise pendant cette visite.' : 'Raté : le marchand est vexé, +10 % pendant cette visite.';
  };

  const panneauBoutique = (l: Lieu) => {
    const b = l.boutique!;
    const aVendre = [...new Set(p.sac)].filter((id) => b.rachete?.includes(objet(id).type));
    return `
      <h3>À vendre</h3>
      ${
        visite.marchandageEnCours
          ? `<div class="recit lancer-joueur">Épreuve de Charisme : il faut faire <b>${valeursCombat(p).cha} ou moins</b> sur le D20 pour obtenir 10 % de remise. Raté, le marchand se vexe et ajoute 10 %. Un 1, c'est la réussite critique : grosse remise ou cadeau.
              <div>${de('?', 'a-lancer" id="de-joueur')}<button id="lancer-marchandage">Lancer le D20</button></div></div>`
          : visite.marchandage === undefined
          ? `<p><button class="secondaire petit" id="marchander">Marchander (épreuve de Charisme)</button></p>`
          : `<p class="note">Marchandage : ${de(visite.marchandage.de)} ${texteMarchandage(visite.marchandage)}</p>`
      }
      ${b.stock
        .map((id) => {
          const o = objet(id);
          const prix = prixAchat(o, l);
          return ligneObjet(p, o, `<button class="petit acheter" data-id="${id}" data-prix="${prix}" ${p.or < prix ? 'disabled' : ''}>${formatOr(prix)}</button>`);
        })
        .join('')}
      ${
        b.rachat
          ? `<h3>Le marchand rachète</h3>${
              aVendre.length
                ? aVendre
                    .map((id) => {
                      const o = objet(id);
                      const prix = prixVente(o, b.rachat!);
                      const nb = p.sac.filter((x) => x === id).length;
                      return ligneObjet(p, o, `<span class="pastille">×${nb}</span> <button class="secondaire petit vendre" data-id="${id}" data-prix="${prix}">Vendre ${formatOr(prix)}</button>`);
                    })
                    .join('')
                : '<p class="note">Rien dans ton sac ne l\'intéresse. (Pour vendre ton arme ou ton armure, retire-la d\'abord dans « Sac et équipement ».)</p>'
            }`
          : ''
      }`;
  };

  const actionsLieu = (l: Lieu): string => {
    switch (l.type) {
      case 'porte':
        return `<p><button id="quitter">Quitter Waldorg et partir sur les routes</button></p>${panneauBoutique(l)}`;
      case 'marche':
      case 'boutique':
        return panneauBoutique(l);
      case 'bar':
        return `<p><button id="chope">Commander une chope et tendre l'oreille (${l.chope} PO)</button></p>`;
      case 'auberge': {
        const a = l.auberge!;
        return `<p class="actions-lieu">
          <button id="repas" ${p.or < a.repas ? 'disabled' : ''}>Manger un repas (${a.repas} PO)</button>
          <button id="chambre" ${p.or < a.chambre ? 'disabled' : ''}>Prendre une chambre pour la nuit (${a.chambre} PO)</button>
        </p>
        <p class="note">Une nuit ici rend ${{ mauvais: 2, normal: 4, excellent: 8 }[a.confort]} points de vie (8 heures de repos, ${
          { mauvais: 'mauvaises conditions', normal: 'conditions normales', excellent: 'excellentes conditions' }[a.confort]
        }).</p>`;
      }
      case 'soins': {
        const manque = evMax(p) - p.ev;
        const soignables = Math.min(manque, Math.floor(p.or / l.prixSoin!));
        return manque === 0
          ? `<p>Le soigneur te regarde de haut en bas : « Vous êtes en pleine forme. Revenez quand il vous manquera un bras. »</p>`
          : `<p>Il te manque ${manque} points de vie. Tarif : ${l.prixSoin} PO le point.</p>
             <p><button id="soigner" ${soignables === 0 ? 'disabled' : ''}>Se faire soigner (${soignables} PV pour ${soignables * l.prixSoin!} PO)</button></p>`;
      }
      case 'emplois': {
        const etat = p.quetes[QUETE_GOBELINS.id];
        return `<div class="detail-choix">
          <h3>${echapper(QUETE_GOBELINS.titre)}</h3>
          <p>${echapper(QUETE_GOBELINS.texte)}</p>
          ${
            etat
              ? `<p class="note">Mission acceptée. La route vers les grottes ouvrira avec la carte du monde, à la prochaine étape.</p>`
              : `<p><button id="quete">Accepter la mission</button></p>`
          }
        </div>`;
      }
      case 'info':
        return `<p><button id="plan-gratuit">Demander un plan gratuit</button></p>`;
      case 'caisse':
        return `<p><button id="formulaire">Remplir le formulaire d'aventurier</button></p>`;
    }
  };

  // En attendant les illustrations, le cadre montre le plan agrandi autour du lieu.
  const illustration = (l: Lieu) => `<figure class="illustration">
      <div class="cadre"><img src="${planWaldorg}" alt="" draggable="false" style="transform:translate(-${l.x}%,-${l.y}%)" /></div>
      <figcaption>${echapper(l.nom)} · illustration à venir</figcaption>
    </figure>`;

  const popupLieu = () => {
    const l = lieu(p.lieu);
    return `<div class="popup-lieu" id="popup" role="dialog" aria-labelledby="titre-lieu">
      ${illustration(l)}
      <div class="panneau carte-lieu" id="panneau">
        <div class="barre-fermer"><button class="secondaire petit fermer" id="fermer-lieu" aria-label="Fermer et revenir au plan">✕</button></div>
        <div class="entete-lieu">
          <span class="icone-lieu poi-${l.type}">${ICONES[l.type]}</span>
          <div><h2 id="titre-lieu">${echapper(l.nom)}</h2><div class="note">${echapper(l.quartier)}</div></div>
        </div>
        <p>${echapper(l.description)}</p>
        ${visite.message ? `<div class="recit">${visite.message}</div>` : ''}
        ${actionsLieu(l)}
        <p>${boutonAutrement({ type: 'lieu', id: `waldorg:${l.id}`, titre: `${l.nom} (Waldorg)` })}</p>
      </div>
    </div>`;
  };

  // --- Arrivée ---------------------------------------------------------------------

  const ecranArrivee = () => {
    const f = fiche();
    const v = valeursCombat(p);
    const autreVille = f.ville !== 'Waldorg';
    app.innerHTML = `<div class="page">
      <h1>Waldorg</h1>
      <p class="sous-titre">Capitale de la Terre de Fangh, épicentre de la magie de haut niveau. On peut tout y acheter, à condition que ce soit cher.</p>
      ${autreVille ? `<p class="note">Normalement, un ${echapper(f.origine.nom)} commencerait à ${echapper(f.ville)}. Dans ce prototype, tout le monde débarque à Waldorg.</p>` : ''}
      <p>Après une longue marche, ${echapper(p.perso.nom)} traverse le souk de la banlieue, où un marchand de tapis tente de lui vendre un chameau. Aux portes de la ville, un garde mâchonne une saucisse et l'examine de la tête aux pieds.</p>
      <p>« Aventurier, hein ? Bienvenue à Waldorg. Pas de bagarre, pas de magie dans les rues, et si vous mourez, c'est à vos frais. »</p>
      <div class="detail-choix">
        <h3>Ton équipement de départ</h3>
        <p class="note">Comme le conseille le guide de l'équipement, le MJ t'équipe selon ta classe sociale, sans toucher à tes ${p.or} pièces d'or.</p>
        <ul>
          <li><b>Arme :</b> ${p.equipe.arme ? echapper(objet(p.equipe.arme).nom) : 'aucune'}</li>
          <li><b>Armure :</b> ${p.equipe.armure ? echapper(objet(p.equipe.armure).nom) : 'aucune'}</li>
          <li><b>Dans le sac :</b> ${echapper(p.sac.map((id) => objet(id).nom).join(', '))}</li>
        </ul>
        <p>Attaque ${v.at}, Parade ${v.prd}, dégâts ${echapper(v.degats)}, protection ${v.pr}.</p>
      </div>
      <div class="actions"><button class="droite" id="entrer">Entrer dans Waldorg</button></div>
    </div>`;
    app.querySelector('#entrer')!.addEventListener('click', () => {
      p.arrive = true;
      sauver();
      render();
    });
  };

  // --- Affichage et événements ---------------------------------------------------------

  const render = () => {
    if (!p.arrive) return ecranArrivee();
    const ouvert = vue === 'lieu' && popup;
    const panneau = vue === 'sac' ? panneauSac(p, visite.message) : vue === 'journal' ? panneauJournal(p) : '';
    app.innerHTML = `<div class="page page-ville">
      ${bandeau(p, vue, 'Ville')}
      <div class="scene ${ouvert ? 'popup-ouverte' : ''}" id="scene">
        ${plan()}
        ${ouvert ? popupLieu() : ''}
      </div>
      ${vue === 'lieu' && !popup ? `<p class="note">Clique sur un lieu pour t'y rendre. Tu es à <b>${echapper(lieu(p.lieu).nom)}</b> : clique sur son repère pour y entrer.</p>` : ''}
      ${panneau}
      ${enregistre ? '' : '<p class="alerte">Ce navigateur ne permet pas de sauvegarder : ta partie sera perdue si tu fermes la page.</p>'}
      <div class="actions"><button class="secondaire" id="accueil">Accueil</button></div>
    </div>`;
    lier();
  };

  const message = (html: string) => {
    visite.message = html;
    sauver();
    render();
  };

  const entrer = () => {
    vue = 'lieu';
    popup = true;
    render();
    app.querySelector('#scene')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  /** Le héros suit les rues jusqu'au lieu choisi, puis la fenêtre du lieu s'ouvre. */
  const aller = (id: string) => {
    if (enRoute) return;
    if (id === p.lieu) return entrer();
    const chemin = trajet(lieu(p.lieu), lieu(id));
    // À vitesse ×1, environ 7 s pour traverser la ville ; le réglage de vitesse divise cette durée.
    const duree = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : Math.max(1500, longueur(chemin) * 70);
    const arriver = () => {
      enRoute = false;
      // Waldorg est grande : une bonne heure et demie pour la traverser de part en part.
      passerTemps(p, longueur(chemin) / 60);
      p.lieu = id;
      visite = {};
      sauver();
      entrer();
    };
    if (duree === 0) return arriver();

    // Fermer la fenêtre et montrer le trajet avant de partir.
    popup = false;
    vue = 'lieu';
    render();
    enRoute = true;
    const heros = app.querySelector<HTMLElement>('#heros')!;
    app.querySelector('#trace')!.setAttribute('points', chemin.map(([x, y]) => `${x},${y}`).join(' '));
    let avance = 0;
    let avant = performance.now();
    const pas = (maintenant: number) => {
      // La vitesse peut changer en pleine marche : on avance par petits bouts.
      avance += ((maintenant - avant) * vitesse()) / duree;
      avant = maintenant;
      const t = Math.min(1, avance);
      // Démarrage et arrivée en douceur.
      const [x, y] = pointA(chemin, t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
      heros.style.left = `${x}%`;
      heros.style.top = `${y}%`;
      if (t < 1) requestAnimationFrame(pas);
      else setTimeout(arriver, 150);
    };
    requestAnimationFrame(pas);
  };

  const lier = () => {
    const sur = (sel: string, fn: (el: HTMLElement) => void) =>
      app.querySelectorAll<HTMLElement>(sel).forEach((el) => el.addEventListener('click', () => fn(el)));

    sur('.poi', (el) => aller(el.dataset.lieu!));
    sur('[data-vue]', (el) => {
      vue = el.dataset.vue as typeof vue;
      if (vue === 'lieu') popup = true;
      visite.message = undefined;
      render();
    });
    sur('#fermer-lieu', () => {
      popup = false;
      render();
    });
    // Un clic à côté des cartes, sur le plan assombri, ferme aussi la fenêtre.
    app.querySelector('#popup')?.addEventListener('click', (e) => {
      if (e.target === e.currentTarget) {
        popup = false;
        render();
      }
    });
    sur('#fiche', () => ouvrirFiche());
    sur('#accueil', () => retourAccueil());
    sur('#quitter', () => {
      noter(p, 'quitte Waldorg par la porte ouest.');
      quitterVille();
    });
    lierVitesse(app);
    lierSac(app, p, message);

    // Boutiques
    sur('#marchander', () => {
      visite.marchandageEnCours = true;
      render();
    });
    sur('#lancer-marchandage', (bouton) => {
      const d = lancer(20);
      (bouton as HTMLButtonElement).disabled = true;
      animerDes([app.querySelector<HTMLElement>('#de-joueur')!], 20, [d]).then(() =>
        setTimeout(() => {
          visite.marchandageEnCours = false;
          visite.marchandage = marchander(valeursCombat(p).cha, lieu(p.lieu).boutique!.stock, d);
          render();
        }, 350),
      );
    });
    sur('.acheter', (el) => {
      const o = objet(el.dataset.id!);
      const refus = acheter(p, o.id, Number(el.dataset.prix));
      if (refus) return message(echapper(refus));
      noter(p, `achète ${o.nom} pour ${formatOr(Number(el.dataset.prix))}.`);
      let texte = `Tu achètes <b>${echapper(o.nom)}</b> pour ${formatOr(Number(el.dataset.prix))}. Il est dans ton sac.`;
      const m = visite.marchandage;
      if (m?.cadeau) {
        const c = objet(m.cadeau);
        p.sac.push(c.id);
        noter(p, `reçoit ${c.nom} en cadeau du marchand.`);
        texte += ` En prime, le marchand te glisse <b>${echapper(c.nom)}</b> avec un clin d'œil.`;
        m.cadeau = undefined;
      }
      message(texte);
    });
    sur('.vendre', (el) => {
      const o = objet(el.dataset.id!);
      const refus = vendre(p, o.id, Number(el.dataset.prix));
      if (!refus) noter(p, `vend ${o.nom} pour ${formatOr(Number(el.dataset.prix))}.`);
      message(refus ? echapper(refus) : `Tu vends <b>${echapper(o.nom)}</b> pour ${formatOr(Number(el.dataset.prix))}.`);
    });

    // Bars, auberges, soins
    sur('#chope', () => {
      const l = lieu(p.lieu);
      if (p.or < l.chope!) return message("Le patron ne fait pas crédit.");
      p.or -= l.chope!;
      const liste = l.rumeurs === 'louches' ? RUMEURS_LOUCHES : RUMEURS_NORMALES;
      const rumeur = liste[lancer(liste.length) - 1];
      message(`Tu bois une chope en tendant l'oreille. <i>« ${echapper(rumeur)} »</i>`);
    });
    sur('#repas', () => {
      const a = lieu(p.lieu).auberge!;
      p.or -= a.repas;
      const rendu = soigner(p, 1);
      message(`Un bon repas chaud. ${rendu ? 'Tu récupères 1 PV.' : 'Ça fait du bien au moral.'}`);
    });
    sur('#chambre', () => {
      const l = lieu(p.lieu);
      p.or -= l.auberge!.chambre;
      const rendu = dormir(p, l.auberge!.confort);
      noter(p, `passe la nuit à « ${l.nom} » et récupère ${rendu} PV.`);
      message(`Tu dors comme une bûche${l.auberge!.confort === 'normal' ? ', malgré les chants de marins' : ''}. Au matin du jour ${p.jour}, tu as récupéré <b>${rendu} PV</b>.`);
    });
    sur('#soigner', () => {
      const l = lieu(p.lieu);
      const n = Math.min(evMax(p) - p.ev, Math.floor(p.or / l.prixSoin!));
      p.or -= n * l.prixSoin!;
      soigner(p, n);
      noter(p, `se fait soigner à la clinique (${n} PV).`);
      message(`Le soigneur marmonne une formule et applique un onguent qui pique. Tu récupères <b>${n} PV</b>.`);
    });
    sur('#quete', () => {
      p.quetes[QUETE_GOBELINS.id] = 'acceptee';
      noter(p, `accepte la mission « ${QUETE_GOBELINS.titre} ».`);
      message("Le fonctionnaire tamponne trois formulaires et te tend une carte griffonnée. « Barnabé vous attend. Ne revenez pas sans les poules. »");
    });
    sur('#plan-gratuit', () =>
      message(
        "L'employé te tend un plan et récite : « Au nord-ouest, le stade, les écoles de magie et le marché. Au nord-est, le palais et les riches : évitez d'y traîner. Au sud-ouest, le fort, les armureries et la Guilde des voleurs. Au sud-est, le port, le poisson et les marins. Bonne visite ! »",
      ),
    );
    sur('#formulaire', () =>
      message(
        "Tu remplis douze pages : nom, origine, nombre de bras, allergies, donjons déjà visités. Le guichetier tamponne le tout sans le lire. « Revenez quand vous aurez un donjon à déclarer. »",
      ),
    );
  };

  // Échap ferme la fenêtre du lieu. Un seul écouteur à la fois, même si l'écran est recréé.
  if (echapActif) document.removeEventListener('keydown', echapActif);
  echapActif = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && popup && vue === 'lieu' && app.querySelector('#popup')) {
      popup = false;
      render();
    }
  };
  document.addEventListener('keydown', echapActif);

  render();
};
