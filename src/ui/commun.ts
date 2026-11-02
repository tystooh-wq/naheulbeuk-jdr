import { competencesDuHeros, empechement, priseCompetence, talentsDuHeros, TALENTS_ACTIFS, utiliserTalent, type Cadre, type Prise } from '../rules/talents';
import { lierGroupe } from './groupe';
import { apercu, lierPoupee, poupee } from './poupee';
export { panneauGroupe } from './groupe';
import { rangReputation, reputation, REPUTATION_MAX, REPUTATION_MIN } from '../rules/reputation';
import { calculerFiche } from '../rules/creation';
import { formatOr } from '../rules/monnaie';
import { formatMods, objet, type Objet } from '../rules/objets';
import {
  boirePotion,
  desequiper,
  type CleEquipement,
  equiper,
  evMax,
  formatHeure,
  gainsPossibles,
  monterNiveau,
  niveau,
  niveauEnAttente,
  noter,
  PALIERS_XP,
  peutManier,
  type GainNiveau,
  peutPorter,
  valeursCombat,
  blessuresActives,
  type Partie,
} from '../rules/partie';
import { date, dateCourte, dateLongue, periode } from '../rules/calendrier';

/** L'horloge du bandeau : « ☼ Obouloserin 5 avril, 10 h », avec la fête du jour s'il y en a une. */
const horloge = (p: Partie) => {
  const f = date(p.jour).fete;
  return `${p.heure >= 20 || p.heure < 6 ? '☾' : '☼'} <b>${dateLongue(p.jour)}</b>, ${formatHeure(p.heure)}${f ? ` <span class="fete">· ${echapper(f)}</span>` : ''}`;
};
import { lancer } from '../rules/des';
import { caracMagie, ea, eaMax, soinLeger, sortsConnus } from '../rules/magie';
import { valeursTir } from '../rules/tir';
import { modEsquive } from '../rules/combat';
import { animerDes, de, echapper } from './outils';

// Éléments partagés par la ville et la carte du monde : bandeau du héros, sac, journal, vitesse.

// --- Vitesse de marche ------------------------------------------------------------

const VITESSES = [1, 2, 4];
const CLE_VITESSE = 'naheulbeuk.vitesse';

/** Réglage propre à chaque joueur, retenu dans son navigateur s'il le permet. */
const lireVitesse = (): number => {
  try {
    const v = Number(localStorage.getItem(CLE_VITESSE));
    return VITESSES.includes(v) ? v : 1;
  } catch {
    return 1;
  }
};

let vitesseChoisie = lireVitesse();

export const vitesse = () => vitesseChoisie;

export const boutonsVitesse = () =>
  `<span class="vitesse" role="group" aria-label="Vitesse de marche">Vitesse ${VITESSES.map(
    (v) => `<button class="secondaire petit ${v === vitesseChoisie ? 'actif' : ''}" data-vitesse="${v}" aria-pressed="${v === vitesseChoisie}">×${v}</button>`,
  ).join('')}</span>`;

export const lierVitesse = (app: HTMLElement) =>
  app.querySelectorAll<HTMLElement>('[data-vitesse]').forEach((el) =>
    el.addEventListener('click', () => {
      vitesseChoisie = Number(el.dataset.vitesse);
      try {
        localStorage.setItem(CLE_VITESSE, String(vitesseChoisie));
      } catch {
        // Pas de stockage : le réglage vaut pour cette visite seulement.
      }
      // Pas de nouveau rendu : le héros est peut-être en train de marcher.
      app.querySelectorAll<HTMLElement>('[data-vitesse]').forEach((b) => {
        const actif = Number(b.dataset.vitesse) === vitesseChoisie;
        b.classList.toggle('actif', actif);
        b.setAttribute('aria-pressed', String(actif));
      });
    }),
  );

// --- Réputation ---------------------------------------------------------------------

