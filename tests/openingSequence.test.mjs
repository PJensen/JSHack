// @ts-nocheck
import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { AggroState, AGGRO_LEVELS } from "../src/rules/components/AggroState.js";
import { Equipment } from "../src/rules/components/Equipment.js";
import { Flying } from "../src/rules/components/Flying.js";
import { NamedIdentity } from "../src/rules/components/NamedIdentity.js";
import { Player } from "../src/rules/components/Player.js";
import { Position } from "../src/rules/components/Position.js";
import { Vitality } from "../src/rules/components/Vitality.js";
import {
  OPENING_SEQUENCE_BONUS_ATTACK,
  OPENING_SEQUENCE_BONUS_HP,
  OPENING_SEQUENCE_DAMAGE_DICE,
  OPENING_SEQUENCE_SMITE_DAMAGE,
  performOpeningPrayerSmite,
  primeOpeningDeityFavor,
  spawnOpeningDragonWhelp,
} from "../src/main/openingSequence.js";
import { Deity } from "../src/lib/deity-js/deity.js";

function makePlayer(world, x = 5, y = 5) {
  const id = world.create();
  world.add(id, Player, {});
  world.add(id, Position, { x, y });
  world.add(id, Vitality, { hp: 25, maxHp: 25 });
  world.add(id, NamedIdentity, { name: "Hero", identity: "player" });
  return id;
}

Deno.test("spawnOpeningDragonWhelp replaces prior whelps and starts airborne on the player trail", () => {
  const world = new World({ seed: 0xBADC0DE });
  const playerId = makePlayer(world, 10, 10);

  const staleDragon = world.create();
  world.add(staleDragon, NamedIdentity, { name: "Old Whelp", identity: "dragon_whelp" });
  world.add(staleDragon, Position, { x: 1, y: 1 });
  world.add(staleDragon, Vitality, { hp: 1, maxHp: 1 });

  const dragonId = spawnOpeningDragonWhelp(world, {
    playerId,
    playerPos: { x: 10, y: 10 },
    spawnPos: { x: 18, y: 10 },
  });

  const dragonIds = [];
  for (const [id, ident] of world.query(NamedIdentity)) {
    if (String(ident?.identity || "") === "dragon_whelp") dragonIds.push(id);
  }

  const aggro = world.get(dragonId, AggroState);
  const pos = world.get(dragonId, Position);
  const vit = world.get(dragonId, Vitality);
  const eq = world.get(dragonId, Equipment);

  assertEquals(dragonIds, [dragonId], "only the opening dragon should remain");
  assert(world.has(dragonId, Flying), "opening dragon should start airborne");
  assertEquals(pos, { x: 18, y: 10 });
  assertEquals(aggro.alertLevel, AGGRO_LEVELS.hunting);
  assertEquals(aggro.lastKnownX, 10);
  assertEquals(aggro.lastKnownY, 10);
  assert(aggro.searchTurnsLeft >= 9999, "opening dragon should stay committed to the player");
  assertEquals(vit.maxHp, 24 + OPENING_SEQUENCE_BONUS_HP);
  assertEquals(vit.hp, 24 + OPENING_SEQUENCE_BONUS_HP);
  assertEquals(eq.attackDerived, 4 + OPENING_SEQUENCE_BONUS_ATTACK);
  assertEquals(eq.naturalDamageDice, OPENING_SEQUENCE_DAMAGE_DICE);
});

Deno.test("performOpeningPrayerSmite emits divine wrath and kills the opening dragon", () => {
  const world = new World({ seed: 0xABCD });
  const playerId = makePlayer(world, 10, 10);
  const dragonId = spawnOpeningDragonWhelp(world, {
    playerId,
    playerPos: { x: 10, y: 10 },
    spawnPos: { x: 18, y: 10 },
  });

  const wrathEvents = [];
  const miracleEvents = [];
  const deathEvents = [];
  world.on("deity:wrath", (payload) => wrathEvents.push(payload));
  world.on("deity:miracle", (payload) => miracleEvents.push(payload));
  world.on("died", (payload) => deathEvents.push(payload));

  const didSmite = performOpeningPrayerSmite(world, {
    dragonId,
    deityId: "seraphine",
    deityName: "Seraphine",
  });

  assertEquals(didSmite, true);
  assertEquals(wrathEvents.length, 1);
  assertEquals(wrathEvents[0].playerId, dragonId);
  assertEquals(wrathEvents[0].damage, OPENING_SEQUENCE_SMITE_DAMAGE);
  assertEquals(miracleEvents.length, 1);
  assert(miracleEvents[0].message.includes("Seraphine"), "miracle log should name the deity");
  assertEquals(deathEvents.length, 1);
  assertEquals(deathEvents[0].id, dragonId);
  assertEquals(world.get(dragonId, Vitality).hp, 0);
});

Deno.test("primeOpeningDeityFavor forces a serenity-dominant mood", () => {
  const deity = new Deity({ name: "Seraphine" });
  const primed = primeOpeningDeityFavor(deity);
  const mood = deity.query().mood;

  assertEquals(primed, true);
  assert(mood.serenity > 0.85, "opening deity should be overwhelmingly serene");
  assert(mood.wrath < 0.05, "opening deity should not be wrathful toward the player");
});
