from words_lib import *

SKIN = (1, 0.78, 0.6)

@word('yeled', dist=11, target=(0, 0, -0.1))
def yeled():
    S((0, 0, 1.15), 1.0, SKIN, (1, 0.95, 1.0), 0.45)
    S((0, 0.12, 1.55), 1.05, (0.25, 0.14, 0.08), (1.02, 0.95, 0.75), 0.5)          # hair
    for sx in (-1, 1): S((sx * 1.0, 0, 1.05), 0.2, SKIN, (0.6, 0.6, 1)); S((sx * 0.5, -0.78, 0.85), 0.2, (1, 0.55, 0.5), (1, 0.4, 0.7))
    EYES(1.2, -0.88, 0.38, 0.19, 0.1); NOSE((0, -1.0, 0.98), 0.07, (0.9, 0.6, 0.45)); SMILE(0.62, -0.93, 0.24, 0, 0.04)
    S((0, 0, -0.55), 0.95, BLU, (1, 0.75, 1.1), 0.5)
    for sx in (-1, 1):
        LIMB((sx * 0.85, 0, -0.1), (sx * 1.35, 0, -0.9), 0.22, BLU); S((sx * 1.4, 0, -0.98), 0.25, SKIN)
        LIMB((sx * 0.4, 0, -1.3), (sx * 0.42, 0, -2.0), 0.28, (0.2, 0.28, 0.6)); S((sx * 0.42, -0.2, -2.15), 0.38, (0.9, 0.2, 0.2), (1, 1.3, 0.55))

@word('yareach', dist=10.5)
def yareach():
    gold = (1, 0.82, 0.25)
    o = S((0, 0, 0), 1.8, gold, (1, 0.5, 1), 0.3, **{'Emission Strength': 0.35, 'Emission Color': (1, 0.8, 0.2, 1)})
    cut = S((0.85, 0, 0.35), 1.55, gold, (1, 0.6, 1)); cut.hide_render = True
    bo = o.modifiers.new('bool', 'BOOLEAN'); bo.operation = 'DIFFERENCE'; bo.object = cut; bo.solver = 'EXACT'
    for (x, z, r) in ((1.5, 1.4, 0.2), (2.0, -0.3, 0.14), (1.2, -1.5, 0.17)):
        S((x, 0, z), r, (1, 0.9, 0.3), (1, 1, 1), 0.2, **{'Emission Strength': 2.0, 'Emission Color': (1, 0.9, 0.3, 1)})
    TILT(-20)

@word('kelev', dist=10.5, elev=0.8)
def kelev():
    fur = (0.82, 0.58, 0.32); dark = (0.5, 0.3, 0.15)
    S((0, 0.1, -0.85), 1.25, fur, (1, 0.9, 1.0)); S((0, -0.45, -0.85), 0.8, (1, 0.9, 0.75), (0.8, 0.5, 0.95))
    S((0, 0, 0.8), 1.1, fur, (1.05, 0.95, 1.0))
    for sx in (-1, 1):
        S((sx * 1.15, -0.05, 0.75), 0.45, dark, (0.55, 0.45, 1.5)); 
    S((0, -0.8, 0.5), 0.55, (1, 0.9, 0.75), (1.0, 0.85, 0.8)); NOSE((0, -1.3, 0.62), 0.17, INK)
    EYES(1.0, -0.88, 0.4, 0.2, 0.11); SMILE(0.25, -1.2, 0.2, 0, 0.04)
    S((0, -1.1, 0.18), 0.17, (1, 0.5, 0.55), (1, 0.4, 1.4))
    for sx in (-1, 1): S((sx * 0.7, -0.5, -2.05), 0.45, fur, (0.85, 1.15, 0.6))
    LIMB((0.9, 0.9, -1.0), (1.9, 0.9, 0.2), 0.18, fur)

