import { MonsterSpawner } from "../components/MonsterSpawner.js";
import { Position } from "../components/Position.js";
import { Vitality } from "../components/Vitality.js";
import { Owner } from "../components/Owner.js";
import { createFrom } from "../../lib/ecs-js/archetype.js";
import { Monster } from "../archetypes/Creatures.js";
import { attach } from "../../lib/ecs-js/hierarchy.js";

/** @param {import('../../lib/ecs-js/index.js').World} world */
export function monsterSpawnerSystem(world) {
  for (const [id, sp] of world.query(MonsterSpawner)) {
    try {
      if (!sp?.isActive) continue;
      const pos = world.get(id, Position);
      if (!pos) continue;
      const vit = world.get(id, Vitality);
      if (vit && (vit.hp ?? 0) <= 0) continue;

      // Cull dead children
      const aliveChildren = [];
      for (const cid of sp.activeChildren) {
        if (world.isAlive(cid)) aliveChildren.push(cid);
      }
      if (aliveChildren.length !== sp.activeChildren.length) {
        world.mutate(id, MonsterSpawner, (r) => { r.activeChildren = aliveChildren; });
      }

      if (sp.spawnedSoFar >= sp.totalToSpawn) continue;
      if (aliveChildren.length >= sp.maxConcurrent) continue;

      const now = world.step | 0;
      const last = Number.isFinite(sp.lastSpawnStep) ? sp.lastSpawnStep : -Infinity;
      if ((now - last) < sp.cooldownTicks) continue;

      // Pick a random integer offset within spawnRadius tiles
      const rand = world.rand;
      const radius = Math.max(0, sp.spawnRadius | 0);
      const ox = radius > 0 ? Math.round((rand() * 2 - 1) * radius) : 0;
      const oy = radius > 0 ? Math.round((rand() * 2 - 1) * radius) : 0;
      const sx = (pos.x + ox) | 0;
      const sy = (pos.y + oy) | 0;

      const params = Object.assign({ x: sx, y: sy }, sp.spawnParams || {});
      const child = createFrom(world, Monster, params);
      try { world.add(child, Owner, { ownerId: id }); } catch {}

      // Attach child to spawner via hierarchy so destroySubtree cleans it up on floor transition.
      try { attach(world, child, id); } catch {}

      world.mutate(id, MonsterSpawner, (r) => {
        r.spawnedSoFar = Math.min(r.totalToSpawn, (r.spawnedSoFar | 0) + 1);
        r.lastSpawnStep = now;
        r.activeChildren.push(child);
      });
    } catch {}
  }
}
