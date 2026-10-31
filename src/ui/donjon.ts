import { eaMax } from '../rules/magie';
import { avecDe, lancer, type Rng } from '../rules/des';
import {
  accessibles,
  affronterPiege,
  valeurPiege,
  ambiance,
  avancer,
  bloquee,
  chercher,
  clesManquantes,
  coffreOuvert,
  combatSalle,
  contenuIci,
  donjon,
  forcerSerrure,
  fouiller,
  niveauDe,
  ouvrirAvecCle,
  peutFouiller,
  porteEntre,
  portesAutour,
  purger,
  quitterDonjon,
  regler,
  repeuplement,
  repondreSerrure,
  salle,
  seReposer,
  termine,
  trouvee,
  valeurCrochetage,
  valeurForce,
  type Cible,
  type Contenu,
  type Donjon,
  type EtatDonjon,
  type Serrure,
} from '../rules/donjons';
import {
  apresVictoire,
  BUREAU_GEOLIERS,
  capturer,
  croupir,
  ENIGMES,
  evader,
  evasionPossible,
  hautFait,
  HAUTS_FAITS,
  ID_DDN,
  indiceEnigme,
  marquer,
  piegeDesamorce,
  recupererAffaires,
  valeurEvasion,
  verifierHautsFaits,
  type Evasion,
} from '../rules/ddn';
import type { Evenement, Resultat } from '../rules/evenements';
import { formatOr } from '../rules/monnaie';
import { dateLongue } from '../rules/calendrier';
import { ajouterButin } from '../rules/compagnons';
import { objet } from '../rules/objets';
import { acheter, formatHeure, noter, passerTemps, soigner, type Partie } from '../rules/partie';
import { donjonTermine, progresserQuetes } from '../rules/quetes';
import type { LigneRencontre, Rencontre } from '../rules/rencontres';
import { bandeau, lierSac, lierVitesse, panneauGroupe, panneauJournal, panneauSac } from './commun';
import { ecranCombat, type BilanCombat } from './combat';
import { boutonAutrement, lierIdeesLieu, panneauIdeesLieu } from './idees';
import { animerDes, de, echapper } from './outils';
import { lierQuetes, panneauJournalQuetes, panneauQuetes } from './quetes';
import { sauvegarderPartie } from './sauvegarde';
import { ecranMort } from './mort';
import { aTalent, bonusSituation, texteBonus } from '../rules/talents';
import planN0 from '../assets/ddn/n0.jpg';
import planCave from '../assets/ddn/cave.jpg';
import planSout from '../assets/ddn/souterrains.jpg';
import planN1 from '../assets/ddn/n1.jpg';
import planN2 from '../assets/ddn/n2.jpg';
import planN3 from '../assets/ddn/n3.jpg';
import planN4 from '../assets/ddn/n4.jpg';
import planN5 from '../assets/ddn/n5.jpg';
import planN6 from '../assets/ddn/n6.jpg';

// L'écran d'un donjon. Les petits donjons s'affichent en mini-carte (façon Darkest Dungeon) ;
// le Donjon de Naheulbeuk s'affiche sur ses plans officiels, étage par étage, avec ses portes,
// ses serrures, ses énigmes, ses gens (scènes), sa taverne, ses boutiques et ses cachots.

export interface SortiesDonjon {
  /** Ressortir par l'entrée (ou être tiré dehors). */
  sortir: (texte?: string) => void;
  ouvrirFiche: () => void;
  finDePartie: () => void;
}

const CASE = 92;

const NOM_CARAC = { COU: 'Courage', INT: 'Intelligence', CHA: 'Charisme', AD: 'Adresse', FO: 'Force' };

const PLANS: Record<string, string> = { n0: planN0, cave: planCave, sout: planSout, n1: planN1, n2: planN2, n3: planN3, n4: planN4, n5: planN5, n6: planN6 };

/** L'icône d'une salle déjà vue, selon ce qu'elle contient en ce moment. */
const icone = (d: Donjon, e: EtatDonjon, id: string, p: Partie) => {
  const s = salle(d, id);
  const { contenu: c, cle } = contenuIci(s, p);
  const fait = e.reglees.includes(cle);
  if (id === d.finale) return '♛';
  if (c?.type === 'combat') return fait ? '✝' : '⚔';
  if (c?.type === 'piege') return fait ? '·' : '⚠';
  if (c?.type === 'repos') return '♨';
  if (c?.type === 'taverne') return '🍺';
  if (c?.type === 'boutique') return '🛒';
  if (c?.type === 'scene' && (!fait || c.permanente)) return '☺';
  if (s.sortie || id === d.entree) return '⇲';
  return '·';
};

