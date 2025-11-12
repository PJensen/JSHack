import { playerEntity } from "../../rules/utils/queries.js";
import { createPlayer } from "../../rules/archetypes/Player.js";
import { GeometryKernel } from "../../rules/environment/GeometryKernel.js";
import { setGeometryKernel } from "../../rules/environment/worldGeometry.js";
import {
  FloorRef,
  GeomHandle,
  FloorState,
  LightingAccelHandle,
  DungeonLevel,
  DungeonGeometry,
  Position,
  NamedIdentity,
  LightSource,
} from "../../rules/components/index.js";
import {
  registerFloorDefinition,
  registerPortalV,
  resetRegistries,
} from "../../rules/analytic/index.js";

const LEVEL_ID = "demo-analytic";

const FLOOR_BLUEPRINTS = [
  {
    id: 1,
    label: "Sunken Atrium",
    spawn: { x: -2, y: 0 },
    layout: [
      { type: "box", cx: 0, cy: 0, hx: 6, hy: 5 },
      { type: "capsule", ax: -6, ay: 0, bx: 6, by: 0, r: 1.4 },
      { type: "capsule", ax: 0, ay: -5, bx: 0, by: 7, r: 1.3 },
    ],
    analytic: [
      { type: "solid-box", min: { x: -8.5, y: -8.5 }, max: { x: -7.5, y: 8.5 }, tag: "wall" },
      { type: "solid-box", min: { x: 7.5, y: -8.5 }, max: { x: 8.5, y: 8.5 }, tag: "wall" },
      { type: "solid-box", min: { x: -8.5, y: 7.5 }, max: { x: 8.5, y: 8.5 }, tag: "wall" },
      { type: "solid-circle", center: { x: -3, y: 0 }, radius: 1.1, tag: "column" },
      { type: "solid-circle", center: { x: 3, y: 0 }, radius: 1.1, tag: "column" },
    ],
    rooms: [
      { key: "atrium", width: 12, height: 10, center: { x: 0, y: 0 } },
    ],
    lights: [
      { position: { x: -4.5, y: -3.5 }, radius: 6, intensity: 1.15, color: "#ffcc88" },
      { position: { x: 4.25, y: 3.5 }, radius: 6, intensity: 0.95, color: "#88d0ff" },
    ],
  },
  {
    id: 2,
    label: "Forge Gallery",
    spawn: { x: 0, y: 0 },
    layout: [
      { type: "box", cx: 0, cy: 0, hx: 7, hy: 4 },
      { type: "box", cx: -6, cy: 0, hx: 2.5, hy: 3 },
      { type: "capsule", ax: 0, ay: -4, bx: 0, by: 7, r: 1.2 },
    ],
    analytic: [
      { type: "solid-box", min: { x: -9, y: -5 }, max: { x: -8, y: 5 }, tag: "wall" },
      { type: "solid-box", min: { x: 8, y: -5 }, max: { x: 9, y: 5 }, tag: "wall" },
      { type: "solid-box", min: { x: -2, y: 3.5 }, max: { x: 2, y: 4.5 }, tag: "beam" },
      { type: "solid-circle", center: { x: 3, y: -2 }, radius: 1.2, tag: "forge" },
    ],
    rooms: [
      { key: "gallery", width: 12, height: 8, center: { x: 0, y: 0 } },
      { key: "workshop", width: 6, height: 6, center: { x: -6, y: 0 } },
    ],
    lights: [
      { position: { x: -6, y: 0 }, radius: 5, intensity: 1.2, color: "#ff8844" },
      { position: { x: 2.5, y: -2 }, radius: 4.5, intensity: 1.0, color: "#ffa244" },
    ],
  },
  {
    id: 3,
    label: "Crystal Grotto",
    spawn: { x: -2, y: 1 },
    layout: [
      { type: "circle", cx: -6, cy: 0, r: 3.5 },
      { type: "capsule", ax: -6, ay: 0, bx: 2, by: 4, r: 1.1 },
      { type: "box", cx: 4, cy: 4, hx: 3, hy: 3 },
    ],
    analytic: [
      { type: "solid-circle", center: { x: -6, y: 0 }, radius: 1.2, tag: "pillar" },
      { type: "solid-box", min: { x: 2, y: 3 }, max: { x: 6, y: 7 }, tag: "crystal" },
    ],
    rooms: [
      { key: "grotto", width: 8, height: 8, center: { x: -6, y: 0 } },
    ],
    lights: [
      { position: { x: -6, y: 0 }, radius: 6, intensity: 0.9, color: "#7fb7ff" },
      { position: { x: 4, y: 4 }, radius: 5, intensity: 1.3, color: "#b38fff" },
    ],
  },
];

