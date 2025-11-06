import { createFrom } from "../../lib/ecs-js/archetype.js";
import { playerEntity } from "../../rules/utils/queries.js";
import { createPlayer } from "../../rules/archetypes/Player.js";
import { HealthPotion, GoldStack } from "../../rules/archetypes/Items.js";
import { FloorTile, WallTile } from "../../rules/archetypes/Tiles.js";
import { Monster } from "../../rules/archetypes/Creatures.js";
import { ActiveEffects } from "../../rules/components/ActiveEffects.js";
import { NamedIdentity } from "../../rules/components/NamedIdentity.js";
import { Position } from "../../rules/components/Position.js";
import { Facing } from "../../rules/components/Facing.js";
import { ItemInfo } from "../../rules/components/ItemInfo.js";
import { Mana } from "../../rules/components/Mana.js";
import { Vitality } from "../../rules/components/Vitality.js";
import { buildEquipmentItem } from "../../rules/data/equipmentLoader.js";
import { createRng } from "../../lib/ecs-js/rng.js";
import { generateRectRoom } from "../../rules/environment/dungeonGenerator.js";

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

  buildRoom(world, room);
  ensurePlayer(world, room.center);
  grantInitialShield(world);
  placeSpellbook(world, room);
  setPlayerStats(world);
  dropPotions(world, room);
  dropGold(world, room);
  spawnMonsters(world, room);
  dropEquipment(world, room);
}

function buildRoom(world, room) {
  const { origin, width, height } = room;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const gx = origin.x + x;
      const gy = origin.y + y;
      const isBorder = (x === 0 || y === 0 || x === width - 1 || y === height - 1);
      if (isBorder) {
        createFrom(world, WallTile, { x: gx, y: gy });
      } else {
        createFrom(world, FloorTile, { x: gx, y: gy });
      }
    }
  }
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
}

function setPlayerStats(world) {
  const pe = playerEntity(world);
  if (!pe) return;
  world.add(pe.id, Mana, { mana: 50, maxMana: 50, manaRegen: 1 });
  world.add(pe.id, Vitality, { hp: 100, maxHp: 100 });
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

function spawnMonsters(world, room) {
  const { center, halfWidth, halfHeight } = room;
  const leftX = center.x - (halfWidth - 1.5);
  const rightX = center.x + (halfWidth - 1.5);
  const topY = center.y - (halfHeight - 1.5);
  const bottomY = center.y + (halfHeight - 1.5);
  createFrom(world, Monster, { x: leftX, y: topY, name: "Goblin", identity: "monster" });
  createFrom(world, Monster, { x: rightX, y: topY, name: "Goblin", identity: "monster" });
  createFrom(world, Monster, { x: center.x, y: bottomY, name: "Goblin", identity: "monster" });
}

function dropEquipment(world, room) {
  const { center, halfWidth, halfHeight } = room;
  const eqSword = buildEquipmentItem(world, "sword_plain", { affixes: ["fierce"] });
  world.add(eqSword, Position, { x: center.x - (halfWidth - 2), y: center.y - (halfHeight - 2) });

  const thornArmor = buildEquipmentItem(world, "chain_armor", { affixes: ["thorns1"] });
  world.add(thornArmor, Position, { x: center.x + (halfWidth - 2), y: center.y + (halfHeight - 2) });
}
