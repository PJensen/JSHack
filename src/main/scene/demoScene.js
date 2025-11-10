import { createFrom } from "../../lib/ecs-js/archetype.js";
import { playerEntity } from "../../rules/utils/queries.js";
import { createPlayer } from "../../rules/archetypes/Player.js";
import { Door } from "../../rules/archetypes/Door.js";
import { DoorState } from "../../rules/components/DoorState.js";
import { Collider } from "../../rules/components/Collider.js";
import { HealthPotion, GoldStack, ArrowsStack } from "../../rules/archetypes/Items.js";
import { Spawner } from "../../rules/archetypes/Spawner.js";
import { ActiveEffects } from "../../rules/components/ActiveEffects.js";
import { NamedIdentity } from "../../rules/components/NamedIdentity.js";
import { Position } from "../../rules/components/Position.js";
import { Facing } from "../../rules/components/Facing.js";
import { ItemInfo } from "../../rules/components/ItemInfo.js";
import { Mana } from "../../rules/components/Mana.js";
import { Brain } from "../../rules/components/Brain.js";
import { Vitality } from "../../rules/components/Vitality.js";
import { buildEquipmentItem } from "../../rules/data/equipmentLoader.js";
import { createRng } from "../../lib/ecs-js/rng.js";
import { generateRectRoom } from "../../rules/environment/dungeonGenerator.js";
import { LightSource } from "../../rules/components/LightSource.js";
import { Trap } from "../../rules/components/Trap.js";
import { DungeonGeometry } from "../../rules/components/DungeonGeometry.js";
import { Interactable } from "../../rules/components/Interactable.js";
import { DungeonLevel } from "../../rules/components/Dungeon.js";

const ROOM_WIDTH = 11;
const ROOM_HEIGHT = 11;
const LOWER_ROOM_WIDTH = 19;
const LOWER_ROOM_HEIGHT = 13;
const LOWER_ROOM_OFFSET_Y = 64;
const MAIN_DEPTH = 1;
const LOWER_DEPTH = 2;

/**
 * Populate a small demo scene with a player, tiles, and items.
 * @param {import('../../lib/ecs-js/index.js').World} world
 */
export function populateDemoScene(world) {
  const { room, labeledRooms, doors, kernel, entityId } = generateRectRoom(world, {
    width: ROOM_WIDTH,
    height: ROOM_HEIGHT,
    name: "Demo Room",
  });

  const rooms = { ...(labeledRooms || {}) };
  if (!rooms.main) rooms.main = room;
  rooms.main.depth = MAIN_DEPTH;
  for (const info of Object.values(rooms)) {
    if (info && !Number.isFinite(info.depth)) info.depth = MAIN_DEPTH;
  }

  const lowerRoom = ensureLowerLevelRoom(world, {
    kernel,
    dungeonEntityId: entityId,
    anchor: rooms.main,
  });
  if (lowerRoom) rooms.lower = lowerRoom;

  ensurePlayer(world, rooms.main.center);
  if (Array.isArray(doors) && doors.length) placeDoors(world, doors);
  grantInitialShield(world);

  // Lighting and flavor in main room
  placeTorch(world, rooms.main);
  placeSpellbook(world, rooms.main);

  // Spread items around adjoining rooms
  placeBlastwaveScroll(world, rooms.south ?? rooms.main);
  setPlayerStats(world);
  dropPotions(world, rooms.east ?? rooms.main);
  dropGold(world, rooms.north ?? rooms.main);
  dropArrows(world, rooms.south ?? rooms.main);
  spawnMonsters(world, rooms.east ?? rooms.main);
  dropEquipment(world, rooms.main, rooms);
  // Place spike trap and a helpful potion near the bow
  placeSpikeTrap(world, rooms);
  placeBowRoomPotion(world, rooms);
  placeOmniDirectionalStairs(world, rooms);
}

function ensurePlayer(world, center) {
  const existing = playerEntity(world);
  if (existing) {
    world.set(existing.id, Position, { x: center.x, y: center.y });
    const facing = world.get(existing.id, Facing);
    if (facing) {
      world.set(existing.id, Facing, { x: 1, y: 0 });
    }
    return;
  }
  createPlayer(world, { x: center.x, y: center.y, name: "Hero" });
}

