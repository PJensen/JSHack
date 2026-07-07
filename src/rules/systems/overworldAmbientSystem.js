import { DungeonState } from "../components/DungeonState.js";
import { Position } from "../components/Position.js";
import { NamedIdentity } from "../components/NamedIdentity.js";
import { playerEntity } from "../utils/queries.js";
import { combatSeed, mulberry32 } from "../utils/rng.js";
import { chebyshevScalar } from "../utils/distance.js";

/** @type {WeakMap<object, { nextTick:number, squirrelNextTick:number }>} */
const _stateByWorld = new WeakMap();

const HOME_IDENTITIES = new Set(["bed_home", "house_sign", "berry_bush", "herb_patch", "alchemy_bench"]);
const RATATOSKR_IDENTITY = "ratatoskr";
const HOME_SOURCE_DB_AT_1_TILE = 42;
const RATATOSKR_AUDIBLE_RADIUS = 7;
const RATATOSKR_SOUND_COOLDOWN_TURNS = 320;
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
  for (const [, ds] of world.query(DungeonState)) { depth = ds.currentDepth ?? 1; break; }
  if (depth !== 0) return;

  const _player = playerEntity(world);
  if (!_player) return;
  const ppos = _player.pos;

  let st = _stateByWorld.get(world);
  if (!st) {
    st = { nextTick: 0, squirrelNextTick: 0 };
    _stateByWorld.set(world, st);
  }
  const step = world.step | 0;

  let nearest = null;
  let nearestPos = null;
  let nearestDist = Infinity;
  let nearestRatatoskr = null;
  let nearestRatatoskrPos = null;
  let nearestRatatoskrDist = Infinity;
  for (const [id, pos, ni] of world.query(Position, NamedIdentity)) {
    const identity = String(ni.identity || "");
    if (identity === RATATOSKR_IDENTITY) {
      const dist = chebyshevScalar(pos.x, pos.y, ppos.x, ppos.y);
      if (dist < nearestRatatoskrDist) {
        nearestRatatoskrDist = dist;
        nearestRatatoskr = id;
        nearestRatatoskrPos = pos;
      }
      continue;
    }
    if (!HOME_IDENTITIES.has(identity)) continue;
    const dist = chebyshevScalar(pos.x, pos.y, ppos.x, ppos.y);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearest = id;
      nearestPos = pos;
    }
  }

  if (nearestRatatoskr && nearestRatatoskrDist <= RATATOSKR_AUDIBLE_RADIUS && step >= (st.squirrelNextTick | 0)) {
    world.emit?.("audio:play", {
      key: "ambient:squirrel",
      at: { x: Number(nearestRatatoskrPos?.x || 0) | 0, y: Number(nearestRatatoskrPos?.y || 0) | 0 },
      sourceId: nearestRatatoskr,
    });
    st.squirrelNextTick = step + RATATOSKR_SOUND_COOLDOWN_TURNS;
  }

  if (!nearest || nearestDist > 4) return;
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
