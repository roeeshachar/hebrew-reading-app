// The live 3D layer. It draws only pictures: the letters, the touching and the rules stay in
// plain HTML (src/arena.js, src/app.js), so Hebrew text stays crisp and accessible.
// Built into vendor/gl3d.js with `npm run build:3d`; loaded only on the screens that use it.
//
// One unit is one CSS pixel at the middle plane, so HTML positions can be passed straight in.
import {
  WebGLRenderer, Scene, PerspectiveCamera, Group, Mesh, SphereGeometry, CylinderGeometry, ConeGeometry,
  TorusGeometry, PlaneGeometry, MeshPhysicalMaterial, MeshStandardMaterial, MeshBasicMaterial, ShadowMaterial,
  DirectionalLight, HemisphereLight, PMREMGenerator, Color, SRGBColorSpace, ACESFilmicToneMapping,
  PCFSoftShadowMap, MathUtils,
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const BUBBLE_COLORS = [0x58b8ff, 0xff7fb3, 0x7fe05a];

function makeRenderer(el, { shadows = false } = {}) {
  const r = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  if (!r.getContext()) throw new Error('no webgl');
  r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  r.outputColorSpace = SRGBColorSpace;
  r.toneMapping = ACESFilmicToneMapping;
  r.toneMappingExposure = 1.05;
  if (shadows) { r.shadowMap.enabled = true; r.shadowMap.type = PCFSoftShadowMap; }
  r.domElement.className = 'gl';
  r.domElement.setAttribute('aria-hidden', 'true');
  el.prepend(r.domElement);
  return r;
}

function environment(renderer, scene) {
  const pm = new PMREMGenerator(renderer);
  const rt = pm.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = rt.texture;
  pm.dispose();
}

// A camera that maps one world unit to one CSS pixel on the z = 0 plane.
function pixelCamera() {
  const cam = new PerspectiveCamera(30, 1, 10, 6000);
  cam.fit = (w, h) => {
    cam.aspect = w / h;
    cam.position.z = (h / 2) / Math.tan(MathUtils.degToRad(cam.fov / 2));
    cam.updateProjectionMatrix();
  };
  return cam;
}

// ---------------------------------------------------------------- bubble arena
export function createArena(el) {
  const renderer = makeRenderer(el);
  const scene = new Scene();
  const cam = pixelCamera();
  environment(renderer, scene);
  scene.add(new HemisphereLight(0xffffff, 0x9fd6ee, 0.7));
  const key = new DirectionalLight(0xffffff, 1.2); key.position.set(-300, 500, 600); scene.add(key);

  let W = 0, H = 0;
  const resize = () => {
    const w = el.clientWidth, h = el.clientHeight;
    if (w === W && h === H) return;
    W = w; H = h; renderer.setSize(w, h, false); cam.fit(w, h);
  };
  resize();

  const unit = new SphereGeometry(1, 48, 32);
  const bubbles = [];
  const bubble = (i) => {
    if (!bubbles[i]) {
      const mat = new MeshPhysicalMaterial({
        color: 0xffffff, roughness: 0.1, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.06, transparent: true,
        opacity: 0.8, iridescence: 0.8, iridescenceIOR: 1.3, envMapIntensity: 1.8, emissiveIntensity: 0.3,
      });
      const m = new Mesh(unit, mat); m.visible = false; scene.add(m);
      bubbles[i] = { m, mat, pop: -1, wasDead: false, color: -1 };
    }
    return bubbles[i];
  };

  // cannon, built around its pivot so the barrel can turn
  const cannon = new Group();
  const coral = new MeshStandardMaterial({ color: 0xff3a2a, roughness: 0.3, metalness: 0.05 });
  const ink = new MeshStandardMaterial({ color: 0x1d2b4f, roughness: 0.3, metalness: 0.25 });
  const gold = new MeshStandardMaterial({ color: 0xffd25a, roughness: 0.3 });
  const base = new Mesh(new SphereGeometry(1, 40, 24), coral); base.scale.set(1.3, 0.9, 0.8);
  const wheelL = new Mesh(new SphereGeometry(0.4, 24, 16), ink); wheelL.position.set(-1.1, -0.4, 0.3); wheelL.scale.set(1, 0.9, 1);
  const wheelR = wheelL.clone(); wheelR.position.x = 1.1;
  const pivot = new Group(); pivot.position.y = 0.7;
  const barrel = new Mesh(new CylinderGeometry(0.4, 0.46, 1.6, 36), ink); barrel.position.y = 0.8;
  const rim = new Mesh(new CylinderGeometry(0.52, 0.52, 0.2, 36), gold); rim.position.y = 1.62;
  pivot.add(barrel, rim); cannon.add(base, wheelL, wheelR, pivot); scene.add(cannon);
  const cannonScale = 40;

  const arrows = [], bursts = [];
  const shaftGeo = new CylinderGeometry(2.6, 2.6, 34, 10), tipGeo = new ConeGeometry(7, 14, 14), partGeo = new SphereGeometry(1, 10, 8);
  const shaftMat = new MeshStandardMaterial({ color: 0x8a5a2b, roughness: 0.6 });
  const tipMat = new MeshStandardMaterial({ color: 0x1d2b4f, roughness: 0.3 });

  const toWorld = (x, y) => [x - W / 2, H / 2 - y];

  return {
    resize,
    // Where the cannon sits: (x, y) is the pivot of the barrel, in HTML pixels.
    setCannon(x, y, scale = 40) {
      const [wx, wy] = toWorld(x, y);
      cannon.scale.setScalar(scale); cannon.position.set(wx, wy - 0.7 * scale, 20);
    },
    aim(deg) { pivot.rotation.z = -MathUtils.degToRad(deg); },
    // One call per frame with every bubble: { x, y, r (pixels), color, dead, wob, glow }.
    setBubbles(list, t) {
      resize();
      list.forEach((b, i) => {
        const o = bubble(i);
        if (o.color !== b.color) { o.color = b.color; o.mat.color.setHex(BUBBLE_COLORS[b.color % 3]); o.mat.emissive.setHex(BUBBLE_COLORS[b.color % 3]); }
        if (b.dead && !o.wasDead) o.pop = 0;
        if (!b.dead) o.pop = -1;
        o.wasDead = b.dead;
        const [wx, wy] = toWorld(b.x, b.y);
        let s = b.r, op = 0.8;
        if (o.pop >= 0) { o.pop += 1 / 60; s *= 1 + o.pop * 2.4; op = Math.max(0, 0.8 - o.pop * 3.6); }
        o.m.visible = op > 0.01;
        o.mat.opacity = op;
        o.m.position.set(wx + (b.wob ? Math.sin(t * 40) * 5 : 0), wy, 0);
        o.m.scale.set(s, s * (b.wob ? 0.94 : 1), s);
        o.m.rotation.set(t * 0.3 + i, t * 0.4, 0);
        o.mat.emissiveIntensity = b.glow ? 0.55 + 0.35 * Math.sin(t * 8) : 0.28;
      });
    },
    // An arrow from (sx, sy) to (tx, ty) in HTML pixels. Resolves when it arrives.
    arrow(sx, sy, tx, ty, ms) {
      const a = new Group();
      const shaft = new Mesh(shaftGeo, shaftMat), tip = new Mesh(tipGeo, tipMat); tip.position.y = 24;
      a.add(shaft, tip);
      const [ax, ay] = toWorld(sx, sy), [bx, by] = toWorld(tx, ty);
      a.rotation.z = Math.atan2(-(bx - ax), by - ay);
      a.position.set(ax, ay, 24); scene.add(a);
      return new Promise((resolve) => arrows.push({ a, ax, ay, bx, by, t: 0, ms, resolve }));
    },
    burst(x, y, color) {
      const [wx, wy] = toWorld(x, y);
      for (let k = 0; k < 16; k++) {
        const p = new Mesh(partGeo, new MeshBasicMaterial({ color: BUBBLE_COLORS[color % 3], transparent: true }));
        p.scale.setScalar(2.5 + Math.random() * 3); p.position.set(wx, wy, 10);
        const ang = Math.random() * Math.PI * 2, sp = 80 + Math.random() * 160;
        scene.add(p); bursts.push({ p, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, life: 0 });
      }
    },
    render(dt) {
      for (let i = arrows.length - 1; i >= 0; i--) {
        const r = arrows[i]; r.t += dt * 1000 / r.ms; const k = Math.min(1, r.t);
        r.a.position.x = r.ax + (r.bx - r.ax) * k; r.a.position.y = r.ay + (r.by - r.ay) * k;
        if (r.t >= 1) { scene.remove(r.a); arrows.splice(i, 1); r.resolve(); }
      }
      for (let i = bursts.length - 1; i >= 0; i--) {
        const q = bursts[i]; q.life += dt; q.p.position.x += q.vx * dt; q.p.position.y += q.vy * dt; q.vy -= 260 * dt;
        q.p.material.opacity = Math.max(0, 1 - q.life * 2.4);
        if (q.life > 0.45) { scene.remove(q.p); q.p.material.dispose(); bursts.splice(i, 1); }
      }
      renderer.render(scene, cam);
    },
    dispose() { renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove(); },
  };
}

// ---------------------------------------------------------------- the boss dragon
export function createDragon(el) {
  const renderer = makeRenderer(el, { shadows: false });
  const scene = new Scene();
  const cam = new PerspectiveCamera(28, 1, 0.1, 60); cam.position.set(0, 0.35, 9.6); cam.lookAt(0, 0.05, 0);
  environment(renderer, scene);
  scene.add(new HemisphereLight(0xffffff, 0xb9e8c0, 0.55));
  const key = new DirectionalLight(0xffffff, 1.3); key.position.set(3, 6, 6); scene.add(key);

  const green = new MeshStandardMaterial({ color: 0x2fcf5a, roughness: 0.42 });
  const belly = new MeshStandardMaterial({ color: 0xfff0a0, roughness: 0.5 });
  const white = new MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 });
  const ink = new MeshStandardMaterial({ color: 0x1d2b4f, roughness: 0.25 });
  const horn = new MeshStandardMaterial({ color: 0xffb830, roughness: 0.35 });
  const red = new MeshStandardMaterial({ color: 0xff4a35, roughness: 0.4 });
  const body = new Group(); scene.add(body);
  const add = (geo, mat, x, y, z, sx = 1, sy = 1, sz = 1, parent = body) => { const m = new Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); parent.add(m); return m; };
  const head = new Group(); body.add(head);
  add(new SphereGeometry(1.5, 48, 36), green, 0, 0, 0, 1.05, 0.95, 1, head);
  add(new SphereGeometry(0.8, 32, 24), green, 0, -0.5, 1.15, 1.1, 0.8, 0.8, head); // snout
  for (const x of [-0.28, 0.28]) add(new SphereGeometry(0.1, 12, 10), ink, x, -0.35, 1.8, 1, 0.6, 1, head);
  const eyes = [];
  for (const x of [-0.58, 0.58]) {
    const g = new Group(); g.position.set(x, 0.5, 1.15); head.add(g);
    add(new SphereGeometry(0.42, 28, 20), white, 0, 0, 0, 1, 1.05, 1, g);
    const p = add(new SphereGeometry(0.2, 20, 16), ink, 0, 0, 0.34, 1, 1, 1, g); g.userData.pupil = p; eyes.push(g);
  }
  add(new ConeGeometry(0.28, 0.9, 20), horn, -0.75, 1.45, 0, 1, 1, 1, head).rotation.z = 0.35;
  add(new ConeGeometry(0.28, 0.9, 20), horn, 0.75, 1.45, 0, 1, 1, 1, head).rotation.z = -0.35;
  const smile = new Mesh(new TorusGeometry(0.4, 0.075, 12, 28, Math.PI), ink); smile.position.set(0, -0.62, 1.52); smile.rotation.z = Math.PI; head.add(smile);
  const ouch = new Mesh(new SphereGeometry(0.24, 20, 14), ink); ouch.position.set(0, -0.72, 1.55); ouch.scale.set(1.1, 0.8, 0.5); ouch.visible = false; head.add(ouch);
  add(new SphereGeometry(1, 36, 28), belly, 0, -1.55, 0.55, 1.0, 0.7, 0.55); // chest, under the head
  for (const sx of [-1, 1]) {
    const w = add(new ConeGeometry(0.8, 1.7, 24), red, sx * 1.7, 0.2, -0.2); w.rotation.z = -sx * 1.15;
    add(new SphereGeometry(0.4, 20, 16), green, sx * 1.4, -1.3, 0.4);
  }
  for (let i = 0; i < 3; i++) add(new ConeGeometry(0.22, 0.5, 14), red, 0, 1.55 - i * 0.55, -1.35 - i * 0.1, 1, 1, 1, head).rotation.x = -1.2;

  let W = 0, H = 0;
  const resize = () => {
    const w = el.clientWidth || 80, h = el.clientHeight || 80;
    if (w === W && h === H) return;
    W = w; H = h; renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix();
  };
  resize();
  const look = { x: 0, y: 0 };
  const onMove = (e) => {
    const r = el.getBoundingClientRect();
    look.x = MathUtils.clamp(((e.clientX - r.left) / Math.max(r.width, 1)) * 2 - 1, -3, 3) / 3;
    look.y = MathUtils.clamp(-((e.clientY - r.top) / Math.max(r.height, 1)) * 2 + 1, -3, 3) / 3;
  };
  window.addEventListener('pointermove', onMove);
  let hurt = 0;
  return {
    resize,
    hit() { hurt = 1; },
    frame(t, dt) {
      resize();
      hurt = Math.max(0, hurt - dt * 2.2);
      const sq = Math.sin(hurt * Math.PI);
      body.position.y = Math.sin(t * 2) * 0.08 + sq * -0.25;
      body.scale.set(1 + sq * 0.14, 1 - sq * 0.16, 1);
      body.rotation.z = Math.sin(hurt * 22) * 0.12 * hurt;
      head.rotation.y = MathUtils.lerp(head.rotation.y, look.x * 0.5, 0.1);
      head.rotation.x = MathUtils.lerp(head.rotation.x, -look.y * 0.25, 0.1);
      smile.visible = hurt < 0.15; ouch.visible = hurt >= 0.15;
      for (const g of eyes) {
        g.userData.pupil.position.x = MathUtils.lerp(g.userData.pupil.position.x, look.x * 0.16, 0.12);
        g.userData.pupil.position.y = MathUtils.lerp(g.userData.pupil.position.y, look.y * 0.12, 0.12);
        g.scale.y = (Math.sin(t * 0.8) > 0.985 || hurt > 0.5) ? 0.15 : 1;
      }
      renderer.render(scene, cam);
    },
    dispose() { window.removeEventListener('pointermove', onMove); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove(); },
  };
}
