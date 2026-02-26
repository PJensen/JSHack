import { Player } from "../../rules/components/Player.js";
import { Score } from "../../rules/components/Score.js";
import { NamedIdentity } from "../../rules/components/NamedIdentity.js";
import { DungeonState } from "../../rules/components/DungeonState.js";

const INSTALLED_KEY = Symbol.for("jshack:main:deathShareWiring:installed");
const EVENT_TARGET = /** @type {EventTarget} */ (globalThis);

/**
 * Build an X/Twitter intent URL for sharing a player death.
 * @param {{ depth: number, score: number, seed: number, killerName?: string|null, cause?: string }} info
 * @returns {string}
 */
export function makeDeathShareLink({ depth, score, seed, killerName, cause }) {
  const seedHex = seed ? seed.toString(16).toUpperCase() : "???";
  const slainBy = killerName ? ` by ${killerName}` : cause ? ` (${cause})` : "";
  const text = encodeURIComponent(
    `\u2620\uFE0F I perished at Depth ${depth}${slainBy} with ${score} points! Seed 0x${seedHex} #JS-Hack`
  );
  const loc = globalThis.location;
  const base = loc ? `${loc.origin}${loc.pathname}` : "http://localhost/";
  const qs = new URLSearchParams({
    d: String(depth),
    s: String(score),
    seed: seedHex,
    ...(killerName ? { k: killerName } : {}),
    ...(cause && cause !== "unknown" ? { c: cause } : {}),
  });
  const url = encodeURIComponent(`${base}?${qs}`);
  return `https://x.com/intent/tweet?text=${text}&url=${url}`;
}

/**
 * Installs display-side death share wiring.
 * @param {{ world: import("../../lib/ecs-js/index.js").World }} deps
 */
export function installDeathShareWiring({ world }) {
  if (!world || world[INSTALLED_KEY]) return;
  world[INSTALLED_KEY] = true;

  world.on("died", ({ id, killer, cause }) => {
    if (!world.has(id, Player)) return;

    const score = world.get(id, Score);
    let depth = 1;
    let seed = 0;
    for (const [, ds] of world.query(DungeonState)) {
      depth = ds.currentDepth || 1;
      seed = ds.worldSeed || 0;
      break;
    }

    let killerName = null;
    if (killer) {
      const ki = world.get(killer, NamedIdentity);
      if (ki) killerName = ki.name;
    }

    const shareUrl = makeDeathShareLink({
      depth,
      score: score?.current ?? 0,
      seed,
      killerName,
      cause,
    });

    EVENT_TARGET.dispatchEvent(new CustomEvent("ui:playerDied", {
      detail: {
        depth,
        score: score?.current ?? 0,
        seed,
        killerName,
        cause,
        shareUrl,
      },
    }));
  });
}
