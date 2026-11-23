import { s } from '../ui/dom';

export interface Bar {
  label: string;
  value: number;
  /** Tooltip text. */
  tip: string;
  /** Draw in the de-emphasised step (e.g. goal not met). */
  muted?: boolean;
  /** Period before the habit existed: no bar, no tooltip. */
  skip?: boolean;
}

export interface BarChartOptions {
  bars: Bar[];
  width: number;
  height?: number;
  /** Draws a reference line at this value. */
  goal?: number;
  /** Accessible summary of the chart. */
  ariaLabel: string;
  /** Which bar gets a direct value label. Defaults to the last. */
  labelIndex?: number;
}

/** Smallest "nice" step so that max/step <= maxTicks. */
function niceStep(max: number, maxTicks = 4): number {
  const steps = [1, 2, 5];
  for (let mag = 1; ; mag *= 10) {
    for (const st of steps) if (max / (st * mag) <= maxTicks) return st * mag;
  }
}

/** Column path with a 4px rounded data-end, square at the baseline. */
function columnPath(x: number, y: number, w: number, base: number): string {
  const h = base - y;
  const r = Math.min(4, w / 2, h);
  return `M${x},${base}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${base}Z`;
}

export function barChart(o: BarChartOptions): SVGSVGElement {
  const width = Math.max(240, Math.round(o.width));
  const height = o.height ?? 180;
  const padL = 28;
  const padR = 4;
  const padT = 18;
  const padB = 22;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;
  const base = padT + plotH;

  const dataMax = Math.max(1, o.goal ?? 0, ...o.bars.map((b) => b.value));
  const step = niceStep(dataMax);
  const yMax = Math.ceil(dataMax / step) * step;
  const y = (v: number) => base - (v / yMax) * plotH;

  const n = o.bars.length;
  const slot = plotW / n;
  const barW = Math.min(24, Math.max(4, slot * 0.62));

  const svg = s('svg', {
    class: 'chart',
    width,
    height,
    viewBox: `0 0 ${width} ${height}`,
    role: 'img',
    'aria-label': o.ariaLabel,
  });

  // Gridlines + y ticks
  for (let v = 0; v <= yMax; v += step) {
    const yy = Math.round(y(v)) + 0.5;
    if (v > 0) svg.append(s('line', { class: 'grid', x1: padL, x2: width - padR, y1: yy, y2: yy }));
    svg.append(s('text', { x: padL - 8, y: yy + 4, 'text-anchor': 'end' }, v));
  }

  // Bars
  for (let i = 0; i < n; i++) {
    const b = o.bars[i]!;
    const cx = padL + slot * (i + 0.5);
    if (!b.skip && b.value > 0) {
      svg.append(
        s('path', { class: `bar${b.muted ? ' unmet' : ''}`, d: columnPath(cx - barW / 2, y(b.value), barW, base) }),
      );
    }
  }

  // Baseline
  svg.append(s('line', { class: 'baseline', x1: padL, x2: width - padR, y1: base + 0.5, y2: base + 0.5 }));

  // Goal reference line (drawn over bars so it stays visible)
  if (o.goal) {
    const gy = Math.round(y(o.goal)) + 0.5;
    svg.append(s('line', { class: 'goal-line', x1: padL, x2: width - padR, y1: gy, y2: gy }));
  }

  // X labels: thin out so they never overlap; always keep the last.
  const longest = Math.max(...o.bars.map((b) => b.label.length));
  const every = Math.max(1, Math.ceil((longest * 6.2 + 8) / slot));
  for (let i = 0; i < n; i++) {
    if ((n - 1 - i) % every !== 0) continue;
    const cx = padL + slot * (i + 0.5);
    svg.append(s('text', { x: cx, y: height - 6, 'text-anchor': 'middle' }, o.bars[i]!.label));
  }

  // One direct value label (current period by default)
  const li = o.labelIndex ?? n - 1;
  const lb = o.bars[li];
  if (lb && !lb.skip) {
    const cx = padL + slot * (li + 0.5);
    svg.append(
      s('text', { class: 'value-label', x: cx, y: y(lb.value) - 5, 'text-anchor': 'middle' }, lb.value),
    );
  }

  // Hit targets: full-height slots, larger than the marks
  for (let i = 0; i < n; i++) {
    const b = o.bars[i]!;
    if (b.skip) continue;
    svg.append(
      s('rect', { class: 'hit', x: padL + slot * i, y: padT - 8, width: slot, height: plotH + 8, 'data-tip': b.tip }),
    );
  }

  return svg;
}
