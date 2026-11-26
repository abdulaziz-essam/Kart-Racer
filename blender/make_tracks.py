"""Build the 4 Grand Prix tracks in Blender (run in background Blender).

For each track: a smooth closed racing line through hand-placed corners,
checked for tight corners and self-crossing, then
  - a light preview in grand_prix_tracks.blend (road ribbon + start marker)
  - src/tracks/<id>.json with the racing line resampled every 5 m
    (three.js coords: x = blender x, z = -blender y)
The browser builds road, kerbs, terrain and props from that line.
"""
import bpy, bmesh, json, math, os, sys

PROJECT = sys.argv[sys.argv.index('--') + 1]
OUT_JSON = os.path.join(PROJECT, 'src', 'tracks')
OUT_BLEND = os.path.join(PROJECT, 'blender', 'grand_prix_tracks.blend')
os.makedirs(OUT_JSON, exist_ok=True)

ROAD_HALF = 6.5
MIN_RADIUS = 17.0   # tighter than this is not fun at 13 m wide
STEP = 5.0

# existing circuit from the original F1 Blender layout (scaled to a ~1 km kart lap)
with open(os.path.join(PROJECT, 'src', 'trackPath.json')) as f:
    meadow = [(x * 0.9, -z * 0.9) for x, z in json.load(f)['points']]  # back to blender x, y

TRACKS = [
    dict(id='sunny-meadow', name='Sunny Meadow', theme='meadow', dense=meadow),
    dict(id='lakeside-loop', name='Lakeside Loop', theme='lake', scale=0.64, ctrl=[
        (0, 0), (220, -30), (370, 10), (430, 130), (370, 240), (230, 250), (140, 180),
        (40, 220), (-80, 300), (-230, 260), (-300, 140), (-250, 30), (-130, -20)]),
    dict(id='twisty-hills', name='Twisty Hills', theme='hills', scale=0.64, ctrl=[
        (0, 0), (170, -10), (285, 55), (255, 165), (330, 255), (275, 365), (120, 370),
        (40, 270), (-80, 300), (-215, 260), (-300, 150), (-245, 40), (-125, 35)]),
    dict(id='canyon-sprint', name='Canyon Sprint', theme='canyon', scale=0.55, ctrl=[
        (-320, 0), (-60, -70), (230, -50), (420, 60), (440, 200), (320, 290), (170, 250),
        (80, 170), (-30, 230), (-200, 300), (-380, 250), (-450, 120)]),
]


def catmull_rom(ctrl, samples=24):
    """Closed centripetal Catmull-Rom spline through the control points."""
    n = len(ctrl); out = []
    for i in range(n):
        p0, p1, p2, p3 = ctrl[i - 1], ctrl[i], ctrl[(i + 1) % n], ctrl[(i + 2) % n]
        def tj(ti, a, b): return ti + math.dist(a, b) ** 0.5
        t0 = 0; t1 = tj(t0, p0, p1); t2 = tj(t1, p1, p2); t3 = tj(t2, p2, p3)
        for k in range(samples):
            t = t1 + (t2 - t1) * k / samples
            def lerp(a, b, ta, tb):
                w = (t - ta) / (tb - ta) if tb != ta else 0
                return (a[0] + (b[0] - a[0]) * w, a[1] + (b[1] - a[1]) * w)
            A1 = lerp(p0, p1, t0, t1); A2 = lerp(p1, p2, t1, t2); A3 = lerp(p2, p3, t2, t3)
            B1 = lerp(A1, A2, t0, t2); B2 = lerp(A2, A3, t1, t3)
            out.append(lerp(B1, B2, t1, t2))
    return out


