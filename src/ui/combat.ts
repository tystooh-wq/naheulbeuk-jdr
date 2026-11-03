import {
  acteur,
  attaquer,
  attaquerMainGauche,
  adversaires,
  amis,
  auContact,
  bilanCompagnons,
  butin,
  casesAccessibles,
  combattant,
  contacts,
  deplacer,
  ecart,
  creerCombat,
  ennemis,
  heros,
  occupant,
  panique,
  peutSeDefendre,
  degres,
  opportunites,
  planifier,
  tenterFuite,
  tirer,
  tourSuivant,
  valeurDefense,
  verifier,
  xpGagnee,
  type Action,
  type Combat,
  type Combattant,
  type ModeDefense,
  apresTir,
  dansLeDos,
  creerHeros,
  etapeTir,
  prendreArme,
  recharger,
  viser,
  ramasserArme,
} from '../rules/combat';
import { fouiller, tableButin, type Fouille } from '../rules/butin';
import { avecDe, lancer } from '../rules/des';
import { objet } from '../rules/objets';
import { ajouterBlessure, blessuresActives, boirePotion, porte, valeursCombat, equiper, essaiEquiper, lancerExpression, mainGauche, niveau, noter, type Partie } from '../rules/partie';
import { consommerProjectile, valeursTir } from '../rules/tir';
import { bonusInt, ea, eaMax, enCombat, voieDe, lancerSort, nomEcole, refusRelique, resumeEffet, sort, sortAutomatique, sortsConnus, valeurSort, type Sort } from '../rules/magie';
import { appliquerSort, ciblesSort, commencerIncantation, finirIncantation, lancerSortAllie } from '../rules/sorts';
import type { Rencontre } from '../rules/rencontres';
import { aTalent } from '../rules/talents';
import { ajouterButin, compagnon, obeit, ORDRES, reagir, valeurObeissance, volonte, xpGroupe, type Ordre } from '../rules/compagnons';
import { boutonsVitesse, lierVitesse, vitesse } from './commun';
import { PAS as PAS_HEROS } from '../rules/combat';
import { boutonAutrement } from './idees';
import { animerDes, de, echapper } from './outils';

// Le plateau de combat : un terrain en cases (le héros et les siens à gauche, les ennemis à droite),
// les fiches des combattants et l'action en cours. Les dés des ennemis et des compagnons roulent tout
// seuls ; au tour du joueur, le temps s'arrête : il peut avancer (cases en surbrillance), puis choisir
// son action et lancer ses propres dés (attaque, dégâts, parade ou esquive, fuite).

/** Les blessures graves du combat, en rouge : « ✚ Main droite tranchée (pour toujours) ». */
export const listeBlessures = (b: BilanCombat, balise = 'li') =>
  (b.blessures ?? [])
    .map((x) => `<${balise} class="perte">✚ ${echapper(x.nom)} ${x.permanente ? '(pour toujours, sauf chez un mage soigneur)' : '(guérira avec le temps)'}</${balise}>`)
    .join('');

/** Les mêmes, en une phrase rouge à glisser dans un récit. */
export const pertes = (b: BilanCombat) =>
  b.blessures?.length ? ` <span class="perte">Blessure${b.blessures.length > 1 ? 's' : ''} grave${b.blessures.length > 1 ? 's' : ''} : ${echapper(b.blessures.map((x) => x.nom.toLowerCase()).join(', '))}.</span>` : '';

/** Ce que les compagnons ont fait pendant que le héros gisait (combat gagné sans lui). */
export const vengeTexte = (b: BilanCombat) => {
  const gains = [b.or ? `${b.or} PO` : '', ...b.objets.map((o) => objet(o).nom)].filter(Boolean);
  return `Pendant que tu gisais, tes compagnons ont fini le travail${gains.length ? ` et fouillé les corps (${echapper(gains.join(', '))})` : ''}.${pertes(b)}`;
};

export interface BilanCombat {
  /** Reddition : le héros jette son arme devant des créatures pensantes (Donjon de Naheulbeuk : direction les cachots). */
  fin: 'victoire' | 'defaite' | 'fuite' | 'reddition';
  xp: number;
  or: number;
  perdu: number;
  /** Blessures graves reçues par le héros pendant ce combat (membres perdus, os cassés…). */
  blessures?: { nom: string; permanente: boolean }[];
  /** Objets ramassés sur les vaincus (déjà dans le sac). */
  objets: string[];
  fouilles: Fouille[];
  /** Projectiles et arme de jet ramassés (ou perdus). */
  recuperes?: string;
  /** Ce que le groupe en pense (appréciation des compagnons). */
  groupe?: string[];
  /** Le héros est tombé, mais ses compagnons ont gagné : les ennemis sont vaincus et fouillés. */
  venge?: boolean;
}

type Attente =
  | { type: 'action' }
  /** Ambidextrie : la deuxième attaque, avec l'arme de la main gauche. */
  | { type: 'mainGauche' }
  | { type: 'defense'; attaquant: string; de: number }
  | { type: 'fouille'; corps: string[]; reste: { fin: 'victoire' | 'defaite'; xp: number; recuperes: string; notes: string[] } }
  | { type: 'fin'; bilan: BilanCombat }
  | null;

const attendre = (ms: number) => new Promise((r) => setTimeout(r, ms / vitesse()));

/** Règles V2 : « marge 2 → 1 degré de réussite ». */
const texteDegres = (marge: number) => {
  const n = degres(marge);
  const quoi = marge < 0 ? "d'échec" : 'de réussite';
  const signe = `marge ${marge > 0 ? '+' : ''}${String(marge).replace('-', '−')}`;
  if (n === 0) return `${signe} → 0 degré${marge < 0 ? ', raté de peu' : ''}`;
  return `${signe} → ${Math.abs(n)} degré${Math.abs(n) > 1 ? 's' : ''} ${quoi}`;
};

const VERDICT: Record<string, string> = {
  critique: 'critique !',
  reussi: 'réussi',
  rate: 'raté',
  maladresse: 'maladresse !',
};

