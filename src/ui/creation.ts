import {
  ajustementsRequis,
  calculerFiche,
  metierParId,
  origineParId,
  raisonsMetier,
  raisonsOrigine,
  reservesCompetences,
  sansDoublons,
  scoresApresOrigine,
  type Ajustements,
  type Personnage,
  type Sexe,
} from '../rules/creation';
import { descriptionCarac } from '../rules/descriptions';
import { lancer, lancerPlusieurs, somme } from '../rules/des';
import { METIERS, SANS_METIER } from '../rules/metiers';
import { ORIGINES } from '../rules/origines';
import { CARACS, NOM_CARAC, type Carac, type Scores } from '../rules/types';
import { VILLE_DEPART } from '../rules/villes';
import { ecranFiche } from './fiche';
import { animerDes, competence, competences, de, echapper, liste } from './outils';
import { sauvegarder } from './sauvegarde';

const ETAPES = ['Identité', 'Caractéristiques', 'Origine', 'Métier', 'Compétences', 'Ajustements', 'Destin et fortune'] as const;
type Etape = (typeof ETAPES)[number];

interface Brouillon {
  etape: Etape;
  nom: string;
  sexe?: Sexe;
  jets?: Scores;
  /** Scores déjà tirés, une caractéristique après l'autre. */
  tirages: Partial<Scores>;
  relanceUtilisee: boolean;
  origineId?: string;
  versionHB?: number;
  metierId?: string;
  /** Une liste de compétences choisies par réserve. */
  choix: string[][];
  ajustements: Ajustements;
  destin?: number;
  jetDestin?: number;
  jetsOr?: number[][];
  /** Dés à animer au prochain affichage, avec leurs valeurs finales. */
  animation?: { faces: number; valeurs: number[] };
  relanceEnCours?: Carac;
  lancerEnCours?: 'destin' | 'or';
}

