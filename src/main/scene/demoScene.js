import { createFrom } from "../../lib/ecs-js/archetype.js";
import { playerEntity } from "../../rules/utils/queries.js";
import { createPlayer } from "../../rules/archetypes/Player.js";
import { HealthPotion, GoldStack, ArrowsStack, FlamingArrowsStack } from "../../rules/archetypes/Items.js";
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

const ROOM_WIDTH = 11;
const ROOM_HEIGHT = 11;

/**
 * Populate a small demo scene with a player, tiles, and items.
 * @param {import('../../lib/ecs-js/index.js').World} world
 */
export function populateDemoScene(world) {
  const { room } = generateRectRoom(world, {
    width: ROOM_WIDTH,
    height: ROOM_HEIGHT,
    name: "Demo Room",
  });

  ensurePlayer(world, room.center);
  grantInitialShield(world);
  placeTorch(world, room);
  placeSpellbook(world, room);
  placeBlastwaveScroll(world, room);
  setPlayerStats(world);
  dropPotions(world, room);
  dropGold(world, room);
  dropArrows(world, room);
  spawnMonsters(world, room);
  dropEquipment(world, room);
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
  const farrows = createFrom(world, FlamingArrowsStack, {});
  world.add(farrows, Position, { x: center.x - 1.5, y: center.y - 1.5 });
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

function dropEquipment(world, room) {
  const { center, halfWidth, halfHeight } = room;
  const eqSword = buildEquipmentItem(world, "sword_plain", { affixes: ["fierce"] });
  world.add(eqSword, Position, { x: center.x - (halfWidth - 2), y: center.y - (halfHeight - 2) });

  const thornArmor = buildEquipmentItem(world, "chain_armor", { affixes: ["thorns1"] });
  world.add(thornArmor, Position, { x: center.x + (halfWidth - 2), y: center.y + (halfHeight - 2) });

  // New: wooden bow to try ranged combat
  const woodBow = buildEquipmentItem(world, "bow_wood", {});
  world.add(woodBow, Position, { x: center.x, y: center.y + (halfHeight - 2) });
}
