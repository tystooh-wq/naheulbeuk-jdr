import {
  acteur,
  attaquer,
  adversaires,
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
  planifier,
  tenterFuite,
  tirer,
  toucherParSort,
  tourSuivant,
  valeurDefense,
  verifier,
  xpGagnee,
  type Action,
  type Combat,
  type Combattant,
  type ModeDefense,
} from '../rules/combat';
import { fouiller, tableButin, type Fouille } from '../rules/butin';
import { avecDe, lancer } from '../rules/des';
import { objet } from '../rules/objets';
import { boirePotion, lancerExpression, niveau, noter, type Partie } from '../rules/partie';
import { consommerProjectile, valeursTir } from '../rules/tir';
import { degatsSort, ea, eaMax, lancerSort, sort, sortsConnus, valeurSort, type Sort } from '../rules/magie';
import type { Rencontre } from '../rules/rencontres';
import { aTalent } from '../rules/talents';
import { boutonsVitesse, lierVitesse, vitesse } from './commun';
import { PAS as PAS_HEROS } from '../rules/combat';
import { boutonAutrement } from './idees';
import { animerDes, de, echapper } from './outils';

// Le plateau de combat : un terrain en cases (le héros et les siens à gauche, les ennemis à droite),
// les fiches des combattants et l'action en cours. Les dés des ennemis et des compagnons roulent tout
// seuls ; au tour du joueur, le temps s'arrête : il peut avancer (cases en surbrillance), puis choisir
// son action et lancer ses propres dés (attaque, dégâts, parade ou esquive, fuite).

export interface BilanCombat {
  fin: 'victoire' | 'defaite' | 'fuite';
  xp: number;
  or: number;
  perdu: number;
  /** Objets ramassés sur les vaincus (déjà dans le sac). */
  objets: string[];
  fouilles: Fouille[];
  /** Projectiles et arme de jet ramassés (ou perdus). */
  recuperes?: string;
}

type Attente =
  | { type: 'action' }
  | { type: 'defense'; attaquant: string; de: number }
  | { type: 'fouille'; corps: string[]; reste: { fin: 'victoire'; xp: number; recuperes: string; notes: string[] } }
  | { type: 'fin'; bilan: BilanCombat }
  | null;

