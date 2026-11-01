import {
  appreciation,
  APPRECIATION_MAX,
  compagnon,
  COMPAGNONS,
  dePassage,
  type DefCompagnon,
  dansGroupe,
  destinCompagnon,
  discuter,
  ficheCompagnon,
  garderButin,
  groupe,
  humeur,
  partagerButin,
  partDue,
  payerPart,
  rancune,
  payerTournee,
  PRIX_TOURNEE,
  recruter,
  renvoyer,
  seuilDepart,
  tirCompagnon,
  valeursCompagnon,
  valeurObeissance,
  VALEURS,
} from '../rules/compagnons';
import { dateCourte } from '../rules/calendrier';
import { objet } from '../rules/objets';
import type { EtatCompagnon, Partie } from '../rules/partie';
import { echapper } from './outils';

// Le groupe du héros : la fiche de chaque compagnon (onglet « Groupe »), et l'embauche des mercenaires.

const ficheHtml = (p: Partie, id: string, e?: EtatCompagnon) => {
  const d = compagnon(id);
  const f = ficheCompagnon(id);
  const etat = e ?? { id, ev: f.ev, evMax: f.ev };
  const v = valeursCompagnon(p, etat);
  const t = tirCompagnon(p, etat);
  const comp = [...f.competences.naissance, ...f.competences.heritees, ...f.competences.choisies];
  const equipement = Object.values(d.equipe)
    .filter((x): x is string => !!x)
    .map((x) => objet(x).nom);
  return `<p class="note">${echapper(f.origine.nom)}, ${echapper(f.metier.nom)} · ${echapper(d.titre)}</p>
    <p>${echapper(d.description)}</p>
    <div class="valeurs">
      <div><b>${etat.ev}/${etat.evMax}</b><span>Énergie vitale</span></div>
      <div><b>${v.at}</b><span>Attaque</span></div>
      <div><b>${v.prd}</b><span>Parade</span></div>
      <div><b>${echapper(v.degats)}</b><span>Dégâts</span></div>
      <div><b>${v.pr}</b><span>Protection</span></div>
      ${t ? `<div><b>${t.ad}</b><span>Tir (AD)</span></div>` : ''}
      ${e ? `<div><b>${destinCompagnon(e)}</b><span>Destin</span></div>` : ''}
    </div>
    <p class="note">COU ${f.caracs.COU} · INT ${f.caracs.INT} · CHA ${f.caracs.CHA} · AD ${f.caracs.AD} · FO ${f.caracs.FO}</p>
    <p class="note"><b>Équipement :</b> ${echapper(equipement.join(', '))}${d.sac.length ? ` · <b>Sac :</b> ${echapper([...new Set(d.sac)].map((x) => `${objet(x).nom}${d.sac.filter((y) => y === x).length > 1 ? ` ×${d.sac.filter((y) => y === x).length}` : ''}`).join(', '))}` : ''}</p>
    <p class="note"><b>Compétences :</b> ${echapper(comp.join(', '))}</p>`;
};

/** Son caractère et ce qu'il pense du héros. */
const relationHtml = (p: Partie, e: EtatCompagnon) => {
  const d = compagnon(e.id);
  const a = appreciation(e);
  const seuil = seuilDepart(e.id);
  // La jauge va du seuil de départ au maximum ; le repère marque le 0.
  const pct = Math.round(((a - seuil) / (APPRECIATION_MAX - seuil)) * 100);
  const zero = Math.round((-seuil / (APPRECIATION_MAX - seuil)) * 100);
  const prenom = d.perso.nom.split(' ')[0];
  return `<div class="relation">
    <p><b>${echapper(humeur(e))}</b> <span class="note">appréciation ${a > 0 ? '+' : ''}${a} · s'en va à ${seuil} · obéit en combat sur ${valeurObeissance(p, e)} ou moins</span></p>
    <span class="jauge-appreciation ${a < 0 ? 'negative' : ''}" title="De ${seuil} (il part) à +${APPRECIATION_MAX}"><span style="width:${Math.max(0, Math.min(100, pct))}%"></span><i style="left:${zero}%"></i></span>
    <p class="note"><b>Caractère :</b> ${echapper(d.personnalite)} · <b>Fidélité :</b> ${['mercenaire', 'tiède', 'fidèle', 'à toute épreuve'][d.fidelite]}</p>
    <p class="note"><b>Ce qui le motive :</b> ${echapper(d.motivations.join(' ; '))}</p>
    <p class="note"><b>Ses valeurs :</b> ${d.valeurs.map((v) => echapper(VALEURS[v])).join(' ')}</p>
    ${
      e.souvenirs?.length
        ? `<ul class="souvenirs">${e.souvenirs.map((s) => `<li><span class="${s.delta > 0 ? 'plus' : 'moins'}">${s.delta > 0 ? '+' : ''}${s.delta}</span> ${echapper(s.texte)} <span class="note">(${dateCourte(s.jour)})</span></li>`).join('')}</ul>`
        : '<p class="note">Rien de marquant entre vous pour le moment.</p>'
    }
    <p class="actions-lieu">
      <button class="secondaire petit" data-discuter="${e.id}">💬 Discuter${e.discussion === p.jour ? ' (déjà fait aujourd\'hui)' : ''}</button>
      <button class="secondaire petit" data-tournee="${e.id}" ${p.or < PRIX_TOURNEE || e.tournee === p.jour ? 'disabled' : ''}>🍺 Lui payer à boire (${PRIX_TOURNEE} PO)</button>
    </p>
  </div>`;
};