export const ecranCombat = (app: HTMLElement, p: Partie, r: Rencontre, terminer: (b: BilanCombat) => void) => {
  const c: Combat = creerCombat(p, r);
  const evDepart = p.ev;
  let attente: Attente = null;
  let scene = `<p class="note">Les adversaires se mettent en garde…</p>`;
  let touche: string | undefined;
  let occupe = false;
  /** Berserker : PV temporaires gagnés (repris à la fin du combat). */
  let rage = 0;
  /** Le sort choisi par le joueur, en attente de sa cible. */
  let sortChoisi: string | null = null;
  let lachementFait = false;
  /** Ordres donnés ce combat : compagnon → assaut (un ordre par compagnon et par assaut), et la dernière réponse. */
  const ordresDonnes: Record<string, number> = {};
  let reponseOrdre = '';
  let reactions: string[] = [];
  const berserkerPossible = () => aTalent(p, 'Berserker') && !rage && Math.floor((p.talents?.berserker ?? -99) / 24) !== p.jour;
  const dague = () => !!p.equipe.arme && /dague|poignard|couteau|surin|stylet/i.test(objet(p.equipe.arme).nom);
  /** Frapper lâchement (une fois par combat, avec une lame courte) : seulement sur un ennemi au contact dont on est dans le dos. */
  const lachementPossible = () => aTalent(p, 'Frapper lâchement') && !lachementFait && dague();
  /** Les malus qui pèsent sur un jet (pièces portées, blessures, coups reçus) : affichés en rouge au survol des boutons. */
  const malusDe = (k: 'AT' | 'PRD' | 'AD' | 'COU', extra: [string, number][] = []): [string, number][] => {
    const x = h();
    const v = valeursCombat(p);
    const liste: [string, number][] = [];
    const bricABrac = !!x.talents?.bricABrac;
    for (const o of porte(p)) {
      const m = o.mods?.[k] ?? 0;
      if (m < 0 && !(k === 'PRD' && bricABrac)) liste.push([o.nom, m]);
    }
    for (const b of blessuresActives(p)) if ((b.mods[k] ?? 0) < 0) liste.push([b.nom, b.mods[k]!]);
    let combat = 0;
    for (const b of x.blessures ?? []) if ((b.mods[k] ?? 0) < 0) {
      liste.push([`${b.nom} (ce combat)`, b.mods[k]!]);
      combat += b.mods[k]!;
    }
    if (k === 'AT' && x.famille === 'mains-nues' && !x.bourrePif) {
      liste.push(['Mains nues', -4]);
      combat -= 4;
    }
    const actuel = { AT: x.at, PRD: x.prd, AD: x.ad, COU: x.cou }[k];
    const prevu = { AT: v.at, PRD: v.prd, AD: v.ad, COU: v.cou }[k] + combat;
    if (actuel < prevu) liste.push(['Coups reçus pendant le combat', actuel - prevu]);
    return [...liste, ...extra.filter(([, m]) => m < 0)];
  };
  const survol = (malus: [string, number][]) =>
    malus.length
      ? `<span class="survol-malus" role="tooltip">${malus.map(([n, m]) => `<span>${echapper(n)} : ${String(m).replace('-', '−')}</span>`).join('')}</span>`
      : '';

  const dosOfferts = () => (lachementPossible() ? auContact(c).filter((e) => dansLeDos(h(), e)) : []);

  const h = () => heros(c);
  const synchroniser = () => (p.ev = Math.max(0, h().ev));

  // --- Rendu -----------------------------------------------------------------------

  const carteCombattant = (x: Combattant) => {
    const pct = Math.max(0, Math.round((x.ev / x.evMax) * 100));
    const cible = attente?.type === 'action' && x.camp === 'ennemi' && x.etat === 'actif' && voisinDuHeros(x);
    const statut = [
      x.etat === 'mort' ? 'à terre' : x.etat === 'fui' ? 'en fuite' : '',
      x.rate > 0 && x.etat === 'actif' ? 'déséquilibré' : '',
      x.defendu && x.etat === 'actif' ? 'a déjà paré' : '',
      x.etat === 'actif' && x.tireur && !contacts(c, x).length ? 'à distance, arc bandé' : '',
      x.compagnon ? 'compagnon' : x.allie ? 'allié' : '',
    ].filter(Boolean);
    const tag = cible ? 'button' : 'div';
    return `<${tag} class="combattant cote-${x.camp} ${x.id === 'heros' ? 'le-heros' : ''} etat-${x.etat} ${acteur(c).id === x.id && !c.fin ? 'son-tour' : ''} ${touche === x.id ? 'touche' : ''}" ${
      cible ? `data-cible="${x.id}" title="Attaquer ${echapper(x.nom)}"` : ''
    }>
      <b><i class="pion-mini ${classePion(x)}">${initiales(x)}</i> ${echapper(x.nom)}</b>
      <span class="jauge-ev ${pct <= 30 ? 'basse' : ''}"><span style="width:${pct}%"></span></span>
      <span>❤ ${Math.max(0, x.ev)}/${x.evMax}${x.id === 'heros' && eaMax(p) ? ` · ✦ ${ea(p)}/${eaMax(p)} PA` : x.magie ? ` · ✦ ${x.magie.ea} PA` : ''}${x.effets?.length ? ` <span class="note" title="${echapper(x.effets.map((e) => e.nom).join(', '))}">✧${x.effets.length}</span>` : ''}</span>
      <span class="note">AT ${x.at} · PRD ${x.sansParade ? '—' : x.prd} · PR ${x.pr} · ${echapper(x.degats)}</span>
      ${statut.length ? `<span class="statut">${statut.join(' · ')}</span>` : ''}
    </${tag}>`;
  };

  const potions = () => [...new Set(p.sac.filter((id) => objet(id).type === 'potion' && (!!objet(id).soin || (!!objet(id).mana && eaMax(p) > 0))))];

  /** Donner un ordre à un compagnon : ça ne coûte pas l'action du héros, mais un seul ordre par compagnon et par assaut. */
  const panneauOrdres = () => {
    const comps = amis(c).filter((y) => y.compagnon && y.etat === 'actif' && !y.inconscient);
    if (!comps.length) return '';
    const cibles = ennemis(c).filter((y) => y.etat === 'actif');
    const etatDe = (y: Combattant) => (p.compagnons ?? []).find((k) => k.id === y.compagnon);
    const bouton = (o: Ordre, qui: string, fait: boolean, valeur?: number, titre = '', vise?: Combattant) =>
      `<button class="secondaire petit" data-ordre="${o}" data-qui="${qui}" ${vise ? `data-vise="${vise.id}"` : ''} ${fait ? 'disabled' : ''} ${titre ? `title="${echapper(titre)}"` : ''}>« ${vise ? `Sur ${echapper(vise.nom)} !` : ORDRES[o]} »${valeur !== undefined ? ` <span class="note">≤${valeur}</span>` : ''}</button>`;
    const lignes = comps
      .map((y) => {
        const e = etatDe(y);
        if (!e) return '';
        const fait = ordresDonnes[y.id] === c.assaut;
        const actuel = c.ordres?.[y.id];
        const boutons = (Object.keys(ORDRES) as Ordre[])
          .flatMap((o) => {
            const v = valeurObeissance(p, e, o);
            const titre = volonte(e, o).raisons.join(', ');
            return o === 'cible' ? cibles.map((t) => bouton(o, y.id, fait, v, titre, t)) : [bouton(o, y.id, fait, v, titre)];
          })
          .join('');
        return `<p class="actions-lieu"><b>${echapper(y.nom.split(' ')[0])}</b>${
          actuel ? ` <span class="note">suit l'ordre « ${actuel.ordre === 'cible' ? `Sur ${echapper(combattant(c, actuel.cible!).nom)} !` : ORDRES[actuel.ordre]} »</span>` : ''
        } ${boutons}</p>`;
      })
      .join('');
    // « Tout le monde ! » : un seul cri, mais chacun lance son D20 et décide pour lui.
    const tous =
      comps.length > 1
        ? `<p class="actions-lieu"><b>Tout le monde</b> ${(Object.keys(ORDRES) as Ordre[])
            .flatMap((o) => {
              const fait = comps.every((y) => ordresDonnes[y.id] === c.assaut);
              return o === 'cible' ? cibles.map((t) => bouton(o, 'tous', fait, undefined, '', t)) : [bouton(o, 'tous', fait)];
            })
            .join('')}</p>`
        : '';
    return `<details class="ordres" ${reponseOrdre ? 'open' : ''}><summary>🗣 Donner un ordre au groupe <span class="note">(sans perdre ton action ; ton Charisme + son appréciation + sa volonté, sur son D20)</span></summary>${tous}${lignes}${
      reponseOrdre ? `<p class="recit">${reponseOrdre}</p>` : ''
    }</details>`;
  };

  const armesDuSac = () => [...new Set(p.sac)].filter((id) => objet(id).type === 'arme' && !objet(id).tir && essaiEquiper(p, id, 'arme').refus === null);

  /** Où en est le tir (recharger → viser → tirer), et ce qu'il reste dans le carquois. */
  const panneauTir = (t: NonNullable<ReturnType<typeof valeursTir>>, etape: ReturnType<typeof etapeTir>) => {
    const etapes: [typeof etape, string][] = [
      ['recharger', t.recharge > 3 ? `Recharger (${t.recharge - 2 - c.recharge}/${t.recharge - 2})` : 'Recharger'],
      ['viser', 'Viser'],
      ['tirer', 'Tirer'],
    ];
    const rang = etapes.findIndex(([e]) => e === etape);
    const cycle = `<ol class="cycle-tir">${etapes
      .filter(([e]) => e !== 'recharger' || t.recharge > 2)
      .map(([e, l]) => `<li class="${etapes.findIndex(([x]) => x === e) < rang ? 'fait' : e === etape ? 'actuel' : ''}">${l}</li>`)
      .join('')}</ol>`;
    const munition = t.arme.tir?.munition;
    if (!munition) return cycle;
    const n = p.sac.filter((id) => objet(id).munition === munition).length;
    const fleches = '<i></i>'.repeat(Math.min(n, 30));
    return `${cycle}<p class="carquois" title="${n} ${munition === 'carreau' ? 'carreau' : 'flèche'}${n > 1 ? 's' : ''}"><span>${munition === 'carreau' ? 'Carreaux' : 'Carquois'}</span><span class="fleches">${fleches}</span><b>${n}</b>${n > 30 ? ' ' : ''}</p>`;
  };

  const panneauJoueur = () => {
    if (!attente) return '';
    const x = h();
    if (attente.type === 'action') {
      const fuite = x.talents?.renforts
        ? `<button class="secondaire" data-fuir>🏃 Appel des renforts : fuir sans épreuve</button>`
        : `<button class="secondaire" data-fuir>🎲 Prendre la fuite (AD ${x.ad})${survol(malusDe('AD'))}</button>`;
      const talents = [
        berserkerPossible() ? `<button class="secondaire" data-berserker>😡 Entrer en rage (Berserker, une fois par jour)</button>` : '',
        dosOfferts().length
          ? dosOfferts()
              .map((e) => `<button class="secondaire" data-lachement="${e.id}">🗡 Frapper lâchement ${echapper(e.nom)} dans le dos (dégâts doublés, pas de parade, une fois)${survol(malusDe('AT'))}</button>`)
              .join('')
          : lachementPossible() && (auContact(c).length || !c.deplace)
            ? '<span class="note">Frapper lâchement : passe derrière un ennemi (du côté opposé à sa flèche, diagonales arrière comprises). Il ne se retourne qu\'à son tour : contourne-le avec tes cases de déplacement, puis frappe.</span>'
            : aTalent(p, 'Frapper lâchement') && !lachementFait && !dague()
              ? '<span class="note">Frapper lâchement : il faut une dague, un poignard ou une autre lame courte en main.</span>'
              : '',
      ].join('');
      const cibles = auContact(c);
      const loin = adversaires(c, x);
      const t = valeursTir(p);
      const tirImpossible = !t ? '' : c.tirPerdu ? 'arme de tir perdue' : c.armeLancee ? 'arme déjà lancée' : t.aSec ? 'plus de projectiles' : '';
      const etape = etapeTir(c);
      const tirs =
        t && !cibles.length
          ? `<div class="tir-heros">
              ${panneauTir(t, etape)}
              <p class="actions-lieu">${
                tirImpossible
                  ? ''
                  : etape === 'recharger'
                    ? `<button data-recharger>🏹 Recharger${c.recharge > 1 ? ` (encore ${c.recharge} fois)` : ''}</button>`
                    : etape === 'viser'
                      ? '<button data-viser>🎯 Viser</button>'
                      : loin.map((e) => `<button data-tirer="${e.id}">➶ Tirer sur ${echapper(e.nom)} (AD ${t.ad})${survol(malusDe('AD', t.details.flatMap((d): [string, number][] => {
                          const m = /^[−-](\d+)\s*(.*)$/.exec(d);
                          return m ? [[m[2], -Number(m[1])]] : [];
                        })))}</button>`).join('')
              }</p>
              <p class="note">${echapper(t.arme.nom)} : dégâts ${echapper(t.degats)}${t.details.length ? ` · AD ${echapper(t.details.join(', '))}` : ''}${tirImpossible ? ` · <b>${tirImpossible}</b>` : ''}</p>
            </div>`
          : '';
      const sorts = sortsConnus(p).filter(enCombat);
      // Pas d'attaque ni de malédiction avec un ennemi dans les pattes ; soins, bénédictions et frappes bénies, si.
      const possible = (s: Sort) => !cibles.length || !['degats', 'malus'].includes(s.effet.type);
      const relique = refusRelique(p);
      const choisi = sortChoisi ? sort(sortChoisi) : undefined;
      const libelle = (s: Sort) =>
        `${echapper(s.nom)} <span class="note">(${s.cout} PA, ${sortAutomatique(s, niveau(p)) ? 'sans épreuve' : `${valeurSort(p, s)} ou moins`} · ${echapper(resumeEffet(s, niveau(p), bonusInt(p)))}${s.incantation > 1 ? ` · ${s.incantation} assauts` : ''})</span>`;
      const boutonsSorts = !sorts.length
        ? ''
        : choisi
          ? `<div class="sorts-heros"><p><b>${echapper(choisi.nom)}</b> : sur qui ?</p><p class="actions-lieu">${ciblesSort(c, x, choisi)
              .map((e) => `<button class="sort" data-sort="${choisi.id}" data-cible-sort="${e.id}">✨ ${e.id === x.id ? 'Sur toi' : echapper(e.nom)}${choisi.effet.type === 'degats' && choisi.effet.zone ? ' et ses voisins' : ''}</button>`)
              .join('')}<button class="secondaire" data-annuler-sort>Annuler</button></p></div>`
          : `<details class="sorts-heros"${cibles.length ? '' : ' open'}><summary>✨ Sorts (${ea(p)} / ${eaMax(p)} PA)${relique ? ` · <b>${echapper(relique)}</b>` : ''}</summary><div class="liste-sorts">${sorts
              .map(
                (s) =>
                  `<button class="secondaire sort-ligne" data-choisir-sort="${s.id}" title="${echapper(nomEcole(s))}, niveau ${s.niveau}" ${ea(p) < (s.cout ?? 0) || !possible(s) || relique ? 'disabled' : ''}>${libelle(s)}</button>`,
              )
              .join('')}</div></details>`;
      const g = mainGauche(p);
      const gaucheRefus = g && 'refus' in g ? g.refus : '';
      const bouger = c.deplace ? '' : `Tu peux d'abord avancer de ${PAS_HEROS} cases (cases claires du terrain). `;
      const consigne = cibles.length
        ? `<p><b>À toi !</b> Le temps s'arrête. ${bouger}Choisis ta cible au contact et lance ton D20 : il faut faire <b>${x.at} ou moins</b>.${
            x.mainGauche ? ` Puis, deux armes en main : <b>un deuxième coup de la main gauche</b> (${echapper(x.mainGauche.nom)}, ${x.mainGauche.at} ou moins).` : gaucheRefus ? ` <span class="note">Main gauche : ${echapper(gaucheRefus)}</span>` : ''
          }</p>`
        : `<p><b>À toi !</b> Aucun ennemi au contact. ${bouger}${t ? 'Tu peux tirer, ' : ''}${sorts.length ? 'lancer un sort, ' : ''}${
            t || sorts.length ? 'ou ' : ''
          }avancer vers eux et finir ton tour.</p>`;
      const melee = `<p class="actions-lieu">${cibles.map((e) => `<button data-cible="${e.id}">🎲 Attaquer ${echapper(e.nom)}${survol(malusDe('AT'))}</button>`).join('')}<button class="secondaire" data-attendre>⏳ ${
        c.deplace ? 'Finir le tour' : 'Attendre de pied ferme'
      }</button></p>`;
      // Les mains vides (arme lâchée, ou entré sans arme) : on peut ramasser la sienne ou en sortir une du sac.
      const mainsVides = x.famille === 'mains-nues';
      const autres = mainsVides ? armesDuSac() : [];
      const armeTombee =
        c.armeAuSol || autres.length
          ? `<p class="actions-lieu">${c.armeAuSol ? `<button data-ramasser>🤲 Ramasser ${p.equipe.arme ? echapper(objet(p.equipe.arme).nom) : 'ton arme'}</button>` : ''}${autres
              .map((id) => `<button class="secondaire" data-degainer="${id}">🗡 Sortir ${echapper(objet(id).nom)} du sac</button>`)
              .join('')}</p><p class="note">${c.armeAuSol ? 'Ton arme est par terre. La ramasser ou en sortir une autre prend ton tour.' : 'Tu te bats à mains nues. Sortir une arme du sac prend ton tour.'}</p>`
          : '';
      return `<div class="a-toi">${consigne}${armeTombee}${tirs}${boutonsSorts}${melee}
        ${talents ? `<p class="actions-lieu">${talents}</p>` : ''}
        ${panneauOrdres()}
        <p class="actions-lieu">${potions()
          .map((id) => `<button class="secondaire" data-potion="${id}">Boire : ${echapper(objet(id).nom)}</button>`)
          .join('')}${fuite}${r.reddition ? '<button class="secondaire" data-rendre>🏳 Se rendre</button>' : ''}</p>
        <p>${boutonAutrement({ type: 'combat', id: r.ligne.nom, titre: `Combat contre ${r.nombre > 1 ? `${r.nombre} ${r.ligne.nom}` : r.ligne.nom}` })}</p></div>`;
    }
    if (attente.type === 'mainGauche') {
      const g = x.mainGauche!;
      return `<div class="a-toi"><p><b>Ambidextrie !</b> Ta main gauche tient ${echapper(g.nom)} : une deuxième attaque, plus difficile (AT −5). Il faut <b>${g.at} ou moins</b>. Deux fois plus de chances de toucher… et de te blesser tout seul.</p>
        <p class="actions-lieu">${auContact(c)
          .map((e) => `<button data-main-gauche="${e.id}">🎲 Frapper ${echapper(e.nom)} de la main gauche${survol(malusDe('AT', [['Deuxième arme (Ambidextrie)', -5]]))}</button>`)
          .join('')}<button class="secondaire" data-sans-gauche>Pas de deuxième coup</button></p></div>`;
    }
    if (attente.type === 'defense') {
      const a = combattant(c, attente.attaquant);
      const parade = valeurDefense(x, 'parade', a);
      const esquive = valeurDefense(x, 'esquive', a);
      const pourquoi = a.imparable ? 'ses coups ne se parent pas' : x.sansParade ? 'à mains nues, on ne pare pas' : '';
      const degA = degres(a.at - attente.de);
      return `<div class="a-toi"><p><b>${echapper(a.nom)} t'attaque</b> avec ${degA > 0 ? `${degA} degré${degA > 1 ? 's' : ''} de réussite` : degA < 0 ? `${-degA} degré${degA < -1 ? 's' : ''} d'échec` : '0 degré'}. Défends-toi : il faut faire mieux que lui en degrés, et ne pas rater ta défense. Ta parade ou ton esquive servira contre toutes les attaques de cet assaut.</p>
        <p class="actions-lieu">
          <button data-defense="parade" ${parade === null ? `disabled title="${pourquoi}"` : ''}>🎲 Parer (PRD ${parade ?? '—'})${parade === null ? '' : survol(malusDe('PRD'))}</button>
          <button data-defense="esquive" ${esquive === null ? 'disabled title="Trop d\'armure pour esquiver"' : ''}>🎲 Esquiver (AD ${esquive ?? '—'})${esquive === null ? '' : survol(malusDe('AD', [['Armure (esquive)', esquive - x.ad]]))}</button>
          <button class="secondaire" data-defense="encaisser">🛡 Encaisser</button>
        </p>
        <p class="note">${pourquoi ? `${pourquoi.charAt(0).toUpperCase() + pourquoi.slice(1)}. ` : ''}Esquiver te fait reculer de deux cases (hors de portée : il faudra revenir au contact), sauf esquive critique. Encaisser : tu prends le coup (moins ton armure), mais tu restes au contact pour frapper.</p></div>`;
    }
    if (attente.type === 'fouille') {
      const poubelles = !!h().talents?.poubelles;
      // Ceux qui ont fui sont partis avec leurs affaires : il n'y a que les corps à terre à fouiller.
      const enFuite = ennemis(c).filter((x) => x.etat === 'fui').map((x) => x.nom);
      const fuite = enFuite.length
        ? ` <span class="note">${echapper(enFuite.join(', '))} ${enFuite.length > 1 ? 'ont' : 'a'} pris la fuite avec ${enFuite.length > 1 ? 'leurs' : 'ses'} affaires : rien à fouiller de ce côté.</span>`
        : '';
      const nb = attente.corps.length;
      return `<div class="a-toi bilan" data-lanceur><p>${c.vengeance ? '<b>Tes compagnons ont gagné !</b> Toi, tu gis par terre, mais ils fouillent les corps pour le groupe.' : '<b>Victoire !</b>'} ${nb > 1 ? `${nb} corps sont à terre` : 'Un corps est à terre'}. ${c.vengeance ? 'Pour eux,' : 'Tu fouilles :'} lance ${poubelles ? 'deux D20 par corps (Fouiller dans les poubelles : le meilleur compte)' : 'un D20 par corps'} sur la table de butin. Plus c'est haut, mieux c'est.${fuite}</p>
        <ul class="fouilles">${attente.corps
          .map((id) => `<li>${echapper(combattant(c, id).nom)} ${(poubelles ? ['?', '?'] : ['?']).map(() => de('?', 'fouille a-lancer')).join('')}</li>`)
          .join('')}</ul>
        <p><button id="lancer-fouille">🎲 Fouiller (lancer ${attente.corps.length * (poubelles ? 2 : 1)} D20)</button></p></div>`;
    }
    const b = attente.bilan;
    const titre = b.venge ? 'Tu tombes… mais le groupe gagne' : { victoire: 'Victoire !', defaite: 'Tu tombes…', fuite: 'Tu as pris la fuite', reddition: 'Tu te rends' }[b.fin];
    return `<div class="a-toi bilan"><p><b>${titre}</b></p>
      <ul>${b.xp ? `<li>${b.xp} points d'expérience</li>` : ''}<li>${
        b.perdu > 0 ? `${b.perdu} PV perdus dans la bagarre` : 'Pas une égratignure'
      }</li>${listeBlessures(b)}</ul>
      ${
        b.fouilles.length
          ? `<p><b>${b.venge ? 'Tes compagnons fouillent les corps' : 'Tu fouilles les corps'}</b> <span class="note">(ton D20 sur la table de butin)</span></p><ul class="fouilles">${b.fouilles
              .map(
                (f) =>
                  `<li>${echapper(f.ennemi)} ${f.de ? de(f.de, 'petit') : ''} ${
                    [f.objet ? `<b>${echapper(objet(f.objet).nom)}</b>` : '', f.or ? `${f.or} PO` : ''].filter(Boolean).join(', ') || 'rien'
                  }</li>`,
              )
              .join('')}</ul>${b.or ? `<p>En tout : <b>${b.or} PO</b>${b.objets.length ? ` et ${b.objets.length} objet${b.objets.length > 1 ? 's' : ''} dans ton sac` : ''}.</p>` : ''}`
          : ''
      }
      ${b.recuperes ? `<p class="note">${echapper(b.recuperes.trim())}</p>` : ''}
      ${p.butin && (p.compagnons ?? []).length ? `<p class="note"><b>Le groupe attend sa part :</b> ${p.butin} PO en tout, à partager ce soir au campement ou à l'auberge.</p>` : ''}
      ${b.groupe?.length ? `<p><b>Le groupe</b></p><ul class="reactions">${b.groupe.map((l) => `<li>${echapper(l)}</li>`).join('')}</ul>` : ''}
      <p><button id="fin-combat">Continuer</button></p>
      <p>${boutonAutrement({ type: 'combat', id: `bilan:${r.ligne.nom}`, titre: `${titre} (combat contre ${r.ligne.nom})` })}</p></div>`;
  };

  // --- Le terrain -----------------------------------------------------------------

  const voisinDuHeros = (x: Combattant) => contacts(c, h()).some((y) => y.id === x.id);
  const initiales = (x: Combattant) =>
    x.id === 'heros' ? '★' : x.nom.split(/\s+/).filter((m) => /^[A-ZÀ-Ý]/.test(m)).map((m) => m[0]).join('').slice(0, 2) + (/\d+$/.exec(x.nom)?.[0] ?? '');
  const classePion = (x: Combattant) => (x.id === 'heros' ? 'pion-heros' : x.compagnon ? 'pion-compagnon' : x.allie ? 'pion-allie' : 'pion-ennemi');

  /** La flèche qui montre où regarde le combattant (son dos est de l'autre côté). */
  const orientation = (z: Combattant) => {
    const f = z.face ?? { x: z.camp === 'heros' ? 1 : -1, y: 0 };
    return `<i class="face face-${z.camp}" style="transform:rotate(${Math.round((Math.atan2(f.y, f.x) * 180) / Math.PI)}deg)" aria-hidden="true"></i>`;
  };

  const terrain = () => {
    const tourHeros = attente?.type === 'action' && !c.deplace;
    const accessibles = tourHeros ? casesAccessibles(c, h()) : new Map<string, number>();
    const rangees: string[] = [];
    for (let y = 0; y < c.hauteur; y++) {
      const cases: string[] = [];
      for (let x = 0; x < c.largeur; x++) {
        const z = occupant(c, x, y);
        const morts = c.combattants.filter((m) => m.etat === 'mort' && m.x === x && m.y === y);
        const contenu = z
          ? (() => {
              const pct = Math.max(0, Math.round((z.ev / z.evMax) * 100));
              const attaquable = attente?.type === 'action' && z.camp === 'ennemi' && voisinDuHeros(z);
              const tag = attaquable ? 'button' : 'span';
              return `<${tag} class="pion ${classePion(z)} ${acteur(c).id === z.id && !c.fin ? 'son-tour' : ''} ${touche === z.id ? 'touche' : ''}" ${
                attaquable ? `data-cible="${z.id}"` : ''
              } title="${echapper(`${z.nom} : ${Math.max(0, z.ev)}/${z.evMax} PV`)}">${initiales(z)}<i class="pv-pion" style="width:${pct}%"></i></${tag}>${orientation(z)}`;
            })()
          : morts.length
            ? '<span class="corps" title="À terre">✝</span>'
            : '';
        const k = `${x},${y}`;
        cases.push(
          accessibles.has(k) && !z
            ? `<button class="case accessible" data-case="${k}" aria-label="Aller en ${x + 1}, ${y + 1}">${contenu}</button>`
            : `<div class="case">${contenu}</div>`,
        );
      }
      // Hexagones : les rangées impaires sont décalées d'une demi-case.
      rangees.push(`<div class="rangee ${y & 1 ? 'impaire' : ''}" role="row">${cases.join('')}</div>`);
    }
    return `<div class="terrain hex" style="--largeur:${c.largeur};--hauteur:${c.hauteur}" role="grid" aria-label="Terrain du combat">${rangees.join('')}</div>`;
  };

  const render = () => {
    app.innerHTML = `<div class="page page-combat">
      <div class="entete-combat">
        <h2>Combat <span class="note">Assaut ${c.assaut}</span></h2>
        ${boutonsVitesse()}
      </div>
      <ol class="initiative" aria-label="Ordre d'initiative">${c.ordre
        .map((id) => {
          const x = combattant(c, id);
          return `<li class="cote-${x.camp} etat-${x.etat} ${acteur(c).id === id && !c.fin ? 'son-tour' : ''}">${echapper(x.nom)}</li>`;
        })
        .join('')}</ol>
      ${terrain()}
      <div class="plateau">
        <div class="camp camp-heros">${c.combattants.filter((x) => x.camp === 'heros').map(carteCombattant).join('')}</div>
        <div class="centre-combat"><div id="action" class="action-combat" aria-live="polite">${scene}</div>${panneauJoueur()}</div>
        <div class="camp camp-ennemis">${ennemis(c).map(carteCombattant).join('')}</div>
      </div>
      <details class="journal-combat" open><summary>Déroulé</summary><ul>${c.journal
        .slice(-8)
        .reverse()
        .map((l) => `<li>${echapper(l)}</li>`)
        .join('')}</ul></details>
    </div>`;
    lier();
    touche = undefined;
  };

  // --- Mise en scène d'une action ------------------------------------------------

  const etape = (zone: HTMLElement, html: string) => {
    const el = document.createElement('div');
    el.className = 'etape';
    el.innerHTML = html;
    zone.append(el);
    return el;
  };

  const reveler = async (el: HTMLElement, faces: number, valeurs: number[], dejaLance: boolean) => {
    const des = [...el.querySelectorAll<HTMLElement>('.de.anim')];
    if (!dejaLance && des.length) await animerDes(des, faces, valeurs, 650 / vitesse());
    el.querySelector('.verdict')?.classList.add('visible');
    await attendre(350);
  };

  /** Le joueur clique sur son dé pour le lancer. */
  const clicDe = (zone: HTMLElement, libelle: string, bouton: string) =>
    new Promise<void>((resolve) => {
      const el = etape(zone, `<span data-lanceur>${libelle} : ${de('?', 'a-lancer')}<button id="lancer-degats">🎲 ${echapper(bouton)}</button></span>`);
      el.querySelector('button')!.addEventListener('click', () => {
        el.remove();
        resolve();
      });
    });

  /** Le joueur clique pour lancer ses dés de dégâts. */
  const clicDegats = (zone: HTMLElement, expr: string) => clicDe(zone, `Dégâts (${echapper(expr)})`, `Lancer les dégâts (${expr})`);

  /** Les D20 lancés sur les tables de critiques et de maladresses : le joueur lance les siens. */
  const montrerTables = async (zone: HTMLElement, a: Action) => {
    for (const t of a.tables ?? []) {
      const qui = combattant(c, t.lanceur);
      if (qui.id === 'heros') await clicDe(zone, `<b>${echapper(t.table)}</b>, lance le D20`, `Lancer le D20 (${t.table})`);
      const el = etape(
        zone,
        `${echapper(t.table)}${qui.id === 'heros' ? '' : ` <span class="note">(${echapper(qui.nom)})</span>`} ${de(t.de, 'anim')} : <span class="verdict table-critique"><b>${echapper(t.texte)}</b> <span class="note">(${echapper(t.effet)})</span></span>`,
      );
      await reveler(el, 20, [t.de], false);
    }
  };

  /** Joue une action à l'écran, étape par étape. `lances` : dés déjà vus par le joueur (attaque, défense). */
  const montrer = async (a: Action, lances: { attaque?: boolean; defense?: boolean } = {}, expr?: string) => {
    const zone = app.querySelector<HTMLElement>('#action')!;
    const att = combattant(c, a.attaquant);
    const cib = combattant(c, a.cible);
    zone.innerHTML = `<p class="qui"><b>${echapper(att.nom)}</b> ${a.tir ? 'tire sur' : 'attaque'} <b>${echapper(cib.nom)}</b></p>`;
    // Règles V2 : au contact, l'attaque se lit en degrés (le tir et les sorts restent des épreuves simples).
    const opp = a.opposition;
    const verdictAttaque = opp ? `<span class="verdict ${a.de <= a.valeur ? 'reussi' : 'rate'}">${texteDegres(a.valeur - a.de)}</span>` : `<span class="verdict ${a.issue}">${VERDICT[a.issue]}</span>`;
    let el = etape(zone, `${a.tir ? 'Tir (AD)' : 'Attaque'} ${de(a.de, 'anim')} contre ${a.valeur} : ${verdictAttaque}`);
    await reveler(el, 20, [a.de], !!lances.attaque);
    if (a.defense) {
      const d = a.defense;
      const nom = d.mode === 'parade' ? 'Parade' : 'Esquive';
      const verdict =
        d.issue === 'critique' || d.issue === 'maladresse' || d.marge === undefined
          ? `<span class="verdict ${d.reprise ? 'visible ' : ''}${d.issue}">${d.issue === 'reussi' ? (d.mode === 'parade' ? 'paré' : 'esquivé') : VERDICT[d.issue]}</span>`
          : `<span class="verdict ${d.reprise ? 'visible ' : ''}${d.marge >= 0 ? 'reussi' : 'rate'}">${texteDegres(d.marge)}</span>`;
      el = etape(zone, `${nom}${d.reprise ? ' <span class="note">(celle de cet assaut, déjà lancée)</span>' : ''} ${de(d.de, d.reprise ? '' : 'anim')} contre ${d.valeur} : ${verdict}`);
      if (!d.reprise) await reveler(el, 20, [d.de], !!lances.defense);
    } else if (a.sansDefense) {
      etape(zone, `<span class="note">Pas de défense : ${echapper(a.sansDefense)}.</span>`);
    }
    if (opp) {
      const fmt = (n: number) => (n > 0 ? `+${n}` : String(n).replace('-', '−'));
      const issue = opp.passe
        ? `<span class="verdict visible reussi">touché${opp.bonus ? `, ${fmt(opp.bonus)} aux dégâts` : ''}</span>${opp.defenseRatee && opp.degresAttaque <= opp.degresDefense ? ' <span class="note">(la défense a raté)</span>' : ''}`
        : `<span class="verdict visible rate">${a.defense?.mode === 'esquive' ? 'esquivé' : a.defense ? 'paré' : 'raté'}</span>${opp.degresAttaque === opp.degresDefense ? ' <span class="note">(égalité : la défense gagne)</span>' : ''}`;
      etape(zone, `Opposition : ${fmt(opp.degresAttaque)} contre ${fmt(opp.degresDefense)} → ${issue}`);
    }
    await montrerTables(zone, a);
    // Les suites des critiques et maladresses avant les dégâts du coup lui-même : c'est dans cet ordre que ça se passe.
    for (const e of a.effets) etape(zone, `<span class="effet">${echapper(e)}</span>`);
    if (a.degats) {
      const g = a.degats;
      if (att.id === 'heros') await clicDegats(zone, expr ?? att.degats);
      el = etape(
        zone,
        `Dégâts sur ${echapper(cib.nom)} ${g.des.map((x) => de(x, 'anim')).join('')}${g.bonus ? ` + ${g.bonus} (critique)` : ''}${g.ecart ? ` ${g.ecart > 0 ? '+' : '−'} ${Math.abs(g.ecart)} (degrés)` : ''} = ${g.total}${g.pr ? `, moins ${g.pr} d'armure` : a.issue === 'critique' ? ', armure ignorée' : ''} : <span class="verdict rate">−${g.blessure - (g.poison?.[0] ?? 0)} PV</span>`,
      );
      await reveler(el, 6, g.des, false);
      if (g.poison) {
        el = etape(zone, `Poison ${de(g.poison[0], 'anim')} : <span class="verdict rate">−${g.poison[0]} PV</span>`);
        await reveler(el, 6, g.poison, false);
      }
      touche = cib.id;
    }
    c.journal.push(resumer(a));
    scene = zone.innerHTML;
  };

  const resumer = (a: Action) => {
    const att = combattant(c, a.attaquant).nom;
    const cib = combattant(c, a.cible).nom;
    if (a.issue === 'maladresse') return `${att} : maladresse ! ${a.effets.join(' ')}`;
    if (!a.degats && a.defense) return `${cib} ${a.defense.mode === 'esquive' ? 'esquive' : 'pare'} le coup de ${att}.`;
    if (!a.degats) return `${att} rate ${cib}.`;
    if (!a.degats.blessure) return `${att} touche ${cib}, mais l'armure encaisse tout.`;
    return `${att} touche ${cib}${a.issue === 'critique' ? ' (critique)' : ''} : −${a.degats.blessure} PV.`;
  };

  const message = (texte: string) => {
    scene = `<p>${echapper(texte)}</p>`;
    c.journal.push(texte);
  };

  // --- Déroulement ------------------------------------------------------------------

  const finir = () => {
    synchroniser();
    let notes: string[] = [];
    if (c.vengeance) notes.push('Tes compagnons ont gagné le combat, mais trop tard pour toi. Ils fouillent les corps pendant que tu gis.');
    reactions.push(...bilanCompagnons(c, p));
    // Ce que les compagnons pensent du combat : les coups reçus du héros, puis l'issue.
    for (const f of c.frappesAllies ?? []) reactions.push(...reagir(p, { type: 'frappe', id: f.id, grave: f.grave }));
    // Berserker : les PV de rage s'en vont avec la fin du combat.
    if (rage) {
      p.ev = Math.max(0, p.ev - rage);
      notes.push(`La rage retombe : les ${rage} PV temporaires disparaissent.`);
      if (p.ev <= 0) c.fin = 'defaite';
    }
    // Chance du rempailleur : on ne meurt pas en combat, on est laissé pour mort.
    if (c.fin === 'defaite' && aTalent(p, 'Chance du rempailleur')) {
      c.fin = 'fuite';
      p.ev = 1;
      notes.push('Chance du rempailleur : laissé pour mort, tu te relèves quand tout le monde est parti, avec 1 PV.');
      noter(p, 'est laissé pour mort, mais la chance du rempailleur le relève.');
    }
    // Les suites des critiques : blessures graves, saignement, armes perdues ou cassées.
    const hh = h();
    for (const b of hh.blessures ?? []) ajouterBlessure(p, b);
    if (hh.hemorragie !== undefined && p.ev > 0) {
      const d = lancer(6);
      p.ev = Math.max(0, p.ev - d);
      notes.push(`Tu saignes le temps de bander la plaie : −${d} PV.`);
      if (p.ev <= 0 && c.fin !== 'defaite') c.fin = 'defaite';
    }
    for (const k of c.armesCassees ?? []) {
      if (!p.equipe[k]) continue;
      notes.push(`${objet(p.equipe[k]!).nom} : cassé, il n'en reste rien d'utile.`);
      p.equipe[k] = undefined;
    }
    if (hh.famille === 'mains-nues' && p.equipe.arme && !c.armesCassees?.includes('arme') && c.fin !== 'defaite') notes.push('Tu ramasses ton arme.');
    for (const x of c.combattants.filter((y) => y.compagnon && y.blessures?.length))
      notes.push(`${x.nom} est gravement blessé (${x.blessures!.map((b) => b.nom.toLowerCase()).join(', ')}) : ça ne partira pas avec la fin du combat.`);
    const fin = c.fin!;
    const xp = fin === 'defaite' || fin === 'reddition' ? 0 : xpGagnee(c);
    // Le héros tombé mais vengé : ses compagnons n'ont pas perdu, ils n'ont rien à lui reprocher.
    if (!c.vengeance)
      reactions.push(
        ...reagir(
          p,
          fin === 'victoire'
            ? { type: 'victoire', betes: ennemis(c).some((y) => y.famille === 'bete'), difficile: ennemis(c).length >= 3 || evDepart - p.ev >= h().evMax / 2 }
            : { type: fin === 'reddition' ? 'defaite' : fin },
        ),
      );
    // Après une victoire, on ramasse son arme de jet et la moitié des projectiles (les autres sont cassés ou perdus).
    let recuperes = '';
    if (fin === 'victoire') {
      const garde = c.projectiles.slice(0, Math.floor(c.projectiles.length / 2));
      p.sac.push(...garde);
      if (c.projectiles.length) recuperes = `Tu récupères ${garde.length} projectile${garde.length > 1 ? 's' : ''} sur ${c.projectiles.length}.`;
      if (c.armeLancee) recuperes += ' Tu ramasses ton arme de jet.';
    } else if (c.armeLancee && p.equipe.distance) {
      recuperes = `${objet(p.equipe.distance).nom} est restée sur le champ de bataille.`;
      p.equipe.distance = undefined;
    }
    // Victoire : c'est le joueur qui lance le D20 de fouille de chaque corps (table de butin de sa famille).
    // Héros vengé : ce sont les compagnons qui fouillent, mais le joueur lance toujours les dés.
    const corps = fin === 'victoire' || c.vengeance ? ennemis(c).filter((x) => x.etat === 'mort' && tableButin(x.nom)).map((x) => x.id) : [];
    if (corps.length) {
      attente = { type: 'fouille', corps, reste: { fin: fin === 'victoire' ? 'victoire' : 'defaite', xp, recuperes, notes } };
      return render();
    }
    conclure(fin, xp, recuperes, notes, []);
  };

  /** Le joueur lance ses D20 de fouille (deux par corps avec Fouiller dans les poubelles, le meilleur compte). */
  const fouillerCorps = async () => {
    if (attente?.type !== 'fouille') return;
    const { corps, reste } = attente;
    const poubelles = !!h().talents?.poubelles;
    const des = corps.map(() => (poubelles ? [lancer(20), lancer(20)] : [lancer(20)]));
    const zone = app.querySelector<HTMLElement>('.a-toi')!;
    zone.querySelector('button')?.remove();
    await animerDes([...zone.querySelectorAll<HTMLElement>('.de.fouille')], 20, des.flat(), 650 / vitesse());
    await attendre(600);
    const fouilles = corps.map((id, k) => {
      const nom = combattant(c, id).nom;
      const meilleur = Math.max(...des[k]);
      return { ...fouiller(nom, avecDe(meilleur, 20)), ennemi: nom, poubelles: poubelles || undefined };
    });
    // Les vaincus sans table de butin n'ont rien d'intéressant sur eux.
    if (poubelles) reste.notes.push('Fouiller dans les poubelles : deux D20 par corps, le meilleur compte.');
    conclure(reste.fin, reste.xp, reste.recuperes, reste.notes, fouilles);
  };

  const conclure = (fin: BilanCombat['fin'], xp: number, recup: string, notes: string[], fouilles: Fouille[]) => {
    const or = fouilles.reduce((s, f) => s + f.or, 0);
    const objets = fouilles.flatMap((f) => (f.objet ? [f.objet] : []));
    p.sac.push(...objets);
    const recuperes = [recup, ...notes].filter(Boolean).join(' ');
    const blessures = (h().blessures ?? []).map((b) => ({ nom: b.nom, permanente: b.jours === undefined }));
    const bilan: BilanCombat = { fin, xp, or, perdu: evDepart - p.ev, blessures, objets, fouilles, recuperes, groupe: reactions, venge: c.vengeance || undefined };
    p.xp = (p.xp ?? 0) + xp;
    // Les compagnons qui ont combattu gagnent la même expérience (et montent de niveau tout seuls).
    reactions.push(...xpGroupe(p, xp, c.combattants.flatMap((x) => (x.compagnon ? [x.compagnon] : []))));
    p.or += or;
    ajouterButin(p, or);
    const qui = r.nombre > 1 ? `${r.nombre} ${r.ligne.nom}` : r.ligne.nom;
    noter(
      p,
      fin === 'victoire'
        ? `vainc ${qui} en ${c.assaut} assaut${c.assaut > 1 ? 's' : ''} (+${xp} XP${or ? `, +${or} PO` : ''}${objets.length ? `, ${objets.map((o) => objet(o).nom).join(', ')}` : ''}).`
        : fin === 'fuite'
          ? `s'enfuit en plein combat contre ${qui}.`
          : fin === 'reddition'
          ? `se rend à ${qui}.`
          : c.vengeance
            ? `tombe face à ${qui}, mais ses compagnons gagnent le combat${or ? ` (+${or} PO)` : ''}.`
            : `tombe sous les coups de ${qui}.`,
    );
    attente = { type: 'fin', bilan };
    // Le combat est fini : les boutons du bilan (partage du butin…) doivent répondre.
    occupe = false;
    render();
  };

  /** Fait jouer les combattants jusqu'au prochain choix du joueur. */
  const avancer = async () => {
    occupe = true;
    while (!c.fin) {
      const x = acteur(c);
      if (x.etat !== 'actif') {
        tourSuivant(c);
        continue;
      }
      if (x.incante) {
        x.incante -= 1;
        if (x.incante > 0 || !x.enCours) {
          message(`${x.nom} poursuit son incantation (encore ${x.incante} tour${x.incante > 1 ? 's' : ''}).`);
        } else {
          // Fin de l'incantation : le sort part maintenant.
          const pa = x.id === 'heros' ? ea(p) : (x.magie?.ea ?? 0);
          const r = finirIncantation(c, x, pa);
          if (r.paSoin) {
            if (x.id === 'heros') p.ea = Math.max(0, ea(p) - r.paSoin);
            else if (x.magie) x.magie.ea = Math.max(0, x.magie.ea - r.paSoin);
          }
          for (const l of r.lignes) c.journal.push(l);
          for (const a of r.actions) if (a.degats?.blessure) touche = a.cible;
          if (x.id === 'heros') p.ev = x.ev;
          message(`✧ ${x.nom} achève l'incantation : ${r.nom}. ${r.lignes.join(' ')}`);
        }
        render();
        await attendre(x.enCours ? 700 : 1300);
        apres();
        continue;
      }
      if (x.rate > 0) {
        x.rate -= 1;
        message(`${x.nom} reprend ses esprits et n'attaque pas cet assaut.`);
        render();
        await attendre(900);
        tourSuivant(c);
        continue;
      }
      if (x.id === 'heros') {
        attente = { type: 'action' };
        occupe = false;
        render();
        return;
      }
      if (panique(c, x)) {
        scene = `<p>${echapper(c.journal[c.journal.length - 1])}</p>`;
        render();
        await attendre(1000);
        tourSuivant(c);
        continue;
      }
      // Ennemis, compagnons et alliés jouent seuls : ils avancent, puis frappent ou tirent.
      const plan = planifier(c, x);
      if (plan.recharge) {
        message(`${x.nom} recharge son arme.`);
        render();
        await attendre(600);
        tourSuivant(c);
        continue;
      }
      if (plan.vers) {
        deplacer(c, x.id, plan.vers.x, plan.vers.y);
        render();
        await attendre(450);
      }
      const cible = plan.cible ? combattant(c, plan.cible) : undefined;
      if (!cible || (!plan.tir && plan.sort === undefined && !contacts(c, x).some((y) => y.id === cible.id))) {
        if (!plan.vers) message(`${x.nom} attend son heure.`);
        tourSuivant(c);
        continue;
      }
      // Un compagnon lance son sort (il lance ses dés lui-même, comme les autres alliés).
      if (plan.sort !== undefined && x.magie) {
        render();
        await attendre(500);
        const r = lancerSortAllie(c, x, plan.sort, cible.id, lancer(20));
        message(`✧ ${r.texte} (${x.magie.ea} PA restants)`);
        render();
        await attendre(1300);
        // Une frappe bénie : il frappe dans la foulée.
        if (!(r.garde && plan.frappe && x.etat === 'actif' && cible.etat === 'actif' && contacts(c, x).some((y) => y.id === cible.id))) {
          apres();
          continue;
        }
      }
      if (plan.tir) {
        render();
        await attendre(500);
        const a = tirer(c, x.id, cible.id, lancer(20), x.tireur!);
        await montrer(a);
        apres();
        continue;
      }
      render();
      await attendre(500);
      const d = lancer(20);
      if (cible.id !== 'heros') {
        await montrer(attaquer(c, x.id, cible.id, d));
        apres();
        continue;
      }
      // Un ennemi attaque le héros : s'il touche, le joueur choisit sa défense.
      if (peutSeDefendre(h(), d, x.at) && (valeurDefense(h(), 'parade', x) !== null || valeurDefense(h(), 'esquive', x) !== null)) {
        const zone = app.querySelector<HTMLElement>('#action')!;
        zone.innerHTML = `<p class="qui"><b>${echapper(x.nom)}</b> attaque <b>${echapper(h().nom)}</b></p>`;
        const el = etape(zone, `Attaque ${de(d, 'anim')} contre ${x.at} : <span class="verdict ${d <= x.at ? 'reussi' : 'rate'}">${texteDegres(x.at - d)}</span>`);
        await reveler(el, 20, [d], false);
        scene = zone.innerHTML;
        attente = { type: 'defense', attaquant: x.id, de: d };
        occupe = false;
        render();
        return;
      }
      const a = attaquer(c, x.id, 'heros', d);
      await montrer(a);
      apres();
    }
    finir();
  };

  const apres = () => {
    verifier(c);
    synchroniser();
    if (!c.fin) tourSuivant(c);
    render();
  };

  /** Anime le dé du joueur dans le panneau d'action, puis rend sa valeur. */
  const lancerJoueur = async (texte: string, valeur: number) => {
    const zone = app.querySelector<HTMLElement>('#action')!;
    app.querySelector('.a-toi')?.remove();
    zone.innerHTML = `<p class="qui">${texte}</p>`;
    const el = etape(zone, `${de('?', 'anim')}`);
    await animerDes([el.querySelector<HTMLElement>('.de')!], 20, [valeur], 650 / vitesse());
    return zone;
  };

  const lier = () => {
    lierVitesse(app);
    const sur = (sel: string, fn: (el: HTMLElement) => void) =>
      app.querySelectorAll<HTMLElement>(sel).forEach((el) =>
        el.addEventListener('click', () => {
          if (occupe) return;
          occupe = true;
          fn(el);
        }),
      );

    sur('[data-cible]', async (el) => {
      if (attente?.type !== 'action') return (occupe = false);
      attente = null;
      const cible = el.dataset.cible!;
      const d = lancer(20);
      await lancerJoueur(`Tu attaques <b>${echapper(combattant(c, cible).nom)}</b>…`, d);
      const a = attaquer(c, 'heros', cible, d);
      await montrer(a, { attaque: true });
      // Ambidextrie : une deuxième attaque dans le même assaut, avec l'autre main, s'il reste quelqu'un au contact.
      verifier(c);
      synchroniser();
      if (!c.fin && h().mainGauche && h().etat === 'actif' && !h().rate && auContact(c).length) {
        attente = { type: 'mainGauche' };
        occupe = false;
        return render();
      }
      apres();
      if (!c.fin) await attendre(600);
      avancer();
    });

    sur('[data-main-gauche]', async (el) => {
      if (attente?.type !== 'mainGauche') return (occupe = false);
      attente = null;
      const cible = el.dataset.mainGauche!;
      const d = lancer(20);
      await lancerJoueur(`De l'autre main, tu attaques <b>${echapper(combattant(c, cible).nom)}</b>… il faut ${h().mainGauche!.at} ou moins.`, d);
      const a = attaquerMainGauche(c, 'heros', cible, d);
      await montrer(a, { attaque: true }, h().mainGauche?.degats);
      apres();
      if (!c.fin) await attendre(600);
      avancer();
    });

    sur('[data-sans-gauche]', async () => {
      if (attente?.type !== 'mainGauche') return (occupe = false);
      attente = null;
      apres();
      avancer();
    });

    sur('[data-defense]', async (el) => {
      if (attente?.type !== 'defense') return (occupe = false);
      const { attaquant, de: deAt } = attente;
      attente = null;
      if (el.dataset.defense === 'encaisser') {
        const a = attaquer(c, attaquant, 'heros', deAt, { encaisser: true });
        await montrer(a, { attaque: true });
        apres();
        if (!c.fin) await attendre(600);
        return avancer();
      }
      const mode = el.dataset.defense as ModeDefense;
      const d = lancer(20);
      // On lance d'abord le dé de défense, puis on rejoue l'action complète.
      await lancerJoueur(`Tu tentes ${mode === 'parade' ? 'de parer' : "d'esquiver"}…`, d);
      await attendre(300);
      const a = attaquer(c, attaquant, 'heros', deAt, { defense: { mode, de: d } });
      await montrer(a, { attaque: true, defense: true });
      apres();
      if (!c.fin) await attendre(600);
      avancer();
    });

    sur('[data-tirer]', async (el) => {
      if (attente?.type !== 'action') return (occupe = false);
      const t = valeursTir(p);
      if (!t) return (occupe = false);
      attente = null;
      const cible = el.dataset.tirer!;
      const d = lancer(20);
      await lancerJoueur(`Tu vises <b>${echapper(combattant(c, cible).nom)}</b>… il faut ${t.ad} ou moins.`, d);
      if (t.projectile) {
        consommerProjectile(p, t.projectile.id);
        c.projectiles.push(t.projectile.id);
      }
      if (t.arme.tir?.lancee) c.armeLancee = true;
      apresTir(c, t.recharge);
      const a = tirer(c, 'heros', cible, d, { ad: t.ad, degats: t.degats, rupture: t.arme.rupture });
      await montrer(a, { attaque: true }, t.degats);
      apres();
      if (!c.fin) await attendre(600);
      avancer();
    });

    sur('[data-recharger]', async () => {
      if (attente?.type !== 'action' || etapeTir(c) !== 'recharger') return (occupe = false);
      attente = null;
      recharger(c);
      const t = valeursTir(p);
      message(`${h().nom} ${t?.arme.tir?.munition === 'carreau' ? 'tend la corde et place un carreau' : 'encoche une flèche'}${c.recharge ? ` (encore ${c.recharge} fois)` : ''}.`);
      apres();
      if (!c.fin) await attendre(500);
      avancer();
    });

    sur('[data-viser]', async () => {
      if (attente?.type !== 'action' || etapeTir(c) !== 'viser') return (occupe = false);
      attente = null;
      viser(c);
      message(`${h().nom} bande son arme et vise.`);
      apres();
      if (!c.fin) await attendre(500);
      avancer();
    });

    sur('[data-choisir-sort]', (el) => {
      if (attente?.type !== 'action') return (occupe = false);
      sortChoisi = el.dataset.choisirSort!;
      occupe = false;
      render();
    });

    sur('[data-annuler-sort]', () => {
      sortChoisi = null;
      occupe = false;
      render();
    });

    sur('[data-sort]', async (el) => {
      if (attente?.type !== 'action') return (occupe = false);
      const s: Sort = sort(el.dataset.sort!);
      sortChoisi = null;
      attente = null;
      const d = lancer(20);
      const auto = sortAutomatique(s, niveau(p));
      const zone = await lancerJoueur(
        `Tu ${voieDe(p.perso) === 'mage' ? 'incantes' : 'pries pour'} <b>${echapper(s.nom)}</b>… ${auto ? "à ton niveau, il part tout seul (sauf sur un 1 : critique)" : `il faut ${valeurSort(p, s)} ou moins`}.`,
        d,
      );
      p.ev = h().ev;
      const res = lancerSort(p, s, d);
      h().ev = p.ev;
      if (typeof res === 'string') {
        etape(zone, echapper(res));
        scene = zone.innerHTML;
        attente = { type: 'action' };
        occupe = false;
        return render();
      }
      etape(zone, `<span class="verdict visible ${res.issue}">${echapper(res.texte)}</span>`);
      c.journal.push(`${h().nom} lance ${s.nom} : ${res.texte}`);
      let garde = false;
      let attend = false;
      if ((res.issue === 'critique' || res.issue === 'reussi') && commencerIncantation(h(), s, el.dataset.cibleSort!, res.issue, niveau(p), bonusInt(p))) {
        attend = true;
        c.journal.push(`${h().nom} commence l'incantation de ${s.nom}.`);
      } else if (res.issue === 'critique' || res.issue === 'reussi') {
        const r = appliquerSort(c, { x: h(), niveau: niveau(p), bonusInt: bonusInt(p), paDispo: ea(p) }, s, el.dataset.cibleSort!, res.issue);
        if (r.paSoin) p.ea = Math.max(0, ea(p) - r.paSoin);
        for (const l of r.lignes) {
          etape(zone, echapper(l));
          c.journal.push(l);
          await attendre(350);
        }
        for (const a of r.actions) if (a.degats?.blessure) touche = a.cible;
        garde = !!r.garde;
      }
      p.ev = h().ev;
      etape(zone, `<span class="note">${ea(p)} PA restants${garde ? ' · le sort ne coûte pas ton action : à toi de frapper.' : attend ? ` · l'incantation commence : le sort partira dans ${s.incantation - 1} tour${s.incantation > 2 ? 's' : ''}.` : ''}</span>`);
      scene = zone.innerHTML;
      apres();
      if (garde && !c.fin) {
        attente = { type: 'action' };
        occupe = false;
        return render();
      }
      if (!c.fin) await attendre(600);
      avancer();
    });

    sur('[data-berserker]', async () => {
      if (attente?.type !== 'action' || !berserkerPossible()) return (occupe = false);
      attente = null;
      const j = lancerExpression('3D', undefined);
      rage = j.total + niveau(p);
      p.talents = { ...(p.talents ?? {}), berserker: p.jour * 24 + p.heure };
      h().ev += rage;
      h().evMax += rage;
      const zone = await lancerJoueur(`${echapper(h().nom)} entre dans une rage folle !`, j.des[0]);
      etape(zone, `3D6 : ${j.des.map((d) => de(d)).join('')} + niveau ${niveau(p)} = <b>+${rage} PV temporaires</b> jusqu'à la fin du combat.`);
      c.journal.push(`${h().nom} entre en rage : +${rage} PV temporaires.`);
      scene = zone.innerHTML;
      synchroniser();
      // La rage ne coûte pas l'assaut : on peut encore frapper.
      attente = { type: 'action' };
      occupe = false;
      render();
    });

    sur('[data-lachement]', async (el) => {
      if (attente?.type !== 'action' || !dosOfferts().some((e) => e.id === el.dataset.lachement)) return (occupe = false);
      attente = null;
      lachementFait = true;
      h().lachement = true;
      const cible = el.dataset.lachement!;
      const d = lancer(20);
      await lancerJoueur(`Tu te glisses dans le dos de <b>${echapper(combattant(c, cible).nom)}</b>…`, d);
      const a = attaquer(c, 'heros', cible, d);
      h().lachement = false;
      await montrer(a, { attaque: true });
      apres();
      if (!c.fin) await attendre(600);
      avancer();
    });

    sur('[data-case]', async (el) => {
      if (attente?.type !== 'action' || c.deplace) return (occupe = false);
      const [x, y] = el.dataset.case!.split(',').map(Number);
      const profiteurs = opportunites(c, 'heros', x, y);
      if (!deplacer(c, 'heros', x, y)) return (occupe = false);
      // Quitter le contact d'un ennemi : il en profite pour frapper (une fois par assaut).
      if (profiteurs.length) {
        render();
        for (const e of profiteurs) {
          if (c.fin || h().etat !== 'actif') break;
          e.opportunite = c.assaut;
          await attendre(400);
          const a = attaquer(c, e.id, 'heros', lancer(20));
          a.effets.unshift(`Attaque d'opportunité : tu as quitté le contact de ${e.nom}.`);
          await montrer(a);
          verifier(c);
          synchroniser();
        }
        if (c.fin || h().etat !== 'actif') {
          if (!c.fin) {
            attente = null;
            apres();
            return avancer();
          }
          return finir();
        }
      }
      occupe = false;
      render();
    });

    sur('[data-attendre]', async () => {
      if (attente?.type !== 'action') return (occupe = false);
      attente = null;
      message(c.deplace ? `${h().nom} prend position.` : `${h().nom} attend de pied ferme.`);
      apres();
      await attendre(500);
      avancer();
    });

    sur('[data-ramasser]', async () => {
      if (attente?.type !== 'action' || !c.armeAuSol) return (occupe = false);
      attente = null;
      ramasserArme(c);
      message(`${h().nom} se baisse et ramasse son arme. L'assaut est perdu pour attaquer.`);
      apres();
      await attendre(900);
      avancer();
    });

    sur('[data-degainer]', async (el) => {
      if (attente?.type !== 'action' || h().famille !== 'mains-nues') return (occupe = false);
      const id = el.dataset.degainer!;
      const tombee = !!c.armeAuSol;
      const atAvant = creerHeros(p).at;
      const refus = equiper(p, id, 'arme');
      if (refus) return (occupe = false);
      attente = null;
      prendreArme(c, p, atAvant);
      message(`${h().nom} sort ${objet(id).nom} de son sac. L'assaut est perdu pour attaquer${tombee ? " ; l'autre arme sera ramassée après le combat" : ''}.`);
      apres();
      await attendre(900);
      avancer();
    });

    sur('[data-potion]', async (el) => {
      if (attente?.type !== 'action') return (occupe = false);
      attente = null;
      const id = el.dataset.potion!;
      p.ev = h().ev;
      const res = boirePotion(p, id);
      if (typeof res !== 'string') {
        h().ev = p.ev;
        message(`${h().nom} boit ${objet(id).nom} en vitesse : +${res.rendu} ${res.pa ? 'PA' : 'PV'}. L'assaut est perdu pour attaquer.`);
      }
      apres();
      await attendre(900);
      avancer();
    });

    sur('[data-fuir]', async () => {
      if (attente?.type !== 'action') return (occupe = false);
      attente = null;
      const d = lancer(20);
      const renforts = !!h().talents?.renforts;
      const zone = await lancerJoueur(renforts ? 'Tu cries « Je vais chercher des renforts ! »…' : `Tu tentes de prendre la fuite : il faut ${h().ad} ou moins.`, d);
      const ok = tenterFuite(c, d);
      etape(zone, renforts ? 'Appel des renforts : tu files en arrière avant que quiconque ne réagisse.' : ok ? 'Tu détales sans demander ton reste !' : 'Raté : on te barre la route, et tu as perdu ton assaut.');
      c.journal.push(ok ? `${h().nom} s'enfuit.` : `${h().nom} tente de fuir, sans succès.`);
      scene = zone.innerHTML;
      await attendre(1000);
      if (ok) return finir();
      apres();
      avancer();
    });

    sur('[data-rendre]', async () => {
      if (attente?.type !== 'action') return (occupe = false);
      attente = null;
      c.fin = 'reddition';
      c.journal.push(`${h().nom} jette son arme et lève les mains.`);
      finir();
    });

    app.querySelector('#lancer-fouille')?.addEventListener('click', () => void fouillerCorps());
    sur('[data-ordre]', (el) => {
      occupe = false;
      const ordre = el.dataset.ordre as Ordre;
      const vise = el.dataset.vise;
      const qui = el.dataset.qui === 'tous' ? amis(c).filter((y) => y.compagnon && y.etat === 'actif' && !y.inconscient).map((y) => y.id) : [el.dataset.qui!];
      const dit = ordre === 'cible' ? `Sur ${combattant(c, vise!).nom} !` : ORDRES[ordre];
      const reponses: string[] = [];
      for (const id of qui) {
        const y = combattant(c, id);
        const e = (p.compagnons ?? []).find((k) => k.id === y.compagnon);
        if (!e || ordresDonnes[y.id] === c.assaut) continue;
        ordresDonnes[y.id] = c.assaut;
        const d = lancer(20);
        const prenom = y.nom.split(' ')[0];
        if (obeit(p, e, d, ordre)) {
          (c.ordres ??= {})[y.id] = { ordre, cible: vise };
          reponses.push(`${de(d, 'petit')} ${echapper(prenom)} obéit${d === 1 ? ' au quart de tour' : ''}.`);
        } else
          reponses.push(
            `${de(d, 'petit')} ${echapper(prenom)} ${
              compagnon(e.id).valeurs.includes('cupide') && (e.du ?? 0) > 0
                ? "fait la sourde oreille : « Pas payé pour ça. »"
                : ordre === 'distance' && compagnon(e.id).valeurs.includes('gloire')
                  ? "ricane : « Derrière ? Moi ? »"
                  : d === 20
                    ? 'te regarde comme si tu lui avais demandé de danser.'
                    : "n'entend pas, ou fait semblant."
            }`,
          );
      }
      if (!reponses.length) return;
      reponseOrdre = `« ${echapper(dit)} » ${reponses.join(' ')}`;
      c.journal.push(reponseOrdre.replace(/<[^>]+>/g, '').replace(/\s+/g, ' '));
      render();
    });
    app.querySelector('#fin-combat')?.addEventListener('click', () => {
      if (attente?.type === 'fin') terminer(attente.bilan);
    });
  };

  c.journal.push(`Ordre d'attaque (Courage, puis Adresse) : ${c.ordre.map((id) => combattant(c, id).nom).join(', ')}.`);
  render();
  // Pour les tests en développement : accès au combat en cours.
  if (import.meta.env.DEV) Object.assign(window, { __combat: { c, render } });
  setTimeout(avancer, 600);
};
