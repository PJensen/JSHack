// Affix definitions: triggers can be onBeforeHit, onHit, onDamaged, onKill, onEquip, onUnequip
// Scripts are registered via the central scripting router.
import { mulberry32, rngInt, combatSeed } from "../utils/rng.js";
import { ActiveEffects } from "../components/ActiveEffects.js";
import { Vitality } from "../components/Vitality.js";
import { Position } from "../components/Position.js";
import { Faction } from "../components/Faction.js";
import { Mana } from "../components/Mana.js";
import { Stamina } from "../components/Stamina.js";
import { registerScript, ScriptVerb } from "../scripting.js";
import { dealDamage } from "../utils/dealDamage.js";
import { forEachInRadius } from "../utils/spatialIndex.js";
import { areFactionsHostile } from "../utils/factionHostility.js";

const AFFIX_THORNS = "affix:thorns1";
const AFFIX_VAMP = "affix:vamp1";
const AFFIX_FIERCE = "affix:fierce";
const AFFIX_GUARD = "affix:guard1";
const AFFIX_LIFE = "affix:life1";
const AFFIX_ATTUNED = "affix:attuned1";
const AFFIX_FIRE_WARD = "affix:fireWard1";
const AFFIX_POISON_WARD = "affix:poisonWard1";
const AFFIX_KINETIC_WARD = "affix:kineticWard1";
const AFFIX_CAUSTIC = "affix:caustic1";
const AFFIX_CAPACITIVE = "affix:capacitive1";
const AFFIX_INSULATED = "affix:insulated1";
const AFFIX_LUCKY = "affix:lucky1";
const AFFIX_VENOMOUS = "affix:venomous1";
const AFFIX_CHAIN_LIGHTNING = "affix:chainLightning1";
const AFFIX_FIRESTORM = "affix:firestorm1";
const AFFIX_SOUL_DRAIN = "affix:soulDrain1";
const AFFIX_BERSERK = "affix:berserk1";
const AFFIX_SHIELD_WALL = "affix:shieldWall1";
const AFFIX_MANA_SURGE = "affix:manaSurge1";
const AFFIX_EXECUTIONER = "affix:executioner1";
const AFFIX_FROSTBITE = "affix:frostbite1";
const AFFIX_HEMORRHAGE = "affix:hemorrhage1";
const AFFIX_SECOND_WIND = "affix:secondWind1";

/**
 * Push or stack an active effect directly on an entity.
 * @param {any} world
 * @param {number} entityId
 * @param {{ key:string, turnsLeft:number, potency:number, stacks?:number }} effect
 */
function upsertEffect(world, entityId, effect) {
  const ae = world.get(entityId, ActiveEffects);
  if (ae && Array.isArray(ae.effects)) {
    const existing = ae.effects.find((e) => e.key === effect.key);
    if (existing) {
      existing.stacks = (existing.stacks || 1) + 1;
      existing.turnsLeft = Math.max(existing.turnsLeft || 0, effect.turnsLeft);
      existing.potency = Math.max(existing.potency || 0, effect.potency);
      return;
    }
    ae.effects.push({ stacks: 1, ...effect });
    return;
  }
  try { world.add(entityId, ActiveEffects, { effects: [{ stacks: 1, ...effect }] }); } catch {} // ECS: may already exist
}

/**
 * Deterministic combat proc roll.
 * @param {any} world
 * @param {number} attacker
 * @param {number} defender
 * @param {number} salt
 * @param {number} chancePct
 */
function procRoll(world, attacker, defender, salt, chancePct) {
  const pct = Math.max(0, Math.min(100, chancePct | 0));
  if (pct >= 100) return true;
  if (pct <= 0) return false;
  const step = (world && world.step) | 0;
  const seed = combatSeed(world?.seed ?? 0, step, attacker | 0, defender | 0, salt | 0);
  const r = mulberry32(seed);
  return rngInt(r, 1, 100) <= pct;
}

/**
 * Apply a tiny typed bonus hit that cannot kill by itself.
 * @param {any} world
 * @param {any} ctx
 * @param {string} type
 * @param {number} amount
 * @param {string} cause
 */
