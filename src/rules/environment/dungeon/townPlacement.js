import {
  BUILDING_DEFS,
  canPlaceBuilding,
} from "../../data/buildings/buildingRegistry.js";
import { TOWN_DISTRICT_DEFS } from "../../data/townDistricts.js";
import {
  CHUNK_SIZE,
  TILE_BEACH,
  TILE_BADLANDS,
  TILE_BOG,
  TILE_COBBLESTONE,
  TILE_CORAL_REEF,
  TILE_DOOR,
  TILE_FARMLAND,
  TILE_FENCE,
  TILE_FLOOR,
  TILE_GRASS,
  TILE_GRASS_A,
  TILE_GRASS_C,
  TILE_GRASS_D,
  TILE_GRAVEL,
  TILE_KELP_FOREST,
  TILE_MANGROVE,
  TILE_MARSH,
  TILE_MOORLAND,
  TILE_MOUNTAIN,
  TILE_MOUNTAIN_B,
  TILE_MOUNTAIN_C,
  TILE_MUD,
  TILE_PALM_FOREST,
  TILE_PINE_FOREST,
  TILE_ROCKY_SHORE,
  TILE_SALT_MARSH,
  TILE_SAND_DUNES,
  TILE_SCRUBLAND,
  TILE_SEAGRASS,
  TILE_SHALLOW_WATER,
  TILE_SHINGLE,
  TILE_SWAMP,
  TILE_TIDAL_FLAT,
  TILE_TREE,
  TILE_WALL,
  TILE_WATER,
  TILE_WATER_DEEP,
} from "./constants.js";
import { stampBuilding } from "./stampBuilding.js";

const DEFAULT_ROTATIONS = Object.freeze([0]);

const NATURAL_BUILDABLE = new Set([
  TILE_GRASS, TILE_GRASS_A, TILE_GRASS_C, TILE_GRASS_D,
  TILE_BEACH, TILE_MARSH, TILE_SWAMP, TILE_BOG, TILE_SAND_DUNES,
  TILE_MUD, TILE_TIDAL_FLAT, TILE_ROCKY_SHORE, TILE_SALT_MARSH,
  TILE_SHINGLE, TILE_MOORLAND, TILE_SCRUBLAND, TILE_GRAVEL,
  TILE_PINE_FOREST, TILE_PALM_FOREST, TILE_MANGROVE,
]);

const FLAT_TILES = new Set([
  TILE_GRASS, TILE_GRASS_A, TILE_GRASS_C, TILE_GRASS_D,
  TILE_BEACH, TILE_MOORLAND, TILE_SCRUBLAND, TILE_GRAVEL,
  TILE_SHINGLE, TILE_SAND_DUNES,
]);

const WET_TILES = new Set([
  TILE_WATER, TILE_WATER_DEEP, TILE_SHALLOW_WATER,
  TILE_KELP_FOREST, TILE_SEAGRASS, TILE_CORAL_REEF,
]);

const WATER_EDGE_TILES = new Set([
  TILE_BEACH, TILE_MARSH, TILE_SWAMP, TILE_BOG, TILE_MUD,
  TILE_TIDAL_FLAT, TILE_SALT_MARSH, TILE_MANGROVE,
]);

const MOUNTAIN_TILES = new Set([
  TILE_MOUNTAIN, TILE_MOUNTAIN_B, TILE_MOUNTAIN_C, TILE_ROCKY_SHORE, TILE_BADLANDS,
]);

const FOREST_TILES = new Set([TILE_TREE, TILE_PINE_FOREST, TILE_PALM_FOREST, TILE_MANGROVE]);
const STRUCTURE_TILES = new Set([TILE_FLOOR, TILE_WALL, TILE_DOOR, TILE_FARMLAND, TILE_FENCE, TILE_COBBLESTONE]);

