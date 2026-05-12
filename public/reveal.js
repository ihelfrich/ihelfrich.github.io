// Scroll-reveal + scroll-progress bar.
// Keeps motion subtle. Respects reduce-motion preference.
(function () {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ------- scroll progress bar -------
  const bar = document.createElement('div');
  bar.className = 'h-scroll-progress';
  document.body.appendChild(bar);
  function onScroll() {
    const h = document.documentElement;
    const pct = (h.scrollTop / Math.max(1, h.scrollHeight - h.clientHeight)) * 100;
    bar.style.width = pct + '%';
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // ------- reveal-on-scroll -------
  if (reduce) {
    document.querySelectorAll('.h-card, .h-row, .h-section-head').forEach(el => el.classList.add('h-in'));
    return;
  }

  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) {
        e.target.classList.add('h-in');
        io.unobserve(e.target);
      }
    }
  }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });

  document.querySelectorAll('.h-card, .h-row, .h-section-head').forEach(el => {
    el.classList.add('h-reveal');
    io.observe(el);
  });

  // ------- subtle card tilt on hover (pointer only) -------
  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    const cards = document.querySelectorAll('.h-card');
    cards.forEach(card => {
      let raf = null;
      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width;
        const y = (e.clientY - rect.top) / rect.height;
        const tiltX = (0.5 - y) * 4;
        const tiltY = (x - 0.5) * 4;
        if (raf) cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
          card.style.transform = `perspective(800px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) translateY(-2px)`;
        });
      });
      card.addEventListener('mouseleave', () => {
        if (raf) cancelAnimationFrame(raf);
        card.style.transform = '';
      });
    });
  }
})();
