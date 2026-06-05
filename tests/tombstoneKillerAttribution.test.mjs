import "./helpers/installContentMonsters.mjs";
import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { Player } from "../src/rules/components/Player.js";
import { Position } from "../src/rules/components/Position.js";
import { Vitality } from "../src/rules/components/Vitality.js";
import { Equipment } from "../src/rules/components/Equipment.js";
import { Faction } from "../src/rules/components/Faction.js";
import { NamedIdentity } from "../src/rules/components/NamedIdentity.js";
import { AttackIntent } from "../src/rules/components/Intents/AttackIntent.js";
import { DungeonState } from "../src/rules/components/DungeonState.js";
import { installTombstoneDeathListener, tombstoneSystem } from "../src/rules/systems/tombstoneSystem.js";
import { combatSystem } from "../src/rules/systems/combatSystem.js";
import { installAffixTriggers } from "../src/rules/systems/affixTriggerSystem.js";
import { dealDamage } from "../src/rules/utils/dealDamage.js";

/** Minimal in-memory tombstone repository for testing. */
function makeRepo() {
  const records = [];
  return {
    records,
    save(record) { records.push(record); },
  };
}

Deno.test("tombstone: melee kill records both cause and killer identity", () => {
  const world = new World({ seed: 1 });
  world.step = 42;
  const repo = makeRepo();
  installTombstoneDeathListener(world, repo);

  // Dungeon state singleton
  const ds = world.create();
  world.add(ds, DungeonState, { worldSeed: 1, currentDepth: 3, floorEntityIds: [] });

  // Player
  const player = world.create();
  world.add(player, Player);
  world.add(player, Vitality, { maxHp: 20, hp: 5 });
  world.add(player, Position, { x: 3, y: 4 });
  world.add(player, NamedIdentity, { name: 'Hero', identity: 'hero' });

  // Killer monster
  const killer = world.create();
  world.add(killer, Vitality, { maxHp: 30, hp: 30 });
  world.add(killer, NamedIdentity, { name: 'Orc Warrior', identity: 'orc' });

  // Lethal melee hit — both cause and killer are present (as dealDamage emits)
  dealDamage(world, { target: player, amount: 100, source: killer, type: 'physical', cause: 'melee' });
  tombstoneSystem(world);

  assertEquals(repo.records.length, 1, "should save one tombstone");
  const ts = repo.records[0];
  assertEquals(ts.cause, 'melee', "cause should be 'melee'");
  assertEquals(ts.killerName, 'Orc Warrior', "killerName should be resolved");
  assertEquals(ts.killerIdentity, 'orc', "killerIdentity should be resolved");
  assertEquals(ts.depth, 3, "depth should match DungeonState");
  assertEquals(ts.playerName, 'Hero', "playerName should be resolved");
});

Deno.test("tombstone: starvation death records cause without killer", () => {
  const world = new World({ seed: 1 });
  world.step = 99;
  const repo = makeRepo();
  installTombstoneDeathListener(world, repo);

  const ds = world.create();
  world.add(ds, DungeonState, { worldSeed: 1, currentDepth: 5, floorEntityIds: [] });

  const player = world.create();
  world.add(player, Player);
  world.add(player, Vitality, { maxHp: 20, hp: 1 });
  world.add(player, Position, { x: 0, y: 0 });
  world.add(player, NamedIdentity, { name: 'Hero', identity: 'hero' });

  // Environmental death — source=0, cause='starvation'
  dealDamage(world, { target: player, amount: 10, source: 0, type: 'physical', cause: 'starvation', bypassInvuln: true, bypassResist: true });
  tombstoneSystem(world);

  assertEquals(repo.records.length, 1);
  const ts = repo.records[0];
  assertEquals(ts.cause, 'starvation');
  assertEquals(ts.killerName, null, "no killer for environmental death");
  assertEquals(ts.killerIdentity, null);
});

Deno.test("tombstone: non-player deaths are ignored", () => {
  const world = new World({ seed: 1 });
  const repo = makeRepo();
  installTombstoneDeathListener(world, repo);

  const monster = world.create();
  world.add(monster, Vitality, { maxHp: 10, hp: 5 });

  dealDamage(world, { target: monster, amount: 100 });
  tombstoneSystem(world);

  assertEquals(repo.records.length, 0, "no tombstone for non-player");
});

