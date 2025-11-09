// bridge/schema/worldView.js
// Build a minimal, stable WorldView DTO for display.

import { Position } from "../../rules/components/Position.js";
import { Player } from "../../rules/components/Player.js";
import { NamedIdentity } from "../../rules/components/NamedIdentity.js";
import { Terrain } from "../../rules/components/Terrain.js";
import { DoorState } from "../../rules/components/DoorState.js";
import { Collider } from "../../rules/components/Collider.js";
import { Status } from "../../rules/components/Status.js";
import { BoundingCircle } from "../../rules/components/BoundingCircle.js";
import { Facing } from "../../rules/components/Facing.js";
import { Anatomy } from "../../rules/components/Anatomy.js";
import { DungeonGeometry } from "../../rules/components/DungeonGeometry.js";
import { LightSource } from "../../rules/components/LightSource.js";
import { Trap } from "../../rules/components/Trap.js";

// Reuse view/record objects across frames to reduce allocations/GC churn.
/** @typedef {{ id:number, kind:string, pos:{x:number,y:number}, tags:string[], radius:number, reach:number, stride:number, facing:{x:number,y:number} }} EntityView */
/** @typedef {{ id:number, x:number, y:number }} SolidView */
/** @typedef {{ seed:number, mbrVersion:number, moveVersion:number, occlVersion:number, mbr:any, primitives:any[], meta:any, options:any, hasData:boolean }} DungeonView */
/** @typedef {{ id:number, pos:{x:number,y:number}, radius:number, reach:number, stride:number, facing:{x:number,y:number}, fov:{distance:number, angle:number} }} PlayerView */
/** @typedef {{ id:number, x:number, y:number, radius:number, intensity:number, color:string|null, flicker:number, style:string|null, emitter:string|null }} EmissiveView */
/** @typedef {{ turn:number, seed:number, player: PlayerView | null, entities: EntityView[], solids: SolidView[], emissives: EmissiveView[], dungeon: DungeonView }} WorldView */

/** @type {WorldView} */
const _view = {
  turn: 0,
  seed: 0,
  player: null,
  entities: [],
  solids: [],
  emissives: [],
  dungeon: { seed: 0, mbrVersion: 0, moveVersion: 0, occlVersion: 0, mbr: null, primitives: [], meta: null, options: null, hasData: false }
};
/** @type {Map<number, EntityView>} */
const _entityRecs = new Map();   // id -> { id, kind, pos:{x,y}, tags:[] }
/** @type {Map<number, SolidView>} */
const _solidRecs = new Map();    // id -> { id, x, y }
/** @type {Map<number, EmissiveView>} */
const _emissiveRecs = new Map();

function cloneMeta(meta) {
  if (meta == null) return null;
  try {
    return JSON.parse(JSON.stringify(meta));
  } catch {
    return meta;
  }
}

function normalizeFacing(v) {
  const vx = Number.isFinite(v?.x) ? v.x : 1;
  const vy = Number.isFinite(v?.y) ? v.y : 0;
  const len = Math.hypot(vx, vy) || 1;
  return { x: vx / len, y: vy / len };
}

/**
 * @param {import('../../lib/ecs-js/index.js').World} world
 * @returns {WorldView}
 */
