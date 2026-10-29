import {
  acteur,
  attaquer,
  auContact,
  butin,
  combattant,
  creerCombat,
  ennemis,
  heros,
  panique,
  peutSeDefendre,
  tenterFuite,
  tourSuivant,
  valeurDefense,
  verifier,
  xpGagnee,
  type Action,
  type Combat,
  type Combattant,
  type ModeDefense,
} from '../rules/combat';
import type { Fouille } from '../rules/butin';
import { lancer } from '../rules/des';
import { objet } from '../rules/objets';
import { boirePotion, noter, type Partie } from '../rules/partie';
import type { Rencontre } from '../rules/rencontres';
import { boutonsVitesse, lierVitesse, vitesse } from './commun';
import { animerDes, de, echapper } from './outils';

// Le plateau de combat : le héros à gauche, ses ennemis à droite, l'action en cours au milieu.
// Les dés des ennemis roulent tout seuls ; au tour du joueur, le temps s'arrête jusqu'à ce qu'il
// choisisse son action et lance ses propres dés (attaque, dégâts, parade ou esquive, fuite).

export interface BilanCombat {
  fin: 'victoire' | 'defaite' | 'fuite';
  xp: number;
  or: number;
  perdu: number;
  /** Objets ramassés sur les vaincus (déjà dans le sac). */
  objets: string[];
  fouilles: Fouille[];
}