function applyNonLethalTypedChip(world, ctx, type, amount, cause) {
  const attacker = (ctx && ctx.attacker) | 0;
  const defender = (ctx && ctx.defender) | 0;
  if (!(defender > 0) || !world || !world.isAlive?.(defender)) return 0;
  if (!((ctx && ctx.damage) > 0)) return 0;
  const vit = world.get(defender, Vitality);
  if (!vit || (vit.hp | 0) <= 1) return 0;
  const result = dealDamage(world, {
    target: defender,
    amount: Math.max(1, amount | 0),
    source: attacker,
    type,
    cause,
    noTrigger: true,
  });
  return Math.max(0, Number(result?.amount || 0));
}

registerScript(AFFIX_THORNS, {
  [ScriptVerb.AffixOnHit]: (world, ctx) => {
    try {
      const attacker = (ctx && ctx.attacker) | 0;
      const defender = (ctx && ctx.defender) | 0;
      const step = (world && world.step) | 0;
      const seed = combatSeed(world?.seed ?? 0, step, attacker, defender, 0xc0ffee01);
      const r = mulberry32(seed);
      const roll = rngInt(r, 1, 100);
      if (roll <= 20) {
        ctx.retaliate(2);
        try { world.emit && world.emit('proc:thorns', { actor: ctx.defender, target: ctx.attacker }); } catch (e) { console.debug('[affixes] emit proc:thorns failed:', e); }
        try {
          const ae = world.get(defender, ActiveEffects);
          if (ae && Array.isArray(ae.effects)) {
            ae.effects.push({ key: "thorns", turnsLeft: 3, potency: 1 });
          } else {
            world.add(defender, ActiveEffects, { effects: [{ key: "thorns", turnsLeft: 3, potency: 1 }] });
          }
        } catch (e) { console.error('[affixes] thorns effect application failed:', e); }
      }
    } catch {
      ctx.retaliate(2);
    }
  },
});

registerScript(AFFIX_VAMP, {
  [ScriptVerb.AffixOnHit]: (world, ctx) => {
    const amt = Math.max(1, Math.floor(ctx.damage / 3));
    ctx.healAttacker(amt);
    try { world.emit && world.emit('proc:vampiric', { actor: ctx.attacker, target: ctx.defender, amount: amt }); } catch (e) { console.debug('[affixes] emit proc:vampiric failed:', e); }
  },
});

registerScript(AFFIX_FIERCE, {
  [ScriptVerb.AffixOnBeforeHit]: (world, ctx) => {
    ctx.damage += 1;
    try { world.emit && world.emit('proc:fierce', { actor: ctx.attacker, target: ctx.defender }); } catch (e) { console.debug('[affixes] emit proc:fierce failed:', e); }
  },
});

registerScript(AFFIX_GUARD, {
  [ScriptVerb.AffixPassive]: (_world, ctx) => {
    ctx.addBonus("defense", 1);
  },
});

registerScript(AFFIX_LIFE, {
  [ScriptVerb.AffixPassive]: (_world, ctx) => {
    ctx.addBonus("maxHp", 5);
  },
});

registerScript(AFFIX_ATTUNED, {
  [ScriptVerb.AffixPassive]: (_world, ctx) => {
    ctx.addBonus("manaRegen", 0.25);
  },
});

registerScript(AFFIX_FIRE_WARD, {
  [ScriptVerb.AffixPassive]: (_world, ctx) => {
    ctx.addBonus("fireResist", 0.15);
  },
});

registerScript(AFFIX_POISON_WARD, {
  [ScriptVerb.AffixPassive]: (_world, ctx) => {
    ctx.addBonus("poisonResist", 0.15);
  },
});

registerScript(AFFIX_KINETIC_WARD, {
  [ScriptVerb.AffixPassive]: (_world, ctx) => {
    ctx.addBonus("kineticDR", 2);
  },
});

registerScript(AFFIX_CAUSTIC, {
  [ScriptVerb.AffixOnHit]: (world, ctx) => {
    const dealt = applyNonLethalTypedChip(world, ctx, "acid", 1, "affix:caustic");
    if (dealt > 0) {
      try { world.emit && world.emit("proc:caustic", { actor: ctx.attacker, target: ctx.defender, amount: dealt }); } catch (e) { console.debug('[affixes] emit proc:caustic failed:', e); }
    }
  },
});