/** Jauge de réputation dans une ville : de rouge (honni) à vert (héros du coin). */
export const jaugeReputation = (p: Partie, ville: string, nomVille: string, compacte = false) => {
  const n = reputation(p, ville);
  const r = rangReputation(n);
  const pos = ((n - REPUTATION_MIN) / (REPUTATION_MAX - REPUTATION_MIN)) * 100;
  const titre = `Réputation à ${nomVille} : ${r.nom} (${n > 0 ? '+' : ''}${n}). ${r.effet}`;
  return `<span class="reputation${compacte ? ' compacte' : ''}" title="${echapper(titre)}">
    <span>${compacte ? echapper(nomVille) : `Réputation à ${echapper(nomVille)}`}</span>
    <span class="jauge-rep" role="meter" aria-valuemin="${REPUTATION_MIN}" aria-valuemax="${REPUTATION_MAX}" aria-valuenow="${n}" aria-label="${echapper(titre)}"><i style="left:${pos}%"></i></span>
    <b>${r.nom}</b>
  </span>`;
};

// --- Bandeau du héros -------------------------------------------------------------

const quetesEnCours = (p: Partie) => Object.values(p.quetes).filter((e) => e === 'acceptee').length;

export const bandeau = (p: Partie, vue: string, nomCarte: string) => {
  const f = calculerFiche(p.perso);
  return `<div class="bandeau">
    <div><b class="nom-court">${echapper(p.perso.nom)}</b> <span class="note">${echapper(f.nomVersionHB ?? f.origine.nom)}</span></div>
    <div class="jauges">
      <span title="Énergie vitale">❤ <b>${p.ev}</b>/${evMax(p)}</span>
      <span title="Bourse (1 PO = 100 PA = 1000 PC)">● <b>${formatOr(p.or)}</b></span>
      ${eaMax(p) ? `<span title="Énergie astrale (points astraux)">✧ <b>${ea(p)}</b>/${eaMax(p)} PA</span>` : ''}
      <span title="Points de destin">✦ <b>${p.perso.destin}</b></span>
      ${(() => {
        const graves = blessuresActives(p);
        return graves.length
          ? `<button class="petit badge-blessure" data-vue="groupe" title="${echapper(graves.map((b) => b.nom).join(', '))} (détail dans l'onglet Groupe)">🩹 ${graves.length} blessure${graves.length > 1 ? 's' : ''} grave${graves.length > 1 ? 's' : ''}</button>`
          : '';
      })()}
      <span title="Niveau et expérience (prochain niveau à ${PALIERS_XP[niveau(p)] ?? '—'} XP)">★ niv. <b>${niveau(p)}</b> · ${p.xp ?? 0} XP</span>
      ${niveauEnAttente(p) ? `<button class="petit" id="monter-niveau">⬆ Passer niveau ${niveau(p) + 1} !</button>` : ''}
      <span class="temps"><span title="${echapper(periode(p.jour))}" id="horloge">${horloge(p)}</span>${boutonsVitesse()}</span>
    </div>
    <div class="onglets">
      <button class="secondaire petit ${vue === 'lieu' ? 'actif' : ''}" data-vue="lieu">${nomCarte}</button>
      <button class="secondaire petit ${vue === 'sac' ? 'actif' : ''}" data-vue="sac">Sac et équipement</button>
      <button class="secondaire petit ${vue === 'groupe' ? 'actif' : ''}" data-vue="groupe">Groupe${p.compagnons?.length ? ` <span class="pastille">${p.compagnons.length}</span>` : ''}</button>
      <button class="secondaire petit ${vue === 'quetes' ? 'actif' : ''}" data-vue="quetes">Quêtes${quetesEnCours(p) ? ` <span class="pastille">${quetesEnCours(p)}</span>` : ''}</button>
      <button class="secondaire petit ${vue === 'journal' ? 'actif' : ''}" data-vue="journal">Journal</button>
      <button class="secondaire petit" id="fiche">Fiche</button>
    </div>
  </div>`;
};

