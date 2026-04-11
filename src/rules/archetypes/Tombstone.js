import { defineArchetype } from "../../lib/ecs-js/archetype.js";
import { Position } from "../components/Position.js";
import { Interactable } from "../components/Interactable.js";
import { Material } from "../components/Material.js";
import { NamedIdentity } from "../components/NamedIdentity.js";
import { Tombstone as TombstoneComponent } from "../components/Tombstone.js";

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
/** Map cause strings to flavorful epitaph lines. */
const CAUSE_EPITAPHS = {
  // Legacy cause keys
  spike_trap:           'Impaled by a spike trap',
  shock_trap:           'Electrocuted by a shock trap',
  pit_trap:             'Fell into a pit and never climbed out',
  'trap:gas_explosion': 'Blown up by an exploding gas trap',
  starvation:           'Starved to death in a dungeon full of food',
  fire_hazard:          'Burned to a crisp',
  poison_hazard:        'Choked on noxious fumes',
  'affix:chainLightning':  'Killed by friendly lightning',
  'affix:caustic':      'Dissolved by caustic residue',
  melee:                null, // uses killerName
  ranged:               null,
  retaliation:          'Killed by own reflection',
  'spell:meteor':       'Flattened by a meteor',
  'spell:lightning':    'Struck down by lightning',
  'spell:smite':        'Smitten by divine fury',
  'monster:firebreath': 'Roasted alive by dragonfire',
  'monster:death:fire_puff':  'Immolated by a dying fire puff',
  'monster:death:gas_spore':  'Standing too close to an exploding gas spore',
};

function causeToEpitaph(cause, killerName) {
  if (CAUSE_EPITAPHS[cause] !== undefined) {
    return CAUSE_EPITAPHS[cause] || (killerName ? `Slain by ${killerName}` : 'Fell in combat');
  }
  if (cause === 'combat') return killerName ? `Slain by ${killerName}` : 'Fell in combat';
  if (cause === 'starvation') return 'Starved to death in a dungeon full of food';
  if (cause === 'spell' || (cause && cause.startsWith('spell:'))) return `Killed by magic`;
  if (cause && cause.startsWith('trap')) return 'Done in by a trap';
  if (cause && cause.startsWith('monster:')) return killerName ? `Slain by ${killerName}` : 'Killed by a monster';
  if (cause && cause.startsWith('procPackage:')) return killerName ? `Slain by ${killerName}` : 'Killed by an enchanted weapon';
  if (killerName) return `Slain by ${killerName}`;
  // Prose-style cause strings (contain spaces) — capitalize first letter and use directly
  if (cause && cause.includes(' ')) return 'Killed by ' + cause;
  return cause || 'Killed by something unspeakable';
}

export function generateEpitaph(data) {
  const { playerName, depth, cause, killerName, className, score } = data;

  if (cause === 'highscore') {
    const cls = String(className || '').trim();
    const s = Math.max(0, Number(score || 0) | 0);
    const dc = data.deathCause || null;
    const dk = data.killerName || null;
    let message = `Champion: ${playerName}\n`;
    if (cls) message += `Class: ${cls}\n`;
    message += `Highscore: ${s}`;
    if (dc) message += `\n${causeToEpitaph(dc, dk)}`;
    return message;
  }

  let message = `Here lies ${playerName}\n`;
  message += `Depth: ${depth}\n`;
  message += causeToEpitaph(cause, killerName);

  return message;
}
