import { Player } from "../../rules/components/Player.js";
import { Score } from "../../rules/components/Score.js";
import { NamedIdentity } from "../../rules/components/NamedIdentity.js";
import { DungeonState } from "../../rules/components/DungeonState.js";
import { ItemInfo } from "../../rules/components/ItemInfo.js";
import { Equipment, GEAR_SLOTS } from "../../rules/components/Equipment.js";
import { Brain } from "../../rules/components/Brain.js";
import { Traits } from "../../rules/components/Traits.js";
import { Devotion } from "../../rules/components/Devotion.js";
import { ActiveEffects } from "../../rules/components/ActiveEffects.js";
import { inventoryItems } from "../../rules/utils/inventoryFacade.js";
import { TURNS_PER_DAY } from "../../rules/data/calendar.js";
import { getClass } from "../../rules/data/classes.js";
import { getDeity } from "../../rules/data/deities.js";

const INSTALLED_KEY = Symbol.for("jshack:main:deathShareWiring:installed");
const EVENT_TARGET = /** @type {EventTarget} */ (globalThis);

/** Collect extended stats from the dying player entity. */
function gatherDeathStats(world, playerId) {
  // Gold
  let gold = 0;
  for (const itemId of inventoryItems(world, playerId)) {
    const ni = world.get(itemId, NamedIdentity);
    if (ni?.identity === "gold") {
      const info = world.get(itemId, ItemInfo);
      gold += Math.max(1, Number(info?.count || 0) | 0);
    }
  }

  // Equipped weapon name
  let weaponName = null;
  const eq = world.get(playerId, Equipment);
  if (eq && eq.weapon > 0 && world.isAlive(eq.weapon)) {
    const ni = world.get(eq.weapon, NamedIdentity);
    if (ni) weaponName = ni.name;
  }

  // Spells learned
  const brain = world.get(playerId, Brain);
  const spellCount = brain?.learnedSpellIds?.length || 0;

  // Traits
  const traits = world.get(playerId, Traits);
  const traitList = [];
  if (traits) {
    if (traits.ambidextrous) traitList.push("Ambidextrous");
    if (traits.gluttonous) traitList.push("Gluttonous");
    if (traits.iron_stomach) traitList.push("Iron Stomach");
    if (traits.ratCorpsesEaten > 0) traitList.push(`Ate ${traits.ratCorpsesEaten} rat corpse${traits.ratCorpsesEaten === 1 ? "" : "s"}`);
  }

  // Deity — resolve display name
  const devotion = world.get(playerId, Devotion);
  const deityId = devotion?.deityId || null;
  const deityName = deityId ? (getDeity(deityId)?.name ?? deityId) : null;

  // Class — extract from player identity (player_warden → Warden)
  const playerNi = world.get(playerId, NamedIdentity);
  const identity = playerNi?.identity ?? "";
  const classId = identity.startsWith("player_") ? identity.slice(7) : null;
  const className = classId ? (getClass(classId)?.name ?? null) : null;

  // Turns survived
  const turns = world.step || 0;

  // Days survived (from turns, not calendar dayTotal which includes startDay offset)
  const days = Math.floor(turns / TURNS_PER_DAY);

  // Player name
  const playerName = playerNi?.name || null;

  // Active status effects at time of death
  const ae = world.get(playerId, ActiveEffects);
  const statusList = ae?.effects?.length > 0
    ? ae.effects.map(e => e.key).filter(Boolean)
    : [];

  return { gold, weaponName, spellCount, traitList, statusList, deityId, deityName, className, playerName, turns, days };
}

/**
 * Build an X/Twitter intent URL for sharing a player death.
 * @param {object} info
 * @returns {string}
 */
export function makeDeathShareLink({ depth, score, seed, killerName, cause, gold, turns, weaponName, spellCount, deityName, className, playerName, statusList, traitList }) {
  const GAME_URL = "https://pjensen.github.io/JSHack/";
  const seedHex = seed ? seed.toString(16).toUpperCase() : "???";

  // X always counts a URL as 23 chars. The URL is ALWAYS included.
  // Suffix: "\n\n#JSHack" (10 chars) + URL placeholder (23 chars) + "\n" (1 char) = 34
  // Budget for body text: 280 - 34 = 246 chars.
  const MAX_BODY = 246;

  // Line 1: who died and how
  const who = playerName && playerName !== "Unnamed"
    ? `${playerName}${className ? ` the ${className}` : ""}`
    : className || "adventurer";
  const slainBy = killerName ? ` by ${killerName}` : cause && cause !== "unknown" ? ` (${cause})` : "";
  let body = `\u2620\uFE0F ${who} died${slainBy} on depth ${depth}`;

  // Line 2: score + gold + turns
  const statBits = [];
  statBits.push(`${score} pts`);
  if (gold > 0) statBits.push(`${gold} gold`);
  statBits.push(`${turns} turns`);
  body += `\n${statBits.join(" | ")}`;

  // Flavor details, greedily appended line by line (most interesting first)
  const flavor = [];
  if (traitList && traitList.length > 0) flavor.push(traitList.join(", "));
  if (weaponName) flavor.push(`Wielding: ${weaponName}`);
  if (deityName) flavor.push(`Follower of ${deityName}`);
  if (spellCount > 0) flavor.push(`${spellCount} spell${spellCount === 1 ? "" : "s"} learned`);
  if (statusList && statusList.length > 0) flavor.push(`Status: ${statusList.join(", ")}`);

  for (const f of flavor) {
    const next = body + `\n${f}`;
    if (next.length > MAX_BODY) break;
    body = next;
  }

  const text = encodeURIComponent(`${body}\n\n#JSHack`);
  const qs = new URLSearchParams({ seed: seedHex });
  const url = encodeURIComponent(`${GAME_URL}?${qs}`);
  return `https://x.com/intent/tweet?text=${text}&url=${url}`;
}

/**
 * Installs display-side death share wiring.
 * @param {{ world: import("../../lib/ecs-js/index.js").World }} deps
 */
export function installDeathShareWiring({ world }) {
  if (!world || world[INSTALLED_KEY]) return;
  world[INSTALLED_KEY] = true;

  let _pendingDeathDetail = null;

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

    const stats = gatherDeathStats(world, id);
    const scoreVal = score?.current ?? 0;

    const shareUrl = makeDeathShareLink({
      depth, score: scoreVal, seed, killerName, cause,
      ...stats,
    });

    _pendingDeathDetail = {
      depth, score: scoreVal, seed, killerName, cause, shareUrl,
      ...stats,
    };
  });

  world.on("postMortemComplete", () => {
    if (!_pendingDeathDetail) return;
    EVENT_TARGET.dispatchEvent(new CustomEvent("ui:playerDied", {
      detail: _pendingDeathDetail,
    }));
    _pendingDeathDetail = null;
  });
}
