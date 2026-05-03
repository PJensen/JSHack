import { Position } from "../components/Position.js";
import { Trap } from "../components/Trap.js";
import { Vitality } from "../components/Vitality.js";
import { Player } from "../components/Player.js";
import { NamedIdentity } from "../components/NamedIdentity.js";
import { runScript, ScriptVerb } from "../scripting.js";
import { resolveCanonicalStats } from "../utils/canonicalStats.js";
import { mulberry32, rngInt, combatSeed, pct } from "../utils/rng.js";
import { statusStrength } from "../utils/statusFacade.js";
import { emitSafe } from "../utils/emitSafe.js";
import { chebyshevScalar } from "../utils/distance.js";

// Traps only arm when the player is within this radius.  Monsters wander freely
// beyond it so the dungeon feels alive; once the player closes in, traps go hot
// and any monster that blunders onto one triggers it in full view.
const TRAP_ARM_RADIUS = 12;

/** @param {import('../../lib/ecs-js/index.js').World} world */
export function trapSystem(world) {
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

  // Check armed traps — trigger for any living entity on the tile.
  for (const [tid, tpos, t] of world.query(Position, Trap)) {
    if (!tpos || !t || !t.armed) continue;

    // Only arm traps within activation radius.
    if (chebyshevScalar(tpos.x | 0, tpos.y | 0, playerX, playerY) > TRAP_ARM_RADIUS) continue;

    // Find any living entity on this trap tile (player or monster).
    let victimId = 0;
    for (const [id, pos, vit] of world.query(Position, Vitality)) {
      if (!pos || !vit || vit.hp <= 0 || id === tid) continue;
      if ((pos.x | 0) === (tpos.x | 0) && (pos.y | 0) === (tpos.y | 0)) {
        victimId = id;
        break;
      }
    }
    if (!victimId) continue;

    const isPlayerVictim = victimId === playerId;

    // Monsters blunder straight in — no avoidance roll.
    // Player gets dex-based avoidance check below.
    if (!isPlayerVictim) {
      // Reveal, emit, trigger.
      try { world.set(tid, Trap, { ...t, revealed: true, armed: false }); } catch {}
      emitSafe(world, 'trap:triggered', { trapId: tid, victimId, type: t.type });
      const fallbackScripts = {
        spike: "trap_spike", snake: "trap_snake", shock: "trap_shock",
        pit: "trap_pit", siphon: "trap_siphon", rust: "trap_rust", swarm: "trap_swarm",
      };
      const scriptKey = t.script || fallbackScripts[t.type] || "";
      if (scriptKey) {
        runScript(scriptKey, ScriptVerb.TrapTrigger, world, {
          trapId: tid, targetId: victimId, trap: t, params: t.params || {},
        });
      }
      continue;
    }

    // Dex-based avoidance: d20 + evade vs (DC + 5)
    const dc = t.difficulty || 10;
    const stats = resolveCanonicalStats(world, victimId);
    const evade = Number(stats?.evade || 0);
    const avoidSeed = combatSeed(world.seed, world.step, victimId, tid, 0x7A9);
    const avoidRng = mulberry32(avoidSeed);
    const avoidRoll = rngInt(avoidRng, 1, 20);
    let avoided = (avoidRoll + evade) >= (dc + 5);

    // Luck modifier: positive luck saves, negative luck fumbles
    const luck = Number(stats?.luck || 0) + statusStrength(world, victimId, "lucky");
    if (!avoided && luck > 0) {
      avoided = pct(avoidRng, luck);
    } else if (avoided && luck < 0) {
      avoided = !pct(avoidRng, -luck);
    }

    if (avoided) {
      // Reveal trap but leave it armed — you dodged, didn't disable
      try { world.set(tid, Trap, { ...t, revealed: true }); } catch {}
      emitSafe(world, 'trap:avoided', { victimId, trapId: tid, type: t.type });
      continue;
    }

    // Reveal and name before triggering so logs show source
    const ident = world.get(tid, NamedIdentity);
    if (!ident) {
      const trapNames = {
        spike: "Spike Trap",
        snake: "Snake Trap",
        shock: "Shock Trap",
        pit: "Pit Trap",
        siphon: "Siphon Trap",
        rust: "Rust Trap",
        swarm: "Swarm Trap",
      };
      const name = trapNames[t.type] || 'Trap';
      const identity = 'trap_' + (t.type || 'spike');
      try { world.add(tid, NamedIdentity, { name, identity }); } catch {} // ECS: may already exist
    }

    // Notify display layer
    emitSafe(world, 'trap:triggered', { trapId: tid, victimId, type: t.type });

    // Run scripted behavior
    const fallbackScripts = {
      spike: "trap_spike",
      snake: "trap_snake",
      shock: "trap_shock",
      pit: "trap_pit",
      siphon: "trap_siphon",
      rust: "trap_rust",
      swarm: "trap_swarm",
    };
    const scriptKey = t.script || fallbackScripts[t.type] || "";
    if (scriptKey) {
      runScript(scriptKey, ScriptVerb.TrapTrigger, world, {
        trapId: tid,
        targetId: victimId,
        trap: t,
        params: t.params || {},
      });
    }

    // Reveal and disarm
    try { world.set(tid, Trap, { ...t, revealed: true, armed: false }); } catch {} // ECS: component may not exist
  }
}
