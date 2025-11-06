import { createFrom } from "../../lib/ecs-js/archetype.js";
import { playerEntity } from "../../rules/utils/queries.js";
import { createPlayer } from "../../rules/archetypes/Player.js";
import { HealthPotion, GoldStack } from "../../rules/archetypes/Items.js";
import { FloorTile, WallTile } from "../../rules/archetypes/Tiles.js";
import { Door } from "../../rules/archetypes/Door.js";
import { Monster } from "../../rules/archetypes/Creatures.js";
import { ActiveEffects } from "../../rules/components/ActiveEffects.js";
import { NamedIdentity } from "../../rules/components/NamedIdentity.js";
import { Position } from "../../rules/components/Position.js";
import { ItemInfo } from "../../rules/components/ItemInfo.js";
import { Mana } from "../../rules/components/Mana.js";
import { Vitality } from "../../rules/components/Vitality.js";
import { buildEquipmentItem } from "../../rules/data/equipmentLoader.js";
import { createRng } from "../../lib/ecs-js/rng.js";
import { ensureGeometryKernel } from "../../rules/environment/worldGeometry.js";

const ROOM_WIDTH = 10;
const ROOM_HEIGHT = 10;

/**
 * Populate a small demo scene with a player, tiles, and items.
 * @param {import('../../lib/ecs-js/index.js').World} world
 */
export function populateDemoScene(world) {
  const originX = -((ROOM_WIDTH - 1) >> 1);
  const originY = -((ROOM_HEIGHT - 1) >> 1);
  const doorPos = { x: 0, y: originY + (ROOM_HEIGHT - 1) };

  const kernel = ensureGeometryKernel(world);
  kernel.clear();

  buildRoom(world, kernel, originX, originY, doorPos);
  ensurePlayer(world);
  grantInitialShield(world);
  placeSpellbook(world);
  setPlayerStats(world);
  dropPotions(world);
  dropGold(world);
  spawnMonsters(world, originX, originY);
  dropEquipment(world, originX, originY);
}

function buildRoom(world, kernel, ox, oy, doorPos) {
  const carveFlags = { affectsMove: true, affectsOccl: true };
  for (let y = 0; y < ROOM_HEIGHT; y++) {
    for (let x = 0; x < ROOM_WIDTH; x++) {
      const gx = ox + x;
      const gy = oy + y;
      const isBorder = (x === 0 || y === 0 || x === ROOM_WIDTH - 1 || y === ROOM_HEIGHT - 1);
      if (isBorder) {
        if (gx === doorPos.x && gy === doorPos.y) continue;
        createFrom(world, WallTile, { x: gx, y: gy });
      } else {
        createFrom(world, FloorTile, { x: gx, y: gy });
        kernel.carveCircle(gx, gy, 0.6, carveFlags);
      }
    }
  }
  kernel.carveCircle(doorPos.x, doorPos.y, 0.6, carveFlags);
  createFrom(world, Door, { x: doorPos.x, y: doorPos.y });
}

function ensurePlayer(world) {
  if (!playerEntity(world)) {
    createPlayer(world, { x: 0, y: 0, name: "Hero" });
  }
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

function placeSpellbook(world) {
  const book = world.create();
  world.add(book, NamedIdentity, { name: "Spellbook of Lightning", identity: "book_lightning" });
  world.add(book, Position, { x: 4, y: 4 });
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

function dropPotions(world) {
  const p1 = createFrom(world, HealthPotion, {});
  world.add(p1, Position, { x: 4, y: 0 });
  const p2 = createFrom(world, HealthPotion, {});
  world.add(p2, Position, { x: -3, y: 0 });
}

function dropGold(world) {
  const rng = createRng(world.seed >>> 0 ^ 0x9e3779b9);
  const coins = rng.int(12, 47);
  const gold = createFrom(world, GoldStack, {});
  world.add(gold, Position, { x: -1, y: -1 });
  world.mutate(gold, ItemInfo, (r) => { r.count = coins; });
}

function spawnMonsters(world, ox, oy) {
  createFrom(world, Monster, { x: ox + 2, y: oy + 2, name: "Goblin", identity: "monster" });
  createFrom(world, Monster, { x: ox + ROOM_WIDTH - 3, y: oy + 2, name: "Goblin", identity: "monster" });
  createFrom(world, Monster, { x: ox + 2, y: oy + ROOM_HEIGHT - 3, name: "Goblin", identity: "monster" });
}

function dropEquipment(world, ox, oy) {
  const eqSword = buildEquipmentItem(world, "sword_plain", { affixes: ["fierce"] });
  world.add(eqSword, Position, { x: -3, y: -3 });

  const thornArmor = buildEquipmentItem(world, "chain_armor", { affixes: ["thorns1"] });
  world.add(thornArmor, Position, { x: ox + 1, y: oy + ROOM_HEIGHT - 2 });
}
