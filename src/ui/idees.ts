import { calculerFiche } from '../rules/creation';
import { objet, OBJETS } from '../rules/objets';
import { passerTemps, valeursCombat, type Partie } from '../rules/partie';
import { ligneEnnemi, nomsEnnemis, type Rencontre } from '../rules/rencontres';
import { animerDes, echapper } from './outils';

// Les idées des joueurs : un bouton « J'aurais fait autrement » sous chaque choix ouvre une saisie libre.
// Les idées sont partagées (base de données de l'artifact) quand la page le permet, sinon gardées sur
// l'appareil. Le bouton « Idées » les liste ; le MJ (qui peut modifier la page) en valide certaines en
// précisant l'épreuve et les résultats : elles deviennent alors des choix jouables dans le jeu.

export type TypeContexte = 'evenement' | 'rencontre' | 'combat' | 'lieu' | 'proposition' | 'autre';

export interface Contexte {
  type: TypeContexte;
  /** Identifiant stable (id d'événement, nom de la rencontre, id du lieu…). */
  id: string;
  titre: string;
}

export type CaracEpreuve = 'COU' | 'INT' | 'CHA' | 'AD' | 'FO' | 'AT' | 'PRD';

export interface Idee {
  id: string;
  contexte: Contexte;
  texte: string;
  date: string;
  statut: 'proposee' | 'validee' | 'refusee';
  /** Locale : gardée seulement dans ce navigateur. */
  locale?: boolean;
  // Réglages du MJ à la validation.
  libelle?: string;
  epreuve?: CaracEpreuve | null;
  modif?: number;
  reussite?: string;
  echec?: string;
  pvReussite?: number;
  orReussite?: number;
  pvEchec?: number;
  orEchec?: number;
  // Effets ajoutés le 30/10 : énergie astrale, expérience, temps, objets gagnés, rencontre sur un échec.
  eaReussite?: number;
  eaEchec?: number;
  xpReussite?: number;
  heuresReussite?: number;
  heuresEchec?: number;
  /** Objets donnés au héros si c'est réussi (identifiants du catalogue). */
  objetsReussite?: string[];
  /** Un échec tourne à la bagarre. */
  rencontreEchec?: { nom: string; nombre: number } | null;
}

export const NOM_EPREUVE: Record<CaracEpreuve, string> = {
  COU: 'Courage',
  INT: 'Intelligence',
  CHA: 'Charisme',
  AD: 'Adresse',
  FO: 'Force',
  AT: 'Attaque',
  PRD: 'Parade',
};

/** Valeur à ne pas dépasser au D20 pour l'épreuve d'une idée validée. */
export const valeurEpreuve = (p: Partie, idee: Idee): number => {
  const v = valeursCombat(p);
  const f = calculerFiche(p.perso);
  const base = { COU: v.cou, INT: f.caracs.INT, CHA: v.cha, AD: v.ad, FO: f.caracs.FO, AT: v.at, PRD: v.prd }[idee.epreuve ?? 'CHA'];
  return base + (idee.modif ?? 0);
};

// --- Stockage ------------------------------------------------------------------------

const CLE_LOCALE = 'naheulbeuk.idees';
const COLLECTION = 'idees';

interface Db {
  collection(path: string): {
    add(data: Record<string, unknown>): Promise<unknown>;
    doc(id: string): { update(data: Record<string, unknown>): Promise<void>; delete(): Promise<void> };
    onSnapshot(next: (s: { docs: { id: string; data(): Record<string, unknown> | undefined }[] }) => void, err?: (e: unknown) => void): () => void;
  };
}
interface User {
  canEdit(): Promise<boolean>;
}
type ClaudeUse = { use(name: string): Promise<unknown> };

let db: Db | null = null;
let peutValider = false;
let partagees: Idee[] = [];
const auChangement: (() => void)[] = [];

const lireLocales = (): Idee[] => {
  try {
    return JSON.parse(localStorage.getItem(CLE_LOCALE) ?? '[]') as Idee[];
  } catch {
    return [];
  }
};

const ecrireLocales = (idees: Idee[]) => {
  try {
    localStorage.setItem(CLE_LOCALE, JSON.stringify(idees));
    return true;
  } catch {
    return false;
  }
};

export const toutesIdees = (): Idee[] => [...partagees, ...lireLocales()].sort((a, b) => b.date.localeCompare(a.date));

/** Idées validées par le MJ pour ce contexte : elles deviennent des choix jouables. */
export const ideesValidees = (type: TypeContexte, id: string) =>
  toutesIdees().filter((i) => i.statut === 'validee' && i.contexte.type === type && i.contexte.id === id);

