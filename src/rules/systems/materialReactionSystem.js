import { Inventory } from "../components/Inventory.js";
import { ItemInfo } from "../components/ItemInfo.js";
import { Material } from "../components/Material.js";
import { NamedIdentity } from "../components/NamedIdentity.js";
import { Position } from "../components/Position.js";
import { Status } from "../components/Status.js";
import { MATERIAL_REACTION_RULES } from "../data/materialReactions.js";

const SEEN_KEY = Symbol.for("jshack:materialReactions:seenPerStep");

/**
 * @param {import("../../lib/ecs-js/index.js").World} world
 */
function ensureSeenState(world) {
  const rec = world[SEEN_KEY];
  if (rec && typeof rec === "object" && rec.ids instanceof Set) return rec;
  const created = { step: -1, ids: new Set() };
  world[SEEN_KEY] = created;
  return created;
}

/**
 * @param {any} status
 * @param {string[]} statusTypes
 */
function hasAnyStatus(status, statusTypes) {
  if (!status || !Array.isArray(status.statuses) || !Array.isArray(statusTypes) || statusTypes.length === 0) return false;
  const wanted = new Set(statusTypes.map((s) => String(s || "").toLowerCase()).filter(Boolean));
  if (wanted.size === 0) return false;
  return status.statuses.some((s) => {
    const type = String(s?.type || "").toLowerCase();
    const duration = Number(s?.duration || 0) | 0;
    return duration > 0 && wanted.has(type);
  });
}

function transmuteToAsh(world, id, info, mat) {
  const ni = world.get(id, NamedIdentity);
  if (ni) {
    ni.name = "Ash";
    ni.identity = "ash";
  } else {
    world.add(id, NamedIdentity, { name: "Ash", identity: "ash" });
  }

  info.type = "junk";
  info.slot = "bag";
  info.description = "A small pile of ash.";
  info.weight = 0.05;
  info.value = 0;
  info.count = Math.max(1, Number(info.count || 1) | 0);
  info.affixes = [];
  info.bonuses = {};
  info.damageDice = null;
  info.staminaCost = null;
  info.subtype = null;
  info.range = null;
  info.rarity = 1;
  info.rarityName = "common";

  if (mat) mat.kind = "sand";
  else world.add(id, Material, { kind: "sand" });
}

/**
 * @param {any} info
 * @param {any} mat
 * @param {string} identity
 * @param {{ itemTypes?: string[], materials?: string[], identities?: string[] }} match
 */
function matchesReaction(info, mat, identity, match) {
  if (!match || typeof match !== "object") return false;

  const type = String(info?.type || "").toLowerCase();
  const kind = String(mat?.kind || "").toLowerCase();
  const normalizedIdentity = String(identity || "").toLowerCase();

  const itemTypes = Array.isArray(match.itemTypes)
    ? match.itemTypes.map((v) => String(v || "").toLowerCase()).filter(Boolean)
    : [];
  const materials = Array.isArray(match.materials)
    ? match.materials.map((v) => String(v || "").toLowerCase()).filter(Boolean)
    : [];
  const identities = Array.isArray(match.identities)
    ? match.identities.map((v) => String(v || "").toLowerCase()).filter(Boolean)
    : [];

  if (itemTypes.length > 0 && !itemTypes.includes(type)) return false;
  if (materials.length > 0 && !materials.includes(kind)) return false;
  if (identities.length > 0 && !identities.includes(normalizedIdentity)) return false;

  return itemTypes.length > 0 || materials.length > 0 || identities.length > 0;
}

/**
 * @param {import("../../lib/ecs-js/index.js").World} world
 * @param {number} itemId
 * @param {any} info
 * @param {any} mat
 * @param {string} outcome
 */
function applyReactionOutcome(world, itemId, info, mat, outcome) {
  if (outcome === "transmute_to_ash") {
    transmuteToAsh(world, itemId, info, mat);
    return true;
  }
  return false;
}

/**
 * @param {import("../../lib/ecs-js/index.js").World} world
 * @param {number} itemId
 * @param {any} info
 * @param {any} mat
 * @param {number} sourceId
 * @param {{x:number,y:number}} sourcePos
 * @param {Set<string|number>} seen
 * @param {any} rule
 */
function reactItem(world, itemId, info, mat, sourceId, sourcePos, seen, rule) {
  if (!(itemId > 0) || !world.isAlive(itemId)) return false;
  const seenKey = `${rule.id}:${itemId}`;
  if (seen.has(seenKey)) return false;
  const ni = world.get(itemId, NamedIdentity);
  const identity = String(ni?.identity || "");

  for (let i = 0; i < rule.reactions.length; i++) {
    const reaction = rule.reactions[i];
    if (!matchesReaction(info, mat, identity, reaction.match)) continue;
    if (!applyReactionOutcome(world, itemId, info, mat, reaction.outcome)) continue;

    seen.add(seenKey);
    try {
      world.emit?.("item:burned", {
        itemId,
        source: sourceId,
        kind: rule.eventKind,
        rule: rule.id,
        reaction: reaction.id,
        at: { x: sourcePos.x | 0, y: sourcePos.y | 0 },
        result: String(reaction.result || "changed"),
      });
    } catch { /* */ }
    return true;
  }

  return false;
}

/**
 * Effects-phase material reaction pass.
 * Uses semantic status state instead of source-specific spell/event wiring.
 * @param {import('../../lib/ecs-js/index.js').World} world
 */
export function materialReactionSystem(world) {
  const seenState = ensureSeenState(world);
  const step = world.step | 0;
  if (seenState.step !== step) {
    seenState.step = step;
    seenState.ids.clear();
  }
  const seen = seenState.ids;

  for (const [sourceId, sourcePos, sourceStatus] of world.query(Position, Status)) {
    for (let r = 0; r < MATERIAL_REACTION_RULES.length; r++) {
      const rule = MATERIAL_REACTION_RULES[r];
      if (!hasAnyStatus(sourceStatus, rule.sourceStatuses)) continue;

      for (let s = 0; s < rule.itemScopes.length; s++) {
        const scope = rule.itemScopes[s];
        if (scope === "ground") {
          // Floor items on the same tile as the source.
          for (const [itemId, itemPos, info, mat] of world.query(Position, ItemInfo, Material)) {
            if (itemPos.x !== sourcePos.x || itemPos.y !== sourcePos.y) continue;
            reactItem(world, itemId, info, mat, sourceId, sourcePos, seen, rule);
          }
          continue;
        }

        if (scope === "inventory") {
          // Carried items while source has the triggering status.
          const inv = world.get(sourceId, Inventory);
          if (!inv || !Array.isArray(inv.items)) continue;
          for (let i = 0; i < inv.items.length; i++) {
            const itemId = Number(inv.items[i] || 0) | 0;
            if (!(itemId > 0) || !world.isAlive(itemId)) continue;
            const info = world.get(itemId, ItemInfo);
            const mat = world.get(itemId, Material);
            if (!info || !mat) continue;
            reactItem(world, itemId, info, mat, sourceId, sourcePos, seen, rule);
          }
        }
      }
    }
  }
}
