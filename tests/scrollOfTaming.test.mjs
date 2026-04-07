import { assert, assertEquals } from "jsr:@std/assert";
import { World } from '../src/lib/ecs-js/index.js';
import { Position } from '../src/rules/components/Position.js';
import { Player } from '../src/rules/components/Player.js';
import { NamedIdentity } from '../src/rules/components/NamedIdentity.js';
import { Faction } from '../src/rules/components/Faction.js';
import { Vitality } from '../src/rules/components/Vitality.js';
import { AggroState, AGGRO_LEVELS, SEARCH_TURNS_HUNTING_GRACE } from '../src/rules/components/AggroState.js';
import { Pet } from '../src/rules/components/Pet.js';
import { Owner } from '../src/rules/components/Owner.js';
import { PetState } from '../src/rules/components/PetState.js';
import { installTamingListener } from '../src/rules/systems/tamingSystem.js';

function makeWorld(seed = 1) {
  const world = new World({ seed });
  installTamingListener(world);
  return world;
}

function makePlayer(world, x, y) {
  const id = world.create();
  world.add(id, Player);
  world.add(id, Position, { x, y });
  world.add(id, NamedIdentity, { name: 'Hero', identity: 'player' });
  world.add(id, Vitality, { hp: 30, maxHp: 30 });
  return id;
}

function makeEnemy(world, x, y, identity) {
  const id = world.create();
  world.add(id, Position, { x, y });
  world.add(id, NamedIdentity, { name: identity, identity });
  world.add(id, Faction, { key: 'enemy' });
  world.add(id, Vitality, { hp: 10, maxHp: 10 });
  world.add(id, AggroState, {
    alertLevel: AGGRO_LEVELS.hunting,
    lastKnownX: x,
    lastKnownY: y,
    searchTurnsLeft: SEARCH_TURNS_HUNTING_GRACE,
    retreating: false,
  });
  return id;
}

// ── Taming conversion tests ─────────────────────────────────────────────────

Deno.test("taming converts enemy faction to pet", () => {
  const world = makeWorld();
  const player = makePlayer(world, 5, 5);
  const enemy = makeEnemy(world, 8, 5, 'goblin');

  world.emit("scroll:taming:apply", { actor: player, target: enemy });

  const fac = world.get(enemy, Faction);
  assertEquals(fac.key, "pet", "faction should be pet after taming");
});

Deno.test("taming adds Pet tag component", () => {
  const world = makeWorld();
  const player = makePlayer(world, 5, 5);
  const enemy = makeEnemy(world, 8, 5, 'goblin');

  world.emit("scroll:taming:apply", { actor: player, target: enemy });

  assert(world.has(enemy, Pet), "enemy should have Pet component after taming");
});

Deno.test("taming adds Owner pointing to player", () => {
  const world = makeWorld();
  const player = makePlayer(world, 5, 5);
  const enemy = makeEnemy(world, 8, 5, 'goblin');

  world.emit("scroll:taming:apply", { actor: player, target: enemy });

  const owner = world.get(enemy, Owner);
  assert(owner, "enemy should have Owner component");
  assertEquals(owner.ownerId, player, "owner should be the player");
});

Deno.test("taming adds PetState in following mode", () => {
  const world = makeWorld();
  const player = makePlayer(world, 5, 5);
  const enemy = makeEnemy(world, 8, 5, 'goblin');

  world.emit("scroll:taming:apply", { actor: player, target: enemy });

  const ps = world.get(enemy, PetState);
  assert(ps, "enemy should have PetState component");
  assertEquals(ps.state, "following", "pet should start in following state");
});

Deno.test("taming removes AggroState", () => {
  const world = makeWorld();
  const player = makePlayer(world, 5, 5);
  const enemy = makeEnemy(world, 8, 5, 'goblin');

  world.emit("scroll:taming:apply", { actor: player, target: enemy });

  assert(!world.has(enemy, AggroState), "AggroState should be removed after taming");
});

Deno.test("taming preserves entity position and vitality", () => {
  const world = makeWorld();
  const player = makePlayer(world, 5, 5);
  const enemy = makeEnemy(world, 8, 5, 'goblin');

  world.emit("scroll:taming:apply", { actor: player, target: enemy });

  const pos = world.get(enemy, Position);
  assertEquals(pos.x, 8, "position should be preserved");
  assertEquals(pos.y, 5, "position should be preserved");
  const vit = world.get(enemy, Vitality);
  assertEquals(vit.hp, 10, "hp should be preserved");
});

Deno.test("taming rejects non-enemy targets", () => {
  const world = makeWorld();
  const player = makePlayer(world, 5, 5);

  // Create a neutral entity
  const neutral = world.create();
  world.add(neutral, Position, { x: 8, y: 5 });
  world.add(neutral, NamedIdentity, { name: 'Villager', identity: 'villager' });
  world.add(neutral, Faction, { key: 'neutral' });
  world.add(neutral, Vitality, { hp: 10, maxHp: 10 });

  world.emit("scroll:taming:apply", { actor: player, target: neutral });

  const fac = world.get(neutral, Faction);
  assertEquals(fac.key, "neutral", "neutral faction should not change");
  assert(!world.has(neutral, Pet), "neutral should not become a pet");
});
