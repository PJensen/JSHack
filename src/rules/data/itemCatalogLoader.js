import { getCatalogItem } from "./itemCatalog.js";
import { Beatitude } from "../components/Beatitude.js";
import { ItemInfo } from "../components/ItemInfo.js";
import { Material } from "../components/Material.js";
import { NamedIdentity } from "../components/NamedIdentity.js";
import { Potion } from "../components/Potion.js";
import { attachProcPackage } from "./procPackages.js";
import { ScriptRef } from "../components/ScriptRef.js";

/**
 * Build an item entity from the unified item catalog.
 * @param {import("../../lib/ecs-js/index.js").World} world
 * @param {string} itemId
 * @param {{ affixes?: string[], count?: number }} [opts]
 */
export function buildCatalogItem(world, itemId, opts = {}) {
  const def = getCatalogItem(itemId);
  if (!def) throw new Error(`Unknown item id: ${itemId}`);

  const isEquip = String(def.catalogKind || "") === "equipment";
  const explicitCount = Number(opts.count || 0) | 0;
  const count = explicitCount > 0
    ? explicitCount
    : (isEquip ? 1 : Math.max(1, Number(def.charges || 1) | 0));

  const id = world.create();
  world.add(id, NamedIdentity, { name: def.name, identity: def.id });

  const info = {
    type: def.type || (isEquip ? "equip" : "item"),
    slot: def.slot || "",
    weight: Number(def.weight || 1),
    value: Number(def.value || 0),
    description: def.description || def.desc || def.name || "",
    count,
    bonuses: def.bonuses || {},
    twoHanded: def.twoHanded || false,
    rarity: def.rarity || 1,
    rarityName: def.rarityName || "common",
    affixes: [...new Set([
      ...(Array.isArray(def.affixes) ? def.affixes : []),
      ...(Array.isArray(opts.affixes) ? opts.affixes : []),
    ])],
    sockets: [],
    maxSockets: Number(def.maxSockets || 0) | 0,
    damageDice: def.damageDice || null,
    damageType: def.damageType || null,
    staminaCost: def.staminaCost ?? null,
    subtype: def.subtype || null,
    range: def.range || null,
    identified: def.identified === true,
    noQuickChip: def.noQuickChip === true,
    tags: Array.isArray(def.tags) ? def.tags.slice() : [],
  };
  world.add(id, ItemInfo, info);

  if (String(def.type || "").toLowerCase() === "potion") {
    const potionDef = (def.potion && typeof def.potion === "object") ? def.potion : {};
    const beatitude = String(potionDef.beatitude || def.beatitude || "").toLowerCase();
    world.add(id, Potion, {
      name: String(def.name || potionDef.name || "Potion"),
      route: String(potionDef.route || "oral"),
      doses: Math.max(1, Number(potionDef.doses ?? count) | 0),
      channels: Array.isArray(potionDef.channels) ? potionDef.channels.slice() : [],
      effects: Array.isArray(potionDef.effects) ? potionDef.effects.map((e) => ({ ...e })) : [],
      toxicity: (potionDef.toxicity && typeof potionDef.toxicity === "object") ? { ...potionDef.toxicity } : null,
      feel: String(potionDef.feel || ""),
    });
    if (beatitude === "blessed" || beatitude === "uncursed" || beatitude === "cursed") {
      world.add(id, Beatitude, { state: beatitude });
    }
  }

  // General beatitude for non-potion items (e.g. cursed rings, blessed armor)
  if (String(def.type || "").toLowerCase() !== "potion") {
    const beatitude = String(def.beatitude || "").toLowerCase();
    if (beatitude === "blessed" || beatitude === "uncursed" || beatitude === "cursed") {
      world.add(id, Beatitude, { state: beatitude });
    }
  }

  if (typeof def.material === "string" && def.material) {
    world.add(id, Material, { kind: def.material });
  }
  if (typeof def.script === "string" && def.script) {
    world.add(id, ScriptRef, { ref: def.script, params: { from: def.id } });
  }

  const procPackages = [...new Set([
    ...(Array.isArray(def.procPackages) ? def.procPackages : []),
    ...(Array.isArray(opts.procPackages) ? opts.procPackages : []),
  ])];
  for (let i = 0; i < procPackages.length; i++) {
    attachProcPackage(world, id, procPackages[i]);
  }

  return id;
}