export const surChangement = (fn: () => void) => auChangement.push(fn);
const prevenir = () => auChangement.forEach((fn) => fn());

const connecter = async () => {
  const claude = (window as unknown as { claude?: ClaudeUse }).claude;
  if (!claude?.use) return;
  try {
    db = (await claude.use('db')) as Db | null;
    const user = (await claude.use('user')) as User | null;
    peutValider = (await user?.canEdit()) ?? false;
  } catch {
    db = null;
  }
  if (!db) return;
  db.collection(COLLECTION).onSnapshot(
    (s) => {
      partagees = s.docs.map((d) => ({ ...(d.data() as unknown as Idee), id: d.id }));
      prevenir();
    },
    () => (db = null),
  );
};

const enregistrer = async (idee: Omit<Idee, 'id'>): Promise<'partagee' | 'locale' | 'echec'> => {
  if (db) {
    try {
      await db.collection(COLLECTION).add({ ...idee });
      return 'partagee';
    } catch {
      // Pas le droit d'écrire (visiteur en lecture seule) : on garde l'idée sur l'appareil.
    }
  }
  const locales = lireLocales();
  locales.push({ ...idee, id: `local-${Date.now()}`, locale: true });
  return ecrireLocales(locales) ? 'locale' : 'echec';
};

const modifier = async (idee: Idee, champs: Partial<Idee>) => {
  if (idee.locale) {
    ecrireLocales(lireLocales().map((i) => (i.id === idee.id ? { ...i, ...champs } : i)));
    prevenir();
    return;
  }
  await db?.collection(COLLECTION).doc(idee.id).update({ ...champs });
};

// --- Bouton « J'aurais fait autrement » -----------------------------------------------

export const boutonAutrement = (c: Contexte) =>
  `<button class="lien-idee" data-autrement="${echapper(JSON.stringify(c))}">💡 J'aurais fait autrement</button>`;

const fenetre = document.createElement('div');
fenetre.className = 'ency idees';
fenetre.hidden = true;
fenetre.setAttribute('role', 'dialog');

const fermer = () => {
  fenetre.hidden = true;
  document.body.classList.remove('ency-ouverte');
};

const ouvrir = (html: string) => {
  fenetre.innerHTML = `<div class="page ency-page">
    <div class="barre-fermer"><button class="secondaire petit fermer" data-fermer-idees aria-label="Fermer">✕</button></div>
    ${html}
  </div>`;
  fenetre.hidden = false;
  document.body.classList.add('ency-ouverte');
};

const saisie = (c: Contexte) => {
  ouvrir(`<h2>J'aurais fait autrement</h2>
    <p class="sous-titre">Vos idées nous intéressent, alimentez l'algorithme !</p>
    <p class="note">À propos de : <b>${echapper(c.titre)}</b></p>
    <textarea id="idee-texte" rows="5" maxlength="1000" placeholder="Raconte ce que ton héros aurait fait, et comment ça aurait pu tourner…"></textarea>
    <label class="champ-prerequis">Prérequis (facultatif) <input id="idee-prerequis" maxlength="200" placeholder="Avoir une corde ; être elfe ; Charisme 12 ou plus…" /></label>
    <p class="actions-lieu"><button id="idee-envoyer">Envoyer l'idée</button><button class="secondaire" data-fermer-idees>Annuler</button></p>
    <p id="idee-retour" class="note" aria-live="polite"></p>`);
  const champ = fenetre.querySelector<HTMLTextAreaElement>('#idee-texte')!;
  champ.focus();
  fenetre.querySelector('#idee-envoyer')!.addEventListener('click', async (e) => {
    const texte = champ.value.trim();
    const retour = fenetre.querySelector('#idee-retour')!;
    if (texte.length < 3) {
      retour.textContent = 'Écris au moins quelques mots.';
      return;
    }
    (e.target as HTMLButtonElement).disabled = true;
    const prerequis = fenetre.querySelector<HTMLInputElement>('#idee-prerequis')!.value.trim();
    const res = await enregistrer({ contexte: c, texte: prerequis ? `Prérequis : ${prerequis}\n\n${texte}` : texte, date: new Date().toISOString(), statut: 'proposee' });
    prevenir();
    retour.textContent =
      res === 'partagee'
        ? 'Merci ! Ton idée est partagée avec le MJ.'
        : res === 'locale'
          ? "Merci ! Ton idée est gardée dans ce navigateur (la page ne te permet pas encore de la partager)."
          : "Impossible d'enregistrer l'idée dans ce navigateur.";
    setTimeout(fermer, 1600);
  });
};

