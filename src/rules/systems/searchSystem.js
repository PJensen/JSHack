// src/rules/systems/searchSystem.js
// Processes SearchIntent: actor performs a radial area search.
//
// The search pipeline is resolver-based so future content can be added
// without modifying this system:
//
//   searchResolvers = [trapResolver, /* hiddenMonsterResolver, ... */]
//
// Each resolver receives (world, actorId, pos, radius) and returns:
//   { found: boolean, messages: string[] }

import { SearchIntent } from "../components/Intents/SearchIntent.js";
import { Position } from "../components/Position.js";
import { Vitality } from "../components/Vitality.js";
import { Brain } from "../components/Brain.js";
import { Trap } from "../components/Trap.js";
import { SecretDoor } from "../components/SecretDoor.js";
import { setTile, getTile } from "../environment/dungeon/tileMap.js";
import { TILE_DOOR, TILE_WALL } from "../environment/dungeon/constants.js";
import { invalidateTileQueryCache } from "../utils/tileQueryCache.js";

/**
 * Trap search resolver — reveals hidden/armed traps within the search radius.
 * @param {import('../../lib/ecs-js/index.js').World} world
 * @param {number} actorId
 * @param {{ x: number, y: number }} pos
 * @param {number} radius
 * @returns {{ found: boolean, messages: string[] }}
 */
function trapResolver(world, actorId, pos, radius) {
  /** @type {string[]} */
  const messages = [];
  let found = false;

  const r2 = radius * radius;
  for (const [tid, trap, trapPos] of world.query(Trap, Position)) {
    if (trap.revealed || !trap.armed) continue;

    const dx = trapPos.x - pos.x;
    const dy = trapPos.y - pos.y;
    if (dx * dx + dy * dy > r2) continue;

    // Reveal the trap
    try { world.set(tid, Trap, { ...trap, revealed: true }); } catch {}
    found = true;

    const trapNames = { spike: 'spike trap', snake: 'snake trap', shock: 'shock trap' };
    const name = trapNames[trap.type] || 'trap';
    messages.push(`*** a hidden ${name} is revealed! ***`);

    world.emit('search:revealed', { actorId, entityId: tid, kind: 'trap', at: { x: trapPos.x, y: trapPos.y } });
  }

  return { found, messages };
}

const SECRET_HINTS = Object.freeze({
  draft: "You feel a draft slip through the stone.",
  scratch: "You notice scratches near a wall.",
  hollow: "You hear a hollow place behind the stone.",
  moss: "The moss breaks around a hidden seam.",
  warmth: "A warm thread of air leaks from the wall.",
});

/**
 * Secret door resolver — adjacent search reveals; range-2 search hints.
 * @param {import('../../lib/ecs-js/index.js').World} world
 * @param {number} actorId
 * @param {{ x: number, y: number }} pos
 * @param {number} _radius
 * @returns {{ found: boolean, messages: string[] }}
 */
function secretDoorResolver(world, actorId, pos, _radius) {
  /** @type {string[]} */
  const messages = [];
  let found = false;

  for (const [doorId, secret, doorPos] of world.query(SecretDoor, Position)) {
    if (secret.revealed) continue;

    const dx = Math.abs((doorPos.x | 0) - (pos.x | 0));
    const dy = Math.abs((doorPos.y | 0) - (pos.y | 0));
    const dist = dx + dy;
    if (dist === 1) {
      const tile = getTile(doorPos.x, doorPos.y);
      if (tile === TILE_WALL) setTile(doorPos.x, doorPos.y, TILE_DOOR);
      world.set(doorId, SecretDoor, { ...secret, revealed: true });
      invalidateTileQueryCache(world);
      found = true;
      messages.push("*** you find a hidden door ***");
      world.emit("search:revealed", {
        actorId,
        entityId: doorId,
        kind: "secret_door",
        at: { x: doorPos.x, y: doorPos.y },
      });
    } else if (dist <= 2) {
      found = true;
      const hint = SECRET_HINTS[String(secret.hintKind || "hollow")] || SECRET_HINTS.hollow;
      messages.push(`*** ${hint} ***`);
      world.emit("search:hint", {
        actorId,
        entityId: doorId,
        kind: "secret_door",
        hintKind: secret.hintKind,
        at: { x: doorPos.x, y: doorPos.y },
      });
    }
  }

  return { found, messages };
}

/**
 * The ordered list of search resolvers.
 * Add new resolvers here to extend the search pipeline.
 * @type {Array<(world: import('../../lib/ecs-js/index.js').World, actorId: number, pos: {x:number,y:number}, radius: number) => {found:boolean,messages:string[]}>}
 */
const searchResolvers = [
  trapResolver,
  secretDoorResolver,
  // hiddenMonsterResolver,
  // invisibleMonsterResolver,
  // concealedItemResolver,
];

/**
 * @param {import('../../lib/ecs-js/index.js').World} world
 */
export function searchSystem(world) {
  for (const [actorId] of world.query(SearchIntent)) {
    // Consume intent
    try { world.remove(actorId, SearchIntent); } catch {}

    // Guard against dead actors
    const vit = world.get(actorId, Vitality);
    if (vit && (vit.hp | 0) <= 0) continue;

    const pos = world.get(actorId, Position);
    if (!pos) continue;

    // Determine search radius from vision range
    // Note: Brain.visionRange defines the current effective radius.
    // Future: incorporate BaseStats.perception into a discovery roll
    // (e.g. 1d20 + perception >= trap.difficulty to reveal traps).
    const brain = world.get(actorId, Brain);
    const radius = brain ? (brain.visionRange | 0) : 6;

    // Emit the radial pulse VFX event (display layer listens)
    world.emit('search:pulse', { actorId, at: { x: pos.x, y: pos.y }, radius });

    // Announce the search
    world.emit('message', { text: '*** you search the area ***', type: 'system' });

    // Run each resolver and collect results
    let anyFound = false;
    /** @type {string[]} */
    const revealMessages = [];

    for (const resolver of searchResolvers) {
      const result = resolver(world, actorId, pos, radius);
      if (result.found) {
        anyFound = true;
        for (const msg of result.messages) revealMessages.push(msg);
      }
    }

    // Emit reveal messages
    for (const msg of revealMessages) {
      world.emit('message', { text: msg, type: 'system' });
    }

    // If nothing was found, say so
    if (!anyFound) {
      world.emit('message', { text: '*** you find nothing ***', type: 'system' });
    }
  }
}
