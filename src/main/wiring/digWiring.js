import { createRng } from "../../lib/ecs-js/rng.js";
import { pickGem } from "../../rules/data/gems.js";
import { createItemById } from "../../rules/utils/itemFactory.js";
import { Position } from "../../rules/components/Position.js";

const INSTALLED = Symbol.for("jshack:main:digWiring:installed");

// Chance to find a gem per dig (~15%)
const DIG_GEM_CHANCE = 0.15;

/**
 * Wire up gem drops when the player digs a wall.
 * @param {{
 *   world: import("../../lib/ecs-js/index.js").World,
 * }} opts
 */
export function installDigWiring({ world }) {
  if (!world) return;
  if (world[INSTALLED]) return;
  world[INSTALLED] = true;

  world.on('tile:dug', ({ actor, x, y }) => {
    // Deterministic seed from world state + dig position
    const seed = ((world.seed >>> 0) ^ ((world.step * 0x9e3779b9) >>> 0) ^ ((x * 0x517cc1b7 + y * 0x85ebca6b) >>> 0)) >>> 0;
    const rng = createRng(seed);

    if (rng.next() >= DIG_GEM_CHANCE) return;

    // Pick a gem (gemstones, glass, and minerals all possible when mining)
    const gem = pickGem(rng);
    if (!gem) return;

    const gemId = createItemById(world, gem.id);
    if (gemId == null) return;

    world.add(gemId, Position, { x, y });
    try { world.emit?.('item:dropped', { itemId: gemId, count: 1, at: { x, y } }); } catch {}
  });
}
