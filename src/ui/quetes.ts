import imgPanneau from '../assets/tableau/panneau.webp';
import imgP1 from '../assets/tableau/p1.webp';
import imgP2 from '../assets/tableau/p2.webp';
import imgP3 from '../assets/tableau/p3.webp';
import imgP4 from '../assets/tableau/p4.webp';
import imgExclamation from '../assets/tableau/exclamation.webp';
import imgTampon from '../assets/tableau/tampon.webp';
import imgCoche from '../assets/tableau/coche.webp';
import { lancer } from '../rules/des';
import { quetesRefusees, villeDe } from '../rules/reputation';
import { dansHoraire, donjon, donjonIci } from '../rules/donjons';
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
/** Ce qu'il y a à faire ici : quêtes proposées, étapes en cours, donjon libre, refus pour mauvaise réputation. */
const quetesDuLieu = (p: Partie, ou: string) => {
  const proposees = quetesProposees(p, ou);
  const ici = etapesIci(p, ou);
  const d = donjonIci(ou);
  // Un donjon sans quête (ou déjà fini) reste visitable.
  const donjonLibre = d && !ici.some((x) => x.etape.donjon === d.id) && !QUETES.some((q) => q.etapes.some((e) => e.donjon === d.id) && p.quetes[q.id] !== 'terminee') ? d : undefined;
  const ville = villeDe(ou);
  const refus = !!ville && quetesRefusees(p, ville) && QUETES.some((q) => q.donneur === ou && !p.quetes[q.id]);
  return { proposees, ici, donjonLibre, refus };
};

const carteProposee = (p: Partie, q: Quete) => `<div class="detail-choix quete">
          <h3>❗ ${echapper(q.titre)}</h3>
          <p class="note">${echapper(q.qui)}${q.niveau && niveau(p) < q.niveau ? ` · conseillé à partir du niveau ${q.niveau}` : ''}</p>
          <p>${echapper(q.proposition)}</p>
          <p class="note">Récompense : ${echapper(q.recompense.texte)}${q.recompense.xp ? `, ${q.recompense.xp} XP` : ''}.</p>
          <p><button data-accepter="${q.id}" ${q.prix && p.or < q.prix ? 'disabled' : ''}>${q.prix ? `Payer ${formatOr(q.prix)} et accepter` : 'Accepter'}</button></p>
        </div>`;

const carteEtape = (p: Partie, q: Quete, e: Quete['etapes'][number], epreuveEnCours?: string) => {
  let bouton = `<button data-etape="${q.id}">${echapper(e.action)}</button>`;
  if (e.combat) bouton = `<button data-etape="${q.id}">⚔ ${echapper(e.action)}</button>`;
  if (e.donjon) {
    const dj = donjon(e.donjon);
    bouton = dj.entrees ? boutonsEntree(p, dj) : `<button data-entrer-donjon="${e.donjon}">♖ ${echapper(e.action)}</button>`;
  }
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
};

export const panneauQuetes = (p: Partie, ou: string, epreuveEnCours?: string): string => {
  const { proposees, ici, donjonLibre, refus } = quetesDuLieu(p, ou);
  if (!proposees.length && !ici.length && !donjonLibre && !refus) return '';
  return `<div class="quetes-lieu">
    ${refus ? '<p class="note">On te regarde de travers : ta réputation est telle que personne ici ne te confiera de travail.</p>' : ''}
    ${proposees.map((q) => carteProposee(p, q)).join('')}
    ${ici.map(({ quete: q, etape: e }) => carteEtape(p, q, e, epreuveEnCours)).join('')}
    ${donjonLibre ? boutonsEntree(p, donjonLibre) : ''}
  </div>`;
};

/** Y a-t-il quelque chose sur le tableau d'affichage de ce lieu ? */
export const aDesQuetes = (p: Partie, ou: string) => {
  const { proposees, ici } = quetesDuLieu(p, ou);
  return proposees.length + ici.length > 0;
};

/** Le donjon de ce lieu, quand aucune quête ne s'en occupe : ses portes vont dans la fenêtre du lieu. */
export const entreesDonjonLibre = (p: Partie, ou: string) => {
  const { donjonLibre } = quetesDuLieu(p, ou);
  return donjonLibre ? boutonsEntree(p, donjonLibre) : '';
};

