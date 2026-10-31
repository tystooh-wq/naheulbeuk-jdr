import { dateLongue } from '../rules/calendrier';
import carteFangh from '../assets/fangh.jpg';
import {
  CARTE_MONDE,
  CREPUSCULE,
  AUBE,
  LIEUX_MONDE,
  NOM_TERRAIN,
  PISTES,
  itineraire,
  itineraireDirect,
  itineraireEtapes,
  lieuMonde,
  positionApres,
  terrainApres,
  zoneEn,
  type Itineraire,
  type LieuMonde,
  type Point,
  type TypeLieuMonde,
} from '../rules/monde';
import { avecDe, lancer, type Rng } from '../rules/des';
import { controler, INTERVALLE_CONTROLE, type Evenement, type Resultat } from '../rules/evenements';
import { aTalent, bonusSituation, empechement, savoir, texteBonus, utiliserTalent, TALENTS_ACTIFS } from '../rules/talents';
import { bivouaquer, dormir, evMax, niveau, formatHeure, noter, passerTemps, soigner, valeursCombat, type Partie } from '../rules/partie';
import { bonusTactique, resoudre, singulier, TABLES, TACTIQUES, tactiquesPossibles, valeurTactique, tirerNombre, tirerRencontre, type Issue, type Rencontre, type Tactique, type Zone } from '../rules/rencontres';
import { objet } from '../rules/objets';
import { lierQuetes, marqueQuete, panneauJournalQuetes, panneauQuetes } from './quetes';
import { arrondirOr, formatOr } from '../rules/monnaie';
import { bandeau, jaugeReputation, lierSac, lierVitesse, majHorloge, panneauGroupe, panneauJournal, panneauSac, vitesse } from './commun';
import { animerDes, de, echapper } from './outils';
import { ecranCombat, type BilanCombat } from './combat';
import { cite, CITES } from '../rules/cites';
import { EVENEMENT_PROVOQUER } from './encyclopedie';
import { boutonAutrement, lierIdeesLieu, panneauIdeesLieu, ideesValidees, type Contexte, type ResultatIdee, NOM_EPREUVE, resoudreIdee, surChangement, valeurEpreuve, type Idee } from './idees';
import { sauvegarderPartie } from './sauvegarde';

// La carte de la Terre de Fangh : on s'y déplace de lieu en lieu le long des pistes, l'horloge tourne,
// la nuit oblige à bivouaquer et le MJ glisse des rencontres en chemin.

const ICONES: Record<TypeLieuMonde, string> = { ville: '♜', village: '⌂', campement: '▲', grotte: '◆', bac: '≈', donjon: '♖', mine: '⚒' };
const LEGENDE: [TypeLieuMonde, string][] = [
  ['ville', 'Cité'],
  ['village', 'Village'],
  ['campement', 'Campement'],
  ['bac', 'Bac'],
  ['grotte', 'Grottes'],
  ['donjon', 'Donjon'],
  ['mine', 'Mine'],
];

/** Durée réelle d'une heure de marche à la vitesse ×1. */
const MS_PAR_HEURE = 1000;
const ZOOMS = [0.3, 0.45, 0.65, 1, 1.4];

type Fenetre =
  | { type: 'lieu'; message?: string }
  | { type: 'itineraire'; vers: string; allure: 'normale' | 'forcee'; horsPiste: boolean }
  | { type: 'rencontre'; r: Rencontre; issue?: Issue; nuit: boolean; tactique?: Tactique; animerCoups?: boolean; bilan?: BilanCombat; idee?: IdeeJouee }
  | { type: 'evenement'; ev: Evenement; resultat?: Resultat; choix?: number; idee?: IdeeJouee }
  | { type: 'nuit'; resultat?: string; camping?: 'epreuve' | string }
  | { type: 'reprise' }
  | { type: 'mort' };

/** Une idée de joueur validée, choisie à la place des choix écrits : on lance le dé, puis on lit le résultat. */
interface IdeeJouee {
  idee: Idee;
  resultat?: ResultatIdee;
}

let rafraichirIdees: (() => void) | undefined;
surChangement(() => rafraichirIdees?.());

/** Le panneau d'une idée validée en cours : dé à lancer, ou résultat. */
const panneauIdee = (p: Partie, j: IdeeJouee, suite: string) => {
  const i = j.idee;
  if (j.resultat) return `<div class="recit">${echapper(j.resultat.texte)}</div><p>${suite}</p>`;
  return `<div class="recit lancer-joueur">${echapper(i.libelle ?? i.texte)}. Épreuve de ${NOM_EPREUVE[i.epreuve!]} : il faut faire <b>${valeurEpreuve(p, i)} ou moins</b> sur le D20.
    <div>${de('?', 'a-lancer" id="de-joueur')}<button id="lancer">Lancer le D20</button></div></div>`;
};

const boutonsIdees = (idees: Idee[]) =>
  idees.map((i) => `<button class="secondaire choix-joueur" data-idee-choix="${echapper(i.id)}" title="Idée de joueur validée">💡 ${echapper(i.libelle ?? i.texte)}</button>`).join('');

export interface Sorties {
  ouvrirFiche: () => void;
  retourAccueil: () => void;
  entrerVille: (id: string) => void;
  entrerDonjon: (id: string, par?: string) => void;
  finDePartie: () => void;
}

let echapActif: ((e: KeyboardEvent) => void) | undefined;
let provoquerActif: ((e: Event) => void) | undefined;