Deno.test("tombstone: mutual kill — player kills demon, hellfire kills player, tombstone records demon as killer", () => {
  // Regression: both entities die in the same combat chain.
  // Player (2 hp) melee-attacks Demon (1 hp).
  // dealDamage(demon) → emit 'damaged' → hellfire retaliates 2 → dealDamage(player)
  //   → player 'died' emits with killer=demon (demon entity still exists at this point)
  // Then demon 'died' emits after the nested chain resolves.
  let found = false;

  for (let seed = 0; seed < 512; seed++) {
    const world = new World({ seed });
    world.step = 1;

    const repo = makeRepo();
    installAffixTriggers(world);
    installTombstoneDeathListener(world, repo);

    const ds = world.create();
    world.add(ds, DungeonState, { worldSeed: seed, currentDepth: 4, floorEntityIds: [] });

    const player = world.create();
    world.add(player, Player);
    world.add(player, Vitality, { maxHp: 20, hp: 2 });
    world.add(player, Equipment, { accuracyDerived: 10, damagePowerDerived: 10, naturalDamageDice: '1d4' });
    world.add(player, Position, { x: 5, y: 5 });
    world.add(player, Faction, { key: 'player' });
    world.add(player, NamedIdentity, { name: 'Hero', identity: 'hero' });

    const demon = world.create();
    world.add(demon, Vitality, { maxHp: 1, hp: 1 });
    world.add(demon, Equipment, { evadeDerived: 0 });
    world.add(demon, Position, { x: 5, y: 6 });
    world.add(demon, Faction, { key: 'enemy' });
    world.add(demon, NamedIdentity, { name: 'Hellfire Demon', identity: 'demon' });

    world.add(player, AttackIntent, { targetId: demon });
    combatSystem(world);
    tombstoneSystem(world);

    const demonVit = world.get(demon, Vitality);
    const playerVit = world.get(player, Vitality);
    if ((demonVit?.hp ?? 1) > 0 || (playerVit?.hp ?? 1) > 0) continue; // need both dead

    assert(repo.records.length === 1, `seed ${seed}: exactly one tombstone (player)`);
    const ts = repo.records[0];
    assertEquals(ts.killerName, 'Hellfire Demon', `seed ${seed}: killerName should be Hellfire Demon`);
    assertEquals(ts.killerIdentity, 'demon', `seed ${seed}: killerIdentity should be demon`);
    assertEquals(ts.cause, 'retaliation', `seed ${seed}: cause should be retaliation (hellfire)`);
    found = true;
    break;
  }

  assert(found, "expected at least one seed where both player and demon die in same combat chain");
});

Deno.test("tombstone: deterministic id/timestamp for same seed + step + outcome", () => {
  /**
   * @returns {any}
   */
  function runRecord() {
    const world = new World({ seed: 7001 });
    world.step = 77;
    const repo = makeRepo();
    installTombstoneDeathListener(world, repo);

    const ds = world.create();
    world.add(ds, DungeonState, { worldSeed: 7001, currentDepth: 2, floorEntityIds: [] });

    const player = world.create();
    world.add(player, Player);
    world.add(player, Vitality, { maxHp: 20, hp: 1 });
    world.add(player, Position, { x: 2, y: 3 });
    world.add(player, NamedIdentity, { name: "Hero", identity: "hero" });

    const killer = world.create();
    world.add(killer, Vitality, { maxHp: 30, hp: 30 });
    world.add(killer, NamedIdentity, { name: "Orc Warrior", identity: "orc" });

    dealDamage(world, { target: player, amount: 10, source: killer, type: "physical", cause: "melee" });
    tombstoneSystem(world);
    assertEquals(repo.records.length, 1);
    return repo.records[0];
  }

  const a = runRecord();
  const b = runRecord();
  assertEquals(a.id, b.id, "id should be deterministic");
  assertEquals(a.timestamp, b.timestamp, "timestamp should be deterministic");
  assertEquals(a.turn, 77);
  assert(a.timestamp > 0, "timestamp should remain positive and sortable");
});
