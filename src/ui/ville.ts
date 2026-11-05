import { dateLongue } from '../rules/calendrier';
import { adressesSpecialistes, soignerGrave, soinsGraves } from '../rules/chirurgie';
import planWaldorg from '../assets/waldorg.jpg';
import planValtordu from '../assets/valtordu.jpg';
import planLoubet from '../assets/loubet.jpg';
import planFquiepou from '../assets/fquiepou.jpg';
import planKjaniouf from '../assets/kjaniouf.jpg';
import planTulamor from '../assets/tulamor.jpg';
import planMliuej from '../assets/mliuej.jpg';
import planChnafon from '../assets/chnafon.jpg';
import planGlargh from '../assets/glargh.jpg';
import planJambfer from '../assets/jambfer.jpg';
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
import { cite, lieuCite, longueurCite, pointCite, trajetCite } from '../rules/cites';
import type { Lieu, TypeLieu } from '../rules/waldorg';
import type { Rencontre } from '../rules/rencontres';
import { afficherAnnonce, bandeau, jaugeReputation, lierSac, lierVitesse, ligneObjet, panneauGroupe, panneauJournal, panneauSac, vitesse } from './commun';
import { ecranCombat, pertes, vengeTexte } from './combat';
import { ecranMort } from './mort';
import { aTalent, bonusSituation, texteBonus } from '../rules/talents';
import { payerSoins, refuserSoins, soinsEnVille, type DemandeSoin } from '../rules/soins-compagnons';
import { aDesQuetes, detailQuete, entreesDonjonLibre, lierQuetes, marqueQuete, panneauJournalQuetes, tableauQuetes } from './quetes';
import { animerDes, de, echapper } from './outils';
import { marchander, type Marchandage } from '../rules/marchandage';
import { arrondirOr, formatOr } from '../rules/monnaie';
import { boutonAutrement, lierIdeesLieu, panneauIdeesLieu } from './idees';
import { sauvegarderPartie } from './sauvegarde';
import { occupation, vivreEnVille } from '../rules/vie-en-ville';
import { appelsQuetes, progresserQuetes } from '../rules/quetes';
import { compagnon, groupe, prenom } from '../rules/compagnons';
import { lierGroupe, panneauEmbauche, panneauPartage, partageDuSoir } from './groupe';
import { discuterPeage, fixerPeage, payerPeage, peageDu, personnes, reconnuJusqua, totalPeage, type Peage } from '../rules/peage';
import { facteurPrix, rangReputation, reputation } from '../rules/reputation';

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
  /** L'onglet ouvert dans une boutique qui rachète : acheter ou vendre. */
  ongletBoutique?: 'acheter' | 'vendre';
  message?: string;
}

let peageEnCours: { ville: string; g: Peage; discute?: boolean } | undefined;

const PLANS: Record<string, string> = {
  waldorg: planWaldorg,
  valtordu: planValtordu,
  loubet: planLoubet,
  fquiepou: planFquiepou,
  kjaniouf: planKjaniouf,
  tulamor: planTulamor,
  mliuej: planMliuej,
  chnafon: planChnafon,
  glargh: planGlargh,
  jambfer: planJambfer,
};

export interface SortiesVille {
  ouvrirFiche: () => void;
  retourAccueil: () => void;
  quitterVille: () => void;
  entrerDonjon: (id: string, par?: string) => void;
  finDePartie: () => void;
}

let echapActif: ((e: KeyboardEvent) => void) | undefined;

