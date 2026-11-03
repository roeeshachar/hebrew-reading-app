// The bubble arena: letters rise from the bottom, a cannon shoots an arrow at the
// bubble the child touches. The child pops the letters of a word in order, so the
// letter that counts changes after each hit. Nothing here can fail the child: a wrong
// bubble just bonks, and after two bonks the bubbles that count glow.

const rand = (a, b) => a + Math.random() * (b - a);

// letters: the base letters to pop, in order. pool: other letters that float by.
export function startArena(el, { letters, pool }, cb) {
  const COUNT = 8;
  const LANES = 5;
  const bubbles = [];
  let hits = 0;
  let inflight = 0; // correct arrows still flying: a quick second tap must count for the next letter
  let wrong = 0;
  let raf = 0;
  let last = 0;
  let stopped = false;
  const timers = new Set();
  const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); };
  const target = () => letters[Math.min(hits, letters.length - 1)];
  const nextShot = () => letters[Math.min(hits + inflight, letters.length - 1)];

  el.innerHTML = '<div class="shooter" aria-hidden="true"><img class="base" src="assets/cannon-base.webp" alt="" draggable="false"><img class="barrel" src="assets/cannon-barrel.webp" alt="" draggable="false"></div>';
  const barrel = el.querySelector('.barrel');
  const shooter = el.querySelector('.shooter');
  // Where the arrow leaves the barrel, in arena pixels (the pivot is half way up the base image).
  const muzzle = () => ({ x: W() / 2, y: H() - 6 - shooter.offsetHeight * (1 - 0.5156) });
  const size = () => (bubbles[0] ? bubbles[0].el.offsetWidth : 76);
  const W = () => el.clientWidth;
  const H = () => el.clientHeight;
  const isTarget = (b) => !b.dead && b.letter === target();

  // The 3D layer loads in the background. Until it is ready, and if the phone has no WebGL,
  // the bubbles and the cannon are the flat rendered pictures and the game plays the same.
  let gl = null;
  import('../vendor/gl3d.js').then((m) => {
    if (stopped) return;
    try { gl = m.createArena(el); el.classList.add('gl-on'); } catch { gl = null; }
  }).catch(() => {});

  function pickLetter() {
    const wanted = bubbles.filter(isTarget).length;
    if (wanted < 2 || Math.random() < 0.2) return target();
    // Sometimes a later letter of the word, so the child sees what is coming.
    const rest = letters.slice(hits + 1);
    if (rest.length && Math.random() < 0.2) return rest[Math.floor(Math.random() * rest.length)];
    return pool[Math.floor(Math.random() * pool.length)];
  }

  let laneBag = [];
  function nextLane() {
    if (!laneBag.length) laneBag = [...Array(LANES).keys()].sort(() => Math.random() - 0.5);
    return laneBag.pop();
  }

  function setLetter(b, letter) {
    b.letter = letter;
    b.el.textContent = letter;
    b.el.dataset.letter = letter;
  }

  function refreshHints() {
    bubbles.forEach((b) => b.el.classList.toggle('hint', wrong >= 2 && isTarget(b) && !b.locked));
  }

  function place(b, y) {
    b.lane = nextLane();
    const s = size();
    const pad = 12; // room for the sideways sway
    const laneW = (W() - s - pad * 2) / (LANES - 1 || 1);
    b.x = Math.max(pad, Math.min(W() - s - pad, pad + b.lane * laneW + rand(-6, 6)));
    b.y = y;
    b.speed = rand(36, 60);
    b.phase = rand(0, 6);
    b.dead = false;
    b.locked = false;
    b.el.className = `bub b${b.lane % 3}`;
    setLetter(b, pickLetter());
    refreshHints();
  }

  for (let i = 0; i < COUNT; i++) {
    const node = document.createElement('div');
    node.setAttribute('role', 'button');
    el.appendChild(node);
    bubbles.push({ el: node });
  }
  bubbles.forEach((b) => place(b, 0));
  // Spread the starting bubbles over the arena so the child sees letters at once.
  bubbles.forEach((b, i) => { b.y = (H() - size()) * (i / COUNT) + rand(0, 30); });

  // After a hit the next letter must be on screen soon: turn bubbles that are already in
  // view (the ones nearest the middle) into it, so the child is not left waiting for them to rise.
  function ensureTarget() {
    const t = target();
    const have = bubbles.filter((b) => isTarget(b) && b.y < H() * 0.7).length;
    if (have >= 2) return;
    const mid = H() * 0.4;
    const candidates = bubbles
      .filter((b) => !b.locked && !b.dead && b.letter !== t && b.y > -size() * 0.2 && b.y < H() * 0.7)
      .sort((x, y) => Math.abs(x.y - mid) - Math.abs(y.y - mid));
    for (const b of candidates.slice(0, 2 - have)) { setLetter(b, t); b.el.classList.remove('bonk'); }
    refreshHints();
  }

  // The letter that counts must always be somewhere on screen. If none is in view, turn a bubble
  // near the middle into it (rare: it only happens when the right ones are all still below).
  let lastCheck = 0;
  function keepTargetInView(now) {
    if (now - lastCheck < 1200) return;
    lastCheck = now;
    const inView = (b) => b.y > -size() * 0.3 && b.y < H() - size() * 1.2;
    if (bubbles.some((b) => isTarget(b) && inView(b))) return;
    const mid = H() * 0.35;
    const pick = bubbles.filter((b) => !b.locked && !b.dead && b.letter !== target() && inView(b))
      .sort((x, y) => Math.abs(x.y - mid) - Math.abs(y.y - mid))[0];
    if (pick) { setLetter(pick, target()); refreshHints(); }
  }

  function frame(t) {
    if (stopped) return;
    const dt = Math.min(0.05, (t - (last || t)) / 1000);
    last = t;
    const s = size();
    for (const b of bubbles) {
      if (!b.locked) {
        b.y -= b.speed * dt;
        b.phase += dt;
        if (b.y < -s - 12) place(b, H() + rand(10, 90));
      }
      const sway = Math.sin(b.phase * 1.4) * 9;
      b.cx = b.x + sway + s / 2;
      b.cy = b.y + s / 2;
      b.el.style.transform = `translate(${b.x + sway}px, ${b.y}px)`;
    }
    keepTargetInView(t);
    if (gl) {
      const m = muzzle();
      gl.setCannon(m.x, m.y, shooter.offsetWidth / 2.8);
      gl.setBubbles(bubbles.map((b) => ({
        x: b.cx, y: b.cy, r: s / 2, color: b.lane, dead: b.dead,
        wob: b.el.classList.contains('bonk'), glow: b.el.classList.contains('hint'),
      })), t / 1000);
      gl.render(dt);
    }
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  function shoot(b) {
    const { x: sx, y: sy } = muzzle();
    const dx = b.cx - sx, dy = b.cy - sy;
    const angle = Math.atan2(dx, -dy) * 180 / Math.PI;
    const dist = Math.hypot(dx, dy);
    barrel.style.transform = `rotate(${angle}deg)`;
    if (gl) {
      gl.aim(angle);
      return gl.arrow(sx, sy, b.cx, b.cy, Math.max(140, Math.min(320, dist * 0.55)));
    }
    const arrow = document.createElement('div');
    arrow.className = 'arrow';
    el.appendChild(arrow);
    const a = arrow.animate([
      { transform: `translate(${sx - 4}px, ${sy - 46}px) rotate(${angle}deg)`, transformOrigin: '4px 46px' },
      { transform: `translate(${b.cx - 4}px, ${b.cy - 46}px) rotate(${angle}deg)`, transformOrigin: '4px 46px' },
    ], { duration: Math.max(140, Math.min(320, dist * 0.55)), easing: 'ease-in' });
    return new Promise((resolve) => { a.onfinish = () => { arrow.remove(); resolve(); }; a.oncancel = resolve; });
  }

  async function fire(b) {
    if (b.locked || b.dead || stopped || hits + inflight >= letters.length) return;
    b.locked = true;
    b.el.classList.remove('hint');
    b.el.classList.add('shot'); // in flight: not a target any more until it lands
    const correct = b.letter === nextShot();
    if (correct) inflight++;
    cb.onTap(b.letter, correct);
    await shoot(b);
    if (stopped) return;
    if (correct) {
      inflight--;
      b.dead = true;
      b.el.classList.add('pop');
      if (gl) gl.burst(b.cx, b.cy, b.lane);
      hits++;
      cb.onHit(hits);
      if (hits >= letters.length) { later(() => { stop(); cb.onDone(); }, 320); return; }
      ensureTarget();
      refreshHints();
      later(() => place(b, H() + rand(20, 120)), 260);
    } else {
      wrong++;
      cb.onWrong(wrong);
      b.el.classList.add('bonk');
      later(() => { b.el.classList.remove('bonk', 'shot'); b.locked = false; refreshHints(); }, 450);
    }
  }

  function onDown(e) {
    const node = e.target.closest('.bub');
    if (!node) return;
    const b = bubbles.find((x) => x.el === node);
    if (b) fire(b);
  }
  el.addEventListener('pointerdown', onDown);

  function stop() {
    if (stopped) return;
    stopped = true;
    cancelAnimationFrame(raf);
    timers.forEach(clearTimeout);
    el.removeEventListener('pointerdown', onDown);
    if (gl) { gl.dispose(); gl = null; }
  }
  return stop;
}