const BUILDING_PLANS = Object.freeze([
  Object.freeze({ key: "well_plaza", district: "civic_core", coreDx: 0, coreDy: 0, wants: ["flat"], roles: [] }),
  Object.freeze({ key: "cottage", district: "civic_core", coreDx: -7, coreDy: 6, wants: ["flat"], roles: ["villager"] }),
  Object.freeze({ key: "tavern", district: "market_green", coreDx: -8, coreDy: -3, wants: ["flat"], roles: ["barkeep"] }),
  Object.freeze({ key: "general_store", district: "market_green", coreDx: -3, coreDy: 9, wants: ["flat"], roles: [] }),
  Object.freeze({ key: "smithy", district: "workshop_row", coreDx: 12, coreDy: -4, wants: ["mountain", "flat"], roles: ["smith"] }),
  Object.freeze({ key: "apothecary", district: "workshop_row", coreDx: 4, coreDy: 13, wants: ["forest", "water"], roles: ["alchemist"] }),
  Object.freeze({ key: "gem_store", district: "workshop_row", coreDx: -1, coreDy: 12, wants: ["flat"], roles: ["gem_vendor"] }),
  Object.freeze({ key: "book_shop", district: "civic_core", coreDx: 7, coreDy: -10, wants: ["flat"], roles: ["book_vendor"] }),
  Object.freeze({ key: "church", district: "churchyard", coreDx: -12, coreDy: 8, wants: ["quiet", "flat"], roles: ["priest"] }),
  Object.freeze({ key: "graveyard", district: "churchyard", coreDx: 4, coreDy: 11, wants: ["quiet", "flat"], roles: [] }),
  Object.freeze({ key: "farm", district: "market_green", resource: "waterFlat", wants: ["flat", "water"], roles: ["farmer"] }),
  Object.freeze({ key: "windmill", district: "market_green", resource: "waterFlat", wants: ["flat"], roles: [] }),
  Object.freeze({ key: "herbalist_hut", district: "workshop_row", resource: "herbs", wants: ["forest", "water"], roles: ["herbalist"], supplies: "apothecary" }),
  Object.freeze({ key: "mine_camp", defKey: "cottage", district: "workshop_row", resource: "mine", wants: ["mountain", "flat"], roles: ["miner"], supplies: "smithy" }),
  Object.freeze({ key: "woodcutter_camp", defKey: "cottage", district: "workshop_row", resource: "forest", wants: ["forest", "flat"], roles: ["woodcutter"], supplies: "general_store" }),
]);

function chunkKey(cx, cy) {
  return `${cx},${cy}`;
}

function getWorldTile(chunks, x, y) {
  const cx = Math.floor(x / CHUNK_SIZE);
  const cy = Math.floor(y / CHUNK_SIZE);
  const chunk = chunks.get(chunkKey(cx, cy));
  if (!chunk) return TILE_WATER;
  const lx = x - cx * CHUNK_SIZE;
  const ly = y - cy * CHUNK_SIZE;
  if (lx < 0 || ly < 0 || lx >= CHUNK_SIZE || ly >= CHUNK_SIZE) return TILE_WATER;
  return chunk.tiles[ly * CHUNK_SIZE + lx];
}

function setChunkTile(chunks, x, y, tile) {
  const cx = Math.floor(x / CHUNK_SIZE);
  const cy = Math.floor(y / CHUNK_SIZE);
  const chunk = chunks.get(chunkKey(cx, cy));
  if (!chunk) return;
  const lx = x - cx * CHUNK_SIZE;
  const ly = y - cy * CHUNK_SIZE;
  if (lx < 0 || ly < 0 || lx >= CHUNK_SIZE || ly >= CHUNK_SIZE) return;
  chunk.tiles[ly * CHUNK_SIZE + lx] = tile;
}

function addChunkSpawn(chunks, x, y, kind, params = {}) {
  const cx = Math.floor(x / CHUNK_SIZE);
  const cy = Math.floor(y / CHUNK_SIZE);
  const chunk = chunks.get(chunkKey(cx, cy));
  if (!chunk) return;
  chunk.spawns.push({ x, y, kind, params });
}

