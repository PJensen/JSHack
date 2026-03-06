// main/debug/consoleCommands.js
// Built-in commands for the debug console.

import { playerEntity } from "../../rules/utils/queries.js";
import { Inventory } from "../../rules/components/Inventory.js";
import { ActiveEffects } from "../../rules/components/ActiveEffects.js";
import { Position } from "../../rules/components/Position.js";
import { Vitality } from "../../rules/components/Vitality.js";
import { DungeonState } from "../../rules/components/DungeonState.js";
import { createItemById } from "../../rules/utils/itemFactory.js";
import { addToInventory } from "../../rules/utils/inventoryFacade.js";
import { applyMutation } from "../../rules/interaction/mutations.js";
import { getMonster, MONSTERS } from "../../rules/data/monsters.js";
import { markExplored } from "../../rules/environment/dungeon/exploredMap.js";
import { CHUNK_SIZE, TILE_FLOOR } from "../../rules/environment/dungeon/constants.js";
import { getTile } from "../../rules/environment/dungeon/tileMap.js";

/**
 * Register all built-in debug commands.
 * @param {{ registerCommand(name: string, helpText: string, handler: function): void }} console
 * @param {{ world: object, messageLog: { log(msg: object): void } }} deps
 */
export function registerBuiltinCommands(console, { world, messageLog }) {

  // ---- give <item_id> [count] ----
  console.registerCommand('give', 'give <item_id> [count] — spawn item in inventory', (argsStr) => {
    const parts = argsStr.split(/\s+/).filter(Boolean);
    if (!parts.length) return 'Usage: give <item_id> [count]';
    const itemId = parts[0];
    const count = parseInt(parts[1] || '1', 10) || 1;

    const pe = playerEntity(world);
    if (!pe) return 'No player entity found.';
    const inv = world.get(pe.id, Inventory);
    if (!inv) return 'Player has no inventory.';

    const createdId = createItemById(world, itemId, { count });
    if (createdId === null) return `Unknown item: "${itemId}"`;
    addToInventory(world, pe.id, createdId);
    return `Created ${count}x ${itemId}`;
  });

  // ---- effect <key> [turns] ----
  console.registerCommand('effect', 'effect <key> [turns] — apply status effect', (argsStr) => {
    const parts = argsStr.split(/\s+/).filter(Boolean);
    if (!parts.length) return 'Usage: effect <key> [turns]';
    const key = parts[0].toLowerCase();
    const turnsLeft = parseInt(parts[1] || '5', 10) || 5;

    const pe = playerEntity(world);
    if (!pe) return 'No player entity found.';
    let ae = world.get(pe.id, ActiveEffects);
    if (!ae) {
      world.add(pe.id, ActiveEffects, { effects: [] });
      ae = world.get(pe.id, ActiveEffects);
    }
    ae.effects.push({ key, turnsLeft, potency: 1, stacks: 1 });
    return `Applied ${key} for ${turnsLeft} turn(s)`;
  });

  // ---- heal ----
  console.registerCommand('heal', 'Fully heal the player', () => {
    const pe = playerEntity(world);
    if (!pe) return 'No player entity found.';
    const vit = world.get(pe.id, Vitality);
    if (!vit) return 'Player has no Vitality component.';
    vit.hp = vit.maxHp;
    return `Healed to ${vit.hp}/${vit.maxHp}`;
  });

  // ---- tp <x> <y> ----
  console.registerCommand('tp', 'tp <x> <y> — teleport player to world coordinates', (argsStr) => {
    const parts = argsStr.split(/\s+/).filter(Boolean);
    if (parts.length < 2) return 'Usage: tp <x> <y>';
    const x = parseInt(parts[0], 10);
    const y = parseInt(parts[1], 10);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return 'Coordinates must be numbers.';

    const pe = playerEntity(world);
    if (!pe) return 'No player entity found.';
    const pos = world.get(pe.id, Position);
    if (!pos) return 'Player has no Position.';
    pos.x = x;
    pos.y = y;
    return `Teleported to (${x}, ${y})`;
  });

  // ---- god ----
  let _godMode = false;
  console.registerCommand('god', 'Toggle god mode (invincibility)', () => {
    _godMode = !_godMode;
    const pe = playerEntity(world);
    if (!pe) return 'No player entity found.';
    const vit = world.get(pe.id, Vitality);
    if (_godMode) {
      // Set HP very high
      if (vit) { vit.maxHp = 99999; vit.hp = 99999; }
    } else {
      // Reset to a reasonable value (keep current if sane)
      if (vit && vit.maxHp > 9999) { vit.maxHp = 20; vit.hp = 20; }
    }
    return `God mode ${_godMode ? 'ON' : 'OFF'}`;
  });

  // ---- spawn <monster_id> ----
  console.registerCommand('spawn', 'spawn <monster_id> — spawn monster near player', (argsStr) => {
    const monsterId = argsStr.trim();
    if (!monsterId) {
      const ids = MONSTERS.map(m => m.id).join(', ');
      return `Usage: spawn <monster_id>\nAvailable: ${ids}`;
    }
    const def = getMonster(monsterId);
    if (!def) return `Unknown monster: "${monsterId}"`;

    const pe = playerEntity(world);
    if (!pe) return 'No player entity found.';
    const pos = world.get(pe.id, Position);
    if (!pos) return 'Player has no Position.';

    // Find a free adjacent tile
    const offsets = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]];
    let spawnX = pos.x + 1, spawnY = pos.y;
    for (const [dx, dy] of offsets) {
      const tx = pos.x + dx;
      const ty = pos.y + dy;
      const tile = getTile(tx, ty);
      if (tile === TILE_FLOOR) { spawnX = tx; spawnY = ty; break; }
    }

    applyMutation(world, {
      type: 'spawnMonster', monsterId,
      x: spawnX, y: spawnY,
      emitEvent: true,
    });
    return `Spawned ${def.name} at (${spawnX}, ${spawnY})`;
  });

  // ---- depth <n> ----
  console.registerCommand('depth', 'depth <n> — jump to dungeon floor N', (argsStr) => {
    const n = parseInt(argsStr.trim(), 10);
    if (!Number.isFinite(n) || n < 0) return 'Usage: depth <n> (n >= 0)';

    let currentDepth = 0;
    for (const [, ds] of world.query(DungeonState)) {
      currentDepth = ds.currentDepth;
      break;
    }
    if (n === currentDepth) return `Already on floor ${n}.`;

    world.emit('dungeon:teleport-depth', { targetDepth: n });
    return `Transitioning to floor ${n}...`;
  });

  // ---- reveal ----
  let _revealed = false;
  console.registerCommand('reveal', 'Toggle full map visibility (fog of war)', () => {
    _revealed = !_revealed;
    if (_revealed) {
      // Mark all loaded chunk tiles as explored
      // Iterate over a large area around the player
      const pe = playerEntity(world);
      const pos = pe ? world.get(pe.id, Position) : null;
      const cx = pos ? pos.x : 0;
      const cy = pos ? pos.y : 0;
      const radius = 200;
      for (let y = cy - radius; y <= cy + radius; y++) {
        for (let x = cx - radius; x <= cx + radius; x++) {
          markExplored(x, y);
        }
      }
      return 'Map revealed (200-tile radius). Run again to toggle off (next FOV update restores fog).';
    }
    return 'Reveal OFF — fog of war will restore on next move.';
  });
}