def resample(pts, step):
    """Evenly spaced points along a closed polyline."""
    loop = pts + [pts[0]]
    seg = [math.dist(loop[i], loop[i + 1]) for i in range(len(pts))]
    total = sum(seg); n = max(8, round(total / step)); step = total / n
    out, i, acc = [], 0, 0.0
    for k in range(n):
        s = k * step
        while acc + seg[i] < s: acc += seg[i]; i += 1
        w = (s - acc) / seg[i] if seg[i] else 0
        a, b = loop[i], loop[i + 1]
        out.append((a[0] + (b[0] - a[0]) * w, a[1] + (b[1] - a[1]) * w))
    return out, total


def min_radius(pts):
    n = len(pts); worst = 1e9
    for i in range(n):
        a, b, c = pts[i - 2], pts[i], pts[(i + 2) % n]
        ab, bc, ca = math.dist(a, b), math.dist(b, c), math.dist(c, a)
        area2 = abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]))
        if area2 > 1e-6: worst = min(worst, ab * bc * ca / (2 * area2))
    return worst


def crosses(pts, clearance):
    """True if the road (centre line +- clearance) would overlap itself."""
    n = len(pts)
    for i in range(0, n, 2):
        for j in range(i + 12, n - 12 + i if i < 12 else n, 2):
            if math.dist(pts[i], pts[j]) < clearance:
                # far apart along the lap but close in space -> overlap
                gap = min(abs(i - j), n - abs(i - j)) * STEP
                if gap > clearance * 4: return True
    return False