export function buildWorldView(world) {
  _view.turn = world.step | 0;
  _view.seed = world.seed >>> 0;
  _view.player = null;
  _view.entities.length = 0;
  _view.solids.length = 0;
  // emissives left as future use; keep empty
  _view.emissives.length = 0;

  const dungeonView = _view.dungeon;
  dungeonView.hasData = false;
  dungeonView.seed = 0;
  dungeonView.mbrVersion = 0;
  dungeonView.moveVersion = 0;
  dungeonView.occlVersion = 0;
  dungeonView.mbr = null;
  dungeonView.meta = null;
  dungeonView.options = null;
  dungeonView.primitives.length = 0;

  for (const [, geom] of world.query(DungeonGeometry)) {
    if (!geom) continue;
    dungeonView.hasData = true;
    dungeonView.seed = geom.seed >>> 0;
    dungeonView.mbrVersion = geom.mbrVersion | 0;
    dungeonView.moveVersion = geom.moveVersion | 0;
    dungeonView.occlVersion = geom.occlVersion | 0;
    dungeonView.mbr = geom.mbr
      ? { minX: geom.mbr.minX, minY: geom.mbr.minY, maxX: geom.mbr.maxX, maxY: geom.mbr.maxY }
      : null;
    dungeonView.options = geom.options ? { ...geom.options } : null;
    dungeonView.meta = cloneMeta(geom.meta);
    if (Array.isArray(geom.primitives)) {
      for (let i = 0; i < geom.primitives.length; i++) {
        dungeonView.primitives.push({ ...geom.primitives[i] });
      }
    }
    break;
  }

  for (const [id, pos] of world.query(Position)) {
    const isPlayer = world.has(id, Player);
    /** @type {any} */ const ident = /** @type any */ (world.get(id, NamedIdentity));
    /** @type {any} */ const terrain = /** @type any */ (world.get(id, Terrain));
    /** @type {any} */ const door = /** @type any */ (world.get(id, DoorState));
    /** @type {any} */ const col = /** @type any */ (world.get(id, Collider));
    /** @type {any} */ const circle = /** @type any */ (world.get(id, BoundingCircle));
    /** @type {any} */ const facing = /** @type any */ (world.get(id, Facing));
    /** @type {any} */ const anatomy = /** @type any */ (world.get(id, Anatomy));
    /** @type {any} */ const light = /** @type any */ (world.get(id, LightSource));

    let kind = "default";
    if (terrain) {
      kind = terrain.walkable ? "floor" : "wall";
    }
    if (door) {
      kind = door.open ? "door_open" : "door_closed";
    }
    if (isPlayer) {
      kind = "player";
    } else if (!terrain && !door) {
      // fall back to identity for creatures/items
      kind = ident?.identity || ident?.name || "default";
    }

    /** @type {EntityView|null} */
    let rec = /** @type any */ (_entityRecs.get(id) || null);
    if (!rec) {
      rec = { id, kind, pos: { x: pos.x, y: pos.y }, tags: [], radius: 0, reach: 0, stride: 0, facing: { x: 1, y: 0 } };
      _entityRecs.set(id, rec);
    } else {
      rec.kind = kind;
      rec.pos.x = pos.x; rec.pos.y = pos.y;
      rec.tags.length = 0;
      rec.radius = 0;
      rec.reach = 0;
      rec.stride = 0;
      if (!rec.facing) rec.facing = { x: 1, y: 0 };
    }

    const radius = Math.max(0, circle?.radius ?? 0);
    const reach = Math.max(0, anatomy?.reachDistance ?? 0);
    const stride = Math.max(0, anatomy?.strideDistance ?? 0);
    const fx = normalizeFacing(facing);
    rec.radius = radius;
    rec.reach = reach;
    rec.stride = stride;
    rec.facing.x = fx.x;
    rec.facing.y = fx.y;

    // Project select status types into tags for display-only logic
    /** @type {any} */ const stat = /** @type any */ (world.get(id, Status));
    if (stat && Array.isArray(stat.statuses)) {
      for (let i = 0; i < stat.statuses.length; i++) {
        const s = stat.statuses[i];
        const t = String(s.type || "").toLowerCase();
        if (!t) continue;
        // Whitelist: only expose a small set as tags to keep display contract tidy
        if (t === "invulnerable" || t === "stunned" || t === "poisoned" || t === "burning" || t === "regenerating" || t === "thorns") {
          rec.tags.push(t);
        }
      }
    }

    // Hide unrevealed traps from entity render list
    const trap = /** @type any */ (world.get(id, Trap));
    if (!(trap && trap.revealed === false)) {
      _view.entities.push(rec);
    }
    if (isPlayer) {
      const fovDistance = Math.max(8, Math.max(reach + radius, stride * 2, 4) * 2);
      const fovAngle = Math.PI * 0.75;
      if (!_view.player) {
        _view.player = {
          id,
          pos: { x: pos.x, y: pos.y },
          radius,
          reach,
          stride,
          facing: { x: rec.facing.x, y: rec.facing.y },
          fov: { distance: fovDistance, angle: fovAngle }
        };
      } else {
        _view.player.id = id;
        _view.player.pos.x = pos.x;
        _view.player.pos.y = pos.y;
        _view.player.radius = radius;
        _view.player.reach = reach;
        _view.player.stride = stride;
        if (!_view.player.facing) _view.player.facing = { x: rec.facing.x, y: rec.facing.y };
        else {
          _view.player.facing.x = rec.facing.x;
          _view.player.facing.y = rec.facing.y;
        }
        if (!_view.player.fov) _view.player.fov = { distance: fovDistance, angle: fovAngle };
        else {
          _view.player.fov.distance = fovDistance;
          _view.player.fov.angle = fovAngle;
        }
      }
    }

    // solids list for display/collision readers
    if ((terrain && !terrain.walkable) || (col && col.solid)) {
      let srec = _solidRecs.get(id);
      if (!srec) { srec = { id, x: pos.x, y: pos.y }; _solidRecs.set(id, srec); }
      else { srec.x = pos.x; srec.y = pos.y; }
      _view.solids.push(srec);
    }

    if (light && light.radius > 0) {
      let lrec = _emissiveRecs.get(id);
      if (!lrec) {
        lrec = {
          id,
          x: pos.x,
          y: pos.y,
          radius: Number(light.radius) || 0,
          intensity: Number(light.intensity) || 0,
          color: typeof light.color === "string" ? light.color : null,
          flicker: Number(light.flicker) || 0,
          style: typeof light.style === "string" ? light.style : null,
          emitter: typeof light.emitter === "string" ? light.emitter : null,
        };
        _emissiveRecs.set(id, lrec);
      } else {
        lrec.x = pos.x;
        lrec.y = pos.y;
        lrec.radius = Number(light.radius) || 0;
        lrec.intensity = Number(light.intensity) || 0;
        lrec.color = typeof light.color === "string" ? light.color : null;
        lrec.flicker = Number(light.flicker) || 0;
        lrec.style = typeof light.style === "string" ? light.style : null;
        lrec.emitter = typeof light.emitter === "string" ? light.emitter : null;
      }
      _view.emissives.push(lrec);
    }
  }
  return _view;
}
