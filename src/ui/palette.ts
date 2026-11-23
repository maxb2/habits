/**
 * Habit colours: the 8-slot categorical palette (validated for CVD separation),
 * each with its own dark-mode step. Habits store the light hex; CSS swaps to the
 * dark step via --hue-N variables (see styles.css).
 */
export const HUES = [
  { name: 'Blue', light: '#2a78d6', dark: '#3987e5' },
  { name: 'Orange', light: '#eb6834', dark: '#d95926' },
  { name: 'Aqua', light: '#1baf7a', dark: '#199e70' },
  { name: 'Yellow', light: '#eda100', dark: '#c98500' },
  { name: 'Magenta', light: '#e87ba4', dark: '#d55181' },
  { name: 'Green', light: '#008300', dark: '#0ca30c' },
  { name: 'Violet', light: '#6250d6', dark: '#9085e9' },
  { name: 'Red', light: '#e34948', dark: '#e66767' },
] as const;

/** Index into HUES, or -1 for a colour not in the palette (e.g. hand-edited backup). */
export function hueIndex(hex: string): number {
  return HUES.findIndex((h) => h.light.toLowerCase() === hex.toLowerCase());
}

/** Inline style that sets --c / --c-ink for a habit colour. */
export function hueStyle(hex: string): string {
  const i = hueIndex(hex);
  return i >= 0 ? `--c: var(--hue-${i + 1}); --c-ink: var(--hue-${i + 1}-ink)` : `--c: ${hex}; --c-ink: #fff`;
}

/** First palette colour not used by `used`, cycling only once all 8 are taken. */
export function nextHue(used: string[]): string {
  const taken = new Set(used.map((c) => c.toLowerCase()));
  return (HUES.find((h) => !taken.has(h.light)) ?? HUES[used.length % HUES.length]!).light;
}
