import planWaldorg from '../assets/waldorg.jpg';
import { calculerFiche } from '../rules/creation';
import { lancer } from '../rules/des';
import { formatMods, objet, type Objet } from '../rules/objets';
import {
  acheter,
  boirePotion,
  desequiper,
  dormir,
  equiper,
  evMax,
  noter,
  peutManier,
  peutPorter,
  prixVente,
  soigner,
  valeursCombat,
  vendre,
  type Partie,
} from '../rules/partie';
import { LIEUX, QUETE_GOBELINS, RUMEURS_LOUCHES, RUMEURS_NORMALES, lieu, type Lieu, type TypeLieu } from '../rules/waldorg';
import { de, echapper } from './outils';
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
  /** Remise (négative) ou majoration obtenue en marchandant, en fraction. */
  marchandage?: number;
  jetMarchandage?: number;
  message?: string;
}

export const ecranVille = (app: HTMLElement, p: Partie, ouvrirFiche: () => void, retourAccueil: () => void) => {
  let visite: Visite = {};
  let vue: 'lieu' | 'sac' | 'journal' = 'lieu';
  let enregistre = true;

  const sauver = () => (enregistre = sauvegarderPartie(p));
  const fiche = () => calculerFiche(p.perso);

  // --- Bandeau du héros ----------------------------------------------------

  const bandeau = () => {
    const max = evMax(p);
    return `<div class="bandeau">
      <div><b class="nom-court">${echapper(p.perso.nom)}</b> <span class="note">${echapper(fiche().nomVersionHB ?? fiche().origine.nom)}</span></div>
      <div class="jauges">
        <span title="Énergie vitale">❤ <b>${p.ev}</b>/${max}</span>
        <span title="Pièces d'or">● <b>${p.or}</b> PO</span>
        <span title="Points de destin">✦ <b>${p.perso.destin}</b></span>
        <span title="Jour">☼ jour <b>${p.jour}</b></span>
      </div>
      <div class="onglets">
        <button class="secondaire petit ${vue === 'lieu' ? 'actif' : ''}" data-vue="lieu">Ville</button>
        <button class="secondaire petit ${vue === 'sac' ? 'actif' : ''}" data-vue="sac">Sac et équipement</button>
        <button class="secondaire petit ${vue === 'journal' ? 'actif' : ''}" data-vue="journal">Journal</button>
        <button class="secondaire petit" id="fiche">Fiche</button>
      </div>
    </div>`;
  };

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
      <div class="heros" id="heros" style="left:${ici.x}%;top:${ici.y}%" aria-hidden="true"></div>
    </div>
    <div class="legende">${LEGENDE.map(([t, nom]) => `<span><i class="poi-mini poi-${t}">${ICONES[t]}</i>${nom}</span>`).join('')}
      <span><i class="heros-mini"></i>${echapper(p.perso.nom)}</span></div>`;
  };

  // --- Panneau du lieu -----------------------------------------------------------

  const prixAchat = (o: Objet, l: Lieu) => Math.max(1, Math.round(o.prix * (l.boutique!.prix) * (1 + (visite.marchandage ?? 0))));

  const ligneObjet = (o: Objet, droite: string) => {
    const refus = o.type === 'arme' ? peutManier(fiche(), o) : o.type === 'armure' ? peutPorter(fiche(), o) : null;
    const details = [
      o.degats ? `Dégâts ${o.degats}` : '',
      o.pr ? `PR ${o.pr}` : '',
      o.mains === 2 ? '2 mains' : '',
      o.soin ? `Rend ${o.soin} PV` : '',
      formatMods(o.mods),
    ].filter(Boolean);
    return `<div class="objet">
      <div class="objet-texte">
        <b>${echapper(o.nom)}</b>${o.estime ? ' <span class="pastille" title="Valeurs provisoires, en attente des tableaux officiels">(estimé)</span>' : ''}
        ${details.length ? `<div class="pastille">${echapper(details.join(' · '))}</div>` : ''}
        <div class="note">${echapper(o.description)}</div>
        ${refus ? `<div class="alerte petit-texte">${echapper(refus)}</div>` : ''}
      </div>
      <div class="objet-action">${droite}</div>
    </div>`;
  };

  const panneauBoutique = (l: Lieu) => {
    const b = l.boutique!;
    const aVendre = [...new Set(p.sac)].filter((id) => b.rachete?.includes(objet(id).type));
    return `
      <h3>À vendre</h3>
      ${
        visite.marchandage === undefined
          ? `<p><button class="secondaire petit" id="marchander">Marchander (épreuve de Charisme)</button></p>`
          : `<p class="note">Marchandage : ${de(visite.jetMarchandage!)} ${
              visite.marchandage < 0 ? 'Réussi : 10 % de remise pendant cette visite.' : 'Raté : le marchand est vexé, +10 % pendant cette visite.'
            }</p>`
      }
      ${b.stock
        .map((id) => {
          const o = objet(id);
          const prix = prixAchat(o, l);
          return ligneObjet(o, `<button class="petit acheter" data-id="${id}" data-prix="${prix}" ${p.or < prix ? 'disabled' : ''}>${prix} PO</button>`);
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
                      return ligneObjet(o, `<span class="pastille">×${nb}</span> <button class="secondaire petit vendre" data-id="${id}" data-prix="${prix}">Vendre ${prix} PO</button>`);
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
        return `<p><button disabled title="Arrive à la prochaine étape">Quitter Waldorg (carte du monde bientôt)</button></p>${panneauBoutique(l)}`;
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

  const panneauLieu = () => {
    const l = lieu(p.lieu);
    return `<div class="panneau" id="panneau">
      <div class="entete-lieu">
        <span class="icone-lieu poi-${l.type}">${ICONES[l.type]}</span>
        <div><h2>${echapper(l.nom)}</h2><div class="note">${echapper(l.quartier)}</div></div>
      </div>
      <p>${echapper(l.description)}</p>
      ${visite.message ? `<div class="recit">${visite.message}</div>` : ''}
      ${actionsLieu(l)}
    </div>`;
  };

  // --- Sac et équipement -------------------------------------------------------

  const panneauSac = () => {
    const v = valeursCombat(p);
    const emplacement = (titre: string, cle: 'arme' | 'armure') => {
      const id = p.equipe[cle];
      return ligneObjet(
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
      ${emplacement('Arme', 'arme')}
      ${emplacement('Armure', 'armure')}
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
                    : o.type === 'potion'
                      ? `<button class="secondaire petit boire" data-id="${id}">Boire</button>`
                      : '';
                return ligneObjet(o, `<span class="pastille">×${nb}</span> ${bouton}`);
              })
              .join('')
          : '<p class="note">Ton sac est vide. Même pas une chaussette.</p>'
      }
      ${visite.message ? `<div class="recit">${visite.message}</div>` : ''}
    </div>`;
  };

  const panneauJournal = () => `<div class="panneau">
    <h2>Journal</h2>
    <ul class="journal">${p.journal.map((j) => `<li>${echapper(j)}</li>`).join('')}</ul>
  </div>`;

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
    const panneau = vue === 'lieu' ? panneauLieu() : vue === 'sac' ? panneauSac() : panneauJournal();
    app.innerHTML = `<div class="page page-ville">
      ${bandeau()}
      ${plan()}
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

  const aller = (id: string) => {
    if (id === p.lieu && vue === 'lieu') return;
    const depart = lieu(p.lieu);
    const arrivee = lieu(id);
    const heros = app.querySelector<HTMLElement>('#heros')!;
    const distance = Math.hypot(arrivee.x - depart.x, arrivee.y - depart.y);
    const duree = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : Math.min(900, 200 + distance * 12);
    heros.style.transition = `left ${duree}ms ease-in-out, top ${duree}ms ease-in-out`;
    heros.style.left = `${arrivee.x}%`;
    heros.style.top = `${arrivee.y}%`;
    setTimeout(() => {
      p.lieu = id;
      visite = {};
      vue = 'lieu';
      sauver();
      render();
      app.querySelector('#panneau')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, duree);
  };

  const lier = () => {
    const sur = (sel: string, fn: (el: HTMLElement) => void) =>
      app.querySelectorAll<HTMLElement>(sel).forEach((el) => el.addEventListener('click', () => fn(el)));

    sur('.poi', (el) => aller(el.dataset.lieu!));
    sur('[data-vue]', (el) => {
      vue = el.dataset.vue as typeof vue;
      visite.message = undefined;
      render();
    });
    sur('#fiche', () => ouvrirFiche());
    sur('#accueil', () => retourAccueil());

    // Boutiques
    sur('#marchander', () => {
      const d = lancer(20);
      visite.jetMarchandage = d;
      visite.marchandage = d <= valeursCombat(p).cha ? -0.1 : 0.1;
      render();
    });
    sur('.acheter', (el) => {
      const o = objet(el.dataset.id!);
      const refus = acheter(p, o.id, Number(el.dataset.prix));
      if (!refus) noter(p, `achète ${o.nom} pour ${el.dataset.prix} PO.`);
      message(refus ? echapper(refus) : `Tu achètes <b>${echapper(o.nom)}</b> pour ${el.dataset.prix} PO. Il est dans ton sac.`);
    });
    sur('.vendre', (el) => {
      const o = objet(el.dataset.id!);
      const refus = vendre(p, o.id, Number(el.dataset.prix));
      if (!refus) noter(p, `vend ${o.nom} pour ${el.dataset.prix} PO.`);
      message(refus ? echapper(refus) : `Tu vends <b>${echapper(o.nom)}</b> pour ${el.dataset.prix} PO.`);
    });

    // Sac
    sur('.equiper', (el) => {
      const o = objet(el.dataset.id!);
      const refus = equiper(p, o.id);
      message(refus ? `<span class="alerte">${echapper(refus)}</span>` : `Tu t'équipes : <b>${echapper(o.nom)}</b>.`);
    });
    sur('.retirer', (el) => {
      desequiper(p, el.dataset.emplacement as 'arme' | 'armure');
      message('Rangé dans le sac.');
    });
    sur('.boire', (el) => {
      const r = boirePotion(p, el.dataset.id!);
      if (typeof r === 'string') return message(echapper(r));
      noter(p, `boit une potion et récupère ${r.rendu} PV.`);
      message(`${r.des.map((d) => de(d)).join('')} Glou glou… Tu récupères <b>${r.rendu} PV</b>.`);
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

  render();
};
