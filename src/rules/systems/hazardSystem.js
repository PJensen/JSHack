import { HazardArea } from "../components/HazardArea.js";
import { PlasmaCloud } from "../components/PlasmaCloud.js";
import { Position } from "../components/Position.js";
import { Vitality } from "../components/Vitality.js";
import { Flying } from "../components/Flying.js";
import { Pet } from "../components/Pet.js";
import { Player } from "../components/Player.js";
import { ActiveEffects } from "../components/ActiveEffects.js";
import { Burned } from "../components/Burned.js";
import { Collider } from "../components/Collider.js";
import { Interactable } from "../components/Interactable.js";
import { Material } from "../components/Material.js";
import { DungeonState } from "../components/DungeonState.js";
import { NamedIdentity } from "../components/NamedIdentity.js";
import {
  TILE_DOOR,
  TILE_FENCE,
  TILE_FLOOR,
  TILE_GRASS,
  TILE_TREE,
  TILE_WALL,
} from "../environment/dungeon/constants.js";
import { getTile, isRoofed, setTile } from "../environment/dungeon/tileMap.js";
import { dealDamage } from "../utils/dealDamage.js";
import { MATERIAL_CATALOG } from "../data/materials.js";
import { createFrom } from "../../lib/ecs-js/archetype.js";
import { Ashes } from "../archetypes/Items.js";
import {
  getDestroyedTileRecord,
  markDestroyedTile,
  ROOF_BURN_TURNS,
  tickDestroyedTileLedger,
} from "../utils/destroyedTiles.js";

const DEFAULT_TURNS = 3;
const DEFAULT_RADIUS = 1;
const DEFAULT_TICK_DAMAGE = 0;
const DEFAULT_FIRE_SPREAD_CHANCE = 0.25;
const WEB_FIRE_SPREAD_CHANCE = 0.53;
const WEB_IDENTITY = "web";
const DEFAULT_FIRE_SPREAD_TURNS = 2;
const NEIGHBOR_OFFSETS = Object.freeze([
  [-1, -1], [0, -1], [1, -1],
  [-1, 0],           [1, 0],
  [-1, 1],  [0, 1],  [1, 1],
]);
const FLAMMABILITY_BY_MATERIAL = new Map(MATERIAL_CATALOG.map((entry) => [
  String(entry?.id || entry?.Material?.kind || ""),
  Number(entry?.Material?.flammability || 0),
]));

function isOverworld(world) {
  for (const [, ds] of world.query(DungeonState)) {
    return ds.currentDepth === 0 || ds.profileType === "overworld";
  }
  return false;
}

function getBurnedTileReplacement(tile, overworld) {
  if (tile === TILE_TREE) return TILE_GRASS;
  if (!overworld) return null;
  if (tile === TILE_FENCE) return TILE_GRASS;
  if (tile === TILE_DOOR) return TILE_FLOOR;
  if (tile === TILE_WALL) return TILE_FLOOR;
  return null;
}

function burnedTileKind(tile) {
  if (tile === TILE_TREE) return "tree";
  if (tile === TILE_FENCE) return "fence";
  if (tile === TILE_DOOR) return "door";
  if (tile === TILE_WALL) return "wall";
  return "terrain";
}

function isRoofBearingBurn(tile) {
  return tile === TILE_WALL || tile === TILE_DOOR;
}

function isRoofFuelTile(world, x, y, tile, overworld) {
  if (!overworld) return false;
  if (tile !== TILE_FLOOR) return false;
  if (!isRoofed(x, y)) return false;
  return !getDestroyedTileRecord(world, x, y);
}

function isFlammableFireSpreadTile(world, x, y, tile, overworld) {
  if (tile === TILE_TREE) return true;
  if (!overworld) return false;
  if (isRoofFuelTile(world, x, y, tile, overworld)) return true;
  return tile === TILE_FENCE || tile === TILE_DOOR || tile === TILE_WALL;
}