// --- Bouton « Idées » : liste et validation --------------------------------------------

const NOM_TYPE: Record<TypeContexte, string> = {
  evenement: 'Événements',
  rencontre: 'Rencontres',
  combat: 'Combats',
  lieu: 'Lieux',
  proposition: 'Rencontres, événements et quêtes proposés',
  autre: 'Divers',
};

const STATUT: Record<Idee['statut'], string> = { proposee: 'proposée', validee: 'validée', refusee: 'refusée' };

const OU_PROPOSITION = ['Campagne paisible (Valtordu, Loubet)', 'Terres sauvages', 'Forêt', 'En ville', 'Dans un donjon', "N'importe où"];

/** Proposer une quête : qui la donne, ce qu'il faut faire étape par étape, comment elle finit. */
const saisieQuete = () => {
  ouvrir(`<h2>Proposer une quête</h2>
    <p class="sous-titre">Vos idées nous intéressent, alimentez l'algorithme !</p>
    <form id="proposition" class="valider-idee">
      <label>Titre <input name="titre" maxlength="80" required placeholder="Le mouton disparu de la mère Michu" /></label>
      <label>Qui la donne, et où <input name="ou" maxlength="120" required placeholder="La mère Michu, à la ferme près de Valtordu" /></label>
      <label>Ce qu'il faut faire, une étape par ligne <textarea name="texte" rows="5" maxlength="2000" required placeholder="Chercher des traces dans la forêt d'Ouien (épreuve d'Intelligence)&#10;Affronter le loup qui garde le mouton&#10;Ramener le mouton à la ferme"></textarea></label>
      <label>Comment elle finit, et la récompense <textarea name="suite" rows="3" maxlength="1500" placeholder="La mère Michu pleure de joie : 20 PO et un pull de Valtordu."></textarea></label>
      <label>Prérequis (facultatif) <input name="prerequis" maxlength="200" placeholder="Avoir fini la quête des rats ; être nain ; savoir nager…" /></label>
      <label>Niveau conseillé <input name="niveau" type="number" min="1" max="20" value="1" /></label>
      <p class="actions-lieu"><button type="submit">Envoyer la quête</button><button type="button" class="secondaire" data-fermer-idees>Annuler</button></p>
      <p id="idee-retour" class="note" aria-live="polite"></p>
    </form>`);
  envoyerProposition((d) => ({
    genre: 'Quête',
    ou: `${String(d.get('ou') ?? '').trim()}, niveau ${d.get('niveau')}`,
    etiquette: 'Étapes',
  }));
};

/** Proposer une nouvelle rencontre ou un nouvel événement, pas seulement réagir à ceux du jeu. */
const saisieProposition = () => {
  ouvrir(`<h2>Proposer une rencontre ou un événement</h2>
    <p class="sous-titre">Vos idées nous intéressent, alimentez l'algorithme !</p>
    <form id="proposition" class="valider-idee">
      <label>Quoi <select name="genre"><option value="Rencontre">Une rencontre (créature, PNJ, bande…)</option><option value="Événement">Un événement (trouvaille, piège, scène…)</option></select></label>
      <label>Où <select name="ou">${OU_PROPOSITION.map((o) => `<option>${echapper(o)}</option>`).join('')}</select></label>
      <label>Titre <input name="titre" maxlength="80" required placeholder="Le colporteur de fromages maudits" /></label>
      <label>Ce qui se passe <textarea name="texte" rows="4" maxlength="1500" required placeholder="Sur la route, un colporteur propose…"></textarea></label>
      <label>Prérequis (facultatif) <input name="prerequis" maxlength="200" placeholder="De nuit seulement ; niveau 3 ; avoir une corde…" /></label>
      <label>Les choix possibles et ce qu'ils donnent (facultatif) <textarea name="suite" rows="3" maxlength="1500" placeholder="Acheter : épreuve de Charisme… Fuir : …"></textarea></label>
      <p class="actions-lieu"><button type="submit">Envoyer la proposition</button><button type="button" class="secondaire" data-fermer-idees>Annuler</button></p>
      <p id="idee-retour" class="note" aria-live="polite"></p>
    </form>`);
  envoyerProposition((d) => ({ genre: String(d.get('genre')), ou: String(d.get('ou')), etiquette: '' }));
};