const PARCHEMINS = [imgP1, imgP2, imgP4, imgP3];

/** Le tableau d'affichage : un parchemin épinglé par quête (nom au survol), vide s'il n'y a rien. */
export const tableauQuetes = (p: Partie, ou: string): string => {
  const { refus } = quetesDuLieu(p, ou);
  const parchemins = epingles(p, ou)
    .map(({ q, etat }, i) => {
      const titre = `${q.titre}${etat === 'en-cours' ? ' (en cours)' : etat === 'a-rendre' ? ' (accomplie, à rendre)' : ''}`;
      const signe =
        etat === 'nouvelle'
          ? `<img class="signe signe-nouvelle" src="${imgExclamation}" alt="" />`
          : etat === 'en-cours'
            ? `<img class="signe signe-tampon" src="${imgTampon}" alt="" />`
            : `<img class="signe signe-coche" src="${imgCoche}" alt="" />`;
      return `<button class="parchemin ${etat}" style="--r:${[-6, 4, -2, 7, -4, 3][i % 6]}deg;background-image:url(${PARCHEMINS[i % PARCHEMINS.length]})" data-ouvrir-quete="${q.id}" title="${echapper(titre)}" aria-label="${echapper(titre)}">${signe}</button>`;
    })
    .join('');
  return `<div class="tableau-quetes" style="background-image:url(${imgPanneau})">
    <div class="liege">${parchemins || '<p class="vide">Rien d\'épinglé pour le moment.</p>'}</div>
    <p class="legende-tableau">📜 Tableau d'affichage${refus ? ' · <span class="note">ta réputation fait fuir les donneurs de quêtes</span>' : ''}</p>
  </div>`;
};

type EtatEpingle = 'nouvelle' | 'en-cours' | 'a-rendre';

/**
 * Ce qui est épinglé au tableau : les quêtes proposées ici, celles qu'on a prises ici (en cours, ou accomplies
 * et à rendre : il ne reste que la dernière étape, ici), et celles dont une étape se joue ici. Rendues : décrochées.
 */
const epingles = (p: Partie, ou: string): { q: Quete; etat: EtatEpingle }[] => {
  const { proposees, ici } = quetesDuLieu(p, ou);
  const etatDe = (q: Quete): EtatEpingle => {
    const i = etapeEnCours(p, q.id);
    return i === q.etapes.length - 1 && q.etapes[i].ou === ou && q.etapes.length > 1 ? 'a-rendre' : 'en-cours';
  };
  const prises = QUETES.filter((q) => p.quetes[q.id] === 'acceptee' && (q.donneur === ou || ici.some((x) => x.quete.id === q.id)));
  return [...proposees.map((q) => ({ q, etat: 'nouvelle' as const })), ...prises.map((q) => ({ q, etat: etatDe(q) }))];
};

/** Le détail d'une quête du tableau, pour la fenêtre qui s'ouvre au clic sur son parchemin. */
export const detailQuete = (p: Partie, ou: string, id: string, epreuveEnCours?: string): string => {
  const { proposees, ici } = quetesDuLieu(p, ou);
  const q = proposees.find((x) => x.id === id);
  if (q) return carteProposee(p, q);
  const e = ici.find((x) => x.quete.id === id);
  if (e) return carteEtape(p, e.quete, e.etape, epreuveEnCours);
  // Prise ici, mais l'étape du moment se joue ailleurs : le rappel de ce qu'il reste à faire.
  const prise = QUETES.find((x) => x.id === id && p.quetes[x.id] === 'acceptee');
  if (!prise) return '';
  const i = etapeEnCours(p, id);
  return `<div class="detail-choix quete en-cours">
          <h3>${echapper(prise.titre)} <img class="tampon-detail" src="${imgTampon}" alt="En cours" /></h3>
          <p class="note">${echapper(prise.qui)} · étape ${i + 1}/${prise.etapes.length}</p>
          <p>➤ ${echapper(prise.etapes[i].objectif)}</p>
          <p class="note">Récompense : ${echapper(prise.recompense.texte)}${prise.recompense.xp ? `, ${prise.recompense.xp} XP` : ''}.</p>
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