registerScript(AFFIX_CAPACITIVE, {
  [ScriptVerb.AffixOnHit]: (world, ctx) => {
    const dealt = applyNonLethalTypedChip(world, ctx, "electric", 1, "affix:capacitive");
    if (dealt > 0) {
      try { world.emit && world.emit("proc:capacitive", { actor: ctx.attacker, target: ctx.defender, amount: dealt }); } catch (e) { console.debug('[affixes] emit proc:capacitive failed:', e); }
    }
    if (!procRoll(world, ctx.attacker, ctx.defender, 0xc0ffee03, 35)) return;
    upsertEffect(world, ctx.defender, { key: "shock", turnsLeft: 2, potency: 1, stacks: 1 });
    try { world.emit && world.emit("proc:shocked", { actor: ctx.attacker, target: ctx.defender }); } catch (e) { console.debug('[affixes] emit proc:shocked failed:', e); }
  },
});

registerScript(AFFIX_INSULATED, {
  [ScriptVerb.AffixPassive]: (_world, ctx) => {
    ctx.addBonus("electricOhms", 600);
  },
});

registerScript(AFFIX_LUCKY, {
  [ScriptVerb.AffixPassive]: (_world, ctx) => {
    ctx.addBonus("luck", 3);
  },
});

registerScript(AFFIX_VENOMOUS, {
  [ScriptVerb.AffixOnHit]: (world, ctx) => {
    if (!procRoll(world, ctx.attacker, ctx.defender, 0xc0ffee04, 40)) return;
    upsertEffect(world, ctx.defender, { key: "poison", turnsLeft: 4, potency: 2, stacks: 1 });
    try { world.emit && world.emit("proc:poisoned", { actor: ctx.attacker, target: ctx.defender }); } catch (e) { console.debug('[affixes] emit proc:poisoned failed:', e); }
  },
});

// ── Proc affixes ──────────────────────────────────────────────────

registerScript(AFFIX_CHAIN_LIGHTNING, {
  [ScriptVerb.AffixOnHit]: (world, ctx) => {
    if (!procRoll(world, ctx.attacker, ctx.defender, 0xc0ffee10, 15)) return;
    const dealt = applyNonLethalTypedChip(world, ctx, "electric", 2, "affix:chainLightning");
    if (dealt <= 0) return;
    const defPos = world.get(ctx.defender, Position);
    if (!defPos) return;
    let chained = false;
    forEachInRadius(world, defPos.x, defPos.y, 2, (nearId) => {
      if (chained || nearId === ctx.defender || nearId === ctx.attacker) return;
      if (!world.isAlive(nearId)) return;
      const nearFac = world.get(nearId, Faction)?.key || "";
      const atkFac = world.get(ctx.attacker, Faction)?.key || "";
      if (!areFactionsHostile(atkFac, nearFac)) return;
      dealDamage(world, { target: nearId, amount: 1, source: ctx.attacker, type: "electric", cause: "affix:chainLightning", noTrigger: true });
      chained = true;
    });
    try { world.emit && world.emit("proc:chainLightning", { actor: ctx.attacker, target: ctx.defender }); } catch (e) { console.debug("[affixes] emit proc:chainLightning failed:", e); }
  },
});

registerScript(AFFIX_FIRESTORM, {
  [ScriptVerb.AffixOnHit]: (world, ctx) => {
    if (!procRoll(world, ctx.attacker, ctx.defender, 0xc0ffee11, 12)) return;
    applyNonLethalTypedChip(world, ctx, "fire", 1, "affix:firestorm");
    upsertEffect(world, ctx.defender, { key: "burning", turnsLeft: 3, potency: 2, stacks: 1 });
    try { world.emit && world.emit("proc:firestorm", { actor: ctx.attacker, target: ctx.defender }); } catch (e) { console.debug("[affixes] emit proc:firestorm failed:", e); }
  },
});

registerScript(AFFIX_SOUL_DRAIN, {
  [ScriptVerb.AffixOnHit]: (world, ctx) => {
    if (!procRoll(world, ctx.attacker, ctx.defender, 0xc0ffee12, 18)) return;
    const amt = Math.max(1, Math.floor(ctx.damage / 2));
    ctx.healAttacker(amt);
    try { world.emit && world.emit("proc:soulDrain", { actor: ctx.attacker, target: ctx.defender, amount: amt }); } catch (e) { console.debug("[affixes] emit proc:soulDrain failed:", e); }
  },
});