/** Enregistre le formulaire de proposition affiché (rencontre, événement ou quête). */
const envoyerProposition = (lire: (d: FormData) => { genre: string; ou: string; etiquette: string }) => {
  const f = fenetre.querySelector<HTMLFormElement>('#proposition')!;
  f.querySelector<HTMLInputElement>('[name=titre]')!.focus();
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const d = new FormData(f);
    const { genre, ou, etiquette } = lire(d);
    const titre = String(d.get('titre') ?? '').trim();
    const texte = String(d.get('texte') ?? '').trim();
    const suite = String(d.get('suite') ?? '').trim();
    const prerequis = String(d.get('prerequis') ?? '').trim();
    const retour = f.querySelector('#idee-retour')!;
    if (titre.length < 3 || texte.length < 3) {
      retour.textContent = 'Donne au moins un titre et quelques mots sur ce qui se passe.';
      return;
    }
    f.querySelector<HTMLButtonElement>('button[type=submit]')!.disabled = true;
    const corps = etiquette ? `${etiquette} :\n${texte}` : texte;
    const res = await enregistrer({
      contexte: { type: 'proposition', id: `${genre}|${ou}`, titre: `${genre} : ${titre} (${ou})` },
      texte: [prerequis ? `Prérequis : ${prerequis}` : '', corps, suite ? `${genre === 'Quête' ? 'Fin et récompense' : 'Choix'} : ${suite}` : '']
        .filter(Boolean)
        .join('\n\n'),
      date: new Date().toISOString(),
      statut: 'proposee',
    });
    prevenir();
    retour.textContent =
      res === 'partagee' ? 'Merci ! Ta proposition est partagée avec le MJ.' : res === 'locale' ? 'Merci ! Ta proposition est gardée dans ce navigateur.' : "Impossible d'enregistrer la proposition.";
    setTimeout(liste, 1600);
  });
};

const ONGLETS = [
  ['epreuve', 'Épreuve'],
  ['reussite', 'Réussite'],
  ['gain', 'Gain'],
  ['echec', 'Échec'],
  ['rencontres', 'Rencontres'],
] as const;

const chiffre = (nom: string, libelle: string, valeur: number | undefined, min: number, max: number) =>
  `<label>${libelle} <input name="${nom}" type="number" min="${min}" max="${max}" value="${valeur ?? 0}" /></label>`;

/** Le formulaire du MJ pour rendre une idée jouable : épreuve, effets en cas de réussite ou d'échec, objets gagnés, rencontre. */
const formulaireValidation = (i: Idee) => `<form class="valider-idee" data-idee="${echapper(i.id)}">
    <div class="onglets-idee" role="tablist">${ONGLETS.map(
      ([id, nom], k) => `<button type="button" class="petit ${k ? 'secondaire' : ''}" data-onglet="${id}" role="tab">${nom}</button>`,
    ).join('')}</div>
    <section data-section="epreuve">
      <label>Libellé du choix dans le jeu <input name="libelle" maxlength="120" value="${echapper(i.libelle ?? i.texte.slice(0, 80))}" /></label>
      <label>Épreuve au D20 <select name="epreuve">
        <option value="">Aucune (réussite automatique)</option>
        ${(Object.keys(NOM_EPREUVE) as CaracEpreuve[]).map((k) => `<option value="${k}" ${i.epreuve === k ? 'selected' : ''}>${NOM_EPREUVE[k]}</option>`).join('')}
      </select></label>
      <label>Bonus ou malus à l'épreuve <input name="modif" type="number" min="-10" max="10" value="${i.modif ?? 0}" /></label>
    </section>
    <section data-section="reussite" hidden>
      <label>Ce qui se passe <textarea name="reussite" rows="2">${echapper(i.reussite ?? '')}</textarea></label>
      <div class="ligne-chiffres">${chiffre('pvReussite', 'PV', i.pvReussite, -30, 30)}${chiffre('orReussite', 'PO', i.orReussite, -500, 500)}${chiffre('eaReussite', 'PA (énergie astrale)', i.eaReussite, -50, 50)}</div>
      <div class="ligne-chiffres">${chiffre('xpReussite', 'XP', i.xpReussite, 0, 500)}${chiffre('heuresReussite', 'Heures passées', i.heuresReussite, 0, 24)}</div>
      <p class="note">Les objets gagnés se choisissent dans l'onglet « Gain ».</p>
    </section>
    <section data-section="gain" hidden>
      <input type="hidden" name="objetsReussite" value="${echapper(JSON.stringify(i.objetsReussite ?? []))}" />
      <div class="choisis" data-choisis></div>
      <label>Chercher dans l'encyclopédie <input type="search" data-chercher-objet placeholder="potion, épée, corde…" /></label>
      <div class="resultats-recherche" data-resultats-objets></div>
    </section>
    <section data-section="echec" hidden>
      <label>Ce qui se passe <textarea name="echec" rows="2">${echapper(i.echec ?? '')}</textarea></label>
      <div class="ligne-chiffres">${chiffre('pvEchec', 'PV', i.pvEchec, -30, 30)}${chiffre('orEchec', 'PO', i.orEchec, -500, 500)}${chiffre('eaEchec', 'PA (énergie astrale)', i.eaEchec, -50, 50)}</div>
      <div class="ligne-chiffres">${chiffre('heuresEchec', 'Heures perdues', i.heuresEchec, 0, 24)}</div>
      <p class="note">Pour qu'un échec tourne à la bagarre, choisis l'adversaire dans l'onglet « Rencontres ».</p>
    </section>
    <section data-section="rencontres" hidden>
      <input type="hidden" name="rencontreNom" value="${echapper(i.rencontreEchec?.nom ?? '')}" />
      <p data-rencontre-choisie></p>
      <label>Combien <input name="rencontreNombre" type="number" min="1" max="10" value="${i.rencontreEchec?.nombre ?? 1}" /></label>
      <label>Chercher un adversaire (tables de rencontres, puis bestiaire) <input type="search" data-chercher-ennemi placeholder="gobelin, brigand, ogre…" /></label>
      <div class="resultats-recherche" data-resultats-ennemis></div>
    </section>
    <p class="actions-lieu"><button type="submit">Valider et rendre jouable</button><button type="button" class="secondaire" data-refuser="${echapper(i.id)}">Refuser</button></p>
    ${i.contexte.type === 'rencontre' ? '<p class="note">Pour une rencontre : réussi, on évite le combat ; raté, le combat commence (contre la rencontre elle-même si aucun adversaire n\'est choisi).</p>' : ''}
  </form>`;

