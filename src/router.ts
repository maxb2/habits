export interface ViewContext {
  /** Width available for content (used by charts). */
  width: number;
}

/** A view renders into `root` and may return a cleanup function. */
export type View = (root: HTMLElement, params: string[], ctx: ViewContext) => void | (() => void);

interface Route {
  pattern: RegExp;
  view: View;
  /** Which tab is highlighted. */
  tab: string;
}

const routes: Route[] = [];

export function route(pattern: RegExp, tab: string, view: View) {
  routes.push({ pattern, view, tab });
}

/**
 * Position of the current entry within this app's history. Each entry is tagged with
 * `{ idx }` so "back" can tell whether there is an in-app page to return to.
 */
let idx = 0;

function stateIdx(): number | undefined {
  const s = history.state as { idx?: unknown } | null;
  return typeof s?.idx === 'number' ? s.idx : undefined;
}

export function navigate(path: string, opts: { replace?: boolean } = {}) {
  const hash = `#${path}`;
  if (opts.replace) {
    history.replaceState({ idx }, '', hash);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else {
    location.hash = hash;
  }
}

/** Go back if there is an in-app page to return to, else replace with `fallback`. */
export function goBack(fallback: string) {
  if (idx > 0) history.back();
  else navigate(fallback, { replace: true });
}

export function currentPath(): string {
  return location.hash.replace(/^#/, '') || '/';
}

export function startRouter(root: HTMLElement, onTab: (tab: string) => void) {
  let cleanup: void | (() => void);
  let lastPath = '';

  const existing = stateIdx();
  if (existing === undefined) history.replaceState({ idx: 0 }, '');
  else idx = existing;

  const render = (keepScroll: boolean) => {
    const path = currentPath();
    const match = routes
      .map((r) => ({ r, m: r.pattern.exec(path) }))
      .find((x) => x.m !== null);
    if (!match) {
      navigate('/', { replace: true });
      return;
    }
    const y = window.scrollY;
    if (typeof cleanup === 'function') cleanup();
    root.replaceChildren();
    const width = root.clientWidth - 32; // minus #app horizontal padding
    cleanup = match.r.view(root, match.m!.slice(1).map(decodeURIComponent), { width });
    onTab(match.r.tab);
    if (keepScroll) window.scrollTo(0, y);
    else if (path !== lastPath) window.scrollTo(0, 0);
    lastPath = path;
  };

  window.addEventListener('hashchange', () => {
    const s = stateIdx();
    if (s === undefined) {
      // A fresh entry pushed by a link click or location.hash.
      idx++;
      history.replaceState({ idx }, '');
    } else {
      idx = s; // back/forward, or our own replace
    }
    render(false);
  });

  let lastWidth = root.clientWidth;
  let t: number | undefined;
  window.addEventListener('resize', () => {
    window.clearTimeout(t);
    t = window.setTimeout(() => {
      if (root.clientWidth !== lastWidth) {
        lastWidth = root.clientWidth;
        render(true);
      }
    }, 150);
  });
  render(false);
  return { rerender: () => render(true) };
}
