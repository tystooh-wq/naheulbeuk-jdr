import { CREATURES, FICHES, type Creature } from '../rules/bestiaire';
import { toutesCompetences } from '../rules/creation';
import { METIERS } from '../rules/metiers';
import { formatMods, OBJETS, type Objet } from '../rules/objets';
import { ORIGINES } from '../rules/origines';
import { trajet, longueur } from '../rules/rues';
import { CARACS, type Criteres } from '../rules/types';
import { LIEUX } from '../rules/waldorg';
import { itineraire, LIEUX_MONDE } from '../rules/monde';
import { TABLE_TERRES_SAUVAGES } from '../rules/rencontres';
import { competence, echapper, liste } from './outils';

// Encyclopédie de debug : toutes les données du jeu, consultables à tout moment, en marge de la partie.

type Rubrique = 'objets' | 'bestiaire' | 'rencontres' | 'origines' | 'metiers' | 'competences' | 'lieux';

const RUBRIQUES: [Rubrique, string][] = [
  ['objets', 'Objets'],
  ['bestiaire', 'Bestiaire'],
  ['rencontres', 'Rencontres'],
  ['origines', 'Origines'],
  ['metiers', 'Métiers'],
  ['competences', 'Compétences'],
  ['lieux', 'Lieux'],
];

const TYPES_OBJET: [Objet['type'], string][] = [
  ['arme', 'Armes'],
  ['armure', 'Armures'],
  ['potion', 'Potions'],
  ['materiel', 'Matériel'],
];

/** Recherche sans accents ni majuscules. */
const simplifier = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const criteres = (c: Criteres) =>
  CARACS.filter((k) => c[k])
    .map((k) => `${k} ${c[k]!.min ? `≥ ${c[k]!.min}` : ''}${c[k]!.min && c[k]!.max ? ' et ' : ''}${c[k]!.max ? `≤ ${c[k]!.max}` : ''}`)
    .join(', ') || 'aucun';

const vendeurs = (id: string) => LIEUX.filter((l) => l.boutique?.stock.includes(id)).map((l) => l.nom);

const ligneObjet = (o: Objet) => {
  const effets = [
    o.degats ? `Dégâts ${o.degats}` : '',
    o.pr ? `PR ${o.pr}` : '',
    o.soin ? `Rend ${o.soin} PV` : '',
    o.mains ? `${o.mains} main${o.mains > 1 ? 's' : ''}` : '',
    o.bourrin ? 'arme de bourrin' : '',
    o.legere ? 'légère (mages, ménestrels)' : '',
    formatMods(o.mods),
  ].filter(Boolean);
  const v = vendeurs(o.id);
  return {
    texte: `${o.nom} ${o.description} ${effets.join(' ')} ${v.join(' ')}`,
    html: `<details class="ency-ligne">
      <summary><b>${echapper(o.nom)}</b>${o.estime ? ' <span class="pastille">(estimé)</span>' : ''}<span class="ency-chiffres">${o.prix} PO</span></summary>
      <p>${echapper(o.description)}</p>
      <p class="note">${echapper(effets.join(' · ') || 'Aucun effet de jeu.')}</p>
      <p class="note">En vente : ${v.length ? echapper(v.join(', ')) : 'nulle part à Waldorg'} · identifiant <code>${o.id}</code></p>
    </details>`,
  };
};

const ligneCreature = (c: Creature) => ({
  texte: `${c.nom} ${c.famille} ${c.notes.join(' ')} ${c.fiche ? FICHES[c.fiche] : ''}`,
  html: `<details class="ency-ligne">
    <summary><b>${echapper(c.nom)}</b><span class="ency-chiffres">AT ${echapper(c.at)} · PRD ${echapper(c.prd)} · EV ${echapper(c.ev)} · PR ${echapper(c.pr)} · ${echapper(c.degats)} · COU ${echapper(c.cou)} · XP ${echapper(c.xp)}</span></summary>
    ${c.notes.length ? `<p class="note">${echapper(c.notes.join(' · '))}</p>` : ''}
    ${c.fiche ? `<p><i>${echapper(c.fiche)} :</i> ${echapper(FICHES[c.fiche])}</p>` : '<p class="note">Pas de fiche dans le guide succinct.</p>'}
  </details>`,
});

/** Regroupe des lignes sous des titres, en ne gardant que celles qui correspondent à la recherche. */
const groupes = (entrees: [string, { texte: string; html: string }[]][], q: string) => {
  let total = 0;
  const html = entrees
    .map(([titre, lignes]) => {
      const gardees = lignes.filter((l) => !q || simplifier(`${titre} ${l.texte}`).includes(q));
      total += gardees.length;
      return gardees.length ? `<h3>${echapper(titre)} <span class="note">(${gardees.length})</span></h3>${gardees.map((l) => l.html).join('')}` : '';
    })
    .join('');
  return total ? html : '<p class="note">Rien ne correspond à cette recherche.</p>';
};

