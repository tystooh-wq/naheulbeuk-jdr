"""Catalogue complet des objets, tiré des tableaux officiels (texte extrait par pdftotext -layout).

Usage : python3 -I scripts/catalogue.py <dossier des .txt> src/rules/catalogue.json

Chaque ligne d'objet a la forme « Nom   prix   colonnes… ». On découpe sur deux espaces ou plus,
on reconnaît le prix, puis les colonnes propres à chaque tableau (dégâts, PR, effets, rupture).
Les titres de section (une seule colonne) donnent la catégorie.
"""
import json
import re
import sys
import unicodedata

DOSSIER, SORTIE = sys.argv[1], sys.argv[2]

RUPTURE = re.compile(r'^(1à\d|Non)$')
IGNORER = re.compile(r'^(Page \d|Note|NOTE|\*|Important|Détail|AT :|PRD :|PR :|COU :|Suite page|Donjon de|Armement|Se protéger|La vie|Accessoires magiques|Potions et objets|Matériel et services|Équipement et vêtements|S\'équiper|Prix|Les |L\'utilisation|\(|Invocation|Glace|Nécromancie|Feu)')


def slug(nom):
    s = unicodedata.normalize('NFD', nom.lower())
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    s = re.sub(r'\(tm\)', '', s)
    s = re.sub(r'[^a-z0-9]+', '-', s).strip('-')
    return s[:60].strip('-')


def prix_po(valeur, monnaie='PO'):
    if valeur in ('***', ''):
        return 0
    v = float(valeur.replace(',', '.').replace(' ', ''))
    return v / {'PO': 1, 'PA': 10, 'PC': 100}.get(monnaie, 1)


def lignes(fichier):
    with open(f'{DOSSIER}/{fichier}', encoding='utf-8') as f:
        for brut in f:
            l = brut.rstrip('\n').replace('\f', '')
            if not l.strip():
                continue
            yield l


def segments(l):
    return [s for s in re.split(r'\s{2,}', l.strip()) if s]


def est_prix(s):
    return re.fullmatch(r'\*\*\*|\d[\d ]*(,\d+)?', s) is not None


def parcourir(fichier, analyser):
    """Appelle `analyser(nom, reste, categorie)` pour chaque ligne d'objet."""
    categorie = ''
    for l in lignes(fichier):
        segs = segments(l)
        if IGNORER.match(segs[0]):
            continue
        if len(segs) == 1 or not any(est_prix(s) for s in segs[1:3]):
            # Titre de section : une colonne, sans prix.
            t = segs[0]
            if len(t) < 70 and not re.search(r'\d{2,}|[:+]|^\d|^(Le|La|Vole|Téléportation|Il |Ce )\b', t):
                categorie = t
            continue
        i = next(k for k in range(1, len(segs)) if est_prix(segs[k]))
        nom = ' '.join(segs[:i])
        analyser(nom, segs[i], segs[i + 1:], categorie)


catalogue = []
vus = set()


def ajouter(o):
    base = slug(o['nom'])
    ident, n = base, 2
    while ident in vus:
        ident, n = f'{base}-{n}', n + 1
    vus.add(ident)
    o['id'] = ident
    catalogue.append(o)


def effets_et_rupture(reste):
    rupture = None
    if reste and RUPTURE.match(reste[-1]):
        rupture = reste[-1]
        reste = reste[:-1]
    return ' · '.join(reste), rupture


# --- Armement ---------------------------------------------------------------------
def arme(nom, prix, reste, cat):
    degats = None
    if reste:
        premier = reste[0]
        m = re.match(r'^(\d*D(?:[+-]\d+)?(?:/\d*D[+-]\d+\*?)?(?: \((?:feu|glace)\))?|1\+poison|\dD)(?:\s+(.*))?$', premier)
        if m:
            degats = m.group(1)
            reste = ([m.group(2)] if m.group(2) else []) + reste[1:]
    effets, rupture = effets_et_rupture(reste)
    jet = '**' in nom
    nom = nom.replace('**', '').strip()
    munition = cat.startswith(('Flèches', 'Carreaux'))
    ajouter({
        'nom': nom, 'fichier': 'Armement V2.3', 'type': 'materiel' if munition else 'arme', 'categorie': cat,
        'prix': prix_po(prix), 'gratuit': prix == '***', 'degats': degats, 'effets': effets, 'rupture': rupture,
        'jet': jet, 'deuxMains': '2 mains' in cat or 'hast' in cat or "2 mains" in nom,
    })


