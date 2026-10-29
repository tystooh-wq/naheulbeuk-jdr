"""Extrait le bestiaire des tableaux de rencontres officiels (texte issu de pdftotext -layout).

Usage : python3 -I scripts/bestiaire.py <sortie.json> <bestiaire-succint.txt> <rencontres-*.txt>...
"""
import json
import re
import sys

ENTETES_IGNORES = ('Combat :', 'Humains et rencontres', 'Autres rencontres', 'AT ', 'Donjon de Naheulbeuk')


def lignes_utiles(chemin):
    for brut in open(chemin, encoding='utf-8').read().splitlines():
        if brut.strip() and not brut.strip().startswith(ENTETES_IGNORES) and 'Page ' not in brut:
            yield brut


def rencontres(chemin):
    niveau, famille, sortie = '', '', []
    attente = []  # notes placées au-dessus de leur créature
    precedent = 'entete'
    for brut in lignes_utiles(chemin):
        champs = re.split(r'\s{2,}', brut.strip())
        if brut[0].isspace():
            note = brut.strip()
            if precedent == 'creature' and sortie:
                sortie[-1]['notes'].append(note)
            else:
                attente.append(note)
            continue
        if len(champs) >= 7 and re.match(r'^[\d*]', champs[1]):
            nom, at, prd, ev, pr, degats, *reste = champs
            if len(reste) and reste[0] == 'selon cas':
                cou, xp, notes = 'selon cas', 'selon cas', reste[1:]
            else:
                cou, xp, notes = (reste + ['', ''])[0], (reste + ['', ''])[1], reste[2:]
            sortie.append({
                'nom': nom, 'niveau': niveau, 'famille': famille or 'Humains et rencontres urbaines',
                'at': at, 'prd': prd, 'ev': ev, 'pr': pr, 'degats': degats, 'cou': cou, 'xp': xp,
                'notes': attente + notes,
            })
            attente = []
            precedent = 'creature'
            continue
        texte = re.sub(r'\s*\(suite\)$', '', brut.strip())
        if re.search(r'niveau', texte, re.I):
            niveau = texte
        else:
            famille = texte
        precedent = 'entete'
    return sortie


def descriptions(chemin):
    lignes = open(chemin, encoding='utf-8').read().splitlines()
    sortie, titre, corps = {}, None, []
    for i, l in enumerate(lignes):
        s = l.strip()
        precede_vide = i == 0 or not lignes[i - 1].strip() or 'Page ' in lignes[i - 1]
        suivant = lignes[i + 1].strip() if i + 1 < len(lignes) else ''
        if s and precede_vide and len(s) < 45 and not s.endswith(('.', ',', '!')) and suivant and 'Page ' not in s:
            if titre:
                sortie[titre] = ' '.join(corps)
            titre, corps = s, []
        elif titre and s and 'Page ' not in s:
            corps.append(s)
    if titre:
        sortie[titre] = ' '.join(corps)
    return {k: re.sub(r'(\w)- (\w)', r'\1\2', v) for k, v in sortie.items()}


def mots(t):
    """Mots sans accents ni pluriel, pour rapprocher « Hommes-lézards » de « Homme-Lézard chef »."""
    t = re.sub(r'\(.*?\)', '', t.lower())
    for a, b in (('é', 'e'), ('è', 'e'), ('ê', 'e'), ('ô', 'o'), ('î', 'i'), ('ï', 'i'), ('â', 'a')):
        t = t.replace(a, b)
    return [re.sub(r'[sx]$', '', m) for m in re.findall(r'[a-z]+', t)]


def main():
    sortie_json, succint, *tables = sys.argv[1:]
    desc = descriptions(succint)
    creatures = []
    for t in tables:
        creatures += rencontres(t)
    titres = sorted(desc, key=lambda t: len(mots(t)), reverse=True)
    for c in creatures:
        n = mots(c['nom'])
        for t in titres:
            k = mots(t)
            if k and n[: len(k)] == k:
                c['fiche'] = t
                break
    json.dump({'fiches': desc, 'creatures': creatures}, open(sortie_json, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print(len(creatures), 'créatures,', sum('fiche' in c for c in creatures), 'avec description ;', len(desc), 'fiches succinctes')


if __name__ == '__main__':
    main()
