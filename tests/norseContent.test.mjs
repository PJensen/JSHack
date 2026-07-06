import "./helpers/installContentMonsters.mjs";
import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { AggroState, AGGRO_LEVELS } from "../src/rules/components/AggroState.js";
import { Faction } from "../src/rules/components/Faction.js";
import { GuardedTreasure } from "../src/rules/components/GuardedTreasure.js";
import { Hamingja } from "../src/rules/components/Hamingja.js";
import { Inventory } from "../src/rules/components/Inventory.js";
import { Landvaettir } from "../src/rules/components/Landvaettir.js";
import { NamedIdentity } from "../src/rules/components/NamedIdentity.js";
import { Position } from "../src/rules/components/Position.js";
import { TreasureGuardian } from "../src/rules/components/TreasureGuardian.js";
import { getMonster } from "../src/rules/data/monsters.js";
import { attachHamingja, attachLandvaettir, getLandvaettirSite } from "../src/rules/data/norseFate.js";
import { treasureGuardianListenerExtension, treasureGuardianSystem } from "../src/rules/systems/treasureGuardianSystem.js";
import { getPassiveBonuses } from "../src/rules/utils/passiveBonuses.js";
import { toMonsterSpawnParams } from "../src/rules/utils/monsterSpawnParams.js";
import { spawnMonsterEntity } from "../src/rules/utils/spawnMonsterEntity.js";

Deno.test("Ratatoskr is a unique passive outdoor squirrel messenger", () => {
  const def = getMonster("ratatoskr");
  assert(def, "ratatoskr should exist");
  assertEquals(def.name, "Ratatoskr");
  assert(def.tags.includes("squirrel"), "Ratatoskr should be tagged as a squirrel");
  assert(def.tags.includes("unique"), "Ratatoskr should be unique content");
  assert(def.tags.includes("overworld"), "Ratatoskr should be outdoor/overworld content");
  assertEquals(def.faction, "neutral");
  assertEquals(def.aggro, "passive");
  assertEquals(def.solid, false);
  assertEquals(def.blocksSight, false);
  assertEquals(def.rare, true);
  assertEquals(def.corpseDropChance, 0);
  assertEquals(def._contentAiHints?.rareMessenger, true);
  assert(def._contentMeta?.messengerRoles?.includes("insult"), "Ratatoskr should carry insults");
});

Deno.test("Draugr is a territorial undead guardian bound to property", () => {
  const def = getMonster("draugr");
  assert(def, "draugr should exist");
  assert(def.tags.includes("undead"), "Draugr should be undead");
  assert(def.tags.includes("territorial"), "Draugr should be territorial");
  assert(def.tags.includes("guardian"), "Draugr should be a guardian");
  assertEquals(def.aggro, "passive");
  assertEquals(def.faction, "neutral");
  assertEquals(def.guardianRole?.role, "bound_property_guardian");
  assertEquals(def._contentMeta?.guardian, true);
  assertEquals(def._contentMeta?.angerTrigger, "bound_property_touched");
  assert(def._contentMeta?.boundTo?.includes("grave"), "Draugr should bind to graves");
  assert(def._contentMeta?.boundTo?.includes("family_property"), "Draugr should bind to family property");
});

Deno.test("Landvaettir are authored as place-attached dormant spirits and attach as ECS state", () => {
  const grove = getLandvaettirSite("strange_grove");
  assert(grove, "strange_grove should have a landvaettir definition");
  assertEquals(grove.attachedTo, "landmark");
  assertEquals(grove.dormant, true);
  assertEquals(grove.visible, false);
  assert(grove.discovery.includes("spirit_guide"), "spirit guide should be a discovery route");
  assert(grove.discovery.includes("spirit_essence"), "spirit essence should be a discovery route");

  const world = new World({ seed: 0x1a });
  const landmark = world.create();
  world.add(landmark, Position, { x: 10, y: 12 });
  assertEquals(attachLandvaettir(world, landmark, "strange_grove", { radius: 8 }), true);
  const state = world.get(landmark, Landvaettir);
  assertEquals(state.siteId, "strange_grove");
  assertEquals(state.originX, 10);
  assertEquals(state.originY, 12);
  assertEquals(state.radius, 8);
  assertEquals(state.visible, false);
});

Deno.test("Hamingja attaches as non-transferable lineage luck ECS state", () => {
  const world = new World({ seed: 0x2a });
  const player = world.create();
  assertEquals(attachHamingja(world, player, { lineageId: "line:askr", luck: 2, sourceRunId: "run:old" }), true);
  const state = world.get(player, Hamingja);
  assertEquals(state.lineageId, "line:askr");
  assertEquals(state.luck, 2);
  assertEquals(state.inherited, true);
  assertEquals(state.transferable, false);
  assertEquals(state.sourceRunId, "run:old");
  assertEquals(getPassiveBonuses(world, player).luckDerived, 2);
});

Deno.test("Draugr binds nearby treasure and turns hostile when it is looted", () => {
  const world = new World({ seed: 0xdad6 });
  world.install(treasureGuardianListenerExtension);

  const def = getMonster("draugr");
  const draugr = spawnMonsterEntity(world, {
    ...toMonsterSpawnParams(def, 4),
    x: 5,
    y: 5,
  });

  const chest = world.create();
  world.add(chest, Position, { x: 6, y: 5 });
  world.add(chest, NamedIdentity, { identity: "chest", name: "Chest" });
  world.add(chest, Inventory, { capacity: 20, items: [] });

  treasureGuardianSystem(world);

  assertEquals(world.get(draugr, TreasureGuardian)?.treasureId, chest);
  assertEquals(world.get(chest, GuardedTreasure)?.guardianId, draugr);
  assertEquals(world.get(draugr, Faction)?.key, "neutral");

  const thief = world.create();
  world.add(thief, Position, { x: 6, y: 6 });
  world.emit("item:pickup", { actor: thief, itemId: 99, sourceContainerId: chest });

  assertEquals(world.get(chest, GuardedTreasure)?.disturbed, true);
  assertEquals(world.get(draugr, TreasureGuardian)?.disturbed, true);
  assertEquals(world.get(draugr, Faction)?.key, "enemy");
  assertEquals(world.get(draugr, AggroState)?.alertLevel, AGGRO_LEVELS.hunting);
  assertEquals(world.get(draugr, AggroState)?.targetId, thief);
});

Deno.test("dragon is authored into the same treasure guardian role", () => {
  const def = getMonster("dragon");
  assert(def, "dragon should exist");
  assertEquals(def.guardianRole?.role, "hoard_guardian");

  const world = new World({ seed: 0xd6a6 });
  const dragon = spawnMonsterEntity(world, {
    ...toMonsterSpawnParams(def, 16),
    x: 1,
    y: 1,
  });
  const guard = world.get(dragon, TreasureGuardian);
  assert(guard, "dragon should spawn with TreasureGuardian");
  assertEquals(guard.role, "hoard_guardian");
  assertEquals(guard.peacefulUntilDisturbed, true);
});