export const ecranVille = (app: HTMLElement, p: Partie, sorties: SortiesVille, accueilMessage?: string) => {
  const { ouvrirFiche, retourAccueil, quitterVille } = sorties;
  const c = cite(p.ville);
  p.ville = c.id;
  const LIEUX = c.lieux;
  const lieu = (id: string) => lieuCite(c, id);
  const plan_ = PLANS[c.id];
  const ou = (l: Lieu) => `ville:${c.id}:${l.id}`;
  let visite: Visite = { message: accueilMessage };
  let vue: 'lieu' | 'sac' | 'groupe' | 'journal' | 'quetes' = 'lieu';
  let epreuveQuete: string | undefined;
  /** Le parchemin du tableau d'affichage ouvert (détail de la quête). */
  let queteOuverte: string | undefined;
  /** Ce que la quête vient de donner (récit, récompense) : affiché dans la fenêtre de la quête, avec le partage. */
  let resultatQuete: string | undefined;
  /** Le droit d'entrée (Chnafon, Jambfer) : la porte réclame son dû avant tout. */
  const taxe = () => {
    // Déjà en ville (ailleurs qu'à la porte) : on est passé, le garde ne court pas après nous.
    if (!peageDu(p, c) || p.lieu !== 'porte') return undefined;
    if (peageEnCours?.ville !== c.id) peageEnCours = { ville: c.id, g: fixerPeage(c) };
    return peageEnCours;
  };
  if (peageDu(p, c)) p.lieu = 'porte';
  // Un donneur de quête qui fait signe au groupe en ville (le vieux Bertrand, quand on est apprécié à Valtordu).
  const appels = appelsQuetes(p, c.id);
  if (appels.length) visite.message = [visite.message, ...appels.map((t) => `<p>${echapper(t)}</p>`)].filter(Boolean).join('');
  /** La fenêtre du lieu est ouverte au-dessus du plan : seulement si on clique sur un lieu, ou si quelque chose s'y passe. */
  let popup = !!taxe() || !!visite.message;
  /** Le héros marche : on ignore les clics le temps du trajet. */
  let enRoute = false;
  let enregistre = true;

  const sauver = () => (enregistre = sauvegarderPartie(p));
  const fiche = () => calculerFiche(p.perso);

  // --- Plan --------------------------------------------------------------------

  /** Où sont les compagnons en ce moment (chacun vit sa vie en ville). */
  const occupations = () => groupe(p).map((e) => ({ e, o: occupation(p, e, c) })).filter((x) => x.o);
  const marqueursCompagnons = () => {
    const parLieu = new Map<string, number>();
    return occupations()
      .map(({ e, o }) => {
        const n = parLieu.get(o!.lieu.id) ?? 0;
        parLieu.set(o!.lieu.id, n + 1);
        const nom = compagnon(e.id).perso.nom;
        // En petit cercle autour du repère du lieu, pour ne pas le cacher.
        const angle = Math.PI / 4 - n * (Math.PI / 3);
        return `<span class="pion-ville" style="left:${o!.lieu.x}%;top:${o!.lieu.y}%;--dx:${Math.round(Math.cos(angle) * 24)}px;--dy:${Math.round(Math.sin(angle) * 24)}px" title="${echapper(`${nom} ${o!.texte} (${o!.lieu.nom})`)}">${echapper(nom[0])}</span>`;
      })
      .join('');
  };
  const compagnonsIci = (l: Lieu) => {
    const ici = occupations().filter(({ o }) => o!.lieu.id === l.id);
    return ici.length
      ? `<ul class="compagnons-ici">${ici.map(({ e, o }) => `<li><b>${echapper(prenom(e.id))}</b> est ici : ${echapper(o!.texte)}.</li>`).join('')}</ul>`
      : '';
  };

  const plan = () => {
    const ici = lieu(p.lieu);
    return `<div class="plan ${c.rapport < 1 ? 'portrait' : ''}" id="plan">
      <img src="${plan_}" alt="Plan de ${echapper(c.nom)}" draggable="false" />
      ${LIEUX.map((l) => {
        const q = marqueQuete(p, ou(l));
        return `<button class="poi poi-${l.type} ${l.id === p.lieu ? 'ici' : ''}" style="left:${l.x}%;top:${l.y}%" data-lieu="${l.id}" title="${echapper(l.nom)}" aria-label="Aller à ${echapper(l.nom)}${q ? ' (quête)' : ''}">
          <span>${ICONES[l.type]}</span><em>${echapper(l.nom)}</em>${q ? `<b class="marque-quete marque-${q}">${q === 'nouvelle' ? '!' : '➤'}</b>` : ''}
        </button>`;
      }).join('')}
      ${marqueursCompagnons()}
      <svg class="trace" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polyline id="trace" points="" /></svg>
      <div class="heros" id="heros" style="left:${ici.x}%;top:${ici.y}%" aria-hidden="true"></div>
    </div>
    <div class="legende">${LEGENDE.map(([t, nom]) => `<span><i class="poi-mini poi-${t}">${ICONES[t]}</i>${nom}</span>`).join('')}
      <span><i class="marque-quete marque-nouvelle">!</i>Quête proposée</span>
      <span><i class="marque-quete marque-etape">➤</i>Étape de quête</span>
      <span><i class="heros-mini"></i>${echapper(p.perso.nom)}</span>
      ${groupe(p).length ? '<span><i class="pion-ville mini">A</i>Compagnons (survole pour voir ce qu\'ils font)</span>' : ''}
      ${jaugeReputation(p, c.id, c.nom)}</div>`;
  };

  // --- Panneau du lieu -----------------------------------------------------------

  // Arnaque et carambouille : 20 % de remise à l'achat et 10 % de mieux à la revente, sans marchander.
  const arnaque = () => aTalent(p, 'Arnaque et carambouille');
  const valeurMarchandage = () => valeursCombat(p).cha + bonusSituation(p, 'marchandage').total;
  const prixAchat = (o: Objet, l: Lieu) =>
    Math.max(0.001, arrondirOr(o.prix * l.boutique!.prix * facteurPrix(reputation(p, c.id)) * (arnaque() ? 0.8 : 1 + (visite.marchandage?.taux ?? 0))));

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
    const fp = facteurPrix(reputation(p, c.id));
    const onglet = b.rachat ? (visite.ongletBoutique ?? 'acheter') : 'acheter';
    const onglets = b.rachat
      ? `<div class="onglets-boutique" role="tablist">${(
          [
            ['acheter', 'Acheter'],
            ['vendre', `Vendre${aVendre.length ? ` (${aVendre.length})` : ''}`],
          ] as const
        )
          .map(([id, nom]) => `<button class="petit ${id === onglet ? '' : 'secondaire'}" role="tab" aria-selected="${id === onglet}" data-onglet-boutique="${id}">${nom}</button>`)
          .join('')}</div>`
      : '';
    if (onglet === 'vendre')
      return `${onglets}
      <h3>Le marchand rachète</h3>
      ${
        aVendre.length
          ? aVendre
              .map((id) => {
                const o = objet(id);
                const prix = prixVente(o, b.rachat! * (arnaque() ? 1.1 : 1));
                const nb = p.sac.filter((x) => x === id).length;
                return ligneObjet(p, o, `<span class="pastille">×${nb}</span> <button class="secondaire petit vendre" data-id="${id}" data-prix="${prix}">Vendre ${formatOr(prix)}</button>`);
              })
              .join('')
          : '<p class="note">Rien dans ton sac ne l\'intéresse. (Pour vendre ton arme ou ton armure, retire-la d\'abord dans « Sac et équipement ».)</p>'
      }`;
    return `${onglets}
      <h3>À vendre</h3>
      ${fp !== 1 ? `<p class="note">Ta réputation ici (${rangReputation(reputation(p, c.id)).nom}) : prix ${fp > 1 ? '+' : '−'}${Math.round(Math.abs(fp - 1) * 100)} %.</p>` : ''}
      ${
        visite.marchandageEnCours
          ? `<div class="recit lancer-joueur">Épreuve de Charisme${echapper(texteBonus(bonusSituation(p, 'marchandage')))} : il faut faire <b>${valeurMarchandage()} ou moins</b> sur le D20 pour obtenir 10 % de remise. Raté, le marchand se vexe et ajoute 10 %. Un 1, c'est la réussite critique : grosse remise ou cadeau.
              <div>${de('?', 'a-lancer" id="de-joueur')}<button id="lancer-marchandage">Lancer le D20</button></div></div>`
          : arnaque()
          ? `<p class="note">Arnaque et carambouille : ton baratin abracadabrant te vaut <b>20 % de remise</b> sur tout, et 10 % de mieux quand tu revends.</p>`
          : visite.marchandage === undefined
          ? `<p><button class="secondaire petit" id="marchander">Marchander (épreuve de Charisme ${valeurMarchandage()})</button></p>`
          : `<p class="note">Marchandage : ${de(visite.marchandage.de)} ${texteMarchandage(visite.marchandage)}</p>`
      }
      ${b.stock
        .map((id) => {
          const o = objet(id);
          const prix = prixAchat(o, l);
          return ligneObjet(p, o, `<button class="petit acheter" data-id="${id}" data-prix="${prix}" ${p.or < prix ? 'disabled' : ''}>${formatOr(prix)}</button>`);
        })
        .join('')}`;
  };

  const actionsLieu = (l: Lieu): string => {
    const parts: string[] = [];
    switch (l.type) {
      case 'porte': {
        const t = taxe();
        if (t) {
          const total = totalPeage(p, t.g);
          const n = personnes(p);
          parts.push(`<div class="recit">${echapper(c.peage!.texte)}
            <p>${t.g.des.length ? `${t.g.des.map((x) => de(x)).join('')} ` : ''}<b>${t.g.prix} PO par personne</b>.${n > 1 ? ` Chacun paie sa place : ${n === 2 ? 'ton compagnon sort la sienne' : 'tes compagnons sortent la leur'} de sa part du butin.` : ''}${c.peage!.souvenir ? ' Le garde a de la mémoire : une fois payé, il te laissera passer pendant une semaine.' : ''} Tu as ${formatOr(p.or)}.</p>
            ${t.g.discussion ? `<p>${de(t.g.discussion.de)} ${echapper(t.g.discussion.texte)}</p>` : ''}
            ${
              t.discute
                ? `<p class="lancer-joueur">Épreuve de Charisme : ${valeursCombat(p).cha} ou moins sur le D20.</p><div>${de('?', 'a-lancer" id="de-peage')}<button id="lancer-peage">Lancer le D20</button></div>`
                : `<p class="actions-lieu"><button id="payer-peage" ${p.or < total ? 'disabled' : ''}>${total ? `Payer ${total} PO` : 'Passer'}</button>
                  ${c.peage!.marchandable && !t.g.discussion ? `<button class="secondaire" id="discuter-peage">Discuter le prix (Charisme)</button>` : ''}
                  <button class="secondaire" id="quitter">Rebrousser chemin</button></p>`
            }</div>`);
        } else {
          const r = c.peage && reconnuJusqua(p, c);
          if (r) parts.push(`<p class="note">Le garde te reconnaît et te fait signe de passer. Il s'en souviendra jusqu'au ${echapper(dateLongue(Math.floor(r / 24)))}.</p>`);
          parts.push(`<p><button id="quitter">${echapper(c.sortie)}</button></p>`);
        }
        break;
      }
      case 'bar':
        parts.push(`<p><button id="chope">Commander une chope et tendre l'oreille (${l.chope} PO)</button></p>`);
        break;
      case 'auberge': {
        const a = l.auberge!;
        parts.push(`<p class="actions-lieu">
          <button id="repas" ${p.or < a.repas ? 'disabled' : ''}>Manger un repas (${a.repas} PO)</button>
          <button id="chambre" ${p.or < a.chambre ? 'disabled' : ''}>Prendre une chambre pour la nuit (${a.chambre} PO)</button>
        </p>
        <p class="note">Une nuit ici rend ${{ mauvais: 2, normal: 4, excellent: 8 }[a.confort]} points de vie (8 heures de repos, ${
          { mauvais: 'mauvaises conditions', normal: 'conditions normales', excellent: 'excellentes conditions' }[a.confort]
        }).</p>${panneauPartage(p)}`);
        break;
      }
      case 'soins': {
        const manque = evMax(p) - p.ev;
        const soignables = Math.min(manque, Math.floor(p.or / l.prixSoin!));
        const graves = soinsGraves(p, `${c.id}:${l.id}`, l.prixSoin!);
        parts.push(
          manque === 0
            ? p.blessures?.length
              ? `<p>Le soigneur te regarde de haut en bas : « Côté points de vie, rien à faire. Pour le reste, voyons voir. »</p>`
              : `<p>Le soigneur te regarde de haut en bas : « Vous êtes en pleine forme. Revenez quand il vous manquera un bras. »</p>`
            : `<p>Il te manque ${manque} points de vie. Tarif : ${l.prixSoin} PO le point.</p>
             <p><button id="soigner" ${soignables === 0 ? 'disabled' : ''}>Se faire soigner (${soignables} PV pour ${soignables * l.prixSoin!} PO)</button></p>`,
        );
        if (graves.possibles.length)
          parts.push(
            `<p><b>Blessures graves</b> <span class="note">${graves.specialiste ? 'Le mage de la clinique peut recoller ou faire repousser ce qui manque.' : 'Fractures et luxations : remises en place, elles guérissent deux fois plus vite.'}</span></p>
            <p class="actions-lieu">${graves.possibles
              .map(
                (g) =>
                  `<button data-soin-grave="${g.index}" ${p.or < g.prix ? 'disabled' : ''}>${g.type === 'reparer' ? 'Réparer' : 'Remettre en place'} : ${echapper(g.nom.toLowerCase())} (${g.prix} PO)</button>`,
              )
              .join('')}</p>`,
          );
        if (graves.ailleurs.length)
          parts.push(
            `<p class="recit">Le guérisseur regarde ${echapper(graves.ailleurs.map((n) => n.toLowerCase()).join(', '))} et secoue la tête. « Ça, c'est pas de mon niveau. Il faut un mage soigneur qui sait recoller les morceaux. Allez voir ${echapper(adressesSpecialistes().join(', ou '))}. Et ne traînez pas trop. »</p>`,
          );
        break;
      }
      case 'emplois':
        if (!aDesQuetes(p, ou(l))) parts.push(`<p class="note">Rien pour toi pour le moment. Repasse plus tard, ou va voir ailleurs si on a besoin de toi.</p>`);
        break;
    }
    if (l.action) parts.push(`<p><button class="secondaire" id="action-lieu">${echapper(l.action.bouton)}</button></p>`);
    return parts.join('') + entreesDonjonLibre(p, ou(l)) + panneauEmbauche(p, ou(l), l.type === 'bar' || l.type === 'auberge') + (l.boutique ? panneauBoutique(l) : '');
  };

  /** Le détail d'une quête du tableau d'affichage, par-dessus la fenêtre du lieu. */
  const popupQuete = (l: Lieu): string => {
    if (!queteOuverte) return '';
    if (resultatQuete !== undefined)
      return `<div class="popup-quete" id="popup-quete" role="dialog" aria-label="Quête">
      <div class="panneau parchemin-ouvert">
        <div class="barre-fermer"><button class="secondaire petit fermer" id="fermer-quete" aria-label="Fermer">✕</button></div>
        <div class="recit resultat-quete">${resultatQuete}</div>
        ${panneauPartage(p)}
        <p class="actions-lieu"><button id="continuer-quete">Continuer</button></p>
      </div>
    </div>`;
    const detail = detailQuete(p, ou(l), queteOuverte, epreuveQuete);
    if (!detail) {
      queteOuverte = undefined;
      return '';
    }
    return `<div class="popup-quete" id="popup-quete" role="dialog" aria-label="Détail de la quête">
      <div class="panneau parchemin-ouvert">
        <div class="barre-fermer"><button class="secondaire petit fermer" id="fermer-quete" aria-label="Remettre le parchemin sur le tableau">✕</button></div>
        ${detail}
      </div>
    </div>`;
  };

  // En attendant les illustrations, le cadre montre le plan agrandi autour du lieu.
  const illustration = (l: Lieu) => `<figure class="illustration">
      <div class="cadre"><img src="${plan_}" alt="" draggable="false" style="transform:translate(-${l.x}%,-${l.y}%)" /></div>
      <figcaption>${echapper(l.nom)} · illustration à venir</figcaption>
    </figure>`;

  const popupLieu = () => {
    const l = lieu(p.lieu);
    return `<div class="popup-lieu" id="popup" role="dialog" aria-labelledby="titre-lieu">
      <div class="colonne-lieu">${illustration(l)}${tableauQuetes(p, ou(l))}</div>
      <div class="panneau carte-lieu" id="panneau">
        <div class="barre-fermer"><button class="secondaire petit fermer" id="fermer-lieu" aria-label="Fermer et revenir au plan">✕</button></div>
        <div class="entete-lieu">
          <span class="icone-lieu poi-${l.type}">${ICONES[l.type]}</span>
          <div><h2 id="titre-lieu">${echapper(l.nom)}</h2><div class="note">${echapper(l.quartier)}</div></div>
        </div>
        <p>${echapper(l.description)}</p>
        ${compagnonsIci(l)}
        ${visite.message ? `<div class="recit">${visite.message}</div>` : ''}
        ${actionsLieu(l)}
        ${panneauIdeesLieu(p, `${c.id}:${l.id}`)}
        <p>${boutonAutrement({ type: 'lieu', id: `${c.id}:${l.id}`, titre: `${l.nom} (${c.nom})` })}</p>
      </div>
      ${popupQuete(l)}
    </div>`;
  };

  // --- Arrivée ---------------------------------------------------------------------

  const ecranArrivee = () => {
    const f = fiche();
    const v = valeursCombat(p);
    app.innerHTML = `<div class="page">
      <h1>${echapper(c.nom)}</h1>
      <p class="sous-titre">${echapper(c.sousTitre)}</p>
      ${f.ville.toLowerCase() !== c.id ? `<p class="note">Normalement, un ${echapper(f.origine.nom)} commencerait à ${echapper(f.ville)}. Dans ce prototype, tout le monde débute à ${echapper(c.nom)}, le coin le plus tranquille pour apprendre le métier.</p>` : ''}
      ${c.arrivee.map((t) => `<p>${echapper(t.replace('{nom}', p.perso.nom))}</p>`).join('')}
      <div class="detail-choix">
        <h3>Ton équipement de départ</h3>
        <p class="note">Comme le conseille le guide de l'équipement, le MJ t'équipe selon ta classe sociale, sans toucher à tes ${p.or} pièces d'or.</p>
        <ul>
          <li><b>Arme :</b> ${p.equipe.arme ? echapper(objet(p.equipe.arme).nom) : 'aucune'}</li>
          <li><b>Armure :</b> ${p.equipe.armure ? echapper(objet(p.equipe.armure).nom) : 'aucune'}</li>
          ${p.equipe.distance ? `<li><b>Arme à distance :</b> ${echapper(objet(p.equipe.distance).nom)}</li>` : ''}
          <li><b>Dans le sac :</b> ${echapper(p.sac.map((id) => objet(id).nom).join(', '))}</li>
        </ul>
        <p>Attaque ${v.at}, Parade ${v.prd}, dégâts ${echapper(v.degats)}, protection ${v.pr}.</p>
      </div>
      <p class="note">Les repères <b>!</b> sur le plan signalent des quêtes. Elles s'affichent dans l'onglet « Quêtes ».</p>
      <div class="actions"><button class="droite" id="entrer">Entrer dans ${echapper(c.nom)}</button></div>
    </div>`;
    app.querySelector('#entrer')!.addEventListener('click', () => {
      p.arrive = true;
      sauver();
      render();
    });
  };

  // --- Affichage et événements ---------------------------------------------------------

  let vieLignes: string[] = [];
  // Grande ville : les compagnons blessés filent chez le guérisseur (ou font passer le chapeau).
  const soins = p.arrive ? soinsEnVille(p, c) : { lignes: [], demandes: [] };
  // Les étapes qui avancent toutes seules (le château libéré, même avant ce correctif…).
  vieLignes = [...soins.lignes, ...progresserQuetes(p)];
  let demandesSoin: DemandeSoin[] = soins.demandes;
  const panneauDemandesSoin = () =>
    demandesSoin.length
      ? `<div class="panneau demandes-soin">${demandesSoin
          .map(
            (d, i) => `<div class="demande-soin">
          <p><b>🩹 ${echapper(prenom(d.id))}</b> voudrait se faire soigner chez le guérisseur (${echapper(d.lieu)}) : ${echapper(d.soins.map((s) => s.nom.toLowerCase()).join(', '))}, pour <b>${d.prix} PO</b>. Il n'a que ${d.sienne} PO.</p>
          <ul class="dons">${d.dons
            .map((x) => `<li>${echapper(prenom(x.id))} ${x.montant > 0 ? `met ${x.montant} PO au pot.` : 'regarde ailleurs et ne donne rien.'}</li>`)
            .join('')}</ul>
          <p class="actions-lieu"><button data-payer-soin="${i}" ${p.or < d.reste ? 'disabled' : ''}>Compléter : ${d.reste} PO</button>
            <button class="secondaire" data-refuser-soin="${i}">Le laisser avec ses blessures</button></p>
        </div>`,
          )
          .join('')}</div>`
      : '';
  const render = () => {
    if (!p.arrive) return ecranArrivee();
    vieLignes = [...vieLignes, ...vivreEnVille(p, c)].slice(-4);
    const ouvert = vue === 'lieu' && popup;
    // Garder la position de défilement : acheter, vendre ou se soigner ne doit pas faire sauter la fenêtre.
    const defilement = ['#panneau', '#popup'].map((sel) => [sel, app.querySelector(sel)?.scrollTop ?? 0] as const);
    const fenetre = window.scrollY;
    const panneau = vue === 'sac' ? panneauSac(p, visite.message) : vue === 'groupe' ? panneauGroupe(p, visite.message) : vue === 'journal' ? panneauJournal(p) : vue === 'quetes' ? panneauJournalQuetes(p) : '';
    app.innerHTML = `<div class="page page-ville">
      ${bandeau(p, vue, c.nom)}
      ${
        // Les onglets (personnage, groupe, quêtes, journal) prennent la place du plan.
        vue === 'lieu'
          ? `<div class="scene ${ouvert ? 'popup-ouverte' : ''}" id="scene">
        ${plan()}
        ${ouvert ? popupLieu() : ''}
      </div>`
          : ''
      }
      ${panneauDemandesSoin()}
      ${vieLignes.length ? `<ul class="reactions">${vieLignes.map((x) => `<li>${echapper(x)}</li>`).join('')}</ul>` : ''}
      ${vue === 'lieu' && !popup ? `<p class="note">Clique sur un lieu pour t'y rendre. Tu es à <b>${echapper(lieu(p.lieu).nom)}</b> : clique sur son repère pour y entrer.</p>` : ''}
      ${panneau}
      ${enregistre ? '' : '<p class="alerte">Ce navigateur ne permet pas de sauvegarder : ta partie sera perdue si tu fermes la page.</p>'}
      <div class="actions"><button class="secondaire" id="accueil">Accueil</button></div>
    </div>`;
    for (const [sel, y] of defilement) {
      const el = app.querySelector(sel);
      if (el && y) el.scrollTop = y;
    }
    if (window.scrollY !== fenetre) window.scrollTo({ top: fenetre });
    lier();
  };

  const message = (html: string) => {
    visite.message = html;
    sauver();
    render();
  };

  /** Le résultat d'un achat, d'une vente ou d'un soin : une bulle flottante, pour que les boutons ne bougent pas. */
  const annonce = (html: string) => {
    sauver();
    render();
    afficherAnnonce(html);
  };

  /** Le résultat d'une quête : dans la fenêtre de la quête si elle est ouverte (récompense, partage, Continuer). */
  const messageQuete = (html: string) => {
    epreuveQuete = undefined;
    if (!queteOuverte) return message(html);
    resultatQuete = html;
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
    if (taxe()) {
      visite.message = "Le garde te barre le passage avec sa hallebarde. « On paie d'abord. On visite après. »";
      return entrer();
    }
    const chemin = trajetCite(c, lieu(p.lieu), lieu(id));
    // À vitesse ×1, environ 7 s pour traverser la ville ; le réglage de vitesse divise cette durée.
    const duree = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : Math.max(1500, longueurCite(c, chemin) * 70);
    const arriver = () => {
      enRoute = false;
      passerTemps(p, (longueurCite(c, chemin) / 100) * c.heuresTraversee);
      p.lieu = id;
      visite = {};
      epreuveQuete = undefined;
      queteOuverte = undefined;
      resultatQuete = undefined;
      sauver();
      entrer();
    };
    if (duree === 0) return arriver();

    // Fermer la fenêtre et montrer le trajet avant de partir.
    popup = false;
    vue = 'lieu';
    render();
    enRoute = true;
    const points = chemin.map(([x, y]) => `${x},${y}`).join(' ');
    let avance = 0;
    let avant = performance.now();
    const pas = (maintenant: number) => {
      // La vitesse peut changer en pleine marche : on avance par petits bouts.
      avance += ((maintenant - avant) * vitesse()) / duree;
      avant = maintenant;
      const t = Math.min(1, avance);
      // Démarrage et arrivée en douceur.
      const [x, y] = pointCite(c, chemin, t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
      // Le plan peut être redessiné en pleine marche (onglet, sac) : on reprend le marqueur et le tracé à chaque pas.
      const heros = app.querySelector<HTMLElement>('#heros');
      if (heros) {
        heros.style.left = `${x}%`;
        heros.style.top = `${y}%`;
      }
      const trace = app.querySelector('#trace');
      if (trace && trace.getAttribute('points') !== points) trace.setAttribute('points', points);
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
      // Revenir au plan ne rouvre pas la fenêtre du lieu (sauf droit d'entrée à régler).
      if (vue === 'lieu') popup = !!taxe();
      visite.message = undefined;
      render();
    });
    sur('#fermer-lieu', () => {
      popup = false;
      render();
    });
    sur('[data-payer-soin]', (el) => {
      const d = demandesSoin[Number(el.dataset.payerSoin)];
      const r = payerSoins(p, d);
      if (r.startsWith('Il te manque')) return;
      demandesSoin = demandesSoin.filter((x) => x !== d);
      vieLignes = [...vieLignes, r].slice(-4);
      sauver();
      render();
    });
    sur('[data-refuser-soin]', (el) => {
      const d = demandesSoin[Number(el.dataset.refuserSoin)];
      demandesSoin = demandesSoin.filter((x) => x !== d);
      vieLignes = [...vieLignes, refuserSoins(p, d)].slice(-4);
      sauver();
      render();
    });
    sur('[data-ouvrir-quete]', (el) => {
      queteOuverte = el.dataset.ouvrirQuete;
      resultatQuete = undefined;
      epreuveQuete = undefined;
      render();
    });
    sur('#fermer-quete, #continuer-quete', () => {
      resultatQuete = undefined;
      queteOuverte = undefined;
      epreuveQuete = undefined;
      render();
    });
    app.querySelector('#popup-quete')?.addEventListener('click', (e) => {
      if (e.target === e.currentTarget) {
        queteOuverte = undefined;
        resultatQuete = undefined;
        epreuveQuete = undefined;
        render();
      }
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
    sur('#payer-peage', () => {
      const refus = payerPeage(p, c, taxe()!.g);
      if (refus) return message(echapper(refus));
      peageEnCours = undefined;
      message(`Le garde empoche les pièces et s'écarte. Bienvenue à ${echapper(c.nom)}.`);
    });
    sur('#discuter-peage', () => {
      taxe()!.discute = true;
      render();
    });
    sur('#lancer-peage', (bouton) => {
      const d = lancer(20);
      (bouton as HTMLButtonElement).disabled = true;
      animerDes([app.querySelector<HTMLElement>('#de-peage')!], 20, [d]).then(() =>
        setTimeout(() => {
          const t = taxe()!;
          t.g = discuterPeage(p, t.g, d);
          t.discute = false;
          render();
        }, 350),
      );
    });
    sur('#quitter', () => {
      p.peage = undefined;
      peageEnCours = undefined;
      noter(p, `quitte ${c.nom}.`);
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
          visite.marchandage = marchander(valeurMarchandage(), lieu(p.lieu).boutique!.stock, d);
          render();
        }, 350),
      );
    });
    sur('[data-onglet-boutique]', (el) => {
      visite.ongletBoutique = el.dataset.ongletBoutique as Visite['ongletBoutique'];
      render();
    });
    sur('.acheter', (el) => {
      const o = objet(el.dataset.id!);
      const refus = acheter(p, o.id, Number(el.dataset.prix));
      if (refus) return annonce(echapper(refus));
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
      annonce(texte);
    });
    sur('.vendre', (el) => {
      const o = objet(el.dataset.id!);
      const refus = vendre(p, o.id, Number(el.dataset.prix));
      if (!refus) noter(p, `vend ${o.nom} pour ${formatOr(Number(el.dataset.prix))}.`);
      annonce(refus ? echapper(refus) : `Tu vends <b>${echapper(o.nom)}</b> pour ${formatOr(Number(el.dataset.prix))}.`);
    });

    // Bars, auberges, soins
    sur('#chope', () => {
      const l = lieu(p.lieu);
      if (p.or < l.chope!) return message("Le patron ne fait pas crédit.");
      p.or -= l.chope!;
      const liste = l.rumeurs === 'louches' ? c.rumeurs.louches : c.rumeurs.normales;
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
      const plaintes = partageDuSoir(p);
      const rendu = dormir(p, l.auberge!.confort);
      noter(p, `passe la nuit à « ${l.nom} » et récupère ${rendu} PV.`);
      message(`Tu dors comme une bûche${l.auberge!.confort === 'normal' ? ', malgré les chants de marins' : ''}. Au matin du ${dateLongue(p.jour)}, tu as récupéré <b>${rendu} PV</b>.${plaintes}`);
    });
    sur('#soigner', () => {
      const l = lieu(p.lieu);
      const n = Math.min(evMax(p) - p.ev, Math.floor(p.or / l.prixSoin!));
      p.or -= n * l.prixSoin!;
      soigner(p, n);
      noter(p, `se fait soigner (${l.nom}, ${n} PV).`);
      annonce(`Le soigneur marmonne une formule et applique un onguent qui pique. Tu récupères <b>${n} PV</b>.`);
    });
    sur('[data-soin-grave]', (el) => {
      const l = lieu(p.lieu);
      const s = soinsGraves(p, `${c.id}:${l.id}`, l.prixSoin!).possibles.find((g) => g.index === Number(el.dataset.soinGrave));
      if (s) annonce(echapper(soignerGrave(p, s)));
    });
    sur('#action-lieu', () => message(echapper(lieu(p.lieu).action!.texte)));

    // Idées de joueurs validées pour ce lieu
    lierIdeesLieu(
      app,
      p,
      () => {
        sauver();
        render();
      },
      (r) =>
        ecranCombat(app, p, r, (bilan) => {
          if (bilan.fin === 'victoire') return message(`Victoire (+${bilan.xp} XP).${pertes(bilan)}`);
          if (bilan.fin === 'fuite') return message('Tu prends tes jambes à ton cou.');
          noter(p, 'tombe au combat.');
          const venge = bilan.venge ? ` ${vengeTexte(bilan)}` : '';
          ecranMort(app, p, 'Tout devient noir… Tu t\'effondres au milieu du combat.', (texte) => message(echapper(texte) + venge), sorties.finDePartie);
        }),
    );

    // Quêtes
    lierQuetes(
      app,
      p,
      {
        message: messageQuete,
        combat: (r: Rencontre, apres) =>
          ecranCombat(app, p, r, (bilan) => {
            if (bilan.fin === 'victoire') return messageQuete(`Victoire (+${bilan.xp} XP). ${echapper(apres())}${pertes(bilan)}`);
            if (bilan.fin === 'fuite') return messageQuete('Tu prends tes jambes à ton cou. Tu pourras revenir finir le travail.');
            noter(p, 'tombe au combat.');
            // Les compagnons ont gagné : la quête avance quand même.
            const venge = bilan.venge ? ` ${vengeTexte(bilan)} ${echapper(apres())}` : '';
            ecranMort(app, p, 'Tout devient noir… Tu t\'effondres au milieu du combat.', (texte) => messageQuete(echapper(texte) + venge), sorties.finDePartie);
          }),
        donjon: (id, par) => sorties.entrerDonjon(id, par),
      },
      (id) => {
        epreuveQuete = id;
        render();
      },
    );
  };

  // Échap ferme la fenêtre du lieu. Un seul écouteur à la fois, même si l'écran est recréé.
  if (echapActif) document.removeEventListener('keydown', echapActif);
  echapActif = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && popup && vue === 'lieu' && app.querySelector('#plan') && app.querySelector('#popup')) {
      // Le parchemin ouvert se referme d'abord.
      if (queteOuverte) {
        queteOuverte = undefined;
        resultatQuete = undefined;
        epreuveQuete = undefined;
        return render();
      }
      popup = false;
      render();
    }
  };
  document.addEventListener('keydown', echapActif);

  render();
};
