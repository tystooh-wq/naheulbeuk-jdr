import { lancer } from '../rules/des';
import {
  accessibles,
  affronterPiege,
  ambiance,
  avancer,
  bloquee,
  combatSalle,
  donjon,
  fouiller,
  regler,
  salle,
  seReposer,
  termine,
  type Donjon,
  type EtatDonjon,
} from '../rules/donjons';
import { formatOr } from '../rules/monnaie';
import { objet } from '../rules/objets';
import { noter, type Partie } from '../rules/partie';
import { donjonTermine, valeurEpreuveQuete } from '../rules/quetes';
import { bandeau, lierSac, panneauJournal, panneauSac } from './commun';
import { ecranCombat } from './combat';
import { boutonAutrement } from './idees';
import { animerDes, de, echapper } from './outils';
import { panneauJournalQuetes } from './quetes';
import { sauvegarderPartie } from './sauvegarde';
import { ecranMort } from './mort';

// L'écran d'un donjon : la mini-carte des salles (façon Darkest Dungeon) et la salle où l'on se trouve.

export interface SortiesDonjon {
  /** Ressortir par l'entrée (ou être tiré dehors). */
  sortir: (texte?: string) => void;
  ouvrirFiche: () => void;
  finDePartie: () => void;
}

const CASE = 92;

const NOM_CARAC = { COU: 'Courage', INT: 'Intelligence', CHA: 'Charisme', AD: 'Adresse', FO: 'Force' };

