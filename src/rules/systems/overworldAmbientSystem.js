import { DungeonState } from "../components/DungeonState.js";
import { Player } from "../components/Player.js";
import { Position } from "../components/Position.js";
import { NamedIdentity } from "../components/NamedIdentity.js";
import { combatSeed, mulberry32 } from "../utils/rng.js";

/** @type {WeakMap<object, { nextTick:number }>} */
const _stateByWorld = new WeakMap();

const HOME_IDENTITIES = new Set(["bed_home", "house_sign", "berry_bush", "herb_patch", "alchemy_bench"]);
const HOME_SOURCE_DB_AT_1_TILE = 42;
const HOME_LINES = Object.freeze([
  Object.freeze({
    far: "you catch a faint, homely hush",
    mid: "you hear a clean breeze carry pine and damp soil",
    near: "you hear a calm homestead breeze all around you",
  }),
  Object.freeze({
    far: "you hear a faint metallic rattle in the distance",
    mid: "you hear a kettle softly rattling over embers",
    near: "you hear a kettle rattling clearly by the fire",
  }),
  Object.freeze({
    far: "you hear faint birdsong on the wind",
    mid: "you hear birdsong drifting over the yard",
    near: "you hear bright birdsong nearby",
  }),
  Object.freeze({
    far: "you catch a distant rustle of leaves",
    mid: "you hear familiar rustling around your home",
    near: "you hear the leaves rustling around the homestead",
  }),
  Object.freeze({
    far: "you hear a faint, calming hush",
    mid: "you hear a calm hush settling over home",
    near: "you hear a deeply familiar stillness close by",
  }),
]);

/**
 * Emit occasional ambient lines near home features on depth 0.
 * Deterministic selection based on world seed + step + anchor id.
 *
 * @param {import("../../lib/ecs-js/index.js").World} world
 */
export function overworldAmbientSystem(world) {
  let depth = 1;
  for (const [, ds] of world.query(DungeonState)) { depth = ds.currentDepth || 1; break; }
  if (depth !== 0) return;

  let ppos = null;
  for (const [, pos] of world.query(Player, Position)) { ppos = pos; break; }
  if (!ppos) return;

  let nearest = null;
  let nearestPos = null;
  let nearestDist = Infinity;
  for (const [id, pos, ni] of world.query(Position, NamedIdentity)) {
    if (!HOME_IDENTITIES.has(String(ni.identity || ""))) continue;
    const dist = Math.max(Math.abs(pos.x - ppos.x), Math.abs(pos.y - ppos.y));
    if (dist < nearestDist) {
      nearestDist = dist;
      nearest = id;
      nearestPos = pos;
    }
  }
  if (!nearest || nearestDist > 4) return;

  let st = _stateByWorld.get(world);
  if (!st) {
    st = { nextTick: 0 };
    _stateByWorld.set(world, st);
  }
  const step = world.step | 0;
  if (step < st.nextTick) return;

  const r = mulberry32(combatSeed(world.seed, step, nearest | 0, nearestDist | 0, 0x484F4D45));
  const idx = (r() * HOME_LINES.length) | 0;
  const clarity = HOME_LINES[idx] || HOME_LINES[0];
  world.emit?.("ambient:sound", {
    source: "home",
    at: { x: Number(nearestPos?.x || 0) | 0, y: Number(nearestPos?.y || 0) | 0 },
    depth,
    sourceDbAt1Tile: HOME_SOURCE_DB_AT_1_TILE,
    clarity,
    targetId: nearest,
  });
  st.nextTick = step + 28 + ((r() * 22) | 0);
}
