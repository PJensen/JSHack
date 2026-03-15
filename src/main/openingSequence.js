import { AggroState, AGGRO_LEVELS } from "../rules/components/AggroState.js";
import { ActiveEffects } from "../rules/components/ActiveEffects.js";
import { Collider } from "../rules/components/Collider.js";
import { Flying } from "../rules/components/Flying.js";
import { NamedIdentity } from "../rules/components/NamedIdentity.js";
import { Position } from "../rules/components/Position.js";
import { Vitality } from "../rules/components/Vitality.js";
import { isFlyable } from "../rules/environment/dungeon/tileMap.js";
import { getMonster } from "../rules/data/monsters.js";
import { dealDamage } from "../rules/utils/dealDamage.js";
import { hasLOS } from "../shared/math/gridLOS.js";
import { spawnMonsterEntity } from "../rules/utils/spawnMonsterEntity.js";
import { buildBlocksVisionMap, blockedCallback } from "../rules/utils/vision.js";

export const OPENING_SEQUENCE_DRAGON_IDENTITY = "dragon_whelp";
export const OPENING_SEQUENCE_PRAYER_PROMPT = "I should pray.";
export const OPENING_SEQUENCE_BONUS_HP = 12;
export const OPENING_SEQUENCE_BONUS_ATTACK = 3;
export const OPENING_SEQUENCE_DAMAGE_DICE = "1d10";
export const OPENING_SEQUENCE_SMITE_DAMAGE = 999;
export const OPENING_SEQUENCE_RELEASE_DELAY_SEC = 0.6;
export const OPENING_SEQUENCE_INVULN_TURNS = 40;

function chebyshevDistance(ax, ay, bx, by) {
  return Math.max(Math.abs((ax | 0) - (bx | 0)), Math.abs((ay | 0) - (by | 0)));
}

function collectBlockedTiles(world) {
  const blocked = new Set();
  for (const [id, pos] of world.query(Position)) {
    if (!pos) continue;
    const key = `${pos.x | 0},${pos.y | 0}`;
    const col = world.get(id, Collider);
    const vit = world.get(id, Vitality);
    if (col?.solid || Number(vit?.hp || 0) > 0) blocked.add(key);
  }
  return blocked;
}

export function findOpeningDragonSpawn(world, playerPos, opts = {}) {
  const px = Number(playerPos?.x || 0) | 0;
  const py = Number(playerPos?.y || 0) | 0;
  const minDistance = Math.max(1, Number(opts.minDistance ?? 9) | 0);
  const maxDistance = Math.max(minDistance, Number(opts.maxDistance ?? 14) | 0);
  const blocked = collectBlockedTiles(world);
  const isBlocked = blockedCallback(buildBlocksVisionMap(world));

  let bestLOS = null;
  let bestFallback = null;

  for (let y = py - maxDistance; y <= py + maxDistance; y++) {
    for (let x = px - maxDistance; x <= px + maxDistance; x++) {
      const dist = chebyshevDistance(px, py, x, y);
      if (dist < minDistance || dist > maxDistance) continue;
      if (!isFlyable(x, y)) continue;
      if (blocked.has(`${x},${y}`)) continue;

      const axisBias = (x === px || y === py) ? 1 : 0;
      const score = (dist * 100) + axisBias;
      const candidate = { x, y, score };

      if (hasLOS(x, y, px, py, isBlocked)) {
        if (!bestLOS || candidate.score > bestLOS.score) bestLOS = candidate;
      } else if (!bestFallback || candidate.score > bestFallback.score) {
        bestFallback = candidate;
      }
    }
  }

  const chosen = bestLOS || bestFallback;
  return chosen ? { x: chosen.x, y: chosen.y } : null;
}

