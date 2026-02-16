import { DungeonState } from "../components/DungeonState.js";
import { Player } from "../components/Player.js";
import { Position } from "../components/Position.js";
import { NamedIdentity } from "../components/NamedIdentity.js";
import { combatSeed, mulberry32 } from "../utils/rng.js";

/** @type {WeakMap<object, { nextTick:number }>} */
const _stateByWorld = new WeakMap();

const HOME_IDENTITIES = new Set(["bed_home", "house_sign", "berry_bush", "herb_patch"]);
const HOME_LINES = Object.freeze([
  "A clean breeze carries the scent of pine and damp soil.",
  "Somewhere nearby, a kettle softly rattles over embers.",
  "Birdsong drifts over the yard. You feel your shoulders loosen.",
  "The quiet around your home feels familiar and safe.",
  "A calm hush settles in, broken only by rustling leaves.",
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
  let nearestDist = Infinity;
  for (const [id, pos, ni] of world.query(Position, NamedIdentity)) {
    if (!HOME_IDENTITIES.has(String(ni.identity || ""))) continue;
    const dist = Math.max(Math.abs(pos.x - ppos.x), Math.abs(pos.y - ppos.y));
    if (dist < nearestDist) {
      nearestDist = dist;
      nearest = id;
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
  const text = HOME_LINES[idx] || HOME_LINES[0];
  world.emit?.("ambient:sound", { text, source: "home" });
  st.nextTick = step + 28 + ((r() * 22) | 0);
}
