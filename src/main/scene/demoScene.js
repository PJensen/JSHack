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
import { registerDungeonLevel, activateDungeonLevel } from "../../rules/environment/dungeonLevelManager.js";
import { ensureGeometryKernel } from "../../rules/environment/worldGeometry.js";

const ROOM_WIDTH = 11;
const ROOM_HEIGHT = 11;
const LOWER_ROOM_WIDTH = 19;
const LOWER_ROOM_HEIGHT = 13;
const MAIN_DEPTH = 1;
const LOWER_DEPTH = 2;
const STAIR_ALIGN_KEY = Symbol.for("jshack.dungeon.stairAlign");

/**
 * Populate a multi-level dungeon with portals on the surface and real stairs between depths.
 * @param {import('../../lib/ecs-js/index.js').World} world
 */
export function populateDemoScene(world) {
  const playerId = ensurePlayer(world, { x: 0, y: 0 });

  registerDungeonLevel(world, MAIN_DEPTH, buildSurfaceLevel);
  registerDungeonLevel(world, LOWER_DEPTH, buildLowerVaultLevel);

  const levelInfo = activateDungeonLevel(world, MAIN_DEPTH, { initial: true });
  if (levelInfo?.playerSpawn) {
    setPlayerPosition(world, playerId, levelInfo.playerSpawn);
  }

  setPlayerStats(world);
  grantInitialShield(world);
}

function ensurePlayer(world, center) {
  const existing = playerEntity(world);
  if (existing) {
    world.set(existing.id, Position, { x: center.x, y: center.y });
    const facing = world.get(existing.id, Facing);
    if (facing) {
      world.set(existing.id, Facing, { x: 1, y: 0 });
    }
    return existing.id;
  }
  const id = createPlayer(world, { x: center.x, y: center.y, name: "Hero" });
  return id;
}

function setPlayerPosition(world, playerId, pos) {
  if (!pos || !playerId) return;
  world.set(playerId, Position, { x: pos.x, y: pos.y });
  const facing = world.get(playerId, Facing);
  if (facing) {
    world.set(playerId, Facing, { x: 1, y: 0 });
  }
}

function buildSurfaceLevel(world) {
  const layout = generateRectRoom(world, {
    width: ROOM_WIDTH,
    height: ROOM_HEIGHT,
    name: "Demo Room",
  });

  const rooms = normalizeRooms(layout, MAIN_DEPTH);
  const created = [];

  created.push(...placeDoors(world, layout.doors));
  created.push(placeTorch(world, rooms.main));
  created.push(...placeSpellbooks(world, rooms.main));
  created.push(placeBlastwaveScroll(world, rooms.south ?? rooms.main));
  created.push(...dropPotions(world, rooms.east ?? rooms.main));
  created.push(dropGold(world, rooms.north ?? rooms.main));
  created.push(dropArrows(world, rooms.south ?? rooms.main));
  created.push(spawnMonsters(world, rooms.east ?? rooms.main));
  created.push(...dropEquipment(world, rooms.main, rooms));
  created.push(placeSpikeTrap(world, rooms));
  created.push(placeBowRoomPotion(world, rooms));

  const portalRoom = carvePortalVault(world, layout.kernel, layout.entityId, rooms.main);
  if (portalRoom) {
    rooms.portal = portalRoom;
    created.push(...placePortalNetwork(world, rooms.main, portalRoom));
  }

  const geometry = cloneGeometry(world, layout.entityId);

  const stairAlignment = computeStairAlignment(rooms);
  world[STAIR_ALIGN_KEY] = stairAlignment;

  created.push(createStairEntity(world, {
    name: "Main Stairwell",
    identity: "stairs_up",
    position: stairAlignment.main,
    depth: MAIN_DEPTH,
    targetDepth: LOWER_DEPTH,
    destination: stairAlignment.main,
    direction: "down",
  }));

  created.push(createStairEntity(world, {
    name: "East Stairwell",
    identity: "stairs_up",
    position: stairAlignment.east,
    depth: MAIN_DEPTH,
    targetDepth: LOWER_DEPTH,
    destination: stairAlignment.east,
    direction: "down",
  }));

  return { geometry, rooms, entities: flattenEntityIds(created), playerSpawn: rooms.main.center };
}

