// rules/data/gemSocketAffixes.js
// Registers affix definitions and passive scripts for gem socket affixes.
// Provides attachGemSocketNodes() for attaching proc topology to a weapon.
// Call installGemSocketListener(world) once during world setup.

import { registerAffixDefinition } from "./affixes.js";
import { registerScript, ScriptVerb } from "../scripting.js";
import {
  addAttachedComponent,
  attachProcNode,
  gateEventKind,
  gateChance,
  effectApplyStatus,
  effectBonusDamageFlat,
  effectRestoreResource,
  effectAddCritChance,
} from "../utils/statProcAuthoring.js";
import { GemSocketNode } from "../components/GemSocketNode.js";

// ── Passive script keys ──────────────────────────────────────────
const S_RUBY     = "gem_socket:ruby:passive";
const S_SAPPHIRE = "gem_socket:sapphire:passive";
const S_EMERALD  = "gem_socket:emerald:passive";
const S_DIAMOND  = "gem_socket:diamond:passive";
const S_TOPAZ    = "gem_socket:topaz:passive";
const S_AMETHYST = "gem_socket:amethyst:passive";
const S_OPAL     = "gem_socket:opal:passive";
const S_OBSIDIAN = "gem_socket:obsidian:passive";
const S_GARNET   = "gem_socket:garnet:passive";
const S_JACINTH  = "gem_socket:jacinth:passive";
const S_AQUAMARINE = "gem_socket:aquamarine:passive";

// ── Register passive scripts ─────────────────────────────────────
registerScript(S_RUBY,     { [ScriptVerb.AffixPassive]: (_w, ctx) => ctx.addBonus("fireResist", 0.10) });
registerScript(S_SAPPHIRE, { [ScriptVerb.AffixPassive]: (_w, ctx) => ctx.addBonus("evade", 1) });
registerScript(S_EMERALD,  { [ScriptVerb.AffixPassive]: (_w, ctx) => ctx.addBonus("poisonResist", 0.10) });
registerScript(S_DIAMOND,  { [ScriptVerb.AffixPassive]: (_w, ctx) => { ctx.addBonus("accuracy", 2); ctx.addBonus("damagePower", 2); ctx.addBonus("evade", 2); } });
registerScript(S_TOPAZ,    { [ScriptVerb.AffixPassive]: (_w, ctx) => ctx.addBonus("accuracy", 1) });
registerScript(S_AMETHYST, { [ScriptVerb.AffixPassive]: (_w, ctx) => ctx.addBonus("manaRegen", 1) });
registerScript(S_OPAL,     { [ScriptVerb.AffixPassive]: (_w, ctx) => ctx.addBonus("luck", 1) });
registerScript(S_OBSIDIAN, { [ScriptVerb.AffixPassive]: (_w, ctx) => ctx.addBonus("kineticDR", 2) });
registerScript(S_GARNET,   { [ScriptVerb.AffixPassive]: (_w, ctx) => ctx.addBonus("fireResist", 0.20) });
registerScript(S_JACINTH,  { [ScriptVerb.AffixPassive]: (_w, ctx) => ctx.addBonus("acidResist", 0.10) });
registerScript(S_AQUAMARINE, { [ScriptVerb.AffixPassive]: (_w, ctx) => ctx.addBonus("manaRegen", 0.5) });

// ── Register affix definitions (weight:0 = not randomly generated) ──
[
  ["gem_socket:ruby",       { name: "Ruby Socket",       slots: ["weapon", "armor"], weight: 0, passiveRefs: [S_RUBY] }],
  ["gem_socket:sapphire",   { name: "Sapphire Socket",   slots: ["weapon", "armor"], weight: 0, passiveRefs: [S_SAPPHIRE] }],
  ["gem_socket:emerald",    { name: "Emerald Socket",    slots: ["weapon", "armor"], weight: 0, passiveRefs: [S_EMERALD] }],
  ["gem_socket:diamond",    { name: "Diamond Socket",    slots: ["weapon", "armor"], weight: 0, passiveRefs: [S_DIAMOND] }],
  ["gem_socket:topaz",      { name: "Topaz Socket",      slots: ["weapon", "armor"], weight: 0, passiveRefs: [S_TOPAZ] }],
  ["gem_socket:amethyst",   { name: "Amethyst Socket",   slots: ["weapon", "armor"], weight: 0, passiveRefs: [S_AMETHYST] }],
  ["gem_socket:opal",       { name: "Opal Socket",       slots: ["weapon", "armor"], weight: 0, passiveRefs: [S_OPAL] }],
  ["gem_socket:obsidian",   { name: "Obsidian Socket",   slots: ["weapon", "armor"], weight: 0, passiveRefs: [S_OBSIDIAN] }],
  ["gem_socket:garnet",     { name: "Garnet Socket",     slots: ["weapon", "armor"], weight: 0, passiveRefs: [S_GARNET] }],
  ["gem_socket:jacinth",    { name: "Jacinth Socket",    slots: ["weapon", "armor"], weight: 0, passiveRefs: [S_JACINTH] }],
  ["gem_socket:aquamarine", { name: "Aquamarine Socket", slots: ["weapon", "armor"], weight: 0, passiveRefs: [S_AQUAMARINE] }],
].forEach(([id, spec]) => registerAffixDefinition(id, spec));

