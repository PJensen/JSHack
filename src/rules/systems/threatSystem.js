import { AggroState } from "../components/AggroState.js";
import { Faction } from "../components/Faction.js";
import {
  addThreat,
  decayThreat,
  forceThreatTarget,
  resolveThreatTarget,
  THREAT_SOFT_TAUNT_BURST,
} from "../utils/threat.js";

const THREAT_LISTENERS_INSTALLED = Symbol.for("jshack:threat:listeners:installed");

export function installThreatListeners(world) {
  if (!world || world[THREAT_LISTENERS_INSTALLED]) return;
  world[THREAT_LISTENERS_INSTALLED] = true;

  world.on("damaged", ({ target, source, amount, cause }) => {
    const owner = Number(target || 0) | 0;
    const actor = Number(source || 0) | 0;
    const value = Math.max(0, Number(amount || 0) | 0);
    if (!(owner > 0) || !(actor > 0) || value <= 0) return;
    addThreat(world, owner, actor, value, { kind: String(cause || "damage") });
    resolveThreatTarget(world, owner, { reason: "damage" });
  });

  world.on("threat:add", ({ ownerId, targetId, sourceId, amount, kind, reason, sticky }) => {
    const owner = Number(ownerId || targetId || 0) | 0;
    const source = Number(sourceId || 0) | 0;
    if (!(owner > 0) || !(source > 0)) return;
    addThreat(world, owner, source, amount, { kind: String(kind || reason || "threat"), sticky: !!sticky });
    resolveThreatTarget(world, owner, { reason: String(reason || kind || "threat") });
  });

  world.on("taunt:applied", ({ targetId, sourceId, turnsLeft, potency, reason }) => {
    const owner = Number(targetId || 0) | 0;
    const source = Number(sourceId || 0) | 0;
    if (!(owner > 0) || !(source > 0)) return;
    const r = String(reason || "taunt");
    if (r === "pet_protect") {
      addThreat(world, owner, source, Math.max(1, Number(potency || 1) | 0) * THREAT_SOFT_TAUNT_BURST, {
        kind: "body_block",
        sticky: true,
      });
      resolveThreatTarget(world, owner, { reason: "pet_protect" });
      return;
    }
    forceThreatTarget(world, owner, source, Math.max(1, Number(turnsLeft || 1) | 0), {
      reason: "taunt",
      kind: "taunt",
    });
  });
}

export function threatSystem(world) {
  for (const [id, aggro] of world.query(AggroState)) {
    if (!world.isAlive(id)) continue;
    const faction = world.get(id, Faction);
    if (faction && String(faction.key || "") !== "enemy") continue;
    decayThreat(world, id);
    resolveThreatTarget(world, id, { reason: "threat" });
  }
}
