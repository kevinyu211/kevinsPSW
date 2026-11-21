"""Shared detail pieces for the island buildings: the things that make each building say what the work is."""
import math
from mathutils import Vector
from ilib import shade, tint, mixc, C, disc2, star2, rrect2, cross2, capsule2, heart2, grow2, rrect, rect, ngon

__all__ = ['books_window', 'giant_book', 'open_book', 'paper_roll', 'container', 'pencil', 'easel', 'softbox', 'tripod_camera',
           'mammoth', 'sabre_cat', 'saxophone', 'ring_light', 'capsule', 'cross3d', 'hoop', 'bollard', 'truck', 'table_set',
           'umbrella_table', 'giant_bead', 'paint_pot', 'fountain', 'card', 'medicine_box', 'sound_waves', 'check_shield',
           'pulse_line', 'tiny_person', 'windows', 'glass_rail', 'quay_crane', 'silo', 'page_icon']

BOOK_COLS = ['t_red', 't_yel', 't_blue', 't_green', 't_pink', 't_purple', 't_teal', 't_orange', 'paper', 'w_brick']


def windows(m, xs, z, w, h, **kw):
    for x in xs:
        m.win(x, z, w, h, **kw)


def books_window(m, x0, x1, z0, z1, y, rows=3, backing=True):
    """Shelves of coloured book spines in a window (the backing glows at night)."""
    if backing:
        with m.use('glow'):
            m.fq(x0, x1, z0, z1, y - 0.03, (0.20, 0.14, 0.09))
    rh = (z1 - z0) / rows
    rng = m.rng
    for r in range(rows):
        zb = z0 + r * rh
        m.box(x0, x1, y - 0.35, y, zb - 0.08, zb + 0.04, 'timber', bottom=True)
        x = x0 + 0.12
        while x < x1 - 0.35:
            bw = rng.uniform(0.28, 0.55)
            bh = rh * rng.uniform(0.6, 0.86)
            if rng.random() < 0.12:
                x += bw
                continue
            c = rng.choice(BOOK_COLS)
            m.fq(x, min(x + bw, x1 - 0.1), zb + 0.04, zb + 0.04 + bh, y - 0.22, [shade(c, 0.85), shade(c, 0.85), c, c])
            x += bw + 0.03


def giant_book(m, cx, cy, z, w, d, t, col, rz=0.0):
    """A closed giant book lying flat (spine on the left)."""
    with m.at(cx, cy, z, rz):
        m.cbox(0.08, 0, w - 0.3, d - 0.3, 0.12, t - 0.12, 'paper', top=False)
        m.rbox(0, 0, w, d, 0, 0.14, col, r=0.15, seg=1, bottom=True)
        m.rbox(0, 0, w, d, t - 0.14, t, col, r=0.15, seg=1, bottom=True)
        m.cbox(-w / 2 + 0.1, 0, 0.2, d, 0.1, t - 0.1, shade(col, 0.85), top=False)
        m.cbox(0.3, 0, w * 0.45, d * 0.3, t, t + 0.03, tint(col, 0.55))


