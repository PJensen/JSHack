import { Collider } from "../components/Collider.js";
import { HazardArea } from "../components/HazardArea.js";
import { Interactable } from "../components/Interactable.js";
import { ItemInfo } from "../components/ItemInfo.js";
import { KnockbackPending } from "../components/KnockbackPending.js";
import { NamedIdentity } from "../components/NamedIdentity.js";
import { ObjectState } from "../components/ObjectState.js";
import { Position } from "../components/Position.js";
import { Vitality } from "../components/Vitality.js";
import { Weight } from "../components/Weight.js";
import { HydraulicsLink } from "../components/HydraulicsLink.js";
import { isWalkable } from "../environment/dungeon/tileMap.js";
import { spawnHazard } from "../utils/hazardSpawn.js";
import { entitiesAtPoint } from "../utils/spatialIndex.js";
import { setLinkedPortcullisState } from "../utils/hydraulicsUtils.js";

function isSolidBlockedAt(world, x, y, ignoreId = 0) {
  for (const id of entitiesAtPoint(world, x | 0, y | 0)) {
    if ((id | 0) === (ignoreId | 0)) continue;
    const col = world.get(id, Collider);
    if (col?.solid) return true;
  }
  return false;
}

function tileWeight(world, x, y, plinthId) {
  let total = 0;
  for (const id of entitiesAtPoint(world, x | 0, y | 0)) {
    if ((id | 0) === (plinthId | 0)) continue;
    const w = world.get(id, Weight);
    if (w && Number.isFinite(w.total) && Number(w.total) > 0) {
      total += Number(w.total);
      continue;
    }
    const info = world.get(id, ItemInfo);
    if (info && Number.isFinite(info.weight)) {
      const count = Math.max(1, Number(info.count || 1) | 0);
      total += Number(info.weight) * count;
      continue;
    }
    if (world.has(id, Vitality)) total += 70;
  }
  return total;
}

function processPressurePlinths(world) {
  for (const [id, pos, link, inter] of world.query(Position, HydraulicsLink, Interactable)) {
    if (String(link?.role || "") !== "plinth") continue;
    const threshold = Math.max(1, Number(inter?.params?.thresholdWeight || 25) | 0);
    const total = tileWeight(world, pos.x, pos.y, id);
    const pressed = total >= threshold;
    const nextState = pressed ? "pressed" : "unpressed";
    const prevState = String(world.get(id, ObjectState)?.state || "unpressed");
    if (prevState === nextState) continue;
    world.set(id, ObjectState, { state: nextState });
    const changed = setLinkedPortcullisState(world, String(link?.linkId || ""), pressed, "pressure_plinth");
    world.emit("hydraulics:plinth", {
      plinthId: id | 0,
      linkId: String(link?.linkId || ""),
      pressed,
      thresholdWeight: threshold,
      totalWeight: total,
      gatesChanged: changed,
      at: { x: pos.x | 0, y: pos.y | 0 },
    });
  }
}

function pushGasHazards(world, x, y, dx, dy) {
  const fromX = x | 0;
  const fromY = y | 0;
  const toX = fromX + (dx | 0);
  const toY = fromY + (dy | 0);
  if (!isWalkable(toX, toY) || isSolidBlockedAt(world, toX, toY)) return 0;
  let moved = 0;
  for (const id of entitiesAtPoint(world, fromX, fromY)) {
    const hazard = world.get(id, HazardArea);
    if (!hazard) continue;
    const kind = String(hazard.kind || "").toLowerCase();
    if (kind !== "gas" && kind !== "steam") continue;
    world.set(id, Position, { x: toX, y: toY });
    moved++;
  }
  return moved;
}

function processSteamVents(world) {
  const step = Number(world.step || 0) | 0;
  for (const [id, pos, ident, inter] of world.query(Position, NamedIdentity, Interactable)) {
    if (String(ident?.identity || "") !== "steam_vent") continue;
    if (String(inter?.action || "") !== "inspectSteamVent") continue;
    const params = (inter?.params && typeof inter.params === "object") ? inter.params : {};
    const periodTurns = Math.max(1, Number(params.periodTurns || 6) | 0);
    const activeTurns = Math.max(1, Math.min(periodTurns, Number(params.activeTurns || 2) | 0));
    const range = Math.max(1, Number(params.range || 4) | 0);
    let dx = Math.sign(Number(params.dirX || 0) | 0);
    let dy = Math.sign(Number(params.dirY || 0) | 0);
    if (dx === 0 && dy === 0) dy = 1;
    if (dx !== 0 && dy !== 0) dy = 0;
    const pushForce = Math.max(1, Number(params.pushForce || 1) | 0);
    const damage = Math.max(0, Number(params.damage || 2) | 0);
    const cycleTurn = step % periodTurns;
    const active = cycleTurn < activeTurns;
    if (world.has(id, ObjectState)) {
      world.set(id, ObjectState, { state: active ? "venting" : "idle" });
    }
    if (!active) continue;

    let pushedHazards = 0;
    for (let d = 1; d <= range; d++) {
      const tx = (pos.x | 0) + dx * d;
      const ty = (pos.y | 0) + dy * d;
      if (!isWalkable(tx, ty)) break;
      spawnHazard(world, {
        x: tx,
        y: ty,
        kind: "steam",
        medium: "air",
        turnsLeft: 1,
        radius: 0,
        tickDamage: damage,
        damageType: "steam",
        cause: "steam_vent",
        sourceId: id | 0,
        sourceKind: "steam_vent",
        identity: "steam_blast",
        name: "Steam Blast",
        meta: { source: "steam_vent", lineStep: d },
      });

      for (const targetId of entitiesAtPoint(world, tx, ty)) {
        if (!world.has(targetId, Vitality)) continue;
        if (world.has(targetId, KnockbackPending)) continue;
        world.add(targetId, KnockbackPending, { dx, dy, force: pushForce });
      }
      pushedHazards += pushGasHazards(world, tx, ty, dx, dy);
    }

    world.emit("hydraulics:steamVent", {
      ventId: id | 0,
      at: { x: pos.x | 0, y: pos.y | 0 },
      dir: { dx, dy },
      range,
      damage,
      pushForce,
      pushedHazards,
    });
  }
}

/**
 * Hydraulics and mechanical room-feature resolver.
 *
 * - Pressure plinths open/close linked portcullises based on tile weight.
 * - Steam vents pulse line hazards and knockback on a deterministic cycle.
 *
 * Phase: effects.
 *
 * @param {import("../../lib/ecs-js/index.js").World} world
 */
export function hydraulicsSystem(world) {
  processPressurePlinths(world);
  processSteamVents(world);
}
