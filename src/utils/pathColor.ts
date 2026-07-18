/**
 * Curated hues for the drawn path, spread across the color wheel while
 * steering clear of the semantic red (mistake) and teal-green (success)
 * hues used elsewhere, so a level's path color never gets confused with
 * those cues. Saturation/lightness are supplied separately per-theme (see
 * --path-saturation/--path-lightness in theme.css) so contrast stays good in
 * both light and dark mode regardless of which hue lands on a given level.
 */
const PATH_HUES: readonly number[] = [258, 210, 283, 328, 236, 200, 305];

/** Deterministic per-level hue: replaying a level shows the same path color
 * every time (not a fresh reroll on every mount) while consecutive levels
 * still read as visually distinct. A multiplicative hash keeps the mapping
 * from feeling like a simple repeating cycle without reaching for
 * Math.random(). */
export function pathHueForLevel(levelId: number): number {
  const hashed = Math.imul(levelId, 2654435761) >>> 0;
  return PATH_HUES[hashed % PATH_HUES.length]!;
}
