// Shared by the econometrics, time-series and handbook layouts.
// A wide equation or table scrolls inside its own box. While a box overflows, it is a focusable,
// labelled region, so keyboard and zoomed readers can reach the part beyond the column edge.
export function initializeScrollBoxes() {
  document.querySelectorAll<HTMLTableElement>('.ea-prose table').forEach((table) => {
    if (table.parentElement?.classList.contains('ea-scroll')) return;
    const box = document.createElement('div');
    box.className = 'ea-scroll';
    table.before(box);
    box.append(table);
  });
  const boxes = [...document.querySelectorAll<HTMLElement>('.ea-prose .katex-display, .ea-prose .ea-scroll')];
  const equations = boxes.filter((box) => box.classList.contains('katex-display'));
  const tables = boxes.filter((box) => !equations.includes(box));
  const update = (box: HTMLElement) => {
    if (box.scrollWidth > box.clientWidth) {
      const equation = equations.includes(box);
      box.tabIndex = 0;
      box.setAttribute('role', equation ? 'group' : 'region');
      box.setAttribute('aria-label', equation ? `Equation ${equations.indexOf(box) + 1}, scrolls horizontally` : `Table ${tables.indexOf(box) + 1}, scrolls horizontally`);
      box.dataset.scrolls = '';
    } else if ('scrolls' in box.dataset) {
      ['tabindex', 'role', 'aria-label', 'data-scrolls'].forEach((name) => box.removeAttribute(name));
    }
  };
  const observer = new ResizeObserver((entries) => entries.forEach((entry) => update(entry.target as HTMLElement)));
  boxes.forEach((box) => observer.observe(box));
  document.fonts?.ready.then(() => boxes.forEach(update));
}
