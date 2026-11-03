import bpy, math, sys, os, bmesh, json
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

OUT = sys.argv[sys.argv.index('--') + 1]
ONLY = set(sys.argv[sys.argv.index('--') + 2:])
FONT = os.path.join(os.path.dirname(os.path.abspath(OUT.rstrip('/'))), 'rubik800.ttf')
RES = 440
META = {}

def reset(res=RES):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = 110; sc.cycles.use_denoising = True
    sc.render.film_transparent = True
    sc.render.resolution_x = sc.render.resolution_y = res
    sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_mode = 'RGBA'
    sc.view_settings.view_transform = 'Standard'; sc.view_settings.look = 'None'
    w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True
    bg = w.node_tree.nodes['Background']; bg.inputs[0].default_value = (0.8, 0.9, 1.0, 1); bg.inputs[1].default_value = 0.55
    return sc

def mat(name, color, rough=0.45, **kw):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*color, 1); b.inputs['Roughness'].default_value = rough
    for k, v in kw.items():
        if k in b.inputs: b.inputs[k].default_value = v
    return m

def bubble_mat(color):
    m = mat('bub', color, 0.05, **{'Alpha': 0.4, 'Coat Weight': 1.0, 'Coat Roughness': 0.02, 'Specular IOR Level': 1.0, 'IOR': 1.15})
    nt = m.node_tree; b = nt.nodes['Principled BSDF']
    fr = nt.nodes.new('ShaderNodeLayerWeight'); fr.inputs['Blend'].default_value = 0.4
    mul = nt.nodes.new('ShaderNodeMath'); mul.operation = 'MULTIPLY_ADD'; mul.inputs[1].default_value = 0.7; mul.inputs[2].default_value = 0.1
    nt.links.new(fr.outputs['Fresnel'], mul.inputs[0]); nt.links.new(mul.outputs[0], b.inputs['Alpha'])
    b.inputs['Emission Color'].default_value = (*color, 1); b.inputs['Emission Strength'].default_value = 0.25
    return m

def smooth(o):
    if o.type == 'MESH':
        for p in o.data.polygons: p.use_smooth = True
    return o
def bevel(o, w, seg=4):
    b = o.modifiers.new('b', 'BEVEL'); b.width = w; b.segments = seg; return o

def sphere(loc, r, m, scale=(1, 1, 1), seg=64):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, location=loc, segments=seg, ring_count=seg // 2)
    o = bpy.context.active_object; o.scale = scale; o.data.materials.append(m); return smooth(o)
def box(loc, size, m, rot=(0, 0, 0), r=0.12):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.active_object; o.scale = size; o.data.materials.append(m)
    b = o.modifiers.new('b', 'BEVEL'); b.width = r; b.segments = 6; b.limit_method = 'NONE'
    return smooth(o)
def cone(loc, r1, depth, m, rot=(0, 0, 0), r2=0.03):
    bpy.ops.mesh.primitive_cone_add(radius1=r1, radius2=r2, depth=depth, location=loc, rotation=rot, vertices=48)
    o = bpy.context.active_object; o.data.materials.append(m); smooth(o)
    s = o.modifiers.new('s', 'SUBSURF'); s.levels = 2; return o
def cyl(loc, r, depth, m, rot=(0, 0, 0), bw=0.18):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=depth, location=loc, rotation=rot, vertices=64)
    o = bpy.context.active_object; o.data.materials.append(m); bevel(o, r * bw, 5); return smooth(o)
def torus(loc, R, r, m, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=r, location=loc, rotation=rot, major_segments=48, minor_segments=20)
    o = bpy.context.active_object; o.data.materials.append(m); return smooth(o)

def camera(sc, target=(0, 0, 0), dist=9, elev=1.2, lens=60):
    bpy.ops.object.camera_add(location=(0, -dist, elev))
    cam = bpy.context.active_object; cam.data.lens = lens; sc.camera = cam
    t = bpy.data.objects.new('t', None); t.location = target; sc.collection.objects.link(t)
    c = cam.constraints.new('TRACK_TO'); c.target = t; c.track_axis = 'TRACK_NEGATIVE_Z'; c.up_axis = 'UP_Y'
    return cam