const attendre = (ms: number) => new Promise((r) => setTimeout(r, ms / vitesse()));

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
  let lachementFait = false;
  const berserkerPossible = () => aTalent(p, 'Berserker') && !rage && Math.floor((p.talents?.berserker ?? -99) / 24) !== p.jour;
  const dague = () => !!p.equipe.arme && /dague|poignard|couteau|surin|stylet/i.test(objet(p.equipe.arme).nom);
  const lachementPossible = () => aTalent(p, 'Frapper lâchement') && !lachementFait && dague() && auContact(c).length > 0;

  const h = () => heros(c);
  const synchroniser = () => (p.ev = Math.max(0, h().ev));

  // --- Rendu -----------------------------------------------------------------------

  const carteCombattant = (x: Combattant) => {
    const pct = Math.max(0, Math.round((x.ev / x.evMax) * 100));
    const cible = attente?.type === 'action' && x.camp === 'ennemi' && x.etat === 'actif' && voisinDuHeros(x);
    const statut = [
      x.etat === 'mort' ? (x.camp === 'ennemi' ? 'à terre' : 'assommé') : x.etat === 'fui' ? 'en fuite' : '',
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
      <span>❤ ${Math.max(0, x.ev)}/${x.evMax}${x.camp === 'heros' && eaMax(p) ? ` · ✦ ${ea(p)}/${eaMax(p)} PA` : ''}</span>
      <span class="note">AT ${x.at} · PRD ${x.sansParade ? '—' : x.prd} · PR ${x.pr} · ${echapper(x.degats)}</span>
      ${statut.length ? `<span class="statut">${statut.join(' · ')}</span>` : ''}
    </${tag}>`;
  };

  const potions = () => [...new Set(p.sac.filter((id) => objet(id).type === 'potion' && (!!objet(id).soin || (!!objet(id).mana && eaMax(p) > 0))))];

  const panneauJoueur = () => {
    if (!attente) return '';
    const x = h();
    if (attente.type === 'action') {
      const fuite = x.talents?.renforts
        ? `<button class="secondaire" data-fuir>🏃 Appel des renforts : fuir sans épreuve</button>`
        : `<button class="secondaire" data-fuir>🎲 Prendre la fuite (AD ${x.ad})</button>`;
      const talents = [
        berserkerPossible() ? `<button class="secondaire" data-berserker>😡 Entrer en rage (Berserker, une fois par jour)</button>` : '',
        lachementPossible()
          ? auContact(c)
              .map((e) => `<button class="secondaire" data-lachement="${e.id}">🗡 Frapper lâchement ${echapper(e.nom)} (dégâts doublés, une fois)</button>`)
              .join('')
          : '',
      ].join('');
      const cibles = auContact(c);
      const loin = adversaires(c, x);
      const t = valeursTir(p);
      const tirImpossible = !t ? '' : c.armeLancee ? 'arme déjà lancée' : t.aSec ? 'plus de projectiles' : c.recharge > 0 ? `rechargement : encore ${c.recharge} assaut${c.recharge > 1 ? 's' : ''}` : '';
      const tirs =
        t && !cibles.length
          ? `<p class="actions-lieu">${loin
              .map((e) => `<button data-tirer="${e.id}" ${tirImpossible ? 'disabled' : ''}>🏹 Tirer sur ${echapper(e.nom)} (AD ${t.ad})</button>`)
              .join('')}</p>
             <p class="note">${echapper(t.arme.nom)} : dégâts ${echapper(t.degats)}${t.projectile ? `, ${echapper(t.projectile.nom)} (${p.sac.filter((id) => id === t.projectile!.id).length} dans le sac)` : ''}${
              t.details.length ? ` · AD ${echapper(t.details.join(', '))}` : ''
            }${tirImpossible ? ` · <b>${tirImpossible}</b>` : ''}</p>`
          : '';
      const sorts = sortsConnus(p).filter((s) => s.enCombat);
      // On ne lance pas un sort avec un ennemi dans les pattes.
      const boutonsSorts =
        sorts.length && !cibles.length
          ? `<p class="actions-lieu">${sorts
              .flatMap((s) =>
                loin.map(
                  (e) =>
                    `<button class="sort" data-sort="${s.id}" data-cible-sort="${e.id}" ${ea(p) < s.cout ? 'disabled' : ''}>✨ ${echapper(s.nom)} sur ${echapper(e.nom)}${s.zone ? ' et ses voisins' : ''} (${s.cout} PA, ${valeurSort(p, s)} ou moins)</button>`,
                ),
              )
              .join('')}</p>`
          : '';
      const bouger = c.deplace ? '' : `Tu peux d'abord avancer de ${PAS_HEROS} cases (cases claires du terrain). `;
      const consigne = cibles.length
        ? `<p><b>À toi !</b> Le temps s'arrête. ${bouger}Choisis ta cible au contact et lance ton D20 : il faut faire <b>${x.at} ou moins</b>.</p>`
        : `<p><b>À toi !</b> Aucun ennemi au contact. ${bouger}${t ? 'Tu peux tirer, ' : ''}${sorts.length ? 'lancer un sort, ' : ''}${
            t || sorts.length ? 'ou ' : ''
          }avancer vers eux et finir ton tour.</p>`;
      const melee = `<p class="actions-lieu">${cibles.map((e) => `<button data-cible="${e.id}">🎲 Attaquer ${echapper(e.nom)}</button>`).join('')}<button class="secondaire" data-attendre>⏳ ${
        c.deplace ? 'Finir le tour' : 'Attendre de pied ferme'
      }</button></p>`;
      return `<div class="a-toi">${consigne}${tirs}${boutonsSorts}${melee}
        ${talents ? `<p class="actions-lieu">${talents}</p>` : ''}
        <p class="actions-lieu">${potions()
          .map((id) => `<button class="secondaire" data-potion="${id}">Boire : ${echapper(objet(id).nom)}</button>`)
          .join('')}${fuite}</p>
        <p>${boutonAutrement({ type: 'combat', id: r.ligne.nom, titre: `Combat contre ${r.nombre > 1 ? `${r.nombre} ${r.ligne.nom}` : r.ligne.nom}` })}</p></div>`;
    }
    if (attente.type === 'defense') {
      const a = combattant(c, attente.attaquant);
      const parade = valeurDefense(x, 'parade', a);
      const esquive = valeurDefense(x, 'esquive', a);
      const pourquoi = a.imparable ? 'ses coups ne se parent pas' : x.sansParade ? 'à mains nues, on ne pare pas' : '';
      return `<div class="a-toi"><p><b>${echapper(a.nom)} te touche !</b> Défends-toi : une seule parade ou esquive par assaut.</p>
        <p class="actions-lieu">
          <button data-defense="parade" ${parade === null ? `disabled title="${pourquoi}"` : ''}>🎲 Parer (PRD ${parade ?? '—'})</button>
          <button data-defense="esquive" ${esquive === null ? 'disabled title="Trop d\'armure pour esquiver"' : ''}>🎲 Esquiver (AD ${esquive ?? '—'})</button>
          <button class="secondaire" data-defense="encaisser">🛡 Encaisser</button>
        </p>
        <p class="note">${pourquoi ? `${pourquoi.charAt(0).toUpperCase() + pourquoi.slice(1)}. ` : ''}Esquiver t'éloigne : tu rates ta prochaine attaque, sauf esquive critique. Encaisser : tu prends le coup (moins ton armure), mais tu restes au contact pour frapper.</p></div>`;
    }
    if (attente.type === 'fouille') {
      const poubelles = !!h().talents?.poubelles;
      // Ceux qui ont fui sont partis avec leurs affaires : il n'y a que les corps à terre à fouiller.
      const enFuite = ennemis(c).filter((x) => x.etat === 'fui').map((x) => x.nom);
      const fuite = enFuite.length
        ? ` <span class="note">${echapper(enFuite.join(', '))} ${enFuite.length > 1 ? 'ont' : 'a'} pris la fuite avec ${enFuite.length > 1 ? 'leurs' : 'ses'} affaires : rien à fouiller de ce côté.</span>`
        : '';
      const nb = attente.corps.length;
      return `<div class="a-toi bilan" data-lanceur><p><b>Victoire !</b> ${nb > 1 ? `${nb} corps sont à terre` : 'Un corps est à terre'}. Tu fouilles : lance ${poubelles ? 'deux D20 par corps (Fouiller dans les poubelles : le meilleur compte)' : 'un D20 par corps'} sur la table de butin. Plus c'est haut, mieux c'est.${fuite}</p>
        <ul class="fouilles">${attente.corps
          .map((id) => `<li>${echapper(combattant(c, id).nom)} ${(poubelles ? ['?', '?'] : ['?']).map(() => de('?', 'fouille a-lancer')).join('')}</li>`)
          .join('')}</ul>
        <p><button id="lancer-fouille">🎲 Fouiller (lancer ${attente.corps.length * (poubelles ? 2 : 1)} D20)</button></p></div>`;
    }
    const b = attente.bilan;
    const titre = { victoire: 'Victoire !', defaite: 'Tu tombes…', fuite: 'Tu as pris la fuite' }[b.fin];
    return `<div class="a-toi bilan"><p><b>${titre}</b></p>
      <ul>${b.xp ? `<li>${b.xp} points d'expérience</li>` : ''}<li>${
        b.perdu > 0 ? `${b.perdu} PV perdus dans la bagarre` : 'Pas une égratignure'
      }</li></ul>
      ${
        b.fouilles.length
          ? `<p><b>Tu fouilles les corps</b> <span class="note">(ton D20 sur la table de butin)</span></p><ul class="fouilles">${b.fouilles
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
      <p><button id="fin-combat">Continuer</button></p>
      <p>${boutonAutrement({ type: 'combat', id: `bilan:${r.ligne.nom}`, titre: `${titre} (combat contre ${r.ligne.nom})` })}</p></div>`;
  };

  // --- Le terrain -----------------------------------------------------------------

  const voisinDuHeros = (x: Combattant) => contacts(c, h()).some((y) => y.id === x.id);
  const initiales = (x: Combattant) =>
    x.id === 'heros' ? '★' : x.nom.split(/\s+/).filter((m) => /^[A-ZÀ-Ý]/.test(m)).map((m) => m[0]).join('').slice(0, 2) + (/\d+$/.exec(x.nom)?.[0] ?? '');
  const classePion = (x: Combattant) => (x.id === 'heros' ? 'pion-heros' : x.compagnon ? 'pion-compagnon' : x.allie ? 'pion-allie' : 'pion-ennemi');

  const terrain = () => {
    const tourHeros = attente?.type === 'action' && !c.deplace;
    const accessibles = tourHeros ? casesAccessibles(c, h()) : new Map<string, number>();
    const cases: string[] = [];
    for (let y = 0; y < c.hauteur; y++)
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
              } title="${echapper(`${z.nom} : ${Math.max(0, z.ev)}/${z.evMax} PV`)}">${initiales(z)}<i class="pv-pion" style="width:${pct}%"></i></${tag}>`;
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
    return `<div class="terrain" style="--largeur:${c.largeur}" role="grid" aria-label="Terrain du combat">${cases.join('')}</div>`;
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

  /** Le joueur clique pour lancer ses dés de dégâts. */
  const clicDegats = (zone: HTMLElement, expr: string) =>
    new Promise<void>((resolve) => {
      const el = etape(zone, `<span data-lanceur>Dégâts (${echapper(expr)}) : ${de('?', 'a-lancer')}<button id="lancer-degats">🎲 Lancer les dégâts (${echapper(expr)})</button></span>`);
      el.querySelector('button')!.addEventListener('click', () => {
        el.remove();
        resolve();
      });
    });

  /** Joue une action à l'écran, étape par étape. `lances` : dés déjà vus par le joueur (attaque, défense). */
  const montrer = async (a: Action, lances: { attaque?: boolean; defense?: boolean } = {}, expr?: string) => {
    const zone = app.querySelector<HTMLElement>('#action')!;
    const att = combattant(c, a.attaquant);
    const cib = combattant(c, a.cible);
    zone.innerHTML = `<p class="qui"><b>${echapper(att.nom)}</b> ${a.tir ? 'tire sur' : 'attaque'} <b>${echapper(cib.nom)}</b></p>`;
    let el = etape(zone, `${a.tir ? 'Tir (AD)' : 'Attaque'} ${de(a.de, 'anim')} contre ${a.valeur} : <span class="verdict ${a.issue}">${VERDICT[a.issue]}</span>`);
    await reveler(el, 20, [a.de], !!lances.attaque);
    if (a.defense) {
      const d = a.defense;
      const issue = d.issue === 'reussi' ? (d.mode === 'parade' ? 'paré' : 'esquivé') : VERDICT[d.issue];
      el = etape(zone, `${d.mode === 'parade' ? 'Parade' : 'Esquive'} ${de(d.de, 'anim')} contre ${d.valeur} : <span class="verdict ${d.issue}">${issue}</span>`);
      await reveler(el, 20, [d.de], !!lances.defense);
    } else if (a.sansDefense) {
      etape(zone, `<span class="note">Pas de défense : ${echapper(a.sansDefense)}.</span>`);
    }
    if (a.degats) {
      const g = a.degats;
      if (att.camp === 'heros') await clicDegats(zone, expr ?? att.degats);
      el = etape(
        zone,
        `Dégâts ${g.des.map((x) => de(x, 'anim')).join('')} = ${g.total}${g.pr ? `, moins ${g.pr} d'armure` : a.issue === 'critique' ? ', armure ignorée' : ''} : <span class="verdict rate">−${g.blessure - (g.poison?.[0] ?? 0)} PV</span>`,
      );
      await reveler(el, 6, g.des, false);
      if (g.poison) {
        el = etape(zone, `Poison ${de(g.poison[0], 'anim')} : <span class="verdict rate">−${g.poison[0]} PV</span>`);
        await reveler(el, 6, g.poison, false);
      }
      touche = cib.id;
    }
    for (const e of a.effets) etape(zone, `<span class="effet">${echapper(e)}</span>`);
    c.journal.push(resumer(a));
    scene = zone.innerHTML;
  };

  const resumer = (a: Action) => {
    const att = combattant(c, a.attaquant).nom;
    const cib = combattant(c, a.cible).nom;
    if (a.issue === 'rate') return `${att} rate ${cib}.`;
    if (a.issue === 'maladresse') return `${att} : maladresse ! ${a.effets.join(' ')}`;
    if (!a.degats) return `${cib} ${a.defense?.mode === 'esquive' ? 'esquive' : 'pare'} le coup de ${att}.`;
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
    bilanCompagnons(c, p);
    let notes: string[] = [];
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
    const fin = c.fin!;
    const xp = fin === 'defaite' ? 0 : xpGagnee(c);
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
    const corps = fin === 'victoire' ? ennemis(c).filter((x) => x.etat === 'mort' && tableButin(x.nom)).map((x) => x.id) : [];
    if (corps.length) {
      attente = { type: 'fouille', corps, reste: { fin: 'victoire', xp, recuperes, notes } };
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

  const conclure = (fin: 'victoire' | 'defaite' | 'fuite', xp: number, recup: string, notes: string[], fouilles: Fouille[]) => {
    const or = fouilles.reduce((s, f) => s + f.or, 0);
    const objets = fouilles.flatMap((f) => (f.objet ? [f.objet] : []));
    p.sac.push(...objets);
    const recuperes = [recup, ...notes].filter(Boolean).join(' ');
    const bilan: BilanCombat = { fin, xp, or, perdu: evDepart - p.ev, objets, fouilles, recuperes };
    p.xp = (p.xp ?? 0) + xp;
    p.or += or;
    const qui = r.nombre > 1 ? `${r.nombre} ${r.ligne.nom}` : r.ligne.nom;
    noter(
      p,
      fin === 'victoire'
        ? `vainc ${qui} en ${c.assaut} assaut${c.assaut > 1 ? 's' : ''} (+${xp} XP${or ? `, +${or} PO` : ''}${objets.length ? `, ${objets.map((o) => objet(o).nom).join(', ')}` : ''}).`
        : fin === 'fuite'
          ? `s'enfuit en plein combat contre ${qui}.`
          : `tombe sous les coups de ${qui}.`,
    );
    attente = { type: 'fin', bilan };
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
      if (plan.vers) {
        deplacer(c, x.id, plan.vers.x, plan.vers.y);
        render();
        await attendre(450);
      }
      const cible = plan.cible ? combattant(c, plan.cible) : undefined;
      if (!cible || (!plan.tir && !contacts(c, x).some((y) => y.id === cible.id))) {
        if (!plan.vers) message(`${x.nom} attend son heure.`);
        tourSuivant(c);
        continue;
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
        const el = etape(zone, `Attaque ${de(d, 'anim')} contre ${x.at} : <span class="verdict reussi">touché</span>`);
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
      apres();
      if (!c.fin) await attendre(600);
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
      c.recharge = t.recharge;
      const a = tirer(c, 'heros', cible, d, { ad: t.ad, degats: t.degats });
      await montrer(a, { attaque: true }, t.degats);
      apres();
      if (!c.fin) await attendre(600);
      avancer();
    });

    sur('[data-sort]', async (el) => {
      if (attente?.type !== 'action') return (occupe = false);
      const s: Sort = sort(el.dataset.sort!);
      attente = null;
      const d = lancer(20);
      const zone = await lancerJoueur(`Tu incantes <b>${echapper(s.nom)}</b>… il faut ${valeurSort(p, s)} ou moins.`, d);
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
      etape(zone, `<span class="verdict visible ${res.issue}">${echapper(res.texte)}</span> <span class="note">(${ea(p)} PA restants)</span>`);
      c.journal.push(`${h().nom} lance ${s.nom} : ${res.texte}`);
      if (res.issue === 'critique' || res.issue === 'reussi') {
        const visee = combattant(c, el.dataset.cibleSort!);
        // Un sort de zone touche la cible et les ennemis collés à elle.
        const cibles = [visee, ...(s.zone ? ennemis(c).filter((e) => e.etat === 'actif' && ecart(e, visee) === 1) : [])].map((e) => e.id);
        await clicDegats(zone, `${degatsSort(p, s)}${s.zone ? ' par cible' : ''}${res.issue === 'critique' ? ', doublés' : ''}`);
        for (const id of cibles) {
          const a = toucherParSort(c, id, degatsSort(p, s), res.issue === 'critique');
          const g = a.degats!;
          const e = etape(
            zone,
            `${echapper(combattant(c, id).nom)} : ${g.des.map((x) => de(x, 'anim')).join('')}${res.issue === 'critique' ? ' ×2' : ''} = ${g.total}${g.pr ? `, moins ${g.pr} d'armure` : ''} : <span class="verdict rate">−${g.blessure} PV</span>`,
          );
          await reveler(e, 6, g.des, false);
          c.journal.push(`${s.nom} touche ${combattant(c, id).nom} : −${g.blessure} PV.`);
          touche = id;
        }
      }
      scene = zone.innerHTML;
      apres();
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
      if (attente?.type !== 'action' || !lachementPossible()) return (occupe = false);
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

    sur('[data-case]', (el) => {
      if (attente?.type !== 'action' || c.deplace) return (occupe = false);
      const [x, y] = el.dataset.case!.split(',').map(Number);
      deplacer(c, 'heros', x, y);
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

    app.querySelector('#lancer-fouille')?.addEventListener('click', () => void fouillerCorps());
    app.querySelector('#fin-combat')?.addEventListener('click', () => {
      if (attente?.type === 'fin') terminer(attente.bilan);
    });
  };

  c.journal.push(`Ordre d'attaque (Courage, puis Adresse) : ${c.ordre.map((id) => combattant(c, id).nom).join(', ')}.`);
  render();
  setTimeout(avancer, 600);
};
