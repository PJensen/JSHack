// One-shot jump scare trigger when player approaches dangerous creatures.
// Fires once per floor when player gets within proximity of high-intel threats.

import { Position } from "../components/Position.js";
import { Brain } from "../components/Brain.js";
import { Vitality } from "../components/Vitality.js";
import { Player } from "../components/Player.js";
import { DungeonState } from "../components/DungeonState.js";
import { forEachInRadius } from "../utils/spatialIndex.js";
import { playerEntity } from "../utils/queries.js";

const DANGEROUS_INTEL = 8;
const DANGEROUS_TAGS = new Set(['draconic']);
const SCARE_RANGE = 3;

export function jumpScareSystem(world) {
  const player = playerEntity(world);
  if (!player) return;

  const playerPos = world.get(player, Position);
  if (!playerPos) return;

  const dungeonState = world.singleton(DungeonState);
  const depth = dungeonState?.currentDepth ?? 0;
  const symbol = Symbol.for(`jshack:jumpScare:triggered:depth${depth}`);
  if (!world[symbol]) world[symbol] = new Set();
  const triggered = world[symbol];

  forEachInRadius(world, playerPos.x, playerPos.y, SCARE_RANGE, (id, pos) => {
    if (id === player) return;

    const brain = world.get(id, Brain);
    const vit = world.get(id, Vitality);

    if (!brain || !vit || vit.hp <= 0) return;

    const isDangerous = brain.intelligence >= DANGEROUS_INTEL;

    if (!isDangerous && brain.tags) {
      const hasDangerousTag = Array.isArray(brain.tags) &&
        brain.tags.some(tag => DANGEROUS_TAGS.has(tag));
      if (!hasDangerousTag) return;
    }

    if (!isDangerous) return;

    if (!triggered.has(id)) {
      triggered.add(id);
      world.emit('audio:play', { key: 'ambient:jump_scare' });
    }
  });
}