@word('kadur', dist=9.5)
def kadur():
    S((0, 0, 0), 1.7, WHITE, rough=0.25, seg=64, **{'Coat Weight': 0.6})
    import itertools
    phi = (1 + 5 ** 0.5) / 2
    verts = []
    for s1 in (-1, 1):
        for s2 in (-1, 1):
            verts += [(0, s1, s2 * phi), (s1, s2 * phi, 0), (s2 * phi, 0, s1)]
    for v in verts:
        vec = Vector(v).normalized() * 1.68
        o = S(vec, 0.42, INK, (1, 1, 0.2), 0.35)
        o.rotation_euler = Vector((0, 0, 1)).rotation_difference(vec.normalized()).to_euler()
        # the patch sits on the surface, facing out; hide the ones on the back
        if vec.y > 0.6: o.hide_render = True
    TILT(15)

@word('limon', dist=10)
def limon():
    y = (1, 0.88, 0.1)
    S((0, 0, 0), 1.4, y, (1.35, 0.95, 0.95), 0.35, seg=64, **{'Coat Weight': 0.3})
    for sx in (-1, 1): CONE((sx * 1.78, 0, 0.05), 0.32, 0.55, y, rot=(0, sx * math.radians(90), 0), r2=0.12)
    S((0.2, 0, 1.15), 0.001, y) if False else None
    leaf = S((0.7, -0.1, 1.25), 0.7, (0.2, 0.7, 0.2), (1, 0.12, 0.5), 0.4); leaf.rotation_euler = (0, math.radians(-25), math.radians(20))
    TILT(-12)

@word('lev', dist=10, target=(0, 0, 0.1))
def lev():
    red = (1, 0.12, 0.2); kw = dict(rough=0.18, **{'Coat Weight': 1.0})
    bpy.ops.mesh.primitive_uv_sphere_add(radius=1.3, location=(0, 0, 0.15), segments=64, ring_count=48)
    o = bpy.context.active_object; o.scale = (1.0, 0.85, 1.0); bm = bmesh.new(); bm.from_mesh(o.data)
    for v in bm.verts:
        if v.co.z < 0.0:
            t = -v.co.z / 1.3
            k = 1 - 0.9 * t ** 1.25
            v.co.x *= k; v.co.y *= k; v.co.z -= t * t * 0.9
    bm.to_mesh(o.data); bm.free(); smooth(o); o.data.materials.append(M(red, **kw))
    for sx in (-1, 1): S((sx * 0.7, 0, 0.8), 1.12, red, (1, 0.95, 1), **kw)
    S((-0.95, -0.85, 1.25), 0.22, WHITE, (1, 0.4, 1.5), 0.1, **{'Emission Strength': 0.6, 'Emission Color': (1, 1, 1, 1)})
    TILT(-8)

@word('mayim', dist=10, target=(0, 0, 0.3))
def mayim():
    bpy.ops.mesh.primitive_uv_sphere_add(radius=1.4, location=(0, 0, 0), segments=64, ring_count=48)
    o = bpy.context.active_object; bm = bmesh.new(); bm.from_mesh(o.data)
    for v in bm.verts:
        if v.co.z > -0.2:
            t = (v.co.z + 0.2) / 1.6
            k = 1 - 0.93 * (t ** 1.15)
            v.co.x *= k; v.co.y *= k; v.co.z = -0.2 + t * 1.6 + (t ** 2.2) * 1.5
    bm.to_mesh(o.data); bm.free(); smooth(o)
    o.data.materials.append(M((0.15, 0.6, 1), 0.05, **{'Coat Weight': 1.0}))
    S((-0.6, -1.0, -0.2), 0.3, WHITE, (0.7, 0.4, 1.4), 0.1, **{'Emission Strength': 0.6, 'Emission Color': (1, 1, 1, 1)})
    TILT(6)