registerScript(AFFIX_BERSERK, {
  [ScriptVerb.AffixOnHit]: (world, ctx) => {
    if (!procRoll(world, ctx.attacker, ctx.defender, 0xc0ffee13, 10)) return;
    upsertEffect(world, ctx.attacker, { key: "berserk", turnsLeft: 5, potency: 1, stacks: 1 });
    try { world.emit && world.emit("proc:berserking", { actor: ctx.attacker, target: ctx.defender }); } catch (e) { console.debug("[affixes] emit proc:berserking failed:", e); }
  },
});

registerScript(AFFIX_SHIELD_WALL, {
  [ScriptVerb.AffixOnDamaged]: (world, ctx) => {
    if (!procRoll(world, ctx.attacker, ctx.defender, 0xc0ffee14, 15)) return;
    upsertEffect(world, ctx.defender, { key: "stoneskin", turnsLeft: 4, potency: 2, stacks: 1 });
    try { world.emit && world.emit("proc:shieldWall", { actor: ctx.defender, target: ctx.attacker }); } catch (e) { console.debug("[affixes] emit proc:shieldWall failed:", e); }
  },
});

registerScript(AFFIX_MANA_SURGE, {
  [ScriptVerb.AffixOnHit]: (world, ctx) => {
    if (!procRoll(world, ctx.attacker, ctx.defender, 0xc0ffee15, 20)) return;
    const mana = world.get(ctx.attacker, Mana);
    if (!mana) return;
    const maxMana = Number(mana.maxMana || 50);
    mana.mana = Math.min(maxMana, (Number(mana.mana) || 0) + 3);
    try { world.emit && world.emit("proc:manaSurge", { actor: ctx.attacker, amount: 3 }); } catch (e) { console.debug("[affixes] emit proc:manaSurge failed:", e); }
  },
});

registerScript(AFFIX_EXECUTIONER, {
  [ScriptVerb.AffixOnBeforeHit]: (world, ctx) => {
    const vit = world.get(ctx.defender, Vitality);
    if (!vit) return;
    if (vit.hp / vit.maxHp >= 0.3) return;
    ctx.damage += 3;
    try { world.emit && world.emit("proc:executioner", { actor: ctx.attacker, target: ctx.defender }); } catch (e) { console.debug("[affixes] emit proc:executioner failed:", e); }
  },
});

registerScript(AFFIX_FROSTBITE, {
  [ScriptVerb.AffixOnHit]: (world, ctx) => {
    if (!procRoll(world, ctx.attacker, ctx.defender, 0xc0ffee16, 20)) return;
    upsertEffect(world, ctx.defender, { key: "frost", turnsLeft: 3, potency: 1, stacks: 1 });
    try { world.emit && world.emit("proc:frostbite", { actor: ctx.attacker, target: ctx.defender }); } catch (e) { console.debug("[affixes] emit proc:frostbite failed:", e); }
  },
});

registerScript(AFFIX_HEMORRHAGE, {
  [ScriptVerb.AffixOnHit]: (world, ctx) => {
    if (!procRoll(world, ctx.attacker, ctx.defender, 0xc0ffee17, 25)) return;
    upsertEffect(world, ctx.defender, { key: "bleed", turnsLeft: 4, potency: 2, stacks: 1 });
    try { world.emit && world.emit("proc:hemorrhage", { actor: ctx.attacker, target: ctx.defender }); } catch (e) { console.debug("[affixes] emit proc:hemorrhage failed:", e); }
  },
});

registerScript(AFFIX_SECOND_WIND, {
  [ScriptVerb.AffixOnDamaged]: (world, ctx) => {
    if (!procRoll(world, ctx.attacker, ctx.defender, 0xc0ffee18, 10)) return;
    upsertEffect(world, ctx.defender, { key: "regen", turnsLeft: 5, potency: 1, stacks: 1 });
    const stam = world.get(ctx.defender, Stamina);
    if (stam) {
      const maxStam = Number(stam.maxStamina || 100);
      stam.stamina = Math.min(maxStam, (Number(stam.stamina) || 0) + 5);
    }
    try { world.emit && world.emit("proc:secondWind", { actor: ctx.defender }); } catch (e) { console.debug("[affixes] emit proc:secondWind failed:", e); }
  },
});