function placeDoors(world, positions) {
  const eps = 0.25;
  for (const p of positions) {
    const doorX = p.x;
    const doorY = p.y;
    let existingDoorId = null;
    for (const [id, pos] of world.query(Position, DoorState)) {
      if (!pos) continue;
      if (Math.abs(pos.x - doorX) < eps && Math.abs(pos.y - doorY) < eps) {
        existingDoorId = id;
        break;
      }
    }
    if (existingDoorId != null) {
      world.set(existingDoorId, Position, { x: doorX, y: doorY });
      world.set(existingDoorId, DoorState, { open: false, locked: false });
      const collider = world.get(existingDoorId, Collider);
      if (collider) {
        world.set(existingDoorId, Collider, { ...collider, solid: true, blocksSight: true });
      }
    } else {
      createFrom(world, Door, { x: doorX, y: doorY });
    }
  }
}

function placeSpikeTrap(world, rooms) {
  const north = rooms?.north ?? rooms.main;
  const at = { x: north.center.x, y: north.center.y + 3 };
  const trap = world.create();
  world.add(trap, Position, { x: at.x, y: at.y });
  world.add(trap, Trap, { type: "spike", revealed: false, armed: true, script: 'trap_spike', params: { percent: 0.25 } });
  // No NamedIdentity initially; added on trigger to reveal '^'
}

function placeBowRoomPotion(world, rooms) {
  const north = rooms?.north ?? rooms.main;
  const pos = { x: north.center.x + 1.5, y: north.center.y }; // a tile to the right of the bow
  const p = createFrom(world, HealthPotion, {});
  world.add(p, Position, pos);
}

function grantInitialShield(world) {
  const pe = playerEntity(world);
  if (!pe) return;
  const ae = world.get(pe.id, ActiveEffects);
  if (ae && Array.isArray(ae.effects)) {
    ae.effects.push({ key: "invulnerable", turnsLeft: 10, potency: 1 });
  } else {
    world.add(pe.id, ActiveEffects, {
      effects: [{ key: "invulnerable", turnsLeft: 10, potency: 1 }]
    });
  }
}

function placeSpellbook(world, room) {
  const { center } = room;
  const book = world.create();
  world.add(book, NamedIdentity, { name: "Spellbook of Lightning", identity: "book_lightning" });
  world.add(book, Position, { x: center.x + 2, y: center.y + 1.5 });
  world.add(book, ItemInfo, {
    type: "learn",
    slot: "brain",
    description: "Teaches Lightning.",
    weight: 1,
    value: 0,
    count: 1,
    rarity: 1,
    rarityName: "rare",
  });

  // New: Meteor spellbook
  const book2 = world.create();
  world.add(book2, NamedIdentity, { name: "Spellbook of Meteor", identity: "book_meteor" });
  world.add(book2, Position, { x: center.x - 2, y: center.y + 1.5 });
  world.add(book2, ItemInfo, {
    type: "learn",
    slot: "brain",
    description: "Teaches Meteor.",
    weight: 1,
    value: 0,
    count: 1,
    rarity: 1,
    rarityName: "rare",
  });
}

function placeBlastwaveScroll(world, room) {
  const { center } = room;
  const scroll = world.create();
  world.add(scroll, NamedIdentity, { name: "Scroll of Blast Wave", identity: "scroll_blastwave" });
  world.add(scroll, Position, { x: center.x, y: center.y - 2 });
  world.add(scroll, ItemInfo, {
    type: "scroll",
    slot: "bag",
    description: "Casts Blast Wave without learning it.",
    weight: 0.1,
    value: 0,
    count: 1,
    rarity: 1,
    rarityName: "rare",
  });
}

function placeTorch(world, room) {
  const { center, halfWidth, halfHeight } = room;
  const torch = world.create();
  const offsetX = center.x + (halfWidth - 1.2);
  const offsetY = center.y - (halfHeight - 1.2);
  world.add(torch, NamedIdentity, { name: "Wall Torch", identity: "torch" });
  world.add(torch, Position, { x: offsetX, y: offsetY });
  world.add(torch, LightSource, {
    radius: 7.5,
    intensity: 1.0,
    color: "#ffb36b",
    flicker: 0.45,
    style: "torch",
    emitter: "torch",
  });
}

