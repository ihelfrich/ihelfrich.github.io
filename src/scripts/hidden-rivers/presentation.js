// A single text-free stage reuses the live renderer; no second WebGL scene.
export function initPresentation({ canvas, ready, getMotion, setMotion }) {
  const dialog = document.getElementById('ocean-presentation');
  const screen = dialog.querySelector('.presentation-screen');
  const controls = dialog.querySelector('.presentation-controls');
  const video = dialog.querySelector('video');
  const image = dialog.querySelector('img');
  const home = document.createComment('ocean canvas home');
  const slides = ['ocean', ...document.querySelectorAll('[data-presentation-image]')].map(item =>
    typeof item === 'string' ? { id: item } : { id: item.dataset.presentationImage, src: item.dataset.presentationSrc, alt: item.dataset.presentationAlt });
  slides.push({ id: 'film' });
  let index = 0, previousFocus, previousMotion, hideTimer;
  const reveal = () => {
    dialog.classList.add('show-controls');
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => dialog.classList.remove('show-controls'), 1800);
  };
  const pauseButton = controls.querySelector('[data-present-action="pause"]');
  function updatePause() {
    const playing = slides[index].id === 'film' ? !video.paused : getMotion().playing;
    pauseButton.hidden = !['ocean', 'film'].includes(slides[index].id);
    pauseButton.setAttribute('aria-label', playing ? 'Pause motion' : 'Play motion');
    pauseButton.dataset.playing = String(playing);
  }
  function show(next) {
    index = (next + slides.length) % slides.length;
    const slide = slides[index];
    dialog.dataset.slide = slide.id;
    video.pause();
    video.hidden = slide.id !== 'film';
    image.hidden = !slide.src;
    canvas.hidden = slide.id !== 'ocean';
    setMotion({ playing: slide.id === 'ocean', film: slide.id === 'ocean' });
    if (slide.src) { image.src = slide.src; image.alt = slide.alt; }
    if (slide.id === 'film') void video.play().catch(() => { reveal(); updatePause(); });
    updatePause();
  }
  function pause() {
    if (slides[index].id === 'film') {
      if (video.paused) void video.play().catch(reveal); else video.pause();
    } else if (slides[index].id === 'ocean') {
      const playing = !getMotion().playing;
      setMotion({ playing, film: playing });
    }
    updatePause();
  }
  async function enter(id = 'ocean') {
    if (dialog.open || (id === 'ocean' && !ready())) return;
    previousFocus = document.activeElement;
    previousMotion = getMotion();
    canvas.before(home); screen.prepend(canvas);
    document.documentElement.classList.add('presenting-ocean');
    dialog.showModal();
    show(Math.max(0, slides.findIndex(slide => slide.id === id)));
    dialog.focus();
    // Presentation still fills the browser if the Fullscreen API is unavailable.
    try { await dialog.requestFullscreen?.(); } catch { /* viewport fallback */ }
  }
  function leave() {
    if (!dialog.open) return;
    dialog.close();
  }
  dialog.addEventListener('close', () => {
    clearTimeout(hideTimer); video.pause(); canvas.hidden = false;
    home.replaceWith(canvas);
    document.documentElement.classList.remove('presenting-ocean');
    dialog.classList.remove('show-controls');
    setMotion(previousMotion);
    if (document.fullscreenElement === dialog) void document.exitFullscreen().catch(() => {});
    previousFocus?.focus({ preventScroll: true });
  });
  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement && dialog.open) leave();
  });
  dialog.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); leave(); }
    else if (['ArrowRight', 'PageDown'].includes(event.key)) { event.preventDefault(); show(index + 1); }
    else if (['ArrowLeft', 'PageUp'].includes(event.key)) { event.preventDefault(); show(index - 1); }
    else if (event.code === 'Space') { event.preventDefault(); pause(); }
    else if (event.key === 'Tab') reveal();
  });
  dialog.addEventListener('pointermove', reveal);
  dialog.addEventListener('pointerdown', reveal);
  controls.addEventListener('focusin', reveal);
  controls.addEventListener('click', event => {
    const action = event.target.closest('button')?.dataset.presentAction;
    if (action === 'next') show(index + 1);
    if (action === 'previous') show(index - 1);
    if (action === 'pause') pause();
    if (action === 'exit') leave();
  });
  video.addEventListener('play', updatePause);
  video.addEventListener('pause', updatePause);
  document.querySelectorAll('[data-present]').forEach(button => {
    button.addEventListener('click', () => void enter(button.dataset.present));
  });

  return { enter };
}