@word('mechonit', dist=12, elev=1.4)
def mechonit():
    red = (1, 0.15, 0.12); kw = dict(rough=0.25, **{'Coat Weight': 0.6})
    B((0, 0, 0), (4.3, 1.9, 1.15), red, r=0.4, **kw)
    B((-0.2, 0, 0.95), (2.6, 1.75, 1.0), red, r=0.42, **kw)
    gl = dict(rough=0.08, **{'Coat Weight': 1.0})
    for x in (-0.75, 0.35): B((x, -0.89, 1.0), (0.85, 0.1, 0.55), (0.6, 0.85, 1), r=0.12, **gl)
    for x in (-1.45, 1.45):
        C((x, -0.95, -0.55), 0.62, 0.45, INK, (math.radians(90), 0, 0), bw=0.3); C((x, -1.17, -0.55), 0.3, 0.1, (0.85, 0.85, 0.9), (math.radians(90), 0, 0), rough=0.2, **{'Metallic': 0.8})
    for y in (-0.5, 0.5): S((2.12, y, 0.15), 0.3, (1, 0.95, 0.5), (0.5, 1, 1), 0.15, **{'Emission Strength': 1.5, 'Emission Color': (1, 0.9, 0.4, 1)})
    B((2.15, 0, -0.3), (0.15, 1.6, 0.3), (0.8, 0.8, 0.85), r=0.05)