/** Met à jour l'horloge sans tout redessiner (pendant un voyage). */
export const majHorloge = (app: HTMLElement, p: Partie) => {
  const h = app.querySelector<HTMLElement>('#horloge');
  if (h) {
    h.innerHTML = horloge(p);
    h.title = periode(p.jour);
  }
};

// --- Objets, sac et journal --------------------------------------------------------

export const ligneObjet = (p: Partie, o: Objet, droite: string) => {
  const fiche = calculerFiche(p.perso);
  const refus = o.type === 'arme' ? peutManier(fiche, o) : o.type === 'armure' ? peutPorter(fiche, o) : null;
  const details = [
    o.degats ? `Dégâts ${o.degats}` : '',
    o.pr ? `PR ${o.pr}${o.emplacement && o.emplacement !== 'torse' ? ` (${o.emplacement === 'tete' ? 'tête' : o.emplacement})` : ''}` : '',
    o.mains === 2 ? '2 mains' : '',
    o.soin ? `Rend ${o.soin} PV` : '',
    formatMods(o.mods),
  ].filter(Boolean);
  return `<div class="objet">
    <div class="objet-texte">
      <b>${echapper(o.nom)}</b>${o.estime ? ' <span class="pastille" title="Valeurs provisoires : aucun tableau officiel">(estimé)</span>' : ''}
      ${details.length ? `<div class="pastille">${echapper(details.join(' · '))}</div>` : ''}
      <div class="note">${echapper(o.description)}</div>
      ${refus ? `<div class="alerte petit-texte">${echapper(refus)}</div>` : ''}
    </div>
    <div class="objet-action">${droite}</div>
  </div>`;
};

/** Les cinq caractéristiques du héros : [nom, valeur avec équipement et blessures, valeur de base]. */
const caracsDuHeros = (p: Partie): [string, number, number][] => {
  const f = calculerFiche(p.perso);
  const v = valeursCombat(p);
  const fo = blessuresActives(p).reduce((s, b) => s + (b.mods.FO ?? 0), 0);
  return [
    ['Courage', v.cou, f.caracs.COU],
    ['Intelligence', f.caracs.INT, f.caracs.INT],
    ['Charisme', v.cha, f.caracs.CHA],
    ['Adresse', v.ad, f.caracs.AD],
    ['Force', f.caracs.FO + fo, f.caracs.FO],
  ];
};

