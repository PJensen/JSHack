import { Player } from "../../rules/components/Player.js";
import { Score } from "../../rules/components/Score.js";
import { NamedIdentity } from "../../rules/components/NamedIdentity.js";
import { DungeonState } from "../../rules/components/DungeonState.js";
import { ItemInfo } from "../../rules/components/ItemInfo.js";
import { Equipment, GEAR_SLOTS } from "../../rules/components/Equipment.js";
import { Brain } from "../../rules/components/Brain.js";
import { Traits } from "../../rules/components/Traits.js";
import { Devotion } from "../../rules/components/Devotion.js";
import { CalendarState } from "../../rules/components/CalendarState.js";
import { inventoryItems } from "../../rules/utils/inventoryFacade.js";
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

  // Most valuable item (by value, non-gold)
  let bestItemName = null;
  let bestItemValue = 0;
  for (const itemId of inventoryItems(world, playerId)) {
    const ni = world.get(itemId, NamedIdentity);
    if (ni?.identity === "gold") continue;
    const info = world.get(itemId, ItemInfo);
    const v = Number(info?.value || 0);
    if (v > bestItemValue) {
      bestItemValue = v;
      bestItemName = ni?.name || null;
    }
  }
  // Also check equipped gear
  const eq = world.get(playerId, Equipment);
  if (eq) {
    for (const slot of GEAR_SLOTS) {
      const eid = eq[slot];
      if (!(eid > 0) || !world.isAlive(eid)) continue;
      const ni = world.get(eid, NamedIdentity);
      const info = world.get(eid, ItemInfo);
      const v = Number(info?.value || 0);
      if (v > bestItemValue) {
        bestItemValue = v;
        bestItemName = ni?.name || null;
      }
    }
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

  // Days survived
  let days = 0;
  for (const [, cs] of world.query(CalendarState)) {
    days = cs.dayTotal || 0;
    break;
  }

  return { gold, bestItemName, bestItemValue, spellCount, traitList, deityId, deityName, className, turns, days };
}

/**
 * Build an X/Twitter intent URL for sharing a player death.
 * @param {object} info
 * @returns {string}
 */
export function makeDeathShareLink({ depth, score, killerName, cause, gold, turns, bestItemName, spellCount, deityName, className, traitList }) {
  const GAME_URL = "https://pjensen.github.io/JSHack/";
  // X counts URLs as 23 chars. "\n\n#JSHack" = 10 chars. Total overhead = 33.
  // Budget: 280 - 33 = 247 chars for body text.
  const MAX_BODY = 247;

  // Line 1: who died and how
  const classTag = className ? ` ${className}` : "";
  const slainBy = killerName ? ` by ${killerName}` : cause && cause !== "unknown" ? ` (${cause})` : "";
  let body = `\u2620\uFE0F My${classTag} died${slainBy} on depth ${depth}`;

  // Line 2: score + gold + turns on same line, separated by pipes
  const statBits = [];
  statBits.push(`${score} pts`);
  if (gold > 0) statBits.push(`${gold} gold`);
  statBits.push(`${turns} turns`);
  body += `\n${statBits.join(" | ")}`;

  // Line 3: flavor details, greedily appended
  const flavor = [];
  if (spellCount > 0) flavor.push(`${spellCount} spell${spellCount === 1 ? "" : "s"} learned`);
  if (deityName) flavor.push(`Follower of ${deityName}`);
  if (bestItemName) flavor.push(`Best item: ${bestItemName}`);
  if (traitList && traitList.length > 0) {
    for (const t of traitList) flavor.push(t);
  }

  if (flavor.length > 0) {
    for (const f of flavor) {
      const next = body + `\n${f}`;
      if (next.length > MAX_BODY) break;
      body = next;
    }
  }

  const text = encodeURIComponent(`${body}\n\n#JSHack`);
  const url = encodeURIComponent(GAME_URL);
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