export const AFFIX_DEFS = {
  thorns1: { name: "Thorns I", slots: ["armor"], triggers: ["onHit"], script: AFFIX_THORNS, weight: 30 },
  vamp1: { name: "Vampiric I", slots: ["weapon"], triggers: ["onHit"], script: AFFIX_VAMP, weight: 20 },
  fierce: { name: "Fierce", slots: ["weapon"], triggers: ["onBeforeHit"], script: AFFIX_FIERCE, weight: 25 },
  guard1: { name: "Guarded", slots: ["armor"], passive: AFFIX_GUARD, triggers: [], weight: 25 },
  life1: { name: "Healthy", slots: ["armor", "ring"], passive: AFFIX_LIFE, triggers: [], weight: 22 },
  attuned1: { name: "Attuned", slots: ["ring"], passive: AFFIX_ATTUNED, triggers: [], weight: 20 },
  fireWard1: { name: "Flame Ward", slots: ["armor", "shield"], passive: AFFIX_FIRE_WARD, triggers: [], weight: 18 },
  poisonWard1: { name: "Venom Ward", slots: ["armor", "ring"], passive: AFFIX_POISON_WARD, triggers: [], weight: 18 },
  kineticWard1: { name: "Fortified", slots: ["armor", "shield"], passive: AFFIX_KINETIC_WARD, triggers: [], weight: 15 },
  caustic1: { name: "Caustic", slots: ["weapon"], triggers: ["onHit"], script: AFFIX_CAUSTIC, weight: 16 },
  capacitive1: { name: "Capacitive", slots: ["weapon"], triggers: ["onHit"], script: AFFIX_CAPACITIVE, weight: 15 },
  insulated1: { name: "Insulated", slots: ["armor", "shield"], passive: AFFIX_INSULATED, triggers: [], weight: 16 },
  lucky1: { name: "Lucky", slots: ["ring", "armor"], passive: AFFIX_LUCKY, triggers: [], weight: 18 },
  venomous1: { name: "Venomous", slots: ["weapon"], triggers: ["onHit"], script: AFFIX_VENOMOUS, weight: 14 },
  chainLightning1: { name: "Chain Lightning", slots: ["weapon"], triggers: ["onHit"], script: AFFIX_CHAIN_LIGHTNING, weight: 8 },
  firestorm1: { name: "Firestorm", slots: ["weapon"], triggers: ["onHit"], script: AFFIX_FIRESTORM, weight: 10 },
  soulDrain1: { name: "Soul Drain", slots: ["weapon"], triggers: ["onHit"], script: AFFIX_SOUL_DRAIN, weight: 7 },
  berserk1: { name: "Berserking", slots: ["weapon", "ring"], triggers: ["onHit"], script: AFFIX_BERSERK, weight: 8 },
  shieldWall1: { name: "Stoneskin Proc", slots: ["armor", "shield"], triggers: ["onDamaged"], script: AFFIX_SHIELD_WALL, weight: 10 },
  manaSurge1: { name: "Mana Surge", slots: ["ring", "weapon"], triggers: ["onHit"], script: AFFIX_MANA_SURGE, weight: 10 },
  executioner1: { name: "Executioner", slots: ["weapon"], triggers: ["onBeforeHit"], script: AFFIX_EXECUTIONER, weight: 6 },
  frostbite1: { name: "Frostbite", slots: ["weapon"], triggers: ["onHit"], script: AFFIX_FROSTBITE, weight: 10 },
  hemorrhage1: { name: "Hemorrhage", slots: ["weapon"], triggers: ["onHit"], script: AFFIX_HEMORRHAGE, weight: 12 },
  secondWind1: { name: "Second Wind", slots: ["armor", "shield"], triggers: ["onDamaged"], script: AFFIX_SECOND_WIND, weight: 8 },
};

export function listAffixes() { return Object.entries(AFFIX_DEFS).map(([id, rec]) => ({ id, ...rec })); }
export function getAffix(id) { return AFFIX_DEFS[id] || null; }