const PORTALS = [
  {
    id: "atrium-stairs",
    fromFloor: 1,
    toFloor: 2,
    center: { x: 0, y: 6 },
    radius: 0.9,
    rotation: Math.PI / 2,
    arrivalFacing: Math.PI / 2,
    visAttn: 0.85,
  },
  {
    id: "forge-lift",
    fromFloor: 2,
    toFloor: 3,
    center: { x: -6, y: 0 },
    radius: 0.85,
    rotation: -Math.PI / 2,
    arrivalFacing: 0,
    visAttn: 0.75,
  },
];

/**
 * Populate the analytic dungeon demo scene with multi-floor data and portal traversal hooks.
 * @param {import("../../lib/ecs-js/index.js").World} world
 */
export function populateDemoScene(world) {
  resetRegistries();

  const blueprintMap = new Map(FLOOR_BLUEPRINTS.map((bp) => [bp.id, bp]));
  const floorKernels = new Map();
  const geometrySnapshots = new Map();

  for (const blueprint of FLOOR_BLUEPRINTS) {
    const kernel = new GeometryKernel({ seed: (world.seed ?? 0) ^ (blueprint.id * 131) });
    applyLayout(kernel, blueprint.layout);
    floorKernels.set(blueprint.id, kernel);
    geometrySnapshots.set(blueprint.id, createDungeonSnapshot(blueprint, kernel));

    registerFloorDefinition(blueprint.id, {
      primitives: blueprint.analytic,
      version: blueprint.version ?? 1,
      levelArgs: { id: LEVEL_ID },
      floorArgs: { id: blueprint.id, label: blueprint.label },
    });
  }

  for (const portal of PORTALS) {
    if (!blueprintMap.has(portal.fromFloor) || !blueprintMap.has(portal.toFloor)) {
      continue;
    }
    const { forward, inverse } = makePortalTransforms(portal);
    registerPortalV({
      id: portal.id,
      fromFloor: portal.fromFloor,
      toFloor: portal.toFloor,
      shape2D: {
        type: "circle",
        center: { x: portal.center.x, y: portal.center.y },
        radius: portal.radius ?? 0.75,
      },
      transformAB: forward,
      transformBA: inverse,
      arrivalFacing: portal.arrivalFacing ?? 0,
      visAttn: portal.visAttn ?? 1,
      reentrySnapEpsilon: portal.snap ?? 0.05,
    });
  }

  const levelEntity = world.create();
  world.add(levelEntity, DungeonLevel, {
    levelId: LEVEL_ID,
    floors: FLOOR_BLUEPRINTS.map((bp) => bp.id),
    activeFloorId: FLOOR_BLUEPRINTS[0].id,
  });

  for (const blueprint of FLOOR_BLUEPRINTS) {
    const resource = world.create();
    world.add(resource, GeomHandle, { floorId: blueprint.id, kernelKey: "", snapshotPtr: null, version: 0 });
    world.add(resource, FloorState, { floorId: blueprint.id, doorStatesHash: "", dynamicEditsHash: "" });
    world.add(resource, LightingAccelHandle, { floorId: blueprint.id, accelPtr: null, version: 0, ttlTicks: 0 });
  }

  const geometryEntity = world.create();

  const updateActiveFloor = (floorId) => {
    const snapshot = geometrySnapshots.get(floorId);
    if (snapshot) {
      const payload = cloneSnapshot(snapshot);
      if (world.has(geometryEntity, DungeonGeometry)) {
        world.set(geometryEntity, DungeonGeometry, payload);
      } else {
        world.add(geometryEntity, DungeonGeometry, payload);
      }
    }
    const kernel = floorKernels.get(floorId);
    if (kernel) {
      setGeometryKernel(world, kernel);
    }
    const level = world.get(levelEntity, DungeonLevel);
    if (level) {
      level.activeFloorId = floorId;
    }
  };

  updateActiveFloor(FLOOR_BLUEPRINTS[0].id);

  world.on("FloorChanged", ({ toFloor }) => {
    if (Number.isFinite(toFloor)) {
      updateActiveFloor(toFloor);
    }
  });

  const startFloor = FLOOR_BLUEPRINTS[0];
  const playerId = ensurePlayer(world, startFloor.spawn, startFloor.id);

  for (const blueprint of FLOOR_BLUEPRINTS) {
    placeFloorMarker(world, blueprint);
    placeFloorLights(world, blueprint);
  }

  return playerId;
}

function applyLayout(kernel, layout = []) {
  if (!Array.isArray(layout)) return;
  const flags = { affectsMove: true, affectsOccl: true };
  for (const shape of layout) {
    if (!shape) continue;
    switch (shape.type) {
      case "box":
        kernel.carveBox(shape.cx ?? 0, shape.cy ?? 0, shape.hx ?? 1, shape.hy ?? 1, shape.rot ?? 0, flags);
        break;
      case "capsule":
        kernel.carveCapsule(shape.ax ?? 0, shape.ay ?? 0, shape.bx ?? 0, shape.by ?? 0, shape.r ?? 1, flags);
        break;
      case "rectslot":
        kernel.carveRectSlot(shape.ax ?? 0, shape.ay ?? 0, shape.bx ?? 0, shape.by ?? 0, shape.r ?? 1, flags);
        break;
      case "square":
        kernel.carveSquare(shape.ax ?? 0, shape.ay ?? 0, shape.bx ?? 0, shape.by ?? 0, shape.halfW ?? shape.halfWidth ?? 1, shape.rot ?? 0, flags);
        break;
      case "circle":
        kernel.carveCircle(shape.cx ?? 0, shape.cy ?? 0, shape.r ?? 1, flags);
        break;
      default:
        break;
    }
  }
}

