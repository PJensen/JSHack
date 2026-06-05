import { DeathApplied } from "../components/DeathApplied.js";
import { NamedIdentity } from "../components/NamedIdentity.js";
import { Position } from "../components/Position.js";
import { DeathCallbackContext } from "../data/callbacks/death.js";
import { getMonster } from "../data/monsters.js";
import { runCallbackList } from "../interaction/dispatch.js";

const SEEN_KEY = Symbol.for("jshack:monsterDeathHooks:seenPerStep");

function ensureSeenState(world) {
  const rec = world[SEEN_KEY];
  if (rec && typeof rec === "object" && rec.ids instanceof Set) return rec;
  const created = { step: -1, ids: new Set() };
  world[SEEN_KEY] = created;
  return created;
}

/** @param {import('../../lib/ecs-js/index.js').World} world */
export function monsterDeathHookSystem(world) {
  ensureSeenState(world);

  for (const [, death] of world.query(DeathApplied)) {
    const deadId = Number(death.target || 0) | 0;
    if (!(deadId > 0)) continue;

    const seen = ensureSeenState(world);
    const step = world.step | 0;
    if (seen.step !== step) {
      seen.step = step;
      seen.ids.clear();
    }
    if (seen.ids.has(deadId)) continue;
    seen.ids.add(deadId);

    const ident = world.get(deadId, NamedIdentity);
    if (!ident) continue;
    const monsterDef = getMonster(String(ident.identity || ""));
    const hooks = monsterDef?.hooks?.onDeath;
    if (!Array.isArray(hooks) || hooks.length === 0) continue;

    const pos = world.get(deadId, Position);
    const ctx = new DeathCallbackContext(world, {
      deadId,
      killer: Number(death.killer || 0) | 0,
      cause: String(death.cause || ""),
      identity: String(ident.identity || ""),
      pos: pos ? { x: pos.x | 0, y: pos.y | 0 } : null,
    });
    runCallbackList(hooks, ctx);
  }
}
