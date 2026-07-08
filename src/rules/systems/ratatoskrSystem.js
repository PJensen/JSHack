import { AggroState, AGGRO_LEVELS } from "../components/AggroState.js";
import { Inventory } from "../components/Inventory.js";
import { Interactable } from "../components/Interactable.js";
import { MoveIntent } from "../components/Intents/MoveIntent.js";
import { NamedIdentity } from "../components/NamedIdentity.js";
import { Position } from "../components/Position.js";
import { ScriptState } from "../components/ScriptState.js";
import { ShopInventory } from "../components/ShopInventory.js";
import { Unpaid } from "../components/Unpaid.js";
import { isWalkable } from "../environment/dungeon/tileMap.js";
import { CARDINAL_DIRS } from "../utils/directions.js";
import { isEntityOnCurrentFloor } from "../utils/floorEntities.js";
import { playerEntity } from "../utils/queries.js";
import { currentDepth } from "../utils/worldAccess.js";

const APPEAR_MIN_TURNS = 45;
const APPEAR_SPREAD_TURNS = 90;
const NEAR_RADIUS_MIN = 4;
const NEAR_RADIUS_MAX = 9;

function chebyshev(a, b) {
  return Math.max(Math.abs((a.x | 0) - (b.x | 0)), Math.abs((a.y | 0) - (b.y | 0)));
}

function ensureRatatoskrState(world, id) {
  let state = world.get(id, ScriptState);
  if (!state) {
    try { world.add(id, ScriptState, { data: {} }); } catch {}
    state = world.get(id, ScriptState);
  }
  if (!state || !state.data || typeof state.data !== "object") return null;
  if (!state.data.ratatoskr || typeof state.data.ratatoskr !== "object") {
    state.data.ratatoskr = {
      nextAppearTurn: (world.step | 0) + APPEAR_MIN_TURNS,
      visits: 0,
      lastBarkTurn: -9999,
    };
  }
  return state.data.ratatoskr;
}

function ensureRatatoskrAffordances(world, id) {
  if (!world.has(id, Interactable)) {
    try {
      world.add(id, Interactable, {
        action: "talkToNPC",
        params: { dialogId: "norse:ratatoskr", dialogue: "Ratatoskr vibrates with news." },
      });
    } catch {}
  }
  if (!world.has(id, ShopInventory)) {
    try { world.add(id, ShopInventory, { buyMarkup: 3.0, sellDiscount: 0.15 }); } catch {}
  }
  if (!world.has(id, Inventory)) {
    try { world.add(id, Inventory, { capacity: 12 }); } catch {}
  } else {
    const inv = world.get(id, Inventory);
    if (inv && (Number(inv.capacity || 0) | 0) < 12) inv.capacity = 12;
  }
  const aggro = world.get(id, AggroState);
  if (aggro && aggro.alertLevel !== AGGRO_LEVELS.unaware) {
    aggro.alertLevel = AGGRO_LEVELS.unaware;
    aggro.targetId = 0;
  }
}

function clearFloorCache(world, shopkeeperId) {
  const dead = [];
  for (const [itemId, unpaid] of world.query(Unpaid)) {
    if ((unpaid.shopkeeperId | 0) === (shopkeeperId | 0) && world.has(itemId, Position)) dead.push(itemId);
  }
  for (const itemId of dead) {
    if (world.isAlive(itemId)) world.destroy(itemId);
  }
}

function pickNearPlayer(world, playerPos) {
  const px = playerPos.x | 0;
  const py = playerPos.y | 0;
  const start = Math.floor(world.rand() * CARDINAL_DIRS.length) | 0;
  for (let ring = NEAR_RADIUS_MIN; ring <= NEAR_RADIUS_MAX; ring++) {
    for (let i = 0; i < CARDINAL_DIRS.length; i++) {
      const dir = CARDINAL_DIRS[(start + i) % CARDINAL_DIRS.length];
      const side = world.rand() < 0.5 ? -1 : 1;
      const skew = Math.floor(world.rand() * (ring + 1)) * side;
      const x = px + dir.dx * ring + (dir.dy !== 0 ? skew : 0);
      const y = py + dir.dy * ring + (dir.dx !== 0 ? skew : 0);
      if (isWalkable(x, y)) return { x, y };
    }
  }
  return null;
}

function scheduleNext(world, state) {
  state.nextAppearTurn = (world.step | 0) + APPEAR_MIN_TURNS + (Math.floor(world.rand() * APPEAR_SPREAD_TURNS) | 0);
}

function bark(world, id, text) {
  world.emit?.("npc:dialogue", {
    actor: id,
    text,
  });
}

function ratatoskrEntities(world) {
  const out = [];
  for (const [id, ni, pos] of world.query(NamedIdentity, Position)) {
    if (String(ni?.identity || "") === "ratatoskr") out.push({ id, pos });
  }
  return out;
}

export function ratatoskrSystem(world) {
  if (currentDepth(world, 1) !== 0) return;
  const player = playerEntity(world);
  if (!player) return;

  for (const rec of ratatoskrEntities(world)) {
    const id = rec.id;
    if (!isEntityOnCurrentFloor(world, id, { fallbackWhenNoDungeonState: true })) continue;
    ensureRatatoskrAffordances(world, id);
    const state = ensureRatatoskrState(world, id);
    if (!state) continue;

    const dist = chebyshev(rec.pos, player.pos);
    if (dist <= 2) {
      state.nextAppearTurn = Math.max(Number(state.nextAppearTurn || 0) | 0, (world.step | 0) + 20);
      if ((world.step | 0) - (Number(state.lastBarkTurn || 0) | 0) >= 80) {
        state.lastBarkTurn = world.step | 0;
        bark(world, id, "Ratatoskr says, 'If you hear your name from underground, answer in someone else's voice.'");
      }
      continue;
    }

    if ((world.step | 0) >= (Number(state.nextAppearTurn || 0) | 0)) {
      const dest = pickNearPlayer(world, player.pos);
      if (dest) {
        clearFloorCache(world, id);
        world.set(id, Position, dest);
        state.visits = (Number(state.visits || 0) | 0) + 1;
        state.lastBarkTurn = world.step | 0;
        bark(world, id, "A red-brown streak drops out of nowhere. 'Wrong tree, right customer.'");
      }
      scheduleNext(world, state);
      continue;
    }

    if (dist <= 10 && !world.has(id, MoveIntent) && world.rand() < 0.30) {
      const dir = CARDINAL_DIRS[Math.floor(world.rand() * CARDINAL_DIRS.length)];
      const nx = (rec.pos.x | 0) + dir.dx;
      const ny = (rec.pos.y | 0) + dir.dy;
      if (isWalkable(nx, ny)) {
        try { world.add(id, MoveIntent, { dx: dir.dx, dy: dir.dy }); } catch {}
      }
    }
  }
}