def open_book(m, cx, cy, z, w, upright=True):
    """An open book. upright: a flat sign facing -y of the current frame. else: a roof-like open book seen from above."""
    if upright:
        h = w * 0.62
        left = [(cx - w / 2, z + 0.12 * h), (cx - 0.05, z), (cx - 0.05, z + h * 0.88), (cx - w / 2, z + h)]
        right = [(cx + 0.05, z), (cx + w / 2, z + 0.12 * h), (cx + w / 2, z + h), (cx + 0.05, z + h * 0.88)]
        cover = [(cx - w / 2 - 0.15, z + 0.02 * h), (cx, z - 0.14 * h), (cx + w / 2 + 0.15, z + 0.02 * h), (cx + w / 2 + 0.15, z + h * 1.02), (cx, z + h * 0.9), (cx - w / 2 - 0.15, z + h * 1.02)]
        m.plate(cover, cy + 0.12, 0.12, 't_red', back=True)
        m.poly([(x, cy - 0.06, zz) for x, zz in left], 'paper')
        m.poly([(x, cy - 0.06, zz) for x, zz in right], 'paper')
        for k in range(3):
            zz = z + h * (0.3 + 0.18 * k)
            m.fq(cx - w / 2 + 0.3, cx - 0.35, zz + 0.07, zz + 0.07 + 0.06 * h, cy - 0.09, 'pane_light')
            m.fq(cx + 0.35, cx + w / 2 - 0.3, zz + 0.07, zz + 0.07 + 0.06 * h, cy - 0.09, 'pane_light')
    else:
        d = w * 0.7
        for sx in (-1, 1):
            a = (cx, cy - d / 2, z)
            # two pages rising from the spine like a shallow roof (two-sided)
            q = [(cx, cy - d / 2, z), (cx + sx * w / 2, cy - d / 2, z + w * 0.16), (cx + sx * w / 2, cy + d / 2, z + w * 0.16), (cx, cy + d / 2, z)]
            if sx < 0:
                q = q[::-1]
            m.poly(q, 'paper')
            m.poly([(p[0], p[1], p[2] - 0.14) for p in q][::-1], 't_red')
            for k in range(3):
                u0, u1 = 0.25, 0.85
                v = 0.25 + 0.22 * k
                ln = [(cx + sx * w / 2 * u0, cy - d / 2 + d * v, z + w * 0.16 * u0 + 0.03), (cx + sx * w / 2 * u1, cy - d / 2 + d * v, z + w * 0.16 * u1 + 0.03),
                      (cx + sx * w / 2 * u1, cy - d / 2 + d * (v + 0.07), z + w * 0.16 * u1 + 0.03), (cx + sx * w / 2 * u0, cy - d / 2 + d * (v + 0.07), z + w * 0.16 * u0 + 0.03)]
                m.poly(ln if sx > 0 else ln[::-1], 'pane_light')
            f = [(cx, cy - d / 2, z - 0.14), (cx + sx * w / 2, cy - d / 2, z + w * 0.16 - 0.14), (cx + sx * w / 2, cy - d / 2, z + w * 0.16), (cx, cy - d / 2, z)]
            m.poly(f if sx > 0 else f[::-1], shade('paper', 0.9))
            b = [(p[0], cy + d / 2, p[2]) for p in f]
            m.poly(b[::-1] if sx > 0 else b, shade('paper', 0.9))


def paper_roll(m, cx, cy, z, r=1.2, w=2.4, rz=0.0, upright=False):
    """A big roll of printing paper."""
    with m.at(cx, cy, z, rz):
        if upright:
            m.cyl(0, 0, 0, w, r, 10, 'paper')
            m.cyl(0, 0, w, w + 0.03, r * 0.28, 8, 'bark_pale')
        else:
            m.hcyl((-w / 2, 0, r), (w / 2, 0, r), r, 10, 'paper')
            m.hcyl((-w / 2 - 0.03, 0, r), (w / 2 + 0.03, 0, r), r * 0.28, 6, 'bark_pale')


def container(m, cx, cy, z, col, L=6.0, w=2.5, h=2.6, rz=0.0):
    with m.at(cx, cy, z, rz):
        m.cbox(0, 0, L, w, 0, h, col, top=tint(col, 0.1))
        m.cbox(0, 0, L + 0.06, w + 0.08, h * 0.44, h * 0.56, shade(col, 0.8), top=False)


def pencil(m, cx, cy, z, col, h=9.0, r=0.6, lean=0.0, rz=0.0):
    """A giant colouring pencil standing on its flat end, point up."""
    with m.at(cx, cy, z, rz, rx=lean):
        m.lathe(0, 0, [(r, 0), (r, h * 0.74)], 6, [shade(col, 0.85), col], cap=False, bottom=True)
        m.lathe(0, 0, [(r * 1.04, h * 0.05), (r * 1.04, h * 0.1)], 6, 'gold_g', cap=False)
        m.lathe(0, 0, [(r, h * 0.74), (r * 0.32, h * 0.93)], 6, 'bark_pale', cap=False)
        m.lathe(0, 0, [(r * 0.32, h * 0.93), (0.0, h)], 6, col, cap=False)


def easel(m, cx, cy, z, w=5.0, h=7.0, rz=0.0, picture=None):
    """A giant easel with a canvas facing -y."""
    with m.at(cx, cy, z, rz):
        for sx in (-1, 1):
            m.beam((sx * w * 0.42, -0.2, 0), (sx * w * 0.12, 0.5, h), 0.28, 0.28, 'timber')
        m.beam((0, 2.6, 0), (0, 0.6, h * 0.92), 0.26, 0.26, 'timber_dark')
        m.box(-w * 0.5, w * 0.5, -0.5, 0.25, h * 0.22, h * 0.22 + 0.25, 'timber', bottom=True)
        cz0, cz1 = h * 0.22 + 0.25, h * 0.86
        with m.at(0, 0.1, 0, rx=-0.0):
            m.box(-w * 0.44, w * 0.44, -0.15, 0.1, cz0, cz1, 'canvas', bottom=True)
            if picture:
                picture(m, 0, (cz0 + cz1) / 2, w * 0.4, (cz1 - cz0) * 0.44, -0.19)