function xyKey(x, y) {
  return `${x},${y}`;
}

function mulberry(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rotatePoint(dx, dy, rotation) {
  switch (rotation & 3) {
    case 1: return { dx: -dy, dy: dx };
    case 2: return { dx: -dx, dy: -dy };
    case 3: return { dx: dy, dy: -dx };
    default: return { dx, dy };
  }
}

export function rotateBuildingDef(def, rotation) {
  const rot = rotation & 3;
  if (rot === 0) return def;
  const rotateEntry = (entry) => ({ ...entry, ...rotatePoint(Number(entry.dx) | 0, Number(entry.dy) | 0, rot) });
  const tiles = (def.tiles || []).map(rotateEntry);
  const spawns = (def.spawns || []).map(rotateEntry);
  const waypoints = (def.waypoints || []).map(rotateEntry);
  const rooms = (def.rooms || []).map((room) => {
    const corners = [
      rotatePoint(Number(room.dx) | 0, Number(room.dy) | 0, rot),
      rotatePoint((Number(room.dx) | 0) + (Number(room.w) | 0) - 1, Number(room.dy) | 0, rot),
      rotatePoint(Number(room.dx) | 0, (Number(room.dy) | 0) + (Number(room.h) | 0) - 1, rot),
      rotatePoint((Number(room.dx) | 0) + (Number(room.w) | 0) - 1, (Number(room.dy) | 0) + (Number(room.h) | 0) - 1, rot),
    ];
    const xs = corners.map((p) => p.dx);
    const ys = corners.map((p) => p.dy);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    return {
      ...room,
      dx: minX,
      dy: minY,
      w: Math.max(...xs) - minX + 1,
      h: Math.max(...ys) - minY + 1,
    };
  });
  return {
    ...def,
    name: def.name,
    rotation: rot,
    tiles,
    spawns,
    waypoints,
    rooms,
  };
}

function countNear(chunks, x, y, radius, predicate) {
  let count = 0;
  for (let yy = y - radius; yy <= y + radius; yy++) {
    for (let xx = x - radius; xx <= x + radius; xx++) {
      if (Math.max(Math.abs(xx - x), Math.abs(yy - y)) > radius) continue;
      if (predicate(getWorldTile(chunks, xx, yy))) count++;
    }
  }
  return count;
}

function nearestScore(chunks, x, y, radius, predicate) {
  for (let r = 1; r <= radius; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
        if (predicate(getWorldTile(chunks, x + dx, y + dy))) return radius - r + 1;
      }
    }
  }
  return 0;
}

function footprint(def, anchorX, anchorY, margin = 0) {
  const keys = new Set();
  for (const tile of def.tiles || []) {
    const wx = anchorX + (Number(tile.dx) | 0);
    const wy = anchorY + (Number(tile.dy) | 0);
    for (let dy = -margin; dy <= margin; dy++) {
      for (let dx = -margin; dx <= margin; dx++) {
        keys.add(xyKey(wx + dx, wy + dy));
      }
    }
  }
  return keys;
}

function doorFor(result, anchorX, anchorY) {
  return result.waypoints.shop_door
    || result.waypoints.front_door
    || result.waypoints.door
    || { x: anchorX, y: anchorY };
}

function terrainScore(chunks, x, y) {
  const flat = countNear(chunks, x, y, 5, (t) => FLAT_TILES.has(t));
  const wet = nearestScore(chunks, x, y, 28, (t) => WET_TILES.has(t) || WATER_EDGE_TILES.has(t));
  const mountain = nearestScore(chunks, x, y, 36, (t) => MOUNTAIN_TILES.has(t));
  const forest = nearestScore(chunks, x, y, 24, (t) => FOREST_TILES.has(t));
  const blocked = countNear(chunks, x, y, 4, (t) => WET_TILES.has(t) || MOUNTAIN_TILES.has(t));
  return flat * 3 + wet * 5 + mountain * 4 + forest * 2 - blocked * 8;
}

