import { NamedIdentity } from "../components/NamedIdentity.js";
import { Position } from "../components/Position.js";
import { DeathCallbackContext } from "../data/callbacks/death.js";
import { getMonster } from "../data/monsters.js";
import { runCallbackList } from "../interaction/dispatch.js";

const INSTALLED_KEY = Symbol.for("jshack:monsterDeathHooks:installed");
const SEEN_KEY = Symbol.for("jshack:monsterDeathHooks:seenPerStep");

function ensureSeenState(world) {
  const rec = world[SEEN_KEY];
  if (rec && typeof rec === "object" && rec.ids instanceof Set) return rec;
  const created = { step: -1, ids: new Set() };
  world[SEEN_KEY] = created;
  return created;
}

/** @param {import('../../lib/ecs-js/index.js').World} world */
export function installMonsterDeathHooks(world) {
  if (!world || world[INSTALLED_KEY]) return;
  world[INSTALLED_KEY] = true;
  ensureSeenState(world);

  world.on("died", ({ id, killer, cause }) => {
    const deadId = Number(id || 0) | 0;
    if (!(deadId > 0)) return;

    const seen = ensureSeenState(world);
    const step = world.step | 0;
    if (seen.step !== step) {
      seen.step = step;
      seen.ids.clear();
    }
    if (seen.ids.has(deadId)) return;
    seen.ids.add(deadId);

    const ident = world.get(deadId, NamedIdentity);
    if (!ident) return;
    const monsterDef = getMonster(String(ident.identity || ""));
    const hooks = monsterDef?.hooks?.onDeath;
    if (!Array.isArray(hooks) || hooks.length === 0) return;

    const pos = world.get(deadId, Position);
    const ctx = new DeathCallbackContext(world, {
      deadId,
      killer: Number(killer || 0) | 0,
      cause: String(cause || ""),
      identity: String(ident.identity || ""),
      pos: pos ? { x: pos.x | 0, y: pos.y | 0 } : null,
    });
    runCallbackList(hooks, ctx);
  });
}