function burnFlammableEntitiesAt(world, x, y, source, hazardId, cause, sourceId, sourceKind) {
  for (const [id, pos, mat] of world.query(Position, Material)) {
    if (!pos || !mat) continue;
    if ((pos.x | 0) !== (x | 0) || (pos.y | 0) !== (y | 0)) continue;
    if (world.has(id, Vitality)) continue;
    if (world.has(id, Burned)) continue;
    const flammability = Number(FLAMMABILITY_BY_MATERIAL.get(String(mat.kind || "")) || 0);
    const ident = world.get(id, NamedIdentity);
    const isWeb = String(ident?.identity || "").toLowerCase() === WEB_IDENTITY;
    if (!isWeb && !(flammability > 0)) continue;
    try {
      world.emit?.("entity:burned", {
        actor: source,
        hazardId,
        entityId: id,
        x: x | 0,
        y: y | 0,
        cause,
        sourceId,
        sourceKind,
        identity: String(ident?.identity || ""),
        name: String(ident?.name || ""),
        material: String(mat.kind || ""),
      });
    } catch { /* */ }
    try {
      const ashId = createFrom(world, Ashes, {});
      world.add(ashId, Position, { x: x | 0, y: y | 0 });
    } catch { /* */ }
    try {
      world.add(id, Burned, {
        atTurn: world.step | 0,
        cause,
        sourceId,
        sourceKind,
        smokeTurnsLeft: 6,
      });
    } catch { /* */ }
    try { if (world.has(id, Collider)) world.remove(id, Collider); } catch { /* */ }
    try { if (world.has(id, Interactable)) world.remove(id, Interactable); } catch { /* */ }
  }
}

function clampInt(value, fallback, min = 0) {
  const n = Number.isFinite(value) ? (value | 0) : fallback;
  return Math.max(min, n | 0);
}

function clampChance(value, fallback) {
  const n = Number.isFinite(value) ? Number(value) : fallback;
  return Math.max(0, Math.min(1, n));
}

function getFireSpreadChance(hazard) {
  return clampChance(hazard?.meta?.fireSpreadChance, DEFAULT_FIRE_SPREAD_CHANCE);
}

function getFireSpreadTurns(hazard, turnsBefore) {
  return clampInt(hazard?.meta?.fireSpreadTurns, Math.max(1, turnsBefore - 1), 1);
}

/**
 * Generic hazard resolver for persistent AoE entities.
 * `medium` is metadata only for now (`air` vs `floor`).
 *
 * @param {import('../../lib/ecs-js/index.js').World} world
 */
