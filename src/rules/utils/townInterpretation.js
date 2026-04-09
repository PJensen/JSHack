import { DistrictProfile } from "../components/DistrictProfile.js";
import { DistrictState } from "../components/DistrictState.js";
import { EntranceProfile } from "../components/EntranceProfile.js";
import { EntranceState } from "../components/EntranceState.js";
import { NamedIdentity } from "../components/NamedIdentity.js";
import { Position } from "../components/Position.js";
import { TOWN_DISTRICT_DEFS } from "../data/townDistricts.js";
import { TOWN_ENTRANCE_DEFS } from "../data/townEntrances.js";
import { chebyshev } from "./distance.js";
import { currentDepth } from "./worldAccess.js";
import { clamp01 as clamp01Number } from "./numberCoerce.js";

function keyOf(identity) {
  return `jshack:${identity}`;
}

export function getDepth(world) {
  return currentDepth(world, 1);
}

export function findIdentityPosition(world, identity) {
  const want = String(identity || "");
  for (const [id, pos, ni] of world.query(Position, NamedIdentity)) {
    if (String(ni.identity || "") !== want) continue;
    return { id, x: pos.x, y: pos.y, name: String(ni.name || "") };
  }
  return null;
}

function nearestStairTo(world, anchor) {
  if (!anchor) return null;
  let best = null;
  let bestDist = Infinity;
  for (const [id, pos, ni] of world.query(Position, NamedIdentity)) {
    if (String(ni.identity || "") !== "stair_down") continue;
    const dist = chebyshev(pos, anchor);
    if (dist < bestDist) {
      bestDist = dist;
      best = { id, x: pos.x, y: pos.y };
    }
  }
  return best;
}

function ensureNamedEntity(world, identity, name, x, y) {
  const existing = findIdentityPosition(world, identity);
  if (existing) {
    if (existing.x !== x || existing.y !== y) world.set(existing.id, Position, { x, y });
    return existing.id;
  }
  const id = world.create();
  world.add(id, NamedIdentity, { name, identity });
  world.add(id, Position, { x, y });
  return id;
}

export function ensureTownInterpretationEntities(world) {
  if (getDepth(world) !== 0) return;

  const homeSign = findIdentityPosition(world, "house_sign");
  const churchSign = findIdentityPosition(world, "church_sign");
  const smithySign = findIdentityPosition(world, "smithy_sign");
  const tavernSign = findIdentityPosition(world, "tavern_sign");

  const townStair = nearestStairTo(world, homeSign);
  const graveStair = nearestStairTo(world, churchSign);

  for (const def of TOWN_ENTRANCE_DEFS) {
    const pos = def.key === "graveyard" ? graveStair : townStair;
    const anchor = pos || (def.key === "graveyard" ? churchSign : homeSign);
    if (!anchor) continue;
    const identity = `town_entrance_${def.key}`;
    const id = ensureNamedEntity(world, identity, `${def.label} Entrance`, anchor.x, anchor.y);
    if (!world.has(id, EntranceProfile)) {
      world.add(id, EntranceProfile, {
        key: def.key,
        label: def.label,
        tags: [...def.tags],
        laborDemand: [...def.laborDemand],
        districtEffects: [...def.districtEffects],
        radius: def.radius,
      });
    }
    if (!world.has(id, EntranceState)) {
      world.add(id, EntranceState, {
        factionControl: def.factionControl,
      });
    }
  }

  for (const def of TOWN_DISTRICT_DEFS) {
    const anchor = findIdentityPosition(world, def.anchorIdentity)
      || (def.key === "civic_core" ? homeSign : null)
      || (def.key === "churchyard" ? churchSign : null)
      || (def.key === "workshop_row" ? smithySign : null)
      || (def.key === "market_green" ? tavernSign : null);
    if (!anchor) continue;
    const x = anchor.x + Number(def.offsetX || 0);
    const y = anchor.y + Number(def.offsetY || 0);
    const identity = `town_district_${def.key}`;
    const id = ensureNamedEntity(world, identity, def.label, x, y);
    if (!world.has(id, DistrictProfile)) {
      world.add(id, DistrictProfile, {
        key: def.key,
        label: def.label,
        tags: [...def.tags],
        radius: def.radius,
      });
    }
    if (!world.has(id, DistrictState)) {
      world.add(id, DistrictState, {});
    }
  }
}

export function getEntranceEntityByKey(world, key) {
  const want = String(key || "");
  for (const [id, profile] of world.query(EntranceProfile)) {
    if (String(profile.key || "") === want) return id;
  }
  return 0;
}

export function getDistrictEntityByKey(world, key) {
  const want = String(key || "");
  for (const [id, profile] of world.query(DistrictProfile)) {
    if (String(profile.key || "") === want) return id;
  }
  return 0;
}

export function clamp01(value) {
  return clamp01Number(value);
}

export function namedLookupKey(identity) {
  return keyOf(identity);
}
