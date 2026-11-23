/**
 * One shared tooltip for chart marks. Any element with `data-tip` inside a
 * container passed to `attachTooltips` shows it on hover (mouse) or tap (touch).
 */
let tip: HTMLDivElement | null = null;
let anchor: Element | null = null;

function ensure(): HTMLDivElement {
  if (!tip) {
    tip = document.createElement('div');
    tip.className = 'tooltip';
    tip.setAttribute('role', 'tooltip');
    document.body.appendChild(tip);
    const hide = () => hideTooltip();
    window.addEventListener('scroll', hide, { passive: true, capture: true });
    window.addEventListener('resize', hide);
    document.addEventListener('pointerdown', (e) => {
      if (anchor && !(e.target instanceof Element && e.target.closest('[data-tip]'))) hide();
    });
  }
  return tip;
}

function show(el: Element) {
  const t = ensure();
  anchor = el;
  t.textContent = el.getAttribute('data-tip');
  t.classList.add('show');
  const r = el.getBoundingClientRect();
  const tw = t.offsetWidth;
  const th = t.offsetHeight;
  const margin = 8;
  let left = r.left + r.width / 2 - tw / 2;
  left = Math.max(margin, Math.min(left, window.innerWidth - tw - margin));
  let top = r.top - th - 8;
  if (top < margin) top = r.bottom + 8;
  t.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
}

export function hideTooltip() {
  anchor = null;
  tip?.classList.remove('show');
}

export function attachTooltips(container: Element) {
  container.addEventListener('pointerover', (e) => {
    const pe = e as PointerEvent;
    if (pe.pointerType !== 'mouse') return;
    const el = (e.target as Element).closest('[data-tip]');
    if (el && container.contains(el)) show(el);
  });
  container.addEventListener('pointerout', (e) => {
    const pe = e as PointerEvent;
    if (pe.pointerType !== 'mouse') return;
    const to = pe.relatedTarget as Element | null;
    if (!to || !to.closest?.('[data-tip]')) hideTooltip();
  });
  container.addEventListener('click', (e) => {
    const el = (e.target as Element).closest('[data-tip]');
    if (!el || !container.contains(el)) return;
    if (anchor === el) hideTooltip();
    else show(el);
  });
  // Keyboard: focusable marks show their tip on focus.
  container.addEventListener('focusin', (e) => {
    const el = (e.target as Element).closest('[data-tip]');
    if (el) show(el);
  });
  container.addEventListener('focusout', () => hideTooltip());
}
