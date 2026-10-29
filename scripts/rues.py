"""Calcule les trajets à pied entre les lieux de Waldorg, le long des rues.

La carte officielle n'a pas de réseau de rues : on le déduit de l'image.
Le papier clair est praticable, les traits des maisons coûtent cher, l'eau
et l'extérieur des remparts sont interdits (les ponts, clairs, restent
praticables). Un A* relie ensuite chaque paire de lieux.

Usage : python3 -I scripts/rues.py <Waldorg-simple.jpg> <lieux.json> <sortie.json> [apercu.png]
"""
import heapq
import json
import sys

import numpy as np
from PIL import Image, ImageDraw

PAS = 4  # pixels de la carte d'origine par case

# Intérieur des remparts, plus le couloir de la porte ouest.
REMPARTS = [
    (1, 42), (5, 42), (5.5, 28), (9, 20), (17, 12), (26, 6), (36, 4), (44, 2), (46, 2), (60, 3), (75, 3.5),
    (90, 5), (90, 20), (89, 35), (89, 42), (84, 44), (80, 54), (74, 62), (77, 70), (77, 78), (72, 87),
    (67, 92), (60, 94), (50, 95.5), (44, 97), (38, 93), (30, 91), (24, 93), (17, 90), (10, 84),
    (5.5, 75), (5, 46), (1, 46),
]


def grille(chemin):
    im = Image.open(chemin).convert('RGB')
    a = np.asarray(im).astype(np.int16)
    h, w = a.shape[0] // PAS * PAS, a.shape[1] // PAS * PAS
    a = a[:h, :w]
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    lum = (r + g + b) / 3
    bloc = lambda m: m.reshape(h // PAS, PAS, w // PAS, PAS).mean(axis=(1, 3))
    sombre = bloc((lum < 185).astype(float))
    eau = bloc((b - r > -9).astype(float)) > 0.5
    # Hors les murs : tout ce qui sort du tracé des remparts (relevé à la main, en %).
    masque = Image.new('L', (w // PAS, h // PAS), 0)
    ImageDraw.Draw(masque).polygon(
        [(x / 100 * w / PAS, y / 100 * h / PAS) for x, y in REMPARTS], fill=255
    )
    dehors = np.asarray(masque) == 0
    # Distance aux traits (maisons), pour rester au milieu des rues.
    obstacle = (sombre > 0.12) | eau | dehors
    dist = np.where(obstacle, 0, 99).astype(float)
    for _ in range(2):
        for y in range(1, dist.shape[0]):
            dist[y] = np.minimum(dist[y], dist[y - 1] + 1)
        for y in range(dist.shape[0] - 2, -1, -1):
            dist[y] = np.minimum(dist[y], dist[y + 1] + 1)
        for x in range(1, dist.shape[1]):
            dist[:, x] = np.minimum(dist[:, x], dist[:, x - 1] + 1)
        for x in range(dist.shape[1] - 2, -1, -1):
            dist[:, x] = np.minimum(dist[:, x], dist[:, x + 1] + 1)
    cout = 1 + 40 * sombre + 6 / (1 + dist)
    cout[eau | dehors] = np.inf
    return cout, (w, h)


def astar(cout, depart, arrivee):
    H, W = cout.shape
    voisins = [(-1, 0, 1), (1, 0, 1), (0, -1, 1), (0, 1, 1), (-1, -1, 1.414), (-1, 1, 1.414), (1, -1, 1.414), (1, 1, 1.414)]
    g = {depart: 0.0}
    venu = {}
    file = [(0.0, depart)]
    ay, ax = arrivee
    while file:
        _, n = heapq.heappop(file)
        if n == arrivee:
            break
        y, x = n
        for dy, dx, l in voisins:
            ny, nx = y + dy, x + dx
            if not (0 <= ny < H and 0 <= nx < W):
                continue
            c = cout[ny, nx]
            if c == np.inf:
                continue
            ng = g[n] + l * (c + cout[y, x]) / 2
            if ng < g.get((ny, nx), np.inf):
                g[(ny, nx)] = ng
                venu[(ny, nx)] = n
                heapq.heappush(file, (ng + ((ny - ay) ** 2 + (nx - ax) ** 2) ** 0.5, (ny, nx)))
    if arrivee not in venu:
        raise RuntimeError(f'aucun chemin {depart} → {arrivee}')
    chemin = [arrivee]
    while chemin[-1] != depart:
        chemin.append(venu[chemin[-1]])
    return chemin[::-1]


def simplifier(points, tol):
    """Douglas-Peucker."""
    if len(points) < 3:
        return points
    (y0, x0), (y1, x1) = points[0], points[-1]
    dy, dx = y1 - y0, x1 - x0
    n = (dx * dx + dy * dy) ** 0.5 or 1
    loin, imax = 0, 0
    for i, (y, x) in enumerate(points[1:-1], 1):
        d = abs(dy * (x - x0) - dx * (y - y0)) / n
        if d > loin:
            loin, imax = d, i
    if loin <= tol:
        return [points[0], points[-1]]
    return simplifier(points[: imax + 1], tol)[:-1] + simplifier(points[imax:], tol)


def plus_proche_praticable(cout, y, x):
    if cout[y, x] != np.inf:
        return y, x
    for r in range(1, 30):
        for dy in range(-r, r + 1):
            for dx in range(-r, r + 1):
                ny, nx = y + dy, x + dx
                if 0 <= ny < cout.shape[0] and 0 <= nx < cout.shape[1] and cout[ny, nx] != np.inf:
                    return ny, nx
    raise RuntimeError('lieu isolé')


def main():
    carte, lieux_json, sortie = sys.argv[1:4]
    apercu = sys.argv[4] if len(sys.argv) > 4 else None
    cout, (w, h) = grille(carte)
    H, W = cout.shape
    lieux = json.load(open(lieux_json, encoding='utf-8'))
    cases = {l['id']: plus_proche_praticable(cout, round(l['y'] / 100 * H), round(l['x'] / 100 * W)) for l in lieux}
    ids = [l['id'] for l in lieux]
    trajets = {}
    for i, a in enumerate(ids):
        for b in ids[i + 1:]:
            ch = simplifier(astar(cout, cases[a], cases[b]), 1.2)
            pts = [[round(x / W * 100, 2), round(y / H * 100, 2)] for y, x in ch]
            # Les extrémités collent exactement aux repères des lieux.
            la, lb = next(l for l in lieux if l['id'] == a), next(l for l in lieux if l['id'] == b)
            pts = [[la['x'], la['y']]] + pts + [[lb['x'], lb['y']]]
            trajets[f'{a}|{b}'] = pts
    json.dump(trajets, open(sortie, 'w', encoding='utf-8'), separators=(',', ':'))
    if apercu:
        im = Image.open(carte).convert('RGB')
        d = ImageDraw.Draw(im)
        for pts in trajets.values():
            d.line([(x / 100 * im.width, y / 100 * im.height) for x, y in pts], fill=(220, 0, 0), width=5)
        im.save(apercu)


if __name__ == '__main__':
    main()