export function spawnOpeningDragonWhelp(world, { playerId, playerPos, spawnPos }) {
  const def = getMonster(OPENING_SEQUENCE_DRAGON_IDENTITY);
  const targetPos = playerPos && Number.isInteger(playerPos.x) && Number.isInteger(playerPos.y)
    ? { x: playerPos.x | 0, y: playerPos.y | 0 }
    : { x: 0, y: 0 };
  const at = spawnPos && Number.isInteger(spawnPos.x) && Number.isInteger(spawnPos.y)
    ? { x: spawnPos.x | 0, y: spawnPos.y | 0 }
    : targetPos;

  const existing = [];
  for (const [id, ident] of world.query(NamedIdentity)) {
    if (String(ident?.identity || "") === OPENING_SEQUENCE_DRAGON_IDENTITY) existing.push(id);
  }
  for (const id of existing) {
    if (world.isAlive(id)) world.destroyImmediate(id);
  }

  const dragonId = spawnMonsterEntity(world, {
    x: at.x,
    y: at.y,
    identity: def?.id || OPENING_SEQUENCE_DRAGON_IDENTITY,
    name: def?.name || "Dragon Whelp",
    maxHp: Number(def?.baseHp || 24) + OPENING_SEQUENCE_BONUS_HP,
    hp: Number(def?.baseHp || 24) + OPENING_SEQUENCE_BONUS_HP,
    attackDerived: Number(def?.attack || 4) + OPENING_SEQUENCE_BONUS_ATTACK,
    defenseDerived: Number(def?.defense || 3),
    naturalDamageDice: OPENING_SEQUENCE_DAMAGE_DICE,
    sizeClass: def?.sizeClass || "L",
    massKg: Number(def?.massKg || 240),
    resistances: def?.resistances || undefined,
    speed: Number(def?.speed || 2),
  });

  if (!world.has(dragonId, Flying)) world.add(dragonId, Flying, {});
  syncOpeningDragonAggro(world, dragonId, playerId, targetPos);

  try {
    world.emit?.("spawned", {
      id: dragonId,
      at: { x: at.x, y: at.y },
      kind: OPENING_SEQUENCE_DRAGON_IDENTITY,
    });
  } catch {}

  return dragonId;
}

export function syncOpeningDragonAggro(world, dragonId, playerId, playerPos = null) {
  const id = Number(dragonId || 0) | 0;
  if (!(id > 0) || !world.isAlive(id)) return;

  const pos = playerPos && Number.isInteger(playerPos.x) && Number.isInteger(playerPos.y)
    ? { x: playerPos.x | 0, y: playerPos.y | 0 }
    : world.get(Number(playerId || 0) | 0, Position);
  if (!pos) return;

  const aggro = world.get(id, AggroState) || {
    alertLevel: AGGRO_LEVELS.unaware,
    lastKnownX: pos.x | 0,
    lastKnownY: pos.y | 0,
    searchTurnsLeft: 0,
    retreating: false,
  };

  aggro.alertLevel = AGGRO_LEVELS.hunting;
  aggro.lastKnownX = pos.x | 0;
  aggro.lastKnownY = pos.y | 0;
  aggro.searchTurnsLeft = 9999;
  aggro.retreating = false;
  world.set(id, AggroState, aggro);
}

export function applyOpeningInvulnerability(world, playerId) {
  const id = Number(playerId || 0) | 0;
  if (!(id > 0) || !world.isAlive(id)) return false;

  const activeEffects = world.get(id, ActiveEffects);
  const effects = Array.isArray(activeEffects?.effects) ? activeEffects.effects.slice() : [];
  const existing = effects.find((effect) => effect && effect.key === "invulnerable");
  if (existing) {
    existing.turnsLeft = Math.max(Number(existing.turnsLeft || 0), OPENING_SEQUENCE_INVULN_TURNS);
    existing.potency = Math.max(Number(existing.potency || 0), 1);
  } else {
    effects.push({ key: "invulnerable", turnsLeft: OPENING_SEQUENCE_INVULN_TURNS, potency: 1 });
  }
  world.set(id, ActiveEffects, { effects });
  return true;
}

export function performOpeningPrayerSmite(world, { dragonId, deityId = "", deityName = "The heavens" }) {
  const id = Number(dragonId || 0) | 0;
  if (!(id > 0) || !world.isAlive(id)) return false;

  const pos = world.get(id, Position);
  const vit = world.get(id, Vitality);
  const damage = Math.max(OPENING_SEQUENCE_SMITE_DAMAGE, Number(vit?.hp || 0) + 50);

  try {
    world.emit?.("deity:miracle", {
      message: `${deityName} answers with a killing bolt.`,
    });
  } catch {}

  try {
    world.emit?.("deity:wrath", {
      playerId: id,
      deityId: String(deityId || ""),
      deityName: String(deityName || "The heavens"),
      damage,
      cursed: false,
      intensity: 1,
      severityScale: 2.6,
      wrathDebt: 0,
    });
  } catch {}

  dealDamage(world, {
    target: id,
    amount: damage,
    source: 0,
    type: "divine",
    cause: "divine_wrath",
    bypassResist: true,
    at: pos ? { x: pos.x | 0, y: pos.y | 0 } : undefined,
  });
  return true;
}

export function primeOpeningDeityFavor(deity) {
  if (!deity || typeof deity !== "object") return false;

  if (deity.mood && typeof deity.mood === "object") {
    deity.mood._vector = {
      wrath: 0.01,
      serenity: 0.9,
      hunger: 0.01,
      amusement: 0.05,
      sorrow: 0.01,
      chaos: 0.02,
    };
    deity.mood._lastResolvedTick = Number(deity._tick || 0);
  }
  deity._prevDominant = "serenity";
  return true;
}