const contenu = (r: Rubrique, q: string): string => {
  switch (r) {
    case 'objets':
      return groupes(
        TYPES_OBJET.map(([type, titre]) => [titre, OBJETS.filter((o) => o.type === type).map(ligneObjet)]),
        q,
      );
    case 'bestiaire': {
      const parGroupe = new Map<string, Creature[]>();
      for (const c of CREATURES) {
        const cle = `${c.niveau} · ${c.famille}`;
        parGroupe.set(cle, [...(parGroupe.get(cle) ?? []), c]);
      }
      return `<p class="note">${CREATURES.length} créatures des tableaux de rencontres officiels. Fiches descriptives : guide des monstres succinct.</p>${groupes(
        [...parGroupe].map(([titre, cs]) => [titre, cs.map(ligneCreature)]),
        q,
      )}`;
    }
    case 'rencontres':
      return `<p class="note">Table « Rencontres en terre sauvage 1 » (D20). Sur la carte du monde, « Provoquer » fait surgir la rencontre pour tester un combat.</p>${groupes(
        [
          [
            'Terres sauvages',
            TABLE_TERRES_SAUVAGES.map((l) => ({
              texte: `${l.rencontre} ${l.notes}`,
              html: `<div class="ency-ligne ency-rencontre"><span><b>${l.d20}.</b> ${echapper(l.rencontre)}<span class="ency-chiffres">AT ${l.at} · PRD ${l.prd} · EV ${l.ev} · PR ${l.pr} · ${echapper(l.degats)} · COU ${l.cou} · ${l.xp} XP</span>${
                l.notes ? `<br><span class="note">${echapper(l.notes)}</span>` : ''
              }</span><button class="secondaire petit" data-provoquer="${l.d20}">Provoquer</button></div>`,
            })),
          ],
        ],
        q,
      )}`;
    case 'origines':
      return groupes(
        [
          [
            'Origines',
            ORIGINES.map((o) => ({
              texte: `${o.nom} ${o.surnom} ${o.description} ${o.restrictions.join(' ')} ${o.naissance.join(' ')}`,
              html: `<details class="ency-ligne">
                <summary><b>${echapper(o.nom)}</b> <i class="note">${echapper(o.surnom)}</i><span class="ency-chiffres">EV ${o.ev}${o.atPrd ? ` · AT/PRD ${o.atPrd.join('/')}` : ''} · PR max ${o.prMax ?? '–'}</span></summary>
                <p>${echapper(o.description)}</p>
                <p class="note">Critères : ${echapper(criteres(o.criteres))} · charge ${echapper(o.charge)}${o.sansMagie ? ' · pas de magie' : ''}</p>
                <b>Compétences de naissance</b>${liste(o.naissance)}
                <b>Restrictions</b>${liste(o.restrictions)}
              </details>`,
            })),
          ],
        ],
        q,
      );
    case 'metiers':
      return groupes(
        [
          [
            'Métiers',
            METIERS.map((m) => ({
              texte: `${m.nom} ${m.description} ${m.bonus.join(' ')} ${m.restrictions.join(' ')} ${m.heritees.join(' ')}`,
              html: `<details class="ency-ligne">
                <summary><b>${echapper(m.nom)}</b><span class="ency-chiffres">${echapper(m.evTexte)}${m.ea ? ` · EA ${m.ea}` : ''}${m.atPrd ? ` · AT/PRD ${m.atPrd.join('/')}` : ''}</span></summary>
                <p>${echapper(m.description)}</p>
                <p class="note">Critères : ${echapper(criteres(m.criteres))}</p>
                <b>Compétences héritées</b>${liste(m.heritees)}
                <b>Bonus</b>${liste(m.bonus)}
                <b>Restrictions</b>${liste(m.restrictions)}
              </details>`,
            })),
          ],
        ],
        q,
      );
    case 'competences':
      return groupes([['Compétences', toutesCompetences().map((n) => ({ texte: n, html: competence(n) }))]], q);
    case 'lieux':
      return groupes(
        [
          [
            'Waldorg',
            LIEUX.map((l) => {
              const distances = LIEUX.filter((x) => x.id !== l.id)
                .map((x) => `${x.nom} ${Math.round(longueur(trajet(l, x)))}`)
                .join(' · ');
              return {
                texte: `${l.nom} ${l.quartier} ${l.description}`,
                html: `<details class="ency-ligne">
                  <summary><b>${echapper(l.nom)}</b><span class="ency-chiffres">${echapper(l.quartier)} · x ${l.x} · y ${l.y}</span></summary>
                  <p>${echapper(l.description)}</p>
                  ${l.boutique ? `<p class="note">Stock : ${echapper(l.boutique.stock.join(', '))}</p>` : ''}
                  <p class="note">Longueur des trajets à pied (en % de la largeur du plan) : ${echapper(distances)}</p>
                </details>`,
              };
            }),
          ],
          [
            'Terre de Fangh',
            LIEUX_MONDE.map((l) => {
              const it = l.id === 'waldorg' ? null : itineraire('waldorg', l.id);
              return {
                texte: `${l.nom} ${l.description}`,
                html: `<details class="ency-ligne">
                  <summary><b>${echapper(l.nom)}</b><span class="ency-chiffres">${it ? `${Math.round(it.km)} km de Waldorg · ${it.heures.toFixed(1)} h` : 'départ'}</span></summary>
                  <p>${echapper(l.description)}</p>
                  ${l.auberge ? `<p class="note">${echapper(l.auberge.nom)} : repas ${l.auberge.repas} PO, chambre ${l.auberge.chambre} PO (${l.auberge.confort})</p>` : ''}
                  ${it ? `<p class="note">Par ${echapper(it.etapes.join(' → '))}</p>` : ''}
                </details>`,
              };
            }),
          ],
        ],
        q,
      );
  }
};

