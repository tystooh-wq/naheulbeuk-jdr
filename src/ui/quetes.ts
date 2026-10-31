import { lancer } from '../rules/des';
import { quetesRefusees, villeDe } from '../rules/reputation';
import { dansHoraire, donjonIci } from '../rules/donjons';
import { objet } from '../rules/objets';
import { niveau, type Partie } from '../rules/partie';
import {
  accepterQuete,
  combatEtape,
  etapeEnCours,
  etapesIci,
  QUETES,
  quetesProposees,
  tenterEtape,
  validerEtape,
  valeurEpreuveQuete,
  type Quete,
} from '../rules/quetes';
import type { Rencontre } from '../rules/rencontres';
import { formatOr } from '../rules/monnaie';
import { animerDes, de, echapper } from './outils';

// Les quêtes dans les fenêtres de lieu (ville ou carte du monde) et dans l'onglet « Quêtes ».

const NOM_CARAC = { COU: 'Courage', INT: 'Intelligence', CHA: 'Charisme', AD: 'Adresse', FO: 'Force' };

export interface ActionsQuete {
  message: (html: string) => void;
  /** Lance un combat ; `apres` est appelé en cas de victoire. */
  combat: (r: Rencontre, apres: () => string) => void;
  donjon: (id: string, par?: string) => void;
}

/** Ce que le héros peut faire ici pour ses quêtes : en accepter, ou avancer celles en cours. */
export const panneauQuetes = (p: Partie, ou: string, epreuveEnCours?: string): string => {
  const proposees = quetesProposees(p, ou);
  const ici = etapesIci(p, ou);
  const d = donjonIci(ou);
  // Un donjon sans quête (ou déjà fini) reste visitable.
  const donjonLibre = d && !ici.some((x) => x.etape.donjon === d.id) && !QUETES.some((q) => q.etapes.some((e) => e.donjon === d.id) && p.quetes[q.id] !== 'terminee');
  const ville = villeDe(ou);
  const refus = ville && quetesRefusees(p, ville) && QUETES.some((q) => q.donneur === ou && !p.quetes[q.id]);
  if (!proposees.length && !ici.length && !donjonLibre && !refus) return '';
  return `<div class="quetes-lieu">
    ${refus ? '<p class="note">On te regarde de travers : ta réputation est telle que personne ici ne te confiera de travail.</p>' : ''}
    ${proposees
      .map(
        (q) => `<div class="detail-choix quete">
          <h3>❗ ${echapper(q.titre)}</h3>
          <p class="note">${echapper(q.qui)}${q.niveau && niveau(p) < q.niveau ? ` · conseillé à partir du niveau ${q.niveau}` : ''}</p>
          <p>${echapper(q.proposition)}</p>
          <p class="note">Récompense : ${echapper(q.recompense.texte)}${q.recompense.xp ? `, ${q.recompense.xp} XP` : ''}.</p>
          <p><button data-accepter="${q.id}" ${q.prix && p.or < q.prix ? 'disabled' : ''}>${q.prix ? `Payer ${formatOr(q.prix)} et accepter` : 'Accepter'}</button></p>
        </div>`,
      )
      .join('')}
    ${ici
      .map(({ quete: q, etape: e }) => {
        let bouton = `<button data-etape="${q.id}">${echapper(e.action)}</button>`;
        if (e.combat) bouton = `<button data-etape="${q.id}">⚔ ${echapper(e.action)}</button>`;
        if (e.donjon) bouton = `<button data-entrer-donjon="${e.donjon}">♖ ${echapper(e.action)}</button>`;
        const manque = e.requiert?.(p);
        if (manque) bouton = `<button disabled>${echapper(e.action)}</button> <span class="note">${echapper(manque)}</span>`;
        if (e.epreuve)
          bouton =
            epreuveEnCours === q.id
              ? `<div class="recit lancer-joueur">Épreuve de ${NOM_CARAC[e.epreuve.carac]} : il faut faire <b>${valeurEpreuveQuete(p, e.epreuve)} ou moins</b> sur le D20.
                  <div>${de('?', 'a-lancer" id="de-quete')}<button id="lancer-quete" data-quete="${q.id}">Lancer le D20</button></div></div>`
              : `<button data-epreuve="${q.id}">${echapper(e.action)}</button>`;
        return `<div class="detail-choix quete en-cours">
          <h3>➤ ${echapper(q.titre)}</h3>
          <p>${echapper(e.objectif)}</p>
          ${e.combat ? `<p class="note">Il faudra se battre : ${e.combat.nombre} × ${echapper(e.combat.ligne.nom)}.</p>` : ''}
          <p>${bouton}</p>
        </div>`;
      })
      .join('')}
    ${donjonLibre ? boutonsEntree(p, d) : ''}
  </div>`;
};

