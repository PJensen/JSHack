import { Inventory } from "../components/Inventory.js";
import { ItemInfo } from "../components/ItemInfo.js";
import { Material } from "../components/Material.js";
import { NamedIdentity } from "../components/NamedIdentity.js";
import { Position } from "../components/Position.js";
import { Status } from "../components/Status.js";

const SEEN_KEY = Symbol.for("jshack:materialReactions:seenPerStep");

/**
 * @typedef {{
 *   id: string,
 *   when: (info:any, mat:any) => boolean,
 *   apply: (world:any, id:number, info:any, mat:any) => void,
 * }} MaterialReaction
 */

/**
 * @typedef {{
 *   id: string,
 *   sourceStatuses: string[],
 *   itemScopes: Array<"ground"|"inventory">,
 *   eventKind: string,
 *   reactions: MaterialReaction[],
 * }} MaterialReactionRule
 */

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

/** @type {MaterialReaction[]} */
const ITEM_REACTIONS = [
  {
    id: "paper_scroll_to_ash",
    when: (info, mat) => String(info?.type || "") === "scroll" && String(mat?.kind || "") === "paper",
    apply: transmuteToAsh,
  },
];

/** @type {MaterialReactionRule[]} */
const MATERIAL_REACTION_RULES = [
  {
    id: "burning_items_combust",
    sourceStatuses: ["burning", "burn"],
    itemScopes: ["ground", "inventory"],
    eventKind: "burning",
    reactions: ITEM_REACTIONS,
  },
];

/**
 * @param {import("../../lib/ecs-js/index.js").World} world
 * @param {number} itemId
 * @param {any} info
 * @param {any} mat
 * @param {number} sourceId
 * @param {{x:number,y:number}} sourcePos
 * @param {Set<string|number>} seen
 * @param {MaterialReactionRule} rule
 */
function reactItem(world, itemId, info, mat, sourceId, sourcePos, seen, rule) {
  if (!(itemId > 0) || !world.isAlive(itemId)) return false;
  const seenKey = `${rule.id}:${itemId}`;
  if (seen.has(seenKey)) return false;

  for (let i = 0; i < rule.reactions.length; i++) {
    const reaction = rule.reactions[i];
    if (!reaction.when(info, mat)) continue;

    reaction.apply(world, itemId, info, mat);
    seen.add(seenKey);
    try {
      world.emit?.("item:burned", {
        itemId,
        source: sourceId,
        kind: rule.eventKind,
        rule: rule.id,
        reaction: reaction.id,
        at: { x: sourcePos.x | 0, y: sourcePos.y | 0 },
        result: "ash",
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
