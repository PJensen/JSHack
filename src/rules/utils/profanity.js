// rules/utils/profanity.js
// Shared profanity detection for engraving + deity systems.

const _PROFANE = /\b(damn|hell|ass|shit|fuck|crap|piss|bastard|bloody|bollocks|bugger|wanker)\b/i;

/** @param {unknown} text */
export function isProfane(text) {
  return _PROFANE.test(String(text || ''));
}
