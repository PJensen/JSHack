// display/fonts.js
// Font contracts for the Unicode game surface.

export const GAME_TEXT_FONT_FAMILY = 'monospace';
export const GAME_ICON_FONT_FAMILY = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", emoji, monospace';
export const GAME_LOG_FONT_FAMILY = 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Courier New", monospace';

const EMOJI_RE = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]\uFE0F?/u;

/**
 * @param {string} glyph
 * @returns {boolean}
 */
export function isIconGlyph(glyph) {
  return EMOJI_RE.test(String(glyph || ''));
}

/**
 * @param {string|number} size
 * @param {string|number} [weight]
 * @param {string} [family]
 * @returns {string}
 */
export function canvasFont(size, weight = '', family = GAME_TEXT_FONT_FAMILY) {
  const prefix = weight ? `${weight} ` : '';
  return `${prefix}${size} ${family}`;
}

/**
 * @param {string} glyph
 * @param {string|number} size
 * @param {string|number} [weight]
 * @returns {string}
 */
export function canvasGlyphFont(glyph, size, weight = 900) {
  return canvasFont(size, weight, isIconGlyph(glyph) ? GAME_ICON_FONT_FAMILY : GAME_TEXT_FONT_FAMILY);
}
