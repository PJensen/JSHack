// cloud/wiring/proofWiring.js
// Wires the game proof recorder into the ECS lifecycle.
// Follows the same Symbol-guarded install pattern as deathShareWiring.js.

import { createGameProof } from "../proof/gameProof.js";
import { Player } from "../../rules/components/Player.js";
import { Score } from "../../rules/components/Score.js";
import { DungeonState } from "../../rules/components/DungeonState.js";
import { NamedIdentity } from "../../rules/components/NamedIdentity.js";
import { getClass } from "../../rules/data/classes.js";
import { getRuntimeVersionMeta } from "../tombstones/client.js";

const INSTALLED_KEY = Symbol.for("jshack:proof:wiring:installed");

/**
 * Install proof recording wiring on the world.
 * Call once, after world creation, before the first tick.
 *
 * @param {{ world: import("../../lib/ecs-js/index.js").World }} deps
 * @returns {{ recordAction: (turn:number, type:string, payload:object) => void, getProof: () => object|null }}
 */
export function installProofWiring({ world }) {
  const noop = { recordAction() {}, getProof: () => null };
  if (!world || world[INSTALLED_KEY]) return noop;
  world[INSTALLED_KEY] = true;

  let _recorder = null;
  let _finalBundle = null;

  function _ensureRecorder() {
    if (_recorder) return;
    _recorder = createGameProof(world.seed);
  }

  /**
   * Record a player action. Called from the rulesDispatch onAction hook.
   * Lazy-initializes the recorder on first call.
   */
  function recordAction(turn, type, payload) {
    _ensureRecorder();
    _recorder.record(turn, type, payload);
  }

  // On player death: finalize the proof bundle.
  world.on("died", ({ id }) => {
    if (!world.has(id, Player)) return;
    if (!_recorder) return;

    let depth = 1;
    for (const [, ds] of world.query(DungeonState)) {
      depth = ds.currentDepth || 1;
      break;
    }

    const sc = world.get(id, Score);
    const score = sc?.current ?? 0;

    const ni = world.get(id, NamedIdentity);
    const identity = ni?.identity ?? "";
    const classId = identity.startsWith("player_") ? identity.slice(7) : null;
    const className = classId ? (getClass(classId)?.name ?? null) : null;

    const { versionText } = getRuntimeVersionMeta();

    _recorder
      .finalize({
        score,
        depth,
        turns: world.step || 0,
        playerName: ni?.name || null,
        playerClass: className,
        engineVersion: versionText || null,
      })
      .then((bundle) => {
        _finalBundle = bundle;
        world.emit("proof:ready", { bundle });
      })
      .catch((err) => {
        console.error("[proof] finalize error:", err);
      });
  });

  /**
   * Reset the recorder (e.g. after loading a savegame).
   */
  function resetForLoad() {
    _recorder = createGameProof(world.seed, { resumedFromSave: true });
    _finalBundle = null;
  }

  return {
    recordAction,
    getProof: () => _finalBundle,
    resetForLoad,
  };
}
