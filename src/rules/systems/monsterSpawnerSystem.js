import { MonsterSpawner } from "../components/MonsterSpawner.js";
import { Position } from "../components/Position.js";
import { Vitality } from "../components/Vitality.js";
import { Owner } from "../components/Owner.js";
import { attach } from "../../lib/ecs-js/hierarchy.js";
import { isGenocided } from "../data/monsters.js";
import { getTileQuerySnapshot } from "../utils/tileQueryCache.js";
import { isWalkable } from "../environment/dungeon/tileMap.js";
import { spawnMonsterEntity } from "../utils/spawnMonsterEntity.js";
import { isExplored } from "../environment/dungeon/exploredMap.js";

/** @param {import('../../lib/ecs-js/index.js').World} world */
export function monsterSpawnerSystem(world) {
  for (const [id, sp] of world.query(MonsterSpawner)) {
    try {
      // Dormant spawners activate once the player has explored their tile.
      if (!sp.isActive) {
        const pos = world.get(id, Position);
        if (pos && isExplored(pos.x, pos.y)) {
          world.mutate(id, MonsterSpawner, (r) => { r.isActive = true; });
        }
        continue;
      }
      if (isGenocided(sp.spawnParams?.identity)) continue;
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

      // Pick a random integer offset within spawnRadius tiles,
      // avoiding tiles occupied by solid or interactable entities (chests, doors, decorations).
      const rand = world.rand;
      const radius = Math.max(0, sp.spawnRadius | 0);
      const tiles = getTileQuerySnapshot(world);
      let sx, sy, spawnAttempts = 0;
      do {
        const ox = radius > 0 ? Math.round((rand() * 2 - 1) * radius) : 0;
        const oy = radius > 0 ? Math.round((rand() * 2 - 1) * radius) : 0;
        sx = (pos.x + ox) | 0;
        sy = (pos.y + oy) | 0;
        spawnAttempts++;
      } while (spawnAttempts < 8 &&
        (!isWalkable(sx, sy) || tiles.blockedByCell.has(`${sx},${sy}`) || tiles.interactableByCell.has(`${sx},${sy}`)));
      if (!isWalkable(sx, sy) || tiles.blockedByCell.has(`${sx},${sy}`) || tiles.interactableByCell.has(`${sx},${sy}`)) continue;

      const params = Object.assign({ x: sx, y: sy }, sp.spawnParams || {});
      const child = spawnMonsterEntity(world, params);
      try { world.add(child, Owner, { ownerId: id }); } catch {} // ECS: may already exist

      // Attach child to spawner via hierarchy so destroySubtree cleans it up on floor transition.
      try { attach(world, child, id); } catch {} // hierarchy attach may fail if already linked

      world.mutate(id, MonsterSpawner, (r) => {
        r.spawnedSoFar = Math.min(r.totalToSpawn, (r.spawnedSoFar | 0) + 1);
        r.lastSpawnStep = now;
        r.activeChildren.push(child);
      });
    } catch (e) { console.error('[monsterSpawnerSystem] spawner tick failed:', e); }
  }
}