function setPlayerStats(world) {
  const pe = playerEntity(world);
  if (!pe) return;
  world.add(pe.id, Mana, { mana: 50, maxMana: 50, manaRegen: 1 });
  world.add(pe.id, Vitality, { hp: 100, maxHp: 100 });
  // Ensure intelligence comfortably above any spell thresholds
  try { world.mutate(pe.id, Brain, (r) => { r.intelligence = Math.max(16, Number(r.intelligence || 0)); }); } catch {}
}

function dropPotions(world, room) {
  const { center } = room;
  const p1 = createFrom(world, HealthPotion, {});
  world.add(p1, Position, { x: center.x + 2.5, y: center.y });
  const p2 = createFrom(world, HealthPotion, {});
  world.add(p2, Position, { x: center.x - 2.5, y: center.y });
}

function dropGold(world, room) {
  const { center } = room;
  const rng = createRng(world.seed >>> 0 ^ 0x9e3779b9);
  const coins = rng.int(12, 47);
  const gold = createFrom(world, GoldStack, {});
  world.add(gold, Position, { x: center.x - 1, y: center.y - 1 });
  world.mutate(gold, ItemInfo, (r) => { r.count = coins; });
}

function dropArrows(world, room) {
  const { center } = room;
  const arrows = createFrom(world, ArrowsStack, {});
  world.add(arrows, Position, { x: center.x + 1.5, y: center.y - 1.5 });
}

function spawnMonsters(world, room) {
  const { center } = room;
  // Place a single spawner instead of static monsters for testing
  createFrom(world, Spawner, {
    x: center.x + 2,
    y: center.y,
    name: "Monster Spawner",
    maxConcurrent: 3,
    cooldownTicks: 20,
    totalToSpawn: 15,
    spawnRadius: 0.75,
    spawnParams: { name: "Goblin", identity: "monster" }
  });
}

function dropEquipment(world, mainRoom, rooms) {
  const { center, halfWidth, halfHeight } = mainRoom;
  const eqSword = buildEquipmentItem(world, "sword_plain", { affixes: ["fierce"] });
  world.add(eqSword, Position, { x: center.x - (halfWidth - 2), y: center.y - (halfHeight - 2) });

  // Put armor in the east room if present
  const east = rooms?.east ?? mainRoom;
  const armorPos = {
    x: east.center.x + (east.halfWidth - 2),
    y: east.center.y + (east.halfHeight - 2),
  };
  const thornArmor = buildEquipmentItem(world, "chain_armor", { affixes: ["thorns1"] });
  world.add(thornArmor, Position, armorPos);

  // Wooden bow in the north room if present
  const north = rooms?.north ?? mainRoom;
  const woodBow = buildEquipmentItem(world, "bow_wood", {});
  world.add(woodBow, Position, { x: north.center.x, y: north.center.y });
}

function ensureLowerLevelRoom(world, { kernel, dungeonEntityId, anchor }) {
  if (!world || !kernel || !dungeonEntityId || !anchor) return null;
  const carveFlags = { affectsMove: true, affectsOccl: true };
  const halfWidth = LOWER_ROOM_WIDTH * 0.5;
  const halfHeight = LOWER_ROOM_HEIGHT * 0.5;
  const center = {
    x: anchor.center.x,
    y: anchor.center.y + LOWER_ROOM_OFFSET_Y,
  };

  kernel.carveBox(center.x, center.y, halfWidth, halfHeight, 0, carveFlags);

  const lowerRoom = {
    key: "lower",
    shape: "rect-room",
    width: LOWER_ROOM_WIDTH,
    height: LOWER_ROOM_HEIGHT,
    halfWidth,
    halfHeight,
    center: { ...center },
    origin: { x: center.x - halfWidth, y: center.y - halfHeight },
    depth: LOWER_DEPTH,
  };

  refreshDungeonGeometry(world, kernel, dungeonEntityId, lowerRoom);
  return lowerRoom;
}

