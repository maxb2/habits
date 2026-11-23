let el: HTMLDivElement | null = null;
let timer: number | undefined;

export function toast(message: string, kind: 'info' | 'error' = 'info') {
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.dataset.kind = kind;
  el.classList.add('show');
  window.clearTimeout(timer);
  timer = window.setTimeout(() => el?.classList.remove('show'), kind === 'error' ? 5000 : 2500);
}