/** Onglets, recherche d'objets et d'adversaires dans un formulaire de validation. */
const animerFormulaire = (f: HTMLFormElement) => {
  f.querySelectorAll<HTMLButtonElement>('[data-onglet]').forEach((b) =>
    b.addEventListener('click', () => {
      f.querySelectorAll<HTMLButtonElement>('[data-onglet]').forEach((x) => x.classList.toggle('secondaire', x !== b));
      f.querySelectorAll<HTMLElement>('[data-section]').forEach((s) => (s.hidden = s.dataset.section !== b.dataset.onglet));
    }),
  );
  // Gain : les objets choisis, et la recherche dans le catalogue.
  const champObjets = f.querySelector<HTMLInputElement>('[name=objetsReussite]')!;
  const lus = (): string[] => JSON.parse(champObjets.value || '[]');
  const montrerChoisis = () => {
    const ids = lus();
    f.querySelector('[data-choisis]')!.innerHTML = ids.length
      ? `<p>Gagné si c'est réussi :</p><ul>${ids
          .map((id, k) => `<li>${echapper(OBJETS.some((o) => o.id === id) ? objet(id).nom : id)} <button type="button" class="secondaire petit" data-retirer-objet="${k}">✕</button></li>`)
          .join('')}</ul>`
      : '<p class="note">Aucun objet à gagner pour l\'instant.</p>';
    f.querySelectorAll<HTMLElement>('[data-retirer-objet]').forEach((b) =>
      b.addEventListener('click', () => {
        const l = lus();
        l.splice(Number(b.dataset.retirerObjet), 1);
        champObjets.value = JSON.stringify(l);
        montrerChoisis();
      }),
    );
  };
  montrerChoisis();
  const rechercheObjets = f.querySelector<HTMLInputElement>('[data-chercher-objet]')!;
  rechercheObjets.addEventListener('input', () => {
    const q = rechercheObjets.value.trim().toLowerCase();
    const trouves = q.length < 2 ? [] : OBJETS.filter((o) => o.nom.toLowerCase().includes(q)).slice(0, 25);
    const zone = f.querySelector<HTMLElement>('[data-resultats-objets]')!;
    zone.innerHTML = trouves
      .map((o) => `<button type="button" class="secondaire petit" data-ajouter-objet="${o.id}">+ ${echapper(o.nom)} <span class="note">${o.prix} PO</span></button>`)
      .join('');
    zone.querySelectorAll<HTMLElement>('[data-ajouter-objet]').forEach((b) =>
      b.addEventListener('click', () => {
        champObjets.value = JSON.stringify([...lus(), b.dataset.ajouterObjet!]);
        montrerChoisis();
      }),
    );
  });
  // Rencontres : l'adversaire d'un échec.
  const champNom = f.querySelector<HTMLInputElement>('[name=rencontreNom]')!;
  const montrerEnnemi = () => {
    const l = champNom.value ? ligneEnnemi(champNom.value) : null;
    f.querySelector('[data-rencontre-choisie]')!.innerHTML = l
      ? `Sur un échec, combat contre <b>${echapper(l.nom)}</b> <span class="note">(AT ${l.at} · PRD ${l.prd} · EV ${l.ev} · PR ${l.pr} · ${echapper(l.degats)})</span> <button type="button" class="secondaire petit" data-sans-ennemi>✕ Aucun combat</button>`
      : '<span class="note">Pas de combat sur un échec.</span>';
    f.querySelector('[data-sans-ennemi]')?.addEventListener('click', () => {
      champNom.value = '';
      montrerEnnemi();
    });
  };
  montrerEnnemi();
  const rechercheEnnemis = f.querySelector<HTMLInputElement>('[data-chercher-ennemi]')!;
  rechercheEnnemis.addEventListener('input', () => {
    const q = rechercheEnnemis.value.trim().toLowerCase();
    const trouves = q.length < 2 ? [] : nomsEnnemis().filter((n) => n.toLowerCase().includes(q)).slice(0, 25);
    const zone = f.querySelector<HTMLElement>('[data-resultats-ennemis]')!;
    zone.innerHTML = trouves.map((n) => `<button type="button" class="secondaire petit" data-choisir-ennemi="${echapper(n)}">${echapper(n)}</button>`).join('');
    zone.querySelectorAll<HTMLElement>('[data-choisir-ennemi]').forEach((b) =>
      b.addEventListener('click', () => {
        champNom.value = b.dataset.choisirEnnemi!;
        montrerEnnemi();
      }),
    );
  });
};