def softbox(m, cx, cy, z, h=4.2, s=1.0, rz=0.0):
    """A photographer's softbox light on a stand; the diffuser faces -y and is in the glow material."""
    with m.at(cx, cy, z, rz):
        for a in (0.5, 2.6, 4.7):
            m.beam((0, 0, 0.9), (0.9 * math.cos(a), 0.9 * math.sin(a), 0), 0.09, 0.09, 'iron')
        m.cyl(0, 0, 0.8, h, 0.07, 4, 'iron', cap=False)
        m.beam((0, 0, h), (0, 0.52, h), 0.1, 0.1, 'iron')
        w = 2.2 * s
        back = [(-0.35, 0.5, h - 0.35), (0.35, 0.5, h - 0.35), (0.35, 0.5, h + 0.35), (-0.35, 0.5, h + 0.35)]
        frontp = [(-w / 2, -0.5, h - w / 2), (w / 2, -0.5, h - w / 2), (w / 2, -0.5, h + w / 2), (-w / 2, -0.5, h + w / 2)]
        for i in range(4):
            j = (i + 1) % 4
            m.poly([back[j], back[i], frontp[i], frontp[j]][::-1], 'iron')
        m.poly(back[::-1], 'iron')
        with m.use('glow'):
            m.poly(frontp, 'lamp')
        m.plate([(-w / 2 - 0.08, h - w / 2 - 0.08), (w / 2 + 0.08, h - w / 2 - 0.08), (w / 2 + 0.08, h + w / 2 + 0.08), (-w / 2 - 0.08, h + w / 2 + 0.08)], -0.42, 0.0, 'iron')


def tripod_camera(m, cx, cy, z, h=2.6, rz=0.0):
    with m.at(cx, cy, z, rz):
        for a in (0.5, 2.6, 4.7):
            m.beam((0, 0, h), (1.0 * math.cos(a), 1.0 * math.sin(a), 0), 0.1, 0.1, 'iron')
        m.rbox(0, 0, 1.2, 0.9, h, h + 0.8, 'iron', r=0.12, seg=1, bottom=True)
        m.hcyl((0, -0.45, h + 0.4), (0, -1.0, h + 0.4), 0.3, 7, 'slate')
        with m.use('glass'):
            m.poly([(0.24 * math.cos(2 * math.pi * k / 7), -1.02, h + 0.4 + 0.24 * math.sin(2 * math.pi * k / 7)) for k in range(7)], 'glass_b')
        m.cbox(0.3, 0.1, 0.35, 0.3, h + 0.8, h + 0.98, 't_red')


def _legs(m, pts, r, h, col, n=6):
    for x, y in pts:
        m.lathe(x, y, [(r * 0.9, 0), (r, h * 0.5), (r * 0.85, h)], n, col, cap=False, bottom=False)


def mammoth(m, cx, cy, z, s=1.0, rz=0.0, col='fur', plinth=True):
    """A simple, friendly woolly mammoth statue facing -y (about 5.5 m tall at s = 1)."""
    with m.at(cx, cy, z, rz):
        z0 = 0.0
        if plinth:
            m.rbox(0, 0, 6.0 * s, 9.0 * s, 0, 0.9, 'w_stone', r=0.4, bev=0.15)
            z0 = 0.9
        with m.at(0, 0, z0, s=s):
            _legs(m, [(-1.1, -2.0), (1.1, -2.0), (-1.1, 1.9), (1.1, 1.9)], 0.62, 2.3, shade(col, 0.85))
            m.ball(0, 0.2, 3.4, 2.1, shade(col, 0.8), n=8, rings=5, sz=0.9, col1=col, sy=1.55)
            m.ball(0, -1.6, 4.3, 1.5, shade(col, 0.85), n=7, rings=4, sz=1.0, col1=tint(col, 0.06), sy=1.1)   # shoulder hump
            m.ball(0, -3.3, 4.4, 1.25, shade(col, 0.85), n=7, rings=4, sz=1.15, col1=tint(col, 0.08))            # head
            m.ball(0, -3.3, 5.6, 0.7, col, n=6, rings=3, sz=0.8, col1=tint(col, 0.1))                           # dome
            m.tube([(0, -4.2, 4.3), (0, -4.7, 3.3), (0, -4.8, 2.2), (0, -4.6, 1.3), (0, -4.1, 0.9)], [0.5, 0.42, 0.34, 0.27, 0.2], 6, shade(col, 0.9))
            for sx in (-1, 1):
                m.tube([(sx * 0.6, -4.0, 3.5), (sx * 1.2, -4.9, 2.4), (sx * 1.5, -5.8, 2.2), (sx * 1.2, -6.4, 3.0), (sx * 0.7, -6.5, 3.9)],
                       [0.26, 0.24, 0.2, 0.14, 0.04], 5, 'bone')
                e = [(sx * 1.1, -2.9, 4.9), (sx * 1.9, -2.6, 4.4), (sx * 1.7, -2.5, 3.5), (sx * 1.1, -2.8, 3.9)]
                m.sheet(e, shade(col, 0.7))
                m.ball(sx * 0.75, -4.25, 4.75, 0.14, 'iron', n=4, rings=2)
            m.tube([(0, 2.9, 3.6), (0, 3.4, 2.8), (0, 3.4, 2.0)], [0.16, 0.12, 0.08], 4, shade(col, 0.7))