def lights(energy=900):
    def area(loc, e, size, color=(1, 1, 1)):
        bpy.ops.object.light_add(type='AREA', location=loc)
        l = bpy.context.active_object; l.data.energy = e; l.data.size = size; l.data.color = color
        c = l.constraints.new('TRACK_TO'); c.target = bpy.data.objects['t']; c.track_axis = 'TRACK_NEGATIVE_Z'; c.up_axis = 'UP_Y'
    area((4, -6, 7), energy, 6); area((-6, -4, 2), energy * 0.35, 6, (0.8, 0.88, 1)); area((0, 5, 5), energy * 0.5, 6, (1, 0.95, 0.9))

def render(sc, name):
    sc.render.filepath = os.path.join(OUT, name + '.png'); bpy.ops.render.render(write_still=True); print('rendered', name, flush=True)

def want(name):
    return not ONLY or name in ONLY

def scene(name, build, target=(0, 0, 0), dist=9, elev=1.2, lens=60, energy=900):
    if not want(name): return
    sc = reset(); build(sc); camera(sc, target, dist, elev, lens); lights(energy); render(sc, name)

C = lambda r, g, b: (r, g, b)
PURPLE, BELLY, WHITE, INK, GOLD, CORAL = (0.52, 0.28, 1.0), (0.85, 0.75, 1.0), (1, 1, 1), (0.08, 0.1, 0.22), (1.0, 0.8, 0.25), (1.0, 0.2, 0.14)

# ---------- bubbles ----------
for n, c in (('bubble_blue', (0.12, 0.55, 1.0)), ('bubble_pink', (1.0, 0.3, 0.62)), ('bubble_green', (0.35, 0.85, 0.2))):
    scene(n, lambda sc, c=c: sphere((0, 0, 0), 1, bubble_mat(c), seg=96), dist=7)

# ---------- cannon: a base and a separate barrel, same camera, so the barrel can turn ----------
def cannon_base(sc):
    coral = mat('coral', CORAL, 0.28, **{'Coat Weight': 0.5}); ink = mat('ink', INK, 0.25, **{'Metallic': 0.35})
    sphere((0, 0, -0.1), 1.05, coral, (1.25, 0.9, 0.7)); sphere((-1.1, -0.4, -0.55), 0.4, ink, (1, 0.45, 1)); sphere((1.1, -0.4, -0.55), 0.4, ink, (1, 0.45, 1))
def cannon_barrel(sc):
    ink = mat('ink', INK, 0.25, **{'Metallic': 0.35}); gold = mat('gold', GOLD, 0.3)
    cyl((0, 0, 1.35), 0.42, 1.5, ink); cyl((0, 0, 2.15), 0.52, 0.22, gold)
    bpy.ops.object.empty_add(location=(0, 0, 0.6)); bpy.context.active_object.name = 'pivot'
cam_args = dict(target=(0, 0, 0.9), dist=6.2, elev=0.4, lens=55)
scene('cannon_base', cannon_base, **cam_args, energy=800)
scene('cannon_barrel', cannon_barrel, **cam_args, energy=800)
if want('cannon_base') or want('cannon_barrel'):
    sc = reset(); camera(sc, **cam_args)
    p = world_to_camera_view(sc, bpy.data.objects['Camera'], Vector((0, 0, 0.6)))
    META['cannon_pivot'] = [round(p.x, 4), round(1 - p.y, 4)]

