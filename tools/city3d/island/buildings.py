"""The fifteen project buildings of the island, three finished levels each (L3 Open, L4 Live, L5 Thriving).

One function per project. It is called three times (L = 3, 4, 5) and draws a complete building each time:
L3 a small modest version, L4 the full building, L5 the full building plus clear extras.
Front = -Y in Blender (+Z in glTF). Walls are warm neutrals; roofs, awnings and signs use the district colour.
Signs carry shapes, generic words or public project names only. Never a client, customer or staff name.
"""
import math
from ilib import IModel, rrect, rect, ngon, shade, tint, mixc, C, disc2, star2, rrect2, cross2, capsule2, heart2, grow2
from parts2 import *            # shared detail pieces (book window, giant props, statues ...)

MODELS = []
TOY = ['t_red', 't_yel', 't_blue', 't_green', 't_pink', 't_purple', 't_teal', 't_orange']


def building(pid, district, site='site_small'):
    def deco(fn):
        for L in (3, 4, 5):
            def make(L=L):
                m = IModel(f'b_{pid}_L{L}', 'building', seed=hash_id(pid) + L)
                m.meta = {'project': pid, 'district': district, 'level': L, 'site': site}
                fn(m, L)
                assert 'door' in m.meta, pid
                return m
            MODELS.append((f'b_{pid}_L{L}', make))
        return fn
    return deco


def hash_id(s):
    return sum((i + 1) * ord(c) for i, c in enumerate(s)) % 9973


def set_door(m, x, y):
    """Where the street should meet the plot (Blender x, y -> manifest [x, z])."""
    m.meta['door'] = [round(x, 2), round(-y, 2)]


def row(n, span, cx=0.0):
    """n evenly spaced positions across a span."""
    return [cx - span / 2 + span * (i + 0.5) / n for i in range(n)]


# ================================================================== BOOKS & APPS (yellow)
@building('books', 'books')
def b_books(m, L):
    """Bookshop: a cosy children's bookshop with a pitched roof and a big window of books."""
    D = 'd_books'
    W, Dp = {3: (30, 24), 4: (46, 34), 5: (58, 42)}[L]
    ph = m.pad(W, Dp)
    set_door(m, 0, -Dp / 2)
    m.push(0, 0, ph)
    w, d, e1, rh = (16, 12, 4.8, 6.4) if L == 3 else ((24, 16, 8.8, 9.6) if L == 4 else (26, 17, 9.2, 10.2))
    cy = 2.5
    x0, x1, y0, y1 = -w / 2, w / 2, cy - d / 2, cy + d / 2
    wall = 'w_cream'
    m.rbox(0, cy, w, d, 0, e1, wall, r=0.3, top=False)
    m.band(0, cy, w, d, 0, 0.8, 'w_brick', r=0.3, out=0.12)
    m.roof_gable(x0, x1, y0, y1, e1, rh, D, axis='y', over=1.1, th=0.5, gable=wall)
    m.chimney(x0 + w * 0.22, cy + d * 0.2, e1 + 1, e1 + rh * 0.62 + 2.2, 1.5)
    with m.side('front', x0, x1, y0, y1):
        bw = 7.5 if L == 3 else 10.0
        bx = -w / 2 + bw / 2 + 1.2
        # the big bay window full of books
        m.box(bx - bw / 2, bx + bw / 2, -1.5, 0, 0, 4.3, 'trim')
        m.awning(bx - bw / 2 - 0.3, bx + bw / 2 + 0.3, 5.2, 1.9, D, D, n=1, drop=0.9, val=0.3)
        books_window(m, bx - bw / 2 + 0.4, bx + bw / 2 - 0.4, 0.9, 3.9, -1.5, rows=3)
        dx = w / 2 - 3.2
        m.door(dx, 2.3, 3.5, col='t_teal', glass=0.45, double=False, step=0.0)
        m.awning(dx - 2.0, dx + 2.0, 4.9, 1.6, D, 'trim', n=5, drop=0.7)
        m.wall_lamp(dx - 2.0, 2.6)
        if L >= 4:
            for wx in row(3, w - 6):
                m.win(wx, 5.6, 2.2, 2.4, bars=(1, 1), sill=0.25, shutters=tint(D, 0.25))
            m.sign('Snuggle Crew', bx, 4.55, 1.05, col='trim', board='t_teal', y=-1.5, max_w=bw)
        else:
            m.sign('BOOKS', bx, 4.5, 0.9, col='trim', board='t_teal', y=-1.5)
        # round attic window
        az = e1 + rh * 0.38
        m.plate(disc2(0, az, 1.45, 10), 0, 0.2, 'trim')
        with m.use('glow'):
            m.poly([(x, -0.24, z) for x, z in disc2(0, az, 1.1, 10)], 'pane')
        m.fq(-0.08, 0.08, az - 1.1, az + 1.1, -0.27, 'trim')
        m.fq(-1.1, 1.1, az - 0.08, az + 0.08, -0.27, 'trim')
        # hanging sign: an open book
        hx = w / 2 - 0.4
        m.beam((hx, -0.1, 7.2 if L >= 4 else 4.4), (hx, -2.4, 7.2 if L >= 4 else 4.4), 0.14, 0.14, 'iron')
    hz = 5.6 if L >= 4 else 2.9
    with m.at(x1 - 0.4, y0 - 1.5, hz, math.pi / 2):
        open_book(m, 0, 0, 0, 1.9, upright=True)
    for sname in ('left', 'right'):
        with m.side(sname, x0, x1, y0, y1) as Lw:
            for wx in row(2 if L == 3 else 3, Lw - 4):
                m.win(wx, 1.4, 2.0, 2.4, bars=(1, 1), sill=0.25)
                if L >= 4:
                    m.win(wx, 5.6, 2.0, 2.2, bars=(1, 1), sill=0.25)
    with m.side('back', x0, x1, y0, y1):
        m.door(-w / 4, 1.8, 3.2, col='timber', glass=0.0)
        m.win(w / 4, 1.5, 2.6, 2.2, bars=(1, 1), sill=0.25)
        if L >= 4:
            for wx in row(2, w - 8):
                m.win(wx, 5.6, 2.2, 2.2, bars=(1, 1), sill=0.25)
    # dormers on the long roof slopes
    if L >= 4:
        for sx in (-1, 1):
            for dy in ((cy - 2.5, cy + 3.5) if L == 5 else (cy + 0.5,)):
                with m.at(sx * w * 0.27, dy, e1 + rh * 0.46, -sx * math.pi / 2):
                    m.box(-1.3, 1.3, -1.6, 2.2, 0, 2.2, wall)
                    m.roof_gable(-1.3, 1.3, -1.6, 2.2, 2.2, 1.3, D, axis='y', over=0.35, th=0.25, gable=wall)
                    m.win(0, 0.5, 1.5, 1.4, y=-1.6, bars=(1, 0), fw=0.15, dep=0.12)
    # reading-room wing
    if L >= 4:
        ww, wd, we = 9.0, 11.0, 4.4
        wx0 = x1
        m.rbox(wx0 + ww / 2 - 0.2, cy + 1.0, ww, wd, 0, we, 'w_butter', r=0.3, top=False)
        m.roof_gable(wx0 - 0.2, wx0 + ww - 0.2, cy + 1 - wd / 2, cy + 1 + wd / 2, we, 3.6, D, axis='y', over=0.8, th=0.4, gable='w_butter')
        with m.side('front', wx0 - 0.2, wx0 + ww - 0.2, cy + 1 - wd / 2, cy + 1 + wd / 2):
            m.shopfront(-3.0, 3.0, 0, 3.4, n=2, plinth=0.9)
            books_window(m, -2.8, 2.8, 1.0, 3.3, -0.2, rows=2, backing=False)
        with m.side('right', wx0 - 0.2, wx0 + ww - 0.2, cy + 1 - wd / 2, cy + 1 + wd / 2) as Lw:
            for wx in row(2, Lw - 3):
                m.win(wx, 1.3, 2.2, 2.2, bars=(1, 1), sill=0.25)
    if L == 5:
        # a glass garden room on the other side, a story gate, bunting and flags
        gx1 = x0 + 0.2
        gw, gd, ge = 9.0, 10.0, 4.0
        gcx = gx1 - gw / 2
        m.rbox(gcx, cy + 1, gw, gd, 0, 0.9, 'w_brick', r=0.2, top=False)
        with m.use('glass'):
            m.rbox(gcx, cy + 1, gw - 0.3, gd - 0.3, 0.9, ge, 'glass_a', r=0.2, top=False, col1='glass_c')
            m.roof_gable(gcx - gw / 2, gcx + gw / 2, cy + 1 - gd / 2, cy + 1 + gd / 2, ge, 3.0, 'glass_c', axis='y', over=0.3, th=0.2, gable='glass_c')
        for gxx in (gcx - gw / 2, gcx, gcx + gw / 2):
            m.cbox(gxx, cy + 1 - gd / 2, 0.25, 0.25, 0.9, ge, 'trim', top=False)
        for gyy in row(3, gd):
            m.cbox(gcx - gw / 2, cy + 1 + gyy, 0.25, 0.25, 0.9, ge, 'trim', top=False)
        m.beam((gcx, cy + 1 - gd / 2 - 0.3, ge + 3.05), (gcx, cy + 1 + gd / 2 + 0.3, ge + 3.05), 0.3, 0.3, 'trim')
        m.band(gcx, cy + 1, gw - 0.3, gd - 0.3, ge - 0.15, ge + 0.15, 'trim', r=0.2, out=0.2)
        m.tree(gcx - 0.5, cy + 2, 0.55, 'round')
    # the forecourt
    fy = y0 - 4.5
    giant_book(m, x0 + 2.5, fy - 1.5, 0, 4.6, 3.4, 0.9, 't_red', 0.25)
    if L >= 4:
        giant_book(m, x0 + 2.8, fy - 1.4, 0.9, 4.2, 3.1, 0.8, 't_blue', -0.2)
        giant_book(m, x0 + 2.4, fy - 1.6, 1.7, 3.6, 2.7, 0.7, 't_green', 0.5)
        m.bench(3.5, fy, math.pi, 2.6)
        m.planter(x1 - 2, y0 - 1.2, 3.0, 1.2, flowers='flower_pink')
        m.lamp(-W / 2 + 3, -Dp / 2 + 3, 6.0, rz=math.pi)
        m.lamp(W / 2 - 3, -Dp / 2 + 3, 6.0, rz=math.pi)
        m.tree(W / 2 - 5, cy + d / 2 - 1, 0.9, 'round')
    else:
        m.globe_lamp(w / 2 + 2, y0 - 3)
        m.planter(1.5, y0 - 1.1, 2.4, 1.1, flowers='flower_yel')
    if L == 5:
        # story gate: a giant open book on two posts over the path
        gy = -Dp / 2 + 5
        for sx in (-3.2, 3.2):
            m.cyl(sx, gy, 0, 5.2, 0.28, 6, 'timber_dark', cap=True)
        with m.at(0, gy, 5.3):
            open_book(m, 0, 0, 0, 4.4, upright=False)
        m.bunting((-W / 2 + 3, -Dp / 2 + 3, 5.8), (-3.2, gy, 5.0), TOY, sag=0.8, n=8)
        m.bunting((3.2, gy, 5.0), (W / 2 - 3, -Dp / 2 + 3, 5.8), TOY, sag=0.8, n=8)
        m.flag(-W / 2 + 6, y0 - 2, 9, D)
        m.flag(W / 2 - 6, y0 - 2, 9, 't_teal')
        m.bench(-4.5, fy + 0.5, math.pi, 2.6)
        m.planter(-9, -Dp / 2 + 4, 3.0, 1.2, flowers='flower_red')
        m.planter(9, -Dp / 2 + 4, 3.0, 1.2, flowers='flower_yel')
        m.tree(-W / 2 + 4.5, cy + d / 2 + 2, 1.0, 'round')
    m.pop()


# ------------------------------------------------------------------ helpers shared by several buildings
SIDES4 = ('front', 'right', 'back', 'left')


def wall_windows(m, box, sides, spacing, floors, z0, fh, w, h, margin=1.8, **kw):
    """A regular grid of windows on some walls of a box (x0, x1, y0, y1)."""
    x0, x1, y0, y1 = box
    for s in sides:
        with m.side(s, x0, x1, y0, y1) as Lw:
            n = max(1, round((Lw - 2 * margin) / spacing))
            for f in range(floors):
                for wx in row(n, Lw - 2 * margin):
                    m.win(wx, z0 + f * fh, w, h, **kw)


def ribbons(m, box, sides, floors, z0, fh, h=2.0, margin=1.4, pane='pane', frame='trim'):
    """Continuous office window bands."""
    x0, x1, y0, y1 = box
    for s in sides:
        with m.side(s, x0, x1, y0, y1) as Lw:
            for f in range(floors):
                m.shopfront(-Lw / 2 + margin, Lw / 2 - margin, z0 + f * fh, z0 + f * fh + h, plinth=0.0, fw=0.2, dep=0.16, pane=pane, frame=frame)


def gline(m, a, b, z, wd=0.14, col='trim'):
    """A painted line on the ground."""
    dx, dy = b[0] - a[0], b[1] - a[1]
    L = math.hypot(dx, dy) or 1
    nx, ny = -dy / L * wd / 2, dx / L * wd / 2
    m.poly([(a[0] - nx, a[1] - ny, z), (b[0] - nx, b[1] - ny, z), (b[0] + nx, b[1] + ny, z), (a[0] + nx, a[1] + ny, z)], col)


def garc(m, cx, cy, r, a0, a1, z, n=8, wd=0.14, col='trim'):
    P = [(cx + r * math.cos(a0 + (a1 - a0) * i / n), cy + r * math.sin(a0 + (a1 - a0) * i / n)) for i in range(n + 1)]
    for i in range(n):
        gline(m, P[i], P[i + 1], z, wd, col)


def half_court(m, cx, cy, w, d, col, letter, hoops=True):
    """An outdoor half court. The hoop stands at the back (+y) and faces the front."""
    m.rbox(cx, cy, w + 2.4, d + 2.4, 0, 0.14, 'court_green', r=0.8, seg=2)
    x0, x1, y0, y1 = cx - w / 2, cx + w / 2, cy - d / 2, cy + d / 2
    m.poly([(x0, y0, 0.17), (x1, y0, 0.17), (x1, y1, 0.17), (x0, y1, 0.17)], col)
    z = 0.2
    for a, b in (((x0, y0), (x1, y0)), ((x1, y0), (x1, y1)), ((x1, y1), (x0, y1)), ((x0, y1), (x0, y0))):
        gline(m, a, b, z)
    kw, kd = 4.9, 5.8
    m.poly([(cx - kw / 2, y1 - kd, 0.185), (cx + kw / 2, y1 - kd, 0.185), (cx + kw / 2, y1, 0.185), (cx - kw / 2, y1, 0.185)], shade(col, 0.82))
    gline(m, (cx - kw / 2, y1), (cx - kw / 2, y1 - kd), z)
    gline(m, (cx + kw / 2, y1), (cx + kw / 2, y1 - kd), z)
    gline(m, (cx - kw / 2, y1 - kd), (cx + kw / 2, y1 - kd), z)
    garc(m, cx, y1 - kd, 1.8, math.pi, 2 * math.pi, z, 6)
    r3 = min(6.75, w / 2 - 0.9)
    garc(m, cx, y1 - 1.6, r3, math.pi, 2 * math.pi, z, 10)
    gline(m, (cx - r3, y1), (cx - r3, y1 - 1.6), z)
    gline(m, (cx + r3, y1), (cx + r3, y1 - 1.6), z)
    m.text(letter, 3.2, cx, 0.2, 'trim', y=y0 + 2.6, flat=True, bold=0.02)
    if hoops:
        hoop(m, cx, y1 + 0.5, 0)


def floodlight(m, x, y, h=12.0, rz=0.0):
    with m.at(x, y, 0, rz):
        m.cyl(0, 0, 0, h, 0.16, 5, 'iron', cap=False)
        m.cyl(0, 0, 0, 0.5, 0.4, 6, 'iron')
        m.box(-1.3, 1.3, -0.3, 0.3, h, h + 1.0, 'iron', bottom=True)
        with m.use('glow'):
            for lx in (-0.8, 0, 0.8):
                m.fq(lx - 0.32, lx + 0.32, h + 0.15, h + 0.85, -0.32, 'lamp')


def globe(m, cx, cy, z, r=2.0):
    """A globe on a plinth: the world the students come from."""
    m.rbox(cx, cy, r * 1.3, r * 1.3, z, z + 1.0, 'w_stone', r=0.25, seg=1, bev=0.12)
    m.cyl(cx, cy, z + 1.0, z + 1.5, 0.18, 5, 'brass', cap=False)
    m.ball(cx, cy, z + 1.4 + r, r, 'glass_b', n=10, rings=6, col1='glass_a')
    m.torus(cx, cy, z + 1.4 + r, r * 1.06, 0.07, 14, 3, 'brass', axis='z')
    m.torus(cx, cy, z + 1.4 + r, r * 1.06, 0.07, 14, 3, 'brass', axis='x')
    for a, b, s in ((0.6, 0.5, 0.75), (2.4, -0.2, 0.9), (4.1, 0.35, 0.7), (5.3, -0.5, 0.55)):
        px, py, pz = r * 0.86 * math.cos(b) * math.cos(a), r * 0.86 * math.cos(b) * math.sin(a), r * 0.86 * math.sin(b)
        m.ball(cx + px, cy + py, z + 1.4 + r + pz, r * 0.36 * s, 'leaf', n=5, rings=3, sz=0.8)


def glass_tower(m, cx, cy, w, d, floors, fh, D, r=3.0, lobby=5.5):
    """Glass office tower with rounded corners, floor bands, fins and a district-colour crown. Returns the top."""
    H = lobby + floors * fh
    with m.use('glass'):
        m.rbox(cx, cy, w, d, 0, H, 'glass_b', r=r, seg=3, top=False, col1='glass_c')
    m.band(cx, cy, w, d, lobby - 0.6, lobby + 0.25, 'trim', r=r, out=0.4, seg=3)
    for f in range(1, floors):
        z = lobby + f * fh
        m.band(cx, cy, w, d, z - 0.28, z + 0.28, 'trim', r=r, out=0.16, seg=3)
    x0, x1, y0, y1 = cx - w / 2, cx + w / 2, cy - d / 2, cy + d / 2
    lit = mixc('glass_c', 'lamp', 0.3)
    for s in SIDES4:
        with m.side(s, x0, x1, y0, y1) as Lw:
            span = Lw - 2 * r
            nb = max(2, round(span / 3.7))
            for i in range(nb + 1):
                fx = -span / 2 + span * i / nb
                m.box(fx - 0.15, fx + 0.15, -0.42, 0, lobby, H, 'trim', top=False)
            with m.use('glow'):
                for f in range(floors):
                    for i in range(nb):
                        if m.rng.random() < 0.11:
                            xa = -span / 2 + span * i / nb + 0.25
                            m.fq(xa, xa + span / nb - 0.5, lobby + f * fh + 0.4, lobby + (f + 1) * fh - 0.4, -0.05, lit)
    m.band(cx, cy, w, d, H - 0.25, H + 2.0, D, r=r, out=0.5, seg=3)
    m.rbox(cx, cy, w * 0.56, d * 0.56, H + 2.0, H + 5.2, 'w_white', r=1.5, seg=2, top=False)
    m.band(cx, cy, w * 0.56, d * 0.56, H + 5.2, H + 5.8, D, r=1.5, out=0.5)
    m.cyl(cx + w * 0.12, cy, H + 5.8, H + 10.5, 0.22, 5, 'trim', r2=0.08)
    with m.use('glow'):
        m.ball(cx + w * 0.12, cy, H + 10.7, 0.4, 'd_software', n=5, rings=3)
    m.ac_unit(cx - w * 0.36, cy - d * 0.36, H + 2.0, 1.4)
    m.ac_unit(cx + w * 0.36, cy + d * 0.34, H + 2.0, 1.4, math.pi / 2)
    return H


