import { compagnon, COMPAGNONS, dansGroupe, ficheCompagnon, groupe, recruter, renvoyer, tirCompagnon, valeursCompagnon } from '../rules/compagnons';
import { objet } from '../rules/objets';
import type { EtatCompagnon, Partie } from '../rules/partie';
import { echapper } from './outils';

// Le groupe du héros : la fiche de chaque compagnon (dans « Sac et équipement »), et l'embauche des mercenaires.

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

/** Les compagnons, dans le panneau « Sac et équipement ». */
export const panneauGroupe = (p: Partie) => {
  const g = groupe(p);
  return `<h3>Ton groupe</h3>${
    g.length
      ? g
          .map(
            (e) => `<details class="compagnon"><summary><b>${echapper(compagnon(e.id).perso.nom)}</b> <span class="note">${echapper(compagnon(e.id).titre)} · ❤ ${e.ev}/${e.evMax}</span></summary>
          ${ficheHtml(p, e.id, e)}
          <p><button class="secondaire petit" data-renvoyer="${e.id}">Se séparer de ${echapper(compagnon(e.id).perso.nom.split(' ')[0])}</button></p></details>`,
          )
          .join('')
      : '<p class="note">Tu voyages seul. Des compagnons peuvent te rejoindre au fil des quêtes et des rencontres, ou contre de l\'or dans les tavernes.</p>'
  }`;
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