const miniCarte = (d: Donjon, e: EtatDonjon) => {
  const visibles = new Set(e.vues);
  // On devine les salles voisines de celles qu'on a vues, sans savoir ce qu'elles contiennent.
  for (const id of e.vues) for (const v of salle(d, id).vers) visibles.add(v);
  const larg = Math.max(...d.salles.map((s) => s.x)) + 1;
  const haut = Math.max(...d.salles.map((s) => s.y)) + 1;
  const centre = (id: string) => {
    const s = salle(d, id);
    return [s.x * CASE + CASE / 2, s.y * CASE + CASE / 2];
  };
  const couloirs = new Set<string>();
  for (const id of e.vues)
    for (const v of salle(d, id).vers) {
      const cle = [id, v].sort().join('|');
      if (couloirs.has(cle)) continue;
      couloirs.add(cle);
    }
  const ouvertes = accessibles(e, d);
  return `<div class="mini-donjon" style="width:${larg * CASE}px;height:${haut * CASE}px">
    <svg viewBox="0 0 ${larg * CASE} ${haut * CASE}" aria-hidden="true">
      ${[...couloirs]
        .map((c) => {
          const [a, b] = c.split('|');
          const [x1, y1] = centre(a);
          const [x2, y2] = centre(b);
          return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" />`;
        })
        .join('')}
    </svg>
    ${d.salles
      .filter((s) => visibles.has(s.id))
      .map((s) => {
        const vue = e.vues.includes(s.id);
        const etat = !vue ? 'inconnue' : s.id === e.salle ? 'ici' : bloquee(e, s) ? 'danger' : 'videe';
        const icone = !vue ? '?' : s.id === d.finale ? '♛' : s.contenu?.type === 'combat' ? (e.reglees.includes(s.id) ? '✝' : '⚔') : s.contenu?.type === 'piege' ? '⚠' : s.contenu?.type === 'repos' ? '♨' : s.id === d.entree ? '⇲' : '·';
        const peut = ouvertes.includes(s.id);
        return `<button class="salle salle-${etat} ${peut ? 'ouverte' : ''}" style="left:${s.x * CASE + 8}px;top:${s.y * CASE + 8}px;width:${CASE - 16}px;height:${CASE - 16}px"
          ${peut ? `data-aller="${s.id}"` : 'disabled'} aria-label="${vue ? echapper(s.nom) : 'Salle inconnue'}">
          <span>${icone}</span><em>${vue ? echapper(s.nom) : '???'}</em>
        </button>`;
      })
      .join('')}
  </div>`;
};

export const ecranDonjon = (app: HTMLElement, p: Partie, s: SortiesDonjon) => {
  let vue: 'lieu' | 'sac' | 'journal' | 'quetes' = 'lieu';
  let message: string | undefined;
  let piegeEnCours = false;
  const d = () => donjon(p.donjon!.id);
  const sauver = () => sauvegarderPartie(p);

  const panneauSalle = () => {
    const e = p.donjon!;
    const dj = d();
    const sa = salle(dj, e.salle);
    const c = sa.contenu;
    const regle = e.reglees.includes(sa.id);
    let action = '';
    if (c?.type === 'combat' && !regle) {
      const l = c.ennemis.map((x) => `${x.nombre > 1 ? `${x.nombre} × ` : ''}${x.ligne.nom} (AT ${x.ligne.at}, PRD ${x.ligne.prd}, EV ${x.ligne.ev}, PR ${x.ligne.pr}, dégâts ${x.ligne.degats})`).join(', ');
      action = `<div class="recit">${echapper(c.texte)}</div><p class="pastille">${echapper(l)}</p>
        <p class="actions-lieu"><button id="combattre">⚔ Combattre</button>${e.precedente ? '<button class="secondaire" id="reculer">Reculer dans la salle précédente</button>' : ''}</p>`;
    } else if (c?.type === 'piege' && !regle) {
      action = piegeEnCours
        ? `<div class="recit lancer-joueur">${echapper(c.texte)} Épreuve d'${NOM_CARAC[c.carac]} : il faut faire <b>${valeurEpreuveQuete(p, { carac: c.carac, modif: c.modif, echec: '' })} ou moins</b> sur le D20 (sinon ${echapper(c.degats)} dégâts).
            <div>${de('?', 'a-lancer" id="de-piege')}<button id="lancer-piege">Lancer le D20</button></div></div>`
        : `<div class="recit">⚠ ${echapper(c.texte)}</div><p><button id="piege">Tenter de passer</button></p>`;
    } else if (c?.type === 'repos' && !regle) {
      action = `<p><button id="repos">♨ Faire une pause (${c.pv} PV, 30 minutes)</button></p>`;
    }
    const peutFouiller = sa.tresor && !e.fouillees.includes(sa.id) && !bloquee(e, sa);
    const sorties = accessibles(e, dj);
    return `<div class="panneau salle-donjon">
      <h2>${echapper(sa.nom)}</h2>
      <p>${echapper(sa.description)}</p>
      ${message ? `<div class="recit">${message}</div>` : ''}
      ${action}
      ${peutFouiller ? '<p><button class="secondaire" id="fouiller">Fouiller la salle</button></p>' : ''}
      ${
        bloquee(e, sa)
          ? ''
          : `<p class="actions-lieu">${sorties
              .map((id) => `<button class="secondaire" data-aller="${id}">→ ${e.vues.includes(id) ? echapper(salle(dj, id).nom) : 'Passage inconnu'}</button>`)
              .join('')}
             ${sa.id === dj.entree || termine(e) ? `<button id="sortir">Ressortir de ${echapper(dj.nom)}</button>` : ''}</p>`
      }
      <p>${boutonAutrement({ type: 'lieu', id: `donjon:${dj.id}:${sa.id}`, titre: `${sa.nom} (${dj.nom})` })}</p>
    </div>`;
  };

  const render = () => {
    const dj = d();
    const panneau = vue === 'sac' ? panneauSac(p) : vue === 'journal' ? panneauJournal(p) : vue === 'quetes' ? panneauJournalQuetes(p) : panneauSalle();
    app.innerHTML = `<div class="page page-donjon">
      ${bandeau(p, vue, 'Donjon')}
      <h1 class="titre-donjon">${echapper(dj.nom)}</h1>
      <div class="cadre-mini">${miniCarte(dj, p.donjon!)}</div>
      <p class="note legende-donjon">⇲ entrée · ⚔ combat · ⚠ piège · ♨ repos · ♛ salle finale · ? inconnu. Clique sur une salle voisine pour y aller.</p>
      ${panneau}
    </div>`;
    lier();
  };

  const dire = (html?: string) => {
    message = html;
    sauver();
    render();
  };

  const finSiTermine = (): string => {
    const e = p.donjon!;
    if (!termine(e) || e.fouillees.includes('__fin')) return '';
    e.fouillees.push('__fin');
    noter(p, `vient à bout de ${d().nom}.`);
    const q = donjonTermine(p, e.id);
    return `<p><b>${echapper(d().conclusion)}</b></p>${q ? `<p>${echapper(q.texte)}</p>` : ''}`;
  };

  const lier = () => {
    const sur = (sel: string, fn: (el: HTMLElement) => void) =>
      app.querySelectorAll<HTMLElement>(sel).forEach((el) => el.addEventListener('click', () => fn(el)));
    sur('[data-vue]', (el) => {
      vue = el.dataset.vue as typeof vue;
      render();
    });
    sur('#fiche', () => s.ouvrirFiche());
    lierSac(app, p, (html) => dire(html));
    sur('[data-aller]', (el) => {
      const refus = avancer(p, el.dataset.aller!);
      piegeEnCours = false;
      const e = p.donjon!;
      const sa = salle(d(), e.salle);
      dire(refus ? echapper(refus) : !sa.contenu && !sa.tresor ? echapper(ambiance()) : undefined);
    });
    sur('#reculer', () => {
      const e = p.donjon!;
      const vers = e.precedente!;
      e.precedente = e.salle;
      e.salle = vers;
      dire('Tu recules prudemment.');
    });
    sur('#sortir', () => {
      const dj = d();
      noter(p, `ressort de ${dj.nom}.`);
      p.donjon = undefined;
      s.sortir();
    });
    sur('#piege', () => {
      piegeEnCours = true;
      render();
    });
    sur('#lancer-piege', (bouton) => {
      const valeur = lancer(20);
      (bouton as HTMLButtonElement).disabled = true;
      animerDes([app.querySelector<HTMLElement>('#de-piege')!], 20, [valeur]).then(() =>
        setTimeout(() => {
          piegeEnCours = false;
          const r = affronterPiege(p, valeur);
          if (p.ev <= 0) return mourir();
          dire(`${de(valeur)} ${echapper(r.texte)}${r.degats ? ` ${r.des.map((x) => de(x)).join('')} <b>−${r.degats} PV</b>.` : ''}`);
        }, 350),
      );
    });
    sur('#repos', () => {
      const n = seReposer(p);
      const c = salle(d(), p.donjon!.salle).contenu;
      dire(`${c?.type === 'repos' ? echapper(c.texte) : ''} ${n ? `Tu récupères <b>${n} PV</b>.` : 'Tu es déjà en pleine forme.'}`);
    });
    sur('#fouiller', () => {
      const t = fouiller(p);
      if (!t) return dire('Rien de plus ici.');
      const gains = [t.or ? formatOr(t.or) : '', ...(t.objets ?? []).map((id) => objet(id).nom)].filter(Boolean);
      noter(p, `fouille ${salle(d(), p.donjon!.salle).nom} : ${gains.join(', ')}.`);
      dire(`${echapper(t.texte)} <b>${echapper(gains.join(', '))}</b>.`);
    });
    sur('#combattre', () => {
      const sa = salle(d(), p.donjon!.salle);
      const r = combatSalle(sa)!;
      ecranCombat(app, p, r, (bilan) => {
        const e = p.donjon!;
        if (bilan.fin === 'victoire') {
          regler(e, sa.id);
          const fin = finSiTermine();
          return dire(`Victoire (+${bilan.xp} XP${bilan.or ? `, ${formatOr(bilan.or)}` : ''}${bilan.objets.length ? `, ${bilan.objets.map((o) => objet(o).nom).join(', ')}` : ''}).${sa.tresor ? ' Il y a peut-être quelque chose à fouiller.' : ''}${fin}`);
        }
        if (bilan.fin === 'fuite') {
          if (e.precedente) {
            const vers = e.precedente;
            e.precedente = e.salle;
            e.salle = vers;
          }
          return dire('Tu prends la fuite et reviens sur tes pas, le cœur battant.');
        }
        mourir();
      });
    });
  };

  const mourir = () => {
    const dj = d();
    noter(p, `tombe dans ${dj.nom}.`);
    ecranMort(
      app,
      p,
      dj.secours ?? `Tes jambes se dérobent, la torche roule par terre… ${p.perso.nom} s'effondre dans ${dj.nom}.`,
      (texte) => {
        if (dj.secours) {
          // Le Donjon Facile est surveillé : on se réveille dehors, et il faudra recommencer.
          p.donjon = undefined;
          sauver();
          return s.sortir(texte);
        }
        dire(texte);
      },
      s.finDePartie,
    );
  };

  if (p.donjon!.vues.length === 1) message = echapper(d().intro);
  render();
};
