// shared/data/spiritGuidance.js
// Tutorial tip definitions for the spirit wisp guide.
// Each tip fires once per player lifetime (tracked in localStorage).
// Triggers are evaluated by spiritGuideWiring.js against world events.

/**
 * @typedef {object} GuidanceTip
 * @property {string}  id          — unique localStorage key suffix
 * @property {string}  text        — what the spirit says
 * @property {number}  [durationSec] — bubble display time (default 5)
 * @property {number}  [delaySec]  — pause before showing (default 0.6)
 * @property {string}  [flyTo]     — "item"|"stair"|"altar"|"npc"|"enemy" — wisp flies to relevant entity first
 * @property {string}  [pointTo]   — CSS selector of a UI button the wisp orb flies to in screen-space
 */

/** @type {GuidanceTip[]} */
export const GUIDANCE_TIPS = [
  {
    id: "welcome",
    text: "I am a spirit of these lands. Stay close \u2014 I'll show you the way.",
    durationSec: 5.5,
    delaySec: 1.8,
  },
  {
    id: "movement",
    text: "Tap the screen edges to move. On keyboard: arrow keys, WASD, or HJKL.",
    durationSec: 5,
    delaySec: 0.4,
  },
  {
    id: "item_ground",
    text: "Something on the ground! Double-tap it or press \u201c,\u201d to pick it up.",
    durationSec: 5,
    delaySec: 0.5,
    flyTo: "item",
  },
  {
    id: "first_pickup",
    text: "Swipe right or press \u201cI\u201d to open your inventory. Equip weapons and armor from there.",
    durationSec: 5.5,
    delaySec: 0.6,
    pointTo: "#btn-bag",
  },
  {
    id: "first_combat",
    text: "An enemy! Walk into it to attack. Watch your HP in the top-right gauge.",
    durationSec: 5,
    delaySec: 0.3,
    flyTo: "enemy",
    pointTo: "#hud-vitals",
  },
  {
    id: "low_hp",
    text: "You're wounded! Use a potion from your pinned items, or retreat to safety.",
    durationSec: 5,
    delaySec: 0.3,
    pointTo: "#hud-pinned-items",
  },
  {
    id: "first_stair",
    text: "Stairs lead deeper into the dungeon. Step on them and tap the tooltip to descend.",
    durationSec: 5.5,
    delaySec: 0.5,
    flyTo: "stair",
  },
  {
    id: "first_npc",
    text: "A villager! Walk into them to talk. They know things about the town and its needs.",
    durationSec: 5,
    delaySec: 0.5,
    flyTo: "npc",
  },
  {
    id: "first_altar",
    text: "A sacred altar. Pray here or offer items to earn your deity's favor.",
    durationSec: 5,
    delaySec: 0.5,
    flyTo: "altar",
    pointTo: "#btn-pray",
  },
  {
    id: "first_spell",
    text: "A new spell! Tap the spell button or press \u201cF\u201d to cast your active spell.",
    durationSec: 5,
    delaySec: 0.6,
    pointTo: "#active-spell",
  },
];

/** localStorage key prefix for tracking shown tips. */
export const GUIDE_STORAGE_KEY = "jshack:spiritGuide:seen:v1";

/**
 * Read the set of already-shown tip IDs from localStorage.
 * @returns {Set<string>}
 */
export function readSeenTips() {
  try {
    if (typeof localStorage === "undefined") return new Set();
    const raw = localStorage.getItem(GUIDE_STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

/**
 * Mark a tip ID as seen and persist.
 * @param {Set<string>} seen
 * @param {string} id
 */
export function markTipSeen(seen, id) {
  seen.add(id);
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(GUIDE_STORAGE_KEY, JSON.stringify([...seen]));
    }
  } catch { /* quota / private mode */ }
}