def straightest_start(pts):
    """Start line at the middle of the straightest 120 m."""
    n = len(pts); win = int(120 / STEP); best, bi = 1e9, 0
    for i in range(n):
        turn = 0
        for k in range(win):
            a, b, c = pts[(i + k - 1) % n], pts[(i + k) % n], pts[(i + k + 1) % n]
            h1 = math.atan2(b[1] - a[1], b[0] - a[0]); h2 = math.atan2(c[1] - b[1], c[0] - b[0])
            turn += abs(math.atan2(math.sin(h2 - h1), math.cos(h2 - h1)))
        if turn < best: best, bi = turn, i
    return (bi + win // 2) % n


# ---------------- build ----------------
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
road_mat = bpy.data.materials.new('Road'); road_mat.diffuse_color = (0.12, 0.12, 0.15, 1)
kerb_mat = bpy.data.materials.new('Kerb'); kerb_mat.diffuse_color = (0.9, 0.1, 0.08, 1)
start_mat = bpy.data.materials.new('StartLine'); start_mat.diffuse_color = (1, 1, 1, 1)
grass_mat = bpy.data.materials.new('Grass'); grass_mat.diffuse_color = (0.25, 0.55, 0.2, 1)
for m, c in ((road_mat, (0.12, 0.12, 0.15)), (kerb_mat, (0.9, 0.1, 0.08)), (start_mat, (1, 1, 1)), (grass_mat, (0.25, 0.55, 0.2))):
    if not m.use_nodes: m.use_nodes = True
    b = next(nd for nd in m.node_tree.nodes if nd.type == 'BSDF_PRINCIPLED')
    b.inputs['Base Color'].default_value = (*c, 1)

summary = []
for ti, t in enumerate(TRACKS):
    k = t.get('scale', 1.0)  # shrink the hand-placed layout to a ~1-1.2 km lap
    dense = t['dense'] if 'dense' in t else catmull_rom([(x * k, y * k) for x, y in t['ctrl']])
    pts, length = resample(dense, STEP)
    radius = min_radius(pts)
    overlap = crosses(pts, ROAD_HALF * 2 + 12)
    start = straightest_start(pts)
    pts = pts[start:] + pts[:start]  # point 0 = start/finish line

    # make the race direction counter-clockwise for every track (consistent left/right)
    area = sum(pts[i][0] * pts[(i + 1) % len(pts)][1] - pts[(i + 1) % len(pts)][0] * pts[i][1] for i in range(len(pts)))
    if t['id'] != 'sunny-meadow' and area < 0:
        pts = [pts[0]] + pts[:0:-1]

    # ---- Blender preview: grass pad, road ribbon, kerbs, start line ----
    col = bpy.data.collections.new(t['name']); scene.collection.children.link(col)
    off = (ti % 2) * 700, -(ti // 2) * 600
    bm = bmesh.new(); kb = bmesh.new()
    n = len(pts)
    def side(i, d):
        a, b = pts[i - 1], pts[(i + 1) % n]
        dx, dy = b[0] - a[0], b[1] - a[1]; L = math.hypot(dx, dy)
        nx, ny = -dy / L, dx / L
        return (pts[i][0] + nx * d + off[0], pts[i][1] + ny * d + off[1])
    left = [bm.verts.new((*side(i, ROAD_HALF), 0.02)) for i in range(n)]
    right = [bm.verts.new((*side(i, -ROAD_HALF), 0.02)) for i in range(n)]
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((right[i], right[j], left[j], left[i]))
    for d0, d1 in ((ROAD_HALF, ROAD_HALF + 1.4), (-ROAD_HALF - 1.4, -ROAD_HALF)):
        a = [kb.verts.new((*side(i, d0), 0.05)) for i in range(n)]
        c = [kb.verts.new((*side(i, d1), 0.05)) for i in range(n)]
        for i in range(n):
            j = (i + 1) % n
            kb.faces.new((c[i], c[j], a[j], a[i]))
    for name, b_, mat in ((t['id'] + '_road', bm, road_mat), (t['id'] + '_kerbs', kb, kerb_mat)):
        me = bpy.data.meshes.new(name); b_.to_mesh(me); b_.free(); me.materials.append(mat)
        ob = bpy.data.objects.new(name, me); col.objects.link(ob)
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
    bpy.ops.mesh.primitive_plane_add(size=1, location=((min(xs) + max(xs)) / 2 + off[0], (min(ys) + max(ys)) / 2 + off[1], 0))
    pad = bpy.context.active_object; pad.name = t['id'] + '_ground'
    pad.scale = (max(xs) - min(xs) + 160, max(ys) - min(ys) + 160, 1); pad.data.materials.append(grass_mat)
    for c in pad.users_collection: c.objects.unlink(pad)
    col.objects.link(pad)
    a, b = side(0, ROAD_HALF), side(0, -ROAD_HALF)
    bpy.ops.mesh.primitive_cube_add(size=1, location=((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 0.05))
    sl = bpy.context.active_object; sl.name = t['id'] + '_startline'
    sl.scale = (2.0, ROAD_HALF * 2, 0.06)
    sl.rotation_euler.z = math.atan2(pts[1][1] - pts[0][1], pts[1][0] - pts[0][0])
    sl.data.materials.append(start_mat)
    for c in sl.users_collection: c.objects.unlink(sl)
    col.objects.link(sl)
    # the racing line as a curve object, so it can be edited in Blender later
    cu = bpy.data.curves.new(t['id'] + '_line', 'CURVE'); cu.dimensions = '3D'
    sp = cu.splines.new('POLY'); sp.points.add(n - 1); sp.use_cyclic_u = True
    for i, p in enumerate(pts): sp.points[i].co = (p[0] + off[0], p[1] + off[1], 0.1, 1)
    col.objects.link(bpy.data.objects.new(t['id'] + '_racing_line', cu))

    # ---- light JSON for the browser ----
    data = {
        'id': t['id'], 'name': t['name'], 'theme': t['theme'], 'width': ROAD_HALF * 2,
        'length': round(length, 1), 'startS': 0,
        'points': [[round(p[0], 2), round(-p[1], 2)] for p in pts],
    }
    path = os.path.join(OUT_JSON, t['id'] + '.json')
    with open(path, 'w') as f: json.dump(data, f, separators=(',', ':'))
    summary.append(f"{t['name']:<14} {length:7.0f} m  min radius {radius:5.1f} m  overlap={overlap}  {os.path.getsize(path)//1024} KB")

bpy.ops.wm.save_as_mainfile(filepath=OUT_BLEND)
print('\n'.join(summary))
print('saved', OUT_BLEND)
