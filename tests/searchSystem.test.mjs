import { assert, assertEquals } from "jsr:@std/assert";
import { World } from '../src/lib/ecs-js/index.js';
import { SearchIntent } from '../src/rules/components/Intents/SearchIntent.js';
import { Position } from '../src/rules/components/Position.js';
import { Vitality } from '../src/rules/components/Vitality.js';
import { Brain } from '../src/rules/components/Brain.js';
import { Trap } from '../src/rules/components/Trap.js';
import { DoorState } from '../src/rules/components/DoorState.js';
import { Collider } from '../src/rules/components/Collider.js';
import { Interactable } from '../src/rules/components/Interactable.js';
import { SecretDoor } from '../src/rules/components/SecretDoor.js';
import { searchSystem } from '../src/rules/systems/searchSystem.js';
import { CHUNK_SIZE, TILE_FLOOR, TILE_WALL, TILE_DOOR } from '../src/rules/environment/dungeon/constants.js';
import { clearAll, getTile, loadChunk } from '../src/rules/environment/dungeon/tileMap.js';

Deno.test("search system consumes SearchIntent", () => {
  const world = new World({ seed: 1 });

  const actor = world.create();
  world.add(actor, SearchIntent);
  world.add(actor, Position, { x: 5, y: 5 });
  world.add(actor, Vitality, { maxHp: 20, hp: 20 });
  world.add(actor, Brain, { learnedSpellIds: [], itemKnowledgeIdentities: [], seenTiles: new Uint8Array(), intelligence: 10, visionRange: 6 });

  assert(world.has(actor, SearchIntent), 'should have SearchIntent before system runs');

  searchSystem(world);

  assert(!world.has(actor, SearchIntent), 'SearchIntent should be consumed');
});

Deno.test("search system is no-op with no searchers", () => {
  const world = new World({ seed: 1 });
  searchSystem(world); // should not throw
});

Deno.test("search system emits search:pulse event", () => {
  const world = new World({ seed: 2 });

  const actor = world.create();
  world.add(actor, SearchIntent);
  world.add(actor, Position, { x: 3, y: 4 });
  world.add(actor, Vitality, { maxHp: 20, hp: 20 });
  world.add(actor, Brain, { learnedSpellIds: [], itemKnowledgeIdentities: [], seenTiles: new Uint8Array(), intelligence: 10, visionRange: 8 });

  let pulseEvent = null;
  world.on('search:pulse', (ev) => { pulseEvent = ev; });

  searchSystem(world);

  assert(pulseEvent !== null, 'search:pulse event should be emitted');
  assertEquals(pulseEvent.at.x, 3, 'pulse origin x should match actor position');
  assertEquals(pulseEvent.at.y, 4, 'pulse origin y should match actor position');
  assertEquals(pulseEvent.radius, 8, 'pulse radius should match visionRange');
});

Deno.test("search system reveals hidden trap within radius", () => {
  const world = new World({ seed: 3 });

  const actor = world.create();
  world.add(actor, SearchIntent);
  world.add(actor, Position, { x: 5, y: 5 });
  world.add(actor, Vitality, { maxHp: 20, hp: 20 });
  world.add(actor, Brain, { learnedSpellIds: [], itemKnowledgeIdentities: [], seenTiles: new Uint8Array(), intelligence: 10, visionRange: 6 });

  const trap = world.create();
  world.add(trap, Position, { x: 7, y: 5 }); // 2 tiles away, within radius 6
  world.add(trap, Trap, { type: 'spike', armed: true, revealed: false, script: 'trap_spike', params: { percent: 0.25 }, difficulty: 10 });

  const messages = [];
  world.on('message', (ev) => messages.push(ev.text));

  searchSystem(world);

  const t = world.get(trap, Trap);
  assert(t.revealed === true, 'trap should be revealed after search');
  assert(messages.some(m => m.includes('hidden') && m.includes('trap')), `should emit trap reveal message, got: ${JSON.stringify(messages)}`);
});

Deno.test("search system does not reveal trap outside radius", () => {
  const world = new World({ seed: 4 });

  const actor = world.create();
  world.add(actor, SearchIntent);
  world.add(actor, Position, { x: 0, y: 0 });
  world.add(actor, Vitality, { maxHp: 20, hp: 20 });
  world.add(actor, Brain, { learnedSpellIds: [], itemKnowledgeIdentities: [], seenTiles: new Uint8Array(), intelligence: 10, visionRange: 3 });

  const trap = world.create();
  world.add(trap, Position, { x: 10, y: 10 }); // far outside radius 3
  world.add(trap, Trap, { type: 'spike', armed: true, revealed: false, script: 'trap_spike', params: { percent: 0.25 }, difficulty: 10 });

  searchSystem(world);

  const t = world.get(trap, Trap);
  assert(t.revealed === false, 'trap outside radius should not be revealed');
});

Deno.test("search system emits 'you find nothing' when no hidden traps", () => {
  const world = new World({ seed: 5 });

  const actor = world.create();
  world.add(actor, SearchIntent);
  world.add(actor, Position, { x: 5, y: 5 });
  world.add(actor, Vitality, { maxHp: 20, hp: 20 });
  world.add(actor, Brain, { learnedSpellIds: [], itemKnowledgeIdentities: [], seenTiles: new Uint8Array(), intelligence: 10, visionRange: 6 });

  const messages = [];
  world.on('message', (ev) => messages.push(ev.text));

  searchSystem(world);

  assert(messages.some(m => m.includes('nothing')), `should emit 'nothing' message, got: ${JSON.stringify(messages)}`);
});

