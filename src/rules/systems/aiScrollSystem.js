import { Position } from "../components/Position.js";
import { Faction } from "../components/Faction.js";
import { ItemInfo } from "../components/ItemInfo.js";
import { NamedIdentity } from "../components/NamedIdentity.js";
import { AggroState, AGGRO_LEVELS } from "../components/AggroState.js";
import { Vitality } from "../components/Vitality.js";
import { Unpaid } from "../components/Unpaid.js";
import { Player } from "../components/Player.js";
import { UseIntent } from "../components/Intents/UseIntent.js";
import { MoveIntent } from "../components/Intents/MoveIntent.js";
import { Brain } from "../components/Brain.js";
import { getMonster } from "../data/monsters.js";
import { addToInventory, forEachItem } from "../utils/inventoryFacade.js";
import { forEachInRadius } from "../utils/spatialIndex.js";
import { canActThisTurn } from "../utils/speedGate.js";
import { getScrollReadingQuality } from "../utils/scrollReading.js";
import { emitSafe } from "../utils/emitSafe.js";

const ACTIVE_RADIUS = 32;
const SCAN_RADIUS = 1;
const READABLE_AI_SCROLLS = Object.freeze(new Set([
  "scroll_mass_delirium",
]));

function playerPosition(world) {
  for (const [, , pos] of world.query(Player, Position)) return pos ? { x: pos.x | 0, y: pos.y | 0 } : null;
  return null;
}

function sapientHumanoidDef(world, id) {
  const fac = world.get(id, Faction);
  if (!fac || fac.key !== "enemy") return null;
  const ni = world.get(id, NamedIdentity);
  const def = ni ? getMonster(String(ni.identity || "")) : null;
  if (!def) return null;
  const brain = world.get(id, Brain);
  const intelligence = Number(brain?.intelligence ?? def.intelligence ?? 0);
  if (intelligence < 10) return null;
  if (!Array.isArray(def.tags) || !def.tags.includes("humanoid")) return null;
  return def;
}

function isHunting(world, id) {
  const aggro = world.get(id, AggroState);
  return !!aggro && aggro.alertLevel === AGGRO_LEVELS.hunting;
}

function floorScrollIdentity(world, itemId) {
  if (!world.isAlive(itemId)) return "";
  if (!world.has(itemId, Position)) return "";
  if (world.get(itemId, Vitality)) return "";
  if (world.get(itemId, Unpaid)) return "";
  const info = world.get(itemId, ItemInfo);
  if (!info || String(info.type || "") !== "scroll") return "";
  return String(world.get(itemId, NamedIdentity)?.identity || "");
}

export function aiScrollPickupSystem(world) {
  const ppos = playerPosition(world);
  if (!ppos) return;

  forEachInRadius(world, ppos.x, ppos.y, ACTIVE_RADIUS, (id, pos) => {
    const def = sapientHumanoidDef(world, id);
    if (!def || !isHunting(world, id)) return;
    if (!canActThisTurn(world, id)) return;
    if (world.has(id, MoveIntent) || world.has(id, UseIntent)) return;

    let scrollId = 0;
    forEachInRadius(world, pos.x | 0, pos.y | 0, SCAN_RADIUS, (itemId) => {
      if (scrollId > 0) return;
      const identity = floorScrollIdentity(world, itemId);
      if (!READABLE_AI_SCROLLS.has(identity)) return;
      scrollId = itemId | 0;
    });
    if (!(scrollId > 0)) return;
    if (!addToInventory(world, id, scrollId, { silent: true })) return;

    emitSafe(world, "pickup", { id, itemId: scrollId, at: { x: pos.x | 0, y: pos.y | 0 } });
    emitSafe(world, "message", { text: `The ${def.name} snatches up a scroll!`, kind: "warning" });
  });
}

export function aiScrollUseSystem(world) {
  const ppos = playerPosition(world);
  if (!ppos) return;

  forEachInRadius(world, ppos.x, ppos.y, ACTIVE_RADIUS, (id) => {
    const def = sapientHumanoidDef(world, id);
    if (!def || !isHunting(world, id)) return;
    if (!canActThisTurn(world, id)) return;
    if (world.has(id, MoveIntent) || world.has(id, UseIntent)) return;
    if (!getScrollReadingQuality(world, id).canRead) return;

    let scrollId = 0;
    forEachItem(world, id, (itemId) => {
      const info = world.get(itemId, ItemInfo);
      if (!info || String(info.type || "") !== "scroll") return;
      const identity = String(world.get(itemId, NamedIdentity)?.identity || "");
      if (!READABLE_AI_SCROLLS.has(identity)) return;
      scrollId = itemId | 0;
      return false;
    });
    if (!(scrollId > 0)) return;

    world.add(id, UseIntent, { itemId: scrollId, targetId: id });
    emitSafe(world, "monster:read-scroll", { monsterId: id, monsterName: def.name, itemId: scrollId });
  });
}