function createDungeonSnapshot(blueprint, kernel) {
  const snap = kernel.snapshot();
  const rooms = Array.isArray(blueprint.rooms)
    ? blueprint.rooms.map((room, idx) => ({
        key: room.key ?? `room-${idx}`,
        width: room.width ?? 0,
        height: room.height ?? 0,
        center: room.center ? { x: room.center.x ?? 0, y: room.center.y ?? 0 } : { x: 0, y: 0 },
      }))
    : [];
  return {
    seed: snap.seed,
    mbrVersion: snap.mbrVersion,
    moveVersion: snap.moveVersion,
    occlVersion: snap.occlVersion,
    mbr: snap.mbr
      ? { minX: snap.mbr.minX, minY: snap.mbr.minY, maxX: snap.mbr.maxX, maxY: snap.mbr.maxY }
      : null,
    primitives: snap.primitives.map((p) => ({ ...p })),
    meta: {
      levelId: LEVEL_ID,
      floorId: blueprint.id,
      label: blueprint.label,
      room: rooms[0] ? { ...rooms[0] } : null,
      rooms,
    },
    options: snap.options ? { ...snap.options } : null,
  };
}

function cloneSnapshot(snapshot) {
  return {
    seed: snapshot.seed,
    mbrVersion: snapshot.mbrVersion,
    moveVersion: snapshot.moveVersion,
    occlVersion: snapshot.occlVersion,
    mbr: snapshot.mbr
      ? { minX: snapshot.mbr.minX, minY: snapshot.mbr.minY, maxX: snapshot.mbr.maxX, maxY: snapshot.mbr.maxY }
      : null,
    primitives: Array.isArray(snapshot.primitives)
      ? snapshot.primitives.map((prim) => ({ ...prim }))
      : [],
    meta: snapshot.meta ? JSON.parse(JSON.stringify(snapshot.meta)) : null,
    options: snapshot.options ? { ...snapshot.options } : null,
  };
}

function makePortalTransforms(portal) {
  const center = portal.center ?? { x: 0, y: 0 };
  const rotation = Number.isFinite(portal.rotation) ? portal.rotation : 0;
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  return {
    forward: {
      apply(point) {
        const dx = point.x - center.x;
        const dy = point.y - center.y;
        const rx = cos * dx - sin * dy;
        const ry = sin * dx + cos * dy;
        return { x: center.x + rx, y: center.y + ry };
      },
    },
    inverse: {
      apply(point) {
        const dx = point.x - center.x;
        const dy = point.y - center.y;
        const rx = cos * dx + sin * dy;
        const ry = -sin * dx + cos * dy;
        return { x: center.x + rx, y: center.y + ry };
      },
    },
  };
}

function ensurePlayer(world, spawn, floorId) {
  const existing = playerEntity(world);
  if (existing) {
    world.set(existing.id, Position, { x: spawn.x, y: spawn.y });
    const floorRef = world.get(existing.id, FloorRef);
    if (floorRef) {
      floorRef.floorId = floorId;
      floorRef.altitude = 0;
    } else {
      world.add(existing.id, FloorRef, { floorId, altitude: 0 });
    }
    return existing.id;
  }
  const id = createPlayer(world, { x: spawn.x, y: spawn.y, name: "Delver" });
  world.add(id, FloorRef, { floorId, altitude: 0 });
  return id;
}

function placeFloorLights(world, blueprint) {
  if (!Array.isArray(blueprint.lights)) return;
  for (const light of blueprint.lights) {
    const entity = world.create();
    world.add(entity, Position, {
      x: light.position?.x ?? 0,
      y: light.position?.y ?? 0,
    });
    world.add(entity, FloorRef, { floorId: blueprint.id, altitude: 0 });
    world.add(entity, LightSource, {
      radius: light.radius ?? 5,
      intensity: light.intensity ?? 1,
      color: light.color ?? "#ffffff",
      flicker: light.flicker ?? 0.1,
      style: light.style ?? "omni",
      emitter: light.emitter ?? null,
    });
  }
}

function placeFloorMarker(world, blueprint) {
  const marker = world.create();
  world.add(marker, Position, { x: blueprint.spawn.x, y: blueprint.spawn.y - 1.5 });
  world.add(marker, FloorRef, { floorId: blueprint.id, altitude: 0 });
  world.add(marker, NamedIdentity, {
    name: blueprint.label,
    identity: `marker_floor_${blueprint.id}`,
  });
}