def sabre_cat(m, cx, cy, z, s=1.0, rz=0.0, col='gold_g', plinth=True):
    """A sabre-toothed cat statue (bronze) facing -y."""
    with m.at(cx, cy, z, rz):
        z0 = 0.0
        if plinth:
            m.rbox(0, 0, 3.6 * s, 6.4 * s, 0, 0.8, 'w_stone', r=0.3, bev=0.12)
            z0 = 0.8
        with m.at(0, 0, z0, s=s):
            _legs(m, [(-0.6, -1.5), (0.6, -1.5), (-0.6, 1.5), (0.6, 1.5)], 0.3, 1.5, shade(col, 0.8), n=5)
            m.ball(0, 0, 2.0, 0.95, shade(col, 0.75), n=7, rings=4, sz=0.85, col1=col, sy=2.2)
            m.ball(0, -1.6, 2.35, 0.85, shade(col, 0.8), n=6, rings=4, sz=1.0, col1=tint(col, 0.08))
            m.ball(0, -2.5, 2.6, 0.68, shade(col, 0.85), n=6, rings=4, sz=0.95, col1=tint(col, 0.1))
            m.ball(0, -3.05, 2.4, 0.38, col, n=5, rings=3, sz=0.8)
            for sx in (-1, 1):
                m.lathe(sx * 0.2, -3.15, [(0.0, 1.45), (0.1, 1.9), (0.1, 2.2)], 4, 'bone', cap=False)
                m.lathe(sx * 0.42, -2.3, [(0.2, 3.05), (0.0, 3.5)], 4, shade(col, 0.8), cap=False, bottom=True)
            m.tube([(0, 2.0, 2.2), (0, 2.9, 2.5), (0, 3.4, 3.2), (0, 3.3, 3.8)], [0.17, 0.14, 0.12, 0.08], 5, shade(col, 0.85))


def saxophone(m, cx, cy, z, h=5.0, col='neon_gold', mat='glow'):
    """A saxophone shape for a sign, seen from the front (lies in the x-z plane at y = cy)."""
    k = h / 5.0
    with m.use(mat):
        P = [(cx - 0.9 * k, cy, z + 5.0 * k), (cx - 0.45 * k, cy, z + 4.75 * k), (cx - 0.25 * k, cy, z + 4.1 * k), (cx - 0.25 * k, cy, z + 1.5 * k),
             (cx - 0.1 * k, cy, z + 0.7 * k), (cx + 0.45 * k, cy, z + 0.25 * k), (cx + 1.05 * k, cy, z + 0.55 * k), (cx + 1.35 * k, cy, z + 1.4 * k),
             (cx + 1.45 * k, cy, z + 2.3 * k)]
        R = [0.08 * k, 0.1 * k, 0.16 * k, 0.3 * k, 0.36 * k, 0.4 * k, 0.42 * k, 0.5 * k, 0.78 * k]
        m.tube(P, R, 6, col)
        for zz in (3.4, 2.7, 2.0):
            m.ball(cx - 0.6 * k, cy - 0.1 * k, z + zz * k, 0.16 * k, tint(col, 0.4), n=4, rings=2)


