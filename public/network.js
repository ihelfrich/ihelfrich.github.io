// Ambient network visualization for the hero.
// Conceptually: a low-key gesture at the effective-distance / trade-network work
// in the EffDist V2026 dataset. Drifting nodes, connecting lines if they're close,
// a few rust-colored highlighted nodes that pulse slowly. Pointer attracts.

(function () {
  const canvas = document.getElementById('hero-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let W = 0, H = 0;
  let nodes = [];
  let pointer = { x: -9999, y: -9999, active: false };
  const palette = {
    ink: '#0d3b66',
    rust: '#b85c38',
    sage: '#4f7942',
    paper: '#faf8f3',
    paper2: '#f3efe3',
  };

  function resize() {
    const rect = canvas.getBoundingClientRect();
    W = rect.width;
    H = rect.height;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function seed() {
    const count = Math.min(90, Math.max(50, Math.floor((W * H) / 9000)));
    nodes = Array.from({ length: count }, (_, i) => {
      const isAccent = Math.random() < 0.08;
      return {
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.15,
        vy: (Math.random() - 0.5) * 0.15,
        r: isAccent ? 2.4 + Math.random() * 1.8 : 1 + Math.random() * 1.2,
        accent: isAccent,
        phase: Math.random() * Math.PI * 2,
        baseR: 0
      };
    });
    nodes.forEach(n => (n.baseR = n.r));
  }

  function step(t) {
    ctx.clearRect(0, 0, W, H);

    // Slight pointer attraction; falls off with distance.
    for (const n of nodes) {
      // gentle drift
      n.x += n.vx;
      n.y += n.vy;
      if (n.x < -10) n.x = W + 10;
      if (n.x > W + 10) n.x = -10;
      if (n.y < -10) n.y = H + 10;
      if (n.y > H + 10) n.y = -10;

      // pointer influence
      if (pointer.active) {
        const dx = pointer.x - n.x;
        const dy = pointer.y - n.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < 24000) {
          const f = 0.0006 * (1 - d2 / 24000);
          n.vx += dx * f;
          n.vy += dy * f;
        }
      }
      // dampen
      n.vx *= 0.985;
      n.vy *= 0.985;
      // micro-noise so they don't all stall
      n.vx += (Math.random() - 0.5) * 0.005;
      n.vy += (Math.random() - 0.5) * 0.005;

      // pulse on accents
      if (n.accent) {
        n.r = n.baseR + Math.sin(t * 0.0015 + n.phase) * 0.7;
      }
    }

    // edges: connect node pairs within threshold
    const LINK = 130;
    ctx.lineWidth = 0.6;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        const dx = a.x - b.x, dy = a.y - b.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < LINK * LINK) {
          const alpha = (1 - Math.sqrt(d2) / LINK) * 0.32;
          // accent-touched edges get a hint of rust
          if (a.accent || b.accent) {
            ctx.strokeStyle = `rgba(184, 92, 56, ${alpha * 0.9})`;
          } else {
            ctx.strokeStyle = `rgba(13, 59, 102, ${alpha})`;
          }
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }

    // nodes on top
    for (const n of nodes) {
      ctx.beginPath();
      ctx.fillStyle = n.accent ? palette.rust : palette.ink;
      ctx.globalAlpha = n.accent ? 0.85 : 0.55;
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    requestAnimationFrame(step);
  }

  function onPointer(e) {
    const rect = canvas.getBoundingClientRect();
    pointer.x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    pointer.y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
    pointer.active = true;
  }
  function onLeave() {
    pointer.active = false;
    pointer.x = pointer.y = -9999;
  }

  resize();
  seed();
  requestAnimationFrame(step);
  window.addEventListener('resize', () => { resize(); seed(); });
  canvas.addEventListener('mousemove', onPointer);
  canvas.addEventListener('touchmove', onPointer);
  canvas.addEventListener('mouseleave', onLeave);
})();
