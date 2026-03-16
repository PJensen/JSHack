// main/debug/consoleCommands.js
// Built-in commands for the debug console.

import { playerEntity } from "../../rules/utils/queries.js";
import { Inventory } from "../../rules/components/Inventory.js";
import { ActiveEffects } from "../../rules/components/ActiveEffects.js";
import { Position } from "../../rules/components/Position.js";
import { Vitality } from "../../rules/components/Vitality.js";
import { DungeonState } from "../../rules/components/DungeonState.js";
import { createItemById } from "../../rules/utils/itemFactory.js";
import { addToInventory, inventoryItems } from "../../rules/utils/inventoryFacade.js";
import { MONSTERS } from "../../rules/data/monsters.js";
import { markExplored } from "../../rules/environment/dungeon/exploredMap.js";
import { spawnDebugMonsterNearPlayer } from "./spawnDebugMonster.js";
import { WeatherState } from "../../rules/components/WeatherState.js";
import { Equipment, GEAR_SLOTS } from "../../rules/components/Equipment.js";
import { ItemInfo } from "../../rules/components/ItemInfo.js";
import { NamedIdentity } from "../../rules/components/NamedIdentity.js";
import { Faction } from "../../rules/components/Faction.js";
import { attachProcPackage, listProcPackageIds } from "../../rules/data/procPackages.js";