function chooseTownCenter(chunks, bounds, seed) {
  const rng = mulberry(seed ^ 0x5E77);
  const targetX = Math.floor((bounds.minX + bounds.maxX) / 2);
  const targetY = Math.floor((bounds.minY + bounds.maxY) / 2);
  let best = null;
  for (let y = Math.max(bounds.minY + 26, targetY - 18); y <= Math.min(bounds.maxY - 26, targetY + 18); y += 2) {
    for (let x = Math.max(bounds.minX + 26, targetX - 18); x <= Math.min(bounds.maxX - 26, targetX + 18); x += 2) {
      const centerBias = 120 - Math.max(Math.abs(x - targetX), Math.abs(y - targetY)) * 6;
      const score = terrainScore(chunks, x, y) + centerBias + rng() * 0.01;
      if (!best || score > best.score) best = { x, y, score };
    }
  }
  if (best) return { x: best.x, y: best.y };
  return {
    x: Math.floor((bounds.minX + bounds.maxX) / 2),
    y: Math.floor((bounds.minY + bounds.maxY) / 2),
  };
}

function findDirectionalAnchor(chunks, center, bounds, dx, dy, wants) {
  let best = null;
  for (let r = 10; r <= 31; r++) {
    const baseX = center.x + dx * r;
    const baseY = center.y + dy * r;
    for (let oy = -7; oy <= 7; oy++) {
      for (let ox = -7; ox <= 7; ox++) {
        const x = baseX + ox;
        const y = baseY + oy;
        if (x < bounds.minX + 18 || x > bounds.maxX - 18 || y < bounds.minY + 18 || y > bounds.maxY - 18) continue;
        const t = getWorldTile(chunks, x, y);
        if (!NATURAL_BUILDABLE.has(t)) continue;
        let score = countNear(chunks, x, y, 5, (tile) => FLAT_TILES.has(tile)) * 2;
        if (wants.includes("water")) score += nearestScore(chunks, x, y, 24, (tile) => WET_TILES.has(tile)) * 8;
        if (wants.includes("mountain")) score += nearestScore(chunks, x, y, 30, (tile) => MOUNTAIN_TILES.has(tile)) * 7;
        if (wants.includes("forest")) score += nearestScore(chunks, x, y, 20, (tile) => FOREST_TILES.has(tile)) * 5;
        if (wants.includes("quiet")) score += r * 2 - nearestScore(chunks, x, y, 16, (tile) => WET_TILES.has(tile)) * 2;
        score -= countNear(chunks, x, y, 3, (tile) => WET_TILES.has(tile) || MOUNTAIN_TILES.has(tile)) * 12;
        if (!best || score > best.score) best = { x, y, score };
      }
    }
  }
  return best || { x: center.x + dx * 14, y: center.y + dy * 14 };
}

function chooseDistricts(chunks, center, bounds) {
  const byKey = {
    civic_core: { x: center.x, y: center.y },
    market_green: { x: center.x - 6, y: center.y + 2 },
    workshop_row: { x: center.x + 10, y: center.y },
    churchyard: { x: center.x, y: center.y + 12 },
  };
  return TOWN_DISTRICT_DEFS.map((def) => ({
    key: def.key,
    label: def.label,
    radius: def.radius,
    x: byKey[def.key]?.x ?? center.x,
    y: byKey[def.key]?.y ?? center.y,
  }));
}

function resourceAnchor(chunks, center, bounds, resource) {
  if (resource === "mine") return findDirectionalAnchor(chunks, center, bounds, 1, -1, ["mountain"]);
  if (resource === "forest") return findDirectionalAnchor(chunks, center, bounds, -1, -1, ["forest"]);
  if (resource === "herbs") return findDirectionalAnchor(chunks, center, bounds, -1, 1, ["forest", "water"]);
  if (resource === "waterFlat") return findDirectionalAnchor(chunks, center, bounds, -1, 1, ["water", "flat"]);
  return center;
}

