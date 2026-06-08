// One-shot jump scare trigger when player approaches dangerous creatures.
// Fires once per floor when player gets within proximity of high-intel threats.

import { Position } from "../components/Position.js";
import { Brain } from "../components/Brain.js";
import { Vitality } from "../components/Vitality.js";
import { Player } from "../components/Player.js";
import { NamedIdentity } from "../components/NamedIdentity.js";
import { DungeonState } from "../components/DungeonState.js";
import { forEachInRadius } from "../utils/spatialIndex.js";
import { playerEntity } from "../utils/queries.js";
import { AVG_ROOM_SIZE } from "../environment/dungeon/constants.js";
import { getMonster } from "../data/monsters.js";
import { JumpScareStateResource } from "../resources/jumpScareState.js";

const DANGEROUS_INTEL = 8;
export const JUMP_SCARE_SOUND_BY_TAG = Object.freeze({
  draconic: "ambient:roar",
  demon: "ambient:roar",
  haunting: "ambient:whisper",
  spectral: "ambient:whisper",
  warlock: "ambient:whisper",
  witchy: "ambient:whisper",
});
export const DEFAULT_JUMP_SCARE_SOUND_ID = "ambient:roar";
const DANGEROUS_TAGS = new Set(Object.keys(JUMP_SCARE_SOUND_BY_TAG));
const SCARE_RANGE = Math.round(AVG_ROOM_SIZE * 2);

function getDungeonState(world) {
  if (typeof world.singleton === "function") return world.singleton(DungeonState);
  for (const [, ds] of world.query(DungeonState)) return ds;
  return null;
}

export function resolveJumpScareSoundId(spec = {}) {
  const identity = String(spec.identity || "").toLowerCase();
  const def = spec.def || (identity ? getMonster(identity) : null);
  const tags = Array.isArray(def?.tags) ? def.tags : [];

  for (const tag of tags) {
    const tagSound = JUMP_SCARE_SOUND_BY_TAG[String(tag || "").toLowerCase()];
    if (tagSound) return tagSound;
  }

  return DEFAULT_JUMP_SCARE_SOUND_ID;
}

export function jumpScareSystem(world) {
  const player = playerEntity(world);
  if (!player) return;

  const playerPos = player.pos;
  if (!playerPos) return;

  const dungeonState = getDungeonState(world);
  const depth = dungeonState?.currentDepth ?? 0;
  if ((depth | 0) <= 0) return;

  const state = world.resource(JumpScareStateResource);
  if (!state.triggeredByDepth.has(depth)) state.triggeredByDepth.set(depth, new Set());
  const triggered = state.triggeredByDepth.get(depth);
  if (triggered.size > 0) return;

  forEachInRadius(world, playerPos.x, playerPos.y, SCARE_RANGE, (id, pos) => {
    if (triggered.size > 0) return;
    if (id === player.id) return;

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
      const ident = world.get(id, NamedIdentity);
      const identity = String(ident?.identity || "");
      const soundId = resolveJumpScareSoundId({
        id,
        depth,
        identity,
        brain,
        def: identity ? getMonster(identity) : null,
      });
      world.emit('audio:play', { key: soundId, at: { x: pos.x | 0, y: pos.y | 0 }, sourceId: id });
    }
  });
}
