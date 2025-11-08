import { defineArchetype } from "../../lib/ecs-js/archetype.js";
import { Position } from "../components/Position.js";
import { NamedIdentity } from "../components/NamedIdentity.js";
import { Vitality } from "../components/Vitality.js";
import { MonsterSpawner } from "../components/MonsterSpawner.js";

export const Spawner = defineArchetype(
  "Spawner",
  [Position, (p) => ({ x: p.x ?? 0, y: p.y ?? 0 })],
  [NamedIdentity, (p) => ({ name: p.name ?? "Monster Spawner", identity: p.identity ?? "spawner" })],
  [Vitality, (p) => ({ maxHp: p.maxHp ?? 100, hp: p.hp ?? (p.maxHp ?? 100) })],
  [MonsterSpawner, (p) => ({
    maxConcurrent: p.maxConcurrent ?? 3,
    cooldownTicks: p.cooldownTicks ?? 10,
    totalToSpawn: p.totalToSpawn ?? 5,
    spawnedSoFar: 0,
    lastSpawnStep: -Infinity,
    activeChildren: [],
    spawnParams: p.spawnParams ?? {},
    spawnRadius: p.spawnRadius ?? 0.5,
    isActive: p.isActive ?? true,
  })]
);

