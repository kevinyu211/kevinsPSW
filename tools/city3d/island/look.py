"""Beauty renders for the audit: every model looked at from two sides and up close by its entrance.

    python3 look.py <model> [<model> ...]          three pictures per model: previews/look-<model>-{a,b,c}.png
    python3 look.py lineup <id> [<id> ...]         L3, L4 and L5 of a project side by side: previews/lineup-<id>.png
    python3 look.py tower                          the tower gets its own set of five

a = front three-quarter from above, b = back three-quarter, c = eye level at the entrance (1.7 m, a few metres out).
Runs the renders in parallel (four at a time). Reads out/*.json, so run build.sh first.
"""
import json, os, subprocess, sys, math
HERE = os.path.dirname(os.path.abspath(__file__))
BL = os.environ.get('BLENDER', '/Applications/Blender.app/Contents/MacOS/Blender')
rows = {}
for key, f in (('b', 'buildings'), ('p', 'props')):
    p = os.path.join(HERE, 'out', f + '.json')
    if os.path.exists(p):
        for r in json.load(open(p)):
            rows[r['name']] = (key, r)
GRASS = 'gcol=0.30,0.44,0.20'


def job(out, az, el, fill, *extra):
    return [BL, '-b', '--factory-startup', '--python', os.path.join(HERE, 'preview_scene.py'), '--', out, str(az), str(el), str(fill), 'beauty=1', *extra]


def jobs_for(name):
    key, r = rows[name]
    sx, sy, sz = r['size']
    mn, mx = r['min'], r['max']
    cx, cz = (mn[0] + mx[0]) / 2, (mn[2] + mx[2]) / 2
    item = f'{key}:{name}'
    big = max(sx, sz, sy)
    out = []
    look = f'look={cx:.1f},{min(sy * 0.35, 12):.1f},{cz:.1f}'
    out.append(job(f'look-{name}-a.png', 28, 22, 1.25, GRASS, 'res=1500x950', look, item))
    out.append(job(f'look-{name}-b.png', 205, 20, 1.25, GRASS, 'res=1500x950', look, item))
    door = r.get('door')
    if door:
        dx, dz = door
        # aim at the building's front, a third of the way in from the street
        tz = dz - min(10.0, sz * 0.32)
        out.append(job(f'look-{name}-c.png', 14, 6, 1, GRASS, 'res=1500x950', 'lens=26', f'dist={min(19.0, max(9.0, big * 0.33)):.1f}', f'look={dx:.1f},3.2,{tz:.1f}', item))
    else:
        out.append(job(f'look-{name}-c.png', 60, 8, 1.6, GRASS, 'res=1500x950', item))
    return out


def lineup(pid):
    names = [f'b_{pid}_L{L}' for L in (3, 4, 5)]
    xs, x = [], 0.0
    items = []
    for n in names:
        key, r = rows[n]
        w = r['size'][0]
        x += w / 2
        items.append(f'{key}:{n}@{x - r["min"][0] - w / 2:.1f},0,0')
        x += w / 2 + 4
    tot = x - 4
    items = [it.replace('@', '@') for it in items]
    shift = tot / 2
    items2 = []
    for it in items:
        h, p = it.split('@')
        px, py, pz = [float(v) for v in p.split(',')]
        items2.append(f'{h}@{px - shift:.1f},{py},{pz}')
    return [job(f'lineup-{pid}.png', 18, 24, 1.75, GRASS, 'res=2200x900', *items2)]


def run(js):
    procs = []
    for j in js:
        procs.append(subprocess.Popen(j, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True))
        if len(procs) >= 4:
            p = procs.pop(0); o = p.communicate()[0]; report(o)
    for p in procs:
        report(p.communicate()[0])


def report(o):
    for line in o.splitlines():
        if 'error' in line.lower() or 'traceback' in line.lower() or line.startswith('wrote'):
            print(line.replace(HERE + '/', ''))


if __name__ == '__main__':
    a = sys.argv[1:]
    js = []
    if a and a[0] == 'row':                    # python3 look.py row <out-name> <model> <model> ...: props side by side
        out, names = a[1], a[2:]
        x, items = 0.0, []
        for n in names:
            key, r = rows[n]
            w = r['size'][0]
            items.append((key, n, x - r['min'][0], r))
            x += w + max(1.5, w * 0.25)
        tot = x
        its = [f'{k}:{n}@{px - tot / 2:.2f},{max(0.0, -r["min"][1]):.2f},0' for k, n, px, r in items]
        hmax = max(r['size'][1] for _, _, _, r in items)
        js = [job(f'row-{out}.png', 20, 14, 2.0, 'gcol=0.62,0.60,0.55', 'res=2200x900', f'look=0,{hmax * 0.4:.2f},0', *its),
              job(f'row-{out}-close.png', 30, 8, 3.2, 'gcol=0.62,0.60,0.55', 'res=2200x900', f'look=0,{hmax * 0.4:.2f},0', *its)]
    elif a and a[0] == 'lineup':
        for pid in a[1:]:
            js += lineup(pid)
    elif a == ['tower']:
        T = 'b:tower'
        js = [job('look-tower-a.png', 15, 6, 1, GRASS, 'res=900x1500', 'dist=330', 'look=0,95,0', 'lens=50', T),
              job('look-tower-b.png', 200, 14, 1, GRASS, 'res=900x1500', 'dist=330', 'look=0,95,0', 'lens=50', T),
              job('look-tower-c.png', 8, 4, 1, GRASS, 'res=1500x950', 'dist=34', 'look=0,6,18', 'lens=26', T),
              job('look-tower-d.png', 35, 22, 1, GRASS, 'res=1500x950', 'dist=95', 'look=0,14,0', 'lens=32', T),
              job('look-tower-e.png', 30, 8, 1, GRASS, 'res=1500x950', 'dist=40', 'look=0,152,0', 'lens=40', T)]
    else:
        for n in a:
            js += jobs_for(n)
    run(js)
