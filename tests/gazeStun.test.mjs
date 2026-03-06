// Floating eye gaze: 8 consecutive turns in LOS -> 3-turn stun + 1 mindwipe stack.

import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { Position } from "../src/rules/components/Position.js";
import { Player } from "../src/rules/components/Player.js";
import { NamedIdentity } from "../src/rules/components/NamedIdentity.js";
import { Faction } from "../src/rules/components/Faction.js";
import { AggroState, AGGRO_LEVELS, SEARCH_TURNS_HUNTING_GRACE } from "../src/rules/components/AggroState.js";
import { Speed } from "../src/rules/components/Speed.js";
import { Brain } from "../src/rules/components/Brain.js";
import { ActiveEffects } from "../src/rules/components/ActiveEffects.js";
import { MoveIntent } from "../src/rules/components/Intents/MoveIntent.js";
import { aiChaseSystem } from "../src/rules/systems/aiChaseSystem.js";
import { clearAll, loadChunk, setTile } from "../src/rules/environment/dungeon/tileMap.js";
import { CHUNK_SIZE, TILE_FLOOR, TILE_WALL } from "../src/rules/environment/dungeon/constants.js";

function makeWorld(seed = 1) {
  clearAll();
  loadChunk(0, 0, new Uint8Array(CHUNK_SIZE * CHUNK_SIZE).fill(TILE_FLOOR));
  return new World({ seed });
}

function placePlayer(world, x, y) {
  const id = world.create();
  world.add(id, Player);
  world.add(id, Position, { x, y });
  world.add(id, ActiveEffects, { effects: [] });
  return id;
}

function placeEye(world, x, y) {
  const id = world.create();
  world.add(id, Position, { x, y });
  world.add(id, NamedIdentity, { name: "Floating Eye", identity: "floating_eye" });
  world.add(id, Faction, { key: "enemy" });
  world.add(id, AggroState, {
    alertLevel: AGGRO_LEVELS.hunting,
    lastKnownX: x,
    lastKnownY: y,
    searchTurnsLeft: SEARCH_TURNS_HUNTING_GRACE,
    retreating: false,
  });
  // Floating eye speed=1 maps to actEvery=3 in the shared creature archetype.
  world.add(id, Speed, { actEvery: 3 });
  world.add(id, Brain, { intelligence: 2, visionRange: 6 });
  return id;
}

function gazeTurn(world, eye) {
  world.step++;
  aiChaseSystem(world);
  if (world.has(eye, MoveIntent)) world.remove(eye, MoveIntent);
}

function getEffect(world, entityId, key) {
  return world.get(entityId, ActiveEffects)?.effects?.find((effect) => effect.key === key) ?? null;
}

Deno.test("floating_eye: 8 turns in gaze applies stun and one mindwipe stack", () => {
  const world = makeWorld(1);
  const player = placePlayer(world, 5, 5);
  const eye = placeEye(world, 8, 5);

  for (let i = 0; i < 8; i++) gazeTurn(world, eye);

  const stun = getEffect(world, player, "stun");
  const mindwipe = getEffect(world, player, "mindwipe");
  assert(stun && stun.turnsLeft >= 4, `expected 3-turn gaze stun after 8 turns, got ${JSON.stringify(world.get(player, ActiveEffects)?.effects)}`);
  assert(mindwipe, "expected mindwipe after 8 turns in gaze");
  assertEquals(mindwipe.stacks, 1);
});

Deno.test("floating_eye: 7 turns in gaze is not enough", () => {
  const world = makeWorld(2);
  const player = placePlayer(world, 5, 5);
  const eye = placeEye(world, 8, 5);

  for (let i = 0; i < 7; i++) gazeTurn(world, eye);

  assertEquals(getEffect(world, player, "stun"), null);
  assertEquals(getEffect(world, player, "mindwipe"), null);
});

Deno.test("floating_eye: losing LOS resets the gaze charge", () => {
  const world = makeWorld(3);
  const player = placePlayer(world, 5, 5);
  const eye = placeEye(world, 8, 5);

  for (let i = 0; i < 7; i++) gazeTurn(world, eye);

  setTile(7, 5, TILE_WALL);
  gazeTurn(world, eye);
  setTile(7, 5, TILE_FLOOR);

  for (let i = 0; i < 7; i++) gazeTurn(world, eye);

  assertEquals(getEffect(world, player, "stun"), null);
  assertEquals(getEffect(world, player, "mindwipe"), null);
});

Deno.test("floating_eye: staying in gaze for 16 turns retriggers and adds a second mindwipe stack", () => {
  const world = makeWorld(4);
  const player = placePlayer(world, 5, 5);
  const eye = placeEye(world, 8, 5);

  for (let i = 0; i < 16; i++) gazeTurn(world, eye);

  const stun = getEffect(world, player, "stun");
  const mindwipe = getEffect(world, player, "mindwipe");
  assert(stun && stun.turnsLeft >= 4, `expected refreshed 3-turn stun after 16 turns, got ${JSON.stringify(world.get(player, ActiveEffects)?.effects)}`);
  assert(mindwipe, "expected mindwipe after repeated gaze exposure");
  assertEquals(mindwipe.stacks, 2);
});