const liste = () => {
  const idees = toutesIdees();
  const parType = new Map<TypeContexte, Idee[]>();
  for (const i of idees) parType.set(i.contexte.type, [...(parType.get(i.contexte.type) ?? []), i]);
  const peutRegler = (i: Idee) => peutValider || i.locale;
  ouvrir(`<h2>Idées des joueurs</h2>
    <p class="note">${idees.length} idée${idees.length > 1 ? 's' : ''}. ${
      db ? 'Elles sont partagées entre les joueurs de cette page.' : 'Pas de partage disponible ici : seules les idées de ce navigateur apparaissent.'
    } ${peutValider ? 'Tu peux les valider : précise l\'épreuve et les résultats, et elles deviennent des choix jouables.' : ''}</p>
    <p class="actions-lieu"><button id="proposer">✍ Proposer une rencontre ou un événement</button><button id="proposer-quete">📜 Proposer une quête</button></p>
    ${
      idees.length
        ? [...parType]
            .map(
              ([type, is]) => `<h3>${NOM_TYPE[type]}</h3>${is
                .map(
                  (i) => `<details class="ency-ligne idee">
                <summary><b>${echapper(i.contexte.titre)}</b><span class="ency-chiffres">${STATUT[i.statut]}${i.locale ? ' · sur cet appareil' : ''}</span></summary>
                <p>« ${echapper(i.texte)} »</p>
                <p class="note">${new Date(i.date).toLocaleString('fr-FR')}${
                  i.statut === 'validee'
                    ? ` · ${i.epreuve ? `épreuve de ${NOM_EPREUVE[i.epreuve]}${i.modif ? ` (${i.modif > 0 ? '+' : ''}${i.modif})` : ''}` : 'sans épreuve'}`
                    : ''
                }</p>
                ${
                  i.contexte.type === 'proposition'
                    ? peutRegler(i) && i.statut === 'proposee'
                      ? `<p class="actions-lieu"><button data-retenir="${echapper(i.id)}">Retenir pour le jeu</button><button class="secondaire" data-refuser="${echapper(i.id)}">Refuser</button></p><p class="note">Une proposition retenue sera écrite dans le jeu à la prochaine version.</p>`
                      : ''
                    : peutRegler(i) && i.statut !== 'refusee'
                      ? formulaireValidation(i)
                      : ''
                }
              </details>`,
                )
                .join('')}`,
            )
            .join('')
        : "<p>Aucune idée pour l'instant. Utilise le bouton « 💡 J'aurais fait autrement » sous les choix pendant la partie.</p>"
    }`);
  fenetre.querySelectorAll<HTMLFormElement>('form.valider-idee[data-idee]').forEach(animerFormulaire);
  fenetre.querySelectorAll<HTMLFormElement>('form.valider-idee').forEach((f) =>
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const i = toutesIdees().find((x) => x.id === f.dataset.idee);
      if (!i) return;
      const d = new FormData(f);
      const n = (k: string) => Number(d.get(k) ?? 0) || 0;
      const nom = String(d.get('rencontreNom') ?? '');
      await modifier(i, {
        statut: 'validee',
        libelle: String(d.get('libelle') || i.texte.slice(0, 80)),
        epreuve: (String(d.get('epreuve')) || null) as CaracEpreuve | null,
        modif: n('modif'),
        reussite: String(d.get('reussite') ?? ''),
        echec: String(d.get('echec') ?? ''),
        pvReussite: n('pvReussite'),
        orReussite: n('orReussite'),
        eaReussite: n('eaReussite'),
        xpReussite: n('xpReussite'),
        heuresReussite: n('heuresReussite'),
        objetsReussite: JSON.parse(String(d.get('objetsReussite') || '[]')) as string[],
        pvEchec: n('pvEchec'),
        orEchec: n('orEchec'),
        eaEchec: n('eaEchec'),
        heuresEchec: n('heuresEchec'),
        rencontreEchec: nom ? { nom, nombre: Math.max(1, n('rencontreNombre')) } : null,
      });
      liste();
    }),
  );
  fenetre.querySelector('#proposer')?.addEventListener('click', saisieProposition);
  fenetre.querySelector('#proposer-quete')?.addEventListener('click', saisieQuete);
  fenetre.querySelectorAll<HTMLElement>('[data-retenir]').forEach((b) =>
    b.addEventListener('click', async () => {
      const i = toutesIdees().find((x) => x.id === b.dataset.retenir);
      if (i) await modifier(i, { statut: 'validee' });
      liste();
    }),
  );
  fenetre.querySelectorAll<HTMLElement>('[data-refuser]').forEach((b) =>
    b.addEventListener('click', async () => {
      const i = toutesIdees().find((x) => x.id === b.dataset.refuser);
      if (i) await modifier(i, { statut: 'refusee' });
      liste();
    }),
  );
};