# ---------- monster ----------
def monster(mood):
    def build(sc):
        purple = mat('purple', PURPLE, 0.5, **{'Subsurface Weight': 0.25}); belly = mat('belly', BELLY, 0.55)
        white = mat('white', WHITE, 0.15, **{'Coat Weight': 1.0}); ink = mat('ink', INK, 0.2); horn = mat('horn', (1.0, 0.82, 0.3), 0.35)
        sphere((0, 0, 0), 1.5, purple, (1.0, 0.92, 1.08)); sphere((0, -0.75, -0.8), 1.0, belly, (0.9, 0.55, 0.7))
        cone((-0.8, 0.05, 1.6), 0.32, 0.8, horn, (0, math.radians(-18), 0)); cone((0.8, 0.05, 1.6), 0.32, 0.8, horn, (0, math.radians(18), 0))
        sphere((-1.5, -0.2, -0.1), 0.42, purple); sphere((1.5, -0.2, -0.1), 0.42, purple)
        sphere((-0.7, -0.5, -1.35), 0.5, purple, (1.1, 1.2, 0.7)); sphere((0.7, -0.5, -1.35), 0.5, purple, (1.1, 1.2, 0.7))
        for x in (-0.55, 0.55):
            sphere((x, -1.05, 0.55), 0.44, white, (1, 0.7, 1.05)); sphere((x, -1.38, 0.52), 0.2, ink, (1, 0.5, 1)); sphere((x + 0.06, -1.55, 0.62), 0.06, white, (1, 0.4, 1))
        if mood == 'happy':
            bpy.ops.mesh.primitive_torus_add(major_radius=0.5, minor_radius=0.095, major_segments=64, minor_segments=20)
            t = bpy.context.active_object; bm = bmesh.new(); bm.from_mesh(t.data)
            bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.y > 0.02], context='VERTS'); bm.to_mesh(t.data); bm.free()
            t.data.materials.append(ink); smooth(t); t.rotation_euler = (math.radians(90), 0, 0); t.location = (0, -1.36, 0.02)
            for x in (-0.5, 0.5): sphere((x, -1.36, 0.02), 0.095, ink)
        elif mood == 'oh':
            sphere((0, -1.34, -0.2), 0.27, ink, (1, 0.45, 1.25))
        else:  # sad: a frown, for "try again"
            bpy.ops.mesh.primitive_torus_add(major_radius=0.42, minor_radius=0.09, major_segments=64, minor_segments=20)
            t = bpy.context.active_object; bm = bmesh.new(); bm.from_mesh(t.data)
            bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.y < -0.02], context='VERTS'); bm.to_mesh(t.data); bm.free()
            t.data.materials.append(ink); smooth(t); t.rotation_euler = (math.radians(90), 0, 0); t.location = (0, -1.36, -0.22)
            for x in (-0.42, 0.42): sphere((x, -1.36, -0.22), 0.09, ink)
    return build
for mood in ('happy', 'oh', 'sad'):
    scene('monster_' + mood, monster(mood), target=(0, 0, 0.1), dist=11, elev=1.8, energy=1100)

# ---------- dragon (the boss) ----------
def dragon(sc):
    green = mat('green', (0.18, 0.78, 0.35), 0.45, **{'Subsurface Weight': 0.2}); belly = mat('b', (0.98, 0.9, 0.45), 0.5)
    ink = mat('ink', INK, 0.2); white = mat('w', WHITE, 0.15, **{'Coat Weight': 1.0}); horn = mat('h', (1.0, 0.72, 0.2), 0.35); red = mat('r', (1.0, 0.3, 0.2), 0.4)
    sphere((0, 0, 0), 1.45, green, (1.05, 0.95, 1.0)); sphere((0, -0.9, -0.35), 1.0, belly, (0.85, 0.5, 0.95))
    sphere((0, -1.15, 0.45), 0.8, green, (1.1, 0.8, 0.7))  # snout
    for x in (-0.28, 0.28): sphere((x, -1.8, 0.45), 0.09, ink, (1, 0.6, 1))
    for x in (-0.55, 0.55):
        sphere((x, -0.8, 1.0), 0.4, white, (1, 0.7, 1.05)); sphere((x, -1.12, 1.0), 0.19, ink, (1, 0.5, 1)); sphere((x + 0.06, -1.28, 1.08), 0.06, white, (1, 0.4, 1))
    cone((-0.7, 0, 1.55), 0.26, 0.8, horn, (0, math.radians(-22), 0)); cone((0.7, 0, 1.55), 0.26, 0.8, horn, (0, math.radians(22), 0))
    for i, z in enumerate((1.3, 0.7, 0.1, -0.5)):
        cone((0, 1.35, z), 0.3 - i * 0.03, 0.55, red, (math.radians(-90), 0, 0))
    wing = lambda sx: [cone((sx * 1.55, 0.35, 0.35), 0.75, 1.3, red, (0, math.radians(sx * 70), math.radians(sx * -15)), r2=0.05)]
    wing(-1); wing(1)
    sphere((-1.45, -0.35, -0.2), 0.4, green); sphere((1.45, -0.35, -0.2), 0.4, green)
    sphere((-0.75, -0.55, -1.3), 0.5, green, (1.1, 1.2, 0.7)); sphere((0.75, -0.55, -1.3), 0.5, green, (1.1, 1.2, 0.7))
    bpy.ops.mesh.primitive_torus_add(major_radius=0.34, minor_radius=0.07, major_segments=48, minor_segments=16)
    t = bpy.context.active_object; bm = bmesh.new(); bm.from_mesh(t.data)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.y > 0.02], context='VERTS'); bm.to_mesh(t.data); bm.free()
    t.data.materials.append(ink); smooth(t); t.rotation_euler = (math.radians(90), 0, 0); t.location = (0, -1.72, 0.05)
