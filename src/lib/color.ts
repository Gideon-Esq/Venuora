// Contrast helpers for venue brand colours (WCAG 2.x relative luminance).
// Venue colours are user-chosen, so every place that puts text on a brand
// colour must derive the text colour from here instead of assuming white.

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function parseHex(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function luminance(hex: string): number {
  const rgb = parseHex(hex);
  if (!rgb) return 0;
  const [r, g, b] = rgb.map(channel);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** White or near-black, whichever reads better on the background. */
export function textOnColor(bg: string): "#ffffff" | "#1b1a22" {
  return contrastRatio(bg, "#ffffff") >= contrastRatio(bg, "#1b1a22") ? "#ffffff" : "#1b1a22";
}

/** Does white text meet WCAG AA (4.5:1) on this colour? */
export function whiteTextPassesAA(bg: string): boolean {
  return contrastRatio(bg, "#ffffff") >= 4.5;
}