def ring_light(m, cx, cy, z, R=2.0, r=0.32, stand=True, n=14):
    """An influencer's ring light: a glowing ring facing -y on a stand."""
    if stand:
        m.cyl(cx, cy, z, z + 2.2, 0.1, 4, 'iron', cap=False)
        m.cyl(cx, cy, z, z + 0.25, 0.7, 6, 'iron')
        zc = z + 2.2 + R
    else:
        zc = z
    with m.use('glow'):
        m.torus(cx, cy, zc, R, r, n, 5, 'lamp', axis='y')
    return zc


def capsule(m, cx, cy, cz, L=6.0, r=1.2, col_a='d_health', col_b='trim', n=10, axis='x'):
    """A two-colour pill lying along x."""
    with m.at(cx, cy, cz, rz=0.0 if axis == 'x' else math.pi / 2, ry=math.pi / 2):
        # after ry=90 deg the lathe axis (local z) points along +x
        hl = L / 2 - r
        prof, cols = [], []
        for k in range(4):
            a = -math.pi / 2 + (math.pi / 2) * k / 3
            prof.append((r * math.cos(a), -hl + r * math.sin(a)))
            cols.append(col_a)
        prof += [(r, -0.02), (r, 0.02)]
        cols += [col_a, col_b]
        for k in range(4):
            a = (math.pi / 2) * k / 3
            prof.append((r * math.cos(a), hl + r * math.sin(a)))
            cols.append(col_b)
        prof[0] = (0.0, prof[0][1])
        prof[-1] = (0.0, prof[-1][1])
        m.lathe(0, 0, prof, n, cols, cap=False)


def cross3d(m, cx, cy, cz, s=4.0, t=1.3, d=0.9, col='d_health', mat='glow', rz=0.0):
    """A chunky plus sign standing upright, facing -y."""
    with m.at(cx, cy, cz, rz):
        with m.use(mat):
            m.box(-s / 2, s / 2, -d / 2, d / 2, -t / 2, t / 2, col, bottom=True)
            m.box(-t / 2, t / 2, -d / 2 - 0.01, d / 2 + 0.01, -s / 2, s / 2, col, bottom=True)


def hoop(m, cx, cy, z, rz=0.0, h=4.6, col='trim'):
    """Basketball hoop: post, backboard, rim. The board faces -y before rz."""
    with m.at(cx, cy, z, rz):
        m.cyl(0, 0.9, 0, h + 0.4, 0.16, 5, 'iron', cap=False)
        m.beam((0, 0.9, h + 0.3), (0, 0.1, h + 0.5), 0.16, 0.16, 'iron')
        m.box(-1.3, 1.3, -0.05, 0.1, h - 0.3, h + 1.4, col, bottom=True)
        m.fq(-0.45, 0.45, h, h + 0.65, -0.07, 'd_software')
        m.fq(-0.36, 0.36, h + 0.09, h + 0.56, -0.09, col)
        m.torus(0, -0.6, h, 0.45, 0.06, 8, 3, 't_orange', axis='z')


def bollard(m, x, y, z=0.0, h=0.9, col='iron'):
    m.lathe(x, y, [(0.3, z), (0.3, z + h * 0.6), (0.4, z + h * 0.75), (0.25, z + h), (0.0, z + h + 0.05)], 6, col)


def truck(m, cx, cy, z, rz=0.0, col='d_software', load=None, L=8.0):
    """A small flatbed or box truck (cab at +x)."""
    with m.at(cx, cy, z, rz):
        m.rbox(L / 2 - 1.3, 0, 2.6, 2.7, 0.6, 3.0, col, r=0.3, seg=2, bev=0.3)
        with m.use('glass'):
            m.poly([(L / 2 + 0.01, -1.05, 1.9), (L / 2 + 0.01, 1.05, 1.9), (L / 2 + 0.01, 1.05, 2.7), (L / 2 + 0.01, -1.05, 2.7)], 'glass_b')
        m.cbox(-1.2, 0, L - 2.8, 2.7, 0.75, 1.05, 'steel_light', bottom=True)
        if load == 'box':
            m.rbox(-1.2, 0, L - 3.0, 2.7, 1.05, 3.5, 'trim', r=0.15, seg=1)
        for wx in (L / 2 - 1.4, -L / 2 + 1.6):
            for sy in (-1, 1):
                m.hcyl((wx, sy * 1.0, 0.6), (wx, sy * 1.42, 0.6), 0.6, 8, 'rubber')
        with m.use('glow'):
            for sy in (-0.85, 0.85):
                m.cbox(L / 2 + 0.02, sy, 0.06, 0.4, 1.0, 1.3, 'lamp')