/** Entrer dans un donjon, par chacune de ses portes (la taverne n'ouvre qu'à certaines heures). */
const boutonsEntree = (p: Partie, d: NonNullable<ReturnType<typeof donjonIci>>) => {
  if (!d.entrees) return `<p><button class="secondaire" data-entrer-donjon="${d.id}">♖ Entrer dans ${echapper(d.nom)}</button></p>`;
  return `<p>${d.entrees
    .map((x) => {
      const ferme = x.ouverte && !dansHoraire(p.heure, x.ouverte);
      return `<button class="secondaire" data-entrer-donjon="${d.id}" data-par="${x.salle}" ${ferme ? 'disabled title="Fermé à cette heure-ci"' : ''}>♖ ${echapper(x.libelle)}${ferme ? ' (fermé)' : ''}</button>`;
    })
    .join(' ')}</p>`;
};

/** Le journal des quêtes : en cours (avec l'objectif du moment), puis terminées. */
export const panneauJournalQuetes = (p: Partie): string => {
  const enCours = QUETES.filter((q) => p.quetes[q.id] === 'acceptee');
  const finies = QUETES.filter((q) => p.quetes[q.id] === 'terminee');
  const ligne = (q: Quete) => {
    const i = etapeEnCours(p, q.id);
    return `<li class="quete en-cours"><b>${echapper(q.titre)}</b> <span class="note">(${echapper(q.qui)}, étape ${i + 1}/${q.etapes.length})</span><br />➤ ${echapper(q.etapes[i].objectif)}
      <br /><span class="note">Récompense : ${echapper(q.recompense.texte)}${q.recompense.xp ? `, ${q.recompense.xp} XP` : ''}.</span></li>`;
  };
  return `<div class="panneau">
    <h2>Quêtes</h2>
    ${enCours.length ? `<ul class="journal-quetes">${enCours.map(ligne).join('')}</ul>` : '<p class="note">Aucune quête en cours. Les repères ❗ sur les plans montrent où l\'on propose du travail.</p>'}
    ${finies.length ? `<h3>Terminées</h3><ul class="journal-quetes">${finies.map((q) => `<li>✔ ${echapper(q.titre)} <span class="note">(${echapper(q.recompense.texte)})</span></li>`).join('')}</ul>` : ''}
    <p><button class="secondaire" data-proposer-quete>📜 Proposer une quête</button> <span class="note">Une idée de quête ? Elle sera lue par le MJ.</span></p>
    ${p.sac.some((id) => objet(id).quete) ? `<p class="note">Objets de quête dans le sac : ${p.sac.filter((id) => objet(id).quete).map((id) => echapper(objet(id).nom)).join(', ')}.</p>` : ''}
  </div>`;
};

/** Repère à poser sur un plan : ❗ quête à prendre, ➤ étape en cours. */
export const marqueQuete = (p: Partie, ou: string): '' | 'nouvelle' | 'etape' =>
  etapesIci(p, ou).length ? 'etape' : quetesProposees(p, ou).length ? 'nouvelle' : '';

export const lierQuetes = (app: HTMLElement, p: Partie, a: ActionsQuete, lancerEpreuve: (id: string) => void) => {
  const sur = (sel: string, fn: (el: HTMLElement) => void) =>
    app.querySelectorAll<HTMLElement>(sel).forEach((el) => el.addEventListener('click', () => fn(el)));
  sur('[data-accepter]', (el) => {
    const q = QUETES.find((x) => x.id === el.dataset.accepter)!;
    const refus = accepterQuete(p, q.id);
    a.message(refus ? echapper(refus) : `Quête acceptée : <b>${echapper(q.titre)}</b>. ➤ ${echapper(q.etapes[0].objectif)}`);
  });
  sur('[data-etape]', (el) => {
    const id = el.dataset.etape!;
    const q = QUETES.find((x) => x.id === id)!;
    const e = q.etapes[etapeEnCours(p, id)];
    const r = combatEtape(e);
    if (r) return a.combat(r, () => validerEtape(p, id).texte);
    a.message(echapper(validerEtape(p, id).texte));
  });
  sur('[data-epreuve]', (el) => lancerEpreuve(el.dataset.epreuve!));
  sur('[data-entrer-donjon]', (el) => a.donjon(el.dataset.entrerDonjon!, el.dataset.par));
  sur('#lancer-quete', (bouton) => {
    const id = bouton.dataset.quete!;
    const d = lancer(20);
    (bouton as HTMLButtonElement).disabled = true;
    animerDes([app.querySelector<HTMLElement>('#de-quete')!], 20, [d]).then(() =>
      setTimeout(() => {
        const r = tenterEtape(p, id, d);
        a.message(`${de(d)} ${echapper(r.texte)}`);
      }, 350),
    );
  });
};