// ── Proc builders — gems that trigger on-hit effects ─────────────
// Structure: weapon → GemSocketNode → ProcNode → gates + effects
// GemSocketNode is NOT an AffixTopologyNode so destroyAffixChildren leaves it intact.
// gatherItemProcNodes DFS finds ProcNode through the full subtree.
const GEM_PROC_BUILDERS = {
  gem_ruby(world, weaponId, socketNodeId) {
    attachProcNode(world, socketNodeId, {
      gates: [gateEventKind("onHit"), gateChance(0.25)],
      effects: [effectApplyStatus("burning", 3, 2)],
    });
  },
  gem_sapphire(world, weaponId, socketNodeId) {
    attachProcNode(world, socketNodeId, {
      gates: [gateEventKind("onHit"), gateChance(0.20)],
      effects: [effectApplyStatus("frost", 3, 1)],
    });
  },
  gem_emerald(world, weaponId, socketNodeId) {
    attachProcNode(world, socketNodeId, {
      gates: [gateEventKind("onHit"), gateChance(0.20)],
      effects: [effectApplyStatus("poison", 4, 2)],
    });
  },
  gem_topaz(world, weaponId, socketNodeId) {
    attachProcNode(world, socketNodeId, {
      gates: [gateEventKind("onHit"), gateChance(0.20)],
      effects: [effectApplyStatus("shock", 2, 1)],
    });
  },
  // Previously passive-only gems now also have on-hit procs
  gem_diamond(world, weaponId, socketNodeId) {
    attachProcNode(world, socketNodeId, {
      gates: [gateEventKind("onHit"), gateChance(0.20)],
      effects: [effectBonusDamageFlat(2, 3, "physical")],
    });
  },
  gem_amethyst(world, weaponId, socketNodeId) {
    attachProcNode(world, socketNodeId, {
      gates: [gateEventKind("onHit"), gateChance(0.20)],
      effects: [effectRestoreResource("mana", 2)],
    });
  },
  gem_opal(world, weaponId, socketNodeId) {
    attachProcNode(world, socketNodeId, {
      gates: [gateEventKind("onHit"), gateChance(0.15)],
      effects: [effectAddCritChance(0.05)],
    });
  },
  gem_obsidian(world, weaponId, socketNodeId) {
    attachProcNode(world, socketNodeId, {
      gates: [gateEventKind("onHit"), gateChance(0.20)],
      effects: [effectApplyStatus("weaken", 3, 1)],
    });
  },
  gem_garnet(world, weaponId, socketNodeId) {
    attachProcNode(world, socketNodeId, {
      gates: [gateEventKind("onHit"), gateChance(0.25)],
      effects: [effectApplyStatus("burning", 3, 2)],
    });
  },
  // New socketable gems
  gem_jacinth(world, weaponId, socketNodeId) {
    attachProcNode(world, socketNodeId, {
      gates: [gateEventKind("onHit"), gateChance(0.20)],
      effects: [effectApplyStatus("agony", 3, 2)],
    });
  },
  gem_aquamarine(world, weaponId, socketNodeId) {
    attachProcNode(world, socketNodeId, {
      gates: [gateEventKind("onHit"), gateChance(0.20)],
      effects: [effectApplyStatus("bleed", 3, 1)],
    });
  },
};

/**
 * Attach GemSocketNode marker + optional proc subtree to a weapon entity.
 * Called by the gem:socketed event listener.
 * @param {any} world
 * @param {number} weaponId
 * @param {string} gemId  e.g. 'gem_ruby'
 */
export function attachGemSocketNodes(world, weaponId, gemId) {
  const socketNodeId = addAttachedComponent(world, weaponId, GemSocketNode, { gemId });
  const builder = GEM_PROC_BUILDERS[gemId];
  if (builder) builder(world, weaponId, socketNodeId);
}

const INSTALLED = Symbol.for("jshack:gemSocketAffixes:installed");

/**
 * Install world.on('gem:socketed') handler. Safe to call multiple times.
 * @param {any} world
 */
export function installGemSocketListener(world) {
  if (!world || world[INSTALLED]) return;
  world[INSTALLED] = true;
  world.on("gem:socketed", ({ weaponId, gemId }) => {
    try {
      attachGemSocketNodes(world, weaponId, gemId);
    } catch (e) {
      console.debug("[gemSocketAffixes] attachGemSocketNodes failed:", e);
    }
  });
}