const miniCarte = (d: Donjon, e: EtatDonjon, p: Partie) => {
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
  for (const id of e.vues) for (const v of salle(d, id).vers) couloirs.add([id, v].sort().join('|'));
  const ouvertes = accessibles(e, d, p);
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
        const etat = !vue ? 'inconnue' : s.id === e.salle ? 'ici' : bloquee(e, s, p) ? 'danger' : 'videe';
        const peut = ouvertes.includes(s.id);
        return `<button class="salle salle-${etat} ${peut ? 'ouverte' : ''}" style="left:${s.x * CASE + 8}px;top:${s.y * CASE + 8}px;width:${CASE - 16}px;height:${CASE - 16}px"
          ${peut ? `data-aller="${s.id}"` : 'disabled'} aria-label="${vue ? echapper(s.nom) : 'Salle inconnue'}">
          <span>${vue ? icone(d, e, s.id, p) : '?'}</span><em>${vue ? echapper(s.nom) : '???'}</em>
        </button>`;
      })
      .join('')}
  </div>`;
};

/** Un étage sur son plan officiel : les salles vues, les couloirs connus, le héros, les salles où l'on peut aller. */
const planEtage = (d: Donjon, e: EtatDonjon, p: Partie, niveau: string) => {
  const ici = (id: string) => salle(d, id).niveau === niveau;
  const vues = e.vues.filter(ici);
  // Les salles voisines déjà devinées (pas derrière un passage secret qu'on n'a pas trouvé).
  const devinees = new Set<string>();
  for (const id of vues)
    for (const v of salle(d, id).vers) {
      const porte = porteEntre(d, id, v) ?? porteEntre(d, v, id);
      if (ici(v) && !e.vues.includes(v) && (!porte?.cachee || trouvee(e, id, v))) devinees.add(v);
    }
  const couloirs = new Set<string>();
  for (const id of vues) for (const v of salle(d, id).vers) if (ici(v) && (e.vues.includes(v) || devinees.has(v))) couloirs.add([id, v].sort().join('|'));
  const ouvertes = accessibles(e, d, p);
  const pos = (id: string) => salle(d, id);
  return `<div class="plan-donjon">
    <img src="${PLANS[niveau]}" alt="Plan : ${echapper(d.niveaux!.find((n) => n.id === niveau)!.nom)}" />
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      ${[...couloirs]
        .map((c) => {
          const [a, b] = c.split('|');
          return `<line x1="${pos(a).px}" y1="${pos(a).py}" x2="${pos(b).px}" y2="${pos(b).py}" />`;
        })
        .join('')}
    </svg>
    ${[...vues, ...devinees]
      .map((id) => {
        const s = salle(d, id);
        const vue = e.vues.includes(id);
        const etat = !vue ? 'inconnue' : id === e.salle ? 'ici' : bloquee(e, s, p) ? 'danger' : 'videe';
        const peut = ouvertes.includes(id);
        return `<button class="repere-salle salle-${etat} ${peut ? 'ouverte' : ''}" style="left:${s.px}%;top:${s.py}%" ${peut ? `data-aller="${id}"` : 'disabled'}
          title="${vue ? echapper(s.nom) : 'Salle inconnue'}" aria-label="${vue ? echapper(s.nom) : 'Salle inconnue'}">${id === e.salle ? '🧍' : vue ? icone(d, e, id, p) : '?'}</button>`;
      })
      .join('')}
  </div>`;
};

type SceneEnCours = { ev: Evenement; cle: string; resultat?: Resultat; choix?: number };
type DeEnCours =
  | { type: 'serrure'; cible: Cible; facon: 'crocheter' | 'enfoncer' }
  | { type: 'chercher' }
  | { type: 'evasion'; facon: Evasion }
  | { type: 'scene' };

const cibleDe = (v: string): Cible => (v === 'coffre' ? { coffre: true } : { porte: v });

export const ecranDonjon = (app: HTMLElement, p: Partie, s: SortiesDonjon) => {
  let vue: 'lieu' | 'sac' | 'groupe' | 'journal' | 'quetes' = 'lieu';
  let message: string | undefined;
  /** Épreuve de piège en cours : passer, ou désamorcer (compétence Désamorcer). */
  let piegeEnCours: false | 'passer' | 'desamorcer' = false;
  let scene: SceneEnCours | undefined;
  let deEnCours: DeEnCours | undefined;
  let epreuveQuete: string | undefined;
  /** L'étage affiché sur le plan (par défaut, celui où l'on est). */
  let etageVu: string | undefined;
  const d = () => donjon(p.donjon!.id);
  const ddn = () => p.donjon?.id === ID_DDN;
  const sauver = () => sauvegarderPartie(p);
  const ou = () => `donjon:${d().id}:${p.donjon!.salle}`;

  /** Ce que la partie a débloqué d'elle-même (étapes de quêtes, hauts faits). */
  const nouvelles = () => [...progresserQuetes(p), ...verifierHautsFaits(p)].map((t) => `<p>${echapper(t)}</p>`).join('');

  // --- Les morceaux du panneau de la salle ---------------------------------------------------------

  const ligneEnnemis = (c: Extract<Contenu, { type: 'combat' }>) =>
    c.ennemis
      .map((x) => {
        const n = x.nombre + (x.parCompagnon ?? 0) * (p.compagnons?.length ?? 0);
        return `${n > 1 ? `${n} × ` : ''}${x.ligne.nom} (AT ${x.ligne.at}, PRD ${x.ligne.prd}, EV ${x.ligne.ev}, PR ${x.ligne.pr}, dégâts ${x.ligne.degats})`;
      })
      .join(', ');

  const lancerDe = (faces: number, libelle: string, valeur?: number) =>
    `<div class="recit lancer-joueur">${libelle}${valeur !== undefined ? ` : il faut faire <b>${valeur} ou moins</b>` : ''}.
      <div>${de('?', 'a-lancer" id="de-donjon')}<button id="lancer-donjon" data-faces="${faces}">Lancer le D${faces}</button></div></div>`;

  const panneauScene = (sc: SceneEnCours) => {
    const ev = sc.ev;
    let corps = `<h3>${echapper(ev.titre)}</h3><p>${echapper(ev.texte)}</p>`;
    if (sc.resultat) {
      corps += `<div class="recit">${echapper(sc.resultat.texte)}</div><p class="actions-lieu">${
        sc.resultat.combat ? '<button id="combat-scene">⚔ Combattre</button>' : '<button id="suite-scene">Continuer</button>'
      }</p>`;
    } else if (sc.choix !== undefined) {
      const c = ev.choix[sc.choix];
      corps += lancerDe(c.jet!.faces, `${echapper(c.libelle)}. Lance le D${c.jet!.faces} pour ${echapper(c.jet!.pour)}`, c.jet!.valeur?.(p));
    } else {
      corps += `<p class="actions-lieu">${ev.choix
        .map((c, i) => {
          if (c.visible && !c.visible(p)) return '';
          const refus = c.possible?.(p) ?? null;
          const val = c.jet?.valeur?.(p);
          return `<button data-choix-scene="${i}" ${refus ? `disabled title="${echapper(refus)}"` : ''}>${echapper(c.libelle)}${val !== undefined ? ` <small>(${val} ou moins)</small>` : ''}</button>`;
        })
        .join('')}</p>${ev.choix.some((c) => (!c.visible || c.visible(p)) && c.possible?.(p)) ? `<p class="note">${ev.choix
        .filter((c) => (!c.visible || c.visible(p)) && c.possible?.(p))
        .map((c) => `${echapper(c.libelle)} : ${echapper(c.possible!(p)!)}`)
        .join('<br />')}</p>` : ''}`;
    }
    return `<div class="detail-choix scene-donjon">${corps}</div>`;
  };

  const panneauTaverne = (c: Extract<Contenu, { type: 'taverne' }>) => `<div class="detail-choix">
      <p>${echapper(c.texte)}</p>
      <p class="actions-lieu">
        <button id="chope" ${p.or < c.chope ? 'disabled' : ''}>🍺 Une chope et les ragots (${formatOr(c.chope)})</button>
        <button id="repas" ${p.or < c.repas ? 'disabled' : ''}>🍲 Un repas chaud (${formatOr(c.repas)}, 1 h, +3 PV)</button>
      </p>
    </div>`;

  const panneauBoutique = (c: Extract<Contenu, { type: 'boutique' }>) => `<div class="detail-choix">
      <h3>${echapper(c.nom)}</h3>
      <p>${echapper(c.texte)}</p>
      <ul class="stock-donjon">${[...new Set(c.stock)]
        .map((id) => {
          const o = objet(id);
          return `<li><span>${echapper(o.nom)}</span> <button class="secondaire" data-acheter="${id}" ${p.or < o.prix ? 'disabled' : ''}>${formatOr(o.prix)}</button></li>`;
        })
        .join('')}</ul>
      ${c.ragots ? `<p><button class="secondaire" id="ragots" ${p.or < c.ragots.prix ? 'disabled' : ''}>🤫 Payer pour un ragot (${formatOr(c.ragots.prix)})</button></p>` : ''}
    </div>`;

  /** Une serrure : la clé, le crochetage, la force, ou l'énigme. */
  const panneauSerrure = (sr: Serrure, cible: string, titre: string) => {
    const cle = sr.cle !== undefined;
    const manque = cle ? clesManquantes(p, sr) : [];
    const enigme = sr.enigme !== undefined ? ENIGMES[sr.enigme] : undefined;
    const boutons = [
      cle ? `<button data-cle="${cible}" ${manque.length ? `disabled title="Il te manque : ${echapper(manque.map((x) => objet(x).nom).join(', '))}"` : ''}>🗝 Ouvrir avec la clé</button>` : '',
      sr.crochetage !== undefined ? `<button class="secondaire" data-crocheter="${cible}">🔧 Crocheter (Adresse, ${valeurCrochetage(p, sr)} ou moins)</button>` : '',
      sr.force !== undefined ? `<button class="secondaire" data-enfoncer="${cible}">💪 Enfoncer (Force, ${valeurForce(p, sr)} ou moins)</button>` : '',
    ].join('');
    return `<div class="porte-donjon">
      <p><b>${titre}</b> ${echapper(sr.texte)}.${sr.piege ? ' <span class="note">(La serrure a l\'air piégée.)</span>' : ''}${cle && manque.length ? ` <span class="note">Il faudrait : ${echapper(manque.map((x) => objet(x).nom).join(' et '))}.</span>` : ''}</p>
      ${
        enigme
          ? `<div class="enigme"><p>Une inscription : <i>« ${echapper(enigme.texte)} »</i></p>
              <form data-enigme="${cible}" class="actions-lieu"><input name="reponse" autocomplete="off" placeholder="Ta réponse…" /><button>Répondre</button></form>
              ${indiceEnigme(p, sr.enigme!) ? `<p class="note">💡 Tu connais la réponse : ${echapper(enigme.solution)}</p>` : ''}</div>`
          : ''
      }
      ${boutons ? `<p class="actions-lieu">${boutons}</p>` : ''}
    </div>`;
  };

  const panneauPrison = () => {
    const e = p.donjon!;
    const facons: [Evasion, string][] = [
      ['serrure', 'Crocheter la serrure avec ta cuillère (Adresse)'],
      ['barreaux', 'Tordre les barreaux (Force)'],
      ['gerard', 'Parler à Gérard quand il passe, pinté (Charisme)'],
    ];
    const jours = p.jour - (e.capture ?? p.jour);
    return `<div class="detail-choix prison">
      <h3>⛓ Au cachot ${jours ? `(depuis ${jours} jour${jours > 1 ? 's' : ''})` : ''}</h3>
      <p>Une cellule humide, une couchette en bois, un trou dans le sol. Tes affaires sont au bureau des geôliers, de l'autre côté du couloir. Il est ${formatHeure(p.heure)}.</p>
      ${
        deEnCours?.type === 'evasion'
          ? lancerDe(20, facons.find((f) => f[0] === (deEnCours as { facon: Evasion }).facon)![1], valeurEvasion(p, deEnCours.facon))
          : `<p class="actions-lieu">${facons
              .map(([f, l]) => {
                const refus = evasionPossible(p, f);
                return `<button data-evasion="${f}" ${refus ? `disabled title="${echapper(refus)}"` : ''}>${l} <small>(${valeurEvasion(p, f)} ou moins)</small></button>`;
              })
              .join('')}
              <button class="secondaire" id="croupir">Attendre le lendemain</button>
              <button class="secondaire" id="attendre-soir">Attendre le soir</button></p>
              <p class="note">${facons
                .map(([f]) => evasionPossible(p, f))
                .filter(Boolean)
                .map((t) => echapper(t!))
                .join('<br />')}</p>`
      }
    </div>`;
  };

  const panneauSalle = () => {
    const e = p.donjon!;
    const dj = d();
    const sa = salle(dj, e.salle);
    const { contenu: c, cle, description } = contenuIci(sa, p);
    const regle = e.reglees.includes(cle);
    const bloque = bloquee(e, sa, p);
    const entete = `<h2>${echapper(sa.nom)}</h2>
      ${dj.niveaux ? `<p class="note">${echapper(niveauDe(dj, sa.id)?.nom ?? '')} · ${formatHeure(p.heure)}</p>` : ''}
      <p>${echapper(sa.description)}</p>
      ${description ? `<p><i>${echapper(description)}</i></p>` : ''}
      ${message ? `<div class="recit">${message}</div>` : ''}`;
    if (e.prisonnier) return `<div class="panneau salle-donjon">${entete}${panneauPrison()}</div>`;

    let action = '';
    if (c?.type === 'combat' && !regle) {
      action = `<div class="recit">${echapper(c.texte)}</div><p class="pastille">${echapper(ligneEnnemis(c))}</p>
        <p class="actions-lieu"><button id="combattre">⚔ Combattre</button>${e.precedente ? '<button class="secondaire" id="reculer">Reculer dans la salle précédente</button>' : ''}</p>`;
    } else if (c?.type === 'piege' && !regle) {
      const desamorcer = piegeEnCours === 'desamorcer';
      const bonus = bonusSituation(p, desamorcer ? 'desamorcer' : 'piege');
      action = piegeEnCours
        ? `<div class="recit lancer-joueur">${echapper(c.texte)} ${desamorcer ? 'Désamorcer : épreuve d\'Adresse' : `Épreuve d'${NOM_CARAC[c.carac]}`}${echapper(texteBonus(bonus))} : il faut faire <b>${valeurPiege(p, c, desamorcer)} ou moins</b> sur le D20 (sinon ${echapper(c.degats)} dégâts).
            <div>${de('?', 'a-lancer" id="de-piege')}<button id="lancer-piege">Lancer le D20</button></div></div>`
        : `<div class="recit">⚠ ${echapper(c.texte)}</div><p class="actions-lieu"><button id="piege">Tenter de passer (${valeurPiege(p, c)} ou moins${echapper(texteBonus(bonusSituation(p, 'piege')))})</button>${
            aTalent(p, 'Désamorcer') ? `<button class="secondaire" id="desamorcer">🔧 Désamorcer (Adresse ${valeurPiege(p, c, true)}, compétence)</button>` : ''
          }${e.precedente ? '<button class="secondaire" id="reculer">Reculer</button>' : ''}</p>`;
    } else if (c?.type === 'repos' && !regle) {
      action = `<p><button id="repos">♨ Faire une pause (${c.pv} PV${c.pa && eaMax(p) ? `, ${c.pa} PA` : ''}, ${c.heures ? `${c.heures} h` : '30 minutes'})</button></p>`;
    } else if (c?.type === 'scene' && (!regle || c.permanente)) {
      if (!scene || scene.cle !== cle) scene = { ev: c.scene, cle };
      action = panneauScene(scene);
    } else if (c?.type === 'taverne') action = panneauTaverne(c);
    else if (c?.type === 'boutique') action = panneauBoutique(c);

    // Portes fermées et coffre verrouillé.
    let serrures = '';
    if (!bloque) {
      serrures = portesAutour(e, dj, p)
        .map(({ vers, porte }) => panneauSerrure(porte, vers, `🚪 Vers ${e.vues.includes(vers) ? echapper(salle(dj, vers).nom) : 'une salle inconnue'} :`))
        .join('');
      const t = sa.tresor;
      if (t?.serrure && !coffreOuvert(e, sa.id) && !e.fouillees.includes(sa.id) && (!t.cachee || e.ouvertes?.includes(`vu:coffre:${sa.id}`)))
        serrures += panneauSerrure(t.serrure, 'coffre', '🧰 Un coffre :');
    }
    if (deEnCours?.type === 'serrure') {
      const sr = deEnCours.cible && ('porte' in deEnCours.cible ? porteEntre(dj, sa.id, deEnCours.cible.porte) : sa.tresor?.serrure);
      if (sr)
        serrures += lancerDe(
          20,
          deEnCours.facon === 'crocheter' ? 'Crocheter : épreuve d\'Adresse' : 'Enfoncer : épreuve de Force',
          deEnCours.facon === 'crocheter' ? valeurCrochetage(p, sr) : valeurForce(p, sr),
        );
    }
    const recherche =
      !bloque && dj.niveaux
        ? deEnCours?.type === 'chercher'
          ? lancerDe(20, 'Chercher des passages secrets et des cachettes : épreuve d\'Intelligence (ou celle de chaque cachette)')
          : '<button class="secondaire" id="chercher">🔍 Chercher des passages secrets (10 min)</button>'
        : '';
    const fouille = peutFouiller(e, sa, p) ? '<button class="secondaire" id="fouiller">Fouiller la salle</button>' : '';
    const affaires = !bloque && sa.id === BUREAU_GEOLIERS && e.confisque ? '<button id="affaires">🎒 Récupérer tes affaires</button>' : '';

    // Une scène qui tourne à la bagarre retient le héros jusqu'au combat.
    const sorties = scene?.resultat?.combat ? [] : accessibles(e, dj, p);
    const sortie = sa.sortie ?? (sa.id === dj.entree || termine(e) ? `Ressortir de ${dj.nom}` : undefined);
    const refusSortie = sortie && sa.sortieSi?.(p);
    const quetes = bloque ? '' : panneauQuetes(p, ou(), epreuveQuete);
    return `<div class="panneau salle-donjon">
      ${entete}
      ${action}
      ${quetes}
      ${serrures}
      ${recherche || fouille || affaires ? `<p class="actions-lieu">${affaires}${fouille}${recherche}</p>` : ''}
      <p class="actions-lieu">${sorties
        .map((id) => {
          const autre = dj.niveaux && salle(dj, id).niveau !== sa.niveau;
          return `<button class="secondaire" data-aller="${id}">${autre ? '⇅' : '→'} ${e.vues.includes(id) ? echapper(salle(dj, id).nom) : autre ? `Vers ${echapper(niveauDe(dj, id)?.nom ?? 'un autre étage')}` : 'Passage inconnu'}</button>`;
        })
        .join('')}
        ${sortie && !bloque ? `<button id="sortir" ${refusSortie ? `disabled title="${echapper(refusSortie)}"` : ''}>⇲ ${echapper(sortie)}</button>` : ''}</p>
      ${refusSortie && !bloque ? `<p class="note">${echapper(refusSortie)}</p>` : ''}
      ${panneauIdeesLieu(p, ou())}
      <p>${boutonAutrement({ type: 'lieu', id: ou(), titre: `${sa.nom} (${dj.nom})` })}</p>
    </div>`;
  };

  const panneauHautsFaits = () => {
    const h = p.hautsFaits ?? {};
    const n = Object.keys(h).length;
    return `<details class="hauts-faits"><summary>🏆 Hauts faits du donjon (${n}/${HAUTS_FAITS.length})</summary><ul>${HAUTS_FAITS.map(
      (x) => `<li class="${h[x.id] ? 'acquis' : ''}">${h[x.id] ? '🏆' : '○'} <b>${echapper(x.nom)}</b>${h[x.id] && h[x.id] > 1 ? ` ×${h[x.id]}` : ''} <span class="note">${echapper(x.condition)} (${x.xp} XP)</span></li>`,
    ).join('')}</ul></details>`;
  };

  const carte = () => {
    const dj = d();
    const e = p.donjon!;
    if (!dj.niveaux) return `<div class="cadre-mini">${miniCarte(dj, e, p)}</div>
      <p class="note legende-donjon">⇲ entrée · ⚔ combat · ⚠ piège · ♨ repos · ♛ salle finale · ? inconnu. Clique sur une salle voisine pour y aller.</p>`;
    const etageIci = salle(dj, e.salle).niveau!;
    const etage = etageVu ?? etageIci;
    const connus = dj.niveaux.filter((n) => n.id === etageIci || e.vues.some((v) => salle(dj, v).niveau === n.id));
    return `<div class="etages">${connus
      .map((n) => `<button class="${n.id === etage ? '' : 'secondaire'}" data-etage="${n.id}">${n.id === etageIci ? '🧍 ' : ''}${echapper(n.nom)}</button>`)
      .join('')}</div>
      ${planEtage(dj, e, p, etage)}
      <p class="note legende-donjon">🧍 toi · ⚔ combat · ⚠ piège · ☺ quelqu'un · 🍺 taverne · 🛒 boutique · ♨ repos · ⇲ sortie · ? inconnu. Clique sur une salle voisine pour y aller.</p>
      ${ddn() ? panneauHautsFaits() : ''}`;
  };

  const render = () => {
    const dj = d();
    if (p.donjon && dj.niveaux) purger(p.donjon, p.jour);
    const panneau = vue === 'sac' ? panneauSac(p) : vue === 'groupe' ? panneauGroupe(p) : vue === 'journal' ? panneauJournal(p) : vue === 'quetes' ? panneauJournalQuetes(p) : panneauSalle();
    app.innerHTML = `<div class="page page-donjon ${dj.niveaux ? 'donjon-plans' : ''}">
      ${bandeau(p, vue, 'Donjon')}
      <h1 class="titre-donjon">${echapper(dj.nom)}</h1>
      <div class="donjon-colonnes"><div class="donjon-carte">${carte()}</div><div class="donjon-salle">${panneau}</div></div>
    </div>`;
    lier();
  };

  const dire = (html?: string) => {
    message = (html ?? '') + nouvelles() || undefined;
    if (p.ev <= 0) return mourir();
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

  const reculer = () => {
    const e = p.donjon!;
    if (!e.precedente) return;
    const vers = e.precedente;
    e.precedente = e.salle;
    e.salle = vers;
  };

  const vaincus = (r: Rencontre): LigneRencontre[] => [r.ligne, ...Array(Math.max(0, r.nombre - 1)).fill(r.ligne), ...(r.avec ?? []).flatMap((x) => Array(x.nombre).fill(x.ligne))];

  /** Ce qui suit un combat du Donjon de Naheulbeuk, quelle que soit la façon dont il finit. */
  const apresCombat = (r: Rencontre, bilan: BilanCombat, victoire: () => string, fuite = 'Tu prends la fuite et reviens sur tes pas, le cœur battant.') => {
    if (bilan.fin === 'victoire') {
      const hauts = ddn() ? apresVictoire(p, vaincus(r)) : [];
      return dire(`Victoire (+${bilan.xp} XP${bilan.or ? `, ${formatOr(bilan.or)}` : ''}${bilan.objets.length ? `, ${bilan.objets.map((o) => objet(o).nom).join(', ')}` : ''}). ${victoire()}${hauts.map((h) => ` ${echapper(h)}.`).join('')}`);
    }
    scene = undefined;
    if (bilan.fin === 'fuite') {
      reculer();
      const h = ddn() && p.ev > 0 ? hautFait(p, 'ruse') : null;
      return dire(`${fuite}${h ? ` ${echapper(h)}.` : ''}`);
    }
    if (bilan.fin === 'reddition' && ddn()) return dire(echapper(capturer(p)));
    mourir();
  };

  // --- Les actions ----------------------------------------------------------------------------------

  const appliquerChoix = (i: number, rng?: Rng) => {
    if (!scene) return;
    const avant = p.donjon!.salle;
    const res = scene.ev.choix[i].effet(p, rng);
    scene.resultat = res;
    scene.choix = undefined;
    if (res.heures) passerTemps(p, res.heures);
    noter(p, `${scene.ev.titre.toLowerCase()} : ${res.texte.slice(0, 80)}${res.texte.length > 80 ? '…' : ''}`);
    if (p.ev <= 0) return mourir();
    // On a reculé (ou on a été jeté dehors) : le récit suit le héros dans l'autre salle.
    if (p.donjon!.salle !== avant) {
      scene = undefined;
      return dire(echapper(res.texte));
    }
    dire(undefined);
  };

  /** La scène est finie : elle est réglée, sauf si elle reste là (le troll…) ou si on a reculé. */
  const finirScene = (res: Resultat) => {
    const e = p.donjon!;
    const sc = scene!;
    const sa = salle(d(), e.salle);
    const { contenu: c, cle } = contenuIci(sa, p);
    if (c?.type === 'scene' && cle === sc.cle && !c.permanente && res.regle !== false) regler(e, cle, p.jour);
    scene = undefined;
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
    lierVitesse(app);
    lierIdeesLieu(
      app,
      p,
      () => dire(message),
      (r) => ecranCombat(app, p, r, (bilan) => apresCombat(r, bilan, () => '')),
    );
    lierQuetes(
      app,
      p,
      {
        message: (html) => {
          epreuveQuete = undefined;
          dire(html);
        },
        combat: (r, apres) => ecranCombat(app, p, r, (bilan) => apresCombat(r, bilan, () => echapper(apres()))),
        donjon: () => undefined,
      },
      (id) => {
        epreuveQuete = id;
        render();
      },
    );
    sur('[data-etage]', (el) => {
      etageVu = el.dataset.etage;
      render();
    });
    sur('[data-aller]', (el) => {
      if (scene?.resultat?.combat) return dire("Pas le temps de filer : il faut se battre d'abord (on peut toujours fuir pendant le combat).");
      const refus = avancer(p, el.dataset.aller!);
      piegeEnCours = false;
      deEnCours = undefined;
      scene = undefined;
      epreuveQuete = undefined;
      etageVu = undefined;
      const e = p.donjon!;
      const sa = salle(d(), e.salle);
      dire(refus ? echapper(refus) : !contenuIci(sa, p).contenu && !sa.tresor && !d().niveaux ? echapper(ambiance()) : undefined);
    });
    sur('#reculer', () => {
      reculer();
      piegeEnCours = false;
      dire('Tu recules prudemment.');
    });
    sur('#sortir', () => {
      const dj = d();
      noter(p, `ressort de ${dj.nom}.`);
      quitterDonjon(p);
      s.sortir();
    });
    sur('#piege', () => {
      piegeEnCours = 'passer';
      render();
    });
    sur('#desamorcer', () => {
      piegeEnCours = 'desamorcer';
      render();
    });
    sur('#lancer-piege', (bouton) => {
      const valeur = lancer(20);
      (bouton as HTMLButtonElement).disabled = true;
      animerDes([app.querySelector<HTMLElement>('#de-piege')!], 20, [valeur]).then(() =>
        setTimeout(() => {
          const desamorcer = piegeEnCours === 'desamorcer';
          const r = affronterPiege(p, valeur, undefined, desamorcer);
          piegeEnCours = false;
          const h = r.reussi && desamorcer && ddn() ? piegeDesamorce(p) : null;
          dire(`${de(valeur)} ${echapper(r.texte)}${r.degats ? ` ${r.des.map((x) => de(x)).join('')} <b>−${r.degats} PV</b>.` : ''}${h ? ` ${echapper(h)}.` : ''}`);
        }, 350),
      );
    });
    sur('#repos', () => {
      const n = seReposer(p);
      const c = contenuIci(salle(d(), p.donjon!.salle), p).contenu;
      const gains = [n.pv ? `${n.pv} PV` : '', n.pa ? `${n.pa} PA` : ''].filter(Boolean).join(' et ');
      dire(`${c?.type === 'repos' ? echapper(c.texte) : ''} ${gains ? `Tu récupères <b>${gains}</b>.` : 'Tu es déjà en pleine forme.'}`);
    });
    sur('#fouiller', () => {
      const sa = salle(d(), p.donjon!.salle);
      const t = fouiller(p);
      if (!t) return dire('Rien de plus ici.');
      ajouterButin(p, t.or ?? 0);
      const gains = [t.or ? formatOr(t.or) : '', ...(t.objets ?? []).map((id) => objet(id).nom)].filter(Boolean);
      noter(p, `fouille ${sa.nom} : ${gains.join(', ')}.`);
      const h = t.hautFait && ddn() ? hautFait(p, t.hautFait) : null;
      dire(
        `${echapper(t.texte)} <b>${echapper(gains.join(', '))}</b>.${t.heures ? ` (${t.heures} h de fouille)` : ''}${p.butin ? ` Le groupe attend sa part (${p.butin} PO à partager, onglet Groupe).` : ''}${h ? ` ${echapper(h)}.` : ''}`,
      );
    });
    sur('#combattre', () => {
      const sa = salle(d(), p.donjon!.salle);
      const { contenu: c, cle } = contenuIci(sa, p);
      if (c?.type !== 'combat') return;
      const r = combatSalle(sa, p)!;
      ecranCombat(app, p, r, (bilan) =>
        apresCombat(r, bilan, () => {
          const e = p.donjon!;
          regler(e, cle, p.jour);
          if (c.marque) marquer(p, c.marque);
          const gagne = c.gagne ?? [];
          p.sac.push(...gagne);
          const fin = finSiTermine();
          return `${gagne.length ? `Sur les vaincus : <b>${echapper(gagne.map((x) => objet(x).nom).join(', '))}</b>. ` : ''}${sa.tresor && !e.fouillees.includes(sa.id) ? 'Il y a peut-être quelque chose à fouiller.' : ''}${fin}`;
        }),
      );
    });

    // Les scènes : les gens du donjon.
    sur('[data-choix-scene]', (el) => {
      if (!scene) return;
      const i = Number(el.dataset.choixScene);
      if (scene.ev.choix[i].jet) {
        scene.choix = i;
        deEnCours = { type: 'scene' };
        render();
      } else appliquerChoix(i);
    });
    sur('#suite-scene', () => {
      if (!scene?.resultat) return;
      const res = scene.resultat;
      if (res.suite) {
        scene = { ev: res.suite, cle: scene.cle };
        return render();
      }
      finirScene(res);
      dire(undefined);
    });
    sur('#combat-scene', () => {
      if (!scene?.resultat?.combat) return;
      const sc = scene;
      const res = sc.resultat!;
      const { rencontre, victoire } = res.combat!;
      ecranCombat(app, p, rencontre, (bilan) => {
        if (bilan.fin !== 'victoire') return apresCombat(rencontre, bilan, () => '');
        const suite = victoire?.(p) ?? '';
        sc.resultat = { texte: 'Le combat est fini.', regle: res.regle };
        scene = sc;
        apresCombat(rencontre, bilan, () => echapper(suite));
      });
    });

    // Portes, coffres, énigmes.
    sur('[data-cle]', (el) => {
      const refus = ouvrirAvecCle(p, cibleDe(el.dataset.cle!));
      dire(refus ? echapper(refus) : '🗝 Clac. Ça s\'ouvre.');
    });
    sur('[data-crocheter]', (el) => {
      deEnCours = { type: 'serrure', cible: cibleDe(el.dataset.crocheter!), facon: 'crocheter' };
      render();
    });
    sur('[data-enfoncer]', (el) => {
      deEnCours = { type: 'serrure', cible: cibleDe(el.dataset.enfoncer!), facon: 'enfoncer' };
      render();
    });
    app.querySelectorAll<HTMLFormElement>('form[data-enigme]').forEach((f) =>
      f.addEventListener('submit', (ev) => {
        ev.preventDefault();
        const cible = cibleDe(f.dataset.enigme!);
        const dj = d();
        const e = p.donjon!;
        const sr = 'porte' in cible ? porteEntre(dj, e.salle, cible.porte) : salle(dj, e.salle).tresor?.serrure;
        if (!sr?.enigme) return;
        const reponse = String(new FormData(f).get('reponse') ?? '');
        const bonne = ENIGMES[sr.enigme].bonne(reponse);
        repondreSerrure(p, cible, bonne);
        if (!bonne) return dire(`« ${echapper(reponse)} » ? Rien ne se passe. L'inscription te nargue.`);
        const deja = p.marques?.includes(`ddn:enigme-${sr.enigme}`);
        marquer(p, `ddn:enigme-${sr.enigme}`);
        const h = ddn() && !deja ? hautFait(p, 'chaussette') : null;
        dire(`« ${echapper(reponse)} » : un déclic, et la pierre pivote !${h ? ` ${echapper(h)}.` : ''}`);
      }),
    );
    sur('#chercher', () => {
      deEnCours = { type: 'chercher' };
      render();
    });

    // Taverne et boutiques.
    sur('#chope', () => {
      const c = contenuIci(salle(d(), p.donjon!.salle), p).contenu;
      if (c?.type !== 'taverne') return;
      p.or -= c.chope;
      passerTemps(p, 0.5);
      const h = hautFait(p, 'biere');
      dire(`Une chope mousseuse, et le voisin de comptoir est bavard : ${echapper(c.rumeurs[lancer(c.rumeurs.length) - 1])}${h ? ` ${echapper(h)}.` : ''}`);
    });
    sur('#repas', () => {
      const c = contenuIci(salle(d(), p.donjon!.salle), p).contenu;
      if (c?.type !== 'taverne') return;
      p.or -= c.repas;
      passerTemps(p, 1);
      const pv = soigner(p, 3);
      const h = hautFait(p, 'biere');
      dire(`Un ragoût d'origine incertaine, mais chaud. Tu récupères <b>${pv} PV</b>.${h ? ` ${echapper(h)}.` : ''}`);
    });
    sur('[data-acheter]', (el) => {
      const id = el.dataset.acheter!;
      const refus = acheter(p, id, objet(id).prix);
      if (!refus) noter(p, `achète ${objet(id).nom} au donjon.`);
      dire(refus ? echapper(refus) : `Tu achètes : <b>${echapper(objet(id).nom)}</b>.`);
    });
    sur('#ragots', () => {
      const c = contenuIci(salle(d(), p.donjon!.salle), p).contenu;
      if (c?.type !== 'boutique' || !c.ragots) return;
      p.or -= c.ragots.prix;
      if (c.ragots.marque) marquer(p, c.ragots.marque);
      dire(echapper(c.ragots.textes[lancer(c.ragots.textes.length) - 1]));
    });

    // Les cachots.
    sur('[data-evasion]', (el) => {
      deEnCours = { type: 'evasion', facon: el.dataset.evasion as Evasion };
      render();
    });
    sur('#croupir', () => dire(echapper(croupir(p))));
    sur('#attendre-soir', () => {
      const attente = (20 - p.heure + 24) % 24 || 24;
      passerTemps(p, attente);
      noter(p, 'attend le soir au cachot.');
      dire(`Les heures passent. Il est ${formatHeure(p.heure)} : on entend des pas lourds et un chant d'ivrogne dans le couloir.`);
    });
    sur('#affaires', () => dire(echapper(recupererAffaires(p) ?? 'Rien à récupérer.')));

    // Le D20 du joueur, pour tout ce qui précède.
    sur('#lancer-donjon', (bouton) => {
      const faces = Number(bouton.dataset.faces);
      const valeur = lancer(faces);
      (bouton as HTMLButtonElement).disabled = true;
      animerDes([app.querySelector<HTMLElement>('#de-donjon')!], faces, [valeur]).then(() =>
        setTimeout(() => {
          const enCours = deEnCours;
          deEnCours = undefined;
          if (scene?.choix !== undefined) return appliquerChoix(scene.choix, avecDe(valeur, faces));
          if (enCours?.type === 'chercher') {
            const r = chercher(p, valeur);
            return dire(`${de(valeur)} ${echapper(r.texte)}`);
          }
          if (enCours?.type === 'serrure') {
            const r = forcerSerrure(p, enCours.cible, enCours.facon, valeur);
            return dire(`${de(valeur)} ${echapper(r.texte)}${r.degats ? ` ${r.des.map((x) => de(x)).join('')} <b>−${r.degats} PV</b>.` : ''}`);
          }
          if (enCours?.type === 'evasion') {
            const r = evader(p, enCours.facon, valeur);
            return dire(`${de(valeur)} ${echapper(r.texte)}`);
          }
          render();
        }, 350),
      );
    });
  };

  const mourir = () => {
    const dj = d();
    scene = undefined;
    deEnCours = undefined;
    noter(p, `tombe dans ${dj.nom}.`);
    ecranMort(
      app,
      p,
      dj.secours ?? `Tes jambes se dérobent, la torche roule par terre… ${p.perso.nom} s'effondre dans ${dj.nom}.`,
      (texte) => {
        if (dj.secours) {
          // Le Donjon Facile est surveillé : on se réveille dehors, et il faudra recommencer.
          quitterDonjon(p, true);
          sauver();
          return s.sortir(texte);
        }
        const h = ddn() ? hautFait(p, 'providence') : null;
        dire(`${echapper(texte)}${h ? ` ${echapper(h)}.` : ''}`);
      },
      s.finDePartie,
    );
  };

  const e0 = p.donjon!;
  const entrees = [d().entree, ...(d().entrees ?? []).map((x) => x.salle)];
  if (e0.vues.length === 1) message = echapper(d().intro);
  else if (entrees.includes(e0.salle) && !e0.precedente && !message) {
    const r = repeuplement(e0);
    message = r
      ? `Tu retrouves ${echapper(d().nom)} comme tu l'as laissé : les salles vidées sont encore vides, les coffres pillés aussi. Ça ne durera pas : les premières bestioles reviendront vers le ${echapper(dateLongue(r))}.`
      : `Tu retrouves ${echapper(d().nom)}. Une semaine a passé : les lieux se sont repeuplés, et quelqu'un a remis des choses dans les coffres.`;
  }
  render();
};