def table_set(m, cx, cy, z=0.0, col='trim', seats=2, rz=0.0):
    with m.at(cx, cy, z, rz):
        m.cyl(0, 0, 0, 1.0, 0.1, 4, 'iron', cap=False)
        m.cyl(0, 0, 1.0, 1.1, 0.8, 8, col, bottom=True)
        for i in range(seats):
            a = 2 * math.pi * i / seats
            m.cyl(1.35 * math.cos(a), 1.35 * math.sin(a), 0, 0.6, 0.32, 6, 'timber')


def umbrella_table(m, cx, cy, z=0.0, col='d_games', col2='trim', r=2.2):
    table_set(m, cx, cy, z, seats=3)
    m.cyl(cx, cy, z + 0.7, z + 3.52, 0.06, 5, 'pale_metal', cap=False)
    n = 8
    for i in range(n):
        a0, a1 = 2 * math.pi * i / n, 2 * math.pi * (i + 1) / n
        tri = [(cx + r * math.cos(a0), cy + r * math.sin(a0), z + 2.7), (cx + r * math.cos(a1), cy + r * math.sin(a1), z + 2.7), (cx, cy, z + 3.5)]
        c = col if i % 2 == 0 else col2
        m.sheet(tri, c, shade(c, 0.7))


def giant_bead(m, cx, cy, cz, col, R=1.0, axis='z', n=10):
    """A fuse bead: a short fat tube."""
    with m.at(cx, cy, cz, ry=0.0 if axis == 'z' else math.pi / 2, rz=0.0 if axis != 'y' else math.pi / 2):
        h = R * 0.95
        m.lathe(0, 0, [(R * 0.5, -h / 2), (R * 0.92, -h / 2), (R, -h / 2 + 0.12 * R), (R, h / 2 - 0.12 * R), (R * 0.92, h / 2), (R * 0.5, h / 2), (R * 0.5, -h / 2)],
                n, [shade(col, 0.6), shade(col, 0.85), col, col, tint(col, 0.15), tint(col, 0.05), shade(col, 0.6)], cap=False)


def paint_pot(m, cx, cy, z, col, r=0.8, h=1.2):
    m.lathe(cx, cy, [(r, z), (r, z + h), (r * 0.9, z + h), (r * 0.9, z + h - 0.1)], 8, ['steel_light', 'metal_light', 'metal_light', col], cap=True, bottom=False)
    m.cyl(cx, cy, z + h * 0.3, z + h * 0.65, r * 1.02, 8, col, cap=False)


def fountain(m, cx, cy, z=0.0, r=3.2):
    m.lathe(cx, cy, [(r, z), (r, z + 0.7), (r - 0.4, z + 0.7), (r - 0.4, z + 0.45)], 12, ['w_stone', 'trim', 'trim', 'w_stone'], cap=False)
    with m.use('glass'):
        m.cap(ngon(r - 0.4, 12, cx, cy), z + 0.5, 'water_g')
    m.lathe(cx, cy, [(0.5, z + 0.5), (0.3, z + 1.6), (1.1, z + 1.9), (1.2, z + 2.1), (0.0, z + 2.1)], 8, 'trim')
    with m.use('glass'):
        m.lathe(cx, cy, [(0.25, z + 2.1), (0.12, z + 3.0), (0.0, z + 3.3)], 5, 'glass_c', cap=False)


def card(m, cx, cz, w, h, y, col='trim', suit='heart', suit_col='t_red', tilt=0.0):
    """A giant playing card facing -y."""
    with m.at(cx, y, cz, ry=tilt):
        m.plate(rrect2(0, 0, w, h, w * 0.14, 2), 0, 0.14, col)
        if suit == 'heart':
            m.poly([(x, -0.17, z) for x, z in heart2(0, 0.05 * h, w * 0.3)], suit_col)
        elif suit == 'star':
            m.poly([(x, -0.17, z) for x, z in star2(0, 0, w * 0.32)], suit_col)
        else:
            m.poly([(x, -0.17, z) for x, z in disc2(0, 0, w * 0.26, 4, math.pi / 2, 1.3)], suit_col)


def medicine_box(m, cx, cy, z, w=3.0, d=1.6, h=4.0, rz=0.0, col='trim', band='d_health'):
    """A giant medicine carton with a green band and cross."""
    with m.at(cx, cy, z, rz):
        m.rbox(0, 0, w, d, 0, h, col, r=0.15, seg=1, bev=0.08)
        m.box(-w / 2 - 0.02, w / 2 + 0.02, -d / 2 - 0.02, d / 2 + 0.02, h * 0.12, h * 0.34, band, top=False)
        m.poly([(x, -d / 2 - 0.03, zz) for x, zz in cross2(0, h * 0.66, w * 0.5, w * 0.17)], band)