/** Demande à la carte du monde de faire surgir une rencontre de la table (numéro du D20). */
export const EVENEMENT_PROVOQUER = 'naheulbeuk:provoquer';

/** Ajoute le bouton « Encyclopédie » en marge de la page, et sa fenêtre. */
export const installerEncyclopedie = () => {
  let rubrique: Rubrique = 'objets';
  let recherche = '';

  const bouton = document.createElement('button');
  bouton.className = 'bouton-ency secondaire petit';
  bouton.innerHTML = '📖 Encyclopédie <span class="pastille">debug</span>';
  const fenetre = document.createElement('div');
  fenetre.className = 'ency';
  fenetre.hidden = true;
  fenetre.setAttribute('role', 'dialog');
  fenetre.setAttribute('aria-label', 'Encyclopédie');
  document.body.append(bouton, fenetre);

  const resultats = () => contenu(rubrique, simplifier(recherche.trim()));

  const afficher = () => {
    fenetre.innerHTML = `<div class="page ency-page">
      <div class="barre-fermer"><button class="secondaire petit fermer" id="ency-fermer" aria-label="Fermer l'encyclopédie">✕</button></div>
      <h2>Encyclopédie</h2>
      <p class="note">Outil de debug : toutes les données chargées dans le jeu.</p>
      <div class="onglets">${RUBRIQUES.map(([r, nom]) => `<button class="secondaire petit ${r === rubrique ? 'actif' : ''}" data-rubrique="${r}">${nom}</button>`).join('')}</div>
      <input type="search" id="ency-recherche" placeholder="Rechercher…" value="${echapper(recherche)}" aria-label="Rechercher dans l'encyclopédie" />
      <div id="ency-resultats">${resultats()}</div>
    </div>`;
    fenetre.querySelector('#ency-fermer')!.addEventListener('click', fermer);
    fenetre.querySelectorAll<HTMLElement>('[data-rubrique]').forEach((b) =>
      b.addEventListener('click', () => {
        rubrique = b.dataset.rubrique as Rubrique;
        afficher();
      }),
    );
    const champ = fenetre.querySelector<HTMLInputElement>('#ency-recherche')!;
    champ.addEventListener('input', () => {
      recherche = champ.value;
      fenetre.querySelector('#ency-resultats')!.innerHTML = resultats();
    });
  };

  const fermer = () => {
    fenetre.hidden = true;
    document.body.classList.remove('ency-ouverte');
    bouton.focus();
  };

  bouton.addEventListener('click', () => {
    if (!fenetre.hidden) return fermer();
    afficher();
    fenetre.hidden = false;
    document.body.classList.add('ency-ouverte');
    fenetre.querySelector<HTMLInputElement>('#ency-recherche')!.focus();
  });
  fenetre.addEventListener('click', (e) => {
    if (e.target === fenetre) return fermer();
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-provoquer]');
    if (!b) return;
    fermer();
    window.dispatchEvent(new CustomEvent(EVENEMENT_PROVOQUER, { detail: Number(b.dataset.provoquer) }));
  });
  document.addEventListener('keydown', (e) => e.key === 'Escape' && !fenetre.hidden && fermer());
};
