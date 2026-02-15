import { defineArchetype } from "../../lib/ecs-js/archetype.js";
import { Position } from "../components/Position.js";
import { Interactable } from "../components/Interactable.js";
import { Material } from "../components/Material.js";
import { NamedIdentity } from "../components/NamedIdentity.js";
import TombstoneComponent from "../components/Tombstone.js";

/**
 * Tombstone archetype - physical tombstone entity in dungeon
 * Marks where a player died in a previous playthrough
 */
export const Tombstone = defineArchetype(
  "Tombstone",
  [Position, (p) => ({ x: p.x, y: p.y })],
  [NamedIdentity, { name: "Tombstone", identity: "tombstone" }],
  [Interactable, { action: "readTombstone", params: {} }],
  [Material, { kind: "stone" }],
  [TombstoneComponent, (p) => ({
    playerName: p.playerName || 'Hero',
    depth: p.depth || 1,
    cause: p.cause || 'unknown',
    killerName: p.killerName || null,
    turn: p.turn || 0,
    epitaph: p.epitaph || '',
  })]
);

/**
 * Helper to generate epitaph text from tombstone data
 * @param {Object} data - Tombstone data
 * @param {string} data.playerName - Name of the deceased
 * @param {number} data.depth - Floor where death occurred
 * @param {string} data.cause - Cause of death
 * @param {string|null} data.killerName - Name of killer (if applicable)
 * @returns {string} Formatted epitaph
 */
export function generateEpitaph(data) {
  const { playerName, depth, cause, killerName } = data;

  let message = `Here lies ${playerName}\n`;
  message += `Depth: ${depth}\n`;

  if (cause === 'combat' && killerName) {
    message += `Slain by ${killerName}`;
  } else if (cause === 'starvation') {
    message += `Died of starvation`;
  } else if (cause === 'trap') {
    message += `Fell victim to a trap`;
  } else if (cause === 'spell') {
    message += `Killed by magic`;
  } else {
    message += `Cause: ${cause}`;
  }

  return message;
}