function wantsScore(chunks, x, y, wants) {
  let score = 0;
  if (wants.includes("flat")) score += countNear(chunks, x, y, 4, (t) => FLAT_TILES.has(t)) * 3;
  if (wants.includes("water")) score += nearestScore(chunks, x, y, 22, (t) => WET_TILES.has(t) || WATER_EDGE_TILES.has(t)) * 9;
  if (wants.includes("mountain")) score += nearestScore(chunks, x, y, 30, (t) => MOUNTAIN_TILES.has(t)) * 8;
  if (wants.includes("forest")) score += nearestScore(chunks, x, y, 22, (t) => FOREST_TILES.has(t)) * 6;
  if (wants.includes("quiet")) score += countNear(chunks, x, y, 8, (t) => NATURAL_BUILDABLE.has(t)) - nearestScore(chunks, x, y, 12, (t) => STRUCTURE_TILES.has(t)) * 3;
  return score;
}

function canBuildOn(chunks, x, y) {
  return NATURAL_BUILDABLE.has(getWorldTile(chunks, x, y));
}

function placeBuilding(chunks, bounds, plan, district, occupied, protectedTiles, seed) {
  const baseDef = BUILDING_DEFS[plan.defKey || plan.key];
  if (!baseDef) return null;
  const rng = mulberry((seed ^ hashKey(plan.key)) >>> 0);
  let best = null;
  const searchRadius = plan.resource ? 18 : 16;
  const targetX = district.x + (Number(plan.coreDx) | 0);
  const targetY = district.y + (Number(plan.coreDy) | 0);
  const rotations = plan.rotations || DEFAULT_ROTATIONS;
  for (let r = 0; r <= searchRadius; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
        const anchorX = targetX + dx;
        const anchorY = targetY + dy;
        if (anchorX < bounds.minX + 8 || anchorX > bounds.maxX - 8 || anchorY < bounds.minY + 8 || anchorY > bounds.maxY - 8) continue;
        for (const rotation of rotations) {
          const def = rotateBuildingDef(baseDef, rotation);
          if (!canPlaceBuilding(chunks, anchorX, anchorY, def, (x, y) => occupied.has(xyKey(x, y)) || !canBuildOn(chunks, x, y))) continue;
          const dist = Math.max(Math.abs(anchorX - targetX), Math.abs(anchorY - targetY));
          const score = wantsScore(chunks, anchorX, anchorY, plan.wants || [])
            - dist * 4
            + (rotation === 0 ? 2 : 0)
            + rng() * 0.01;
          if (!best || score > best.score) best = { def, anchorX, anchorY, rotation, score };
        }
      }
    }
  }
  if (!best) return null;

  const stamped = stampBuilding(chunks, best.def, best.anchorX, best.anchorY);
  const exact = footprint(best.def, best.anchorX, best.anchorY, 0);
  const margin = footprint(best.def, best.anchorX, best.anchorY, 1);
  for (const key of margin) occupied.add(key);
  for (const key of exact) protectedTiles.add(key);
  const door = doorFor(stamped, best.anchorX, best.anchorY);
  return {
    key: plan.key,
    defKey: plan.defKey || plan.key,
    district: plan.district,
    anchorX: best.anchorX,
    anchorY: best.anchorY,
    rotation: best.rotation,
    door,
    waypoints: stamped.waypoints,
    spawns: stamped.spawns,
    shop: stamped.shop,
  };
}