# ================================================================== SOFTWARE (red)
@building('hirvo', 'software', site='site_large')
def b_hirvo(m, L):
    """Careers office: glass office tower with a lower wing. Job search and resumes for international students."""
    D = 'd_software'
    W, Dp = {3: (36, 28), 4: (66, 50), 5: (76, 58)}[L]
    ph = m.pad(W, Dp)
    set_door(m, 0 if L == 3 else -13, -Dp / 2)
    m.push(0, 0, ph)
    if L == 3:
        w, d, fl, fh = 19.0, 13.0, 3, 3.9
        cy = 2.5
        x0, x1, y0, y1 = -w / 2, w / 2, cy - d / 2, cy + d / 2
        H = fl * fh
        m.rbox(0, cy, w, d, 0, H, 'w_white', r=0.8, top=False)
        m.band(0, cy, w, d, H - 0.1, H + 0.9, D, r=0.8, out=0.45)
        m.rbox(0, cy + 1, 5, 4, H + 0.9, H + 3.4, 'w_grey', r=0.4, bev=0.2, top='roof_light')
        m.ac_unit(-5.5, cy - 2, H + 0.9)
        with m.side('front', x0, x1, y0, y1):
            with m.use('glass'):
                m.fq(-w / 2 + 1.6, w / 2 - 1.6, 0.3, H - 0.9, -0.12, ['glass_b', 'glass_b', 'glass_c', 'glass_c'])
            for f in range(1, fl):
                m.box(-w / 2 + 1.4, w / 2 - 1.4, -0.3, 0, f * fh - 0.25, f * fh + 0.25, 'trim', bottom=True)
            for fx in row(5, w - 3.2 + (w - 3.2) / 4)[0:5]:
                m.box(fx - 0.12, fx + 0.12, -0.34, 0, 0.3, H - 0.9, 'trim', top=False)
            m.door(0, 3.0, 3.3, col='trim', glass=0.8, double=True, y=-0.3)
            m.canopy(-3.2, 3.2, -3.4, -0.2, 3.7, D, posts=[(-2.8, -3.0), (2.8, -3.0)])
            m.sign('Hirvo', 0, 4.4, 1.5, col='trim', board=D, y=-0.36)
        ribbons(m, (x0, x1, y0, y1), ('left', 'right', 'back'), fl, 1.1, fh, 1.9)
        page_icon(m, -w / 2 - 2.6, 3.2, y0 - 2.0, 2.2, 2.9)
        for sx in (-0.9, 0.9):
            m.cyl(-w / 2 - 2.6 + sx, y0 - 1.9, 0, 2.0, 0.09, 4, 'iron', cap=False)
        m.flag(w / 2 + 3.5, y0 - 2, 9, D)
        m.planter(-5.5, y0 - 1.3, 3.0, 1.2)
        m.planter(5.5, y0 - 1.3, 3.0, 1.2)
        m.lamp(W / 2 - 3, -Dp / 2 + 3, 6, rz=math.pi)
        m.tree(-W / 2 + 4, cy + 3, 0.9)
        m.pop()
        return
    floors = 15 if L == 4 else 18
    tw, td, tcx, tcy = 28.0, 28.0, -13.0, 3.0
    H = glass_tower(m, tcx, tcy, tw, td, floors, 3.9, D)
    ty0 = tcy - td / 2
    # tower entrance
    with m.at(tcx, ty0, 0):
        m.door(0, 4.4, 4.0, col='trim', glass=0.85, double=True, y=-0.05, fw=0.3)
        m.canopy(-5.0, 5.0, -5.5, 0.2, 4.6, D, th=0.45, posts=[(-4.4, -5.0), (4.4, -5.0)])
        m.text('Hirvo', 3.4, 0, H + 0.12, 'trim', y=-0.56, mat='glow', bold=0.03)
    with m.side('right', tcx - tw / 2, tcx + tw / 2, ty0, tcy + td / 2):
        m.text('Hirvo', 3.4, 0, H + 0.12, 'trim', y=-0.56, mat='glow', bold=0.03)
    # the lower wing
    wx0, wx1, wy0, wy1 = tcx + tw / 2 - 1.0, 29.0, -8.0, 14.0
    wcx, wcy, ww, wd = (wx0 + wx1) / 2, (wy0 + wy1) / 2, wx1 - wx0, wy1 - wy0
    wf, wfh = 4, 4.0
    WH = wf * wfh
    m.rbox(wcx, wcy, ww, wd, 0, WH, 'w_cream', r=1.0, top=False)
    m.parapet_roof(wcx, wcy, ww, wd, WH, 'w_cream', h=0.9, r=1.0, roof='roof_light' if L == 4 else 'grass_g')
    m.band(wcx, wcy, ww, wd, WH + 0.9, WH + 1.25, D, r=1.0, out=0.3, ring=(L == 5))
    ribbons(m, (wx0, wx1, wy0, wy1), ('front', 'right', 'back'), wf - 1, wfh + 1.0, wfh, 2.1)
    with m.side('front', wx0, wx1, wy0, wy1) as Lw:
        m.shopfront(-Lw / 2 + 2.2, Lw / 2 - 5.8, 0, 3.3, plinth=0.5)
        m.door(Lw / 2 - 3.4, 2.6, 3.3, col='trim', glass=0.8, double=True)
        m.awning(-Lw / 2 + 1.8, Lw / 2 - 1.2, 4.3, 2.0, D, 'trim', drop=0.7)
        page_icon(m, -Lw / 2 + 4.4, 2.0, -0.42, 1.5, 2.0)
        page_icon(m, -Lw / 2 + 6.6, 2.0, -0.42, 1.5, 2.0)
        page_icon(m, -Lw / 2 + 8.8, 2.0, -0.42, 1.5, 2.0)
    with m.side('right', wx0, wx1, wy0, wy1) as Lw:
        m.shopfront(-Lw / 2 + 2, Lw / 2 - 2, 0, 3.0, plinth=0.9)
    with m.side('back', wx0, wx1, wy0, wy1) as Lw:
        m.door(0, 2.4, 3.0, col='steel_light', glass=0.0)
    if L == 4:
        m.roof_plant(wx0 + 2, wx1 - 2, wy0 + 2, wy1 - 2, WH + 1.25, n=3)
    else:
        # roof garden on the wing
        m.rbox(wcx - 5, wcy + 5, 4.2, 3.4, WH, WH + 3.0, 'w_grey', r=0.3, seg=1, bev=0.2, top='roof_light')
        for tx, ty, ts in ((wcx + 6, wcy + 4, 0.55), (wcx + 2, wcy - 5, 0.5), (wcx - 8, wcy - 4, 0.6)):
            m.tree(tx, ty, ts, 'round', z=WH)
        m.planter(wcx + 7, wcy - 6, 4.0, 1.4, z=WH, flowers='flower_pink')
        m.planter(wcx - 2, wcy + 7.5, 5.0, 1.4, z=WH, flowers='flower_yel')
        umbrella_table(m, wcx + 1, wcy + 1.5, WH, col=D)
        m.bench(wcx - 6, wcy - 7.5, 0, 2.4, z=WH)
    # forecourt
    fy = -Dp / 2 + 4
    for px in (-27, -3, 6, 27) if L == 4 else (-33, -3, 6, 33):
        m.lamp(px, fy, 7.0, rz=math.pi)
    m.planter(tcx - 9, ty0 - 2.2, 5.0, 1.6, flowers='flower_red')
    m.planter(tcx + 9, ty0 - 2.2, 5.0, 1.6, flowers='flower_red')
    m.bench(wcx - 4, wy0 - 6, math.pi, 2.6)
    m.bench(wcx + 4, wy0 - 6, math.pi, 2.6)
    m.tree(W / 2 - 4.5, wy0 - 4, 1.0)
    m.tree(W / 2 - 4.5, wy1 + 3, 1.1)
    m.tree(-W / 2 + 4, tcy + td / 2 + 1 if L == 5 else tcy, 1.0)
    for fx, fc in ((wcx - 8, D), (wcx - 5, 't_blue'), (wcx - 2, 't_yel')) if L == 4 else ():
        m.flag(fx, wy0 - 10.5, 10, fc)
    if L == 5:
        # a round glass auditorium, a globe and a row of flags
        ax, ay, ar = -W / 2 + 12.5, -Dp / 2 + 13.0, 7.5
        m.cyl(ax, ay, 0, 1.0, ar + 0.2, 16, 'w_stone')
        with m.use('glass'):
            m.cyl(ax, ay, 1.0, 6.0, ar, 16, 'glass_b', cap=False, col1='glass_c')
        for k in range(8):
            a = math.pi / 8 + k * math.pi / 4
            m.cbox(ax + ar * math.cos(a), ay + ar * math.sin(a), 0.4, 0.4, 1.0, 6.0, 'trim', top=False)
        m.lathe(ax, ay, [(ar + 0.7, 6.0), (ar + 0.7, 6.7), (ar * 0.5, 8.3), (0.0, 8.6)], 16, [D, D, tint(D, 0.1), tint(D, 0.15)], bottom=True)
        with m.at(ax, ay - ar, 0):
            m.door(0, 3.0, 3.4, col='trim', glass=0.8, double=True, y=0.1)
        globe(m, 6.0, -Dp / 2 + 9.5, 0, 2.3)
        for i, fc in enumerate((D, 't_blue', 't_yel', 't_green', 't_purple', 't_orange')):
            m.flag(13 + i * 3.4, -Dp / 2 + 5.5, 10.5, fc)
        # letters standing on the wing roof
        with m.at(wcx, wy0 + 1.2, WH + 1.25):
            for sx in (-6, 0, 6):
                m.beam((sx, 0.3, 0), (sx, 0.3, 4.2), 0.2, 0.2, 'iron')
                m.beam((sx, 0.3, 3.0), (sx, 2.2, 0), 0.14, 0.14, 'iron')
            m.plate(rrect2(0, 2.9, 17, 4.2, 0.5), 0.2, 0.3, D)
            m.text('Hirvo', 3.6, 0, 1.55, 'trim', y=-0.14, mat='glow', bold=0.02)
    m.pop()


