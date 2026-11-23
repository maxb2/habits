export type Child = Node | string | number | null | undefined | false | Child[];
type Props = Record<string, unknown> | null | undefined;

function append(el: Node, children: Child[]) {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

/** Create an HTML element. `onClick` etc. become listeners, `class` → className, `style` accepts a string. */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props?: Props,
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [key, v] of Object.entries(props ?? {})) {
    if (v === undefined || v === null || v === false) continue;
    if (key.startsWith('on') && typeof v === 'function') {
      el.addEventListener(key.slice(2).toLowerCase(), v as EventListener);
    } else if (key === 'class') {
      el.className = String(v);
    } else if (key === 'style') {
      el.setAttribute('style', String(v));
    } else if (key === 'for') {
      (el as HTMLLabelElement).htmlFor = String(v);
    } else if (!key.includes('-') && key in el) {
      (el as unknown as Record<string, unknown>)[key] = v;
    } else {
      el.setAttribute(key, v === true ? '' : String(v));
    }
  }
  append(el, children);
  return el;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Create an SVG element; all props are attributes. */
export function s<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs?: Record<string, string | number | undefined | null | false>,
  ...children: Child[]
): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs ?? {})) {
    if (v === undefined || v === null || v === false) continue;
    el.setAttribute(k, String(v));
  }
  append(el, children);
  return el;
}

/** Build an element from trusted static SVG markup (icons). */
export function svgIcon(markup: string): SVGSVGElement {
  const t = document.createElement('template');
  t.innerHTML = markup.trim();
  return t.content.firstElementChild as SVGSVGElement;
}
