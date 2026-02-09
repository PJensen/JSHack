import { assert } from "jsr:@std/assert";
import { World } from '../src/lib/ecs-js/index.js';
import { Position } from '../src/rules/components/Position.js';
import { Player } from '../src/rules/components/Player.js';
import { NamedIdentity } from '../src/rules/components/NamedIdentity.js';
import { Faction } from '../src/rules/components/Faction.js';
import { MoveIntent } from '../src/rules/components/Intents/MoveIntent.js';
import { aiChaseSystem } from '../src/rules/systems/aiChaseSystem.js';

Deno.test("monster east of player chases west", () => {
  const world = new World({ seed: 1 });

  const player = world.create();
  world.add(player, Player);
  world.add(player, Position, { x: 5, y: 5 });
  world.add(player, NamedIdentity, { name: 'Hero', identity: 'player' });

  const m1 = world.create();
  world.add(m1, Position, { x: 8, y: 5 });
  world.add(m1, NamedIdentity, { name: 'Goblin', identity: 'goblin' });
  world.add(m1, Faction, { key: 'enemy' });

  aiChaseSystem(world);

  const intent = world.get(m1, MoveIntent);
  assert(intent, 'monster should have MoveIntent');
  assert(intent.dx === -1 && intent.dy === 0, `m1 should move west, got dx=${intent.dx} dy=${intent.dy}`);
});

Deno.test("monster north of player chases south", () => {
  const world = new World({ seed: 1 });

  const player = world.create();
  world.add(player, Player);
  world.add(player, Position, { x: 5, y: 5 });
  world.add(player, NamedIdentity, { name: 'Hero', identity: 'player' });

  const m2 = world.create();
  world.add(m2, Position, { x: 5, y: 2 });
  world.add(m2, NamedIdentity, { name: 'Orc', identity: 'orc' });
  world.add(m2, Faction, { key: 'enemy' });

  aiChaseSystem(world);

  const i2 = world.get(m2, MoveIntent);
  assert(i2, 'm2 should have MoveIntent');
  assert(i2.dx === 0 && i2.dy === 1, `m2 should move south, got dx=${i2.dx} dy=${i2.dy}`);
});

Deno.test("diagonal chase: equal distance prefers x-axis", () => {
  const world = new World({ seed: 1 });

  const player = world.create();
  world.add(player, Player);
  world.add(player, Position, { x: 5, y: 5 });
  world.add(player, NamedIdentity, { name: 'Hero', identity: 'player' });

  const m3 = world.create();
  world.add(m3, Position, { x: 8, y: 2 });
  world.add(m3, NamedIdentity, { name: 'Troll', identity: 'troll' });
  world.add(m3, Faction, { key: 'enemy' });

  aiChaseSystem(world);

  const i3 = world.get(m3, MoveIntent);
  assert(i3, 'm3 should have MoveIntent');
  assert(i3.dx === -1 && i3.dy === 0, `m3 should move along x-axis, got dx=${i3.dx} dy=${i3.dy}`);
});

Deno.test("pre-existing MoveIntent is not overwritten", () => {
  const world = new World({ seed: 1 });

  const player = world.create();
  world.add(player, Player);
  world.add(player, Position, { x: 5, y: 5 });
  world.add(player, NamedIdentity, { name: 'Hero', identity: 'player' });

  const m4 = world.create();
  world.add(m4, Position, { x: 3, y: 5 });
  world.add(m4, NamedIdentity, { name: 'Imp', identity: 'imp' });
  world.add(m4, Faction, { key: 'enemy' });
  world.add(m4, MoveIntent, { dx: 0, dy: -1 });

  aiChaseSystem(world);

  const i4 = world.get(m4, MoveIntent);
  assert(i4.dx === 0 && i4.dy === -1, 'pre-existing MoveIntent should not be overwritten');
});

Deno.test("monster on same tile as player does not move", () => {
  const world = new World({ seed: 1 });

  const player = world.create();
  world.add(player, Player);
  world.add(player, Position, { x: 5, y: 5 });
  world.add(player, NamedIdentity, { name: 'Hero', identity: 'player' });

  const m5 = world.create();
  world.add(m5, Position, { x: 5, y: 5 });
  world.add(m5, NamedIdentity, { name: 'Shade', identity: 'shade' });
  world.add(m5, Faction, { key: 'enemy' });

  aiChaseSystem(world);

  assert(!world.has(m5, MoveIntent), 'monster on player tile should not get MoveIntent');
});

Deno.test("non-monster entity is ignored by AI chase", () => {
  const world = new World({ seed: 1 });

  const player = world.create();
  world.add(player, Player);
  world.add(player, Position, { x: 5, y: 5 });
  world.add(player, NamedIdentity, { name: 'Hero', identity: 'player' });

  const npc = world.create();
  world.add(npc, Position, { x: 0, y: 0 });
  world.add(npc, NamedIdentity, { name: 'Villager', identity: 'npc' });
  world.add(npc, Faction, { key: 'neutral' });

  aiChaseSystem(world);

  assert(!world.has(npc, MoveIntent), 'non-monster should not get MoveIntent');
});

Deno.test("no player → AI chase is a no-op", () => {
  const world = new World({ seed: 2 });
  const lonely = world.create();
  world.add(lonely, Position, { x: 0, y: 0 });
  world.add(lonely, NamedIdentity, { name: 'Bat', identity: 'bat' });
  world.add(lonely, Faction, { key: 'enemy' });
  aiChaseSystem(world);
  assert(!world.has(lonely, MoveIntent), 'no player means no chase');
});
