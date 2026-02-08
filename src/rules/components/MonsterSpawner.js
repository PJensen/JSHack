import { defineComponent } from "../../lib/ecs-js/index.js";

export const MonsterSpawner = defineComponent(
  "MonsterSpawner",
  {
    maxConcurrent: 3,
    cooldownTicks: 10,
    totalToSpawn: 5,
    spawnedSoFar: 0,
    lastSpawnStep: -Infinity,
    activeChildren: [],
    spawnParams: {},
    spawnRadius: 1,
    isActive: true,
  },
  {
    validate(rec) {
      if (!rec) return false;
      const posNum = (v) => typeof v === "number" && Number.isFinite(v);
      if (!posNum(rec.maxConcurrent) || rec.maxConcurrent < 0) return false;
      if (!posNum(rec.cooldownTicks) || rec.cooldownTicks < 0) return false;
      if (!posNum(rec.totalToSpawn) || rec.totalToSpawn < 0) return false;
      if (!posNum(rec.spawnedSoFar) || rec.spawnedSoFar < 0) return false;
      if (typeof rec.lastSpawnStep !== "number") return false;
      if (!Array.isArray(rec.activeChildren)) return false;
      if (typeof rec.spawnParams !== "object" || rec.spawnParams == null) return false;
      if (!posNum(rec.spawnRadius) || rec.spawnRadius < 0) return false;
      if (typeof rec.isActive !== "boolean") return false;
      if (rec.spawnedSoFar > rec.totalToSpawn) rec.spawnedSoFar = rec.totalToSpawn;
      return true;
    },
  }
);
