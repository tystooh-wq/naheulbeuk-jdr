"""Brouillard du Donjon de Naheulbeuk : pour chaque salle, la surface qu'elle dévoile sur le plan.

On part du repère de la salle (px, py en %) et on remplit le sol blanc du plan, sans franchir les murs
(les embrasures de porte sont refermées en épaississant les murs). Le remplissage s'arrête à une
certaine distance, pour qu'un couloir ne dévoile pas tout l'étage. On rend ensuite les murs autour.
Sortie : src/assets/ddn/masques.json (une petite image PNG par salle, en data URL).
Usage : python3 -I scripts/masques-ddn.py [dossier-apercus] [chateau]
Avec « chateau » : le château de Valtordu (src/rules/chateau-valtordu.ts → src/assets/chateau-valtordu/masques.json).
"""
import base64, io, json, re, sys
from collections import deque
import numpy as np
from PIL import Image, ImageFilter

RACINE = '/home/claude/naheulbeuk-jdr/'
CHATEAU = len(sys.argv) > 2 and sys.argv[2] == 'chateau'
DOSSIER = 'chateau-valtordu' if CHATEAU else 'ddn'
SOURCE = 'chateau-valtordu.ts' if CHATEAU else 'ddn-salles.ts'
PLANS = {'cv-rdc': 'rdc', 'cv-etage': 'etage', 'cv-sout': 'souterrains'} if CHATEAU else {'n0': 'n0', 'cave': 'cave', 'sout': 'souterrains', 'n1': 'n1', 'n2': 'n2', 'n3': 'n3', 'n4': 'n4', 'n5': 'n5', 'n6': 'n6'}
FERMER = 5  # demi-largeur des embrasures refermées (pixels, plan de 1000 px)
PORTEE = 450  # distance maximale du remplissage (pixels, plan de 1000 px)

src = open(RACINE + 'src/rules/' + SOURCE).read()
salles = re.findall(r"id: '([^']+)',\s*nom: [\"'].*?[\"'],\s*niveau: '([^']+)',\s*px: ([\d.]+),\s*py: ([\d.]+)", src)
apercus = sys.argv[1] if len(sys.argv) > 1 and sys.argv[1] != '-' else None
sortie = {'plans': {}, 'salles': {}}

for niv, fichier in PLANS.items():
    im = Image.open(f'{RACINE}src/assets/{DOSSIER}/{fichier}.jpg').convert('RGB')
    W, H = im.size
    k = max(1, round(FERMER * W / 1000))
    portee = PORTEE * W / 1000
    a = np.asarray(im).astype(int)
    sol = (a.min(axis=2) > 215)
    mur = Image.fromarray((~sol * 255).astype('uint8')).filter(ImageFilter.MaxFilter(2 * k + 1))
    libre = np.asarray(mur) == 0
    sortie['plans'][niv] = [W, H]
    apercu = im.copy() if apercus else None
    for sid, n, px, py in salles:
        if n != niv:
            continue
        x0, y0 = round(float(px) * W / 100), round(float(py) * H / 100)
        # Le repère tombe parfois sur un numéro ou un mur : on cherche le sol libre le plus proche.
        depart = None
        for r in range(0, 40):
            for dy in range(-r, r + 1):
                for dx in range(-r, r + 1):
                    x, y = x0 + dx, y0 + dy
                    if max(abs(dx), abs(dy)) == r and 0 <= x < W and 0 <= y < H and libre[y, x]:
                        depart = (x, y)
                        break
                if depart: break
            if depart: break
        zone = np.zeros((H, W), bool)
        if depart:
            dist = {depart: 0}
            f = deque([depart])
            zone[depart[1], depart[0]] = True
            while f:
                x, y = f.popleft()
                d = dist[(x, y)]
                if d >= portee: continue
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if 0 <= nx < W and 0 <= ny < H and libre[ny, nx] and not zone[ny, nx]:
                        zone[ny, nx] = True
                        dist[(nx, ny)] = d + 1
                        f.append((nx, ny))
        else:
            zone[max(0, y0 - 15):y0 + 15, max(0, x0 - 15):x0 + 15] = True
        # On rend les murs et un peu d'épaisseur autour du sol dévoilé.
        z = Image.fromarray((zone * 255).astype('uint8')).filter(ImageFilter.MaxFilter(2 * (k + 3) + 1))
        z = np.asarray(z) > 0
        ys, xs = np.nonzero(z)
        bx0, by0, bx1, by1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
        crop = z[by0:by1, bx0:bx1]
        rgba = np.zeros((*crop.shape, 4), 'uint8')
        rgba[..., 3] = crop * 255
        png = Image.fromarray(rgba, 'RGBA')
        b = io.BytesIO(); png.save(b, 'PNG', optimize=True)
        sortie['salles'][sid] = [int(bx0), int(by0), int(bx1 - bx0), int(by1 - by0), 'data:image/png;base64,' + base64.b64encode(b.getvalue()).decode()]
        if apercu is not None:
            teinte = Image.new('RGB', im.size, tuple(np.random.randint(40, 220, 3).tolist()))
            m = Image.fromarray((z * 110).astype('uint8'))
            apercu.paste(teinte, (0, 0), m)
    if apercu is not None:
        apercu.save(f'{apercus}/masques-{niv}.png')

json.dump(sortie, open(RACINE + f'src/assets/{DOSSIER}/masques.json', 'w'), separators=(',', ':'))
print(len(sortie['salles']), 'salles,', round(len(json.dumps(sortie)) / 1024), 'Ko')
