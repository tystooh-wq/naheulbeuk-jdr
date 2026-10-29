"""Extrait une table de rencontres D20 officielle (texte issu de pdftotext -layout).

Usage : python3 -I scripts/rencontres.py <rencontres-*.txt> <sortie.json>
"""
import json
import re
import sys


def nombre(texte):
    """« 1 à 3 coyotes affamés » → ('1 à 3', 'coyotes affamés')."""
    m = re.match(r'^(\d+ à \d+|\d+ ou \d+|\dD\d|\d+)\s+(.*)$', texte)
    return (m.group(1), m.group(2)) if m else ('1', texte)


def main():
    source, sortie = sys.argv[1:3]
    lignes = []
    for brut in open(source, encoding='utf-8').read().splitlines():
        champs = re.split(r'\s{2,}', brut.strip())
        if len(champs) >= 9 and champs[0].isdigit():
            d20, rencontre, at, prd, ev, pr, degats, cou, xp, *notes = champs
            nb, nom = nombre(rencontre)
            lignes.append({
                'd20': int(d20), 'rencontre': rencontre, 'nombre': nb, 'nom': nom,
                'at': int(at), 'prd': int(prd), 'ev': int(ev), 'pr': int(pr),
                'degats': degats, 'cou': int(cou), 'xp': int(xp), 'notes': ' '.join(notes),
            })
    assert [l['d20'] for l in lignes] == list(range(1, 21)), 'table incomplète'
    json.dump(lignes, open(sortie, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(len(lignes), 'lignes')


if __name__ == '__main__':
    main()