export const ecranCreation = (app: HTMLElement, retourAccueil: () => void) => {
  const b: Brouillon = { etape: 'Identité', nom: '', tirages: {}, relanceUtilisee: false, choix: [], ajustements: {} };

  const origine = () => (b.origineId ? origineParId(b.origineId) : undefined);
  const metier = () => (b.metierId ? metierParId(b.metierId) : undefined);
  const scoresOrigine = () => scoresApresOrigine(b.jets!, origine()!, b.versionHB);

  const requis = () => ajustementsRequis(scoresOrigine(), origine()!, metier()!);
  const aDesAjustements = () => {
    const r = requis();
    return r.guerrier || !!r.retraitAjout || r.ranger || r.ogre || r.adresse(b.ajustements);
  };

  const etapesVisibles = (): Etape[] =>
    ETAPES.filter((e) => e !== 'Ajustements' || !b.metierId || aDesAjustements());

  const personnageProvisoire = (): Personnage => ({
    version: 1,
    nom: b.nom.trim(),
    sexe: b.sexe ?? 'Homme',
    jets: b.jets!,
    origineId: b.origineId!,
    versionHB: b.versionHB,
    metierId: b.metierId ?? SANS_METIER.id,
    competencesChoisies: b.choix.flat(),
    ajustements: b.ajustements,
    destin: b.destin ?? 0,
    or: somme((b.jetsOr ?? []).flat()) * 10,
    jetsOr: b.jetsOr ?? [],
  });

  // --- Validation de chaque étape -------------------------------------------

  const etapeValide = (): boolean => {
    switch (b.etape) {
      case 'Identité':
        return b.nom.trim().length > 0 && !!b.sexe;
      case 'Caractéristiques':
        return !!b.jets && !b.animation;
      case 'Origine':
        return !!origine() && (!origine()!.versions || b.versionHB !== undefined);
      case 'Métier':
        return !!b.metierId;
      case 'Compétences': {
        const reserves = reservesCompetences(origine()!, metier()!, acquises());
        return reserves.every((r, i) => (b.choix[i] ?? []).length === Math.min(r.nombre, r.options.length));
      }
      case 'Ajustements': {
        const r = requis();
        const a = b.ajustements;
        if (r.adresse(a) && !a.adresse) return false;
        if (r.guerrier && (!a.guerrierEchange || !a.guerrierBonus)) return false;
        if (r.retraitAjout && (!a.retrait || !a.ajout)) return false;
        return true;
      }
      case 'Destin et fortune':
        return b.destin !== undefined && !!b.jetsOr?.length && !b.animation;
    }
  };

  const acquises = () => {
    const o = origine()!;
    const v = b.versionHB !== undefined ? o.versions?.[b.versionHB] : undefined;
    return sansDoublons([...o.naissance, ...(v?.bonus ?? []), ...metier()!.heritees]);
  };

  // --- Affichage -------------------------------------------------------------

  const render = () => {
    const visibles = etapesVisibles();
    const index = visibles.indexOf(b.etape);
    const contenu = {
      Identité: etapeIdentite,
      Caractéristiques: etapeCaracs,
      Origine: etapeOrigine,
      Métier: etapeMetier,
      Compétences: etapeCompetences,
      Ajustements: etapeAjustements,
      'Destin et fortune': etapeFortune,
    }[b.etape]();

    app.innerHTML = `
      <div class="page">
        <div class="etapes">${visibles
          .map((e, i) => `<span class="${i === index ? 'active' : i < index ? 'faite' : ''}">${i + 1}. ${e}</span>`)
          .join('')}</div>
        ${contenu}
        <div class="actions">
          <button class="secondaire" id="precedent">${index === 0 ? 'Accueil' : 'Précédent'}</button>
          <button class="droite" id="suivant" ${etapeValide() ? '' : 'disabled'}>${
            index === visibles.length - 1 ? 'Voir ma fiche' : 'Suivant'
          }</button>
        </div>
      </div>`;

    app.querySelector('#precedent')!.addEventListener('click', () => {
      if (index === 0) return retourAccueil();
      b.etape = visibles[index - 1];
      render();
    });
    app.querySelector('#suivant')!.addEventListener('click', () => {
      if (!etapeValide()) return;
      if (index === visibles.length - 1) return terminer();
      b.etape = etapesVisibles()[index + 1];
      render();
      window.scrollTo({ top: 0 });
    });
    lier[b.etape]?.();

    if (b.animation) {
      const { faces, valeurs } = b.animation;
      const des = [...app.querySelectorAll<HTMLElement>('.de.a-animer')];
      animerDes(des, faces, valeurs).then(() => {
        b.animation = undefined;
        b.relanceEnCours = undefined;
        b.lancerEnCours = undefined;
        render();
      });
    }
  };

  const terminer = () => {
    const p = personnageProvisoire();
    const enregistre = sauvegarder(p);
    ecranFiche(app, calculerFiche(p), retourAccueil, enregistre);
  };

  // --- Étape 1 : identité ------------------------------------------------------

  const etapeIdentite = () => `
    <h2>Qui es-tu, aventurier ?</h2>
    <p>Commence par le plus facile. Le reste, ce sont les dés qui vont le décider.</p>
    <label for="nom">Nom</label>
    <input type="text" id="nom" maxlength="40" value="${echapper(b.nom)}" placeholder="Par exemple : Gurdil, Mélanie, Tranchelard…" />
    <label style="margin-top:16px">Sexe</label>
    <div class="choix-ligne">
      ${(['Homme', 'Femme'] as Sexe[])
        .map((s) => `<label><input type="radio" name="sexe" value="${s}" ${b.sexe === s ? 'checked' : ''}/><span>${s}</span></label>`)
        .join('')}
    </div>`;

  const lierIdentite = () => {
    const champ = app.querySelector<HTMLInputElement>('#nom')!;
    const suivant = app.querySelector<HTMLButtonElement>('#suivant')!;
    champ.addEventListener('input', () => {
      b.nom = champ.value;
      suivant.disabled = !etapeValide();
    });
    app.querySelectorAll<HTMLInputElement>('input[name=sexe]').forEach((r) =>
      r.addEventListener('change', () => {
        b.sexe = r.value as Sexe;
        suivant.disabled = !etapeValide();
      }),
    );
    if (!b.nom) champ.focus();
  };

  // --- Étape 2 : caractéristiques ------------------------------------------

  /** Un dé par caractéristique, lancé l'un après l'autre pour le suspense. */
  const etapeCaracs = () => {
    const anim = b.animation;
    const prochaine = CARACS.find((c) => b.tirages[c] === undefined);
    const nbOrigines = b.jets ? ORIGINES.filter((o) => raisonsOrigine(b.jets!, o).length === 0).length : 0;
    const ligne = (c: Carac) => {
      const score = b.tirages[c];
      const enCours = anim && b.relanceEnCours === c;
      if (score === undefined) {
        return `<div class="ligne-carac a-venir">
          <div class="nom">${NOM_CARAC[c]}</div>
          <div>${c === prochaine && !anim ? `<button id="lancer">Lancer le dé</button>` : de('?')}</div>
          <div class="valeur">—</div>
          <div class="texte"></div>
        </div>`;
      }
      return `<div class="ligne-carac">
        <div class="nom">${NOM_CARAC[c]}</div>
        <div>${de(enCours ? '?' : score - 7, enCours ? 'a-animer' : '')}</div>
        <div class="valeur">${enCours ? '…' : score}</div>
        <div class="texte">${enCours ? '' : echapper(descriptionCarac(c, score))}${
          b.jets && !anim && !b.relanceUtilisee
            ? ` <button class="secondaire petit relance" data-carac="${c}">Relancer</button>`
            : ''
        }</div>
      </div>`;
    };
    return `
      <h2>Les caractéristiques</h2>
      <p>On lance un D6 pour chaque caractéristique, et on ajoute 7. Un score de 8 est très bas, 10 est dans la moyenne, 13 est exceptionnel.</p>
      <div class="liste-caracs">${CARACS.map(ligne).join('')}</div>
      ${
        b.jets && !anim
          ? `<p>Avec ces scores, <b>${nbOrigines} origine${nbOrigines > 1 ? 's' : ''}</b> sur ${ORIGINES.length} te ${
              nbOrigines > 1 ? 'sont' : 'est'
            } ouverte${nbOrigines > 1 ? 's' : ''}.</p>
            <p class="note">${
              b.relanceUtilisee
                ? 'Tu as déjà utilisé ta relance. Il faudra faire avec !'
                : "Les règles autorisent le MJ à te laisser relancer un seul score. Le nouveau résultat remplace l'ancien, même s'il est pire."
            }</p>`
          : ''
      }`;
  };

  const lancerCarac = (c: Carac) => {
    const d = lancer(6);
    b.tirages[c] = d + 7;
    b.relanceEnCours = c;
    b.animation = { faces: 6, valeurs: [d] };
    b.jets = CARACS.every((x) => b.tirages[x] !== undefined) ? ({ ...b.tirages } as Scores) : undefined;
  };

  const lierCaracs = () => {
    app.querySelector('#lancer')?.addEventListener('click', () => {
      lancerCarac(CARACS.find((c) => b.tirages[c] === undefined)!);
      render();
    });
    app.querySelectorAll<HTMLButtonElement>('.relance').forEach((btn) =>
      btn.addEventListener('click', () => {
        b.relanceUtilisee = true;
        lancerCarac(btn.dataset.carac as Carac);
        // Les scores ont changé : les choix qui en dépendent sont à refaire.
        reinitialiserDepuis('origine');
        render();
      }),
    );
  };

  // --- Étape 3 : origine -----------------------------------------------------

  const ficheTechnique = (lignes: [string, string][]) =>
    `<div class="valeurs">${lignes.map(([t, v]) => `<div><b>${echapper(v)}</b><span>${echapper(t)}</span></div>`).join('')}</div>`;

  const etapeOrigine = () => {
    const o = origine();
    const version = o && b.versionHB !== undefined ? o.versions?.[b.versionHB] : undefined;
    return `
      <h2>L'origine</h2>
      <p>Ton peuple de naissance. Seules les origines compatibles avec tes caractéristiques sont possibles.</p>
      <div class="grille">${ORIGINES.map((x) => {
        const raisons = raisonsOrigine(b.jets!, x);
        return `<button class="carte ${x.id === b.origineId ? 'choisie' : ''} ${raisons.length ? 'interdite' : ''}" data-id="${x.id}" ${
          raisons.length ? 'disabled' : ''
        }>
          <strong>${echapper(x.nom)}</strong>
          <small>${echapper(raisons.length ? 'Il faut : ' + raisons.join(', ') : x.surnom)}</small>
        </button>`;
      }).join('')}</div>
      ${
        o
          ? `<div class="detail-choix">
              <h3>${echapper(o.nom)} : ${echapper(o.surnom)}</h3>
              <p>${echapper(o.description)}</p>
              ${ficheTechnique([
                ['Énergie vitale', String(version?.ev ?? o.ev) + (o.evParNiveau ? ` (+${o.evParNiveau}/niv.)` : '')],
                ['AT / PRD de départ', (o.atPrd ?? [8, 10]).join(' / ')],
                ['Armure max', o.prMax === null ? 'Aucune limite' : `PR ${o.prMax}`],
                ['Charge', o.charge],
              ])}
              ${
                o.versions
                  ? version
                    ? `<p><b>Ta version : ${echapper(version.nom)}</b> (${de(b.versionHB! + 1, b.animation ? 'a-animer' : '')}). ${
                        b.animation ? '' : echapper(describeMods(version.mods) + ' ' + version.note)
                      }</p>`
                    : `<p class="alerte">L'Homme-Bête existe en 6 versions. Lance le D6 pour savoir laquelle tu es.</p>
                       <p><button id="version">Lancer le D6</button></p>`
                  : ''
              }
              <div class="colonnes">
                <div><h3>Compétences de naissance</h3>${competences([...o.naissance, ...(version?.bonus ?? [])])}</div>
                <div><h3>Compétences au choix</h3>${o.auChoix.length ? competences(o.auChoix) : '<p class="note">Un Humain peut choisir parmi presque toutes les compétences.</p>'}</div>
              </div>
              <h3>Restrictions</h3>${liste(o.restrictions)}
              <p class="note">Ville de départ : ${echapper(VILLE_DEPART[o.id])}.</p>
            </div>`
          : ''
      }`;
  };

  const describeMods = (mods: Partial<Scores>) =>
    CARACS.filter((c) => mods[c])
      .map((c) => `${c} ${mods[c]! > 0 ? '+' : ''}${mods[c]}`)
      .join(', ') + '.';

  const reinitialiserDepuis = (quoi: 'origine' | 'metier') => {
    if (quoi === 'origine') {
      b.origineId = undefined;
      b.versionHB = undefined;
    }
    b.metierId = undefined;
    b.choix = [];
    b.ajustements = {};
  };

  const lierOrigine = () => {
    app.querySelectorAll<HTMLButtonElement>('.grille .carte').forEach((btn) =>
      btn.addEventListener('click', () => {
        if (btn.dataset.id === b.origineId) return;
        reinitialiserDepuis('origine');
        b.origineId = btn.dataset.id;
        render();
      }),
    );
    app.querySelector('#version')?.addEventListener('click', () => {
      const d = lancer(6);
      b.versionHB = d - 1;
      b.animation = { faces: 6, valeurs: [d] };
      render();
    });
  };

  // --- Étape 4 : métier ------------------------------------------------------

  const etapeMetier = () => {
    const o = origine()!;
    const scores = scoresOrigine();
    const m = metier();
    return `
      <h2>Le métier</h2>
      <p>Ce que ton ${echapper(o.nom)} a appris à faire avant de partir à l'aventure. On peut aussi partir sans métier et en choisir un au niveau 3.</p>
      <div class="grille">${[SANS_METIER, ...METIERS]
        .map((x) => {
          const raisons = raisonsMetier(scores, o, x);
          return `<button class="carte ${x.id === b.metierId ? 'choisie' : ''} ${raisons.length ? 'interdite' : ''}" data-id="${x.id}" ${
            raisons.length ? 'disabled' : ''
          }>
          <strong>${echapper(x.nom)}</strong>
          <small>${echapper(raisons.length ? 'Il faut : ' + raisons.join(', ') : x.evTexte === "Selon l'origine" ? 'Ouvert' : `EV : ${x.evTexte.toLowerCase()}`)}</small>
        </button>`;
        })
        .join('')}</div>
      ${
        m
          ? `<div class="detail-choix">
              <h3>${echapper(m.nom)}</h3>
              <p>${echapper(m.description)}</p>
              ${ficheTechnique([
                ['Énergie vitale', m.evTexte],
                ...(m.ea ? ([['Énergie astrale', String(m.ea)]] as [string, string][]) : []),
                ['AT / PRD de départ', m.atPrd ? m.atPrd.join(' / ') : "Celles de l'origine"],
                ['Armure max', m.prMax === null ? (m.prBonus ? `Origine +${m.prBonus}` : "Celle de l'origine") : `PR ${m.prMax}`],
              ])}
              ${m.bonus.length ? `<h3>Particularités</h3>${liste(m.bonus)}` : ''}
              ${
                m.id === SANS_METIER.id
                  ? ''
                  : `<div class="colonnes">
                      <div><h3>Compétences héritées</h3>${competences(m.heritees)}</div>
                      <div><h3>Compétences au choix</h3>${competences(m.auChoix)}</div>
                    </div>
                    <h3>Restrictions</h3>${liste(m.restrictions)}`
              }
            </div>`
          : ''
      }`;
  };

  const lierMetier = () => {
    app.querySelectorAll<HTMLButtonElement>('.grille .carte').forEach((btn) =>
      btn.addEventListener('click', () => {
        if (btn.dataset.id === b.metierId) return;
        reinitialiserDepuis('metier');
        b.metierId = btn.dataset.id;
        render();
      }),
    );
  };

  // --- Étape 5 : compétences -------------------------------------------------

  const etapeCompetences = () => {
    const reserves = reservesCompetences(origine()!, metier()!, acquises());
    const prises = new Set(b.choix.flat());
    return `
      <h2>Les compétences</h2>
      <p>Ton héros sait déjà faire certaines choses (ou en subit d'autres). Clique sur une compétence pour lire sa description.</p>
      <div class="colonnes">
        <div>
          <h3>Ce que tu as déjà</h3>
          ${competences(acquises())}
        </div>
        <div>
          <h3>Tes caractéristiques</h3>
          <div class="mini-caracs">${CARACS.map((c) => {
            const s = scoresOrigine()[c];
            return `<div title="${echapper(descriptionCarac(c, s))}"><span>${NOM_CARAC[c]}</span><b>${s}</b></div>`;
          }).join('')}</div>
          <p class="note">Une compétence notée (AD) ou (INT) s'appuie sur cette caractéristique lors des épreuves.</p>
        </div>
      </div>
      ${reserves
        .map((r, i) => {
          const choisies = b.choix[i] ?? [];
          const nombre = Math.min(r.nombre, r.options.length);
          return `<h3 style="margin-top:20px">${echapper(r.titre)} : choisis-en ${nombre} (${choisies.length}/${nombre})</h3>
            <div class="colonnes">${r.options
              .map((n) => {
                const cochee = choisies.includes(n);
                const bloquee = !cochee && (choisies.length >= nombre || prises.has(n));
                return `<div style="display:flex;gap:8px;align-items:baseline">
                  <input type="checkbox" aria-label="Choisir ${echapper(n)}" data-reserve="${i}" value="${echapper(n)}" ${cochee ? 'checked' : ''} ${bloquee ? 'disabled' : ''}/>
                  <div style="flex:1">${competence(n)}</div></div>`;
              })
              .join('')}</div>`;
        })
        .join('')}`;
  };

  const lierCompetences = () => {
    app.querySelectorAll<HTMLInputElement>('input[type=checkbox][data-reserve]').forEach((cb) =>
      cb.addEventListener('change', () => {
        const i = Number(cb.dataset.reserve);
        const liste = (b.choix[i] ??= []);
        if (cb.checked) liste.push(cb.value);
        else b.choix[i] = liste.filter((n) => n !== cb.value);
        render();
      }),
    );
  };

  // --- Étape 6 : ajustements -------------------------------------------------

  const radios = (nom: keyof Ajustements, options: [string, string][]) =>
    `<div class="choix-ligne">${options
      .map(
        ([v, t]) =>
          `<label><input type="radio" name="${nom}" value="${v}" ${String(b.ajustements[nom]) === v ? 'checked' : ''}/><span>${t}</span></label>`,
      )
      .join('')}</div>`;

  const etapeAjustements = () => {
    const r = requis();
    const a = b.ajustements;
    const f = calculerFiche(personnageProvisoire());
    const blocs: string[] = [];

    if (r.guerrier) {
      blocs.push(`<h3>Entraînement du guerrier</h3>
        <p>Tu peux échanger 1 point entre l'Attaque et la Parade.</p>
        ${radios('guerrierEchange', [['aucun', 'Pas d\'échange'], ['PRD>AT', '1 point de PRD vers l\'AT'], ['AT>PRD', '1 point d\'AT vers la PRD']])}
        <p>Puis tu gagnes +1 :</p>
        ${radios('guerrierBonus', [['AT', 'en Attaque'], ['PRD', 'en Parade']])}`);
    }
    if (r.retraitAjout) {
      blocs.push(`<h3>${metier()!.nom}</h3>
        <p>Ta formation t'a éloigné des combats. Retire 1 point :</p>
        ${radios('retrait', [['AT', 'à l\'Attaque'], ['PRD', 'à la Parade']])}
        <p>Et ajoute 1 point :</p>
        ${radios('ajout', r.retraitAjout.map((c) => [c, `en ${NOM_CARAC[c]}`]))}`);
    }
    if (r.ranger) {
      const options = `<option value="">—</option>${CARACS.map((c) => `<option value="${c}">${NOM_CARAC[c]}</option>`).join('')}`;
      blocs.push(`<h3>Polyvalence du ranger (facultatif)</h3>
        <p>Tu peux retirer 1 point à une caractéristique pour l'ajouter à une autre.</p>
        <p>Retirer à <select id="rangerDe">${options}</select> pour ajouter à <select id="rangerVers">${options}</select></p>`);
    }
    if (r.ogre) {
      const at = a.ogreAT ?? 0;
      const prd = a.ogrePRD ?? 0;
      blocs.push(`<h3>Super-bourrin (facultatif)</h3>
        <p>L'Ogre peut retirer jusqu'à 3 points à son Attaque et à sa Parade pour les ajouter à ses dégâts. Ce choix est définitif.</p>
        <p>Points pris à l'AT : ${radios('ogreAT', ['0', '1', '2', '3'].filter((v) => Number(v) + prd <= 3).map((v) => [v, v]))}</p>
        <p>Points pris à la PRD : ${radios('ogrePRD', ['0', '1', '2', '3'].filter((v) => Number(v) + at <= 3).map((v) => [v, v]))}</p>`);
    }
    if (r.adresse(a)) {
      const ad = f.caracs.AD;
      blocs.push(`<h3>Adresse ${ad > 12 ? 'exceptionnelle' : 'catastrophique'}</h3>
        <p>Avec ${ad} en Adresse, tu as ${ad > 12 ? '+1' : '-1'} à appliquer :</p>
        ${radios('adresse', [['AT', 'sur l\'Attaque'], ['PRD', 'sur la Parade']])}`);
    }

    return `<h2>Les ajustements</h2>
      <p>Quelques règles de ton origine et de ton métier te laissent choisir où mettre tes points.</p>
      ${blocs.join('')}
      ${ficheTechnique([
        ['Attaque', String(f.at)],
        ['Parade', String(f.prd)],
        ['Bonus de dégâts', (f.bonusDegats >= 0 ? '+' : '') + f.bonusDegats],
        ...CARACS.map((c) => [NOM_CARAC[c], String(f.caracs[c])] as [string, string]),
      ])}`;
  };

  const lierAjustements = () => {
    app.querySelectorAll<HTMLInputElement>('.choix-ligne input[type=radio]').forEach((r) =>
      r.addEventListener('change', () => {
        const nom = r.name as keyof Ajustements;
        (b.ajustements as Record<string, unknown>)[nom] = nom === 'ogreAT' || nom === 'ogrePRD' ? Number(r.value) : r.value;
        // Une adresse modifiée peut faire apparaître ou disparaître le choix lié à l'Adresse.
        if (!requis().adresse(b.ajustements)) delete b.ajustements.adresse;
        render();
      }),
    );
    for (const id of ['rangerDe', 'rangerVers'] as const) {
      const sel = app.querySelector<HTMLSelectElement>(`#${id}`);
      if (!sel) continue;
      sel.value = b.ajustements[id] ?? '';
      sel.addEventListener('change', () => {
        b.ajustements[id] = (sel.value || undefined) as Carac | undefined;
        if (!requis().adresse(b.ajustements)) delete b.ajustements.adresse;
        render();
      });
    }
  };

  // --- Étape 7 : destin et fortune -------------------------------------------

  const etapeFortune = () => {
    const m = metier()!;
    const anim = b.animation;
    const animDestin = anim && b.lancerEnCours === 'destin';
    const animOr = anim && b.lancerEnCours === 'or';
    const or = somme((b.jetsOr ?? []).flat()) * 10;
    return `
      <h2>Destin et fortune</h2>
      <h3>Points de destin</h3>
      <p>Chaque point de destin peut te sauver la vie. On lance 1D4 et on retire 1 : de 0 à 3. Oui, les guignards n'en ont pas.</p>
      ${
        b.jetDestin === undefined
          ? '<p><button id="destin">Lancer 1D4</button></p>'
          : `<p>${de(animDestin ? '?' : b.jetDestin, animDestin ? 'a-animer' : '')} ${
              animDestin ? '' : `− 1 = <b>${b.destin} point${b.destin! > 1 ? 's' : ''} de destin</b>${b.destin === 0 ? '. Aïe.' : '.'}`
            }</p>`
      }
      <h3>Fortune de départ</h3>
      <p>On lance 2D6 et on multiplie par 10 : c'est ton pécule en pièces d'or, et ta classe sociale.${
        m.fortuneDouble ? ' En tant que noble, tu tires ta fortune deux fois.' : ''
      }</p>
      ${
        !b.jetsOr?.length
          ? '<p><button id="or">Lancer 2D6</button></p>'
          : `<p>${b.jetsOr
              .map((paire) => paire.map((d) => de(animOr ? '?' : d, animOr ? 'a-animer' : '')).join(''))
              .join(' + ')} ${animOr ? '' : `× 10 = <b>${or} pièces d'or</b>. ${classeSociale(or, m.fortuneDouble)}`}</p>`
      }`;
  };

  const classeSociale = (or: number, noble?: boolean) => {
    if (noble) return 'La fortune familiale, ça aide.';
    if (or <= 40) return "Roturier, paysan ou orphelin : tu as mis un peu d'or de côté (ou fait les poches d'un vagabond).";
    if (or <= 80) return 'Classe moyenne. Ni riche, ni miséreux.';
    return "Fils de noble, héritier ou voleur très doué : tu pars bien équipé.";
  };

  const lierFortune = () => {
    app.querySelector('#destin')?.addEventListener('click', () => {
      const d = lancer(4);
      b.jetDestin = d;
      b.destin = d - 1;
      b.lancerEnCours = 'destin';
      b.animation = { faces: 4, valeurs: [d] };
      render();
    });
    app.querySelector('#or')?.addEventListener('click', () => {
      const tirages = metier()!.fortuneDouble ? 2 : 1;
      b.jetsOr = Array.from({ length: tirages }, () => lancerPlusieurs(2, 6));
      b.lancerEnCours = 'or';
      b.animation = { faces: 6, valeurs: b.jetsOr.flat() };
      render();
    });
  };

  const lier: Partial<Record<Etape, () => void>> = {
    Identité: lierIdentite,
    Caractéristiques: lierCaracs,
    Origine: lierOrigine,
    Métier: lierMetier,
    Compétences: lierCompetences,
    Ajustements: lierAjustements,
    'Destin et fortune': lierFortune,
  };

  render();
};