/** Ajoute le bouton « Idées » en marge, au-dessus de l'encyclopédie, et le lien de chaque « J'aurais fait autrement ». */
export const installerIdees = () => {
  const bouton = document.createElement('button');
  bouton.className = 'bouton-idees secondaire petit';
  bouton.textContent = '💡 Idées';
  document.body.append(bouton, fenetre);
  bouton.addEventListener('click', () => (fenetre.hidden ? liste() : fermer()));
  fenetre.addEventListener('click', (e) => {
    if (e.target === fenetre || (e.target as HTMLElement).closest('[data-fermer-idees]')) fermer();
  });
  document.addEventListener('keydown', (e) => e.key === 'Escape' && !fenetre.hidden && fermer());
  // Un seul écouteur pour tous les boutons « J'aurais fait autrement », même ceux dessinés plus tard.
  document.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('[data-proposer-quete]')) return saisieQuete();
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-autrement]');
    if (!b) return;
    e.stopPropagation();
    saisie(JSON.parse(b.dataset.autrement!) as Contexte);
  });
  void connecter();
};

/** Joue une idée validée : l'épreuve (dé déjà lancé par le joueur), puis ses effets sur le héros. */
export interface ResultatIdee {
  reussi: boolean;
  texte: string;
  /** L'échec tourne au combat contre cette rencontre. */
  combat?: Rencontre;
}

export const resoudreIdee = (p: Partie, idee: Idee, de?: number): ResultatIdee => {
  const valeur = idee.epreuve ? valeurEpreuve(p, idee) : 0;
  const reussi = !idee.epreuve || de === 1 || (de !== 20 && (de ?? 20) <= valeur);
  const signe = (n: number, unite: string) => (n ? `${n > 0 ? '+' : ''}${n} ${unite}` : '');
  const pv = (reussi ? idee.pvReussite : idee.pvEchec) ?? 0;
  const or = (reussi ? idee.orReussite : idee.orEchec) ?? 0;
  const pa = (reussi ? idee.eaReussite : idee.eaEchec) ?? 0;
  const xp = reussi ? (idee.xpReussite ?? 0) : 0;
  const heures = (reussi ? idee.heuresReussite : idee.heuresEchec) ?? 0;
  const objets = reussi ? (idee.objetsReussite ?? []).filter((id) => OBJETS.some((o) => o.id === id)) : [];
  p.ev = Math.min(calculerFiche(p.perso).ev, p.ev + pv);
  p.or = Math.max(0, p.or + or);
  const max = calculerFiche(p.perso).ea;
  if (max && pa) p.ea = Math.max(0, Math.min(max, (p.ea ?? max) + pa));
  p.xp = (p.xp ?? 0) + xp;
  if (heures > 0) passerTemps(p, heures);
  p.sac.push(...objets);
  const effets = [
    signe(pv, 'PV'),
    signe(or, 'PO'),
    max ? signe(pa, 'PA') : '',
    signe(xp, 'XP'),
    heures > 0 ? `${heures} h passée${heures > 1 ? 's' : ''}` : '',
    ...objets.map((id) => objet(id).nom),
  ]
    .filter(Boolean)
    .join(', ');
  const texte = (reussi ? idee.reussite : idee.echec) || (reussi ? 'Ça marche !' : 'Ça ne marche pas.');
  const r = !reussi && idee.rencontreEchec ? ligneEnnemi(idee.rencontreEchec.nom) : null;
  return {
    reussi,
    texte: `${idee.epreuve ? `Dé : ${de} contre ${valeur}. ` : ''}${texte}${effets ? ` (${effets})` : ''}`,
    combat: r ? { ligne: r, d20: 0, nombre: Math.max(1, idee.rencontreEchec!.nombre), approche: 1 } : undefined,
  };
};