parcourir('tableau-armement.txt', arme)


# --- Protections --------------------------------------------------------------------
def emplacement(cat, nom):
    t = f'{cat} {nom}'.lower()
    if 'complète' in t or nom.lower().startswith('set'):
        return 'complete'
    if 'bouclier' in t:
        return 'bouclier'
    if 'casque' in t or 'heaume' in t or '(tête)' in t or 'calotte' in t or 'salade' in t:
        return 'tete'
    if 'gantelet' in t or 'bracelets' in t:
        return 'mains'
    if 'botte' in t or 'chaussons' in t or 'pieds' in t:
        return 'pieds'
    if 'jambi' in t or 'jambes' in t or 'braies' in t or 'pagne' in t:
        return 'jambes'
    if 'brassi' in t:
        return 'bras'
    return 'torse'


def protection(nom, prix, reste, cat, fichier='Armures et protections V3.0'):
    pr = None
    if reste:
        m = re.match(r'^(\*\*\*|\d+(?:/\d+\((?:glace|feu)\))?)(?:\s+(.*))?$', reste[0])
        if m:
            pr = 0 if m.group(1) == '***' else int(m.group(1).split('/')[0])
            reste = ([m.group(2)] if m.group(2) else []) + reste[1:]
    effets, rupture = effets_et_rupture(reste)
    nom = nom.replace('**', '').strip()
    ajouter({
        'nom': nom, 'fichier': fichier, 'type': 'armure', 'categorie': cat, 'prix': prix_po(prix), 'pr': pr,
        'effets': effets, 'rupture': rupture, 'emplacement': emplacement(cat, nom),
    })


parcourir('tableau-protections.txt', protection)
parcourir('tableau-equipementsorciers.txt',
          lambda n, p, r, c: protection(n, p, r, c, "S'équiper : mages et sorciers") if c.startswith('Robe') else
          ajouter({'nom': n, 'fichier': "S'équiper : mages et sorciers", 'type': 'materiel', 'categorie': c,
                   'prix': prix_po(p), 'effets': ' · '.join(x for x in r if not RUPTURE.match(x))}))


# --- Matériel et services ------------------------------------------------------------
def materiel(nom, prix, reste, cat):
    monnaie = 'PO'
    if reste and reste[0] in ('PO', 'PA', 'PC'):
        monnaie = reste[0]
        reste = reste[1:]
    if cat in ('Immobilier', 'Services', 'Services (suite)', 'Hostellerie', 'Auberge pourrie, la nuit', 'Auberge de qualité, la nuit', 'Meubles', 'Monnaie et banque'):
        genre = 'service'
    else:
        genre = 'materiel'
    ajouter({'nom': nom, 'fichier': 'Matériel et services V3.0', 'type': genre, 'categorie': cat,
             'prix': prix_po(prix, monnaie), 'effets': ' · '.join(reste)})


parcourir('tableau-materiel.txt', materiel)


# --- Potions et accessoires magiques ---------------------------------------------------
def magique(nom, prix, reste, cat):
    duree = reste[-1] if len(reste) > 1 and re.match(r'^(Permanent|\d+ ?(mn|H)|1 (jour|semaine|combat|sort))$', reste[-1]) else None
    effets = ' · '.join(reste[:-1] if duree else reste)
    potion = nom.lower().startswith(('potion', 'elixir', 'élixir', 'sirop', 'nectar', 'onguent', 'tetraplacebo'))
    ajouter({'nom': nom, 'fichier': 'Potions et accessoires magiques V3.0', 'type': 'potion' if potion else 'materiel',
             'categorie': cat, 'prix': prix_po(prix), 'effets': effets, 'duree': duree})


parcourir('tableau-potions-accessoiresmagiques.txt', magique)


# --- Instruments -------------------------------------------------------------------------
def instrument(nom, prix, reste, cat):
    ajouter({'nom': nom, 'fichier': 'Instruments V3.0', 'type': 'materiel', 'categorie': f'Instruments : {cat}',
             'prix': prix_po(prix), 'effets': ' · '.join(reste)})


parcourir('tableau-instruments.txt', instrument)

with open(SORTIE, 'w', encoding='utf-8') as f:
    json.dump(catalogue, f, ensure_ascii=False, indent=0)
par_type = {}
for o in catalogue:
    par_type[o['type']] = par_type.get(o['type'], 0) + 1
print(len(catalogue), par_type)