export const panneauSac = (p: Partie, message?: string) => {
  const v = valeursCombat(p);
  const t = valeursTir(p);
  const ids = [...new Set(p.sac)];
  const esquive = modEsquive(v.pr) === null ? null : v.ad + modEsquive(v.pr)!;
  return `<div class="panneau">
    <h2>Sac et équipement</h2>
    <h3>Caractéristiques</h3>
    <div class="valeurs">
      ${caracsDuHeros(p)
        .map(([nom, val, base]) => `<div title="${val === base ? `${nom} ${base}` : `${nom} ${base} de base, ${val - base > 0 ? '+' : ''}${val - base} (équipement, blessures)`}"><b>${val}</b><span>${nom}${val !== base ? ` <span class="modif">(${base})</span>` : ''}</span></div>`)
        .join('')}
    </div>
    <h3>Combat</h3>
    <div class="valeurs">
      <div><b>${p.ev}/${evMax(p)}</b><span>Énergie vitale</span></div>
      ${eaMax(p) ? `<div><b>${ea(p)}/${eaMax(p)}</b><span>Énergie astrale</span></div>` : ''}
      <div><b>${v.at}</b><span>Attaque</span></div>
      <div><b>${v.prd}</b><span>Parade</span></div>
      <div title="Adresse modifiée par l'armure (règles V4, 8.18)"><b>${esquive === null ? '—' : esquive}</b><span>Esquive</span></div>
      <div><b>${echapper(v.degats)}</b><span>Dégâts</span></div>
      <div><b>${v.pr}</b><span>Protection</span></div>
      ${t ? `<div><b>${t.ad}</b><span>Tir (AD)</span></div>` : ''}
    </div>
    ${poupee(p)}
    <h3 style="margin-top:16px">Dans le sac</h3>
    ${
      ids.length
        ? ids
            .map((id) => {
              const o = objet(id);
              const nb = p.sac.filter((x) => x === id).length;
              const cases = apercu(p, id);
              const gauche = cases.find(([k, refus]) => k === 'armeGauche' && !refus);
              const bouton =
                o.type === 'arme' || o.type === 'armure'
                  ? `<button class="secondaire petit equiper" data-id="${id}">${o.type === 'arme' && !o.tir ? 'Main droite' : 'Équiper'}</button>${
                      gauche ? ` <button class="secondaire petit equiper" data-id="${id}" data-vers="armeGauche">Main gauche</button>` : ''
                    }`
                  : o.soin || o.mana
                    ? `<button class="secondaire petit boire" data-id="${id}">${o.type === 'potion' ? 'Boire' : 'Manger'}</button>`
                    : '';
              const ligne = ligneObjet(p, o, `<span class="pastille">×${nb}</span> ${bouton}`);
              return cases.length ? ligne.replace('<div class="objet">', `<div class="objet" tabindex="-1" data-apercu="${echapper(JSON.stringify(cases))}">`) : ligne;
            })
            .join('')
        : '<p class="note">Ton sac est vide. Même pas une chaussette.</p>'
    }
    ${
      blessuresActives(p).length
        ? `<h3>Blessures graves</h3><ul class="blessures">${blessuresActives(p)
            .map(
              (b) =>
                `<li><b>${echapper(b.nom)}</b> <span class="note">${echapper(Object.entries(b.mods).map(([k, v]) => `${k} ${v}`).join(', '))}${b.mv !== undefined ? `, déplacement ${Math.round(b.mv * 100)} %` : ''} · ${
                  b.jusqua === undefined ? 'permanent' : `guérit le ${dateCourte(b.jusqua)}${b.jusqua % 1 ? ` vers ${formatHeure(Math.round((b.jusqua % 1) * 24))}` : ""}`
                }</span></li>`,
            )
            .join('')}</ul><p class="note">Les malus d'AT, PRD, AD, COU et CHA sont déjà comptés ci-dessus.</p>`
        : ''
    }
    ${
      sortsConnus(p).length
        ? `<h3>Sorts connus</h3><ul class="sorts">${sortsConnus(p)
            .map(
              (s) =>
                `<li><b>${echapper(s.nom)}</b> <span class="note">(${echapper(s.ecole)}, niveau ${s.niveau})</span><br /><span class="note">${echapper(s.description)}</span>${
                  s.soin ? ` <button class="secondaire petit" id="soin-magique">✨ Se soigner</button>` : ''
                }</li>`,
            )
            .join('')}</ul>
           <p class="note">MagiePhys ${caracMagie(p, 'MagiePhys')} · MagiePsy ${caracMagie(p, 'MagiePsy')}. Spécialité : magie de combat (choix provisoire, les autres écoles viendront).</p>`
        : ''
    }
    ${panneauCompetences(p)}
    ${message ? `<div class="recit">${message}</div>` : ''}
  </div>`;
};

const cadreDe = (p: Partie): Cadre => (p.donjon ? 'donjon' : p.zone === 'ville' ? 'ville' : 'monde');

const PRISE: Record<Prise, string> = { auto: '✔ appliquée par le jeu', bouton: '▶ à utiliser', seul: '· sans effet en solo', non: '… pas encore de situation' };

/** Les compétences du héros, ce que le jeu en fait, et les boutons de celles qu'on peut utiliser ici. */
const panneauCompetences = (p: Partie) => {
  const cadre = cadreDe(p);
  const actifs = talentsDuHeros(p).filter((t) => !t.cadres || !t.cadres.includes('bivouac'));
  const boutons = actifs
    .map((t) => {
      const refus = empechement(p, t, cadre);
      if (refus === 'pas ici') return '';
      const quoi = t.epreuve ? `épreuve ${t.epreuve(p)} ou moins` : t.jet ? `D${t.jet.faces}` : '';
      return `<div class="talent"><button class="secondaire petit" data-talent="${t.id}" ${refus ? `disabled title="${echapper(refus)}"` : ''}>${echapper(t.libelle)}${quoi ? ` (${quoi})` : ''}</button>
        <span class="de a-lancer" id="de-talent-${t.id}" hidden>?</span>
        <span class="note">${echapper(refus ?? t.aide)}</span></div>`;
    })
    .join('');
  const liste = competencesDuHeros(p)
    .map((n) => {
      const [prise, effet] = priseCompetence(n);
      return `<li class="prise-${prise}"><b>${echapper(n)}</b> <span class="note">${PRISE[prise]}</span><br /><span class="note">${echapper(effet)}</span></li>`;
    })
    .join('');
  return `${boutons ? `<h3>Actions et compétences utilisables ici</h3>${boutons}` : ''}
    <details class="competences-jeu"><summary>Compétences (${competencesDuHeros(p).length}) et ce que le jeu en fait</summary><ul>${liste}</ul></details>`;
};

export const panneauJournal = (p: Partie) => `<div class="panneau">
  <h2>Journal</h2>
  <ul class="journal">${p.journal.map((j) => `<li>${echapper(j)}</li>`).join('')}</ul>