// --- Idées validées jouables dans un lieu (ville, carte du monde, salle de donjon) ---------------

/** L'idée de lieu en cours : on attend le dé du joueur, ou on lit le résultat. */
let ideeLieu: { id: string; resultat?: ResultatIdee } | null = null;

/** Les idées validées pour ce lieu : un bouton chacune, ou l'épreuve et le résultat de celle qu'on joue. */
export const panneauIdeesLieu = (p: Partie, idLieu: string): string => {
  const idees = ideesValidees('lieu', idLieu);
  if (!idees.length) return '';
  const enCours = ideeLieu && idees.find((i) => i.id === ideeLieu!.id);
  if (enCours) {
    const r = ideeLieu!.resultat;
    if (!r)
      return `<div class="recit lancer-joueur">${echapper(enCours.libelle ?? enCours.texte)}. Épreuve de ${NOM_EPREUVE[enCours.epreuve!]} : il faut faire <b>${valeurEpreuve(p, enCours)} ou moins</b> sur le D20.
        <div><span class="de a-lancer" id="de-idee-lieu">?</span><button id="lancer-idee-lieu">Lancer le D20</button></div></div>`;
    return `<div class="recit">${echapper(r.texte)}</div><p>${
      r.combat ? '<button data-combat-idee-lieu>⚔ Combattre</button>' : '<button class="secondaire" data-fin-idee-lieu>Continuer</button>'
    }</p>`;
  }
  return `<p class="actions-lieu">${idees
    .map((i) => `<button class="secondaire choix-joueur" data-idee-lieu="${echapper(i.id)}" title="Idée de joueur validée">💡 ${echapper(i.libelle ?? i.texte)}</button>`)
    .join('')}</p>`;
};

/**
 * Branche les boutons du panneau. `redessiner` réaffiche le lieu ; `combat` lance le combat d'un échec
 * (et rappelle `fini` avec le texte à afficher une fois le combat gagné ou fui).
 */
export const lierIdeesLieu = (app: HTMLElement, p: Partie, redessiner: () => void, combat: (r: Rencontre) => void) => {
  const jouer = (id: string, de?: number) => {
    const i = toutesIdees().find((x) => x.id === id);
    if (!i) return;
    ideeLieu = { id, resultat: resoudreIdee(p, i, de) };
    redessiner();
  };
  app.querySelectorAll<HTMLElement>('[data-idee-lieu]').forEach((b) =>
    b.addEventListener('click', () => {
      const i = toutesIdees().find((x) => x.id === b.dataset.ideeLieu);
      if (!i) return;
      if (!i.epreuve) return jouer(i.id);
      ideeLieu = { id: i.id };
      redessiner();
    }),
  );
  app.querySelector<HTMLButtonElement>('#lancer-idee-lieu')?.addEventListener('click', (e) => {
    const bouton = e.currentTarget as HTMLButtonElement;
    bouton.disabled = true;
    const d = 1 + Math.floor(Math.random() * 20);
    animerDes([app.querySelector<HTMLElement>('#de-idee-lieu')!], 20, [d]).then(() => setTimeout(() => jouer(ideeLieu!.id, d), 350));
  });
  app.querySelector('[data-fin-idee-lieu]')?.addEventListener('click', () => {
    ideeLieu = null;
    redessiner();
  });
  app.querySelector('[data-combat-idee-lieu]')?.addEventListener('click', () => {
    const r = ideeLieu?.resultat?.combat;
    ideeLieu = null;
    if (r) combat(r);
  });
};
