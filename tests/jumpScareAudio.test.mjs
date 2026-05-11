import "./helpers/installContentMonsters.mjs";
import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { Brain } from "../src/rules/components/Brain.js";
import { DungeonState } from "../src/rules/components/DungeonState.js";
import { NamedIdentity } from "../src/rules/components/NamedIdentity.js";
import { Player } from "../src/rules/components/Player.js";
import { Position } from "../src/rules/components/Position.js";
import { Vitality } from "../src/rules/components/Vitality.js";
import {
  DEFAULT_JUMP_SCARE_SOUND_ID,
  JUMP_SCARE_SOUND_BY_TAG,
  jumpScareSystem,
  resolveJumpScareSoundId,
} from "../src/rules/systems/jumpScareSystem.js";

Deno.test("jump scare audio routes through explicit creature tag maps", () => {
  assertEquals(JUMP_SCARE_SOUND_BY_TAG.witchy, "ambient:whisper");
  assertEquals(JUMP_SCARE_SOUND_BY_TAG.haunting, "ambient:whisper");
  assertEquals(JUMP_SCARE_SOUND_BY_TAG.draconic, "ambient:roar");
  assertEquals(DEFAULT_JUMP_SCARE_SOUND_ID, "ambient:roar");
  assertEquals(resolveJumpScareSoundId({ id: 2, depth: 2, identity: "marsh_witch" }), "ambient:whisper");
  assertEquals(resolveJumpScareSoundId({ id: 2, depth: 2, identity: "wight" }), "ambient:whisper");
  assertEquals(resolveJumpScareSoundId({ id: 2, depth: 2, identity: "dark_acolyte" }), "ambient:whisper");
  assertEquals(resolveJumpScareSoundId({ id: 3, depth: 2, identity: "dragon" }), "ambient:roar");
  assertEquals(resolveJumpScareSoundId({ id: 3, depth: 2, brain: { learnedSpellIds: ["bog_curse"] } }), "ambient:roar");
});

Deno.test("jumpScareSystem emits positioned whisper audio for marsh witch", () => {
  const world = new World({ seed: 11 });
  const ds = world.create();
  world.add(ds, DungeonState, { worldSeed: 11, currentDepth: 1, floorEntityIds: [] });

  const player = world.create();
  world.add(player, Player, {});
  world.add(player, Position, { x: 10, y: 10 });

  const witch = world.create();
  world.add(witch, Position, { x: 12, y: 10 });
  world.add(witch, NamedIdentity, { name: "Marsh Witch", identity: "marsh_witch" });
  world.add(witch, Brain, { learnedSpellIds: ["bog_curse"], itemKnowledgeIdentities: [], seenTiles: new Uint8Array(), intelligence: 8, visionRange: 6 });
  world.add(witch, Vitality, { maxHp: 20, hp: 20 });

  let audio = null;
  world.on("audio:play", (payload) => { audio = payload; });

  jumpScareSystem(world);

  assert(audio, "expected jump scare audio event");
  assertEquals(audio.key, "ambient:whisper");
  assertEquals(audio.at, { x: 12, y: 10 });
});
