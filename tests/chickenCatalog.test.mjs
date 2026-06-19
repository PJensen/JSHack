import "./helpers/installContentMonsters.mjs";
import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { Collider } from "../src/rules/components/Collider.js";
import { Faction } from "../src/rules/components/Faction.js";
import { NamedIdentity } from "../src/rules/components/NamedIdentity.js";
import { getMonster } from "../src/rules/data/monsters.js";
import { materializeSpawn } from "../src/rules/environment/dungeon/populate.js";
import { applyMutation } from "../src/rules/interaction/mutations.js";

const CHICKEN_IDS = ["chicken_hen", "chicken_rooster", "chick"];

Deno.test("chickens are canonical catalog creatures", () => {
  for (const id of CHICKEN_IDS) {
    const def = getMonster(id);
    assert(def, `expected catalog definition for ${id}`);
    assertEquals(def.faction, "neutral");
    assertEquals(def.solid, false);
    assertEquals(def.blocksSight, false);
    assertEquals(def.rare, true);
    assertEquals(def.sleep, "diurnal");
    assertEquals(def.lootTable, "drop:domesticated");
    assertEquals(def._contentAiHints?.farmAnimal, true);
  }
});

Deno.test("farm and debug chicken routes preserve catalog behavior", () => {
  const world = new World({ seed: 0xC11C });
  const farmId = materializeSpawn(world, {
    kind: "monster",
    x: 1,
    y: 2,
    params: { monsterId: "chicken_hen", depth: 0 },
  });

  applyMutation(world, {
    type: "spawnMonster",
    monsterId: "chicken_rooster",
    x: 3,
    y: 4,
    emitEvent: false,
  }, { getMonster });
  const debugId = [...world.query(NamedIdentity)]
    .find(([, identity]) => identity.identity === "chicken_rooster")?.[0] || 0;

  for (const id of [farmId, debugId]) {
    assert(id > 0);
    assertEquals(world.get(id, Faction)?.key, "neutral");
    assertEquals(world.get(id, Collider)?.solid, false);
    assertEquals(world.get(id, Collider)?.blocksSight, false);
  }
});
