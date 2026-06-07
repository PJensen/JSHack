import { Position } from "../components/Position.js";
import { Trap } from "../components/Trap.js";
import { Vitality } from "../components/Vitality.js";
import { Player } from "../components/Player.js";
import { NamedIdentity } from "../components/NamedIdentity.js";
import { runScript, ScriptVerb } from "../scripting.js";
import { resolveCanonicalStats } from "../utils/canonicalStats.js";
import { mulberry32, rngInt, combatSeed, pct } from "../utils/rng.js";
import { statusStrength } from "../utils/statusFacade.js";
import { chebyshevScalar } from "../utils/distance.js";
import { defineExtension } from "../../lib/ecs-js/index.js";
import { TrapStepQueueResource } from "../resources/trapStepQueue.js";

// Traps only arm when the player is within this radius.  Monsters wander freely
// beyond it so the dungeon feels alive; once the player closes in, traps go hot
// and any monster that blunders onto one triggers it in full view.
const TRAP_ARM_RADIUS = 12;

function resetEveryTurns(t) {
  const raw = Number(t?.params?.resetsEvery || 0);
  return Number.isFinite(raw) && raw > 0 ? Math.max(1, raw | 0) : 0;
}

function triggeredTrapState(t, world) {
  const resetsEvery = resetEveryTurns(t);
  if (resetsEvery <= 0) return { ...t, revealed: true, armed: false };
  return {
    ...t,
    revealed: true,
    armed: false,
    params: {
      ...(t.params || {}),
      resetAtStep: (Number(world.step || 0) | 0) + resetsEvery,
    },
  };
}

function rearmDueTraps(world) {
  const now = Number(world.step || 0) | 0;
  for (const [tid, , t] of world.query(Position, Trap)) {
    if (!t || t.armed) continue;
    const resetAtStep = Number(t?.params?.resetAtStep || 0) | 0;
    if (resetAtStep <= 0 || now < resetAtStep) continue;
    const params = { ...(t.params || {}) };
    delete params.resetAtStep;
    try { world.set(tid, Trap, { ...t, armed: true, params }); } catch {}
  }
}

function trapIsArmedNow(t, world) {
  if (!t) return false;
  if (t.armed) return true;
  const resetAtStep = Number(t?.params?.resetAtStep || 0) | 0;
  return resetAtStep > 0 && (Number(world.step || 0) | 0) >= resetAtStep;
}

function clearResetMarker(t) {
  if (!t?.params?.resetAtStep) return t;
  const params = { ...(t.params || {}) };
  delete params.resetAtStep;
  return { ...t, params };
}

function fallbackScriptForTrap(type) {
  const fallbackScripts = {
    spike: "trap_spike",
    snake: "trap_snake",
    shock: "trap_shock",
    pit: "trap_pit",
    siphon: "trap_siphon",
    rust: "trap_rust",
    swarm: "trap_swarm",
    arrow: "trap_arrow",
  };
  return fallbackScripts[type] || "";
}

function ensureTrapIdentity(world, trapId, t) {
  const ident = world.get(trapId, NamedIdentity);
  if (ident) return;
  const trapNames = {
    spike: "Spike Trap",
    snake: "Snake Trap",
    shock: "Shock Trap",
    pit: "Pit Trap",
    siphon: "Siphon Trap",
    rust: "Rust Trap",
    swarm: "Swarm Trap",
    arrow: "Arrow Trap",
  };
  const name = trapNames[t.type] || "Trap";
  const identity = "trap_" + (t.type || "spike");
  try { world.add(trapId, NamedIdentity, { name, identity }); } catch {}
}

function triggerTrap(world, trapId, t, victimId, playerId) {
  const isPlayerVictim = victimId === playerId;

  if (!isPlayerVictim) {
    try { world.set(trapId, Trap, triggeredTrapState(clearResetMarker(t), world)); } catch {}
    world.emit("trap:triggered", { trapId, victimId, type: t.type });
    const scriptKey = t.script || fallbackScriptForTrap(t.type);
    if (scriptKey) {
      runScript(scriptKey, ScriptVerb.TrapTrigger, world, {
        trapId, targetId: victimId, trap: t, params: t.params || {},
      });
    }
    return true;
  }

  const dc = t.difficulty || 10;
  const stats = resolveCanonicalStats(world, victimId);
  const evade = Number(stats?.evade || 0);
  const avoidSeed = combatSeed(world.seed, world.step, victimId, trapId, 0x7A9);
  const avoidRng = mulberry32(avoidSeed);
  const avoidRoll = rngInt(avoidRng, 1, 20);
  let avoided = (avoidRoll + evade) >= (dc + 5);

  const luck = Number(stats?.luck || 0) + statusStrength(world, victimId, "lucky");
  if (!avoided && luck > 0) {
    avoided = pct(avoidRng, luck);
  } else if (avoided && luck < 0) {
    avoided = !pct(avoidRng, -luck);
  }

  if (avoided) {
    try { world.set(trapId, Trap, { ...clearResetMarker(t), revealed: true, armed: true }); } catch {}
    world.emit("trap:avoided", { victimId, trapId, type: t.type });
    return false;
  }

  ensureTrapIdentity(world, trapId, t);
  world.emit("trap:triggered", { trapId, victimId, type: t.type });

  const scriptKey = t.script || fallbackScriptForTrap(t.type);
  if (scriptKey) {
    runScript(scriptKey, ScriptVerb.TrapTrigger, world, {
      trapId,
      targetId: victimId,
      trap: t,
      params: t.params || {},
    });
  }

  try { world.set(trapId, Trap, triggeredTrapState(clearResetMarker(t), world)); } catch {}
  return true;
}

export const trapStepListenerExtension = defineExtension("jshack:trap:stepListener", (world) => {
  world.on("moved", ({ id, from, to }) => {
    const actor = Number(id || 0) | 0;
    if (!(actor > 0)) return;
    const tx = Number.isFinite(to?.x) ? (to.x | 0) : 0;
    const ty = Number.isFinite(to?.y) ? (to.y | 0) : 0;
    const fx = Number.isFinite(from?.x) ? (from.x | 0) : tx;
    const fy = Number.isFinite(from?.y) ? (from.y | 0) : ty;
    if (fx === tx && fy === ty) return;
    world.resource(TrapStepQueueResource).push({ actor, x: tx, y: ty });
  });
});

/** @param {import('../../lib/ecs-js/index.js').World} world */
export function trapSystem(world) {
  rearmDueTraps(world);

  // Locate the player — needed for the activation-radius gate.
  let playerX = 0, playerY = 0, playerId = 0;
  for (const [id, pos] of world.query(Position, Player)) {
    if (!pos) continue;
    playerX = pos.x | 0;
    playerY = pos.y | 0;
    playerId = id;
    break;
  }
  if (!playerId) return;

  const arrivals = world.resource(TrapStepQueueResource).splice(0);
  for (const arrival of arrivals) {
    const victimId = Number(arrival.actor || 0) | 0;
    if (!(victimId > 0) || !world.isAlive(victimId)) continue;
    const vit = world.get(victimId, Vitality);
    if (!vit || Number(vit.hp || 0) <= 0) continue;

    for (const [tid, tpos, t] of world.query(Position, Trap)) {
      if (!tpos || !t || !trapIsArmedNow(t, world)) continue;
      if ((tpos.x | 0) !== arrival.x || (tpos.y | 0) !== arrival.y) continue;
      if (chebyshevScalar(tpos.x | 0, tpos.y | 0, playerX, playerY) > TRAP_ARM_RADIUS) continue;
      triggerTrap(world, tid, t, victimId, playerId);
      break;
    }
  }
}