type Attente =
  | { type: 'action' }
  | { type: 'defense'; attaquant: string; de: number }
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

  const h = () => heros(c);
  const synchroniser = () => (p.ev = Math.max(0, h().ev));

  // --- Rendu -----------------------------------------------------------------------

  const carteCombattant = (x: Combattant) => {
    const pct = Math.max(0, Math.round((x.ev / x.evMax) * 100));
    const cible = attente?.type === 'action' && x.camp === 'ennemi' && x.etat === 'actif';
    const statut = [
      x.etat === 'mort' ? 'à terre' : x.etat === 'fui' ? 'en fuite' : '',
      x.rate > 0 && x.etat === 'actif' ? 'déséquilibré' : '',
      x.defendu && x.etat === 'actif' ? 'a déjà paré' : '',
    ].filter(Boolean);
    const tag = cible ? 'button' : 'div';
    return `<${tag} class="combattant cote-${x.camp} etat-${x.etat} ${acteur(c).id === x.id && !c.fin ? 'son-tour' : ''} ${touche === x.id ? 'touche' : ''}" ${
      cible ? `data-cible="${x.id}" title="Attaquer ${echapper(x.nom)}"` : ''
    }>
      <b>${echapper(x.nom)}</b>
      <span class="jauge-ev ${pct <= 30 ? 'basse' : ''}"><span style="width:${pct}%"></span></span>
      <span>❤ ${Math.max(0, x.ev)}/${x.evMax}</span>
      <span class="note">AT ${x.at} · PRD ${x.sansParade ? '—' : x.prd} · PR ${x.pr} · ${echapper(x.degats)}</span>
      ${statut.length ? `<span class="statut">${statut.join(' · ')}</span>` : ''}
    </${tag}>`;
  };

  const potions = () => [...new Set(p.sac.filter((id) => objet(id).type === 'potion' && !!objet(id).soin))];

  const panneauJoueur = () => {
    if (!attente) return '';
    const x = h();
    if (attente.type === 'action') {
      const fuite = `<button class="secondaire" data-fuir>🎲 Prendre la fuite (AD ${x.ad})</button>`;
      return `<div class="a-toi"><p><b>À toi !</b> Le temps s'arrête. Choisis ta cible et lance ton D20 : il faut faire <b>${x.at} ou moins</b>.</p>
        <p class="actions-lieu">${auContact(c)
          .map((e) => `<button data-cible="${e.id}">🎲 Attaquer ${echapper(e.nom)}</button>`)
          .join('')}</p>
        <p class="actions-lieu">${potions()
          .map((id) => `<button class="secondaire" data-potion="${id}">Boire : ${echapper(objet(id).nom)}</button>`)
          .join('')}${fuite}</p></div>`;
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
    const b = attente.bilan;
    const titre = { victoire: 'Victoire !', defaite: 'Tu tombes…', fuite: 'Tu as pris la fuite' }[b.fin];
    return `<div class="a-toi bilan"><p><b>${titre}</b></p>
      <ul>${b.xp ? `<li>${b.xp} points d'expérience</li>` : ''}<li>${
        b.perdu > 0 ? `${b.perdu} PV perdus dans la bagarre` : 'Pas une égratignure'
      }</li></ul>
      ${
        b.fouilles.length
          ? `<p><b>Tu fouilles les corps</b> <span class="note">(D20 du MJ sur la table de butin)</span></p><ul class="fouilles">${b.fouilles
              .map(
                (f) =>
                  `<li>${echapper(f.ennemi)} ${f.de ? de(f.de, 'petit') : ''} ${
                    [f.objet ? `<b>${echapper(objet(f.objet).nom)}</b>` : '', f.or ? `${f.or} PO` : ''].filter(Boolean).join(', ') || 'rien'
                  }</li>`,
              )
              .join('')}</ul>${b.or ? `<p>En tout : <b>${b.or} PO</b>${b.objets.length ? ` et ${b.objets.length} objet${b.objets.length > 1 ? 's' : ''} dans ton sac` : ''}.</p>` : ''}`
          : ''
      }
      <p><button id="fin-combat">Continuer</button></p></div>`;
  };

  const render = () => {
    const contact = ennemis(c).filter((x) => x.etat !== 'reserve');
    const reserve = ennemis(c).filter((x) => x.etat === 'reserve');
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
      <div class="plateau">
        <div class="camp camp-heros">${carteCombattant(h())}</div>
        <div class="centre-combat"><div id="action" class="action-combat" aria-live="polite">${scene}</div>${panneauJoueur()}</div>
        <div class="camp camp-ennemis">${contact.map(carteCombattant).join('')}
          ${reserve.length ? `<p class="note">En attente derrière : ${reserve.map((x) => echapper(x.nom)).join(', ')}</p>` : ''}</div>
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
      const el = etape(zone, `<button id="lancer-degats">🎲 Lancer les dégâts (${echapper(expr)})</button>`);
      el.querySelector('button')!.addEventListener('click', () => {
        el.remove();
        resolve();
      });
    });

  /** Joue une action à l'écran, étape par étape. `lances` : dés déjà vus par le joueur (attaque, défense). */
  const montrer = async (a: Action, lances: { attaque?: boolean; defense?: boolean } = {}) => {
    const zone = app.querySelector<HTMLElement>('#action')!;
    const att = combattant(c, a.attaquant);
    const cib = combattant(c, a.cible);
    zone.innerHTML = `<p class="qui"><b>${echapper(att.nom)}</b> attaque <b>${echapper(cib.nom)}</b></p>`;
    let el = etape(zone, `Attaque ${de(a.de, 'anim')} contre ${a.valeur} : <span class="verdict ${a.issue}">${VERDICT[a.issue]}</span>`);
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
      if (att.camp === 'heros') await clicDegats(zone, att.degats);
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
    const fin = c.fin!;
    const xp = fin === 'defaite' ? 0 : xpGagnee(c);
    const fouilles = fin === 'victoire' ? butin(c) : [];
    const or = fouilles.reduce((s, f) => s + f.or, 0);
    const objets = fouilles.flatMap((f) => (f.objet ? [f.objet] : []));
    p.sac.push(...objets);
    const bilan: BilanCombat = { fin, xp, or, perdu: evDepart - p.ev, objets, fouilles };
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
      if (x.camp === 'heros') {
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
      // Tour d'un ennemi : il lance son attaque. S'il touche, le joueur choisit sa défense.
      render();
      await attendre(500);
      const d = lancer(20);
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

    sur('[data-potion]', async (el) => {
      if (attente?.type !== 'action') return (occupe = false);
      attente = null;
      const id = el.dataset.potion!;
      p.ev = h().ev;
      const res = boirePotion(p, id);
      if (typeof res !== 'string') {
        h().ev = p.ev;
        message(`${h().nom} boit ${objet(id).nom} en vitesse : +${res.rendu} PV. L'assaut est perdu pour attaquer.`);
      }
      apres();
      await attendre(900);
      avancer();
    });

    sur('[data-fuir]', async () => {
      if (attente?.type !== 'action') return (occupe = false);
      attente = null;
      const d = lancer(20);
      const zone = await lancerJoueur(`Tu tentes de prendre la fuite : il faut ${h().ad} ou moins.`, d);
      const ok = tenterFuite(c, d);
      etape(zone, ok ? 'Tu détales sans demander ton reste !' : 'Raté : on te barre la route, et tu as perdu ton assaut.');
      c.journal.push(ok ? `${h().nom} s'enfuit.` : `${h().nom} tente de fuir, sans succès.`);
      scene = zone.innerHTML;
      await attendre(1000);
      if (ok) return finir();
      apres();
      avancer();
    });

    app.querySelector('#fin-combat')?.addEventListener('click', () => {
      if (attente?.type === 'fin') terminer(attente.bilan);
    });
  };

  c.journal.push(`Ordre d'attaque (Courage, puis Adresse) : ${c.ordre.map((id) => combattant(c, id).nom).join(', ')}.`);
  render();
  setTimeout(avancer, 600);
};
