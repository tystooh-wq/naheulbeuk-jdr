import {
  appreciation,
  APPRECIATION_MAX,
  compagnon,
  COMPAGNONS,
  dansGroupe,
  discuter,
  ficheCompagnon,
  garderButin,
  groupe,
  humeur,
  partagerButin,
  partButin,
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

/** L'onglet « Groupe » : la fiche complète de chaque compagnon. */
export const panneauGroupe = (p: Partie, message?: string) => {
  const g = groupe(p);
  return `<div class="panneau">
    <h2>Groupe</h2>
    ${
      p.butin && g.length
        ? `<div class="recit"><b>Butin à partager :</b> ${p.butin} PO gagnés ensemble. <p class="actions-lieu"><button data-partager>Partager à parts égales (${partButin(p)} PO chacun)</button><button class="secondaire" data-garder>Tout garder</button></p><p class="note">Sans partage avant la nuit, le groupe considère que tu as tout gardé.</p></div>`
        : ''
    }
    ${message ? `<div class="recit">${message}</div>` : ''}
    ${
      g.length
        ? g
            .map(
              (e) => `<section class="compagnon">
            <h3>${echapper(compagnon(e.id).perso.nom)} <span class="note">${echapper(compagnon(e.id).titre)} · ❤ ${e.ev}/${e.evMax}</span></h3>
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
export const panneauEmbauche = (p: Partie, ou: string) =>
  COMPAGNONS.filter((d) => d.embauche === ou && !dansGroupe(p, d.id))
    .map(
      (d) => `<details class="compagnon"><summary>🍺 Un client au comptoir : <b>${echapper(d.perso.nom)}</b> <span class="note">(${echapper(d.titre)})</span></summary>
        ${ficheHtml(p, d.id)}
        <p><button data-embaucher="${d.id}" ${p.or < (d.prix ?? 0) ? 'disabled' : ''}>Engager ${echapper(d.perso.nom.split(' ')[0])} (${d.prix} PO)</button></p></details>`,
    )
    .join('');

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
  app.querySelector('[data-partager]')?.addEventListener('click', () => message(`Tu comptes les pièces devant tout le monde.${liste(partagerButin(p))}`));
  app.querySelector('[data-garder]')?.addEventListener('click', () => message(`Tu fourres tout dans ta bourse.${liste(garderButin(p))}`));
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