scene('dragon', dragon, target=(0, 0, 0.1), dist=12, elev=1.8, energy=1100)

# ---------- icons ----------
def blocks(sc):
    cols = [(1.0, 0.45, 0.35), (0.25, 0.6, 1.0), (0.4, 0.85, 0.35)]
    letters = ['ג', 'ב', 'א']  # x grows to the right on screen, so reading right to left gives א ב ג
    ink = mat('ink', (0.1, 0.12, 0.25), 0.3); white = mat('wh', (1, 1, 1), 0.3)
    for i, (c, ch) in enumerate(zip(cols, letters)):
        x = (i - 1) * 1.55; z = 0.1 * (i == 1)
        box((x, 0, z), (1.35, 1.35, 1.35), mat(f'bl{i}', c, 0.35, **{'Coat Weight': 0.4}), (0, 0, math.radians((i - 1) * 6)), 0.16)
        cu = bpy.data.curves.new('t' + str(i), 'FONT'); cu.body = ch; cu.size = 1.0; cu.extrude = 0.05; cu.bevel_depth = 0.02
        cu.font = bpy.data.fonts.load(FONT); cu.align_x = 'CENTER'; cu.align_y = 'CENTER'
        o = bpy.data.objects.new('tx' + str(i), cu); bpy.context.scene.collection.objects.link(o)
        o.location = (x, -0.72, z + 0.02); o.rotation_euler = (math.radians(90), 0, math.radians((i - 1) * 6)); o.data.materials.append(white)
scene('icon_starts', blocks, target=(0, 0, 0.1), dist=8.5, elev=1.5, lens=45)

def bubble_cluster(sc):
    for (x, z, r, c) in ((-0.7, -0.35, 0.95, (0.12, 0.55, 1.0)), (0.75, 0.35, 0.75, (1.0, 0.3, 0.62)), (-0.1, 0.85, 0.5, (0.35, 0.85, 0.2))):
        sphere((x, 0, z), r, bubble_mat(c), seg=64)
scene('icon_bubbles', bubble_cluster, dist=8.5, lens=50)

def puzzle(sc):
    m = mat('pz', (1.0, 0.4, 0.3), 0.35, **{'Coat Weight': 0.5}); m2 = mat('pz2', (1.0, 0.82, 0.25), 0.35, **{'Coat Weight': 0.5})
    box((-0.55, 0, -0.1), (1.7, 1.2, 1.7), m, (0, 0, math.radians(-4)), 0.18); sphere((0.5, 0, -0.1), 0.38, m)
    box((1.25, 0, 0.55), (1.5, 1.2, 1.5), m2, (0, 0, math.radians(5)), 0.18); sphere((-0.05, 0, 1.0), 0.36, m)
scene('icon_build', puzzle, target=(0.3, 0, 0.2), dist=9, elev=1.5, lens=50)

def mic(sc):
    grey = mat('g', (0.85, 0.87, 0.95), 0.2, **{'Metallic': 0.7}); ink = mat('i', INK, 0.3); red = mat('r', CORAL, 0.3, **{'Coat Weight': 0.5})
    o = sphere((0, 0, 0.9), 0.85, grey); o.scale = (1, 1, 1.1)
    torus((0, 0, 0.9), 0.86, 0.07, ink, (math.radians(90), 0, 0)); torus((0, 0, 0.9), 0.86, 0.07, ink, (0, 0, 0))
    cyl((0, 0, -0.35), 0.38, 1.6, red); cyl((0, 0, -1.25), 0.5, 0.3, ink)
