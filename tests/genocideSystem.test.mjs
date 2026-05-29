import "./helpers/installContentMonsters.mjs";
// @ts-nocheck
import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { Position } from "../src/rules/components/Position.js";
import { NamedIdentity } from "../src/rules/components/NamedIdentity.js";
import { Faction } from "../src/rules/components/Faction.js";
import { Vitality } from "../src/rules/components/Vitality.js";
import { MonsterSpawner } from "../src/rules/components/MonsterSpawner.js";
import { installGenocideListener } from "../src/rules/systems/genocideSystem.js";
import { clearGenocides, isGenocided } from "../src/rules/data/monsters.js";

Deno.test("genocide request only kills the chosen monster type and disables its spawners", () => {
  clearGenocides();
  try {
    const world = new World({ seed: 0xC0FFEE });
    installGenocideListener(world);

    const actor = world.create();
    world.add(actor, Position, { x: 10, y: 10 });

    const goblinA = world.create();
    world.add(goblinA, Position, { x: 13, y: 10 });
    world.add(goblinA, NamedIdentity, { name: "Goblin", identity: "goblin" });
    world.add(goblinA, Faction, { key: "enemy" });
    world.add(goblinA, Vitality, { hp: 7, maxHp: 7 });

    const goblinB = world.create();
    world.add(goblinB, Position, { x: 22, y: 10 });
    world.add(goblinB, NamedIdentity, { name: "Goblin", identity: "goblin" });
    world.add(goblinB, Faction, { key: "enemy" });
    world.add(goblinB, Vitality, { hp: 6, maxHp: 6 });

    const orc = world.create();
    world.add(orc, Position, { x: 14, y: 10 });
    world.add(orc, NamedIdentity, { name: "Orc", identity: "orc" });
    world.add(orc, Faction, { key: "enemy" });
    world.add(orc, Vitality, { hp: 9, maxHp: 9 });

    const spawner = world.create();
    world.add(spawner, MonsterSpawner, {
      spawnParams: { identity: "goblin" },
      isActive: true,
    });

    const damaged = [];
    const messages = [];
    world.on("damaged", (event) => damaged.push(event));
    world.on("message", (event) => messages.push(event));

    world.emit("scroll:genocide:request", { actor, query: "gob" });

    assertEquals(world.get(goblinA, Vitality)?.hp, 0);
    assertEquals(world.get(goblinB, Vitality)?.hp, 0);
    assertEquals(world.get(orc, Vitality)?.hp, 9);
    assertEquals(world.get(spawner, MonsterSpawner)?.isActive, false);
    assert(isGenocided("goblin"));

    assertEquals(damaged.length, 2);
    assert(damaged.every((event) => Number(event?.amount) === 9999), "genocide should emit 9999 damage for each target");

    assert(messages.some((event) => String(event?.text || "").includes("You have genocided all Goblins")));
  } finally {
    clearGenocides();
  }
});

Deno.test("genocide request accepts exact monster ids from chooser", () => {
  clearGenocides();
  try {
    const world = new World({ seed: 0xC0FFEE });
    installGenocideListener(world);

    const actor = world.create();
    world.add(actor, Position, { x: 0, y: 0 });

    world.emit("scroll:genocide:request", { actor, query: "rust_monster" });

    assert(isGenocided("rust_monster"));
  } finally {
    clearGenocides();
  }
});
