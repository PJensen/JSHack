// src/rules/systems/monsterSpawnerSystem.js
// Spawns monsters over time from entities with MonsterSpawner.

import { MonsterSpawner } from "../components/MonsterSpawner.js";
import { Position } from "../components/Position.js";
import { Vitality } from "../components/Vitality.js";
import { Owner } from "../components/Owner.js";
import { createFrom } from "../../lib/ecs-js/archetype.js";
import { Monster } from "../archetypes/Creatures.js";

/**
 * @param {import('../../lib/ecs-js').World} world
 */
export function monsterSpawnerSystem(world) {
  for (const [id, sp] of world.query(MonsterSpawner)) {
    try {
      if (!sp?.isActive) continue;
      const pos = world.get(id, Position);
      if (!pos) continue;
      const vit = world.get(id, Vitality);
      if (vit && (vit.hp ?? 0) <= 0) continue; // destroyed spawner

      // Cull inactive children
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
      const due = (now - last) >= sp.cooldownTicks;
      if (!due) continue;

      // Spawn
      const rand = world.rand;
      const ang = (rand() * Math.PI * 2);
      const rad = (sp.spawnRadius ?? 0) * rand();
      const sx = pos.x + Math.cos(ang) * rad;
      const sy = pos.y + Math.sin(ang) * rad;
      const params = Object.assign({ x: sx, y: sy }, sp.spawnParams || {});
      const child = createFrom(world, Monster, params);
      try { world.add(child, Owner, { ownerId: id }); } catch {}

      world.mutate(id, MonsterSpawner, (r) => {
        r.spawnedSoFar = Math.min(r.totalToSpawn, (r.spawnedSoFar | 0) + 1);
        r.lastSpawnStep = now;
        r.activeChildren.push(child);
      });
    } catch {}
  }
}