@word('nachash', dist=12, target=(0, 0, 0.3))
def nachash():
    g = (0.3, 0.8, 0.2); g2 = (0.95, 0.9, 0.3)
    n = 60
    pts = []
    for i in range(n + 1):
        t = i / n; x = (t - 0.5) * 5.0; z = math.sin(t * math.pi * 2.6) * 0.9 - 0.7 + t * 0.6
        r = 0.45 * (0.4 + 0.6 * min(1, (1 - t) * 3 + 0.0)) if t > 0.67 else 0.52
        pts.append((x, z, r))
    for i, (x, z, r) in enumerate(pts):
        S((x, 0, z), r, g if (i // 3) % 2 == 0 else (0.22, 0.65, 0.18), (1, 1, 1), 0.4, seg=20)
    hx, hz, _ = pts[-1]
    S((hx + 0.15, 0, hz + 0.1), 0.78, g, (1.15, 1, 0.95), 0.4)
    EYES(hz + 0.5, -0.5, 0.0001, 0.0001, 0.0001) if False else None
    for sx in (-0.3, 0.3):
        S((hx + 0.15 + sx, -0.55, hz + 0.4), 0.26, WHITE, (1, 0.6, 1.1), 0.12); S((hx + 0.18 + sx, -0.73, hz + 0.4), 0.13, INK)
    SMILE(hz - 0.08, -0.7, 0.3, 0, 0.04) if False else None
    LIMB((hx + 0.15, -0.7, hz - 0.2), (hx + 0.15, -1.4, hz - 0.3), 0.04, (1, 0.2, 0.3)); 
    for sx in (-1, 1): LIMB((hx + 0.15, -1.4, hz - 0.3), (hx + 0.15 + sx * 0.18, -1.7, hz - 0.35), 0.035, (1, 0.2, 0.3))
    TILT(-4)

@word('naal', dist=11, target=(0.2, 0, 0.1))
def naal():
    blue = (0.2, 0.5, 1)
    B((0.25, 0, -1.15), (4.4, 1.7, 0.5), WHITE, r=0.24, rough=0.4)                      # sole
    S((0.4, 0, -0.3), 1.0, blue, (2.15, 0.82, 0.78), 0.4)                                 # the foot
    S((-1.35, 0, 0.25), 1.0, blue, (0.95, 0.82, 1.2), 0.4)                                # the heel and ankle
    S((-1.35, 0, 1.12), 0.7, (0.08, 0.14, 0.32), (1.0, 0.85, 0.25), 0.5)                  # the opening
    S((2.1, 0, -0.62), 0.72, WHITE, (0.95, 0.86, 0.68), 0.4)                               # toe cap
    S((-0.45, 0, 0.55), 0.6, WHITE, (1.1, 0.7, 0.42), 0.5).rotation_euler = (0, math.radians(-18), 0)  # tongue
    for i, x in enumerate((0.05, 0.55, 1.05)):
        B((x, -0.5, 0.42 - i * 0.14), (0.12, 0.12, 0.7), WHITE, rot=(0, math.radians(-18), 0), r=0.04)
    B((-1.45, -0.78, -0.3), (0.35, 0.06, 0.9), (1, 0.35, 0.15), r=0.03)

@word('sus', dist=11.5, elev=0.8, target=(0, 0, 0.3))
def sus():
    fur = (0.62, 0.36, 0.17); mane = (0.2, 0.1, 0.05)
    S((0, 0, 0), 1.45, fur, (1.5, 0.78, 0.82), 0.4)
    LIMB((1.4, 0, 0.3), (2.0, -0.05, 1.8), 0.5, fur)
    S((2.3, -0.1, 2.0), 0.62, fur, (1.4, 0.85, 0.9), 0.4); S((2.95, -0.1, 1.75), 0.38, (0.78, 0.5, 0.3), (1, 0.8, 0.8)); NOSE((3.25, -0.2, 1.8), 0.08)
    S((2.1, -0.55, 2.2), 0.2, WHITE, (1, 0.5, 1.1), 0.15); S((2.2, -0.7, 2.2), 0.1, INK)
    for sx in (0.0, 0.2): CONE((1.95 + sx, 0, 2.7), 0.2, 0.55, fur, rot=(0, 0.1, 0))
    for i in range(5): S((1.7 - i * 0.15, 0, 2.3 - i * 0.45), 0.34, mane, (0.9, 0.7, 1.2), 0.5)
    S((1.6, 0, 2.55), 0.3, mane, (1, 0.7, 1.0), 0.5)
    for x, y in ((-1.7, -0.45), (-1.7, 0.45), (1.2, -0.45), (1.2, 0.45)):
        LIMB((x * 0.8, y, -0.5), (x, y, -2.0), 0.22, fur); S((x, y, -2.1), 0.26, mane, (1, 1.2, 0.55))
    for i in range(4): S((-2.3 - i * 0.12, 0, 0.1 - i * 0.5), 0.28, mane, (0.9, 0.8, 1.2), 0.5)

@word('sefer', dist=11, target=(0, 0, 0))
def sefer():
    B((0, 0, 0), (2.6, 0.9, 3.5), (0.15, 0.5, 1), r=0.12, rough=0.35, **{'Coat Weight': 0.4})
    B((0.1, 0.05, 0), (2.5, 0.78, 3.3), WHITE, r=0.05, rough=0.6)
    B((0, -0.46, 0), (2.5, 0.12, 3.4), (0.15, 0.5, 1), r=0.12, rough=0.35, **{'Coat Weight': 0.4})
    B((-1.28, 0, 0), (0.22, 1.0, 3.5), (0.1, 0.35, 0.85), r=0.1)
    B((0.05, -0.55, 0.65), (1.5, 0.06, 0.7), (1, 0.82, 0.2), r=0.03, rough=0.3)
    for z in (0.0, -0.3): B((0.05, -0.55, z - 0.0), (1.3 if z else 1.0, 0.05, 0.12), (1, 0.82, 0.2), r=0.02)
    S((0.05, -0.6, -0.95), 0.32, (1, 0.45, 0.4), (1, 0.4, 1))
    B((0.9, -0.56, 1.5), (0.35, 0.06, 0.55), (1, 0.3, 0.3), r=0.04)

@word('etz', dist=12, target=(0, 0, 0.8))
def etz():
    LIMB((0, 0, -2.2), (0, 0, 0.8), 0.45, (0.5, 0.3, 0.14), 0.6)
    LIMB((0, 0, -0.2), (0.9, 0, 0.7), 0.17, (0.5, 0.3, 0.14), 0.6); S((0, 0, -2.3), 0.8, (0.5, 0.3, 0.14), (1, 1, 0.3), 0.6)
    gr = (0.15, 0.65, 0.2)
    for (x, z, r) in ((0, 1.9, 1.35), (-1.15, 1.1, 1.0), (1.15, 1.1, 1.05), (-0.6, 2.55, 0.95), (0.7, 2.6, 0.9)):
        S((x, 0.05 * x, z), r, gr, (1, 1, 0.95), 0.5, seg=32)
    for (x, z) in ((-0.6, 1.6), (0.9, 2.3), (0.2, 1.1)):
        S((x, -1.0, z), 0.2, (1, 0.2, 0.2), rough=0.2)