</div>`;

/** Boutons du sac : équiper, retirer, boire. `message` affiche le résultat et redessine. */
export const lierSac = (app: HTMLElement, p: Partie, message: (html: string) => void) => {
  const sur = (sel: string, fn: (el: HTMLElement) => void) =>
    app.querySelectorAll<HTMLElement>(sel).forEach((el) => el.addEventListener('click', () => fn(el)));
  lierGroupe(app, p, message);
  lierPoupee(app);
  sur('.equiper', (el) => {
    const o = objet(el.dataset.id!);
    const refus = equiper(p, o.id, el.dataset.vers as CleEquipement | undefined);
    message(refus ? `<span class="alerte">${echapper(refus)}</span>` : `Tu t'équipes : <b>${echapper(o.nom)}</b>.`);
  });
  sur('.retirer', (el) => {
    desequiper(p, el.dataset.emplacement as CleEquipement);
    message('Rangé dans le sac.');
  });
  sur('#soin-magique', () => {
    const r = soinLeger(p);
    if (typeof r === 'string') return message(echapper(r));
    noter(p, `se soigne par magie (+${r.rendu} PV).`);
    message(`${de(r.de)} Tu poses la main sur ta blessure et murmures la formule. <b>+${r.rendu} PV</b> pour ${r.rendu} PA.`);
  });
  sur('#monter-niveau', () => ouvrirNiveau(p, (texte) => message(texte)));
  sur('[data-talent]', (el) => {
    const t = TALENTS_ACTIFS.find((x) => x.id === el.dataset.talent)!;
    if (empechement(p, t, cadreDe(p))) return;
    (el as HTMLButtonElement).disabled = true;
    const faces = t.jet?.faces ?? 20;
    const valeur = lancer(faces);
    const d = app.querySelector<HTMLElement>(`#de-talent-${t.id}`)!;
    d.hidden = false;
    animerDes([d], faces, [valeur]).then(() =>
      setTimeout(() => {
        const texte = utiliserTalent(p, t.id, valeur);
        message(`${de(valeur)} <b>${echapper(t.libelle)}</b> : ${echapper(texte)}`);
      }, 350),
    );
  });
  sur('.boire', (el) => {
    const r = boirePotion(p, el.dataset.id!);
    if (typeof r === 'string') return message(echapper(r));
    const potion = objet(el.dataset.id!).type === 'potion';
    noter(p, `${potion ? 'boit une potion' : `mange : ${objet(el.dataset.id!).nom},`} et récupère ${r.rendu} ${r.pa ? 'PA' : 'PV'}.`);
    message(`${r.des.map((d) => de(d)).join('')} ${potion ? 'Glou glou…' : 'Miam.'} Tu récupères <b>${r.rendu} ${r.pa ? 'PA' : 'PV'}</b>.`);
  });
};