@building('trade', 'software', site='site_large')
def b_trade(m, L):
    """Harbour warehouse on the coast: arched shed, quay, quay cranes, containers, a pier. Export risk checks.
    The sea is behind the building (+y in Blender, -z in glTF). No client name anywhere."""
    D = 'd_software'
    m.ground_z = None
    m.ao_cell = 4.0 if L == 3 else 6.5
    W = {3: 44, 4: 74, 5: 76}[L]
    front, quay = ({3: -17, 4: -24, 5: -26}[L], {3: 22, 4: 34, 5: 36}[L])
    pcy, pd = (front + quay) / 2, quay - front
    ph = m.pad(W, pd, cy=pcy, skirt=9.0, col='pave_dark')
    set_door(m, 0, front)
    m.meta['quayEdge'] = round(-quay, 1)
    m.push(0, 0, ph)
    sw, sd, sh, rh = (30, 16, 7.0, 5.0) if L == 3 else (58, 26, 9.5, 8.0)
    scx = 0 if L < 5 else -6
    if L == 5:
        sw = 52
    x0, x1, y0, y1 = scx - sw / 2, scx + sw / 2, -sd / 2, sd / 2
    m.box(x0, x1, y0, y1, 0, sh, 'w_white', top=False)
    m.band(scx, 0, sw, sd, 0, 1.1, 'plinth', r=0.02, out=0.15, seg=1)
    m.vault(x0, x1, y0, y1, sh, rh, D, axis='x', n=10, over=1.0, end='w_white', th=0.5, ribs=5 if L > 3 else 3)
    nb = 3 if L == 3 else 6
    with m.side('front', x0, x1, y0, y1) as Lw:
        bay = Lw / nb
        for i in range(nb + 1):
            m.box(-Lw / 2 + i * bay - 0.35, -Lw / 2 + i * bay + 0.35, -0.3, 0, 0, sh, 'w_stone', top=False)
        for i in range(nb):
            bx = -Lw / 2 + (i + 0.5) * bay
            if i % 2 == 0:
                m.box(bx - bay * 0.33, bx + bay * 0.33, -0.25, 0, 0, 6.0, D, top=tint(D, 0.1))
                for k in range(5):
                    m.fq(bx - bay * 0.31, bx + bay * 0.31, 0.5 + k * 1.1, 0.62 + k * 1.1, -0.27, shade(D, 0.75))
                m.fq(bx - 0.06, bx + 0.06, 0, 6.0, -0.28, shade(D, 0.6))
            else:
                m.win(bx, 3.6, bay * 0.5, 2.0, bars=(2, 0))
                if i == (1 if L == 3 else 3):
                    m.door(bx, 2.0, 2.9, col='steel_light', glass=0.3)
        m.sign('HARBOUR', 0, sh - 2.2, 1.3, col='trim', board=D, y=-0.3, max_w=bay * 1.6)
        check_shield(m, -Lw / 2 + bay * (0.5 if L == 3 else 1.5), sh - 1.4 if L > 3 else sh - 1.3, -0.3, 2.6 if L > 3 else 2.0, D)
    for sname in ('left', 'right'):
        with m.side(sname, x0, x1, y0, y1) as Lw:
            az = sh + rh * 0.36
            m.plate(disc2(0, az, rh * 0.3 + 0.3, 12), 0, 0.2, 'trim')
            with m.use('glow'):
                m.poly([(x, -0.24, z) for x, z in disc2(0, az, rh * 0.3, 12)], 'pane')
            m.fq(-0.09, 0.09, az - rh * 0.3, az + rh * 0.3, -0.27, 'trim')
            m.fq(-rh * 0.3, rh * 0.3, az - 0.09, az + 0.09, -0.27, 'trim')
            for wx in row(3, Lw - 5):
                m.win(wx, 3.4, 2.6, 2.2, bars=(1, 1))
            check_shield(m, 0, sh - 1.0, -0.05, 2.2, D) if sname == 'right' and L > 3 else None
    with m.side('back', x0, x1, y0, y1) as Lw:
        bay = Lw / nb
        for i in range(nb):
            bx = -Lw / 2 + (i + 0.5) * bay
            m.box(bx - bay * 0.33, bx + bay * 0.33, -0.25, 0, 0, 6.0, shade('steel_light', 0.9) if i % 2 else D)
    # the quay: mooring bollards, yellow edge, lamps
    qy = quay - 0.6
    m.box(-W / 2 + 3, W / 2 - 3, quay - 1.0, quay - 0.5, 0, 0.06, 'hazard')
    for bx in row(6 if L > 3 else 4, W - 10):
        bollard(m, bx, qy - 1.2)
    # containers
    cc = [D, 'd_books', 'd_film', 'd_games', 'd_health', 'steel_light']
    rng = m.rng

    def stack(cx, cy, nx, nz, rz=0.0, L_=6.2):
        for i in range(nx):
            hgt = nz - (1 if (i == nx - 1 and nz > 1) else 0)
            for k in range(hgt):
                container(m, cx + (i - (nx - 1) / 2) * 2.75 * (0 if rz else 1), cy + (i - (nx - 1) / 2) * 2.75 * (1 if rz else 0), k * 2.62, rng.choice(cc), L_, rz=math.pi / 2 if not rz else 0.0)
    if L == 3:
        stack(-13, sd / 2 + 6, 3, 2)
        stack(13, sd / 2 + 6, 2, 1)
        quay_crane(m, 0, quay - 7.5, 0, s=0.62, col=D, boom=20)
        piers = [(-13, 34)]
    else:
        stack(-W / 2 + 9, sd / 2 + 8.5, 4, 3)
        stack(-W / 2 + 21.5, sd / 2 + 8.5, 3, 2)
        stack(W / 2 - 9, sd / 2 + 8.5, 4, 3)
        if L == 5:
            stack(W / 2 - 21, sd / 2 + 8.5, 3, 3)
        quay_crane(m, -11, quay - 7.0, 0, s=0.92, col=D, boom=25)
        quay_crane(m, 11, quay - 7.0, 0, s=0.92, col=D, boom=25)
        piers = [(-30, 46), (30, 46)] if L == 4 else [(-31, 56), (31, 46)]
    # the piers: timber decks on piles, running out to sea
    for px, pl in piers:
        pw = 8.0
        m.box(px - pw / 2, px + pw / 2, quay - 0.5, quay + pl, -0.75, 0.05, 'pave_light', bottom=True)
        m.box(px - pw / 2 + 0.3, px + pw / 2 - 0.3, quay, quay + pl - 0.3, 0.05, 0.1, 'deck_wood')
        for k in range(int(pl // 9) + 1):
            for sx in (-1, 1):
                m.cyl(px + sx * (pw / 2 - 0.7), quay + 3 + k * 9 if quay + 3 + k * 9 < quay + pl else quay + pl - 1, -9.5, -0.75, 0.5, 6, 'timber_dark', cap=False)
        for k in range(int(pl // 12) + 1):
            bollard(m, px - pw / 2 + 0.8, quay + 5 + k * 12 if 5 + k * 12 < pl else quay + pl - 1.5, 0.05)
        m.globe_lamp(px, quay + pl - 1.2, 4.5, z=0.05)
    if L == 5:
        # a harbour office with a look-out, a longer pier with a beacon, a barge at the quay
        ox, oy = W / 2 - 8.5, -4.0
        m.rbox(ox, oy, 11, 12, 0, 7.0, 'w_cream', r=0.6, top=False)
        m.parapet_roof(ox, oy, 11, 12, 7.0, 'w_cream', h=0.7, r=0.6)
        m.band(ox, oy, 11, 12, 7.7, 8.0, D, r=0.6, out=0.25)
        ribbons(m, (ox - 5.5, ox + 5.5, oy - 6, oy + 6), ('front', 'right', 'back'), 2, 1.2, 3.4, 1.8)
        with m.at(ox, oy - 6, 0):
            m.door(-2.5, 2.0, 2.9, col='trim', glass=0.6, y=-0.02)
        m.rbox(ox + 1, oy + 2, 5.5, 5.5, 8.0, 11.2, 'w_white', r=0.8, top=False)
        with m.use('glass'):
            m.rbox(ox + 1, oy + 2, 5.7, 5.7, 9.2, 10.6, 'glass_b', r=0.9, top=False)
        m.band(ox + 1, oy + 2, 5.5, 5.5, 11.2, 11.7, D, r=0.8, out=0.7)
        m.cyl(ox + 1, oy + 2, 11.7, 15.5, 0.12, 4, 'trim', cap=False)
        m.beam((ox - 0.8, oy + 2, 14.6), (ox + 2.8, oy + 2, 14.6), 0.12, 0.5, 'trim')
        px, pl = piers[0]
        with m.at(px, quay + pl - 2.5, 0.05):
            m.lathe(0, 0, [(1.3, 0), (1.0, 3.4), (1.2, 3.6), (1.2, 3.9)], 8, ['trim', D, 'trim', 'trim'])
            with m.use('glow'):
                m.cyl(0, 0, 3.9, 4.9, 0.7, 8, 'lamp')
            m.lathe(0, 0, [(1.1, 4.9), (0.0, 5.8)], 8, D, bottom=True)
        # barge
        with m.at(0, quay + 9, -3.0):
            hull = [(-13, -3.2), (11, -3.2), (14, 0), (11, 3.2), (-13, 3.2)]
            m.prism(hull, 0, 3.0, 'navy', top='deck_wood')
            m.prism([(x * 1.01, y * 1.04) for x, y in hull], 2.6, 3.05, D, top=False)
            for i in range(3):
                container(m, -8 + i * 6.5, 0, 3.0, cc[(i * 2 + 1) % 6], 6.0)
            container(m, -4.5, 0, 5.62, cc[4], 6.0)
            m.rbox(-11, 0, 3, 5, 3.0, 6.6, 'trim', r=0.3, seg=1, bev=0.2)
            with m.use('glass'):
                m.box(-12.55, -9.45, -2.2, 2.2, 5.0, 6.0, 'glass_b', top=False)
    # yard life
    truck(m, -6 if L > 3 else 8, front + 5.5, 0, 0.0, col=D, load='box')
    if L > 3:
        truck(m, 14, front + 5.5, 0, math.pi, col='trim', load='box')
        for lx in (-W / 2 + 4, W / 2 - 4):
            floodlight(m, lx, front + 3.5, 13)
            floodlight(m, lx, quay - 3.5, 13, math.pi)
        m.planter(-20, front + 2.2, 4, 1.3)
        m.flag(-W / 2 + 7, front + 3, 10, D)
    else:
        m.lamp(-W / 2 + 3, front + 3, 7, rz=math.pi)
        m.lamp(W / 2 - 3, front + 3, 7, rz=math.pi)
    m.pop()


@building('court', 'software', site='site_large')
def b_court(m, L):
    """Sports hall: a vaulted hall with outdoor half-courts marked A, B, C. A court-booking mini program. No client name."""
    D = 'd_software'
    W, Dp = {3: (38, 40), 4: (62, 52), 5: (74, 56)}[L]
    ph = m.pad(W, Dp, col='pave')
    set_door(m, 0, -Dp / 2)
    m.push(0, 0, ph)
    hw, hd, hh, rh = (22, 15, 6.0, 5.5) if L == 3 else (36, 23, 8.0, 8.5)
    hcx = 0 if L < 5 else -6
    hcy = Dp / 2 - hd / 2 - 2.5
    x0, x1, y0, y1 = hcx - hw / 2, hcx + hw / 2, hcy - hd / 2, hcy + hd / 2
    m.box(x0, x1, y0, y1, 0, hh, 'w_cream', top=False)
    m.band(hcx, hcy, hw, hd, 0, 1.0, 'w_brick', r=0.02, out=0.15, seg=1)
    m.vault(x0, x1, y0, y1, hh, rh, D, axis='y', n=12, over=1.2, end=None, th=0.5, ribs=4 if L > 3 else 3)
    # glazed arch front and back
    for sname in ('front', 'back'):
        with m.side(sname, x0, x1, y0, y1) as Lw:
            n = 12
            arc = [((Lw / 2 - 0.5) * math.cos(math.pi * k / n), hh + (rh - 0.5) * math.sin(math.pi * k / n)) for k in range(n + 1)]
            m.poly([(x, 0.0, z) for x, z in arc], 'w_cream')
            ga = [(x * 0.86, hh + 0.5 + (z - hh) * 0.84) for x, z in arc]
            with m.use('glass' if sname == 'front' else 'glow'):
                m.poly([(x, -0.1, z) for x, z in ga], 'glass_a' if sname == 'front' else 'pane')
            for k in (2, 4, 6, 8, 10):
                m.fq(ga[k][0] - 0.1, ga[k][0] + 0.1, hh + 0.5, ga[k][1], -0.14, 'trim')
            m.box(-Lw / 2 * 0.86 - 0.2, Lw / 2 * 0.86 + 0.2, -0.3, 0, hh + 0.25, hh + 0.6, 'trim', bottom=True)
            if sname == 'front':
                m.door(0, 4.0, 3.6, col='trim', glass=0.8, double=True)
                m.canopy(-4.2, 4.2, -3.6, 0.1, 4.2, D, posts=[(-3.7, -3.2), (3.7, -3.2)])
                for wx in (-Lw / 2 + 4, Lw / 2 - 4) if L > 3 else ():
                    m.win(wx, 1.6, 3.6, 2.8, bars=(2, 1))
                m.sign('COURTS', 0, 5.0, 1.15, col='trim', board=D, y=-0.05)
            else:
                m.door(0, 2.4, 3.0, col='steel_light', glass=0.0)
    for sname in ('left', 'right'):
        with m.side(sname, x0, x1, y0, y1) as Lw:
            nbay = 3 if L == 3 else 5
            for i in range(nbay + 1):
                bx = -Lw / 2 + i * Lw / nbay
                m.poly([(bx - 0.4, 0, 0), (bx - 0.4, -1.6, 0), (bx - 0.4, -0.3, hh), (bx - 0.4, 0, hh)][::-1], 'w_stone')
                m.poly([(bx + 0.4, 0, 0), (bx + 0.4, -1.6, 0), (bx + 0.4, -0.3, hh), (bx + 0.4, 0, hh)], 'w_stone')
                m.poly([(bx - 0.4, -1.6, 0), (bx + 0.4, -1.6, 0), (bx + 0.4, -0.3, hh), (bx - 0.4, -0.3, hh)], 'w_stone')
            for wx in row(nbay, Lw):
                m.win(wx, 3.2, Lw / nbay * 0.55, 2.6, bars=(1, 1))
    # the outdoor half-courts
    cw, cd = 14.0, 13.0
    ccy = y0 - cd / 2 - 5.0
    letters = ['A'] if L == 3 else ['A', 'B', 'C']
    cols = ['court_red', 'court_blue', 'court_red']
    gap = 3.4
    tot = len(letters) * cw + (len(letters) - 1) * gap
    cxs = [(-tot / 2 + cw / 2 + i * (cw + gap)) + (hcx if L == 5 else 0) for i in range(len(letters))]
    if L == 3:
        cxs = [-W / 2 + cw / 2 + 4.5]
    for cxx, let, cc in zip(cxs, letters, cols):
        half_court(m, cxx, ccy, cw, cd, cc, let)
    # fence posts and floodlights round the courts
    fx0, fx1 = cxs[0] - cw / 2 - 2.0, cxs[-1] + cw / 2 + 2.0
    fy0, fy1 = ccy - cd / 2 - 2.0, ccy + cd / 2 + 2.2
    m.fence([(fx0, fy1), (fx0, fy0), (fx1, fy0), (fx1, fy1)] if L > 3 else [(fx0, fy1), (fx0, fy0), (fx1, fy0)], 2.2, 'trim', every=5.0, rails=(0.5, 1.0))
    floodlight(m, fx0 + 0.3, fy0 + 0.3, 11, math.pi * 0.75 + math.pi)
    floodlight(m, fx1 - 0.3, fy0 + 0.3, 11, -math.pi * 0.75 + math.pi)
    # a giant basketball by the door
    bxp, byp = (x1 + 3.2, y0 - 1.5) if L == 3 else (x0 - 3.6, y0 + 4)
    m.cyl(bxp, byp, 0, 0.5, 1.5, 8, 'w_stone')
    m.ball(bxp, byp, 2.3, 1.9, shade('t_orange', 0.85), n=10, rings=6, col1='t_orange')
    m.torus(bxp, byp, 2.3, 1.93, 0.06, 12, 3, 'iron', axis='z')
    m.torus(bxp, byp, 2.3, 1.93, 0.06, 12, 3, 'iron', axis='x')
    m.bench(cxs[0], fy0 - 1.2, 0, 2.6)
    m.lamp(-W / 2 + 3, -Dp / 2 + 2.5, 6.5, rz=math.pi)
    m.lamp(W / 2 - 3, -Dp / 2 + 2.5, 6.5, rz=math.pi)
    m.tree(W / 2 - 4, hcy + 2, 1.0) if L != 5 else None
    m.tree(-W / 2 + 4, hcy + 4, 1.1)
    if L >= 4:
        m.bench(cxs[-1], fy0 - 1.2, 0, 2.6)
        m.flag(x1 + 2.5, y0 - 1.5, 10, D)
        m.planter(x0 + 6, y0 - 1.3, 4, 1.2)
        m.planter(x1 - 6, y0 - 1.3, 4, 1.2)
    if L == 5:
        # club house annex, bleachers, a scoreboard and more flags
        ax0, ax1, ay0, ay1 = x1 - 0.3, W / 2 - 3.5, hcy - 8, hcy + 8
        acx, acy = (ax0 + ax1) / 2, (ay0 + ay1) / 2
        m.rbox(acx, acy, ax1 - ax0, ay1 - ay0, 0, 7.6, 'w_white', r=0.8, top=False)
        m.parapet_roof(acx, acy, ax1 - ax0, ay1 - ay0, 7.6, 'w_white', h=0.8, r=0.8)
        m.band(acx, acy, ax1 - ax0, ay1 - ay0, 8.4, 8.75, D, r=0.8, out=0.3)
        ribbons(m, (ax0, ax1, ay0, ay1), ('front', 'right', 'back'), 1, 4.9, 3.6, 1.9)
        with m.side('front', ax0, ax1, ay0, ay1) as Lw:
            m.shopfront(-Lw / 2 + 1.5, Lw / 2 - 4.8, 0, 3.2)
            m.door(Lw / 2 - 2.8, 2.2, 3.1, col='trim', glass=0.7)
            m.awning(-Lw / 2 + 1, Lw / 2 - 1, 4.2, 2.0, D, 'trim', drop=0.7)
        with m.side('right', ax0, ax1, ay0, ay1) as Lw:
            m.shopfront(-Lw / 2 + 2, Lw / 2 - 2, 0, 3.0, plinth=0.9)
        umbrella_table(m, acx - 3, ay0 - 4, 0, col=D)
        umbrella_table(m, acx + 3.5, ay0 - 4.5, 0, col=D)
        m.roof_plant(ax0 + 1, ax1 - 1, ay0 + 1, ay1 - 1, 7.62, n=2, stair=False)
        # bleachers along the right of the courts
        bx = fx1 + 1.0
        for k in range(4):
            m.box(bx + k * 1.3, bx + (k + 1) * 1.3, fy0 + 2, fy1 - 2, 0, 0.6 + k * 0.6, 'w_stone', top='timber')
        m.box(bx + 5.2, bx + 5.5, fy0 + 2, fy1 - 2, 0, 3.6, 'w_stone')
        # scoreboard
        sx, sy = fx0 - 2.6, ccy
        with m.at(sx, sy, 0, -math.pi / 2):
            for px in (-2.4, 2.4):
                m.cyl(px, 0, 0, 5.5, 0.16, 5, 'iron', cap=False)
            m.box(-3.4, 3.4, -0.3, 0.3, 5.0, 8.6, 'iron', bottom=True)
            with m.use('glow'):
                m.fq(-3.0, -0.5, 5.5, 8.1, -0.32, 't_red')
                m.fq(0.5, 3.0, 5.5, 8.1, -0.32, 't_yel')
            m.plate(rrect2(0, 9.2, 5.2, 1.0, 0.2), 0.3, 0.6, D)
        for i, fc in enumerate((D, 't_blue', 't_yel')):
            m.flag(-W / 2 + 4 + i * 3, -Dp / 2 + 3.5, 10, fc)
        floodlight(m, fx0 + 0.3, fy1 - 0.3, 11, math.pi * 0.25 + math.pi)
        floodlight(m, fx1 - 0.3, fy1 - 0.3, 11, -math.pi * 0.25 + math.pi)
    m.pop()


@building('uhome', 'software', site='site_large')
def b_uhome(m, L):
    """Apartment show home: a stepped modern apartment block with balconies and a show-home entrance."""
    D = 'd_software'
    W, Dp = {3: (36, 30), 4: (56, 42), 5: (68, 50)}[L]
    m.ao_cell = 4.0 if L == 3 else 7.0
    ph = m.pad(W, Dp)
    m.push(0, 0, ph)
    fh = 3.4
    steps = {3: [2, 3], 4: [5, 7, 9], 5: [5, 7, 9, 11]}[L]
    sw = 10.5 if L == 3 else 11.5
    d = 13.0 if L == 3 else 17.0
    tot = sw * len(steps)
    bx0 = -tot / 2 + (0 if L < 5 else 3)
    cy = 3.5
    y0, y1 = cy - d / 2, cy + d / 2
    walls = ['w_white', 'w_cream', 'w_white', 'w_cream']
    for i, fl in enumerate(steps):
        xa, xb = bx0 + i * sw, bx0 + (i + 1) * sw
        cx = (xa + xb) / 2
        H = fl * fh
        m.box(xa, xb, y0, y1, 0, H, walls[i], top=False)
        last = i == len(steps) - 1
        # roof terrace on every step, a floating red roof on the tallest
        m.parapet_roof(cx, cy, sw, d, H, walls[i], h=0.9, r=0.02, seg=1, roof='pave_light' if not last else 'roof_light')
        if last:
            m.rbox(cx, cy, sw - 3, d - 4, H + 0.9, H + 3.4, 'w_grey', r=0.4, seg=1, top=False)
            m.rbox(cx, cy - 0.5, sw + 1.6, d + 2.2, H + 3.4, H + 3.9, D, r=0.5, seg=2, bottom=True, bev=0.15)
            m.ac_unit(cx - 2, y1 - 1.5, H + 3.9, 1.1)
        else:
            m.planter(cx, y1 - 1.6, sw - 3, 1.3, z=H + 0.02, flowers='flower_pink')
            m.tree(cx - 2.5, cy + 1, 0.42, 'round', z=H + 0.02)
            if L > 3:
                umbrella_table(m, cx + 2, cy - 2.5, H + 0.02, col=D, r=1.8)
        # balconies with glass rails and wide sliding windows
        with m.side('front', xa, xb, y0, y1) as Lw:
            for f in range(fl):
                z = f * fh
                if f > 0 or L == 3:
                    m.win(0, z + 0.5, Lw - 3.4, 2.3, bars=(1 if L < 5 else 0, 0), fw=0.18, dep=0.12)
                if f > 0:
                    m.box(-Lw / 2 + 0.9, Lw / 2 - 0.9, -1.9, 0, z - 0.2, z + 0.02, 'trim', bottom=True)
                    glass_rail(m, -Lw / 2 + 0.95, Lw / 2 - 0.95, -1.85, z + 0.02, 1.05)
        with m.side('back', xa, xb, y0, y1) as Lw:
            for f in range(fl):
                m.win(0, f * fh + 0.9, Lw - 4.5, 1.7, bars=(2 if L < 5 else 0, 0), fw=0.16, dep=0.12)
        if i == 0:
            wall_windows(m, (xa, xb, y0, y1), ('left',), 5.0, fl, 0.9, fh, 2.0, 1.7, bars=(1, 0), fw=0.16, dep=0.12)
        # the exposed end wall above the lower neighbour
        prev = steps[i - 1] if i else 0
        if i:
            with m.side('left', xa, xb, y0, y1) as Lw:
                for f in range(prev, fl):
                    for wx in row(2, Lw - 4):
                        m.win(wx, f * fh + 0.9, 2.0, 1.7, bars=(1, 0), fw=0.16, dep=0.12)
        if last:
            with m.side('right', xa, xb, y0, y1) as Lw:
                # the stair core: a red fin up the end wall
                m.box(-2.2, 2.2, -0.9, 0, 0, H + 2.4, D, top=tint(D, 0.1))
                with m.use('glow'):
                    for f in range(fl):
                        m.fq(-1.2, 1.2, f * fh + 1.0, f * fh + 2.6, -0.93, 'pane')
                for f in range(fl):
                    for wx in (-Lw / 2 + 2.6, Lw / 2 - 2.6):
                        m.win(wx, f * fh + 0.9, 2.0, 1.7, bars=(1, 0), fw=0.16, dep=0.12)
    # the show-home entrance: a glass pavilion at the foot of the block
    ex = bx0 + sw * (0.5 if L == 3 else 1.0)
    ew, ed, eh = (7.0, 4.0, 3.6) if L == 3 else (13.0, 6.5, 5.2)
    ey0 = y0 - ed
    with m.use('glass'):
        m.rbox(ex, y0 - ed / 2, ew, ed, 0, eh, 'glass_b', r=0.5, top=False, col1='glass_c')
    for gx in row(4 if L > 3 else 3, ew + ew / (4 if L > 3 else 3)):
        m.cbox(gx + ex, ey0, 0.22, 0.22, 0, eh, 'trim', top=False)
    m.rbox(ex, y0 - ed / 2 - 0.6, ew + 1.6, ed + 2.4, eh, eh + 0.5, D, r=0.5, bottom=True, bev=0.15)
    with m.at(ex, ey0, 0):
        m.door(0, 3.0, 3.2, col='trim', glass=0.85, double=True, y=-0.02)
        m.sign('UHOME', 0, eh + 0.6, 1.5 if L > 3 else 1.1, col='trim', board=D, y=-1.6)
    set_door(m, ex, -Dp / 2)
    # garden and street
    for sx in (-1, 1):
        m.banner(ex + sx * (ew / 2 + 2.2), ey0 - 2.5, 2.6, 6.8, 1.5, D, sideways=sx, emblem=None)
    # blueprint board: a white line drawing of a house on blue
    bxp, byp = (W / 2 - 6.5, -Dp / 2 + 5.0)
    with m.at(bxp, byp, 0, -0.35):
        for px in (-2.0, 2.0):
            m.cyl(px, 0, 0, 5.4, 0.13, 4, 'iron', cap=False)
        m.plate(rrect2(0, 3.7, 5.4, 3.6, 0.25), 0.1, 0.25, 't_blue', back=True)
        yy = -0.2
        for a, b in (((-1.5, 2.6), (1.5, 2.6)), ((-1.5, 2.6), (-1.5, 4.0)), ((1.5, 2.6), (1.5, 4.0)), ((-1.9, 3.9), (0, 5.1)), ((0, 5.1), (1.9, 3.9)), ((-0.4, 2.6), (-0.4, 3.5)), ((0.4, 2.6), (0.4, 3.5)), ((-0.4, 3.5), (0.4, 3.5))):
            dx, dz = b[0] - a[0], b[1] - a[1]
            Ln = math.hypot(dx, dz)
            nx, nz = -dz / Ln * 0.07, dx / Ln * 0.07
            m.poly([(a[0] - nx, yy, a[1] - nz), (b[0] - nx, yy, b[1] - nz), (b[0] + nx, yy, b[1] + nz), (a[0] + nx, yy, a[1] + nz)][::-1], 'trim')
    m.lamp(-W / 2 + 3, -Dp / 2 + 3, 6.5, rz=math.pi)
    m.lamp(W / 2 - 3, -Dp / 2 + 3, 6.5, rz=math.pi)
    m.tree(-W / 2 + 4.5, y0 - 3, 1.0)
    m.planter(ex - ew / 2 - 5.5, y0 - 1.2, 4.0, 1.3, flowers='flower_red')
    if L > 3:
        m.tree(W / 2 - 4, y1 + 1, 1.1)
        m.tree(-W / 2 + 4.5, y1 + 1, 0.9, 'tall')
        m.bench(ex + ew / 2 + 5.5, y0 - 3, math.pi, 2.4)
        m.planter(bx0 + tot - 5, y0 - 1.2, 5.0, 1.3, flowers='flower_yel')
    if L == 5:
        # a pool pavilion and garden for the residents
        px, py = -W / 2 + 10.5, -Dp / 2 + 11
        m.rbox(px, py, 13, 8, 0, 0.35, 'pave_light', r=1.0)
        with m.use('glass'):
            m.cap(rrect(10.6, 5.6, 0.8, 2, px, py), 0.37, 'water_g')
        for k in range(2):
            m.cbox(px - 4 + k * 2.6, py - 5.6, 2.0, 0.9, 0, 0.4, 'trim')
        umbrella_table(m, px + 9, py - 1, 0, col=D)
        for i, fc in enumerate((D, 't_blue', 't_yel')):
            m.flag(W / 2 - 14 - i * 3, -Dp / 2 + 4, 10, fc)
        m.tree(px - 3, py + 7, 1.0)
        m.tree(px + 5, py + 7.5, 0.8, 'tall')
    m.pop()


BEAD_COLS = ['t_red', 't_pink', 't_orange', 't_yel', 't_green', 't_teal', 't_blue', 't_purple']


def bead_art(m, cx, cz, y, rows, cell=0.7, n=6, colmap=None):
    """Pixel art made of fuse beads, standing off the plane y. rows = strings, top row first; '.' is empty."""
    h = len(rows)
    w = max(len(r) for r in rows)
    for j, r in enumerate(rows):
        for i, ch in enumerate(r):
            if ch == '.':
                continue
            col = colmap[ch] if colmap else 't_red'
            bx, bz = cx + (i - (w - 1) / 2) * cell, cz + ((h - 1) / 2 - j) * cell
            ring = disc2(bx, bz, cell * 0.47, n, math.pi / n)
            m.plate(ring, y, 0.3, col)
            m.poly([(px, y - 0.33, pz) for px, pz in disc2(bx, bz, cell * 0.17, 5)], shade(col, 0.55))


HEART = ['.XX.XX.', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...']
RAINBOW = ['..RRRRR..', '.ROOOOOR.', 'ROYYYYYOR', 'ROYGGGYOR', 'ROYG.GYOR', 'ROYG.GYOR']


@building('pindou', 'software')
def b_pindou(m, L):
    """Craft shop: a small bead and craft shop (fuse-bead pixel art, giant beads on a rod)."""
    D = 'd_software'
    W, Dp = {3: (24, 20), 4: (36, 28), 5: (46, 34)}[L]
    ph = m.pad(W, Dp)
    set_door(m, 0, -Dp / 2)
    m.push(0, 0, ph)
    w, d, h = (12, 9, 5.0) if L == 3 else ((20, 13, 6.2) if L == 4 else (22, 14, 6.2))
    cy = 2.0
    x0, x1, y0, y1 = -w / 2, w / 2, cy - d / 2, cy + d / 2
    m.rbox(0, cy, w, d, 0, h, 'w_blush', r=0.6, top=False)
    m.band(0, cy, w, d, 0, 0.7, 'plinth', r=0.6, out=0.12)
    m.parapet_roof(0, cy, w, d, h, 'w_blush', h=0.7, r=0.6)
    m.band(0, cy, w, d, h + 0.7, h + 1.0, D, r=0.6, out=0.3)
    # a stepped shop-front gable that carries the bead picture
    gw = w * 0.62
    with m.side('front', x0, x1, y0, y1) as Lw:
        gh = 4.6 if L > 3 else 3.4
        m.plate([(-gw / 2, h + 0.6), (gw / 2, h + 0.6), (gw / 2, h + gh * 0.55), (gw / 2 - 1.4, h + gh * 0.55), (gw / 2 - 1.4, h + gh * 0.8), (gw / 2 - 2.8, h + gh * 0.8), (gw / 2 - 2.8, h + gh),
                 (-gw / 2 + 2.8, h + gh), (-gw / 2 + 2.8, h + gh * 0.8), (-gw / 2 + 1.4, h + gh * 0.8), (-gw / 2 + 1.4, h + gh * 0.55), (-gw / 2, h + gh * 0.55)], 0.1, 0.7, 'trim', edge='w_blush', back=True)
        bead_art(m, 0, h + gh * 0.52, -0.6, HEART, cell=0.62 if L > 3 else 0.46, colmap={'X': 't_red'})
        dx = Lw / 2 - 2.6
        m.door(dx, 2.0, 3.1, col='t_teal', glass=0.5)
        m.shopfront(-Lw / 2 + 1.2, dx - 2.0, 0, 3.2, plinth=0.8)
        m.awning(-Lw / 2 + 0.6, Lw / 2 - 0.6, 4.4, 1.9, D, 'trim', drop=0.8)
        # jars of beads in the window
        for i, bx in enumerate(row(4 if L > 3 else 2, dx - 2.0 - (-Lw / 2 + 1.2) - 1, (dx - 2.0 + -Lw / 2 + 1.2) / 2)):
            m.cyl(bx, -0.5, 0.82, 2.0, 0.5, 6, BEAD_COLS[(i * 3 + 1) % 8])
            m.cyl(bx, -0.5, 2.0, 2.2, 0.4, 6, 'trim')
        m.sign('BEADS', 0, h - 1.15 if L > 3 else h - 0.9, 0.8, col='trim', board=D, y=-0.05) if L > 3 else None
        m.wall_lamp(dx + 1.7, 2.6)
    for sname in ('left', 'right', 'back'):
        with m.side(sname, x0, x1, y0, y1) as Lw:
            for wx in row(2, Lw - 3):
                m.win(wx, 1.5, 2.0, 2.2, bars=(1, 1), sill=0.2)
    # giant beads threaded on a rod
    rx, ry = x0 - 2.6, y0 - 1.0
    m.cyl(rx, ry, 0, 0.4, 0.9, 8, 'w_stone')
    nb = 3 if L == 3 else 5
    m.cyl(rx, ry, 0.4, 0.9 + nb * 1.05, 0.12, 5, 'iron')
    for i in range(nb):
        giant_bead(m, rx, ry, 1.0 + i * 1.05, BEAD_COLS[(i * 2) % 8], R=0.95 - 0.04 * i, n=8)
    m.planter(x1 + 2.2 if L > 3 else 0, y0 - 1.2 if L > 3 else y0 - 4.5, 2.6, 1.1, flowers='flower_pink')
    m.globe_lamp(W / 2 - 2.5, -Dp / 2 + 2.5)
    if L > 3:
        m.globe_lamp(-W / 2 + 2.5, -Dp / 2 + 2.5)
        m.bench(-3, y0 - 4.2, math.pi, 2.4)
        m.tree(W / 2 - 4, y1 - 1, 0.85)
        # a sandwich board
        with m.at(x1 - 1.0, y0 - 4.6, 0, 0.3):
            m.poly([(-0.7, 0, 0), (0.7, 0, 0), (0.7, 0.5, 1.7), (-0.7, 0.5, 1.7)], D)
            m.poly([(0.7, 1.0, 0), (-0.7, 1.0, 0), (-0.7, 0.5, 1.7), (0.7, 0.5, 1.7)], D)
    if L == 5:
        # a workshop wing with a rainbow bead mural, bunting and a craft table outside
        ax0, ax1, ay0, ay1 = x1 - 0.3, x1 + 10.5, cy - 5, cy + 6
        acx, acy = (ax0 + ax1) / 2, (ay0 + ay1) / 2
        m.rbox(acx, acy, ax1 - ax0, ay1 - ay0, 0, 5.0, 'w_cream', r=0.5, top=False)
        m.roof_gable(ax0, ax1, ay0, ay1, 5.0, 3.6, D, axis='y', over=0.8, th=0.4, gable='w_cream')
        with m.side('front', ax0, ax1, ay0, ay1) as Lw:
            m.shopfront(-Lw / 2 + 1.2, Lw / 2 - 1.2, 0, 3.0, plinth=0.9)
            bead_art(m, 0, 5.4, -0.05, RAINBOW[:4], cell=0.58, colmap={'R': 't_red', 'O': 't_orange', 'Y': 't_yel', 'G': 't_green'})
        with m.side('right', ax0, ax1, ay0, ay1) as Lw:
            for wx in row(2, Lw - 3):
                m.win(wx, 1.4, 2.2, 2.2, bars=(1, 1), sill=0.2)
        umbrella_table(m, -W / 2 + 7, -Dp / 2 + 7, 0, col=D)
        m.bunting((-W / 2 + 2.5, -Dp / 2 + 2.5, 4.6), (x0 + 1, y0, 5.6), BEAD_COLS, sag=0.7, n=9)
        m.bunting((x1 - 1, y0, 5.6), (W / 2 - 2.5, -Dp / 2 + 2.5, 4.6), BEAD_COLS, sag=0.7, n=9)
        m.flag(-W / 2 + 4, y1 - 1, 9, D)
        for i in range(3):
            giant_bead(m, x1 + 3 + i * 2.3, y0 - 6.5 - (i % 2) * 0.8, 0.95, BEAD_COLS[(i * 3 + 1) % 8], R=1.0, axis='x', n=8)
    m.pop()


# ================================================================== BOOKS & APPS (yellow), continued
def idea_board(m, cx, cy, rz=0.0, s=1.0):
    """A billboard that tells the BookFlow story in three shapes: an idea (bulb), an arrow, a finished book."""
    with m.at(cx, cy, 0, rz, s=s):
        for px in (-3.6, 3.6):
            m.cyl(px, 0.2, 0, 6.6, 0.16, 5, 'iron', cap=False)
        m.plate(rrect2(0, 4.6, 10.4, 3.6, 0.4), 0.1, 0.3, 'trim', edge='d_books', back=True)
        y = -0.24
        with m.use('glow'):
            m.poly([(x, y, z) for x, z in disc2(-3.4, 4.9, 0.95, 10)], 't_yel')
        m.fq(-3.75, -3.05, 3.5, 4.05, y, 'zinc')
        for k in range(3):
            a = math.pi / 2 + (k - 1) * 0.7
            m.fq(-3.4 + 1.3 * math.cos(a) - 0.06, -3.4 + 1.3 * math.cos(a) + 0.06, 4.9 + 1.2 * math.sin(a), 4.9 + 1.2 * math.sin(a) + 0.3, y, 't_yel')
        m.poly([(-1.6, y, 4.35), (-0.4, y, 4.35), (-0.4, y, 3.95), (0.5, y, 4.6), (-0.4, y, 5.25), (-0.4, y, 4.85), (-1.6, y, 4.85)], 'd_books')
        open_book(m, 3.0, -0.2, 3.5, 3.2, upright=True)


@building('bookflow', 'books', site='site_large')
def b_bookflow(m, L):
    """Print works: sawtooth factory, chimney, paper rolls at a loading bay. Turns a book idea into print-ready files."""
    D = 'd_books'
    W, Dp = {3: (38, 30), 4: (62, 44), 5: (76, 52)}[L]
    ph = m.pad(W, Dp, col='pave_dark')
    m.push(0, 0, ph)
    sw, sd, sh, nt, th = (24, 14, 6.4, 3, 3.6) if L == 3 else (45, 21, 8.4, 5, 4.6)
    scx = 0 if L == 3 else (-4 if L == 4 else -11)
    cy = 5.0 if L > 3 else 4.0
    x0, x1, y0, y1 = scx - sw / 2, scx + sw / 2, cy - sd / 2, cy + sd / 2
    m.box(x0, x1, y0, y1, 0, sh, 'w_brick', top='roof_grey')
    m.band(scx, cy, sw, sd, 0, 0.9, 'w_brick_dark', r=0.02, out=0.14, seg=1)
    m.band(scx, cy, sw, sd, sh - 0.55, sh + 0.05, 'trim', r=0.02, out=0.22, seg=1, ring=True)
    m.sawtooth(x0, x1, y0, y1, sh, nt, th, D, wall='w_brick', face=1)
    bay = sw / nt
    dock_bays = 1 if L == 3 else 2
    with m.side('front', x0, x1, y0, y1) as Lw:
        for i in range(nt + 1):
            px = -Lw / 2 + i * bay
            m.box(px - 0.4, px + 0.4, -0.35, 0, 0, sh - 0.55, 'w_cream', top=False)
        for i in range(nt):
            bx = -Lw / 2 + (i + 0.5) * bay
            if i < dock_bays:
                # roller doors on the loading dock: the first one is open
                dw, dh = bay * 0.62, 5.0
                m.box(bx - dw / 2 - 0.25, bx + dw / 2 + 0.25, -0.2, 0, 1.2, 1.2 + dh + 0.25, 'trim', top='trim')
                if i == 0:
                    m.fq(bx - dw / 2, bx + dw / 2, 1.2, 1.2 + dh, -0.22, (0.07, 0.06, 0.06))
                    with m.use('glow'):
                        m.fq(bx - dw / 2, bx + dw / 2, 1.2 + dh * 0.45, 1.2 + dh * 0.75, -0.23, (0.30, 0.22, 0.12))
                    m.fq(bx - dw / 2, bx + dw / 2, 1.2 + dh - 1.0, 1.2 + dh, -0.26, 'steel_light')
                else:
                    m.fq(bx - dw / 2, bx + dw / 2, 1.2, 1.2 + dh, -0.22, 'steel_light')
                    for k in range(6):
                        m.fq(bx - dw / 2, bx + dw / 2, 1.5 + k * 0.8, 1.58 + k * 0.8, -0.24, 'zinc')
            elif i == nt - 1:
                m.door(bx - 1.0, 2.2, 3.2, col='t_teal', glass=0.5)
                m.win(bx + 2.0, 1.5, 1.8, 2.0, bars=(1, 1), sill=0.2) if L > 3 else None
                m.awning(bx - 2.6, bx + 0.6, 4.4, 1.5, D, 'trim', drop=0.6)
                m.sign('BookFlow', bx, sh - 3.3 if L > 3 else sh - 2.4, 1.0, col='trim', board='t_teal', y=-0.05, max_w=bay - 1.4)
            else:
                m.win(bx, 1.8, bay * 0.52, 4.2, bars=(2, 3), sill=0.25)
    # the loading dock with its canopy and paper rolls
    dx0, dx1 = x0, x0 + dock_bays * bay + 0.5
    m.box(dx0, dx1, y0 - 4.2, y0, 0, 1.2, 'pave_light', top='pave')
    m.box(dx0, dx1, y0 - 4.3, y0 - 4.2, 0.85, 1.2, 'hazard')
    m.canopy(dx0 - 0.4, dx1 + 0.4, y0 - 5.0, y0, sh - 1.7, D, th=0.4, posts=[(dx0 + 0.4, y0 - 4.6), (dx1 - 0.4, y0 - 4.6)])
    paper_roll(m, dx0 + 2.2, y0 - 2.6, 1.2, 1.15, 2.3, upright=True)
    paper_roll(m, dx0 + 4.9, y0 - 3.0, 1.2, 1.15, 2.3, upright=True)
    if L > 3:
        paper_roll(m, dx0 + 3.5, y0 - 1.3, 1.2, 1.15, 2.3, upright=True)
        paper_roll(m, dx1 - 3.6, y0 - 2.4, 1.2, 1.1, 2.4, rz=0.2)
        paper_roll(m, dx1 - 3.5, y0 - 2.4, 3.3, 1.0, 2.4, rz=-0.1) if False else None
        with m.at(dx0 + 5.5, -Dp / 2 + 7.0, 0, 0.0):
            truck(m, 0, 0, 0, 0.0, col=D)
            paper_roll(m, -2.9, 0, 1.05, 1.05, 2.3, rz=math.pi / 2)
            paper_roll(m, -0.6, 0, 1.05, 1.05, 2.3, rz=math.pi / 2)
            paper_roll(m, -1.75, 0, 2.9, 1.05, 2.3, rz=math.pi / 2)
    # tall factory windows on the other walls
    for sname in ('left', 'right', 'back'):
        with m.side(sname, x0, x1, y0, y1) as Lw:
            n = max(2, round(Lw / 7.5))
            for wx in row(n, Lw - 2):
                m.win(wx, 1.8, 3.2, 4.0, bars=(1, 2), sill=0.25)
    # boiler house and the chimney
    chx, chy = x1 + 3.2, y1 - 3.4
    ch = 15.0 if L == 3 else 27.0
    m.rbox(chx, chy, 6.0, 6.4, 0, 4.6, 'w_brick', r=0.3, seg=1, top=False)
    m.band(chx, chy, 6.0, 6.4, 4.6, 5.0, D, r=0.3, out=0.3, seg=1)
    with m.at(chx, chy - 3.2, 0):
        m.door(0, 1.8, 2.8, col='steel_light', glass=0.0)
    r0 = 1.25 if L == 3 else 1.75
    m.lathe(chx, chy, [(r0, 5.0), (r0 * 0.74, ch - 3.0), (r0 * 0.74, ch - 2.2), (r0 * 0.7, ch - 1.4), (r0 * 0.7, ch - 0.6), (r0 * 0.82, ch - 0.3), (r0 * 0.82, ch), (r0 * 0.5, ch)], 10,
            ['w_brick_dark', 'w_brick', D, D, 'w_brick', 'trim', 'trim', 'iron'], cap=True)
    m.cyl(chx, chy, 5.0, 5.5, r0 + 0.3, 10, 'trim')
    # yard
    set_door(m, x0 + (nt - 0.5) * bay - 1.0, -Dp / 2)
    m.lamp(-W / 2 + 3, -Dp / 2 + 3, 7, rz=math.pi)
    m.lamp(W / 2 - 3, -Dp / 2 + 3, 7, rz=math.pi)
    m.planter(x1 - bay / 2 + 3.6, y0 - 1.2, 3.0, 1.2, flowers='flower_yel') if L > 3 else None
    m.tree(W / 2 - 4.5, -Dp / 2 + 9, 0.9)
    # pallets of finished books
    def pallet(px, py, rz=0.0, n=3):
        with m.at(px, py, 0, rz):
            m.cbox(0, 0, 2.6, 2.2, 0, 0.3, 'timber')
            for k in range(n):
                c = BEAD_COLS[(k * 3 + int(px)) % 8]
                m.cbox(0.05 * k, 0, 2.3, 1.9, 0.3 + k * 0.7, 0.95 + k * 0.7, c, top=tint(c, 0.2))
                m.cbox(0.05 * k + 0.02, 0, 2.2, 1.95, 0.42 + k * 0.7, 0.83 + k * 0.7, 'paper', top=False)
    pallet(x1 - bay * 1.5, y0 - 2.4, 0.1)
    if L > 3:
        pallet(x1 - bay * 1.5 + 3.4, y0 - 2.8, -0.15, 2)
        idea_board(m, W / 2 - 8.5, -Dp / 2 + 5.5, -0.3, 0.85)
        m.bench(x1 - bay * 2.6, y0 - 1.6, math.pi, 2.4)
    if L == 5:
        # ink silos in the four printing colours, an office block and a second lorry
        for i, c in enumerate(('t_cyan', 't_magenta', 't_yel', 'iron')):
            silo(m, x0 - 3.2, y1 - 2.5 - i * 4.6, 0.6, 1.9, 8.5, 'trim', band=c)
            m.cbox(x0 - 3.2, y1 - 2.5 - i * 4.6, 3.2, 3.2, 0, 0.6, 'w_stone')
        m.beam((x0 - 3.2, y1 - 2.5, 10.2), (x0 - 3.2, y1 - 2.5 - 3 * 4.6, 10.2), 0.25, 0.25, 'zinc')
        m.beam((x0 - 3.2, y1 - 2.5 - 1.5 * 4.6, 10.2), (x0 + 0.5, y1 - 2.5 - 1.5 * 4.6, 9.0), 0.25, 0.25, 'zinc')
        ox0, ox1, oy0, oy1 = x1 - 0.2, W / 2 - 3.5, y0 - 3.5, y0 + 9.5
        ocx, ocy = (ox0 + ox1) / 2, (oy0 + oy1) / 2
        m.rbox(ocx, ocy, ox1 - ox0, oy1 - oy0, 0, 8.0, 'w_cream', r=0.8, top=False)
        m.parapet_roof(ocx, ocy, ox1 - ox0, oy1 - oy0, 8.0, 'w_cream', h=0.8, r=0.8)
        m.band(ocx, ocy, ox1 - ox0, oy1 - oy0, 8.8, 9.15, D, r=0.8, out=0.3)
        ribbons(m, (ox0, ox1, oy0, oy1), ('front', 'right'), 1, 5.0, 3.8, 2.0)
        with m.side('front', ox0, ox1, oy0, oy1) as Lw:
            m.shopfront(-Lw / 2 + 1.5, Lw / 2 - 4.6, 0, 3.2)
            m.door(Lw / 2 - 2.8, 2.2, 3.1, col='trim', glass=0.7)
            m.canopy(Lw / 2 - 4.8, Lw / 2 - 0.8, -2.4, 0, 3.6, D)
        with m.side('right', ox0, ox1, oy0, oy1) as Lw:
            m.shopfront(-Lw / 2 + 2, Lw / 2 - 2, 0, 3.0, plinth=0.9)
        m.ac_unit(ocx, ocy + 2, 9.15, 1.2)
        truck(m, 6, -Dp / 2 + 5.0, 0, math.pi, col='trim', load='box')
        m.flag(W / 2 - 5, y1 + 1.5, 10, D)
        pallet(x1 - bay * 2.9, y0 - 2.6, 0.3, 3)
    m.pop()


def tablet_easel(m, cx, cy, rz=0.0, s=1.0):
    """A giant drawing tablet on an easel, showing a colouring page that is half coloured in, with its pencil."""
    with m.at(cx, cy, 0, rz, s=s):
        for sx in (-1, 1):
            m.beam((sx * 2.3, -0.1, 0), (sx * 0.7, 0.9, 6.6), 0.26, 0.26, 'timber')
        m.beam((0, 3.0, 0), (0, 1.0, 6.2), 0.24, 0.24, 'timber_dark')
        m.box(-2.9, 2.9, -0.5, 0.5, 1.5, 1.75, 'timber', bottom=True)
        with m.at(0, 0.25, 1.75, rx=-0.16):
            m.plate(rrect2(0, 2.0, 5.4, 4.0, 0.35), 0.0, 0.22, 'iron')
            y = -0.25
            with m.use('glow'):
                m.poly([(x, y, z) for x, z in rrect2(0, 2.0, 4.8, 3.4, 0.15, 1)], 'paper')
            y -= 0.03
            # the colouring page: a flower, half of the petals coloured
            for k in range(6):
                a = math.pi / 2 + k * math.pi / 3
                m.poly([(x, y, z) for x, z in disc2(-0.9 + 0.72 * math.cos(a), 2.35 + 0.72 * math.sin(a), 0.42, 7)], 't_pink' if k < 3 else 'w_grey')
            m.poly([(x, y - 0.02, z) for x, z in disc2(-0.9, 2.35, 0.36, 7)], 't_yel')
            m.fq(-0.98, -0.82, 0.55, 1.6, y, 't_green')
            m.poly([(x, y, z) for x, z in star2(1.25, 2.75, 0.62)], 't_blue')
            m.poly([(x, y, z) for x, z in heart2(1.3, 1.3, 0.5)], 'w_grey')
        pencil(m, 3.4, -0.9, 0, 'trim', h=4.6, r=0.3, lean=0.0)


@building('ipad', 'books')
def b_ipad(m, L):
    """Art studio: large north-light windows; colouring and drawing (giant pencils, a tablet on an easel)."""
    D = 'd_books'
    W, Dp = {3: (30, 24), 4: (48, 36), 5: (62, 44)}[L]
    ph = m.pad(W, Dp)
    set_door(m, 0, -Dp / 2)
    m.push(0, 0, ph)
    w, d, hf, hb = (15, 10, 8.0, 4.4) if L == 3 else (27, 16, 12.0, 6.2)
    cx0 = 0 if L < 5 else -6
    cy = 3.5
    x0, x1, y0, y1 = cx0 - w / 2, cx0 + w / 2, cy - d / 2, cy + d / 2
    wall = 'w_white'
    m.fq(x0, x1, 0, hf, y0, wall)
    m.poly([(x1, y1, 0), (x0, y1, 0), (x0, y1, hb), (x1, y1, hb)], wall)
    m.poly([(x0, y0, 0), (x0, y0, hf), (x0, y1, hb), (x0, y1, 0)], wall)
    m.poly([(x1, y1, 0), (x1, y1, hb), (x1, y0, hf), (x1, y0, 0)], wall)
    m.band(cx0, cy, w, d, 0, 0.8, 'w_brick', r=0.02, out=0.12, seg=1)
    ang = -math.atan2(hf - hb, d)
    sl = math.hypot(hf - hb, d)
    with m.at(cx0, cy, (hf + hb) / 2 + 0.2, rx=ang):
        m.cbox(0, 0, w + 2.0, sl + 2.2, -0.3, 0.25, D, bottom=True)
        for sx in ((-w / 4, w / 4) if L > 3 else (0,)):
            m.cbox(sx, sl * 0.12, w * 0.24, sl * 0.36, 0.25, 0.75, 'trim')
            with m.use('glass'):
                m.cbox(sx, sl * 0.12, w * 0.24 - 0.5, sl * 0.36 - 0.5, 0.75, 0.82, 'glass_a')
    with m.side('front', x0, x1, y0, y1) as Lw:
        # the big studio window
        m.win(0, 4.6 if L > 3 else 3.6, Lw - 3.0, hf - (6.2 if L > 3 else 4.9), mat='glass', pane='glass_a', bars=(7 if L > 3 else 4, 2), fw=0.3, dep=0.22)
        m.door(0, 2.4, 3.3, col='t_teal', glass=0.5, double=True)
        # palette sign over the door
        pal = disc2(0, 4.25 if L > 3 else 3.75, 1.25, 12, 0.3, 0.72)
        pz = pal[0][1] * 0 + (4.25 if L > 3 else 3.75)
        m.plate(pal, -0.05, 0.25, 'timber')
        for k, c in enumerate(('t_red', 't_yel', 't_blue', 't_green', 't_pink')):
            a = 0.5 + k * 0.62
            m.poly([(x, -0.32, z) for x, z in disc2(0.82 * math.cos(a), pz + 0.56 * math.sin(a), 0.2, 6)], c)
        m.poly([(x, -0.32, z) for x, z in disc2(0.45, pz - 0.3, 0.2, 6)], wall)
        if L > 3:
            for sx in (-1, 1):
                wx = sx * (Lw / 2 - 5.2)
                m.win(wx, 0.9, 5.6, 2.9, bars=(0, 0), fw=0.22)
                # framed pictures in the window
                for i, c in enumerate(('t_pink', 't_teal', 't_yel')):
                    px = wx - 1.8 + i * 1.8
                    m.fq(px - 0.65, px + 0.65, 1.4, 3.2, -0.3, 'timber')
                    m.fq(px - 0.5, px + 0.5, 1.55, 3.05, -0.33, c)
                    m.poly([(x, -0.36, z) for x, z in (star2(px, 2.3, 0.36) if i % 2 == 0 else disc2(px, 2.3, 0.3, 8))], 'trim')
    for sname in ('left', 'right'):
        with m.side(sname, x0, x1, y0, y1) as Lw:
            for wx in row(2 if L == 3 else 3, Lw - 3):
                m.win(wx, 1.4, 2.0, 2.4, bars=(1, 1), sill=0.2)
    with m.side('back', x0, x1, y0, y1) as Lw:
        m.door(-Lw / 4, 1.8, 3.0, col='timber', glass=0.0)
        m.win(Lw / 4, 1.4, 2.6, 2.2, bars=(1, 1), sill=0.2)
    # forecourt: the tablet on its easel, a pot of giant pencils, paint pots
    tablet_easel(m, x0 - (1.0 if L > 3 else 2.2) + 3.5, y0 - 6.0 if L > 3 else y0 - 4.2, 0.35, 1.0 if L > 3 else 0.72)
    px, py = (x1 - 2.5, y0 - 5.0) if L > 3 else (x1 + 2.2, y0 - 1.5)
    m.lathe(px, py, [(1.5, 0), (1.75, 2.3), (1.55, 2.3), (1.45, 1.9)], 10, [shade(D, 0.85), D, D, shade(D, 0.5)], cap=True)
    pcs = ('t_red', 't_blue', 't_green', 't_purple')
    for i in range(2 if L == 3 else 4):
        a = i * 1.7 + 0.3
        pencil(m, px + 0.55 * math.cos(a), py + 0.55 * math.sin(a), 0.4, pcs[i], h=7.5 - i * 0.6, r=0.42, lean=0.14, rz=a + math.pi / 2)
    for i, c in enumerate(('t_red', 't_blue', 't_yel')[: (1 if L == 3 else 3)]):
        paint_pot(m, 2.6 + i * 1.9, y0 - 1.3 - (i % 2) * 0.5, 0, c, 0.7, 1.1)
    m.globe_lamp(W / 2 - 2.6, -Dp / 2 + 2.6)
    if L > 3:
        m.globe_lamp(-W / 2 + 2.6, -Dp / 2 + 2.6)
        m.bench(-3.5, y0 - 1.5, math.pi, 2.4)
        m.tree(W / 2 - 4.5, y1 - 1, 0.9)
        m.tree(-W / 2 + 4, y1, 0.8, 'tall')
    if L == 5:
        # a gallery wing with a swatch wall, a sculpture garden and a pencil fence
        gx0, gx1, gy0, gy1 = x1 - 0.2, x1 + 13.5, cy - 6.5, cy + 6.5
        gcx, gcy = (gx0 + gx1) / 2, (gy0 + gy1) / 2
        m.rbox(gcx, gcy, gx1 - gx0, gy1 - gy0, 0, 6.4, 'w_cream', r=0.7, top=False)
        m.parapet_roof(gcx, gcy, gx1 - gx0, gy1 - gy0, 6.4, 'w_cream', h=0.7, r=0.7)
        m.band(gcx, gcy, gx1 - gx0, gy1 - gy0, 7.1, 7.45, D, r=0.7, out=0.3)
        with m.side('front', gx0, gx1, gy0, gy1) as Lw:
            m.shopfront(-Lw / 2 + 1.4, Lw / 2 - 1.4, 0, 4.4, plinth=0.6, n=3)
            m.sign('GALLERY', 0, 4.9, 0.8, col='trim', board='t_teal', y=-0.05)
        with m.side('right', gx0, gx1, gy0, gy1) as Lw:
            sw_cols = ('t_red', 't_orange', 't_yel', 't_green', 't_teal', 't_blue', 't_purple', 't_pink')
            for i, c in enumerate(sw_cols):
                bx = -Lw / 2 + 1.2 + i * (Lw - 2.4) / 8
                m.box(bx, bx + (Lw - 2.4) / 8 - 0.25, -0.12, 0, 1.2, 5.2, c, bottom=True)
        sy = -Dp / 2 + 8
        for i, (c, kind) in enumerate((('t_red', 'ball'), ('t_blue', 'cube'), ('t_yel', 'cone'))):
            sx = gcx - 4.5 + i * 4.5
            m.rbox(sx, sy, 2.0, 2.0, 0, 0.9, 'w_stone', r=0.2, seg=1, bev=0.1)
            if kind == 'ball':
                m.ball(sx, sy, 2.2, 1.3, shade(c, 0.85), n=8, rings=5, col1=tint(c, 0.15))
            elif kind == 'cube':
                m.obox(sx, sy, 1.9, 1.9, 0.9, 2.8, c, rz=0.6)
            else:
                m.lathe(sx, sy, [(1.2, 0.9), (0.0, 3.6)], 8, [shade(c, 0.85), tint(c, 0.15)], bottom=True)
        for i in range(9):
            fx = -W / 2 + 3.5 + i * 2.2
            pencil(m, fx, -Dp / 2 + 2.2, 0, sw_cols[i % 8], h=2.6, r=0.32)
        m.flag(W / 2 - 4, y1 + 2, 9, D)
    m.pop()


# ================================================================== FILM & MEDIA (blue)
@building('yae', 'film', site='site_large')
def b_yae(m, L):
    """Natural history museum: classical, with a dome and columns, and a mammoth statue outside."""
    D = 'd_film'
    W, Dp = {3: (38, 32), 4: (64, 48), 5: (76, 56)}[L]
    ph = m.pad(W, Dp)
    set_door(m, 0, -Dp / 2)
    m.push(0, 0, ph)
    stone, wall = 'w_stone', 'w_cream'
    bw, bd, bh, pw, ncol, dr = (19, 12, 7.2, 10.5, 4, 4.0) if L == 3 else (42, 19, 10.5, 17.0, 6, 6.8)
    pod = 1.5
    cy = 6.0 if L > 3 else 4.5
    x0, x1, y0, y1 = -bw / 2, bw / 2, cy - bd / 2, cy + bd / 2
    pdep = 4.6 if L > 3 else 3.4
    m.rbox(0, cy, bw + 3.4, bd + 3.4, 0, pod, stone, r=0.3, seg=1, bev=0.12)
    m.box(-pw / 2 - 1.2, pw / 2 + 1.2, y0 - pdep - 0.9, y0, 0, pod, stone)
    m.push(0, 0, pod)
    m.box(x0, x1, y0, y1, 0, bh, wall, top=False)
    m.band(0, cy, bw, bd, bh - 1.3, bh - 0.5, 'trim', r=0.02, out=0.3, seg=1, ring=True)
    m.parapet_roof(0, cy, bw, bd, bh, wall, h=1.2, t=0.5, r=0.02, seg=1, roof=D)
    m.band(0, cy, bw, bd, bh + 1.2, bh + 1.45, 'trim', r=0.02, out=0.15, seg=1, ring=True)
    # portico
    ch = bh - 2.1
    py = y0 - pdep
    for cxx in row(ncol, pw * ncol / (ncol - 1)):
        m.column(cxx, py + 0.9, 0, ch, r=0.62 if L > 3 else 0.5, n=8, col='trim')
    m.box(-pw / 2 - 0.8, pw / 2 + 0.8, py, y0, ch, ch + 1.5, 'trim', bottom=True)
    m.roof_gable(-pw / 2 - 0.8, pw / 2 + 0.8, py, y0 + 2.0, ch + 1.5, 3.4 if L > 3 else 2.4, 'trim', axis='y', over=0.45, th=0.4, gable=None)
    gh = (3.4 if L > 3 else 2.4) - 0.4
    with m.at(0, py, ch + 1.5):
        m.poly([(-pw / 2 - 0.8, 0.0, 0), (pw / 2 + 0.8, 0.0, 0), (0, 0.0, gh + 0.05)], 'trim')
        m.poly([(-pw / 2 + 0.6, -0.06, 0.35), (pw / 2 - 0.6, -0.06, 0.35), (0, -0.06, gh - 0.45)], D)
        m.poly([(x, -0.1, z) for x, z in disc2(0, gh * 0.4, gh * 0.24, 10)], 'bone')
        if L > 3:
            m.text('YouAreExtinct', 0.95, 0, -1.2, 'gold_g', y=-0.06, mat='glow', bold=0.02)
        else:
            m.text('MUSEUM', 0.8, 0, -1.15, 'gold_g', y=-0.06, mat='glow', bold=0.02)
    m.pop()
    # stairs
    ns = 6
    m.steps(0, py - 0.9 - ns * 0.55, pw + 2.4, ns, rise=pod / ns, run=0.55, col='pave_light')
    for sx in (-1, 1):
        m.box(sx * (pw / 2 + 1.2) - 0.7, sx * (pw / 2 + 1.2) + 0.7, py - 0.9 - ns * 0.55 - 0.4, py - 0.9, 0, pod + 0.5, stone)
        m.globe_lamp(sx * (pw / 2 + 1.2), py - 2.6, 3.0, z=pod + 0.5)
    m.push(0, 0, pod)
    with m.side('front', x0, x1, y0, y1) as Lw:
        m.door(0, 3.0 if L > 3 else 2.4, 5.0 if L > 3 else 3.8, col='brass', glass=0.3, double=True, frame='trim', fw=0.4)
        nw = 3 if L > 3 else 1
        for sx in (-1, 1):
            span = (Lw - pw) / 2 - 1.0
            c0 = sx * (pw / 2 + 0.5 + span / 2)
            for wx in row(nw, span, c0):
                m.win(wx, 1.6, 2.2 if L > 3 else 1.9, 4.2 if L > 3 else 3.0, arch=True, bars=(1, 2), sill=0.3, fw=0.26)
            for px in row(nw + 1, span * (nw + 1) / nw, c0):
                m.box(px - 0.4, px + 0.4, -0.3, 0, 0, bh - 1.3, 'trim', top=False)
    for sname in ('left', 'right', 'back'):
        with m.side(sname, x0, x1, y0, y1) as Lw:
            n = max(2, round(Lw / 5.5))
            for wx in row(n, Lw - 2):
                m.win(wx, 1.6, 2.2 if L > 3 else 1.9, 4.2 if L > 3 else 3.0, arch=True, bars=(1, 2), sill=0.3, fw=0.26)
            for px in row(n + 1, (Lw - 2) * (n + 1) / n):
                m.box(px - 0.4, px + 0.4, -0.3, 0, 0, bh - 1.3, 'trim', top=False)
    # the dome on its drum
    dz = bh + 0.02
    m.cyl(0, cy, dz, dz + 1.3, dr + 0.9, 16, 'trim')
    m.cyl(0, cy, dz + 1.3, dz + 4.2, dr, 16, wall, cap=False)
    with m.use('glow'):
        for k in range(16):
            a = 2 * math.pi * (k + 0.5) / 16
            with m.at(dr * math.cos(math.pi / 16) * math.cos(a), cy + dr * math.cos(math.pi / 16) * math.sin(a), dz, a + math.pi / 2):
                m.fq(-0.5, 0.5, 2.0, 3.6, -0.05, 'pane')
    m.cyl(0, cy, dz + 4.2, dz + 4.7, dr + 0.45, 16, 'trim')
    prof, cols = [], []
    for k in range(6):
        a = (math.pi / 2) * k / 5.6
        prof.append((dr * math.cos(a), dz + 4.7 + dr * 0.92 * math.sin(a)))
        cols.append(mixc(shade(D, 0.85), tint(D, 0.22), k / 5))
    m.lathe(0, cy, prof, 16, cols, cap=True)
    lz = prof[-1][1]
    m.cyl(0, cy, lz, lz + 1.8, dr * 0.2, 8, 'trim', cap=False)
    with m.use('glow'):
        m.cyl(0, cy, lz + 0.3, lz + 1.5, dr * 0.21, 8, 'lamp', cap=False)
    m.lathe(0, cy, [(dr * 0.3, lz + 1.8), (dr * 0.22, lz + 2.5), (0.0, lz + 3.2)], 8, [D, D, tint(D, 0.2)], bottom=True)
    m.cyl(0, cy, lz + 3.2, lz + 4.6, 0.09, 4, 'gold_g')
    m.ball(0, cy, lz + 4.7, 0.3, 'gold_g', n=5, rings=3)
    m.pop()
    # forecourt
    mam_s = 0.62 if L == 3 else 1.0
    mammoth(m, -W / 2 + (6.5 if L == 3 else 10.5), -Dp / 2 + (6.5 if L == 3 else 10), 0, mam_s, rz=-0.45)
    m.lamp(-W / 2 + 3, -Dp / 2 + 3, 6.5, rz=math.pi)
    m.lamp(W / 2 - 3, -Dp / 2 + 3, 6.5, rz=math.pi)
    m.tree(W / 2 - 4.5, y1 + 0.5, 1.0)
    m.tree(-W / 2 + 4.5, y1 + 0.5, 0.9)
    if L > 3:
        m.planter(-pw / 2 - 5.5, py - 1.5, 4.0, 1.4, flowers='flower_white')
        m.planter(pw / 2 + 5.5, py - 1.5, 4.0, 1.4, flowers='flower_white')
        m.bench(W / 2 - 9, -Dp / 2 + 6, math.pi, 2.6)
        for sx in (-1, 1):
            m.banner(sx * (pw / 2 + 4.0), py - 5.5, 3.0, 8.2, 1.7, D, sideways=sx)
    if L == 5:
        # side pavilions with small domes, a sabre-toothed cat, a fountain and flags
        for sx in (-1, 1):
            vx = sx * (bw / 2 + 5.0)
            m.rbox(vx, cy - 1, 10.5, 13, 0, pod, stone, r=0.3, seg=1, bev=0.12)
            m.box(vx - 4.5, vx + 4.5, cy - 6.5, cy + 4.5, pod, pod + 8.0, wall, top=False)
            m.parapet_roof(vx, cy - 1, 9, 11, pod + 8.0, wall, h=0.9, t=0.4, r=0.02, seg=1, roof=D)
            m.band(vx, cy - 1, 9, 11, pod + 6.9, pod + 7.5, 'trim', r=0.02, out=0.25, seg=1, ring=True)
            with m.side('front', vx - 4.5, vx + 4.5, cy - 6.5, cy + 4.5, pod):
                m.win(0, 1.5, 2.6, 3.4, arch=True, bars=(1, 2), sill=0.3, fw=0.26)
            with m.side('right' if sx > 0 else 'left', vx - 4.5, vx + 4.5, cy - 6.5, cy + 4.5, pod) as Lw:
                for wx in row(2, Lw - 2):
                    m.win(wx, 1.5, 2.0, 3.4, arch=True, bars=(1, 2), sill=0.3, fw=0.26)
            m.cyl(vx, cy - 1, pod + 8.0, pod + 9.2, 2.9, 10, 'trim')
            m.lathe(vx, cy - 1, [(2.6, pod + 9.2), (2.2, pod + 10.6), (1.3, pod + 11.6), (0.0, pod + 12.0)], 10,
                    [shade(D, 0.85), D, tint(D, 0.12), tint(D, 0.2)])
        sabre_cat(m, W / 2 - 10.5, -Dp / 2 + 9.5, 0, 1.25, rz=0.45)
        fountain(m, 0, -Dp / 2 + 7.0, 0, 3.4)
        for i, sx in enumerate((-1, 1)):
            m.flag(sx * (W / 2 - 16), -Dp / 2 + 4, 10.5, D)
    m.pop()


def water_tank(m, cx, cy, z, s=1.0):
    for dx, dy in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
        m.beam((cx + dx * 1.1 * s, cy + dy * 1.1 * s, z), (cx + dx * 0.9 * s, cy + dy * 0.9 * s, z + 2.4 * s), 0.22, 0.22, 'iron')
    m.lathe(cx, cy, [(1.55 * s, z + 2.4 * s), (1.7 * s, z + 5.4 * s), (1.85 * s, z + 5.4 * s), (0.0, z + 6.9 * s)], 9,
            ['timber_dark', 'timber', 'timber_dark', 'timber'], bottom=True)
    for zz in (3.1, 4.5):
        m.cyl(cx, cy, z + zz * s, z + (zz + 0.14) * s, 1.72 * s, 9, 'iron', cap=False)


def crescent(m, cx, cz, y, r=1.4, col='neon_gold'):
    """A crescent moon sign (two-sided), facing -y."""
    n = 8
    outer = [(cx + r * math.cos(a), cz + r * math.sin(a)) for a in [math.pi * 0.35 + (math.pi * 1.3) * i / n for i in range(n + 1)]]
    inner = [(cx + r * 0.32 + r * 0.8 * math.cos(a), cz + r * 0.8 * math.sin(a)) for a in [math.pi * 0.5 + (math.pi * 1.0) * i / n for i in range(n + 1)]]
    with m.use('glow'):
        for i in range(n):
            q = [(outer[i][0], y, outer[i][1]), (outer[i + 1][0], y, outer[i + 1][1]), (inner[i + 1][0], y, inner[i + 1][1]), (inner[i][0], y, inner[i][1])]
            m.sheet(q[::-1], col)


@building('noir', 'film')
def b_noir(m, L):
    """Late-night jazz bar: a low corner bar with a tall vertical sign, an awning and a saxophone on the sign."""
    D = 'd_film'
    W, Dp = {3: (26, 22), 4: (40, 32), 5: (50, 38)}[L]
    ph = m.pad(W, Dp)
    m.push(0, 0, ph)
    w, d, h, c = (13, 10, 5.8, 3.2) if L == 3 else (23, 16, 7.2, 4.6)
    cy = 2.5
    x0, x1, y0, y1 = -w / 2, w / 2, cy - d / 2, cy + d / 2
    pts = [(x0, y0), (x1 - c, y0), (x1, y0 + c), (x1, y1), (x0, y1)]
    grow = lambda k: [(x * (1 + k / w * 2), cy + (y - cy) * (1 + k / d * 2)) for x, y in pts]
    m.prism(pts, 0, h, 'w_noir', top=False)
    m.prism(grow(0.14), 0, 1.0, 'w_noir_dark', top='w_noir_dark')
    m.prism(grow(0.3), h - 0.2, h + 0.35, 'w_cream', top='w_cream', bottom=True)
    m.prism(grow(0.02), h + 0.35, h + 1.2, 'w_noir', top=D)
    m.prism(grow(0.2), h + 1.2, h + 1.45, 'w_cream', top=False, bottom=True)
    m.cap(grow(-0.4), h + 1.25, D)
    amber = mixc('lamp_warm', 'w_noir', 0.3)
    # piano keys under the cornice, tall arched windows
    def keys(Lw):
        m.box(-Lw / 2 + 0.3, Lw / 2 - 0.3, -0.12, 0, h - 1.3, h - 0.3, 'trim', bottom=True)
        n = int((Lw - 0.6) / 0.62)
        for i in range(n):
            if i % 7 in (0, 1, 3, 4, 5):
                kx = -Lw / 2 + 0.3 + (i + 1) * (Lw - 0.6) / (n + 1)
                m.fq(kx - 0.16, kx + 0.16, h - 0.95, h - 0.3, -0.14, 'black')
    with m.side('front', x0, x1 - c, y0, y1) as Lw:
        keys(Lw)
        for wx in row(2 if L == 3 else 4, Lw - 1.6):
            m.win(wx, 1.3, 1.9, 2.5 if L > 3 else 2.2, arch=True, pane=amber, frame='w_cream', bars=(1, 0), sill=0.25)
        if L > 3:
            m.awning(-Lw / 2 + 0.8, Lw / 2 - 0.4, 5.25, 2.6, D, tint(D, 0.25), drop=0.9)
    with m.side('right', x0, x1, y0 + c, y1) as Lw:
        keys(Lw)
        for wx in row(1 if L == 3 else 3, Lw - 1.6):
            m.win(wx, 1.3, 1.9, 2.5 if L > 3 else 2.2, arch=True, pane=amber, frame='w_cream', bars=(1, 0), sill=0.25)
    with m.side('left', x0, x1, y0, y1) as Lw:
        for wx in row(2 if L == 3 else 3, Lw - 2):
            with m.use('glow'):
                m.poly([(x, -0.2, z) for x, z in disc2(wx, 3.4, 0.75, 10)], amber)
            m.plate(disc2(wx, 3.4, 1.0, 10), 0, 0.16, 'w_cream')
    with m.side('back', x0, x1, y0, y1) as Lw:
        m.door(Lw / 4, 1.8, 2.9, col='iron', glass=0.0, frame='w_cream')
        m.win(-Lw / 4, 1.5, 2.0, 2.0, pane=amber, frame='w_cream', bars=(1, 1))
    # the corner: door, marquee awning, and the tall sign with the saxophone
    cl = c * math.sqrt(2)
    sign_h = 6.5 if L == 3 else 9.5
    with m.at(x1 - c / 2, y0 + c / 2, 0, math.pi / 4):
        m.door(0, 2.4 if L > 3 else 2.0, 3.3, col='w_noir_dark', glass=0.6, double=True, frame='w_cream', pane=amber)
        m.rbox(0, -1.3, cl + 0.6, 2.6, 3.9, 4.5, D, r=0.5, bottom=True, bev=0.12)
        with m.use('glow'):
            for bx in row(5, cl):
                m.ball(bx, -2.55, 3.85, 0.16, 'lamp_warm', n=4, rings=2)
        sw = 2.0 if L > 3 else 1.6
        z0s = 4.9
        m.plate(rrect2(0, z0s + sign_h / 2, sw, sign_h, 0.5), -0.5, 0.4, D, back=True)
        m.plate(rrect2(0, z0s + sign_h / 2, sw - 0.36, sign_h - 0.36, 0.4), -0.9, 0.04, shade(D, 0.55))
        for sx in (-0.5, 0.5):
            m.box(sx * sw - 0.1, sx * sw + 0.1, -0.5, 0, z0s + 1.0, z0s + 1.2, 'iron', bottom=True)
            m.box(sx * sw - 0.1, sx * sw + 0.1, -0.5, 0, min(h + 0.8, z0s + sign_h - 1), min(h + 1.0, z0s + sign_h - 0.8), 'iron', bottom=True)
        ls = (sign_h - 1.0) / 4
        for i, ch_ in enumerate('NOIR'):
            m.text(ch_, min(1.5, ls * 0.95), 0, z0s + sign_h - 0.75 - (i + 1) * ls + ls * 0.18, 'neon_pink', y=-0.96, mat='glow', bold=0.03)
        saxophone(m, -0.1, -0.7, z0s + sign_h + 0.15, h=4.2 if L > 3 else 3.2)
        m.cyl(-0.3, -0.7, z0s + sign_h - 0.2, z0s + sign_h + 0.4, 0.09, 4, 'iron', cap=False)
    set_door(m, W / 2 - 6, -Dp / 2)
    # roof
    if L < 5:
        water_tank(m, x0 + 3.2, y1 - 3.2, h + 1.25, 0.8 if L == 3 else 1.0)
        m.ac_unit(x0 + w * 0.5, y1 - 2.4, h + 1.25, 1.1)
    if L == 4:
        crescent(m, x0 + w * 0.45, h + 4.6, y0 + 1.2, 1.5)
        m.cyl(x0 + w * 0.45 - 0.3, y0 + 1.2, h + 1.25, h + 3.3, 0.08, 4, 'iron', cap=False)
    # street
    m.lamp(-W / 2 + 2.8, -Dp / 2 + 2.8, 6.0, rz=math.pi)
    if L > 3:
        for tx in (-7.0, -2.5):
            table_set(m, tx, y0 - 1.9, 0, 'w_cream', 2, rz=0.4)
        m.planter(x0 + 1.6, y0 - 1.0, 2.2, 1.0)
        m.lamp(W / 2 - 2.8, y1 - 2, 6.0, rz=-math.pi / 2)
        m.tree(-W / 2 + 4, y1 - 1, 0.85)
    if L == 5:
        # an upper floor with a roof terrace, string lights, a moon, a vinyl record and a marquee
        ux0, ux1, uy0, uy1 = x0, x0 + 13.5, y1 - 11.0, y1
        ucx, ucy = (ux0 + ux1) / 2, (uy0 + uy1) / 2
        zt = h + 1.25
        m.box(ux0, ux1, uy0, uy1, zt, zt + 4.6, 'w_noir', top=False)
        m.band(ucx, ucy, ux1 - ux0, uy1 - uy0, zt + 4.4, zt + 4.95, 'w_cream', r=0.02, out=0.3, seg=1)
        m.cap(rect(ux1 - ux0 - 0.4, uy1 - uy0 - 0.4, ucx, ucy), zt + 4.97, D)
        with m.side('front', ux0, ux1, uy0, uy1, zt) as Lw:
            for wx in row(3, Lw - 1.5):
                m.win(wx, 0.9, 2.0, 2.2, arch=True, pane=amber, frame='w_cream', bars=(1, 0))
        with m.side('right', ux0, ux1, uy0, uy1, zt) as Lw:
            m.door(0, 2.0, 2.9, col='w_noir_dark', glass=0.6, frame='w_cream', pane=amber)
            pass
        water_tank(m, ux0 + 3.0, uy1 - 3.0, zt + 4.97, 1.0)
        crescent(m, ux0 + 8.5, zt + 8.2, uy0 + 1.0, 1.6)
        m.cyl(ux0 + 8.2, uy0 + 1.0, zt + 4.97, zt + 6.8, 0.08, 4, 'iron', cap=False)
        for a, b in (((ux1, uy0, zt + 4.3), (x1 - 0.6, y0 + c + 0.6, zt + 2.8)), ((ux1, uy1 - 0.5, zt + 4.3), (x1 - 0.6, y1 - 0.6, zt + 2.8)), ((x1 - 0.6, y0 + c + 0.6, zt + 2.8), (x1 - 0.6, y1 - 0.6, zt + 2.8))):
            m.string_lights(a, b, sag=0.9, n=7)
        for px, py in ((x1 - 0.6, y0 + c + 0.6), (x1 - 0.6, y1 - 0.6)):
            m.cyl(px, py, zt, zt + 2.9, 0.08, 4, 'iron', cap=False)
        table_set(m, x1 - 4.5, y1 - 4.5, zt + 0.02, 'w_cream', 3)
        table_set(m, x1 - 4.0, y0 + c + 3.5, zt + 0.02, 'w_cream', 2)
        with m.side('front', x0, x1 - c, y0, y1) as Lw:
            m.sign('NOIR HOURS', 0, h + 1.6, 1.25, col='neon_gold', board=D, y=-0.4, max_w=Lw - 2)
            for sx in (-Lw / 4, Lw / 4):
                m.box(sx - 0.1, sx + 0.1, -0.5, -0.3, h + 1.2, h + 2.0, 'iron')
        # a vinyl record on the left wall
        with m.side('left', x0, x1, y0, y1) as Lw:
            pass
        with m.at(-W / 2 + 6.5, -Dp / 2 + 7.5, 0, -0.5):
            m.cyl(0, 0.3, 0, 2.6, 0.12, 4, 'iron', cap=False)
            m.plate(disc2(0, 4.3, 2.0, 14), 0.2, 0.2, 'black', back=True)
            m.poly([(x, -0.03, z) for x, z in disc2(0, 4.3, 0.75, 10)], D)
            m.poly([(x, -0.05, z) for x, z in disc2(0, 4.3, 0.14, 6)], 'trim')
        for tx in (2.5, 7.0):
            table_set(m, tx - 16, y0 - 5.2, 0, 'w_cream', 2, rz=1.0)
    m.pop()


@building('influencers', 'film')
def b_influencers(m, L):
    """Photo studio: a studio block with a big roller door, softbox lights and a backdrop visible inside."""
    D = 'd_film'
    W, Dp = {3: (30, 24), 4: (50, 38), 5: (64, 46)}[L]
    ph = m.pad(W, Dp)
    m.push(0, 0, ph)
    w, d, h = (16, 11, 6.6) if L == 3 else (31, 18, 10.2)
    bcx = 0 if L < 5 else -6
    cy = 3.5
    x0, x1, y0, y1 = bcx - w / 2, bcx + w / 2, cy - d / 2, cy + d / 2
    ow, oh = (7.0, 4.7) if L == 3 else (12.5, 7.2)
    ox0 = x0 + (1.6 if L == 3 else 2.4)
    ox1 = ox0 + ow
    din = d * 0.62
    wall = 'w_white'
    m.box(x0, ox0, y0, y1, 0, h, wall, top=False)
    m.box(ox1, x1, y0, y1, 0, h, wall, top=False)
    m.box(ox0, ox1, y0, y1, oh, h, wall, top=False, bottom=True)
    m.box(ox0, ox1, y0 + din, y1, 0, oh, wall, top=False)
    m.poly([(ox0, y0, 0.03), (ox1, y0, 0.03), (ox1, y0 + din, 0.03), (ox0, y0 + din, 0.03)], 'pave_light')
    m.band(bcx, cy, w, d, 0, 0.7, 'plinth', r=0.02, out=0.1, seg=1, ring=True) if False else None
    m.parapet_roof(bcx, cy, w, d, h, wall, h=0.9, r=0.02, seg=1)
    m.band(bcx, cy, w, d, h + 0.9, h + 1.25, D, r=0.02, out=0.3, seg=1)
    zr = h + 1.25
    # inside: the backdrop sweeping from the wall onto the floor
    bcol = tint(D, 0.72)
    r = 2.2 if L > 3 else 1.5
    bx0, bx1, by = ox0 + 0.7, ox1 - 0.7, y0 + din - 0.15
    with m.use('glow'):
        prev = (by - r - (2.0 if L > 3 else 1.2), 0.06)
        prof = [prev, (by - r, 0.06)] + [(by - r + r * math.sin(a), 0.06 + r - r * math.cos(a)) for a in [math.pi / 2 * k / 4 for k in range(1, 5)]] + [(by, oh - 0.9)]
        for k in range(len(prof) - 1):
            (ya, za), (yb, zb) = prof[k], prof[k + 1]
            m.poly([(bx0, ya, za), (bx1, ya, za), (bx1, yb, zb), (bx0, yb, zb)], [bcol, bcol, tint(bcol, 0.2), tint(bcol, 0.2)])
    m.hcyl((bx0 - 0.3, by - 0.1, oh - 0.75), (bx1 + 0.3, by - 0.1, oh - 0.75), 0.28, 6, 'trim')
    s = 1.0 if L > 3 else 0.7
    softbox(m, ox0 + 1.7 * s, y0 + din * 0.38, 0, h=4.2 * s, s=s, rz=math.pi + 0.75)
    softbox(m, ox1 - 1.7 * s, y0 + din * 0.38, 0, h=4.2 * s, s=s, rz=math.pi - 0.75)
    m.cyl((ox0 + ox1) / 2, y0 + din * 0.62, 0, 0.9 * s, 0.4 * s, 7, 'timber')
    m.person((ox0 + ox1) / 2, y0 + din * 0.62, 0.9 * s, 't_pink', 1.25 * s, 0) if L > 3 else None
    tripod_camera(m, (ox0 + ox1) / 2, y0 - 2.2 * s, 0, h=2.6 * s, rz=math.pi)
    # roller door: housing, guides, a few slats rolled down
    m.box(ox0 - 0.4, ox1 + 0.4, y0 - 0.6, y0, oh - 0.1, oh + 0.9, 'steel_light', bottom=True)
    for gx in (ox0 - 0.2, ox1 + 0.2):
        m.box(gx - 0.2, gx + 0.2, y0 - 0.25, y0, 0, oh, 'steel_light', top=False)
    m.box(ox0, ox1, y0 - 0.3, y0 - 0.15, oh - 0.9, oh, 'zinc', bottom=True)
    with m.side('front', x0, x1, y0, y1) as Lw:
        rc = (ox1 + x1) / 2 - bcx
        rw = x1 - ox1
        m.door(rc - rw * 0.2, 2.0, 3.1, col=D, glass=0.0)
        m.poly([(x, -0.3, z) for x, z in star2(rc - rw * 0.2, 2.2, 0.42)], 'gold_g')
        if L > 3:
            m.win(rc + rw * 0.22, 1.2, rw * 0.3, 2.2, bars=(1, 0))
            m.shopfront(rc - rw / 2 + 1.5, rc + rw / 2 - 1.5, 5.6, 7.8, plinth=0.0, fw=0.2)
            m.sign('STUDIO', rc, 3.9, 0.95, col='trim', board=D, y=-0.05, max_w=rw - 2)
        else:
            m.sign('STUDIO', rc, 3.7, 0.7, col='trim', board=D, y=-0.05, max_w=rw - 0.6)
        m.wall_lamp(rc - rw * 0.2 - 1.6, 2.4)
    for sname in ('left', 'right', 'back'):
        with m.side(sname, x0, x1, y0, y1) as Lw:
            n = max(2, round(Lw / 7))
            for wx in row(n, Lw - 2):
                m.win(wx, h - 3.6, 3.0, 1.8, bars=(1, 0))
            if sname == 'back':
                m.door(0, 2.2, 3.0, col='steel_light', glass=0.0)
    # roof: the ring light sign, skylight, plant
    rr = 1.7 if L == 3 else 2.7
    with m.at(x1 - rr - 1.6, y0 + 1.2, zr):
        m.box(-0.2, 0.2, -0.2, 0.2, 0, 1.2, 'iron')
        m.beam((0, 0, 0.9), (0, 2.0, 0), 0.14, 0.14, 'iron')
        ring_light(m, 0, 0, 1.2 + rr, R=rr, r=0.34 if L > 3 else 0.24, stand=False)
    m.ac_unit(x0 + 3, y1 - 2.5, zr, 1.2)
    if L > 3:
        m.ac_unit(x0 + 6.5, y1 - 2.5, zr, 1.2)
        m.cbox(bcx - 2, cy + 1, 7, 4, zr, zr + 0.8, 'trim')
        with m.use('glass'):
            m.cbox(bcx - 2, cy + 1, 6.4, 3.4, zr + 0.8, zr + 0.86, 'glass_a')
    set_door(m, bcx + (ox1 + x1) / 2 - bcx - (x1 - ox1) * 0.2, -Dp / 2)
    # forecourt
    m.lamp(-W / 2 + 3, -Dp / 2 + 3, 6.5, rz=math.pi)
    m.planter(x1 - 2.6, y0 - 1.2, 3.0, 1.2, flowers='flower_pink')
    if L > 3:
        m.lamp(W / 2 - 3, -Dp / 2 + 3, 6.5, rz=math.pi)
        truck(m, x1 - 6, -Dp / 2 + 6, 0, math.pi, col=D, load='box', L=7.0)
        m.tree(W / 2 - 4.5, y1 - 1, 0.9)
        m.bench(x0 + 1.5, y0 - 5.5, math.pi / 2, 2.2)
    if L == 5:
        # a second stage with a green screen, an outdoor set, rooftop letters, flags
        ax0, ax1, ay0, ay1 = x1 - 0.2, x1 + 14.0, cy - 7.5, cy + 7.5
        acx, acy = (ax0 + ax1) / 2, (ay0 + ay1) / 2
        m.rbox(acx, acy, ax1 - ax0, ay1 - ay0, 0, 7.4, 'w_cream', r=0.7, top=False)
        m.parapet_roof(acx, acy, ax1 - ax0, ay1 - ay0, 7.4, 'w_cream', h=0.8, r=0.7)
        m.band(acx, acy, ax1 - ax0, ay1 - ay0, 8.2, 8.55, D, r=0.7, out=0.3)
        with m.side('front', ax0, ax1, ay0, ay1) as Lw:
            m.shopfront(-Lw / 2 + 1.6, Lw / 2 - 1.6, 0, 5.0, plinth=0.7, n=3, pane='t_green')
            with m.use('glow'):
                m.box(-1.6, 1.6, -0.35, 0, 5.6, 6.6, 't_red', bottom=True)
            m.text('ON AIR', 0.6, 0, 5.8, 'trim', y=-0.38, mat='glow', bold=0.03)
        with m.side('right', ax0, ax1, ay0, ay1) as Lw:
            for wx in row(2, Lw - 3):
                m.win(wx, 3.6, 3.0, 1.8, bars=(1, 0))
        with m.at(bcx - 4, y0 + 1.0, zr):
            for sx in (-6, 0, 6):
                m.beam((sx, 0.3, 0), (sx, 0.3, 3.0), 0.2, 0.2, 'iron')
                m.beam((sx, 0.3, 2.4), (sx, 2.0, 0), 0.14, 0.14, 'iron')
            m.text('STUDIO', 3.0, 0, 0.5, 'trim', y=0.1, mat='glow', bold=0.04)
            m.fq(-7.5, 7.5, 0.3, 0.5, 0.15, 'iron')
        sx0, sy0 = -W / 2 + 9.5, -Dp / 2 + 9.5
        with m.at(sx0, sy0, 0, 0.5):
            for px in (-3.2, 3.2):
                m.cyl(px, 1.5, 0, 5.2, 0.1, 4, 'iron', cap=False)
            m.hcyl((-3.4, 1.5, 5.2), (3.4, 1.5, 5.2), 0.22, 6, 'trim')
            with m.use('glow'):
                pk = 'flower_pink'
                m.sheet([(-3.0, 1.5, 5.1), (-3.0, 1.45, 1.0), (3.0, 1.45, 1.0), (3.0, 1.5, 5.1)], pk)
                m.poly([(-3.0, 1.45, 1.0), (-3.0, 0.9, 0.25), (3.0, 0.9, 0.25), (3.0, 1.45, 1.0)], pk)
                m.poly([(-3.0, 0.9, 0.25), (-3.0, -2.6, 0.06), (3.0, -2.6, 0.06), (3.0, 0.9, 0.25)], pk)
            softbox(m, -3.6, -3.0, 0, 3.8, 0.9, math.pi - 0.6)
            softbox(m, 3.6, -3.0, 0, 3.8, 0.9, math.pi + 0.6)
            tripod_camera(m, 0, -5.2, 0, 2.4, math.pi)
            m.person(0, -0.8, 0.06, 't_purple', 1.3, math.pi)
        for i, fc in enumerate((D, 't_pink')):
            m.flag(W / 2 - 4, -Dp / 2 + 14 + i * 3.2, 9.5, fc)
    m.pop()


# ================================================================== GAMES (orange)
def roof_stripes(m, x0, x1, y0, y1, z0, h, cols, over=1.0, bands=((0.18, 0.36), (0.58, 0.76))):
    """Coloured bands laid on a pitched roof whose ridge runs along y (a front-facing gable)."""
    cx = (x0 + x1) / 2
    hw = (x1 - x0) / 2
    s = h / hw
    xe, ze = x0 - over, z0 - over * s
    for (t0, t1), c in zip(bands, cols):
        xa, xb = xe + (cx - xe) * t0, xe + (cx - xe) * t1
        za, zb = ze + (z0 + h - ze) * t0 + 0.07, ze + (z0 + h - ze) * t1 + 0.07
        m.poly([(xa, y1 + over + 0.03, za), (xa, y0 - over - 0.03, za), (xb, y0 - over - 0.03, zb), (xb, y1 + over + 0.03, zb)], c)
        xa2, xb2 = 2 * cx - xa, 2 * cx - xb
        m.poly([(xa2, y0 - over - 0.03, za), (xa2, y1 + over + 0.03, za), (xb2, y1 + over + 0.03, zb), (xb2, y0 - over - 0.03, zb)], c)


def st_sunflower(m, cx, cz, y, s):
    m.sticker(star2(cx, cz, s, k=9, inner=0.66), y, 't_yel', border=0.28 * s)
    m.poly([(x, y - 0.34, z) for x, z in disc2(cx, cz, s * 0.44, 10)], 'fur')
    m.poly([(x, y - 0.36, z) for x, z in disc2(cx - s * 0.1, cz + s * 0.1, s * 0.14, 6)], 'timber')


def st_duck(m, cx, cz, y, s):
    body = disc2(cx - 0.12 * s, cz - 0.28 * s, 0.78 * s, 12, 0, 0.72)
    head = disc2(cx + 0.42 * s, cz + 0.42 * s, 0.44 * s, 10)
    m.plate(grow2(body, 1.24), y, 0.25, 'trim')
    m.plate(grow2(head, 1.42), y, 0.25, 'trim')
    m.plate([(cx + 0.7 * s, cz + 0.62 * s), (cx + 0.7 * s, cz + 0.12 * s), (cx + 1.28 * s, cz + 0.22 * s), (cx + 1.28 * s, cz + 0.52 * s)], y, 0.25, 'trim')
    yy = y - 0.3
    m.poly([(x, yy, z) for x, z in body], 't_yel')
    m.poly([(x, yy, z) for x, z in head], 't_yel')
    m.poly([(cx + 0.8 * s, yy, cz + 0.5 * s), (cx + 0.8 * s, yy, cz + 0.24 * s), (cx + 1.18 * s, yy, cz + 0.37 * s)], 't_orange')
    m.poly([(x, yy - 0.02, z) for x, z in disc2(cx + 0.5 * s, cz + 0.52 * s, 0.08 * s, 5)], 'black')
    m.poly([(x, yy - 0.02, z) for x, z in disc2(cx - 0.2 * s, cz - 0.22 * s, 0.36 * s, 8, 0, 0.6)], shade('t_yel', 0.82))


def st_dog(m, cx, cz, y, s):
    head = disc2(cx, cz, 0.74 * s, 12)
    m.plate(grow2(head, 1.25), y, 0.25, 'trim')
    yy = y - 0.3
    for sx in (-1, 1):
        ear = disc2(cx + sx * 0.78 * s, cz + 0.12 * s, 0.4 * s, 8, 0, 1.5)
        m.plate(grow2(ear, 1.3), y, 0.25, 'trim')
        m.poly([(x, yy, z) for x, z in ear], 'fur_dark')
    m.poly([(x, yy - 0.01, z) for x, z in head], '#d9a066' if False else (0.69, 0.35, 0.13))
    m.poly([(x, yy - 0.03, z) for x, z in disc2(cx, cz - 0.24 * s, 0.38 * s, 8, 0, 0.8)], 'paper')
    m.poly([(x, yy - 0.05, z) for x, z in disc2(cx, cz - 0.12 * s, 0.13 * s, 6)], 'black')
    for sx in (-1, 1):
        m.poly([(x, yy - 0.03, z) for x, z in disc2(cx + sx * 0.3 * s, cz + 0.26 * s, 0.09 * s, 5)], 'black')


def st_boat(m, cx, cz, y, s):
    m.plate(disc2(cx, cz + 0.05 * s, 1.12 * s, 12), y, 0.25, 'trim')
    yy = y - 0.3
    m.poly([(x, yy, z) for x, z in disc2(cx, cz + 0.05 * s, 0.96 * s, 12)], 'glass_c')
    m.poly([(cx - 0.8 * s, yy - 0.02, cz - 0.25 * s), (cx - 0.52 * s, yy - 0.02, cz - 0.62 * s), (cx + 0.52 * s, yy - 0.02, cz - 0.62 * s), (cx + 0.8 * s, yy - 0.02, cz - 0.25 * s)], 't_red')
    m.fq(cx - 0.04 * s, cx + 0.04 * s, cz - 0.25 * s, cz + 0.72 * s, yy - 0.02, 'fur_dark')
    m.poly([(cx + 0.08 * s, yy - 0.02, cz - 0.16 * s), (cx + 0.62 * s, yy - 0.02, cz - 0.16 * s), (cx + 0.08 * s, yy - 0.02, cz + 0.68 * s)], 'trim')
    m.poly([(cx - 0.08 * s, yy - 0.02, cz - 0.16 * s), (cx - 0.08 * s, yy - 0.02, cz + 0.5 * s), (cx - 0.5 * s, yy - 0.02, cz - 0.16 * s)], 't_blue')


def toy_duck(m, cx, cy, z, s=1.0, rz=0.0):
    """A pull-along duck on wheels."""
    with m.at(cx, cy, z, rz, s=s):
        m.rbox(0, 0, 3.0, 1.7, 0.45, 0.8, 't_red', r=0.3, seg=1, bottom=True)
        for wx in (-1.0, 1.0):
            for sy in (-1, 1):
                m.hcyl((wx, sy * 0.75, 0.45), (wx, sy * 1.0, 0.45), 0.45, 8, 't_blue')
        m.ball(-0.1, 0, 1.75, 1.15, shade('t_yel', 0.85), n=8, rings=5, sz=0.85, col1='t_yel', sy=0.8)
        m.ball(0.8, 0, 2.9, 0.68, shade('t_yel', 0.9), n=7, rings=4, col1=tint('t_yel', 0.15))
        m.lathe(0, 0, [(0.0, 0.0)], 3, 't_orange')
        with m.at(1.35, 0, 2.8, ry=math.pi / 2):
            m.lathe(0, 0, [(0.3, 0), (0.0, 0.55)], 5, 't_orange', sy=1.5)
        m.ball(1.2, 0.36, 3.1, 0.09, 'black', n=4, rings=2)
        m.ball(1.2, -0.36, 3.1, 0.09, 'black', n=4, rings=2)
        m.lathe(-1.25, 0, [(0.5, 1.6), (0.0, 2.5)], 5, 't_yel', bottom=True)


def toy_block(m, cx, cy, z, s, col, rz=0.0, shape=None):
    with m.at(cx, cy, z, rz):
        m.rbox(0, 0, s, s, 0, s, col, r=0.14, seg=1, bev=0.12)
        if shape:
            pts = star2(0, s / 2, s * 0.3) if shape == 'star' else (heart2(0, s / 2, s * 0.3) if shape == 'heart' else disc2(0, s / 2, s * 0.28, 8))
            m.poly([(x, -s / 2 - 0.03, zz) for x, zz in pts], 'trim')


@building('stickers', 'games')
def b_stickers(m, L):
    """Toy shop: small shop, big steep colourful roof, giant stickers on the front (sunflower, duck, dog, boat)."""
    D = 'd_games'
    W, Dp = {3: (24, 20), 4: (38, 30), 5: (52, 36)}[L]
    ph = m.pad(W, Dp)
    set_door(m, 0, -Dp / 2)
    m.push(0, 0, ph)
    w, d, e, rh = (11.5, 9, 4.4, 8.0) if L == 3 else (19, 13, 5.6, 13.0)
    cy = 2.0
    x0, x1, y0, y1 = -w / 2, w / 2, cy - d / 2, cy + d / 2
    wall = 'w_butter'
    m.rbox(0, cy, w, d, 0, e, wall, r=0.4, top=False)
    m.band(0, cy, w, d, 0, 0.7, 't_teal', r=0.4, out=0.12)
    m.roof_gable(x0, x1, y0, y1, e, rh, D, axis='y', over=1.2, th=0.5, gable='w_white')
    roof_stripes(m, x0, x1, y0, y1, e, rh, ['t_yel', 't_teal'], over=1.2)
    m.ball(0, y0 - 1.0, e + rh + 0.5, 0.55, 't_red', n=6, rings=3)
    with m.side('front', x0, x1, y0, y1) as Lw:
        if L == 3:
            st_sunflower(m, 0, e + rh * 0.5, 0, 1.25)
            st_duck(m, -2.5, e + 1.4, 0, 1.15)
            st_boat(m, 2.6, e + 1.4, 0, 1.1)
            m.door(Lw / 2 - 2.3, 1.9, 3.0, col='t_red', glass=0.5)
            m.shopfront(-Lw / 2 + 1.0, Lw / 2 - 4.2, 0, 3.0, plinth=0.8)
            m.awning(-Lw / 2 + 0.5, Lw / 2 - 0.5, 4.3, 1.6, D, 'trim', drop=0.7)
        else:
            st_sunflower(m, 0, e + rh * 0.56, 0, 1.9)
            st_duck(m, -5.4, e + 2.3, 0, 1.75)
            st_boat(m, 0, e + 2.2, 0, 1.55)
            st_dog(m, 5.4, e + 2.3, 0, 1.6)
            m.door(Lw / 2 - 3.0, 2.2, 3.3, col='t_red', glass=0.5)
            m.shopfront(-Lw / 2 + 1.2, Lw / 2 - 5.2, 0, 3.4, plinth=0.8)
            for i, bx in enumerate(row(4, Lw - 8.5, -2.0)):
                toy_block(m, bx, -0.9, 0.86, 1.0, TOY[(i * 3) % 8], 0.3 * i, ('star', 'heart', 'dot', 'star')[i])
            m.awning(-Lw / 2 + 0.5, Lw / 2 - 0.5, 4.8, 2.0, D, 'trim', drop=0.8)
            m.sign('Sticker Scenes', 0, 4.95, 0.78, col='trim', board='t_teal', y=-0.05, max_w=Lw - 5)
    for sname in ('left', 'right'):
        with m.side(sname, x0, x1, y0, y1) as Lw:
            for wx in row(2, Lw - 3):
                m.win(wx, 1.4, 2.0, 2.2, bars=(1, 1), sill=0.2, shutters='t_teal')
    with m.side('back', x0, x1, y0, y1) as Lw:
        m.door(-Lw / 4, 1.8, 2.9, col='timber', glass=0.0)
        m.win(Lw / 4, 1.4, 2.2, 2.0, bars=(1, 1), sill=0.2)
        st_sunflower(m, 0, e + rh * 0.5, 0, 1.3 if L > 3 else 1.0)
    # forecourt toys
    toy_block(m, x0 - 2.4, y0 - 1.5, 0, 2.2, 't_blue', 0.3, 'star')
    if L > 3:
        toy_block(m, x0 - 2.2, y0 - 1.3, 2.2, 1.8, 't_red', -0.2, 'heart')
        toy_block(m, x0 - 4.6, y0 - 2.6, 0, 1.6, 't_green', 0.6, 'dot')
        toy_duck(m, x1 + 3.0, y0 - 4.0, 0, 1.25, -math.pi / 2 - 0.3)
        m.bench(-2, y0 - 5.0, math.pi, 2.4)
        m.globe_lamp(-W / 2 + 2.6, -Dp / 2 + 2.6)
        m.tree(W / 2 - 4, y1 - 0.5, 0.85)
    m.globe_lamp(W / 2 - 2.6, -Dp / 2 + 2.6)
    m.planter(x1 - 1.6, y0 - 1.1, 2.4, 1.1, flowers='flower_red') if L == 3 else None
    if L == 5:
        # a second steep roof, a sticker-sheet billboard, bunting and flags
        ax0, ax1, ay0, ay1 = x1 - 0.2, x1 + 11.0, cy - 5.0, cy + 5.5
        m.rbox((ax0 + ax1) / 2, (ay0 + ay1) / 2, ax1 - ax0, ay1 - ay0, 0, 4.6, 'w_peach', r=0.4, top=False)
        m.roof_gable(ax0, ax1, ay0, ay1, 4.6, 8.0, 't_teal', axis='y', over=1.0, th=0.45, gable='w_white')
        roof_stripes(m, ax0, ax1, ay0, ay1, 4.6, 8.0, [D, 't_yel'], over=1.0)
        with m.side('front', ax0, ax1, ay0, ay1) as Lw:
            m.shopfront(-Lw / 2 + 1.2, Lw / 2 - 1.2, 0, 3.2, plinth=0.8)
            st_dog(m, 0, 4.6 + 2.4, 0, 1.3)
            m.awning(-Lw / 2 + 0.5, Lw / 2 - 0.5, 4.3, 1.6, 't_teal', 'trim', drop=0.7)
        with m.side('right', ax0, ax1, ay0, ay1) as Lw:
            for wx in row(2, Lw - 3):
                m.win(wx, 1.4, 2.0, 2.2, bars=(1, 1), sill=0.2, shutters=D)
        # sticker sheet on posts
        with m.at(-W / 2 + 8.5, -Dp / 2 + 6.5, 0, -0.45):
            for px in (-2.6, 2.6):
                m.cyl(px, 0.2, 0, 6.6, 0.14, 5, 'timber_dark', cap=False)
            m.plate(rrect2(0, 4.4, 7.0, 4.6, 0.5), 0.1, 0.28, 'trim', edge=D, back=True)
            y = -0.2
            m.poly([(x, y, z) for x, z in star2(-2.2, 5.5, 0.85)], 't_yel')
            m.poly([(x, y, z) for x, z in heart2(0, 5.5, 0.8)], 't_red')
            m.poly([(x, y, z) for x, z in disc2(2.2, 5.5, 0.8, 10)], 't_blue')
            m.poly([(x, y, z) for x, z in disc2(-2.2, 3.4, 0.8, 6)], 't_green')
            m.poly([(x, y, z) for x, z in star2(0, 3.4, 0.85, 8, 0.7)], 't_pink')
            m.poly([(x, y, z) for x, z in rrect2(2.2, 3.4, 1.5, 1.5, 0.3)], 't_purple')
        m.bunting((-W / 2 + 2.6, -Dp / 2 + 2.6, 4.4), (x0 + 0.5, y0 - 1.0, e + 0.6), TOY, sag=0.7, n=9)
        m.bunting((ax1 - 0.5, ay0 - 0.8, 5.0), (W / 2 - 2.6, -Dp / 2 + 2.6, 4.4), TOY, sag=0.7, n=8)
        m.flag(-W / 2 + 4, y1, 9, D)
        m.flag(W / 2 - 4, y1 + 2, 9, 't_teal')
        for i in range(3):
            m.balloon(x1 - 2.0 + i * 0.9, y0 - 2.2 - (i % 2) * 0.5, 6.0 + (i % 2) * 0.9, TOY[i * 2 + 1], 0.7, anchor=(x1 - 1.4, y0 - 2.0, 1.2))
    m.pop()


def disco_ball(m, cx, cy, cz, r=0.8):
    with m.use('glow'):
        m.ball(cx, cy, cz, r, 'steel_light', n=8, rings=5, col1='trim')


def turret(m, cx, cy, r, h, ch, D, wall='w_butter', rows_=2, n=12, flag=True):
    """A round turret with a pointed roof."""
    m.cyl(cx, cy, 0, 0.8, r + 0.15, n, 't_teal')
    m.cyl(cx, cy, 0.8, h, r, n, shade(wall, 0.95), cap=False, col1=wall)
    amber = mixc('pane', 'lamp_warm', 0.25)
    for k in range(rows_):
        zz = h - 3.4 - k * 4.4
        if zz < 1.0:
            continue
        for i in (0, 3, 6, 9):
            a = 2 * math.pi * (i + 0.5) / n - math.pi / 2
            with m.at(cx + r * math.cos(math.pi / n) * math.cos(a), cy + r * math.cos(math.pi / n) * math.sin(a), 0, a + math.pi / 2):
                m.win(0, zz, 1.1, 1.9, fw=0.16, dep=0.12, arch=True, pane=amber)
    m.cyl(cx, cy, h - 0.5, h + 0.2, r + 0.35, n, 'trim', bottom=True)
    m.lathe(cx, cy, [(r + 0.8, h + 0.2), (r * 0.5, h + ch * 0.55), (0.0, h + ch)], n, [shade(D, 0.9), D, tint(D, 0.2)], bottom=True)
    if flag:
        m.cyl(cx, cy, h + ch - 0.3, h + ch + 2.4, 0.07, 4, 'trim', cap=False)
        m.sheet([(cx, cy, h + ch + 1.4), (cx + 1.6, cy, h + ch + 1.9), (cx, cy, h + ch + 2.4)], 't_teal')


@building('party', 'games')
def b_party(m, L):
    """Party house: a house with a round turret, string lights and a few balloons. A one-phone party game."""
    D = 'd_games'
    W, Dp = {3: (26, 22), 4: (42, 34), 5: (56, 40)}[L]
    ph = m.pad(W, Dp, col='grass_g', edge='kerb')
    set_door(m, -2 if L > 3 else -1.5, -Dp / 2)
    m.push(0, 0, ph)
    # the garden path
    px = -2.0 if L > 3 else -1.5
    w, d, e, rh = (12, 9, 4.6, 4.4) if L == 3 else (20, 13, 7.4, 6.2)
    cy = 3.5
    x0, x1, y0, y1 = -w / 2, w / 2, cy - d / 2, cy + d / 2
    m.box(px - 1.6, px + 1.6, -Dp / 2 + 0.4, y0, 0, 0.08, 'pave')
    wall = 'w_peach'
    m.rbox(0, cy, w, d, 0, e, wall, r=0.3, top=False)
    m.band(0, cy, w, d, 0, 0.7, 'w_brick', r=0.3, out=0.12)
    m.roof_gable(x0, x1, y0, y1, e, rh, D, axis='x', over=0.9, th=0.45, gable=wall)
    m.chimney(x0 + w * 0.2, cy + 1.0, e + rh * 0.4, e + rh + 1.6, 1.3)
    tr, th_, tch = (2.5, 8.5, 4.6) if L == 3 else (3.6, 14.5, 7.5)
    tx, ty = x1 - 0.6, y0 + 0.4
    turret(m, tx, ty, tr, th_, tch, D, rows_=1 if L == 3 else 3)
    ttop = th_ + tch
    amber = mixc('pane', 'lamp_warm', 0.25)
    with m.side('front', x0, x1, y0, y1) as Lw:
        dxl = px
        m.door(dxl, 2.2, 3.2, col='t_teal', glass=0.4)
        # porch
        pw = 6.5 if L > 3 else 4.6
        m.box(dxl - pw / 2, dxl + pw / 2, -2.8, 0, 0, 0.35, 'timber', top='deck_wood')
        m.steps(dxl, -3.8, 3.0, 1, rise=0.18, run=1.0, col='timber')
        for sx in (-1, 1):
            m.cbox(dxl + sx * (pw / 2 - 0.3), -2.5, 0.22, 0.22, 0.35, 3.7, 'trim', top=False)
        m.awning(dxl - pw / 2 - 0.3, dxl + pw / 2 + 0.3, 4.6, 3.1, D, 'trim', n=7 if L > 3 else 5, drop=0.9, val=0.35)
        wxs = [dxl - 5.0] if L > 3 else [dxl - 3.4]
        for wx in wxs:
            m.win(wx, 1.4, 2.2, 2.3, bars=(1, 1), sill=0.25, shutters='t_teal', pane=amber)
        if L > 3:
            for wx in (dxl - 5.0, dxl, dxl + 4.2):
                m.win(wx, 5.0, 2.0, 1.9, bars=(1, 1), sill=0.25, pane=amber)
            m.sign('One Too Far', dxl - 0.4, 3.75, 0.72, col='trim', board='t_purple', y=-3.0, max_w=pw + 0.4)
        else:
            m.sign('PARTY', dxl, 3.7, 0.6, col='trim', board='t_purple', y=-3.0)
        m.bunting((dxl - pw / 2, -2.9, 3.6), (dxl + pw / 2, -2.9, 3.6), TOY, sag=0.5, n=7)
    for sname in ('left', 'back'):
        with m.side(sname, x0, x1, y0, y1) as Lw:
            for wx in row(2 if sname == 'left' else 3, Lw - 3):
                m.win(wx, 1.4, 2.0, 2.2, bars=(1, 1), sill=0.2, pane=amber)
                if L > 3:
                    m.win(wx, 5.0, 2.0, 1.9, bars=(1, 1), sill=0.2, pane=amber)
    with m.side('right', x0, x1, y0, y1) as Lw:
        m.win(Lw / 4, 1.4, 2.0, 2.2, bars=(1, 1), sill=0.2, pane=amber)
    # string lights from the turret, balloons, giant cards
    lp = [(-W / 2 + 3, -Dp / 2 + 3), (W / 2 - 3, -Dp / 2 + 3)]
    for lx, ly in lp:
        m.cyl(lx, ly, 0, 6.0, 0.1, 5, 'timber_dark', cap=False)
        m.ball(lx, ly, 6.15, 0.2, 'gold_g', n=5, rings=2)
    bulbs = ['lamp_warm', 't_pink', 't_teal', 't_yel']
    m.string_lights((tx, ty - tr, th_ - 0.6), (lp[1][0], lp[1][1], 5.9), sag=1.4, n=7, cols=bulbs)
    m.string_lights((tx - tr * 0.7, ty - tr * 0.7, th_ - 0.6), (lp[0][0], lp[0][1], 5.9), sag=2.0, n=10 if L > 3 else 7, cols=bulbs)
    if L > 3:
        m.string_lights((lp[0][0], lp[0][1], 5.9), (lp[1][0], lp[1][1], 5.9), sag=1.3, n=12, cols=bulbs)
    bcols = ['t_red', 't_yel', 't_blue', 't_green', 't_pink', 't_purple', 't_teal', 't_orange']
    ax, ay = px + (3.0 if L > 3 else 2.2), y0 - 2.5
    for i in range(3):
        m.balloon(ax + (i - 1) * 0.95, ay - 0.3 + (i % 2) * 0.5, 5.6 + (i % 2) * 0.9 + (1.0 if L > 3 else 0), bcols[i], 0.72, anchor=(ax, ay, 3.6 if L > 3 else 3.5))
    if L > 3:
        mx, my = -W / 2 + 6.0, -Dp / 2 + 8.0
        m.cyl(mx, my, 0, 1.4, 0.1, 4, 'timber_dark', cap=False)
        m.rbox(mx, my, 1.2, 0.7, 1.4, 2.1, 't_red', r=0.2, seg=1, bev=0.15)
        for i in range(2):
            m.balloon(mx + (i - 0.5) * 1.0, my, 5.2 + i * 0.8, bcols[3 + i], 0.7, anchor=(mx, my, 2.1))
        for i, (suit, sc) in enumerate((('heart', 't_red'), ('star', 't_purple'))):
            with m.at(x0 + 1.5 + i * 2.6, y0 - 1.3, 0, 0.25 - i * 0.5):
                card(m, 0, 1.75, 2.1, 3.1, 0, 'trim', suit, sc, tilt=0.0)
                m.beam((0, 0.1, 2.4), (0, 1.3, 0), 0.12, 0.12, 'timber_dark')
        umbrella_table(m, W / 2 - 8, -Dp / 2 + 8.5, 0, col=D)
        m.tree(-W / 2 + 4.5, y1 - 0.5, 0.95)
        m.bush(x0 - 1.5, y0 - 0.8, 1.1)
        m.bush(x1 + 3.8, y0 + 4, 1.2)
        m.fence([(-W / 2 + 1.2, -Dp / 2 + 1.2), (px - 2.2, -Dp / 2 + 1.2)], 1.1, 'trim', every=2.4)
        m.fence([(px + 2.2, -Dp / 2 + 1.2), (W / 2 - 1.2, -Dp / 2 + 1.2)], 1.1, 'trim', every=2.4)
    else:
        m.bush(x0 - 1.4, y0 - 0.8, 1.0)
        m.tree(-W / 2 + 3.5, y1 - 0.5, 0.7)
    if L == 5:
        # a second turret, a striped party tent, a disco ball, more balloons (eight in all)
        t2x, t2y = x0 + 0.6, y1 - 0.6
        turret(m, t2x, t2y, 2.7, 10.5, 5.5, 't_purple', rows_=2)
        disco_ball(m, tx, ty, ttop + 3.3, 0.9)
        ex, ey = W / 2 - 9.5, cy + 2.5
        n = 10
        for i in range(n):
            a0, a1 = 2 * math.pi * i / n, 2 * math.pi * (i + 1) / n
            c = D if i % 2 == 0 else 'trim'
            p0, p1 = (ex + 4.6 * math.cos(a0), ey + 4.6 * math.sin(a0)), (ex + 4.6 * math.cos(a1), ey + 4.6 * math.sin(a1))
            m.sheet([(*p0, 3.2), (*p1, 3.2), (ex, ey, 6.6)], c, shade(c, 0.7))
            m.sheet([(*p0, 2.5), (*p1, 2.5), (*p1, 3.2), (*p0, 3.2)], c, shade(c, 0.7))
            if i % 2 == 0:
                m.cyl(p0[0], p0[1], 0, 3.2, 0.08, 4, 'trim', cap=False)
        m.cyl(ex, ey, 0, 6.9, 0.1, 4, 'trim', cap=False)
        m.ball(ex, ey, 7.0, 0.25, 'gold_g', n=5, rings=2)
        table_set(m, ex, ey, 0, 'trim', 4)
        for i in range(3):
            m.balloon(ex - 5.5 + (i - 1) * 0.9, ey - 5.5 + (i % 2) * 0.5, 4.8 + (i % 2) * 0.9, bcols[5 + i], 0.7, anchor=(ex - 5.5, ey - 5.3, 0.1))
        m.flag(-W / 2 + 4, y1 + 1.5, 9, D)
        for i, c in enumerate(bcols):
            a = i * 2.4
            m.cyl(px + 3.2 * math.cos(a) * (1 + i * 0.12) - 6, -Dp / 2 + 6.5 + 2.4 * math.sin(a), 0.0, 0.07, 0.42, 6, c)
    m.pop()


# ================================================================== HEALTHCARE AI (green)
def scooter(m, cx, cy, z, rz=0.0, col='d_health'):
    with m.at(cx, cy, z, rz):
        for wx in (-0.75, 0.75):
            m.hcyl((wx, -0.12, 0.32), (wx, 0.12, 0.32), 0.32, 7, 'rubber')
        m.rbox(-0.25, 0, 1.3, 0.5, 0.3, 0.75, col, r=0.15, seg=1, bev=0.1)
        m.beam((0.6, 0, 0.5), (0.75, 0, 1.25), 0.12, 0.12, 'iron')
        m.beam((0.75, -0.32, 1.25), (0.75, 0.32, 1.25), 0.08, 0.08, 'iron')
        m.rbox(-0.75, 0, 0.7, 0.62, 0.78, 1.4, 'trim', r=0.1, seg=1)
        m.poly([(x, -0.32, zz) for x, zz in cross2(-0.75, 1.1, 0.4, 0.13)], col)


@building('duiyao', 'health')
def b_duiyao(m, L):
    """Pharmacy: a small pharmacy with a green cross and a pill-shaped sign. Snap a medicine box, hear the match."""
    D = 'd_health'
    W, Dp = {3: (24, 20), 4: (38, 30), 5: (52, 36)}[L]
    ph = m.pad(W, Dp)
    set_door(m, 0, -Dp / 2)
    m.push(0, 0, ph)
    w, d, h = (12, 9, 5.0) if L == 3 else (21, 13, 6.4)
    bcx = 0 if L < 5 else -5
    cy = 2.0
    x0, x1, y0, y1 = bcx - w / 2, bcx + w / 2, cy - d / 2, cy + d / 2
    wall = 'w_white'
    m.rbox(bcx, cy, w, d, 0, h, wall, r=0.7, top=False)
    m.band(bcx, cy, w, d, 0, 0.7, 'w_mint', r=0.7, out=0.1)
    m.band(bcx, cy, w, d, h - 1.5, h - 0.2, D, r=0.7, out=0.18)
    m.parapet_roof(bcx, cy, w, d, h, wall, h=0.7, r=0.7)
    m.band(bcx, cy, w, d, h + 0.7, h + 1.0, D, r=0.7, out=0.3)
    zr = h + 1.0
    with m.side('front', x0, x1, y0, y1) as Lw:
        m.door(0, 2.8 if L > 3 else 2.2, 3.1, col='trim', glass=0.85, double=True)
        for sx in (-1, 1):
            a, b = sx * 2.4, sx * (Lw / 2 - 1.4)
            m.shopfront(min(a, b), max(a, b), 0, 3.1, plinth=0.7, plinth_col='w_mint')
            # shelves of medicine boxes in the window
            for i, bx in enumerate(row(3 if L > 3 else 2, abs(b - a) - 1.0, (a + b) / 2)):
                m.cbox(bx, -0.45, 0.8, 0.4, 0.75, 1.75, ('trim', 'w_mint', 't_teal')[i % 3])
                m.poly([(x, -0.67, z) for x, z in cross2(bx, 1.35, 0.4, 0.13)], D)
        m.awning(-Lw / 2 + 0.8, Lw / 2 - 0.8, 4.2, 1.7, D, 'trim', drop=0.7)
        m.text('PHARMACY', 0.85 if L > 3 else 0.6, 0, h - 1.25, 'trim', y=-0.2, mat='glow', bold=0.03)
        # ramp and rail to the door
        m.poly([(1.6, -0.3, 0.0), (1.6, -3.4, 0.0), (5.4, -3.4, 0.0), (5.4, -0.3, 0.0)], 'pave_light') if False else None
    # the green cross, on a mast at the corner
    cs = 2.4 if L == 3 else 3.4
    m.cyl(x1 + 1.3, y0 - 1.3, 0, h + 2.2, 0.14, 5, 'trim', cap=False)
    m.cyl(x1 + 1.3, y0 - 1.3, 0, 0.5, 0.4, 6, 'trim')
    cross3d(m, x1 + 1.3, y0 - 1.3, h + 2.2 + cs / 2 - 0.3, s=cs, t=cs * 0.34, d=0.6, col=D)
    # the pill sign on the roof
    pl = 5.0 if L == 3 else 7.5
    pr = 0.85 if L == 3 else 1.2
    pxc = bcx - (0 if L == 3 else 2.5)
    for sx in (-1, 1):
        m.cbox(pxc + sx * pl * 0.28, y0 + 1.6, 0.3, 0.3, zr, zr + 1.0, 'iron')
    capsule(m, pxc, y0 + 1.6, zr + 1.0 + pr, L=pl, r=pr, col_a=D, col_b='trim', n=10)
    m.ac_unit(x1 - 3, y1 - 2.4, zr, 1.1)
    for sname in ('left', 'right', 'back'):
        with m.side(sname, x0, x1, y0, y1) as Lw:
            for wx in row(2 if sname != 'back' else 3, Lw - 3):
                m.win(wx, 1.4, 2.2, 2.0, bars=(1, 0), sill=0.2)
            if sname == 'back':
                m.door(Lw / 2 - 2.2, 1.8, 2.8, col='steel_light', glass=0.0)
    # snap a medicine box: a giant carton inside a camera viewfinder, and a speaker that reads it out
    gx, gy = x0 - 3.0 if L > 3 else x0 - 2.4, y0 - 1.6
    ms = 1.0 if L > 3 else 0.75
    medicine_box(m, gx, gy, 0, 2.8 * ms, 1.5 * ms, 3.8 * ms, 0.25)
    with m.at(gx, gy, 0, 0.25):
        with m.use('glow'):
            fw_, fh_, yv = 2.4 * ms, 2.9 * ms, -1.4 * ms
            for sx in (-1, 1):
                for sz in (-1, 1):
                    cxv, czv = sx * fw_, 2.1 * ms + sz * fh_
                    m.fq(min(cxv, cxv - sx * 0.9 * ms), max(cxv, cxv - sx * 0.9 * ms), czv - 0.09, czv + 0.09, yv, 'lamp')
                    m.fq(cxv - 0.09, cxv + 0.09, min(czv, czv - sz * 0.9 * ms), max(czv, czv - sz * 0.9 * ms), yv, 'lamp')
        for sx in (-1, 1):
            m.cyl(sx * 2.4 * ms, -1.4 * ms + 0.05, 0, 5.0 * ms, 0.06, 4, 'iron', cap=False)
    sx_, sy_ = gx + 5.2 * ms, y0 - 5.2
    if L > 3:
        m.cyl(sx_, sy_, 0, 3.4, 0.1, 4, 'iron', cap=False)
        with m.at(sx_, sy_, 3.6, -0.35):
            with m.at(0, 0, 0, rx=math.pi / 2):
                m.lathe(0, 0, [(0.25, -0.3), (0.3, 0.2), (0.75, 0.95)], 7, ['iron', 'trim', 'trim'], cap=False, bottom=True)
            sound_waves(m, 0.0, 0.0, -1.2, 1.0, D, 3) if False else None
            for k in range(3):
                rr = 0.55 + 0.4 * k
                with m.use('glow'):
                    m.torus(0, -1.2 - 0.45 * k, 0, rr, 0.07, 10, 3, D, axis='y')
    m.globe_lamp(W / 2 - 2.6, -Dp / 2 + 2.6)
    m.planter(x1 - 2.5 if L == 3 else x1 - 3.4, y0 - 4.2 if L == 3 else y0 - 1.2, 2.6, 1.1, plant='leaf_light')
    if L > 3:
        m.globe_lamp(-W / 2 + 2.6, -Dp / 2 + 2.6)
        m.bench(3.5 + bcx, y0 - 5.2, math.pi, 2.4)
        m.tree(W / 2 - 4, y1 - 0.5, 0.85)
        scooter(m, x1 + 2.6, y0 - 2.5, 0, 0.4)
    if L == 5:
        # a consulting wing, a tall cross pylon, a herb garden and a flag
        ax0, ax1, ay0, ay1 = x1 - 0.3, x1 + 12.5, cy - 6.0, cy + 6.5
        acx, acy = (ax0 + ax1) / 2, (ay0 + ay1) / 2
        m.rbox(acx, acy, ax1 - ax0, ay1 - ay0, 0, 8.4, 'w_mint', r=0.7, top=False)
        m.parapet_roof(acx, acy, ax1 - ax0, ay1 - ay0, 8.4, 'w_mint', h=0.7, r=0.7)
        m.band(acx, acy, ax1 - ax0, ay1 - ay0, 9.1, 9.4, D, r=0.7, out=0.3)
        ribbons(m, (ax0, ax1, ay0, ay1), ('front', 'right', 'back'), 2, 1.2, 4.0, 2.0)
        with m.side('front', ax0, ax1, ay0, ay1) as Lw:
            m.door(Lw / 2 - 2.4, 2.0, 2.9, col='trim', glass=0.7, y=-0.2)
            m.canopy(Lw / 2 - 4.2, Lw / 2 - 0.6, -2.2, 0, 3.4, D)
        m.ac_unit(acx, acy + 2, 9.4, 1.2)
        px_, py_ = -W / 2 + 6.5, -Dp / 2 + 6.0
        m.rbox(px_, py_, 2.2, 2.2, 0, 1.0, 'w_stone', r=0.25, seg=1, bev=0.12)
        m.rbox(px_, py_, 1.2, 1.2, 1.0, 11.5, 'trim', r=0.3, seg=1, col1='w_white')
        cross3d(m, px_, py_, 13.6, s=4.0, t=1.35, d=1.0, col=D)
        m.cyl(px_, py_, 11.5, 11.9, 0.9, 8, D)
        for i in range(3):
            m.planter(-W / 2 + 12 + i * 4.2, -Dp / 2 + 3.5, 3.2, 1.3, plant='leaf_light', flowers=('flower_white', 'flower_yel', 'flower_pink')[i])
        m.flag(W / 2 - 4, y1 + 2.5, 9, D)
    m.pop()


@building('hackathons', 'health', site='site_large')
def b_hackathons(m, L):
    """Event hall: a wide hall with a curved roof, banners and a forecourt. Healthcare AI hackathons."""
    D = 'd_health'
    W, Dp = {3: (38, 30), 4: (66, 46), 5: (76, 54)}[L]
    ph = m.pad(W, Dp)
    set_door(m, 0, -Dp / 2)
    m.push(0, 0, ph)
    w, d, h, rh = (23, 13, 5.6, 3.6) if L == 3 else (48, 21, 8.0, 5.6)
    hcx = 0 if L < 5 else -4
    cy = Dp / 2 - d / 2 - 3.0
    x0, x1, y0, y1 = hcx - w / 2, hcx + w / 2, cy - d / 2, cy + d / 2
    fo = 3.2 if L > 3 else 2.2                                   # the roof sweeps out over the entrance
    wall = 'w_white'
    m.box(x0, x1, y0, y1, 0, h, wall, top=False)
    m.band(hcx, cy, w, d, 0, 0.8, 'w_mint', r=0.02, out=0.12, seg=1)
    m.vault(x0, x1, y0 - fo, y1 + 1.0, h, rh, D, axis='x', n=12, over=1.6, end=wall, th=0.55, ribs=3 if L == 3 else 6, arc=2.1)
    ncol = 4 if L == 3 else 7
    for cxx in row(ncol, w * ncol / (ncol - 1) - 0.01, hcx):
        m.cyl(cxx, y0 - fo + 0.7, 0, h + 0.1, 0.24, 6, 'trim', cap=False)
    with m.side('front', x0, x1, y0, y1) as Lw:
        with m.use('glass'):
            m.fq(-Lw / 2 + 0.6, Lw / 2 - 0.6, 0.8, h - 0.4, -0.08, ['glass_b', 'glass_b', 'glass_c', 'glass_c'])
        nm = 7 if L == 3 else 15
        for mx in row(nm, Lw - 1.2 + (Lw - 1.2) / (nm - 1) - 0.4):
            m.box(mx - 0.1, mx + 0.1, -0.22, 0, 0.8, h - 0.4, 'trim', top=False)
        m.box(-Lw / 2 + 0.5, Lw / 2 - 0.5, -0.24, 0, h * 0.52, h * 0.52 + 0.22, 'trim', bottom=True)
        m.box(-Lw / 2 + 0.3, Lw / 2 - 0.3, -0.26, 0, h - 0.5, h + 0.05, 'trim', bottom=True)
        # the green entrance portal
        pw_ = 7.0 if L == 3 else 12.0
        phh = 4.4 if L == 3 else 5.4
        m.box(-pw_ / 2, pw_ / 2, -1.6, 0, 0, phh, D, top=tint(D, 0.1))
        m.box(-pw_ / 2 + 0.7, pw_ / 2 - 0.7, -1.65, -1.5, 0, phh - 1.5, 'w_white', top=False)
        for dx in row(2 if L == 3 else 3, pw_ - 1.4):
            m.door(dx, 2.3, 3.2, col='trim', glass=0.85, double=True, y=-1.62, fw=0.15, dep=0.1)
        m.text('HACKATHON', 0.95 if L > 3 else 0.62, 0, phh - 1.2, 'trim', y=-1.66, mat='glow', bold=0.03)
    for sname in ('left', 'right'):
        with m.side(sname, x0, x1, y0, y1) as Lw:
            for wx in row(2 if L == 3 else 3, Lw - 3):
                m.win(wx, 1.6, 3.0, 3.2 if L > 3 else 2.4, bars=(1, 1), sill=0.2)
    with m.side('back', x0, x1, y0, y1) as Lw:
        for wx in row(2 if L == 3 else 4, Lw - 6):
            m.box(wx - 2.0, wx + 2.0, -0.2, 0, 0, 4.2, 'steel_light', top='steel_light')
    # forecourt: wide steps, banners with emblems, planters
    fy = y0 - fo - 1.2
    m.box(x0 - 1.0, x1 + 1.0, fy, y0, 0, 0.3, 'pave_light')
    m.box(x0 - 1.8, x1 + 1.8, fy - 0.8, y0, 0, 0.15, 'pave_light')

    def cross_em(cx, cz):
        m.poly([(x, -0.04, z) for x, z in cross2(cx, cz, 1.1, 0.36)], 'trim')
        m.poly([(x, 0.06, z) for x, z in reversed(cross2(cx, cz, 1.1, 0.36))], 'trim')

    def heart_em(cx, cz):
        m.poly([(x, -0.04, z) for x, z in heart2(cx, cz, 0.6)], 'trim')
        m.poly([(x, 0.06, z) for x, z in reversed(heart2(cx, cz, 0.6))], 'trim')

    def pulse_em(cx, cz):
        pulse_line(m, cx, cz, -0.04, 1.5, 0.9, 'trim', 0.12, mat='city')
    nb = 2 if L == 3 else (4 if L == 4 else 6)
    by = -Dp / 2 + (3.0 if L == 3 else 4.0)
    ems = (cross_em, pulse_em, heart_em)
    for i, bx in enumerate(row(nb, (W - 8) * nb / (nb - 1) if nb > 1 else 0)):
        if abs(bx) < 4:
            continue
        m.banner(bx, by, 3.2, 9.0 if L > 3 else 7.0, 1.9 if L > 3 else 1.5, D if i % 2 == 0 else tint(D, 0.25), sideways=1 if bx < 0 else -1, emblem=ems[i % 3])
    m.lamp(-W / 2 + 3, -Dp / 2 + 2.6, 6.5, rz=math.pi) if L == 3 else None
    m.planter(x0 + 2.5, fy - 2.2, 4.0, 1.3, plant='leaf_light')
    m.planter(x1 - 2.5, fy - 2.2, 4.0, 1.3, plant='leaf_light')
    m.tree(-W / 2 + 4, cy, 1.0) if L != 5 else None
    m.tree(W / 2 - 4, cy + 2, 1.1) if L < 5 else None
    if L > 3:
        for bx in (-10, 10):
            m.bench(bx + hcx, fy - 2.4, math.pi, 2.6)
        for lx in (-W / 2 + 3, W / 2 - 3):
            m.lamp(lx, fy - 6, 7, rz=math.pi)
        # a laptop table for the builders
        for tx in (-18, 18):
            with m.at(tx + hcx, fy - 5.5, 0):
                m.cbox(0, 0, 3.4, 1.4, 0.95, 1.08, 'timber', bottom=True)
                for lx in (-1.4, 1.4):
                    m.cbox(lx, 0, 0.12, 1.1, 0, 0.95, 'iron', top=False)
                for lx in (-0.8, 0.8):
                    m.cbox(lx, 0.0, 0.7, 0.5, 1.08, 1.12, 'steel_light')
                    with m.use('glow'):
                        m.poly([(lx - 0.35, 0.27, 1.12), (lx + 0.35, 0.27, 1.12), (lx + 0.35, 0.42, 1.6), (lx - 0.35, 0.42, 1.6)], 'glass_c')
                    m.poly([(lx + 0.35, 0.29, 1.12), (lx - 0.35, 0.29, 1.12), (lx - 0.35, 0.44, 1.6), (lx + 0.35, 0.44, 1.6)], 'steel_light')
    if L == 5:
        # a tower with a beacon, a big screen with a heartbeat, flags and a coffee kiosk
        tx, ty = x1 + 5.0, y0 + 1.5
        m.rbox(tx, ty, 6.0, 6.0, 0, 19.0, wall, r=0.8, top=False, col1='w_mint')
        ribbons(m, (tx - 3, tx + 3, ty - 3, ty + 3), ('front', 'right'), 4, 2.0, 4.0, 1.6, margin=1.2)
        m.band(tx, ty, 6, 6, 19.0, 19.6, D, r=0.8, out=0.5)
        with m.use('glow'):
            m.cyl(tx, ty, 19.6, 21.8, 1.5, 8, 'lamp')
        m.lathe(tx, ty, [(2.2, 21.8), (0.0, 24.2)], 8, [D, tint(D, 0.2)], bottom=True)
        with m.at(tx, ty - 3.0, 0):
            m.door(0, 2.0, 2.9, col='trim', glass=0.7)
            cross3d(m, 0, -0.5, 16.0, s=2.6, t=0.9, d=0.4, col=D)
        with m.side('front', x0, x1, y0, y1) as Lw:
            sx_ = Lw / 2 - 8.5
            m.box(sx_ - 5.2, sx_ + 5.2, -fo - 0.2, -fo + 0.3, h + 0.6, h + 6.4, 'iron', bottom=True)
            with m.use('glow'):
                m.fq(sx_ - 4.8, sx_ + 4.8, h + 1.0, h + 6.0, -fo - 0.23, shade(D, 0.5))
            pulse_line(m, sx_, h + 3.5, -fo - 0.26, 8.4, 3.0, 'lamp', 0.26)
            for px in (sx_ - 4, sx_ + 4):
                m.cyl(px, -fo + 0.6, h - 1.5, h + 1.0, 0.16, 5, 'iron', cap=False)
        for i, fc in enumerate((D, 't_blue', 't_yel', 't_red')):
            m.flag(-W / 2 + 4 + i * 3.2, y0 - 2, 10, fc)
        kx, ky = W / 2 - 9, -Dp / 2 + 12
        m.rbox(kx, ky, 5.0, 3.6, 0, 3.0, 'w_mint', r=0.4, top=False)
        m.band(kx, ky, 5.0, 3.6, 3.0, 3.35, D, r=0.4, out=0.5)
        with m.at(kx, ky - 1.8, 0):
            m.shopfront(-1.9, 1.9, 0.0, 2.4, plinth=1.0)
            m.awning(-2.4, 2.4, 3.0, 1.5, D, 'trim', drop=0.6)
        table_set(m, kx - 5, ky - 3, 0, 'trim', 3)
    m.pop()