function refreshDungeonGeometry(world, kernel, dungeonEntityId, lowerRoom) {
  if (!world || !kernel || !dungeonEntityId) return;
  const snapshot = kernel.snapshot();
  const current = world.get(dungeonEntityId, DungeonGeometry);
  const meta = cloneDungeonMeta(current?.meta ?? {});
  if (lowerRoom) {
    if (!Array.isArray(meta.rooms)) meta.rooms = [];
    meta.rooms = meta.rooms.map((r) => ({ ...r }));
    meta.rooms.push({ key: lowerRoom.key, ...lowerRoom });
    meta.layers = { ...(meta.layers || {}), lower: { ...lowerRoom } };
  }

  world.set(dungeonEntityId, DungeonGeometry, {
    seed: snapshot.seed,
    mbrVersion: snapshot.mbrVersion,
    moveVersion: snapshot.moveVersion,
    occlVersion: snapshot.occlVersion,
    mbr: snapshot.mbr,
    primitives: snapshot.primitives,
    meta,
    options: snapshot.options,
  });
}

function cloneDungeonMeta(meta) {
  try {
    return JSON.parse(JSON.stringify(meta));
  } catch {
    return { ...meta };
  }
}

function placeOmniDirectionalStairs(world, rooms) {
  const lower = rooms?.lower;
  const main = rooms?.main;
  const east = rooms?.east ?? main;
  if (!lower || !main || !east) return;

  const mainTop = createStairsEntity(world, {
    name: "Descending Stair",
    identity: "stairs_up",
    x: main.center.x - 1.5,
    y: main.center.y + 1.5,
    depth: MAIN_DEPTH,
  });
  const eastTop = createStairsEntity(world, {
    name: "Eastern Stair",
    identity: "stairs_up",
    x: east.center.x - 1.5,
    y: east.center.y - 1.5,
    depth: MAIN_DEPTH,
  });
  const lowerWest = createStairsEntity(world, {
    name: "Lower Stair",
    identity: "stairs_down",
    x: lower.center.x - 4,
    y: lower.center.y,
    depth: LOWER_DEPTH,
  });
  const lowerEast = createStairsEntity(world, {
    name: "Hidden Stair",
    identity: "stairs_down",
    x: lower.center.x + 4,
    y: lower.center.y,
    depth: LOWER_DEPTH,
  });

  linkStairs(world, mainTop, lowerWest, {
    offsetX: 0,
    offsetY: 1.5,
    direction: "down",
    sourceDepth: MAIN_DEPTH,
    targetDepth: LOWER_DEPTH,
  });
  linkStairs(world, lowerWest, mainTop, {
    offsetX: 0,
    offsetY: -1,
    direction: "up",
    sourceDepth: LOWER_DEPTH,
    targetDepth: MAIN_DEPTH,
  });
  linkStairs(world, eastTop, lowerEast, {
    offsetX: 0,
    offsetY: 1.5,
    direction: "down",
    sourceDepth: MAIN_DEPTH,
    targetDepth: LOWER_DEPTH,
  });
  linkStairs(world, lowerEast, eastTop, {
    offsetX: 0,
    offsetY: -1,
    direction: "up",
    sourceDepth: LOWER_DEPTH,
    targetDepth: MAIN_DEPTH,
  });
}

function createStairsEntity(world, { x, y, name, identity, depth }) {
  const id = world.create();
  world.add(id, Position, { x, y });
  world.add(id, NamedIdentity, { name, identity });
  world.add(id, Collider, { solid: true, blocksSight: false });
  if (Number.isFinite(depth)) {
    try { world.add(id, DungeonLevel, { depth }); } catch {}
  }
  return id;
}

function linkStairs(world, sourceId, targetId, { offsetX = 0, offsetY = 0, direction = "travel", sourceDepth = null, targetDepth = null, depthDelta = null }) {
  let delta = Number.isFinite(depthDelta) ? depthDelta : null;
  if (delta == null && Number.isFinite(sourceDepth) && Number.isFinite(targetDepth)) {
    delta = targetDepth - sourceDepth;
  }
  const params = {
    targetId,
    arrivalOffset: { x: offsetX, y: offsetY },
    direction,
    faceAway: true,
    sourceDepth: Number.isFinite(sourceDepth) ? sourceDepth : null,
    targetDepth: Number.isFinite(targetDepth) ? targetDepth : null,
    depthDelta: delta,
  };
  if (world.has(sourceId, Interactable)) {
    world.set(sourceId, Interactable, { action: "useStairs", params });
  } else {
    world.add(sourceId, Interactable, { action: "useStairs", params });
  }
}