scene('icon_read', mic, target=(0, 0, 0.1), dist=9, elev=1.2, lens=50)

def star(sc):
    bpy.ops.mesh.primitive_circle_add(vertices=10, radius=1.4, fill_type='NGON')
    o = bpy.context.active_object
    for i, v in enumerate(o.data.vertices):
        a = math.pi / 2 + i * math.pi / 5; r = 1.45 if i % 2 == 0 else 0.62
        v.co = (math.cos(a) * r, math.sin(a) * r, 0)
    s = o.modifiers.new('s', 'SOLIDIFY'); s.thickness = 0.5; s.offset = 0
    b = o.modifiers.new('b', 'BEVEL'); b.width = 0.14; b.segments = 6; b.limit_method = 'NONE'
    o.modifiers.new('sub', 'SUBSURF').levels = 2
    o.data.materials.append(mat('gold', (1.0, 0.72, 0.1), 0.2, **{'Metallic': 0.15, 'Coat Weight': 0.8}))
    o.rotation_euler = (math.radians(90), 0, math.radians(-8)); smooth(o)
scene('star', star, dist=8, elev=0.6, lens=50)

def house(sc):
    body = mat('hb', (1.0, 0.93, 0.78), 0.4); roof = mat('hr', CORAL, 0.3, **{'Coat Weight': 0.5}); door = mat('hd', (0.3, 0.5, 1.0), 0.35); brick = mat('br', (0.75, 0.35, 0.3), 0.5)
    box((0, 0, -0.35), (2.1, 1.9, 1.45), body, r=0.12)
    me = bpy.data.meshes.new('roof'); o = bpy.data.objects.new('roof', me); bpy.context.scene.collection.objects.link(o)
    bm = bmesh.new()
    pts = [(-1.5, -1.15, 0.3), (1.5, -1.15, 0.3), (0, -1.15, 1.6), (-1.5, 1.15, 0.3), (1.5, 1.15, 0.3), (0, 1.15, 1.6)]
    v = [bm.verts.new(p) for p in pts]
    for f in ((0, 1, 2), (3, 5, 4), (0, 2, 5, 3), (1, 4, 5, 2), (0, 3, 4, 1)): bm.faces.new([v[i] for i in f])
    bm.to_mesh(me); bm.free(); o.data.materials.append(roof)
    bv = o.modifiers.new('b', 'BEVEL'); bv.width = 0.1; bv.segments = 4; bv.limit_method = 'NONE'
    box((0.8, 0.3, 1.45), (0.4, 0.4, 0.8), brick, r=0.05)
    box((0, -0.97, -0.7), (0.6, 0.1, 0.85), door, r=0.06); box((-0.6, -0.97, -0.2), (0.4, 0.1, 0.4), door, r=0.05); box((0.6, -0.97, -0.2), (0.4, 0.1, 0.4), door, r=0.05)
scene('house', house, target=(0, 0, 0.4), dist=9.5, elev=1.6, lens=50)

def trophy(sc):
    gold = mat('g', (1.0, 0.75, 0.15), 0.18, **{'Metallic': 0.9}); base = mat('b', (0.45, 0.3, 0.6), 0.3)
    cone((0, 0, 0.5), 0.55, 1.4, gold, r2=1.0).data.materials  # cup widens upward
    cyl((0, 0, -0.45), 0.2, 0.7, gold); cyl((0, 0, -0.95), 0.75, 0.3, base)
    torus((-1.0, 0, 0.6), 0.42, 0.09, gold, (math.radians(90), 0, 0)); torus((1.0, 0, 0.6), 0.42, 0.09, gold, (math.radians(90), 0, 0))
    sphere((0, -0.02, 0.5), 0.0001, gold)
scene('trophy', trophy, target=(0, 0, 0.1), dist=9, elev=1.2, lens=50, energy=1000)

json.dump(META, open(os.path.join(OUT, 'meta.json'), 'w')) if META else None
