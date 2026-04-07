import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { buildWorldView } from "../src/bridge/schema/worldView.js";
import { Player } from "../src/rules/components/Player.js";
import { Position } from "../src/rules/components/Position.js";
import { NamedIdentity } from "../src/rules/components/NamedIdentity.js";
import { ItemInfo } from "../src/rules/components/ItemInfo.js";
import { Equipment } from "../src/rules/components/Equipment.js";
import { Brain } from "../src/rules/components/Brain.js";
import { buildCatalogItem } from "../src/rules/data/itemCatalogLoader.js";

function createItem(world, {
  identity,
  type = "weapon",
  affixes = [],
  coating = null,
} = {}) {
  const id = world.create();
  world.add(id, NamedIdentity, { name: identity, identity });
  const info = {
    type,
    slot: "",
    weight: 1,
    value: 1,
    description: "",
    count: 1,
    bonuses: {},
    twoHanded: false,
    rarity: 1,
    rarityName: "common",
    affixes: Array.isArray(affixes) ? affixes.slice() : [],
  };
  if (coating) info.coating = coating;
  world.add(id, ItemInfo, info);
  return id;
}

Deno.test("worldView projects dual-wield weapon VFX profiles per slot", () => {
  const world = new World({ seed: 31 });
  const player = world.create();
  world.add(player, Player, {});
  world.add(player, Position, { x: 3, y: 4 });
  world.add(player, NamedIdentity, { name: "Hero", identity: "player" });
  world.add(player, Brain, { learnedSpellIds: [], itemKnowledgeIdentities: [], seenTiles: new Uint8Array(), intelligence: 10, visionRange: 8 });

  const mainhand = createItem(world, {
    identity: "venomfang",
    affixes: ["affix:venomous1"],
  });
  const offhand = createItem(world, {
    identity: "nightfang_dagger",
    coating: { kind: "poison", charges: 4 },
  });
  world.add(player, Equipment, { weapon: mainhand, offhand });

  const view = buildWorldView(world);
  const playerView = view.entities.find((entity) => entity.id === player);
  assert(playerView, "expected player in world view");
  assert(Array.isArray(playerView.weaponVfx), "expected projected weaponVfx payload");
  assertEquals(playerView.weaponVfx.length, 2);

  const slots = playerView.weaponVfx.map((entry) => String(entry.slot)).sort();
  assertEquals(slots, ["offhand", "weapon"]);
  for (let i = 0; i < playerView.weaponVfx.length; i++) {
    assertEquals(playerView.weaponVfx[i].id, "venom_weapon");
  }

  assert(!playerView.tags.includes("fire_weapon_glow"));
  assert(!playerView.tags.includes("poison_weapon_glow"));
});

Deno.test("worldView keeps weapon profile projection focused on actual weapons", () => {
  const world = new World({ seed: 32 });
  const player = world.create();
  world.add(player, Player, {});
  world.add(player, Position, { x: 2, y: 2 });
  world.add(player, NamedIdentity, { name: "Hero", identity: "player" });
  world.add(player, Brain, { learnedSpellIds: [], itemKnowledgeIdentities: [], seenTiles: new Uint8Array(), intelligence: 10, visionRange: 8 });

  const flamingClub = createItem(world, {
    identity: "smoldering_club",
    affixes: ["flaming"],
  });
  const shield = createItem(world, {
    identity: "iron_shield",
    type: "armor",
  });
  world.add(player, Equipment, { weapon: flamingClub, offhand: shield });

  const view = buildWorldView(world);
  const playerView = view.entities.find((entity) => entity.id === player);
  assert(playerView, "expected player in world view");
  assert(Array.isArray(playerView.weaponVfx), "expected at least one projected weapon profile");
  assertEquals(playerView.weaponVfx.length, 1);
  assertEquals(playerView.weaponVfx[0].id, "flame_weapon");
  assertEquals(playerView.weaponVfx[0].slot, "weapon");
});

Deno.test("worldView projects carry VFX for real catalog smoldering_club equipment", () => {
  const world = new World({ seed: 33 });
  const player = world.create();
  world.add(player, Player, {});
  world.add(player, Position, { x: 1, y: 1 });
  world.add(player, NamedIdentity, { name: "Hero", identity: "player" });
  world.add(player, Brain, { learnedSpellIds: [], itemKnowledgeIdentities: [], seenTiles: new Uint8Array(), intelligence: 10, visionRange: 8 });
  world.add(player, Equipment, {});

  const club = buildCatalogItem(world, "smoldering_club");
  const shield = buildCatalogItem(world, "shield_steel");
  world.get(player, Equipment).weapon = club;
  world.get(player, Equipment).offhand = shield;

  const view = buildWorldView(world);
  const playerView = view.entities.find((entity) => entity.id === player);
  assert(playerView, "expected player in world view");
  assert(Array.isArray(playerView.weaponVfx), "expected weaponVfx projection for smoldering club");
  assertEquals(playerView.weaponVfx.length, 1);
  assertEquals(playerView.weaponVfx[0].id, "flame_weapon");
  assertEquals(playerView.weaponVfx[0].slot, "weapon");
});

Deno.test("worldView projects dedicated holy carry VFX for sunsword", () => {
  const world = new World({ seed: 34 });
  const player = world.create();
  world.add(player, Player, {});
  world.add(player, Position, { x: 1, y: 1 });
  world.add(player, NamedIdentity, { name: "Hero", identity: "player" });
  world.add(player, Brain, { learnedSpellIds: [], itemKnowledgeIdentities: [], seenTiles: new Uint8Array(), intelligence: 10, visionRange: 8 });
  world.add(player, Equipment, {});

  const sword = buildCatalogItem(world, "sunsword");
  world.get(player, Equipment).weapon = sword;

  const view = buildWorldView(world);
  const playerView = view.entities.find((entity) => entity.id === player);
  assert(playerView, "expected player in world view");
  assert(Array.isArray(playerView.weaponVfx), "expected weaponVfx projection for sunsword");
  assertEquals(playerView.weaponVfx.length, 1);
  assertEquals(playerView.weaponVfx[0].id, "holy_weapon");
  assertEquals(playerView.weaponVfx[0].slot, "weapon");
  assert(playerView.tags.includes("sunlight"), "expected sunlight tag to remain projected for sunsword");
});
