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
import { Equipment } from "../components/Equipment.js";
import { ItemInfo } from "../components/ItemInfo.js";

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
const S_VOIDSTONE  = "gem_socket:voidstone:passive";
const S_FLUORITE   = "gem_socket:fluorite:passive";

// ── Fluorite charge/discharge thresholds ─────────────────────────
const FLUO_MAX_CHARGES      = 6;  // stacks to full charge
const FLUO_DISCHARGE_MIN    = 3;  // minimum stacks to discharge
const FLUO_DAMAGE_PER_STACK = 2;  // bonus electric damage per charge consumed
const FLUO_SHRINE_STANDING_MIN = 5; // normalized standing threshold for shrine gift (out of 8)

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
registerScript(S_VOIDSTONE,  { [ScriptVerb.AffixPassive]: (_w, ctx) => { ctx.addBonus("accuracy", 3); ctx.addBonus("damagePower", 3); } });
registerScript(S_FLUORITE,   { [ScriptVerb.AffixPassive]: (_w, ctx) => ctx.addBonus("electricOhms", 20) });

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
  ["gem_socket:voidstone",  { name: "Voidstone Socket",  slots: ["weapon", "armor"], weight: 0, passiveRefs: [S_VOIDSTONE] }],
  ["gem_socket:fluorite",   { name: "Fluorite Socket",   slots: ["weapon", "armor"], weight: 0, passiveRefs: [S_FLUORITE] }],
].forEach(([id, spec]) => registerAffixDefinition(id, spec));

// ── Fluorite proc scripts ────────────────────────────────────────
// Charge script: fires on onDamaged — absorbs incoming electric energy.
// Two stacks per electric hit; shrine-induced charge handled separately.
registerScript("gem_socket:fluorite:charge", {
  [ScriptVerb.ProcEvaluate]: (world, ctx) => {
    if (ctx.kind !== "onDamaged") return;
    const dmgType = String(ctx.damage?.type || "");
    if (dmgType !== "electric" && dmgType !== "lightning") return;
    const item = Number(ctx?.item || 0) | 0;
    const info = world.get(item, ItemInfo);
    if (!info) return;
    const max = Number(info.maxCharges || 0);
    if (!max) return;
    const curr = Number(info.charges || 0);
    if (curr >= max) return;
    info.charges = Math.min(max, curr + 2);  // electric hits charge fast
    ctx.proc.emit("proc:fluorite:charge", {
      actor: ctx.source, item, charges: info.charges, maxCharges: max, source: "electric",
    });
  },
});

// Discharge script: fires on onBeforeHit — releases stored charge as a blinding flash.
// Requires >= FLUO_DISCHARGE_MIN stacks. Bonus electric damage = stacks * FLUO_DAMAGE_PER_STACK.
registerScript("gem_socket:fluorite:discharge", {
  [ScriptVerb.ProcEvaluate]: (world, ctx) => {
    if (ctx.kind !== "onBeforeHit") return;
    const item = Number(ctx?.item || 0) | 0;
    const info = world.get(item, ItemInfo);
    if (!info) return;
    const curr = Number(info.charges || 0);
    if (curr < FLUO_DISCHARGE_MIN) return;
    const dmg = curr * FLUO_DAMAGE_PER_STACK;
    ctx.proc.addBonusDamage(dmg, dmg, "electric");
    ctx.proc.applyStatus(ctx.target, "blinded", 1, 1);  // phosphorescent flash
    info.charges = 0;
    ctx.proc.emit("proc:fluorite:discharge", {
      actor: ctx.source, target: ctx.target, item, chargesSpent: curr,
    });
  },
});

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
  gem_voidstone(world, weaponId, socketNodeId) {
    attachProcNode(world, socketNodeId, {
      gates: [gateEventKind("onHit"), gateChance(0.25)],
      effects: [effectBonusDamageFlat(3, 3, "void"), effectRestoreResource("hp", 3, { target: "source" })],
    });
  },
  gem_fluorite(world, weaponId, socketNodeId) {
    // Initialize charge state on the weapon — persists across combat
    const info = world.get(weaponId, ItemInfo);
    if (info) {
      info.charges = 0;
      info.maxCharges = FLUO_MAX_CHARGES;
    }
    // Charge proc: take electric/lightning damage → absorb 2 stacks
    attachProcNode(world, socketNodeId, {
      gates: [gateEventKind("onDamaged")],
      script: "gem_socket:fluorite:charge",
      priority: 1,
    });
    // Discharge proc: on next hit when >= 3 stacks → blinding electric burst
    attachProcNode(world, socketNodeId, {
      gates: [gateEventKind("onBeforeHit")],
      script: "gem_socket:fluorite:discharge",
      priority: 2,
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

  // Shrine proximity charges fluorite — divine favor near a shrine (good standing).
  // +1 stack per combat hit while in divine favor range.
  world.on("shrine:combat:scaling", ({ attacker, mult }) => {
    if (!(mult > 1)) return;  // only divine favor, not wrath
    const actorId = Number(attacker) | 0;
    if (!(actorId > 0)) return;
    const eq = world.get(actorId, Equipment);
    if (!eq) return;
    // Check main hand weapon for fluorite socket
    const weaponId = Number(eq.hand || 0) | 0;
    if (!(weaponId > 0)) return;
    const info = world.get(weaponId, ItemInfo);
    if (!info) return;
    const max = Number(info.maxCharges || 0);
    if (!max) return;
    const sockets = Array.isArray(info.sockets) ? info.sockets : [];
    if (!sockets.includes("gem_fluorite")) return;
    const curr = Number(info.charges || 0);
    if (curr >= max) return;
    info.charges = Math.min(max, curr + 1);
    world.emit?.("proc:fluorite:charge", {
      actor: actorId, item: weaponId, charges: info.charges, maxCharges: max, source: "shrine",
    });
  });
}