def sound_waves(m, cx, cz, y, r=1.0, col='d_health', n=3, mat='glow'):
    """Three arcs, like a speaker symbol, facing -y."""
    with m.use(mat):
        for k in range(n):
            rr = r * (0.5 + 0.45 * k)
            pts_o = [(cx + (rr + 0.14 * r) * math.cos(a), cz + (rr + 0.14 * r) * math.sin(a)) for a in [(-0.7 + 1.4 * i / 5) for i in range(6)]]
            pts_i = [(cx + rr * math.cos(a), cz + rr * math.sin(a)) for a in [(-0.7 + 1.4 * i / 5) for i in range(6)]]
            for i in range(5):
                m.poly([(pts_i[i][0], y, pts_i[i][1]), (pts_o[i][0], y, pts_o[i][1]), (pts_o[i + 1][0], y, pts_o[i + 1][1]), (pts_i[i + 1][0], y, pts_i[i + 1][1])], col)


def check_shield(m, cx, cz, y, s=3.0, col='d_software', tick='trim', t=0.3):
    """A shield with a tick: 'checked and safe'."""
    pts = [(cx - s * 0.5, cz + s * 0.5), (cx - s * 0.5, cz - s * 0.05), (cx - s * 0.3, cz - s * 0.42), (cx, cz - s * 0.62), (cx + s * 0.3, cz - s * 0.42),
           (cx + s * 0.5, cz - s * 0.05), (cx + s * 0.5, cz + s * 0.5), (cx, cz + s * 0.6)]
    m.plate(grow2(pts, 1.12), y, t * 0.6, 'trim')
    m.plate(pts, y - t * 0.6, t * 0.4, col)
    yy = y - t - 0.04
    w = s * 0.1
    a, b, c = (cx - s * 0.26, cz + s * 0.02), (cx - s * 0.06, cz - s * 0.2), (cx + s * 0.28, cz + s * 0.26)
    with m.use('glow'):
        m.poly([(a[0], yy, a[1]), (b[0], yy, b[1] - w * 0.2), (b[0], yy, b[1] + w * 1.5), (a[0] + w * 0.9, yy, a[1] + w * 0.9)][::-1], tick)
        m.poly([(b[0], yy, b[1] - w * 0.2), (c[0] + w * 0.6, yy, c[1] - w * 0.2), (c[0] - w * 0.3, yy, c[1] + w * 0.9), (b[0], yy, b[1] + w * 1.5)], tick)


def pulse_line(m, cx, cz, y, w=4.0, h=1.6, col='trim', t=0.18, mat='glow'):
    """A heartbeat line (flat, facing -y)."""
    P = [(-0.5, 0), (-0.22, 0), (-0.12, 0.5), (0.0, -0.5), (0.12, 0.25), (0.2, 0), (0.5, 0)]
    with m.use(mat):
        for i in range(len(P) - 1):
            (xa, za), (xb, zb) = P[i], P[i + 1]
            ax, az, bx, bz = cx + xa * w, cz + za * h, cx + xb * w, cz + zb * h
            dx, dz = bx - ax, bz - az
            L = math.hypot(dx, dz)
            nx, nz = -dz / L * t / 2, dx / L * t / 2
            m.poly([(ax - nx, y, az - nz), (bx - nx, y, bz - nz), (bx + nx, y, bz + nz), (ax + nx, y, az + nz)][::-1], col)


def page_icon(m, cx, cz, y, w=2.0, h=2.6, col='paper', line='pane_light', mat='city'):
    """A sheet of paper with lines (a resume)."""
    m.plate([(cx - w / 2, cz - h / 2), (cx + w / 2, cz - h / 2), (cx + w / 2, cz + h / 2 - w * 0.25), (cx + w / 2 - w * 0.25, cz + h / 2), (cx - w / 2, cz + h / 2)], y, 0.15, col)
    for k in range(4):
        zz = cz + h * 0.22 - k * h * 0.17
        m.fq(cx - w * 0.33, cx + (w * 0.33 if k % 2 == 0 else w * 0.12), zz, zz + h * 0.06, y - 0.18, line)


def tiny_person(m, x, y, z=0.0, col='t_blue', rz=0.0):
    m.person(x, y, z, col, 1.0, rz)


