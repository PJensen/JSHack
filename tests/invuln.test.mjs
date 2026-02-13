import { assert } from "jsr:@std/assert";
import { World } from '../src/lib/ecs-js/index.js';
import { configureWorld } from '../src/main/scheduler.js';
import { createFrom } from '../src/lib/ecs-js/archetype.js';
import { createPlayer } from '../src/rules/archetypes/Player.js';
import { Monster } from '../src/rules/archetypes/Creatures.js';
import { ActiveEffects } from '../src/rules/components/ActiveEffects.js';
import { Position } from '../src/rules/components/Position.js';
import { MoveIntent } from '../src/rules/components/Intents/MoveIntent.js';
import { Vitality } from '../src/rules/components/Vitality.js';

Deno.test("invulnerability prevents damage from monster attack", () => {
  const world = new World({ seed: 1337 });
  configureWorld(world);

  const pid = createPlayer(world, { x: 0, y: 0 });
  const mid = createFrom(world, Monster, { x: 1, y: 0, name: 'Ortho' });

  const pvit0 = world.get(pid, Vitality);
  const hp0 = pvit0.hp;

  world.add(pid, ActiveEffects, { effects: [{ key: 'invulnerable', turnsLeft: 10 }] });
  world.tick(1);

  world.add(mid, MoveIntent, { dx: -1, dy: 0 });
  world.tick(1);

  const pvit = world.get(pid, Vitality);
  assert(pvit.hp === hp0, `invulnerability failed; expected hp ${hp0}, got ${pvit.hp}`);
});