export const ecranMonde = (app: HTMLElement, p: Partie, s: Sorties) => {
  let vue: 'lieu' | 'sac' | 'groupe' | 'journal' | 'quetes' = 'lieu';
  let epreuveQuete: string | undefined;
  let message: string | undefined;
  // En arrivant sur la carte, aucune fenêtre ne s'ouvre : on clique sur sa position pour agir.
  let fenetre: Fenetre | null = p.voyage ? { type: 'reprise' } : null;
  let zoom = 3;
  let enMarche = false;
  let enregistre = true;
  let centre: Point = [lieuMonde(p.lieuMonde).x, lieuMonde(p.lieuMonde).y];

  const sauver = () => (enregistre = sauvegarderPartie(p));
  const voyage = (): Itineraire | null => (p.voyage ? itineraireEtapes(p.voyage.etapes, p.voyage.allure, p.voyage.horsPiste) : null);
  const position = (): Point => {
    const it = voyage();
    if (it && p.voyage) return positionApres(it, p.voyage.fait);
    const l = lieuMonde(p.lieuMonde);
    return [l.x, l.y];
  };
  const pct = ([x, y]: Point) => `left:${(x / CARTE_MONDE.largeur) * 100}%;top:${(y / CARTE_MONDE.hauteur) * 100}%`;
  const nuit = () => p.heure >= CREPUSCULE || p.heure < AUBE;
  centre = position();

  /** Repère de quête sur la carte : une étape ici, ou une étape dans la ville de ce lieu. */
  const marqueMonde = (l: LieuMonde) => {
    const ici = marqueQuete(p, `monde:${l.id}`);
    if (ici || !l.ville) return ici;
    const ville = cite(l.ville);
    const marques = ville.lieux.map((x) => marqueQuete(p, `ville:${ville.id}:${x.id}`));
    return marques.includes('etape') ? 'etape' : marques.includes('nouvelle') ? 'nouvelle' : '';
  };

  // --- Carte -------------------------------------------------------------------------

  const carte = () => {
    const it = voyage();
    const z = ZOOMS[zoom];
    return `<div class="carte-monde ${nuit() ? 'nuit' : ''}" id="carte">
      <div class="calque" id="calque" style="width:${CARTE_MONDE.largeur * z}px;height:${CARTE_MONDE.hauteur * z}px">
        <img src="${carteFangh}" alt="Carte de la Terre de Fangh" draggable="false" />
        <svg class="pistes" viewBox="0 0 ${CARTE_MONDE.largeur} ${CARTE_MONDE.hauteur}" aria-hidden="true">
          ${PISTES.filter((pi) => pi.terrain !== 'sentier')
            .map((pi) => `<polyline class="hors-piste" points="${pi.points.map((q) => q.join(',')).join(' ')}" />`)
            .join('')}
          ${it ? `<polyline class="itineraire" points="${it.troncons.flatMap((t) => t.points).map((q) => q.join(',')).join(' ')}" />` : ''}
        </svg>
        ${LIEUX_MONDE.map((l) => {
          const q = marqueMonde(l);
          return `<button class="poi poi-monde poi-${l.type} ${!p.voyage && l.id === p.lieuMonde ? 'ici' : ''}" style="${pct([l.x, l.y])}" data-lieu="${l.id}" aria-label="${echapper(l.nom)}${q ? ' (quête)' : ''}">
            <span>${ICONES[l.type]}</span><em>${echapper(l.nom)}</em>${q ? `<b class="marque-quete marque-${q}">${q === 'nouvelle' ? '!' : '➤'}</b>` : ''}
          </button>`;
        }).join('')}
        <div class="heros" id="heros" style="${pct(position())}" aria-hidden="true"></div>
      </div>
      <div class="zoom">
        <button class="secondaire petit" id="zoom-plus" aria-label="Zoomer" ${zoom === ZOOMS.length - 1 ? 'disabled' : ''}>+</button>
        <button class="secondaire petit" id="zoom-moins" aria-label="Dézoomer" ${zoom === 0 ? 'disabled' : ''}>−</button>
        <button class="secondaire petit" id="zoom-heros" aria-label="Centrer sur le héros">⌖</button>
      </div>
    </div>
    <div class="legende">${LEGENDE.map(([t, nom]) => `<span><i class="poi-mini poi-${t}">${ICONES[t]}</i>${nom}</span>`).join('')}
      <span><i class="trait-hors-piste"></i>Hors piste</span>
      <span><i class="marque-quete marque-etape">➤</i>Quête</span>
      <span><i class="heros-mini"></i>${echapper(p.perso.nom)}</span>
      ${CITES.map((c) => jaugeReputation(p, c.id, c.nom, true)).join('')}</div>`;
  };

  /** Place le calque pour que `centre` soit au milieu de la fenêtre, sans sortir de la carte. */
  const cadrer = () => {
    const vp = app.querySelector<HTMLElement>('#carte');
    const calque = app.querySelector<HTMLElement>('#calque');
    if (!vp || !calque) return;
    const z = ZOOMS[zoom];
    const w = CARTE_MONDE.largeur * z;
    const h = CARTE_MONDE.hauteur * z;
    const borne = (v: number, taille: number, vue: number) => (taille <= vue ? (vue - taille) / 2 : Math.min(0, Math.max(vue - taille, v)));
    const tx = borne(vp.clientWidth / 2 - centre[0] * z, w, vp.clientWidth);
    const ty = borne(vp.clientHeight / 2 - centre[1] * z, h, vp.clientHeight);
    calque.style.transform = `translate(${tx}px, ${ty}px)`;
    // Le centre réel, une fois borné, pour que le prochain glissé parte du bon endroit.
    centre = [(vp.clientWidth / 2 - tx) / z, (vp.clientHeight / 2 - ty) / z];
  };

  // --- Fenêtres --------------------------------------------------------------------------

  const illustration = (pt: Point, legende: string) => `<figure class="illustration monde">
      <div class="cadre"><img src="${carteFangh}" alt="" draggable="false" style="transform:translate(-${(pt[0] / CARTE_MONDE.largeur) * 100}%,-${(pt[1] / CARTE_MONDE.hauteur) * 100}%)" /></div>
      <figcaption>${echapper(legende)}</figcaption>
    </figure>`;

  /** Toute fenêtre a son « J'aurais fait autrement » : celui du corps s'il y en a un, sinon un pour la fenêtre entière. */
  const cadreFenetre = (pt: Point, legende: string, titre: string, sousTitre: string, corps: string, fermable = true, contexte?: Contexte) => `
    <div class="popup-lieu" id="popup" role="dialog" aria-labelledby="titre-lieu">
      ${illustration(pt, legende)}
      <div class="panneau carte-lieu" id="panneau">
        ${fermable ? '<div class="barre-fermer"><button class="secondaire petit fermer" id="fermer-lieu" aria-label="Fermer et revenir à la carte">✕</button></div>' : ''}
        <div class="entete-lieu"><div><h2 id="titre-lieu">${titre}</h2><div class="note">${sousTitre}</div></div></div>
        ${corps}
        ${corps.includes('data-autrement') ? '' : `<p>${boutonAutrement(contexte ?? { type: 'evenement', id: `monde:${legende}`, titre: `${legende} (carte du monde)` })}</p>`}
      </div>
    </div>`;

  const dureeTexte = (h: number) => {
    const heures = Math.floor(h);
    const minutes = Math.round(((h - heures) * 60) / 10) * 10;
    return minutes === 60 ? `${heures + 1} h` : `${heures} h${minutes ? String(minutes).padStart(2, '0') : ''}`;
  };

  const fenetreLieu = (l: LieuMonde, msg?: string) => {
    const actions: string[] = [];
    if (l.ville) actions.push(`<button id="entrer-ville" data-ville="${l.ville}">Entrer dans ${echapper(l.nom)}</button>`);
    if (l.guerisseur) {
      const manque = evMax(p) - p.ev;
      const n = Math.min(manque, Math.floor(p.or / l.guerisseur));
      if (manque > 0) actions.push(`<button class="secondaire" id="guerisseur" ${n ? '' : 'disabled'}>Voir le guérisseur du village (${n} PV pour ${formatOr(n * l.guerisseur)})</button>`);
    }
    if (l.auberge) {
      const a = l.auberge;
      actions.push(`<button id="repas" ${p.or < a.repas ? 'disabled' : ''}>Manger un repas (${a.repas} PO)</button>`);
      actions.push(`<button id="chambre" ${p.or < a.chambre ? 'disabled' : ''}>Dormir à « ${echapper(a.nom)} » (${a.chambre} PO)</button>`);
    }
    if (l.rations) actions.push(`<button class="secondaire" id="rations" ${p.or < l.rations ? 'disabled' : ''}>Acheter des rations, 2 repas (${l.rations} PO)</button>`);
    if (!l.ville) actions.push('<button class="secondaire" id="camper">Bivouaquer ici jusqu\'à l\'aube</button>');
    let extra = '';
    if (l.type === 'bac') extra = '<p><button disabled>Traverser vers la Caladie</button> <span class="note">La Caladie n\'est pas encore sur la carte du jeu.</span></p>';
    if (l.planAVenir) extra += `<p class="note">${echapper(l.nom)} a un plan officiel : on pourra s'y promener dans une prochaine version.</p>`;
    extra += panneauQuetes(p, `monde:${l.id}`, epreuveQuete);
    const corps = `<p>${echapper(l.description)}</p>${extra}
      ${msg ? `<div class="recit">${msg}</div>` : ''}
      <p class="actions-lieu">${actions.join('')}</p>
      ${l.inventeNom ? '<p class="note">Lieu dessiné sur la carte officielle mais sans nom : celui-ci est inventé pour le jeu.</p>' : ''}
      ${panneauIdeesLieu(p, `monde:${l.id}`)}
      <p class="note">Pour partir, ferme cette fenêtre et clique sur une destination.</p>
      <p>${boutonAutrement({ type: 'lieu', id: `monde:${l.id}`, titre: l.nom })}</p>`;
    return cadreFenetre([l.x, l.y], l.nom, echapper(l.nom), `${nuit() ? 'De nuit' : 'De jour'} · ${formatHeure(p.heure)}`, corps);
  };

  const fenetreItineraire = (vers: string, allure: 'normale' | 'forcee', horsPiste: boolean) => {
    const l = lieuMonde(vers);
    const route = itineraire(p.lieuMonde, vers, allure);
    const direct = itineraireDirect(p.lieuMonde, vers, allure);
    const it = horsPiste || !route ? direct : route;
    const parTerrain = new Map<string, number>();
    for (const t of it.troncons) parTerrain.set(NOM_TERRAIN[t.terrain], (parTerrain.get(NOM_TERRAIN[t.terrain]) ?? 0) + t.km);
    const arrivee = p.heure + it.heures;
    const nuitEnRoute = nuit() || arrivee > CREPUSCULE;
    const corps = `<p>${echapper(l.description)}</p>
      <div class="detail-choix">
        <p><b>${Math.round(it.km)} km</b> (${[...parTerrain].map(([t, km]) => `${Math.round(km)} km de ${t}`).join(', ')}), soit environ <b>${dureeTexte(it.heures)} de marche</b>.</p>
        <p>${it.horsPiste ? 'Tout droit à travers la lande, sans suivre de chemin.' : `En passant par : ${it.etapes.map((e) => echapper(lieuMonde(e).nom)).join(' → ')}.`}</p>
        ${
          nuitEnRoute
            ? `<p class="alerte">La nuit tombe à ${CREPUSCULE} h : il faudra bivouaquer en chemin. ${p.sac.includes('couverture') ? '' : "Tu n'as pas de couverture. "}${p.sac.includes('rations') ? '' : "Tu n'as pas de rations."}</p>`
            : `<p>Arrivée prévue vers ${formatHeure(arrivee)}.</p>`
        }
        <fieldset class="allure"><legend>Chemin</legend>
          ${route ? `<label><input type="radio" name="chemin" value="route" ${!it.horsPiste ? 'checked' : ''} /> Suivre la route : ${Math.round(route.km)} km, ${dureeTexte(route.heures)}</label>` : ''}
          <label><input type="radio" name="chemin" value="direct" ${it.horsPiste ? 'checked' : ''} /> Ne pas suivre la route : ${Math.round(direct.km)} km, ${dureeTexte(direct.heures)}.
            <span class="note">Plus court, mais loin des patrouilles et des villages : deux fois plus d'embûches et de rencontres.</span></label>
        </fieldset>
        <fieldset class="allure"><legend>Allure</legend>
          <label><input type="radio" name="allure" value="normale" ${allure === 'normale' ? 'checked' : ''} /> Voyage normal</label>
          <label><input type="radio" name="allure" value="forcee" ${allure === 'forcee' ? 'checked' : ''} /> Marche forcée (plus rapide, −2 PV par jour de marche)</label>
        </fieldset>
        <p class="note">Vitesses du supplément « Déplacements et transport » : 30 km par jour sur piste, 26 dans les dunes.</p>
      </div>
      <p class="actions-lieu"><button id="partir">Partir</button><button class="secondaire" id="fermer-lieu-bas">Rester ici</button></p>`;
    return cadreFenetre([l.x, l.y], l.nom, `Aller à ${echapper(l.nom)}`, `Depuis ${echapper(lieuMonde(p.lieuMonde).nom)}`, corps, true, {
      type: 'lieu',
      id: `trajet:${p.lieuMonde}:${vers}`,
      titre: `Trajet vers ${l.nom}`,
    });
  };

  const fenetreRencontre = (f: Extract<Fenetre, { type: 'rencontre' }>) => {
    const { r, issue } = f;
    const l = r.ligne;
    const tactiques: Tactique[] = tactiquesPossibles(p, l);
    const renforts = aTalent(p, 'Appel des renforts');
    const v = valeursCombat(p);
    const nom = r.nombre > 1 ? `${r.nombre} ${l.nom}` : singulier(l);
    const stats = `<p class="pastille">Chacun : AT ${l.at} · PRD ${l.prd} · EV ${l.ev} · PR ${l.pr} · dégâts ${echapper(l.degats)} · COU ${l.cou}${l.notes ? ` · ${echapper(l.notes)}` : ''}</p>`;
    let corps = `<p>${f.nuit ? 'Au milieu de la nuit, des bruits près du camp…' : 'Sur le chemin, tu tombes nez à nez avec'} <b>${echapper(nom)}</b>. ${r.nombre > 1 ? 'Ils ont' : 'Ça a'} l'air hostile.</p>
      ${stats}
      <p class="note">Table « ${echapper(r.table ?? 'Rencontres en terre sauvage 1')} », D20 : ${r.d20}. Tu peux te battre, ou tenter de t'en sortir par une épreuve.</p>
      ${r.nombre >= 3 ? `<p class="note">Conseil du MJ : seul contre ${r.nombre}, même un héros finit en charpie. Trois au plus te tomberont dessus à la fois, et tu ne pares qu'un coup par assaut.</p>` : ''}`;
    const contexte = { type: 'rencontre' as const, id: l.nom, titre: l.rencontre };
    if (f.idee) {
      corps += panneauIdee(
        p,
        f.idee,
        f.idee.resultat?.reussi ? '<button id="suite">Continuer</button>' : f.idee.resultat?.combat ? '<button data-combat-idee>⚔ Combattre</button>' : '<button data-combattre>⚔ Combattre</button>',
      );
    } else if (f.bilan) {
      const b = f.bilan;
      corps += `<div class="recit">${
        b.fin === 'victoire'
          ? `Le combat est fini : tu restes seul debout. ${b.xp} points d'expérience${b.or ? `, ${b.or} pièces d'or` : ''}${
              b.objets.length ? `, et dans ton sac : ${b.objets.map((o) => objet(o).nom).join(', ')}` : ''
            }.`
          : "Tu as réussi à t'enfuir, le souffle court."
      }${b.perdu > 0 ? ` Tu y as laissé ${b.perdu} PV.` : ''}</div>
      <p><button id="suite">Continuer</button></p>`;
    } else if (!issue && f.tactique) {
      const t = TACTIQUES[f.tactique];
      corps += `<div class="recit lancer-joueur">${t.libelle} : épreuve de ${t.nomCarac}${echapper(texteBonus(bonusTactique(p, f.tactique)))}. Il faut faire <b>${valeurTactique(p, f.tactique)} ou moins</b> sur le D20.${
        f.tactique === 'fuir' && renforts ? ' <i>Appel des renforts : même raté, personne ne te frappe.</i>' : ''
      }
        <div>${de('?', 'a-lancer" id="de-joueur')}<button id="lancer">Lancer le D20</button></div></div>`;
    } else if (!issue) {
      corps += `<p class="actions-lieu"><button data-combattre>⚔ Combattre</button>${tactiques
        .map(
          (t) =>
            `<button data-tactique="${t}">${TACTIQUES[t].libelle} (${TACTIQUES[t].nomCarac} ${valeurTactique(p, t)}${t === 'menacer' ? ', compétence' : ''}${
              t === 'fuir' && renforts ? ', sans risque' : ''
            })</button>`,
        )
        .join('')}${boutonsIdees(ideesValidees('rencontre', l.nom))}</p>
        <p>${boutonAutrement(contexte)}</p>`;
    } else {
      const e = issue.epreuve;
      corps += issue.surprise
        ? `<div class="recit">Épreuve : ${de(e.de)} contre ${e.valeur}. Ratée. ${echapper(singulier(l))} ne comprend rien, et ce qu'il ne comprend pas, il le cogne : il attaque par surprise, avec l'initiative !</div>
          <p><button data-combattre>⚔ Combattre</button></p>`
        : `<div class="recit">Épreuve : ${de(e.de)} contre ${e.valeur}. ${
        e.reussi
          ? f.tactique === 'embrouiller'
            ? `Réussie ! « Être ou ne pas être ? » ${echapper(singulier(l))} s'assoit, profondément déboussolé par ce problème. Tu en profites pour filer.`
            : 'Réussie ! Tu t\'en sors sans une égratignure.'
          : `Ratée. Avant que tu ne t'échappes, ${issue.coups.length > 1 ? 'ils frappent' : 'il frappe'} :
            <ul>${issue.coups.map((c, i) => `<li>Coup ${i + 1} : ${c.des.map((d) => de(d, 'petit coup')).join('')} ${c.degats} dégâts, ${c.blessure} après ton armure</li>`).join('')}</ul>
            Tu perds <b>${issue.perdu} PV</b>.`
      }</div>
      <p><button id="suite">Continuer</button></p>`;
    }
    return cadreFenetre(position(), 'Rencontre', 'Rencontre !', `${formatHeure(p.heure)}, ${NOM_TERRAIN[terrainActuel()]}`, corps, false, contexte);
  };

  const fenetreEvenement = (f: Extract<Fenetre, { type: 'evenement' }>) => {
    const { ev, resultat } = f;
    let corps = `<p>${echapper(ev.texte)}</p>`;
    if (f.idee) {
      corps += panneauIdee(p, f.idee, f.idee.resultat?.combat ? '<button data-combat-idee>⚔ Combattre</button>' : '<button id="suite">Continuer</button>');
    } else if (!resultat && f.choix !== undefined) {
      const c = ev.choix[f.choix];
      const jet = c.jet!;
      const valeur = jet.valeur?.(p);
      corps += `<div class="recit lancer-joueur">${echapper(c.libelle)}. Lance le D${jet.faces} pour ${echapper(jet.pour)}${valeur !== undefined ? ` : il faut faire <b>${valeur} ou moins</b>` : ''}.
        <div>${de('?', 'a-lancer" id="de-joueur')}<button id="lancer">Lancer le D${jet.faces}</button></div></div>`;
    } else if (!resultat) {
      corps += `<p class="actions-lieu">${ev.choix
        .map((c, i) => {
          if (c.visible && !c.visible(p)) return '';
          const refus = c.possible?.(p) ?? null;
          return `<button data-choix="${i}" ${refus ? `disabled title="${echapper(refus)}"` : ''}>${echapper(c.libelle)}</button>`;
        })
        .join('')}${boutonsIdees(ideesValidees('evenement', ev.id))}</p>
        <p>${boutonAutrement({ type: 'evenement', id: ev.id, titre: ev.titre })}</p>`;
    } else {
      corps += `<div class="recit">${echapper(resultat.texte)}</div><p>${
        resultat.combat ? '<button id="combat-evenement">⚔ Combattre</button>' : '<button id="suite">Continuer</button>'
      }</p>`;
    }
    return cadreFenetre(position(), 'En chemin', echapper(ev.titre), `${formatHeure(p.heure)}, en chemin`, corps, false, {
      type: 'evenement',
      id: ev.id,
      titre: ev.titre,
    });
  };

  /** Compétences de camping : un bivouac de qualité sur une épreuve d'ingéniosité +3. */
  const campingHtml = (f: Extract<Fenetre, { type: 'nuit' }>) => {
    const t = TALENTS_ACTIFS.find((x) => x.id === 'camping')!;
    if (!t.competences.some((c) => aTalent(p, c))) return '';
    if (f.camping === 'epreuve')
      return `<div class="recit lancer-joueur">Monter un bivouac de qualité : épreuve d'ingéniosité +3, il faut faire <b>${t.epreuve!(p)} ou moins</b>.
        <div>${de('?', 'a-lancer" id="de-camp')}<button id="lancer-camp">Lancer le D20</button></div></div>`;
    if (f.camping) return `<div class="recit">${f.camping}</div>`;
    const refus = empechement(p, t, 'bivouac', zoneEn(position()));
    return refus
      ? `<p class="note">${echapper(refus)}</p>`
      : `<p><button class="secondaire" id="camping">⛺ ${echapper(t.libelle)} (épreuve d'ingéniosité +3 : +2 PV, +4 PA)</button></p>`;
  };

  const fenetreNuit = (f: Extract<Fenetre, { type: 'nuit' }>) => {
    const corps = f.resultat
      ? `<div class="recit">${f.resultat}</div><p><button id="suite">${p.voyage ? 'Reprendre la route' : 'Continuer'}</button></p>`
      : `<p>Le soleil se couche sur les Terres Sauvages. Marcher de nuit, c'est le meilleur moyen de finir dans un ravin ou dans l'estomac de quelque chose.</p>
        <p>${p.sac.includes('couverture') ? 'Tu as une couverture : récupération normale.' : 'Sans couverture, la nuit sera froide : récupération basse.'}
        ${p.sac.includes('rations') ? 'Tu manges une ration.' : "Pas de ration : tu dormiras le ventre vide (récupération divisée par deux)."}</p>
        ${campingHtml(f)}
        ${aTalent(p, 'Sentir des pieds') ? '<p class="note">Sentir des pieds : tu retires tes bottes. Aucune bête sensée n\'approchera du camp cette nuit.</p>' : ''}
        <p><button id="bivouac">Installer le bivouac</button></p>`;
    return cadreFenetre(position(), 'Bivouac', 'La nuit tombe', `${dateLongue(p.jour)}, ${formatHeure(p.heure)}`, corps, false, {
      type: 'evenement',
      id: f.resultat ? 'nuit-reveil' : 'nuit-tombe',
      titre: f.resultat ? 'Réveil au bivouac' : 'La nuit tombe',
    });
  };

  const fenetreReprise = () => {
    const it = voyage()!;
    const corps = `<p>Tu étais en route vers <b>${echapper(lieuMonde(it.etapes[it.etapes.length - 1]).nom)}</b>. Il reste environ ${dureeTexte(it.heures - p.voyage!.fait)} de marche.</p>
      <p><button id="suite">Reprendre la route</button></p>`;
    return cadreFenetre(position(), 'En chemin', 'En voyage', `${formatHeure(p.heure)}`, corps, false);
  };

  const fenetreMort = () => {
    const destin = p.perso.destin;
    const corps = `<p>Tes jambes se dérobent, la lumière baisse… ${echapper(p.perso.nom)} s'effondre au bord du chemin.</p>
      ${
        destin > 0
          ? `<p>Il te reste <b>${destin} point${destin > 1 ? 's' : ''} de destin</b>. Les dieux de Fangh peuvent te renvoyer parmi les vivants, une fois de plus.</p>
             <p class="actions-lieu"><button id="revivre">Revenir à la vie (−1 point de destin)</button><button class="secondaire" id="abandonner">Abandonner la partie</button></p>`
          : `<p>Tu n'as plus de point de destin. C'est la fin de l'aventure. Le MJ rangera ta fiche dans le tiroir des héros disparus.</p>
             <p><button id="abandonner">Fin de la partie</button></p>`
      }`;
    return cadreFenetre(position(), 'Ci-gît', 'Mort', `${dateLongue(p.jour)}`, corps, false, { type: 'evenement', id: 'mort', titre: `Mort de ${p.perso.nom}` });
  };

  const fenetreHtml = () => {
    if (!fenetre || vue !== 'lieu') return '';
    switch (fenetre.type) {
      case 'lieu':
        return fenetreLieu(lieuMonde(p.lieuMonde), fenetre.message);
      case 'itineraire':
        return fenetreItineraire(fenetre.vers, fenetre.allure, fenetre.horsPiste);
      case 'rencontre':
        return fenetreRencontre(fenetre);
      case 'evenement':
        return fenetreEvenement(fenetre);
      case 'nuit':
        return fenetreNuit(fenetre);
      case 'reprise':
        return fenetreReprise();
      case 'mort':
        return fenetreMort();
    }
  };

  const terrainActuel = () => {
    const it = voyage();
    return it && p.voyage ? terrainApres(it, p.voyage.fait) : 'sentier';
  };

  // --- Rendu ---------------------------------------------------------------------------

  const render = () => {
    const panneau = vue === 'sac' ? panneauSac(p, message) : vue === 'groupe' ? panneauGroupe(p, message) : vue === 'journal' ? panneauJournal(p) : vue === 'quetes' ? panneauJournalQuetes(p) : '';
    const ouvert = vue === 'lieu' && !!fenetre;
    app.innerHTML = `<div class="page page-ville">
      ${bandeau(p, vue, 'Carte')}
      <div class="scene ${ouvert ? 'popup-ouverte' : ''}" id="scene">
        ${carte()}
        ${fenetreHtml()}
      </div>
      ${vue === 'lieu' && !fenetre ? `<p class="note">Glisse la carte pour la déplacer. Clique sur un lieu pour voir l'itinéraire, ou sur ta position pour y agir.</p>` : ''}
      ${panneau}
      ${enregistre ? '' : '<p class="alerte">Ce navigateur ne permet pas de sauvegarder : ta partie sera perdue si tu fermes la page.</p>'}
      <div class="actions"><button class="secondaire" id="accueil">Accueil</button></div>
    </div>`;
    cadrer();
    lier();
    lierSuite();
    // Les coups de l'adversaire roulent tout seuls : ce sont ses dés, pas ceux du joueur.
    if (fenetre?.type === 'rencontre' && fenetre.animerCoups) {
      fenetre.animerCoups = false;
      const des = [...app.querySelectorAll<HTMLElement>('.de.coup')];
      animerDes(des, 6, des.map((d) => Number(d.textContent)));
    }
  };

  // --- Voyage ----------------------------------------------------------------------------

  const fermer = () => {
    fenetre = null;
    render();
  };

  /** Met fin à la marche si le héros est mort ; sinon renvoie false. */
  const verifierMort = () => {
    if (p.ev > 0) return false;
    p.ev = 0;
    enMarche = false;
    fenetre = { type: 'mort' };
    sauver();
    render();
    return true;
  };

  const partir = (vers: string, allure: 'normale' | 'forcee', horsPiste: boolean) => {
    const it = (!horsPiste && itineraire(p.lieuMonde, vers, allure)) || itineraireDirect(p.lieuMonde, vers, allure);
    p.voyage = { etapes: it.etapes, fait: 0, allure, horsPiste: !!it.horsPiste, prochainControle: Math.min(INTERVALLE_CONTROLE, it.heures / 2) };
    noter(p, `part pour ${lieuMonde(vers).nom} (${Math.round(it.km)} km${it.horsPiste ? ', hors des routes' : ''}).`);
    sauver();
    marcher();
  };

  const arriver = () => {
    const it = voyage()!;
    const dest = it.etapes[it.etapes.length - 1];
    p.lieuMonde = dest;
    p.voyage = undefined;
    noter(p, `arrive à ${lieuMonde(dest).nom}.`);
    enMarche = false;
    fenetre = { type: 'lieu' };
    centre = position();
    sauver();
    render();
  };

  /** Marche forcée : 2 PV par jour de marche (10 h), comptés au fur et à mesure. */
  const fatigue = (heures: number) => {
    if (p.voyage?.allure !== 'forcee') return;
    const avant = Math.floor(((p.voyage.fait - heures) * 2) / 10);
    const apres = Math.floor((p.voyage.fait * 2) / 10);
    p.ev -= apres - avant;
  };

  const marcher = () => {
    if (!p.voyage) return;
    if (nuit()) {
      fenetre = { type: 'nuit' };
      render();
      return;
    }
    enMarche = true;
    fenetre = null;
    render();
    const it = voyage()!;
    let avant = performance.now();
    const pas = (maintenant: number) => {
      if (!enMarche || !p.voyage) return;
      let dh = ((maintenant - avant) / MS_PAR_HEURE) * vitesse();
      avant = maintenant;
      // On s'arrête net au crépuscule, au prochain contrôle du MJ ou à l'arrivée.
      const limites = [CREPUSCULE - p.heure, p.voyage.prochainControle - p.voyage.fait, it.heures - p.voyage.fait];
      dh = Math.min(dh, ...limites.map((x) => Math.max(0, x)));
      p.voyage.fait += dh;
      passerTemps(p, dh);
      fatigue(dh);
      const pt = positionApres(it, p.voyage.fait);
      // On reprend le marqueur à chaque pas : un zoom ou un changement d'onglet redessine la carte.
      app.querySelector<HTMLElement>('#heros')?.setAttribute('style', pct(pt));
      // La carte suit le héros, sauf si le joueur est en train de la faire glisser.
      if (!deplace) {
        centre = pt;
        cadrer();
      }
      majHorloge(app, p);
      if (verifierMort()) return;

      if (p.voyage.fait >= it.heures - 1e-6) return arriver();
      if (p.heure >= CREPUSCULE - 1e-6) {
        enMarche = false;
        centre = pt;
        fenetre = { type: 'nuit' };
        sauver();
        return render();
      }
      if (p.voyage.fait >= p.voyage.prochainControle - 1e-6) {
        p.voyage.prochainControle += INTERVALLE_CONTROLE;
        const c = controler(terrainApres(it, p.voyage.fait), false, undefined, p.voyage.horsPiste, p, zoneEn(position()));
        if (c.type !== 'rien') {
          enMarche = false;
          centre = pt;
          fenetre = c.type === 'rencontre' ? { type: 'rencontre', r: tirerRencontre(undefined, zoneEn(position()), niveau(p)), nuit: false } : { type: 'evenement', ev: c.evenement };
          sauver();
          return render();
        }
      }
      requestAnimationFrame(pas);
    };
    requestAnimationFrame(pas);
  };

  /** Bivouac de nuit : le MJ vérifie d'abord si quelque chose rôde autour du camp. */
  const installerBivouac = () => {
    // Sentir des pieds : bottes retirées, les prédateurs se tiennent à distance.
    if (aTalent(p, 'Sentir des pieds')) return dormirDehors();
    const c = controler(terrainActuel(), true, undefined, !!p.voyage?.horsPiste, p, zoneEn(position()));
    if (c.type === 'rencontre') {
      fenetre = { type: 'rencontre', r: { ...tirerRencontre(undefined, zoneEn(position()), niveau(p)), approche: 1 }, nuit: true };
      return render();
    }
    dormirDehors();
  };

  const dormirDehors = () => {
    // On dort jusqu'à l'aube : l'horloge avance jusqu'à 6 h du jour suivant.
    const b = bivouaquer(p);
    noter(p, `bivouaque et récupère ${b.rendu} PV.`);
    const confort = b.confort === 'normal' ? 'Bien emmitouflé dans ta couverture' : 'Recroquevillé sur le sol froid';
    fenetre = {
      type: 'nuit',
      resultat: `${confort}${b.matelas ? ', sur ton matelas de camping' : ''}, tu dors ${b.mange ? 'après un repas frugal' : 'le ventre vide'}. À l'aube du ${dateLongue(p.jour)}, ${b.rendu ? `tu as récupéré <b>${b.rendu} PV</b>` : 'tu te lèves en pleine forme'}.`,
    };
    sauver();
    render();
  };

  // --- Événements -----------------------------------------------------------------------

  const lier = () => {
    const sur = (sel: string, fn: (el: HTMLElement) => void) =>
      app.querySelectorAll<HTMLElement>(sel).forEach((el) => el.addEventListener('click', () => fn(el)));

    sur('[data-vue]', (el) => {
      vue = el.dataset.vue as typeof vue;
      message = undefined;
      if (vue === 'lieu' && !fenetre && !enMarche) fenetre = p.voyage ? { type: 'reprise' } : { type: 'lieu' };
      render();
    });
    sur('#fiche', () => s.ouvrirFiche());
    sur('#accueil', () => {
      enMarche = false;
      s.retourAccueil();
    });
    lierVitesse(app);
    lierSac(app, p, (html) => {
      message = html;
      sauver();
      render();
    });

    // Carte : zoom, glisser, lieux
    sur('#zoom-plus', () => {
      zoom = Math.min(ZOOMS.length - 1, zoom + 1);
      render();
    });
    sur('#zoom-moins', () => {
      zoom = Math.max(0, zoom - 1);
      render();
    });
    sur('#zoom-heros', () => {
      centre = position();
      cadrer();
    });
    glisser();
    sur('.poi-monde', (el) => {
      if (enMarche || p.voyage || deplace) return;
      const id = el.dataset.lieu!;
      fenetre = id === p.lieuMonde ? { type: 'lieu' } : { type: 'itineraire', vers: id, allure: 'normale', horsPiste: false };
      render();
    });

    // Fenêtres
    sur('#fermer-lieu', fermer);
    sur('#fermer-lieu-bas', fermer);
    app.querySelector('#popup')?.addEventListener('click', (e) => {
      if (e.target === e.currentTarget && (fenetre?.type === 'lieu' || fenetre?.type === 'itineraire')) fermer();
    });
    app.querySelectorAll<HTMLInputElement>('input[name=allure]').forEach((r) =>
      r.addEventListener('change', () => {
        if (fenetre?.type === 'itineraire') {
          fenetre.allure = r.value as 'normale' | 'forcee';
          render();
        }
      }),
    );
    app.querySelectorAll<HTMLInputElement>('input[name=chemin]').forEach((r) =>
      r.addEventListener('change', () => {
        if (fenetre?.type === 'itineraire') {
          fenetre.horsPiste = r.value === 'direct';
          render();
        }
      }),
    );
    sur('#partir', () => fenetre?.type === 'itineraire' && partir(fenetre.vers, fenetre.allure, fenetre.horsPiste));
    sur('#entrer-ville', (el) => s.entrerVille(el.dataset.ville!));

    const l = lieuMonde(p.lieuMonde);
    const dire = (msg: string) => {
      fenetre = { type: 'lieu', message: msg };
      sauver();
      render();
    };
    sur('#repas', () => {
      p.or -= l.auberge!.repas;
      passerTemps(p, 1);
      const rendu = soigner(p, 1);
      dire(`Un plat chaud et une bière tiède. ${rendu ? 'Tu récupères 1 PV.' : 'Ça fait du bien au moral.'}`);
    });
    sur('#chambre', () => {
      p.or -= l.auberge!.chambre;
      const rendu = dormir(p, l.auberge!.confort);
      noter(p, `dort à « ${l.auberge!.nom} » (${l.nom}) et récupère ${rendu} PV.`);
      dire(`Une nuit sous un vrai toit. Au matin du ${dateLongue(p.jour)}, tu as récupéré <b>${rendu} PV</b>.`);
    });
    sur('#guerisseur', () => {
      const n = Math.min(evMax(p) - p.ev, Math.floor(p.or / l.guerisseur!));
      p.or = arrondirOr(p.or - n * l.guerisseur!);
      soigner(p, n);
      noter(p, `se fait soigner à ${l.nom} (${n} PV).`);
      dire(`Le guérisseur du village applique des herbes et marmonne. Tu récupères <b>${n} PV</b>.`);
    });
    lierQuetes(
      app,
      p,
      {
        message: (html) => {
          epreuveQuete = undefined;
          dire(html);
        },
        combat: (r, apres) =>
          ecranCombat(app, p, r, (bilan) => {
            if (bilan.fin === 'defaite') {
              p.ev = 0;
              fenetre = { type: 'mort' };
              sauver();
              return render();
            }
            dire(bilan.fin === 'victoire' ? `Victoire (+${bilan.xp} XP). ${echapper(apres())}` : 'Tu prends la fuite. Tu pourras revenir finir le travail.');
          }),
        donjon: (id, par) => s.entrerDonjon(id, par),
      },
      (id) => {
        epreuveQuete = id;
        render();
      },
    );
    sur('#rations', () => {
      p.or -= l.rations!;
      p.sac.push('rations');
      dire('Deux repas emballés dans un torchon douteux. Ils sont dans ton sac.');
    });
    sur('#camper', () => {
      fenetre = { type: 'nuit' };
      // Camper avant la nuit : on attend le crépuscule (sans compter les heures).
      if (!nuit()) p.heure = Math.max(p.heure, CREPUSCULE);
      installerBivouac();
    });
    sur('#bivouac', installerBivouac);
    sur('#camping', () => {
      if (fenetre?.type !== 'nuit') return;
      fenetre.camping = 'epreuve';
      render();
    });
    sur('#lancer-camp', (bouton) => {
      if (fenetre?.type !== 'nuit') return;
      const f = fenetre;
      const d = lancer(20);
      (bouton as HTMLButtonElement).disabled = true;
      animerDes([app.querySelector<HTMLElement>('#de-camp')!], 20, [d]).then(() =>
        setTimeout(() => {
          f.camping = `${de(d)} ${echapper(utiliserTalent(p, 'camping', d))}`;
          sauver();
          render();
        }, 350),
      );
    });

    // Combat d'une idée de joueur ratée (lieu, ou événement dont l'échec tourne à la bagarre).
    const combatIdee = (r: Rencontre) =>
      ecranCombat(app, p, r, (bilan) => {
        if (bilan.fin === 'defaite') {
          p.ev = 0;
          fenetre = { type: 'mort' };
        } else
          fenetre = {
            type: 'lieu',
            message: bilan.fin === 'victoire' ? `Victoire (+${bilan.xp} XP${bilan.or ? `, ${bilan.or} PO` : ''}).` : 'Tu prends tes jambes à ton cou.',
          };
        sauver();
        render();
      });
    if (fenetre?.type === 'lieu')
      lierIdeesLieu(
        app,
        p,
        () => {
          sauver();
          if (!verifierMort()) render();
        },
        combatIdee,
      );
    sur('[data-combat-idee]', () => {
      const r = (fenetre?.type === 'evenement' || fenetre?.type === 'rencontre') && fenetre.idee?.resultat?.combat;
      if (r) combatIdee(r);
    });

    sur('[data-combattre]', () => {
      if (fenetre?.type !== 'rencontre') return;
      const f = fenetre;
      ecranCombat(app, p, f.issue?.surprise ? { ...f.r, surprise: true } : f.r, (bilan) => {
        f.bilan = bilan;
        fenetre = bilan.fin === 'defaite' ? { type: 'mort' } : f;
        if (bilan.fin === 'defaite') p.ev = 0;
        sauver();
        render();
      });
    });

    sur('#combat-evenement', () => {
      if (fenetre?.type !== 'evenement' || !fenetre.resultat?.combat) return;
      const f = fenetre;
      const { rencontre, victoire } = f.resultat!.combat!;
      ecranCombat(app, p, rencontre, (bilan) => {
        if (bilan.fin === 'defaite') {
          p.ev = 0;
          fenetre = { type: 'mort' };
        } else {
          const suite =
            bilan.fin === 'victoire'
              ? `Tu l'emportes (+${bilan.xp} XP${bilan.or ? `, ${bilan.or} PO` : ''}${bilan.objets.length ? `, ${bilan.objets.length} objet${bilan.objets.length > 1 ? 's' : ''}` : ''}). ${victoire?.(p) ?? ''}`
              : "Tu t'enfuis sans demander ton reste.";
          f.resultat = { texte: `${f.resultat!.texte} ${suite}` };
        }
        sauver();
        render();
      });
    });

    sur('[data-tactique]', (el) => {
      if (fenetre?.type !== 'rencontre') return;
      fenetre.tactique = el.dataset.tactique as Tactique;
      render();
    });

    // Le joueur lance lui-même son dé : il roule un instant, puis on applique le résultat.
    sur('#lancer', (bouton) => {
      const f = fenetre;
      const faces = f?.type === 'evenement' && f.choix !== undefined ? f.ev.choix[f.choix].jet!.faces : 20;
      const valeur = lancer(faces);
      (bouton as HTMLButtonElement).disabled = true;
      animerDes([app.querySelector<HTMLElement>('#de-joueur')!], faces, [valeur]).then(() =>
        setTimeout(() => {
          if ((f?.type === 'rencontre' || f?.type === 'evenement') && f.idee) jouerIdee(valeur);
          else if (f?.type === 'rencontre') resoudreRencontre(valeur);
          else if (f?.type === 'evenement' && f.choix !== undefined) appliquerChoix(f.choix, avecDe(valeur, faces));
        }, 350),
      );
    });
  };

  /** Applique l'idée validée choisie (avec le dé du joueur s'il y a une épreuve). */
  const jouerIdee = (deLance?: number) => {
    if ((fenetre?.type !== 'rencontre' && fenetre?.type !== 'evenement') || !fenetre.idee) return;
    const j = fenetre.idee;
    j.resultat = resoudreIdee(p, j.idee, deLance);
    noter(p, `${(j.idee.libelle ?? j.idee.texte).toLowerCase().slice(0, 60)} : ${j.resultat.reussi ? 'réussi' : 'raté'}.`);
    sauver();
    if (verifierMort()) return;
    render();
  };

  const resoudreRencontre = (deLance: number) => {
    if (fenetre?.type !== 'rencontre' || !fenetre.tactique) return;
    fenetre.issue = resoudre(p, fenetre.r, fenetre.tactique, undefined, deLance);
    fenetre.animerCoups = fenetre.issue.coups.length > 0;
    const r = fenetre.r;
    noter(
      p,
      `${fenetre.issue.epreuve.reussi ? 'échappe à' : 'se fait malmener par'} ${r.nombre > 1 ? `${r.nombre} ${r.ligne.nom}` : r.ligne.nom}${
        fenetre.issue.perdu ? ` (−${fenetre.issue.perdu} PV)` : ''
      }.`,
    );
    sauver();
    render();
  };

  const appliquerChoix = (i: number, rng?: Rng) => {
    if (fenetre?.type !== 'evenement') return;
    const c = fenetre.ev.choix[i];
    const res = c.effet(p, rng);
    if (res.heures) {
      passerTemps(p, res.heures);
      if (p.voyage) {
        // Le temps perdu ne fait pas avancer : on décale le prochain contrôle d'autant.
        p.voyage.prochainControle += res.heures;
      }
    }
    fenetre.resultat = res;
    noter(p, `${fenetre.ev.titre.toLowerCase()} : ${res.texte.slice(0, 80)}${res.texte.length > 80 ? '…' : ''}`);
    sauver();
    render();
  };

  const lierSuite = () => {
    const sur = (sel: string, fn: (el: HTMLElement) => void) =>
      app.querySelectorAll<HTMLElement>(sel).forEach((el) => el.addEventListener('click', () => fn(el)));
    sur('[data-idee-choix]', (el) => {
      if (fenetre?.type !== 'rencontre' && fenetre?.type !== 'evenement') return;
      const idees = fenetre.type === 'rencontre' ? ideesValidees('rencontre', fenetre.r.ligne.nom) : ideesValidees('evenement', fenetre.ev.id);
      const idee = idees.find((i) => i.id === el.dataset.ideeChoix);
      if (!idee) return;
      fenetre.idee = { idee };
      if (idee.epreuve) render();
      else jouerIdee();
    });
    sur('[data-choix]', (el) => {
      if (fenetre?.type !== 'evenement') return;
      const i = Number(el.dataset.choix);
      if (fenetre.ev.choix[i].jet) {
        fenetre.choix = i;
        render();
      } else appliquerChoix(i);
    });
    sur('#suite', () => {
      if (verifierMort()) return;
      // L'histoire continue (l'écureuil, la bourse…).
      if (fenetre?.type === 'evenement' && fenetre.resultat?.suite) {
        fenetre = { type: 'evenement', ev: fenetre.resultat.suite };
        return render();
      }
      if (fenetre?.type === 'rencontre' && fenetre.nuit) return dormirDehors();
      if (p.voyage) return marcher();
      fenetre = { type: 'lieu' };
      render();
    });

    sur('#revivre', () => {
      p.perso.destin -= 1;
      p.ev = Math.max(1, Math.floor(evMax(p) / 4));
      noter(p, `meurt… puis revient à la vie grâce à un point de destin.`);
      fenetre = p.voyage ? { type: 'reprise' } : { type: 'lieu' };
      sauver();
      render();
    });
    sur('#abandonner', () => s.finDePartie());
  };

  /** Glisser la carte à la souris ou au doigt. */
  let deplace = false;
  const glisser = () => {
    const vp = app.querySelector<HTMLElement>('#carte');
    if (!vp) return;
    let depart: { x: number; y: number; centre: Point } | null = null;
    vp.addEventListener('pointerdown', (e) => {
      if ((e.target as HTMLElement).closest('.zoom')) return;
      depart = { x: e.clientX, y: e.clientY, centre: [...centre] as Point };
      deplace = false;
    });
    vp.addEventListener('pointermove', (e) => {
      if (!depart) return;
      const dx = e.clientX - depart.x;
      const dy = e.clientY - depart.y;
      if (!deplace && Math.hypot(dx, dy) < 6) return;
      if (!deplace) vp.setPointerCapture(e.pointerId);
      deplace = true;
      const z = ZOOMS[zoom];
      centre = [depart.centre[0] - dx / z, depart.centre[1] - dy / z];
      cadrer();
    });
    const fin = () => {
      depart = null;
      // Le clic qui suit un glissé ne doit pas ouvrir de lieu.
      setTimeout(() => (deplace = false), 0);
    };
    vp.addEventListener('pointerup', fin);
    vp.addEventListener('pointercancel', fin);
  };

  if (echapActif) document.removeEventListener('keydown', echapActif);
  echapActif = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && (fenetre?.type === 'lieu' || fenetre?.type === 'itineraire') && app.querySelector('#popup')) fermer();
  };
  document.addEventListener('keydown', echapActif);

  // Debug : l'encyclopédie peut faire surgir n'importe quelle rencontre de la table.
  if (provoquerActif) window.removeEventListener(EVENEMENT_PROVOQUER, provoquerActif);
  provoquerActif = (e: Event) => {
    if (!app.querySelector('#carte') || enMarche) return;
    const [zone, d] = (e as CustomEvent<string>).detail.split(':');
    const ligne = TABLES[zone as Zone].ligne(Number(d));
    vue = 'lieu';
    fenetre = { type: 'rencontre', r: { ligne, d20: Number(d), table: TABLES[zone as Zone].nom, nombre: tirerNombre(ligne.nombre) }, nuit: false };
    render();
  };
  window.addEventListener(EVENEMENT_PROVOQUER, provoquerActif);

  // Les idées validées arrivent après le chargement : on redessine le choix en cours s'il est encore ouvert.
  rafraichirIdees = () => {
    if (enMarche || !app.querySelector('#carte')) return;
    if ((fenetre?.type === 'evenement' && !fenetre.resultat && !fenetre.idee) || (fenetre?.type === 'rencontre' && !fenetre.issue && !fenetre.tactique && !fenetre.idee && !fenetre.bilan))
      render();
  };

  render();
};