function hashKey(key) {
  let hash = 2166136261;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function addTownfolkForBuilding(chunks, building, roles, tavernDoor) {
  const home = building.waypoints.resident_home
    || building.waypoints.vendor_work
    || building.waypoints.farmer_work
    || building.door;
  const work = building.waypoints.vendor_work
    || building.waypoints.farmer_work
    || building.waypoints.shop_door
    || building.waypoints.front_door
    || building.door;
  for (const role of roles) {
    addChunkSpawn(chunks, work.x, work.y, "townfolk", {
      townfolkId: role,
      homeX: home.x,
      homeY: home.y,
      bedX: home.x,
      bedY: home.y,
      workX: work.x,
      workY: work.y,
      pubX: tavernDoor?.x ?? work.x,
      pubY: tavernDoor?.y ?? work.y,
      shopDoor: building.shop?.door || null,
      shopDoorRole: building.shop?.vendorRole || role,
      shopRoom: building.shop?.room || null,
      scheduleEnabled: true,
    });
  }
}

function routePath(chunks, bounds, from, to, protectedTiles) {
  const minX = Math.max(bounds.minX, Math.min(from.x, to.x) - 54);
  const maxX = Math.min(bounds.maxX, Math.max(from.x, to.x) + 54);
  const minY = Math.max(bounds.minY, Math.min(from.y, to.y) - 54);
  const maxY = Math.min(bounds.maxY, Math.max(from.y, to.y) + 54);
  const startKey = xyKey(from.x, from.y);
  const goalKey = xyKey(to.x, to.y);
  const open = [{ x: from.x, y: from.y, f: 0, g: 0 }];
  const came = new Map();
  const cost = new Map([[startKey, 0]]);
  const closed = new Set();
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (let steps = 0; open.length > 0 && steps < 9000; steps++) {
    open.sort((a, b) => a.f - b.f);
    const cur = open.shift();
    if (!cur) break;
    const curKey = xyKey(cur.x, cur.y);
    if (closed.has(curKey)) continue;
    closed.add(curKey);
    if (cur.x === to.x && cur.y === to.y) break;
    for (const [dx, dy] of dirs) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      if (nx < minX || nx > maxX || ny < minY || ny > maxY) continue;
      const nk = xyKey(nx, ny);
      const tile = getWorldTile(chunks, nx, ny);
      const endpoint = nk === goalKey || nk === startKey;
      if (!endpoint && protectedTiles.has(nk)) continue;
      if (WET_TILES.has(tile) || MOUNTAIN_TILES.has(tile) || tile === TILE_WALL || tile === TILE_FENCE) continue;
      const step = STRUCTURE_TILES.has(tile) ? 8 : 1;
      const ng = cur.g + step;
      if (ng >= (cost.get(nk) ?? Infinity)) continue;
      cost.set(nk, ng);
      came.set(nk, xyKey(cur.x, cur.y));
      const h = Math.abs(nx - to.x) + Math.abs(ny - to.y);
      open.push({ x: nx, y: ny, g: ng, f: ng + h });
    }
  }
  if (!came.has(goalKey)) return;
  let k = goalKey;
  while (k && k !== startKey) {
    const [x, y] = k.split(",").map(Number);
    const tile = getWorldTile(chunks, x, y);
    if (!protectedTiles.has(k) && NATURAL_BUILDABLE.has(tile)) setChunkTile(chunks, x, y, TILE_COBBLESTONE);
    k = came.get(k);
  }
}

function addCivicFixtures(chunks, center, buildings) {
  const cottage = buildings.find((b) => b.key === "cottage");
  const tavern = buildings.find((b) => b.key === "tavern");
  const signPos = cottage ? { x: cottage.door.x - 1, y: cottage.door.y + 1 } : { x: center.x - 1, y: center.y + 1 };
  addChunkSpawn(chunks, signPos.x, signPos.y, "home_sign");
  const chestPos = cottage?.waypoints.vendor_work || cottage?.spawns.home_bed || null;
  if (chestPos) addChunkSpawn(chunks, chestPos.x + 1, chestPos.y, "home_chest");
  addChunkSpawn(chunks, center.x - 2, center.y, "message_board");
  if (tavern) addChunkSpawn(chunks, tavern.door.x, tavern.door.y + 2, "lantern_post");
}