export function hazardSystem(world) {
  const overworld = isOverworld(world);
  tickDestroyedTileLedger(world);
  /** @type {Set<string>|null} */
  let unburnedWebCells = null;
  const fireHazardCells = new Set();
  for (const [, pos, hazard] of world.query(Position, HazardArea)) {
    if (!pos || !hazard) continue;
    if (String(hazard.kind || "generic").toLowerCase() !== "fire") continue;
    if (String(hazard.medium || "air").toLowerCase() !== "floor") continue;
    fireHazardCells.add(`${pos.x | 0},${pos.y | 0}`);
  }

  /** @type {Array<{ x:number, y:number, turnsLeft:number, tickDamage:number, damageType:string, cause:string, sourceId:number, sourceKind:string, meta:Record<string, unknown>|null }>} */
  const pendingFireSpreads = [];

  for (const [hazardId, pos, hazard] of world.query(Position, HazardArea)) {
    if (!pos || !hazard) continue;

    const kind = String(hazard.kind || "generic").toLowerCase() || "generic";
    const medium = String(hazard.medium || "air").toLowerCase() === "floor" ? "floor" : "air";
    const radius = clampInt(hazard.radius, DEFAULT_RADIUS, 0);
    const tickDamage = clampInt(hazard.tickDamage, DEFAULT_TICK_DAMAGE, 0);
    const turnsBefore = clampInt(hazard.turnsLeft, DEFAULT_TURNS, 0);
    const damageType = String(hazard.damageType || "generic").toLowerCase() || "generic";
    const cause = String(hazard.cause || `${kind}_hazard`);
    const sourceId = clampInt(hazard.sourceId, 0, 0);
    const sourceKind = typeof hazard.sourceKind === "string" ? hazard.sourceKind : "";
    const source = sourceId > 0 ? sourceId : hazardId;

    /** @type {number[]} */
    const affectedIds = [];

    if (kind === "fire" && medium === "floor") {
      burnFlammableEntitiesAt(world, pos.x, pos.y, source, hazardId, cause, sourceId, sourceKind);
      const tileBefore = getTile(pos.x, pos.y);
      const roofFuel = isRoofFuelTile(world, pos.x, pos.y, tileBefore, overworld);
      const replacementTile = getBurnedTileReplacement(tileBefore, overworld);
      const burnedKind = roofFuel ? "roof" : burnedTileKind(tileBefore);
      if (roofFuel) {
        markDestroyedTile(world, {
          x: pos.x | 0,
          y: pos.y | 0,
          originalTile: tileBefore,
          currentTile: tileBefore,
          destroyedAtTurn: world.step | 0,
          burnedKind,
          cause,
          sourceId,
          sourceKind,
          roofTurnsLeft: ROOF_BURN_TURNS,
        });
        try {
          world.emit?.("tile:burned", {
            actor: source,
            hazardId,
            x: pos.x | 0,
            y: pos.y | 0,
            cause,
            sourceId,
            sourceKind,
            burnedKind,
            tileBefore,
            tileAfter: tileBefore,
          });
        } catch { /* */ }
      } else if (replacementTile !== null && setTile(pos.x, pos.y, replacementTile)) {
        markDestroyedTile(world, {
          x: pos.x | 0,
          y: pos.y | 0,
          originalTile: tileBefore,
          currentTile: replacementTile,
          destroyedAtTurn: world.step | 0,
          burnedKind,
          cause,
          sourceId,
          sourceKind,
          roofTurnsLeft: isRoofBearingBurn(tileBefore) ? ROOF_BURN_TURNS : 0,
        });
        try {
          world.emit?.("tile:burned", {
            actor: source,
            hazardId,
            x: pos.x | 0,
            y: pos.y | 0,
            cause,
            sourceId,
            sourceKind,
            burnedKind,
            tileBefore,
            tileAfter: replacementTile,
          });
        } catch { /* */ }
      }
    }

    if (kind === "fire" && medium === "floor") {
      const spreadChance = getFireSpreadChance(hazard);
      if (spreadChance > 0) {
        if (!unburnedWebCells) {
          unburnedWebCells = new Set();
          for (const [id, ni, webPos] of world.query(NamedIdentity, Position)) {
            if (!ni || !webPos) continue;
            if (world.has(id, Burned)) continue;
            if (String(ni.identity || "").toLowerCase() !== WEB_IDENTITY) continue;
            unburnedWebCells.add(`${webPos.x | 0},${webPos.y | 0}`);
          }
        }
        const spreadTurns = getFireSpreadTurns(hazard, turnsBefore);
        for (const [dx, dy] of NEIGHBOR_OFFSETS) {
          const nx = (pos.x | 0) + dx;
          const ny = (pos.y | 0) + dy;
          const key = `${nx},${ny}`;
          if (fireHazardCells.has(key)) continue;
          const targetIsWeb = unburnedWebCells.has(key);
          const targetIsFlammableTile = isFlammableFireSpreadTile(world, nx, ny, getTile(nx, ny), overworld);
          if (!targetIsWeb && !targetIsFlammableTile) continue;
          const effectiveSpreadChance = targetIsWeb
            ? Math.max(spreadChance, WEB_FIRE_SPREAD_CHANCE)
            : spreadChance;
          if ((world.rand?.() ?? 0) >= effectiveSpreadChance) continue;

          pendingFireSpreads.push({
            x: nx,
            y: ny,
            turnsLeft: spreadTurns,
            tickDamage,
            damageType,
            cause,
            sourceId,
            sourceKind,
            meta: hazard.meta && typeof hazard.meta === "object"
              ? { ...hazard.meta, source: hazard.meta.source ?? "fire_spread" }
              : { source: "fire_spread" },
          });
          fireHazardCells.add(key);
        }
      }
    }

    // Quake hazards: apply stun to non-caster entities each tick.
    if (kind === "quake") {
      const stunTurns = (hazard.meta && Number.isFinite(hazard.meta.stunTurns))
        ? (hazard.meta.stunTurns | 0) : 2;
      for (const [id, tpos, vit] of world.query(Position, Vitality)) {
        if (!tpos || !vit) continue;
        if (id === hazardId || id === sourceId) continue;
        if ((vit.hp | 0) <= 0) continue;
        if (world.has(id, Flying)) continue;
        if (world.has(id, Pet) && world.has(sourceId, Player)) continue;
        const ddx = Math.abs((tpos.x | 0) - (pos.x | 0));
        const ddy = Math.abs((tpos.y | 0) - (pos.y | 0));
        if (Math.max(ddx, ddy) > radius) continue;
        let ae = /** @type any */ (world.get(id, ActiveEffects));
        if (!ae) {
          try { world.add(id, ActiveEffects, { effects: [] }); } catch { /* */ }
          ae = /** @type any */ (world.get(id, ActiveEffects));
        }
        if (ae && Array.isArray(ae.effects)) {
          const existing = ae.effects.find(/** @param {any} e */ (e) => e.key === 'stun');
          if (existing) {
            existing.turnsLeft = Math.max(existing.turnsLeft, stunTurns);
          } else {
            ae.effects.push({ key: 'stun', turnsLeft: stunTurns, potency: 1, stacks: 1, startedAtTurn: world.step, sourceId });
          }
        }
      }
    }

    if (tickDamage > 0) {
      for (const [id, tpos, vit] of world.query(Position, Vitality)) {
        if (!tpos || !vit) continue;
        if (id === hazardId) continue;
        if ((vit.hp | 0) <= 0) continue;
        if (medium === "floor" && world.has(id, Flying)) continue;
        // Quake hazards skip caster and their pet for damage.
        if (kind === "quake" && id === sourceId) continue;
        if (kind === "quake" && world.has(id, Pet) && world.has(sourceId, Player)) continue;

        const dx = Math.abs((tpos.x | 0) - (pos.x | 0));
        const dy = Math.abs((tpos.y | 0) - (pos.y | 0));
        if (Math.max(dx, dy) > radius) continue;

        const hit = dealDamage(world, {
          target: id,
          amount: tickDamage,
          type: damageType,
          source: hazardId,
          at: { x: tpos.x, y: tpos.y },
          cause,
        });
        if (hit.applied) affectedIds.push(id);
      }
    }

    hazard.turnsLeft = turnsBefore - 1;
    const turnsLeft = hazard.turnsLeft | 0;

    // Keep legacy PlasmaCloud component in sync while migrating call sites.
    const legacyPlasma = world.get(hazardId, PlasmaCloud);
    if (legacyPlasma) {
      legacyPlasma.turnsLeft = turnsLeft;
      legacyPlasma.radius = radius;
      legacyPlasma.damage = tickDamage;
      legacyPlasma.sourceId = sourceId;
      legacyPlasma.sourceKind = sourceKind;
    }

    try {
      world.emit?.("hazard:pulse", {
        hazardId,
        kind,
        medium,
        at: { x: pos.x, y: pos.y },
        radius,
        tickDamage,
        damageType,
        cause,
        turnsLeft,
        affectedIds,
        sourceId,
        sourceKind,
      });
    } catch { /* */ }

    // Plasma compatibility bridge for existing listeners/tests.
    if (kind === "plasma") {
      try {
        world.emit?.("plasmaCloud:pulse", {
          cloudId: hazardId,
          at: { x: pos.x, y: pos.y },
          radius,
          damage: tickDamage,
          turnsLeft,
          affectedIds,
          sourceId,
          sourceKind,
          medium,
        });
      } catch { /* */ }
    }

    if (turnsLeft <= 0) {
      try {
        world.emit?.("hazard:expired", {
          hazardId,
          kind,
          medium,
          at: { x: pos.x, y: pos.y },
          radius,
          damageType,
          cause,
          sourceId,
          sourceKind,
        });
      } catch { /* */ }

      if (kind === "plasma") {
        try {
          world.emit?.("plasmaCloud:expired", {
            cloudId: hazardId,
            at: { x: pos.x, y: pos.y },
            radius,
            sourceId,
            sourceKind,
            medium,
          });
        } catch { /* */ }
      }
      world.destroy(hazardId);
    }
  }

  for (const spread of pendingFireSpreads) {
    spawnFireSpreadHazard(world, spread);
  }
}