/** Avant de dormir : les parts pas payées sont gardées. Renvoie le récit des rancunes (vide si rien). */
export const partageDuSoir = (p: Partie) => {
  dernierPartage = '';
  const l = garderButin(p);
  return l.length ? `<ul class="reactions">${l.map((x) => `<li>${echapper(x)}</li>`).join('')}</ul>` : '';
};

/** Le dernier partage (qui a été payé, qui râle), affiché dans le panneau jusqu'au prochain. */
let dernierPartage = '';

/**
 * Le partage du butin, à faire le soir : chacun sa part, payée une par une ou toutes ensemble.
 * Une part pas payée à la nuit est une part gardée, et les plus cupides le prennent mal.
 */
/** Le petit bouton « payer sa part », à côté du nom du compagnon. */
const boutonPayer = (p: Partie, e: EtatCompagnon) => {
  const part = partDue(p, e);
  if (!part) return '';
  const r = rancune(p, e);
  return ` <button class="secondaire petit payer-part" data-payer-part="${e.id}" ${p.or < part ? 'disabled' : ''} title="${r ? `Sans paiement ce soir : appréciation −${r}` : 'Il ne dira rien si tu gardes sa part'}">💰 Payer sa part (${part} PO)</button>`;
};

export const panneauPartage = (p: Partie, compact = false) => {
  const g = groupe(p).filter((e) => partDue(p, e) > 0);
  const fait = dernierPartage ? `<div class="recit">${dernierPartage}</div>` : '';
  if (!g.length) return fait;
  const lignes = g
    .map((e) => {
      const part = partDue(p, e);
      const r = rancune(p, e);
      const nom = echapper(compagnon(e.id).perso.nom.split(' ')[0]);
      return `<li><b>${nom}</b> attend <b>${part} PO</b> <span class="note">${
        r ? `sans paiement ce soir : appréciation −${r}${r >= 3 ? ', il tient à son or' : ''}` : 'il ne regarde pas trop : il ne dira rien si tu gardes sa part'
      }</span> <button class="secondaire petit" data-payer-part="${e.id}" ${p.or < part ? 'disabled' : ''}>Payer ${nom}</button></li>`;
    })
    .join('');
  return `${fait}<div class="recit partage"><b>Partage du butin</b> <span class="note">(${p.butin} PO gagnés ensemble, une part égale chacun, la tienne comprise)</span>
    ${compact ? '<p class="note">Tu peux aussi payer chacun avec le petit bouton à côté de son nom.</p>' : `<ul class="parts">${lignes}</ul>`}
    <p class="actions-lieu"><button data-partager>Payer tout le monde</button><button class="secondaire" data-garder>Tout garder</button></p>
    <p class="note">On partage le soir, au campement ou à l'auberge. Une part pas payée avant de dormir est une part gardée.</p></div>`;
};

/** L'onglet « Groupe » : la fiche complète de chaque compagnon. */
export const panneauGroupe = (p: Partie, message?: string) => {
  const g = groupe(p);
  return `<div class="panneau">
    <h2>Groupe</h2>
    ${panneauPartage(p, true)}
    ${message ? `<div class="recit">${message}</div>` : ''}
    ${
      g.length
        ? g
            .map(
              (e) => `<section class="compagnon">
            <h3>${echapper(compagnon(e.id).perso.nom)} <span class="note">${echapper(compagnon(e.id).titre)} · ❤ ${e.ev}/${e.evMax} · ✦ ${destinCompagnon(e)} point${destinCompagnon(e) > 1 ? 's' : ''} de destin</span>${boutonPayer(p, e)}</h3>
            ${relationHtml(p, e)}
            <details><summary>Sa fiche</summary>${ficheHtml(p, e.id, e)}</details>
            <p><button class="secondaire petit" data-renvoyer="${e.id}">Se séparer de ${echapper(compagnon(e.id).perso.nom.split(' ')[0])}</button></p></section>`,
            )
            .join('')
        : '<p class="note">Tu voyages seul. Des compagnons peuvent te rejoindre au fil des quêtes et des rencontres, ou contre de l\'or dans les tavernes.</p>'
    }
  </div>`;
};