function describeItem(world, itemId) {
  const info = world.get(itemId, ItemInfo);
  const named = world.get(itemId, NamedIdentity);
  const identity = named?.identity || "unknown";
  const label = info?.name || named?.name || identity;
  const count = Math.max(1, Number(info?.count || 1) | 0);
  return `#${itemId} ${label} <${identity}> x${count}`;
}

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
  const GOD_SYM = Symbol.for("jshack:debug:godMode");
  function toggleGodMode() {
    world[GOD_SYM] = !world[GOD_SYM];
    const pe = playerEntity(world);
    if (!pe) return 'No player entity found.';
    let ae = world.get(pe.id, ActiveEffects);
    if (world[GOD_SYM]) {
      if (!ae) {
        world.add(pe.id, ActiveEffects, { effects: [] });
        ae = world.get(pe.id, ActiveEffects);
      }
      if (!ae.effects.some(e => e.key === 'invulnerable')) {
        ae.effects.push({ key: 'invulnerable', turnsLeft: 999999, potency: 1, stacks: 1 });
      }
    } else {
      if (ae) ae.effects = ae.effects.filter(e => e.key !== 'invulnerable');
    }
    const msg = `God mode ${world[GOD_SYM] ? 'ON' : 'OFF'}`;
    messageLog.log({ text: msg, type: 'system' });
    return msg;
  }
  console.registerCommand('god', 'Toggle god mode (invincibility)', toggleGodMode);

  // Allow keyboard cheat code (IDDQD) to trigger god mode
  try {
    window.addEventListener('debug:toggleGodMode', () => {
      toggleGodMode();
      world.tick(0);
    });
  } catch { /* no window in test env */ }

  // ---- spawn <monster_id> ----
  console.registerCommand('spawn', 'spawn <monster_id> — spawn monster near player', (argsStr) => {
    const monsterId = argsStr.trim();
    if (!monsterId) {
      const ids = MONSTERS.map(m => m.id).join(', ');
      return `Usage: spawn <monster_id>\nAvailable: ${ids}`;
    }
    const result = spawnDebugMonsterNearPlayer(world, monsterId);
    if (!result.ok) return result.error;
    return `Spawned ${result.name} at (${result.x}, ${result.y})`;
  });

  // ---- monsters ----
  console.registerCommand('monsters', 'List hostile monsters on the current floor', () => {
    const pe = playerEntity(world);
    const playerPos = pe ? world.get(pe.id, Position) : null;

    const rows = [];
    for (const [id, pos, vit, named, faction] of world.query(Position, Vitality, NamedIdentity, Faction)) {
      if (faction?.key !== 'enemy') continue;
      const name = named?.name || named?.identity || `entity ${id}`;
      const identity = named?.identity || 'unknown';
      const hp = `${Number(vit?.hp ?? 0)}/${Number(vit?.maxHp ?? 0)}`;
      const dist = playerPos ? Math.abs(pos.x - playerPos.x) + Math.abs(pos.y - playerPos.y) : null;
      rows.push({
        id,
        x: pos.x,
        y: pos.y,
        hp,
        name,
        identity,
        dist: dist ?? Number.POSITIVE_INFINITY,
      });
    }

    if (!rows.length) return 'No hostile monsters on the current floor.';

    rows.sort((a, b) => {
      if (a.dist !== b.dist) return a.dist - b.dist;
      if (a.y !== b.y) return a.y - b.y;
      if (a.x !== b.x) return a.x - b.x;
      return a.id - b.id;
    });

    return rows
      .map((row) => `#${row.id} ${row.name} <${row.identity}> @ (${row.x}, ${row.y}) HP ${row.hp}${Number.isFinite(row.dist) ? ` d=${row.dist}` : ''}`)
      .join('\n');
  });

  // ---- inventory [list] ----
  console.registerCommand('inventory', 'inventory list — list player inventory item ids', (argsStr) => {
    const action = argsStr.trim().toLowerCase();
    if (action && action !== 'list') return 'Usage: inventory list';

    const pe = playerEntity(world);
    if (!pe) return 'No player entity found.';

    const items = inventoryItems(world, pe.id);
    if (!items.length) return 'Inventory is empty.';
    return items.map((itemId) => describeItem(world, itemId)).join('\n');
  });

  // ---- equipment [list] ----
  console.registerCommand('equipment', 'equipment list — list equipped item ids by slot', (argsStr) => {
    const action = argsStr.trim().toLowerCase();
    if (action && action !== 'list') return 'Usage: equipment list';

    const pe = playerEntity(world);
    if (!pe) return 'No player entity found.';
    const eq = world.get(pe.id, Equipment);
    if (!eq) return 'Player has no Equipment component.';

    const lines = [];
    for (const slot of GEAR_SLOTS) {
      const itemId = Number(eq[slot] || 0) | 0;
      if (itemId > 0) {
        lines.push(`${slot}: ${describeItem(world, itemId)}`);
      } else {
        lines.push(`${slot}: empty`);
      }
    }
    return lines.join('\n');
  });

  // ---- enchant <item-id|slot:<name>> <proc-package-id> ----
  console.registerCommand('enchant', 'enchant <item-id|slot:ranged> <proc-package-id> — attach a proc package to an item', (argsStr) => {
    const parts = argsStr.split(/\s+/).filter(Boolean);
    if (parts.length < 2) {
      return `Usage: enchant <item-id|slot:ranged> <proc-package-id>\nAvailable packages: ${listProcPackageIds().join(', ')}`;
    }

    const targetRef = parts[0];
    const packageId = parts[1];
    const pe = playerEntity(world);
    if (!pe) return 'No player entity found.';

    let itemId = 0;
    if (targetRef.startsWith('slot:')) {
      const slot = targetRef.slice(5);
      if (!GEAR_SLOTS.includes(slot)) return `Unknown equipment slot: "${slot}"`;
      const eq = world.get(pe.id, Equipment);
      if (!eq) return 'Player has no Equipment component.';
      itemId = Number(eq[slot] || 0) | 0;
      if (!(itemId > 0)) return `No item equipped in slot "${slot}"`;
    } else {
      itemId = Number.parseInt(targetRef, 10) | 0;
      if (!(itemId > 0) || !world.isAlive?.(itemId) || !world.has(itemId, ItemInfo)) {
        return `Invalid item id: "${targetRef}"`;
      }
    }

    const rootId = attachProcPackage(world, itemId, packageId);
    if (!(rootId > 0)) {
      return `Failed to attach proc package "${packageId}". Available: ${listProcPackageIds().join(', ')}`;
    }
    return `Attached ${packageId} to ${describeItem(world, itemId)} via package node #${rootId}`;
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

  // ---- noclip ----
  const NOCLIP_SYM = Symbol.for("jshack:debug:noclip");
  console.registerCommand('noclip', 'Toggle noclip (walk through walls)', () => {
    world[NOCLIP_SYM] = !world[NOCLIP_SYM];
    return `Noclip ${world[NOCLIP_SYM] ? 'ON' : 'OFF'}`;
  });

  // ---- weather [clear|rain|heavy_rain] ----
  const WEATHER_TYPES = ['clear', 'rain', 'heavy_rain'];
  console.registerCommand('weather', 'weather [clear|rain|heavy_rain] — view or set weather', (argsStr) => {
    const arg = argsStr.trim().toLowerCase();

    // Query current weather
    let wsId = 0;
    let ws = null;
    for (const [id, w] of world.query(WeatherState)) {
      wsId = id;
      ws = w;
      break;
    }

    if (!ws) return 'No WeatherState entity found (are you on the overworld?)';

    if (!arg) return `Current weather: ${ws.current} (${ws.turnsRemaining} turns remaining)`;

    if (!WEATHER_TYPES.includes(arg)) {
      return `Unknown weather type: "${arg}"\nAvailable: ${WEATHER_TYPES.join(', ')}`;
    }

    const prev = ws.current;
    world.set(wsId, WeatherState, {
      current: arg,
      turnsRemaining: 100,
      transitionCooldown: 100,
    });
    world.emit?.("weather:changed", { weather: arg, prev });
    return `Weather set to ${arg} (100 turns)`;
  });
}
