import bpy, math, sys, os, bmesh
from mathutils import Vector

OUT = sys.argv[sys.argv.index('--') + 1]
ONLY = set(sys.argv[sys.argv.index('--') + 2:])
RES = 380
_mats = {}

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = 80; sc.cycles.use_denoising = True
    sc.render.film_transparent = True
    sc.render.resolution_x = sc.render.resolution_y = RES
    sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_mode = 'RGBA'
    sc.view_settings.view_transform = 'Standard'; sc.view_settings.look = 'None'
    w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True
    bg = w.node_tree.nodes['Background']; bg.inputs[0].default_value = (0.8, 0.9, 1.0, 1); bg.inputs[1].default_value = 0.55
    _mats.clear()
    return sc

def M(color, rough=0.45, **kw):
    key = (color, rough, tuple(sorted(kw.items())))
    if key in _mats: return _mats[key]
    m = bpy.data.materials.new('m'); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*color, 1); b.inputs['Roughness'].default_value = rough
    for k, v in kw.items():
        if k in b.inputs: b.inputs[k].default_value = v
    _mats[key] = m; return m

# colours
WHITE, INK, RED, YEL, ORG, GRN, BLU, PNK, BRN, TAN, GRY = (
    (1, 1, 1), (0.08, 0.1, 0.22), (1, 0.18, 0.12), (1, 0.82, 0.12), (1, 0.45, 0.08), (0.2, 0.75, 0.25),
    (0.2, 0.5, 1), (1, 0.45, 0.65), (0.45, 0.25, 0.12), (0.85, 0.62, 0.35), (0.62, 0.65, 0.72))

def smooth(o):
    if o.type == 'MESH':
        for p in o.data.polygons: p.use_smooth = True
    return o

def S(loc, r, color, scale=(1, 1, 1), rough=0.45, seg=48, **kw):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, location=loc, segments=seg, ring_count=seg // 2)
    o = bpy.context.active_object; o.scale = scale; o.data.materials.append(M(color, rough, **kw)); return smooth(o)

def B(loc, size, color, rot=(0, 0, 0), r=0.1, rough=0.4, **kw):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.active_object; o.scale = size; o.data.materials.append(M(color, rough, **kw))
    b = o.modifiers.new('b', 'BEVEL'); b.width = r; b.segments = 5; b.limit_method = 'NONE'; return smooth(o)

def C(loc, r, depth, color, rot=(0, 0, 0), rough=0.4, bw=0.15, **kw):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=depth, location=loc, rotation=rot, vertices=48)
    o = bpy.context.active_object; o.data.materials.append(M(color, rough, **kw))
    b = o.modifiers.new('b', 'BEVEL'); b.width = r * bw; b.segments = 4; return smooth(o)

def CONE(loc, r1, depth, color, rot=(0, 0, 0), r2=0.0, rough=0.4, **kw):
    bpy.ops.mesh.primitive_cone_add(radius1=r1, radius2=r2, depth=depth, location=loc, rotation=rot, vertices=48)
    o = bpy.context.active_object; o.data.materials.append(M(color, rough, **kw)); smooth(o)
    o.modifiers.new('s', 'SUBSURF').levels = 2; return o

def T(loc, R, r, color, rot=(0, 0, 0), rough=0.4, **kw):
    bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=r, location=loc, rotation=rot, major_segments=56, minor_segments=20)
    o = bpy.context.active_object; o.data.materials.append(M(color, rough, **kw)); return smooth(o)

def LIMB(a, b, r, color, rough=0.45, **kw):
    a, b = Vector(a), Vector(b); d = b - a
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=d.length, location=(a + b) / 2, vertices=32)
    o = bpy.context.active_object; o.rotation_euler = d.to_track_quat('Z', 'Y').to_euler()
    o.data.materials.append(M(color, rough, **kw)); return smooth(o)

def EYES(z, y, dx, r=0.22, pupil=0.11, look=(0, 0)):
    for sx in (-1, 1):
        S((sx * dx, y, z), r, WHITE, (1, 0.55, 1.1), 0.15, coat=1.0) if False else S((sx * dx, y, z), r, WHITE, (1, 0.6, 1.1), 0.15, **{'Coat Weight': 1.0})
        S((sx * dx + look[0], y - r * 0.5, z + look[1]), pupil, INK, (1, 0.5, 1), 0.2)
        S((sx * dx + look[0] + pupil * 0.4, y - r * 0.7, z + look[1] + pupil * 0.5), pupil * 0.35, WHITE, (1, 0.4, 1), 0.1)

def SMILE(z, y, w=0.4, depth=0.1, thick=0.06):
    bpy.ops.mesh.primitive_torus_add(major_radius=w, minor_radius=thick, major_segments=48, minor_segments=14)
    t = bpy.context.active_object; bm = bmesh.new(); bm.from_mesh(t.data)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.y > 0.02], context='VERTS'); bm.to_mesh(t.data); bm.free()
    t.data.materials.append(M(INK, 0.3)); smooth(t); t.rotation_euler = (math.radians(90), 0, 0); t.location = (0, y, z)
    for sx in (-1, 1): S((sx * w, y, z), thick, INK)

def NOSE(loc, r=0.14, color=INK):
    return S(loc, r, color, (1, 0.7, 0.8), 0.25)

def camera(sc, target=(0, 0, 0), dist=9.5, elev=1.0, lens=60):
    bpy.ops.object.camera_add(location=(0, -dist, elev))
    cam = bpy.context.active_object; cam.data.lens = lens; sc.camera = cam
    t = bpy.data.objects.new('t', None); t.location = target; sc.collection.objects.link(t)
    c = cam.constraints.new('TRACK_TO'); c.target = t; c.track_axis = 'TRACK_NEGATIVE_Z'; c.up_axis = 'UP_Y'

def lights(energy=1000):
    def area(loc, e, size, color=(1, 1, 1)):
        bpy.ops.object.light_add(type='AREA', location=loc)
        l = bpy.context.active_object; l.data.energy = e; l.data.size = size; l.data.color = color
        c = l.constraints.new('TRACK_TO'); c.target = bpy.data.objects['t']; c.track_axis = 'TRACK_NEGATIVE_Z'; c.up_axis = 'UP_Y'
    area((4, -6, 7), energy, 6); area((-6, -4, 2), energy * 0.35, 6, (0.8, 0.88, 1)); area((0, 5, 5), energy * 0.5, 6, (1, 0.95, 0.9))

def TILT(deg):
    # turn everything built so far about the camera axis (a pose in the picture plane)
    objs = list(bpy.context.scene.objects)
    e = bpy.data.objects.new('tilt', None); bpy.context.scene.collection.objects.link(e)
    e.rotation_euler = (0, math.radians(deg), 0)
    for o in objs: o.parent = e

BUILDERS = {}
def word(name, target=(0, 0, 0), dist=9.5, elev=1.0, lens=60, energy=1000):
    def deco(fn):
        BUILDERS[name] = (fn, target, dist, elev, lens, energy); return fn
    return deco

def run():
    for name, (fn, target, dist, elev, lens, energy) in BUILDERS.items():
        if ONLY and name not in ONLY: continue
        sc = reset(); fn(); camera(sc, target, dist, elev, lens); lights(energy)
        sc.render.filepath = os.path.join(OUT, name + '.png'); bpy.ops.render.render(write_still=True); print('rendered', name, flush=True)