/** Les mercenaires à embaucher dans ce lieu. */
export const panneauEmbauche = (p: Partie, ou: string, taverne = false) => {
  const fiche = (d: DefCompagnon, resume: string) => `<details class="compagnon"><summary>${resume}</summary>
        ${d.cv ? `<p class="recit">${echapper(d.cv)}</p>` : ''}
        ${ficheHtml(p, d.id)}
        <p><button data-embaucher="${d.id}" ${p.or < (d.prix ?? 0) ? 'disabled' : ''}>Engager ${echapper(d.perso.nom.split(' ')[0])} (${d.prix} PO)</button></p></details>`;
  const ici = COMPAGNONS.filter((d) => d.embauche === ou && !dansGroupe(p, d.id));
  const pancarte = ici.filter((d) => d.cv);
  const comptoir = ici.filter((d) => !d.cv);
  const passage = taverne ? dePassage(p, ou) : null;
  return [
    ...comptoir.map((d) => fiche(d, `🍺 Un client au comptoir : <b>${echapper(d.perso.nom)}</b> <span class="note">(${echapper(d.titre)})</span>`)),
    passage ? fiche(passage, `🎒 Un aventurier de passage, aujourd'hui seulement : <b>${echapper(passage.perso.nom)}</b> <span class="note">(${echapper(passage.titre)})</span>`) : '',
    pancarte.length
      ? `<div class="pancarte"><p><b>📜 Pancarte de recrutement</b> <span class="note">Les jeunes aventuriers qui cherchent un groupe y épinglent leur CV.</span></p>${pancarte
          .map((d) => fiche(d, `<b>${echapper(d.perso.nom)}</b> <span class="note">(${echapper(d.titre)}, ${d.prix} PO)</span>`))
          .join('')}</div>`
      : '',
  ].join('');
};

export const lierGroupe = (app: HTMLElement, p: Partie, message: (html: string) => void) => {
  const etat = (id: string) => groupe(p).find((e) => e.id === id)!;
  const liste = (l: string[]) => (l.length ? `<ul class="reactions">${l.map((x) => `<li>${echapper(x)}</li>`).join('')}</ul>` : '');
  app.querySelectorAll<HTMLElement>('[data-discuter]').forEach((b) =>
    b.addEventListener('click', () => {
      const e = etat(b.dataset.discuter!);
      const r = discuter(p, e);
      message(`<b>${echapper(compagnon(e.id).perso.nom.split(' ')[0])} :</b> « ${echapper(r.idee)} »${liste([r.ligne].filter(Boolean))}`);
    }),
  );
  app.querySelectorAll<HTMLElement>('[data-tournee]').forEach((b) =>
    b.addEventListener('click', () => {
      const e = etat(b.dataset.tournee!);
      message(liste([payerTournee(p, e)]));
    }),
  );
  const partage = (html: string) => {
    dernierPartage = html;
    message('');
  };
  app.querySelectorAll<HTMLElement>('[data-payer-part]').forEach((b) =>
    b.addEventListener('click', () => partage(liste([payerPart(p, etat(b.dataset.payerPart!))]))),
  );
  app.querySelector('[data-partager]')?.addEventListener('click', () => partage(`Tu comptes les pièces devant tout le monde.${liste(partagerButin(p))}`));
  app.querySelector('[data-garder]')?.addEventListener('click', () => partage(`Tu fourres tout dans ta bourse.${liste(garderButin(p, 'tu as gardé sa part pour toi'))}`));
  app.querySelectorAll<HTMLElement>('[data-renvoyer]').forEach((b) =>
    b.addEventListener('click', () => {
      const nom = compagnon(b.dataset.renvoyer!).perso.nom;
      renvoyer(p, b.dataset.renvoyer!);
      message(`${echapper(nom)} reprend sa route. « Bon vent ! »`);
    }),
  );
  app.querySelectorAll<HTMLElement>('[data-embaucher]').forEach((b) =>
    b.addEventListener('click', () => {
      const d = compagnon(b.dataset.embaucher!);
      const refus = recruter(p, d.id);
      message(refus ? `<span class="alerte">${echapper(refus)}</span>` : `Tu poses ${d.prix} PO sur le comptoir. ${echapper(d.perso.nom)} vide sa chope d'un trait : « Bon. On y va, ou on attend que la bière refroidisse ? »`);
    }),
  );
};