function buildLowerVaultLevel(world) {
  const align = world[STAIR_ALIGN_KEY] || defaultStairAlignment();
  const { geometry, room } = generateLowerVault(world);
  const rooms = { main: room };
  rooms.main.depth = LOWER_DEPTH;
  const created = [];

  created.push(placeTorch(world, room));

  created.push(createStairEntity(world, {
    name: "Ascent Shaft",
    identity: "stairs_down",
    position: align.main,
    depth: LOWER_DEPTH,
    targetDepth: MAIN_DEPTH,
    destination: align.main,
    direction: "up",
  }));

  created.push(createStairEntity(world, {
    name: "Hidden Shaft",
    identity: "stairs_down",
    position: align.east,
    depth: LOWER_DEPTH,
    targetDepth: MAIN_DEPTH,
    destination: align.east,
    direction: "up",
  }));

  return { geometry, rooms, entities: flattenEntityIds(created), playerSpawn: { ...align.main } };
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

function placeSpellbooks(world, room) {
  const ids = [];
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
  ids.push(book);

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
  ids.push(book2);
  return ids;
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
  return scroll;
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
  return torch;
}

function setPlayerStats(world) {
  const pe = playerEntity(world);
  if (!pe) return;
  world.add(pe.id, Mana, { mana: 50, maxMana: 50, manaRegen: 1 });
  world.add(pe.id, Vitality, { hp: 100, maxHp: 100 });
  try { world.mutate(pe.id, Brain, (r) => { r.intelligence = Math.max(16, Number(r.intelligence || 0)); }); } catch {}
}

function dropPotions(world, room) {
  const ids = [];
  const { center } = room;
  const p1 = createFrom(world, HealthPotion, {});
  world.add(p1, Position, { x: center.x + 2.5, y: center.y });
  ids.push(p1);
  const p2 = createFrom(world, HealthPotion, {});
  world.add(p2, Position, { x: center.x - 2.5, y: center.y });
  ids.push(p2);
  return ids;
}

function dropGold(world, room) {
  const { center } = room;
  const rng = createRng(world.seed >>> 0 ^ 0x9e3779b9);
  const coins = rng.int(12, 47);
  const gold = createFrom(world, GoldStack, {});
  world.add(gold, Position, { x: center.x - 1, y: center.y - 1 });
  world.mutate(gold, ItemInfo, (r) => { r.count = coins; });
  return gold;
}

function dropArrows(world, room) {
  const { center } = room;
  const arrows = createFrom(world, ArrowsStack, {});
  world.add(arrows, Position, { x: center.x + 1.5, y: center.y - 1.5 });
  return arrows;
}

function spawnMonsters(world, room) {
  const { center } = room;
  return createFrom(world, Spawner, {
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
  const ids = [];
  const { center, halfWidth, halfHeight } = mainRoom;
  const eqSword = buildEquipmentItem(world, "sword_plain", { affixes: ["fierce"] });
  world.add(eqSword, Position, { x: center.x - (halfWidth - 2), y: center.y - (halfHeight - 2) });
  ids.push(eqSword);

  const east = rooms?.east ?? mainRoom;
  const armorPos = {
    x: east.center.x + (east.halfWidth - 2),
    y: east.center.y + (east.halfHeight - 2),
  };
  const thornArmor = buildEquipmentItem(world, "chain_armor", { affixes: ["thorns1"] });
  world.add(thornArmor, Position, armorPos);
  ids.push(thornArmor);

  const north = rooms?.north ?? mainRoom;
  const woodBow = buildEquipmentItem(world, "bow_wood", {});
  world.add(woodBow, Position, { x: north.center.x, y: north.center.y });
  ids.push(woodBow);
  return ids;
}

function placeSpikeTrap(world, rooms) {
  const north = rooms?.north ?? rooms.main;
  const at = { x: north.center.x, y: north.center.y + 3 };
  const trap = world.create();
  world.add(trap, Position, { x: at.x, y: at.y });
  world.add(trap, Trap, { type: "spike", revealed: false, armed: true, script: 'trap_spike', params: { percent: 0.25 } });
  return trap;
}

function placeBowRoomPotion(world, rooms) {
  const north = rooms?.north ?? rooms.main;
  const pos = { x: north.center.x + 1.5, y: north.center.y };
  const p = createFrom(world, HealthPotion, {});
  world.add(p, Position, pos);
  return p;
}

function placeDoors(world, positions) {
  if (!Array.isArray(positions)) return [];
  const ids = [];
  for (const p of positions) {
    const door = createFrom(world, Door, { x: p.x, y: p.y });
    ids.push(door);
    world.set(door, DoorState, { open: false, locked: false });
    const collider = world.get(door, Collider);
    if (collider) {
      world.set(door, Collider, { ...collider, solid: true, blocksSight: true });
    }
  }
  return ids;
}

function placePortalNetwork(world, mainRoom, portalRoom) {
  const ids = [];
  const entry = { x: mainRoom.center.x + mainRoom.halfWidth - 1, y: mainRoom.center.y };
  const exit = { x: portalRoom.center.x, y: portalRoom.center.y };
  const [a, b] = createPortalPair(world, entry, exit);
  ids.push(a, b);
  return ids;
}

function createPortalPair(world, fromPos, toPos) {
  const a = createPortal(world, { name: "Portal", identity: "portal_dark", position: fromPos });
  const b = createPortal(world, { name: "Portal", identity: "portal_light", position: toPos });
  world.add(a, Interactable, { action: "usePortal", params: { targetId: b, arrivalOffset: { x: 0, y: 0 } } });
  world.add(b, Interactable, { action: "usePortal", params: { targetId: a, arrivalOffset: { x: 0, y: 0 } } });
  return [a, b];
}

function createPortal(world, { name, identity, position }) {
  const id = world.create();
  world.add(id, NamedIdentity, { name, identity });
  world.add(id, Position, { x: position.x, y: position.y });
  world.add(id, Collider, { solid: true, blocksSight: false });
  return id;
}

function createStairEntity(world, { name, identity, position, depth, targetDepth, destination, direction }) {
  const id = world.create();
  world.add(id, Position, { x: position.x, y: position.y });
  world.add(id, NamedIdentity, { name, identity });
  world.add(id, Collider, { solid: true, blocksSight: false });
  if (Number.isFinite(depth)) {
    try { world.add(id, DungeonLevel, { depth }); } catch {}
  }
  world.add(id, Interactable, {
    action: "useStairs",
    params: {
      targetDepth,
      destinationPosition: destination ? { x: destination.x, y: destination.y } : null,
      direction,
      sourceDepth: depth,
      faceFrom: { x: position.x, y: position.y },
    }
  });
  return id;
}

function flattenEntityIds(values) {
  const out = [];
  const visit = (val) => {
    if (Array.isArray(val)) {
      for (const inner of val) visit(inner);
      return;
    }
    if (Number.isInteger(val)) out.push(val);
  };
  values.forEach(visit);
  return out;
}

function normalizeRooms(layout, depth) {
  const rooms = { ...(layout.labeledRooms || {}) };
  if (!rooms.main) rooms.main = layout.room;
  for (const info of Object.values(rooms)) {
    if (info && !Number.isFinite(info.depth)) info.depth = depth;
  }
  return rooms;
}

function computeStairAlignment(rooms) {
  const main = rooms.main;
  const east = rooms.east ?? rooms.main;
  return {
    main: { x: main.center.x + 1, y: main.center.y + 2 },
    east: { x: east.center.x - 1, y: east.center.y - 2 },
  };
}

function defaultStairAlignment() {
  return {
    main: { x: 0, y: 2 },
    east: { x: 6, y: 0 },
  };
}

function cloneGeometry(world, entityId) {
  const geom = world.get(entityId, DungeonGeometry);
  if (!geom) return null;
  return {
    seed: geom.seed,
    mbrVersion: geom.mbrVersion,
    moveVersion: geom.moveVersion,
    occlVersion: geom.occlVersion,
    mbr: geom.mbr ? { ...geom.mbr } : null,
    primitives: Array.isArray(geom.primitives) ? geom.primitives.map((p) => ({ ...p })) : [],
    meta: cloneMeta(geom.meta),
    options: geom.options ? { ...geom.options } : null,
  };
}

function cloneMeta(meta) {
  if (!meta) return null;
  try {
    return JSON.parse(JSON.stringify(meta));
  } catch {
    return { ...meta };
  }
}

function carvePortalVault(world, kernel, entityId, anchor) {
  if (!kernel || !anchor) return null;
  const carveFlags = { affectsMove: true, affectsOccl: true };
  const halfWidth = LOWER_ROOM_WIDTH * 0.5;
  const halfHeight = LOWER_ROOM_HEIGHT * 0.5;
  const center = {
    x: anchor.center.x,
    y: anchor.center.y + 32,
  };
  kernel.carveBox(center.x, center.y, halfWidth, halfHeight, 0, carveFlags);
  const snapshot = kernel.snapshot();
  const geometry = {
    seed: snapshot.seed,
    mbrVersion: snapshot.mbrVersion,
    moveVersion: snapshot.moveVersion,
    occlVersion: snapshot.occlVersion,
    mbr: snapshot.mbr,
    primitives: snapshot.primitives,
    meta: null,
    options: snapshot.options,
  };
  if (world.has(entityId, DungeonGeometry)) {
    world.set(entityId, DungeonGeometry, geometry);
  } else {
    world.add(entityId, DungeonGeometry, geometry);
  }
  return {
    key: "portal",
    shape: "rect-room",
    width: LOWER_ROOM_WIDTH,
    height: LOWER_ROOM_HEIGHT,
    halfWidth,
    halfHeight,
    center,
    depth: MAIN_DEPTH,
  };
}

function generateLowerVault(world) {
  const kernel = ensureGeometryKernel(world, { seed: world.seed ^ 0x5d3 });
  kernel.clear();
  const carveFlags = { affectsMove: true, affectsOccl: true };
  const halfWidth = LOWER_ROOM_WIDTH * 0.5;
  const halfHeight = LOWER_ROOM_HEIGHT * 0.5;
  kernel.carveBox(0, 0, halfWidth, halfHeight, 0, carveFlags);
  const snapshot = kernel.snapshot();
  const geometry = {
    seed: snapshot.seed,
    mbrVersion: snapshot.mbrVersion,
    moveVersion: snapshot.moveVersion,
    occlVersion: snapshot.occlVersion,
    mbr: snapshot.mbr,
    primitives: snapshot.primitives,
    meta: null,
    options: snapshot.options,
  };
  return {
    geometry,
    room: {
      key: "lower",
      shape: "rect-room",
      width: LOWER_ROOM_WIDTH,
      height: LOWER_ROOM_HEIGHT,
      halfWidth,
      halfHeight,
      center: { x: 0, y: 0 },
      depth: LOWER_DEPTH,
    },
  };
}