/**
 * @param {import('../../lib/ecs-js/index.js').World} world
 * @param {{ x:number, y:number, turnsLeft:number, tickDamage:number, damageType:string, cause:string, sourceId:number, sourceKind:string, meta:Record<string, unknown>|null }} spread
 */
function spawnFireSpreadHazard(world, spread) {
  const hazardId = world.create();
  world.add(hazardId, Position, { x: spread.x, y: spread.y });
  world.add(hazardId, HazardArea, {
    kind: "fire",
    medium: "floor",
    turnsLeft: spread.turnsLeft,
    radius: 0,
    tickDamage: spread.tickDamage,
    damageType: spread.damageType,
    cause: spread.cause,
    sourceId: spread.sourceId,
    sourceKind: spread.sourceKind,
    meta: spread.meta,
  });
  try {
    world.emit?.("hazard:spawned", {
      hazardId,
      kind: "fire",
      medium: "floor",
      at: { x: spread.x, y: spread.y },
      turnsLeft: spread.turnsLeft,
      radius: 0,
      tickDamage: spread.tickDamage,
      damageType: spread.damageType,
      cause: spread.cause,
      sourceId: spread.sourceId,
      sourceKind: spread.sourceKind,
      identity: "wildfire",
      name: "Wildfire",
    });
  } catch { /* */ }
}