def glass_rail(m, x0, x1, y, z, h=1.0, axis='x'):
    """Glass balustrade with a thin top rail (two-sided)."""
    with m.use('glass'):
        if axis == 'x':
            q = [(x0, y, z), (x1, y, z), (x1, y, z + h), (x0, y, z + h)]
        else:
            q = [(y, x1, z), (y, x0, z), (y, x0, z + h), (y, x1, z + h)]
        m.sheet(q, 'glass_c')
    if axis == 'x':
        m.beam((x0, y, z + h), (x1, y, z + h), 0.1, 0.08, 'trim')
    else:
        m.beam((y, x0, z + h), (y, x1, z + h), 0.1, 0.08, 'trim')


def silo(m, cx, cy, z, r=1.8, h=8.0, col='trim', band=None):
    m.lathe(cx, cy, [(r, z), (r, z + h), (r * 0.6, z + h + r * 0.5), (0.0, z + h + r * 0.62)], 10,
            [shade(col, 0.9), col, tint(col, 0.1), tint(col, 0.1)], cap=False)
    if band:
        m.cyl(cx, cy, z + h * 0.55, z + h * 0.72, r * 1.02, 10, band, cap=False)
    for a in (0.6, 2.7, 4.8):
        m.cbox(cx + r * 0.8 * math.cos(a), cy + r * 0.8 * math.sin(a), 0.25, 0.25, z - 0.01, z + 0.02, 'iron')


def quay_crane(m, cx, cy, z, s=1.0, col='d_software', rz=0.0, boom=24.0):
    """A ship-to-shore quay crane. The boom reaches out over +y (towards the water)."""
    with m.at(cx, cy, z, rz, s=s):
        H, w, d = 17.0, 8.0, 9.0
        for sx in (-1, 1):
            for sy in (-1, 1):
                m.cbox(sx * w / 2, sy * d / 2, 0.8, 0.8, 0, H, col, top=False)
                m.cbox(sx * w / 2, sy * d / 2, 1.6, 2.2, 0, 0.7, 'iron')
            m.beam((sx * w / 2, -d / 2, H * 0.45), (sx * w / 2, d / 2, H * 0.45), 0.6, 0.6, col)
            m.beam((sx * w / 2, -d / 2, H * 0.45), (sx * w / 2, d / 2, H), 0.4, 0.4, tint(col, 0.15))
            m.beam((sx * w / 2, -d / 2 - 7, H + 0.5), (sx * w / 2, d / 2 + boom, H + 0.5), 0.7, 1.1, col)
        for sy in (-1, 1):
            m.beam((-w / 2, sy * d / 2, H), (w / 2, sy * d / 2, H), 0.7, 0.7, col)
        m.beam((-w / 2, -d / 2, H * 0.45), (w / 2, -d / 2, H * 0.45), 0.5, 0.5, col)
        # A-frame and stays
        top = (0, 0.5, H + 9)
        for sx in (-1, 1):
            m.beam((sx * w / 2, -d / 2, H + 1), top, 0.5, 0.5, col)
            m.beam((sx * w / 2, d / 2, H + 1), top, 0.5, 0.5, col)
            m.beam(top, (sx * w / 2, d / 2 + boom * 0.85, H + 1.1), 0.16, 0.16, 'iron')
            m.beam(top, (sx * w / 2, -d / 2 - 6.5, H + 1.1), 0.16, 0.16, 'iron')
        for yy in (d / 2 + boom, d / 2 + boom * 0.5, -d / 2 - 7):
            m.beam((-w / 2, yy, H + 0.5), (w / 2, yy, H + 0.5), 0.5, 0.5, col)
        m.cbox(0, -d / 2 - 4.5, w - 1.5, 4.0, H + 1.1, H + 4.0, 'trim', bottom=True)                # machinery house
        # trolley, cab and a container on the hook
        ty = d / 2 + boom * 0.55
        m.cbox(0, ty, w - 1.2, 2.4, H - 0.5, H + 0.3, 'iron', bottom=True)
        m.rbox(1.6, ty - 2.2, 2.0, 2.2, H - 2.9, H - 0.6, 'trim', r=0.2, seg=1, bottom=True)
        with m.use('glass'):
            m.box(0.7, 2.5, ty - 3.33, ty - 3.3, H - 2.6, H - 1.3, 'glass_b', top=False)
        for sx in (-1.2, 1.2):
            m.beam((sx, ty, H - 0.5), (sx, ty, H - 7.5), 0.07, 0.07, 'iron')
        m.cbox(0, ty, 3.4, 6.6, H - 7.9, H - 7.5, 'hazard', bottom=True)