Deno.test("search system skips dead actors", () => {
  const world = new World({ seed: 6 });

  const actor = world.create();
  world.add(actor, SearchIntent);
  world.add(actor, Position, { x: 5, y: 5 });
  world.add(actor, Vitality, { maxHp: 20, hp: 0 }); // dead

  let pulseEmitted = false;
  world.on('search:pulse', () => { pulseEmitted = true; });

  searchSystem(world);

  assert(!pulseEmitted, 'dead actor should not produce search pulse');
});

Deno.test("search system does not reveal already-revealed trap", () => {
  const world = new World({ seed: 7 });

  const actor = world.create();
  world.add(actor, SearchIntent);
  world.add(actor, Position, { x: 5, y: 5 });
  world.add(actor, Vitality, { maxHp: 20, hp: 20 });
  world.add(actor, Brain, { learnedSpellIds: [], itemKnowledgeIdentities: [], seenTiles: new Uint8Array(), intelligence: 10, visionRange: 6 });

  const trap = world.create();
  world.add(trap, Position, { x: 6, y: 5 });
  world.add(trap, Trap, { type: 'spike', armed: true, revealed: true, script: 'trap_spike', params: { percent: 0.25 }, difficulty: 10 });

  const messages = [];
  world.on('message', (ev) => messages.push(ev.text));

  searchSystem(world);

  // Should say nothing found since trap is already revealed
  assert(!messages.some(m => m.includes('revealed')), 'already-revealed trap should not emit reveal message');
  assert(messages.some(m => m.includes('nothing')), 'should emit nothing message when only already-revealed traps present');
});

Deno.test("search system emits search:pulse with position and actor", () => {
  const world = new World({ seed: 8 });

  const actor = world.create();
  world.add(actor, SearchIntent);
  world.add(actor, Position, { x: 10, y: 7 });
  world.add(actor, Vitality, { maxHp: 20, hp: 20 });

  let pulseEvent = null;
  world.on('search:pulse', (ev) => { pulseEvent = ev; });

  searchSystem(world);

  assert(pulseEvent !== null, 'search:pulse should be emitted');
  assertEquals(pulseEvent.actorId, actor, 'actorId should be the searcher');
  assertEquals(pulseEvent.at.x, 10, 'at.x should match position');
  assertEquals(pulseEvent.at.y, 7, 'at.y should match position');
});

Deno.test("search system reveals adjacent secret door deterministically", () => {
  clearAll();
  const tiles = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE).fill(TILE_FLOOR);
  tiles[5 * CHUNK_SIZE + 6] = TILE_WALL;
  loadChunk(0, 0, tiles);
  const world = new World({ seed: 9 });

  const actor = world.create();
  world.add(actor, SearchIntent);
  world.add(actor, Position, { x: 5, y: 5 });
  world.add(actor, Vitality, { maxHp: 20, hp: 20 });

  const door = world.create();
  world.add(door, Position, { x: 6, y: 5 });
  world.add(door, DoorState, { open: false, locked: false });
  world.add(door, Collider, { solid: true, blocksSight: true });
  world.add(door, Interactable, { action: "toggleDoor" });
  world.add(door, SecretDoor, { fromRoomId: "main", toRoomId: "leaf", revealed: false, difficulty: 8, hintKind: "hollow" });

  let revealed = null;
  const messages = [];
  world.on("search:revealed", (ev) => { revealed = ev; });
  world.on("message", (ev) => messages.push(ev.text));

  searchSystem(world);

  assertEquals(world.get(door, SecretDoor).revealed, true);
  assertEquals(getTile(6, 5), TILE_DOOR);
  assertEquals(revealed?.kind, "secret_door");
  assert(messages.some((m) => m.includes("hidden door")), `expected hidden door message, got ${JSON.stringify(messages)}`);
});

Deno.test("search system hints nearby secret door without revealing it", () => {
  clearAll();
  const tiles = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE).fill(TILE_FLOOR);
  tiles[5 * CHUNK_SIZE + 7] = TILE_WALL;
  loadChunk(0, 0, tiles);
  const world = new World({ seed: 10 });

  const actor = world.create();
  world.add(actor, SearchIntent);
  world.add(actor, Position, { x: 5, y: 5 });
  world.add(actor, Vitality, { maxHp: 20, hp: 20 });

  const door = world.create();
  world.add(door, Position, { x: 7, y: 5 });
  world.add(door, DoorState, { open: false, locked: false });
  world.add(door, Collider, { solid: true, blocksSight: true });
  world.add(door, Interactable, { action: "toggleDoor" });
  world.add(door, SecretDoor, { fromRoomId: "main", toRoomId: "leaf", revealed: false, difficulty: 8, hintKind: "draft" });

  const messages = [];
  world.on("message", (ev) => messages.push(ev.text));

  searchSystem(world);

  assertEquals(world.get(door, SecretDoor).revealed, false);
  assertEquals(getTile(7, 5), TILE_WALL);
  assert(messages.some((m) => m.includes("draft")), `expected draft hint, got ${JSON.stringify(messages)}`);
  assert(!messages.some((m) => m.includes("nothing")), "hint should count as a search result");
});
