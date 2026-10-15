// The bubble arena: letters rise from the bottom, a cannon shoots an arrow at the
// bubble the child touches. Nothing here can fail the child; a wrong bubble just
// bonks, and after two bonks the right bubbles glow.

const rand = (a, b) => a + Math.random() * (b - a);

export function startArena(el, { letter, pool, need }, cb) {
  const COUNT = 7;
  const LANES = 5;
  let bubbles = [];
  let hits = 0;
  let wrong = 0;
  let raf = 0;
  let last = 0;
  let stopped = false;
  const timers = new Set();
  const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); };

  el.innerHTML = '<div class="shooter" aria-hidden="true"><div class="barrel"></div><div class="base"></div></div>';
  const shooter = el.querySelector('.shooter');
  const barrel = el.querySelector('.barrel');
  const size = () => (bubbles[0] ? bubbles[0].el.offsetWidth : 76);
  const W = () => el.clientWidth;
  const H = () => el.clientHeight;

  function pickLetter() {
    const targets = bubbles.filter((b) => b.letter === letter && !b.dead).length;
    return targets < 2 || Math.random() < 0.35 ? letter : pool[Math.floor(Math.random() * pool.length)];
  }

  let laneBag = [];
  function nextLane() {
    if (!laneBag.length) laneBag = [...Array(LANES).keys()].sort(() => Math.random() - 0.5);
    return laneBag.pop();
  }

  function place(b, y) {
    b.lane = nextLane();
    const s = size();
    const pad = 12; // room for the sideways sway
    const laneW = (W() - s - pad * 2) / (LANES - 1 || 1);
    b.x = Math.max(pad, Math.min(W() - s - pad, pad + b.lane * laneW + rand(-6, 6)));
    b.y = y;
    b.speed = rand(34, 56);
    b.phase = rand(0, 6);
    b.letter = pickLetter();
    b.el.textContent = b.letter;
    b.el.dataset.letter = b.letter;
    b.el.classList.toggle('hint', wrong >= 2 && b.letter === letter);
    b.dead = false;
    b.locked = false;
    b.el.className = `bub b${b.lane % 3}${wrong >= 2 && b.letter === letter ? ' hint' : ''}`;
  }

  for (let i = 0; i < COUNT; i++) {
    const node = document.createElement('div');
    node.setAttribute('role', 'button');
    el.appendChild(node);
    const b = { el: node };
    bubbles.push(b);
  }
  bubbles.forEach((b, i) => place(b, 0));
  // Spread the starting bubbles over the arena so the child sees letters at once.
  bubbles.forEach((b, i) => { b.y = (H() - size()) * (i / COUNT) + rand(0, 30); });

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
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  function shoot(b) {
    const sx = W() / 2, sy = H() - 34;
    const dx = b.cx - sx, dy = b.cy - sy;
    const angle = Math.atan2(dx, -dy) * 180 / Math.PI;
    const dist = Math.hypot(dx, dy);
    barrel.style.transform = `rotate(${angle}deg)`;
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
    if (b.locked || b.dead || stopped) return;
    b.locked = true;
    const correct = b.letter === letter;
    cb.onTap(b.letter, correct);
    await shoot(b);
    if (stopped) return;
    if (correct) {
      b.dead = true;
      b.el.classList.add('pop');
      hits++;
      cb.onHit(hits);
      if (hits >= need) { later(() => { stop(); cb.onDone(); }, 320); return; }
      later(() => place(b, H() + rand(20, 120)), 260);
    } else {
      wrong++;
      cb.onWrong(wrong);
      b.el.classList.add('bonk');
      if (wrong >= 2) bubbles.forEach((x) => { if (x.letter === letter) x.el.classList.add('hint'); });
      later(() => { b.el.classList.remove('bonk'); b.locked = false; }, 450);
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
  }
  return stop;
}