function addResourceSpawns(chunks, center, bounds) {
  const kinds = [
    ["harvest_berries", (t) => FOREST_TILES.has(t) || FLAT_TILES.has(t)],
    ["harvest_herbs", (t) => FOREST_TILES.has(t) || WATER_EDGE_TILES.has(t)],
    ["harvest_thorn_bramble", (t) => FOREST_TILES.has(t) || t === TILE_SWAMP || t === TILE_BOG],
    ["harvest_venom_fern", (t) => FOREST_TILES.has(t) || t === TILE_MARSH || t === TILE_MANGROVE],
    ["harvest_iron_ore", (t) => MOUNTAIN_TILES.has(t)],
    ["harvest_coal_ore", (t) => MOUNTAIN_TILES.has(t)],
    ["harvest_stone", (t) => MOUNTAIN_TILES.has(t) || t === TILE_GRAVEL],
  ];
  for (const [kind, predicate] of kinds) {
    let placed = 0;
    for (let r = kind.includes("ore") ? 12 : 8; r <= 54 && placed < 3; r++) {
      for (let dx = -r; dx <= r && placed < 3; dx++) {
        for (let dy = -r; dy <= r && placed < 3; dy++) {
          if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
          const x = center.x + dx;
          const y = center.y + dy;
          if (x < bounds.minX + 2 || x > bounds.maxX - 2 || y < bounds.minY + 2 || y > bounds.maxY - 2) continue;
          if (!predicate(getWorldTile(chunks, x, y))) continue;
          addChunkSpawn(chunks, x, y, kind);
          placed++;
        }
      }
    }
  }
}

export function planTownPlacement(chunks, bounds, seed) {
  const center = chooseTownCenter(chunks, bounds, seed);
  const districts = chooseDistricts(chunks, center, bounds);
  const byDistrict = Object.fromEntries(districts.map((district) => [district.key, district]));
  const resources = {
    mine: resourceAnchor(chunks, center, bounds, "mine"),
    forest: resourceAnchor(chunks, center, bounds, "forest"),
    herbs: resourceAnchor(chunks, center, bounds, "herbs"),
    waterFlat: resourceAnchor(chunks, center, bounds, "waterFlat"),
  };
  return { center, districts, byDistrict, resources, seed };
}

export function applyTownPlacement(chunks, bounds, seed) {
  const plan = planTownPlacement(chunks, bounds, seed);
  const occupied = new Set();
  const protectedTiles = new Set();
  const buildings = [];

  for (const buildingPlan of BUILDING_PLANS) {
    const district = buildingPlan.resource
      ? (plan.resources[buildingPlan.resource] || plan.byDistrict[buildingPlan.district] || plan.districts[0])
      : (plan.byDistrict[buildingPlan.district] || plan.districts[0]);
    const placed = placeBuilding(chunks, bounds, buildingPlan, district, occupied, protectedTiles, seed);
    if (placed) buildings.push(placed);
  }

  const tavern = buildings.find((b) => b.key === "tavern");
  for (const building of buildings) {
    const def = BUILDING_PLANS.find((entry) => entry.key === building.key);
    addTownfolkForBuilding(chunks, building, def?.roles || [], tavern?.door || null);
  }

  addCivicFixtures(chunks, plan.center, buildings);

  const civic = plan.byDistrict.civic_core || plan.districts[0];
  const routeCenter = { x: civic.x, y: civic.y };
  for (const district of plan.districts) routePath(chunks, bounds, routeCenter, district, protectedTiles);
  for (const building of buildings) {
    const district = plan.byDistrict[building.district] || civic;
    routePath(chunks, bounds, district, building.door, protectedTiles);
  }
  for (const building of buildings) {
    const def = BUILDING_PLANS.find((entry) => entry.key === building.key);
    if (!def?.supplies) continue;
    const consumer = buildings.find((entry) => entry.key === def.supplies);
    if (consumer) routePath(chunks, bounds, building.door, consumer.door, protectedTiles);
  }

  addResourceSpawns(chunks, plan.center, bounds);

  return {
    center: plan.center,
    districts: plan.districts,
    buildings,
  };
}
