import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { ActiveEffects } from "../src/rules/components/ActiveEffects.js";
import { AggroState, AGGRO_LEVELS } from "../src/rules/components/AggroState.js";
import { Faction } from "../src/rules/components/Faction.js";
import { HazardArea } from "../src/rules/components/HazardArea.js";
import { MoveIntent } from "../src/rules/components/Intents/MoveIntent.js";
import { NamedIdentity } from "../src/rules/components/NamedIdentity.js";
import { Player } from "../src/rules/components/Player.js";
import { Position } from "../src/rules/components/Position.js";
import { Vitality } from "../src/rules/components/Vitality.js";
import { CHUNK_SIZE, TILE_FLOOR } from "../src/rules/environment/dungeon/constants.js";
import { clearAll, loadChunk } from "../src/rules/environment/dungeon/tileMap.js";
import { aiChaseSystem } from "../src/rules/systems/aiChaseSystem.js";
import { hazardSystem } from "../src/rules/systems/hazardSystem.js";

Deno.test("dragon whelp breathes fire in a line, leaves fire hazards, and consumes its turn", () => {
  clearAll();
  loadChunk(0, 0, new Uint8Array(CHUNK_SIZE * CHUNK_SIZE).fill(TILE_FLOOR));

  try {
    const world = new World({ seed: 0xD06A0 });
    const breaths = [];
    world.on("monster:firebreath", (payload) => breaths.push(payload));

    const player = world.create();
    world.add(player, Player);
    world.add(player, Position, { x: 5, y: 5 });
    world.add(player, NamedIdentity, { name: "Hero", identity: "player" });
    world.add(player, Faction, { key: "player" });
    world.add(player, Vitality, { maxHp: 12, hp: 12 });
    world.add(player, ActiveEffects, { effects: [] });

    const dragon = world.create();
    world.add(dragon, Position, { x: 1, y: 5 });
    world.add(dragon, NamedIdentity, { name: "Dragon Whelp", identity: "dragon_whelp" });
    world.add(dragon, Faction, { key: "enemy" });
    world.add(dragon, Vitality, { maxHp: 24, hp: 24 });
    world.add(dragon, AggroState, {
      alertLevel: AGGRO_LEVELS.unaware,
      lastKnownX: 0,
      lastKnownY: 0,
      searchTurnsLeft: 0,
      retreating: false,
    });

    aiChaseSystem(world);

    assertEquals(breaths.length, 1, "dragon whelp should fire exactly one breath event");
    assert(!world.has(dragon, MoveIntent), "breath should consume the dragon's turn");

    const breath = breaths[0];
    assertEquals(
      breath.tiles,
      [{ x: 2, y: 5 }, { x: 3, y: 5 }, { x: 4, y: 5 }, { x: 5, y: 5 }],
      "breath path should cover the straight line to the player",
    );

    const playerVitAfterBreath = world.get(player, Vitality);
    assertEquals(playerVitAfterBreath.hp, 8, "breath should deal immediate fire damage");

    const effects = world.get(player, ActiveEffects)?.effects ?? [];
    assert(effects.some((effect) => effect.key === "burn"), "breath should apply burn");

    const fireHazards = [];
    for (const [id, pos, hazard] of world.query(Position, HazardArea)) {
      if (String(hazard.kind || "") !== "fire") continue;
      fireHazards.push({ id, x: pos.x | 0, y: pos.y | 0 });
    }
    assertEquals(
      fireHazards.map(({ x, y }) => ({ x, y })),
      [{ x: 2, y: 5 }, { x: 3, y: 5 }, { x: 4, y: 5 }, { x: 5, y: 5 }],
      "breath should leave fire hazards on every traversed tile",
    );

    hazardSystem(world);
    const playerVitAfterHazard = world.get(player, Vitality);
    assertEquals(playerVitAfterHazard.hp, 7, "standing in the final fire tile should hurt on hazard pulse");
  } finally {
    clearAll();
  }
});