// --- Passage de niveau --------------------------------------------------------------

const NOM_GAIN: Record<GainNiveau, string> = {
  FO: 'Force',
  AD: 'Adresse',
  COU: 'Courage',
  INT: 'Intelligence',
  AT: 'Attaque',
  PRD: 'Parade',
};

/** Fenêtre du passage de niveau : le joueur lance son D6 d'énergie vitale, puis choisit son gain. */
const ouvrirNiveau = (p: Partie, fini: (texte: string) => void) => {
  const fenetre = document.createElement('div');
  fenetre.className = 'ency';
  fenetre.setAttribute('role', 'dialog');
  const prochain = niveau(p) + 1;
  const gains = gainsPossibles(p);
  let de: number | undefined;
  /** Mages et prêtres : le D6 peut aller à l'énergie astrale plutôt qu'à l'énergie vitale. */
  const astral = eaMax(p) > 0;
  let versEA = false;
  const dessiner = () => {
    fenetre.innerHTML = `<div class="page ency-page niveau">
      <h2>Niveau ${prochain} !</h2>
      <p>L'aventure, ça forge. Règles V4 : à chaque niveau, +1D6 en énergie vitale, puis ${
        prochain % 2 === 0 ? 'un point dans une caractéristique (niveau pair)' : "un point d'Attaque ou de Parade (niveau impair)"
      }.</p>
      <div class="recit lancer-joueur">${astral ? 'Énergie vitale ou astrale' : 'Énergie vitale'} : lance le D6.
        <div>${
          de === undefined
            ? `<span class="de a-lancer" id="de-niveau">?</span><button id="lancer-niveau">Lancer le D6</button>`
            : astral
              ? `<span class="de">${de}</span>
                 <label><input type="radio" name="energie" value="ev" ${versEA ? '' : 'checked'} /> +${de} PV max (survivre)</label>
                 <label><input type="radio" name="energie" value="ea" ${versEA ? 'checked' : ''} /> +${de} PA max (puissance magique)</label>`
              : `<span class="de">${de}</span> <b>+${de} PV max</b>`
        }</div></div>
      ${
        de === undefined
          ? ''
          : `<p>Choisis ton gain :</p><p class="actions-lieu">${gains.map((g) => `<button data-gain="${g}">${NOM_GAIN[g]} +1</button>`).join('')}</p>`
      }
    </div>`;
    fenetre.querySelector('#lancer-niveau')?.addEventListener('click', (e) => {
      (e.target as HTMLButtonElement).disabled = true;
      const v = lancer(6);
      animerDes([fenetre.querySelector<HTMLElement>('#de-niveau')!], 6, [v]).then(() => {
        de = v;
        dessiner();
      });
    });
    fenetre.querySelectorAll<HTMLElement>('[data-gain]').forEach((b) =>
      b.addEventListener('click', () => {
        const gain = b.dataset.gain as GainNiveau;
        versEA = fenetre.querySelector<HTMLInputElement>('input[name=energie]:checked')?.value === 'ea';
        const refus = monterNiveau(p, de!, gain, versEA);
        fenetre.remove();
        document.body.classList.remove('ency-ouverte');
        if (refus) return fini(echapper(refus));
        const energie = `+${de} ${versEA ? 'PA' : 'PV'} max`;
        noter(p, `passe au niveau ${prochain} (${energie}, ${NOM_GAIN[gain]} +1).`);
        fini(`Tu passes au <b>niveau ${prochain}</b> : ${energie} et ${NOM_GAIN[gain]} +1.`);
      }),
    );
  };
  dessiner();
  document.body.append(fenetre);
  document.body.classList.add('ency-ouverte');
};
