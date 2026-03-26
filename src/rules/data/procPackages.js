import { children } from "../../lib/ecs-js/index.js";
import { destroySubtree } from "../../lib/ecs-js/hierarchy.js";
import { ActiveEffects } from "../components/ActiveEffects.js";
import { Faction } from "../components/Faction.js";
import { Position } from "../components/Position.js";
import { ProcPackageNode } from "../components/ProcPackageNode.js";
import { Vitality } from "../components/Vitality.js";
import { isOpaque } from "../environment/dungeon/tileMap.js";
import { registerScript, getScriptHandlers, ScriptVerb } from "../scripting.js";
import { upsertTimedEffect } from "../utils/effectSemantics.js";
import { areFactionsHostile } from "../utils/factionHostility.js";
import {
  addAttachedComponent,
  attachDerivedExpression,
  attachProcNode,
  exprAddConst,
  gateChance,
  gateEventKind,
  gateHasActionTag,
} from "../utils/statProcAuthoring.js";

export const PROC_PACKAGE_KEYS = Object.freeze({
  EchoStrike: "procPackage:echoStrike",
  RicochetTheology: "procPackage:ricochetTheology",
  DoomClock: "procPackage:doomClock",
  SoulMortgage: "procPackage:soulMortgage",
  CataclysmChain: "procPackage:cataclysmChain",
  BloodTithe: "procPackage:bloodTithe",
  FoolsErrand: "procPackage:foolsErrand",
  VenomClock: "procPackage:venomClock",
  HollowTide: "procPackage:hollowTide",
});

function ensureActiveEffects(world, entityId) {
  let activeEffects = world.get(entityId, ActiveEffects);
  if (activeEffects && Array.isArray(activeEffects.effects)) return activeEffects;
  try {
    world.add(entityId, ActiveEffects, { effects: [] });
  } catch {
    activeEffects = world.get(entityId, ActiveEffects);
  }
  return world.get(entityId, ActiveEffects) || null;
}

function getEffect(world, entityId, key) {
  const activeEffects = world.get(entityId, ActiveEffects);
  if (!activeEffects || !Array.isArray(activeEffects.effects)) return null;
  return activeEffects.effects.find((entry) => entry?.key === key) || null;
}

function removeEffect(world, entityId, key) {
  const activeEffects = world.get(entityId, ActiveEffects);
  if (!activeEffects || !Array.isArray(activeEffects.effects)) return false;
  const index = activeEffects.effects.findIndex((entry) => entry?.key === key);
  if (index < 0) return false;
  activeEffects.effects.splice(index, 1);
  return true;
}

function emit(world, name, payload) {
  try {
    world.emit?.(name, payload);
  } catch {
    // package scripts should remain harmless until a real host wires them in
  }
}

function isHostileNear(world, source, origin, nearId, radius = 2) {
  if (!(nearId > 0) || nearId === source || !world.isAlive?.(nearId)) return false;
  const nearPos = world.get(nearId, Position);
  if (!nearPos) return false;
  const dx = Math.abs((nearPos.x | 0) - (origin.x | 0));
  const dy = Math.abs((nearPos.y | 0) - (origin.y | 0));
  return Math.max(dx, dy) <= radius;
}

function compareRicochetTargets(a, b) {
  return a.distance - b.distance
    || b.forward - a.forward
    || a.lateral - b.lateral
    || a.pos.y - b.pos.y
    || a.pos.x - b.pos.x
    || a.id - b.id;
}

function getRicochetDirection(world, source, target) {
  const sourcePos = world.get(source, Position);
  const targetPos = world.get(target, Position);
  if (!sourcePos || !targetPos) return null;
  const dx = Math.sign((targetPos.x | 0) - (sourcePos.x | 0));
  const dy = Math.sign((targetPos.y | 0) - (sourcePos.y | 0));
  if (dx === 0 && dy === 0) return null;
  return { dx, dy };
}

function scoreRicochetCandidate(direction, origin, candidatePos) {
  if (!direction || !candidatePos) return null;
  const rx = (candidatePos.x | 0) - (origin.x | 0);
  const ry = (candidatePos.y | 0) - (origin.y | 0);
  const forward = rx * direction.dx + ry * direction.dy;
  if (forward <= 0) return null;

  const lateral = Math.abs(rx * direction.dy - ry * direction.dx);
  if (lateral > forward) return null;

  return {
    forward,
    lateral,
    distance: Math.max(Math.abs(rx), Math.abs(ry)),
  };
}

registerScript(PROC_PACKAGE_KEYS.EchoStrike, {
  [ScriptVerb.ProcEvaluate]: (world, ctx) => {
    const source = Number(ctx?.source || 0) | 0;
    const target = Number(ctx?.target || 0) | 0;
    const kind = String(ctx?.kind || "");
    if (!(source > 0) || !(target > 0)) return;

    if (kind === "onBeforeHit") {
      const stored = getEffect(world, source, "echo_strike_memory");
      const potency = Math.max(0, Number(stored?.potency || 0));
      if (potency > 0) {
        ctx.proc.addBonusDamage(Math.max(1, Math.floor(potency * 0.35)), undefined, "spectral");
        removeEffect(world, source, "echo_strike_memory");
        emit(world, "proc:echoStrike:release", { actor: source, target, potency });
      }
      return;
    }

    if (kind === "onHit") {
      const amount = Math.max(0, Number(ctx?.damage?.amount || 0));
      if (amount <= 0) return;
      const activeEffects = ensureActiveEffects(world, source);
      if (!activeEffects) return;
      upsertTimedEffect(activeEffects.effects, {
        key: "echo_strike_memory",
        turnsLeft: 3,
        potency: amount,
        stacks: 1,
      });
      emit(world, "proc:echoStrike:store", { actor: source, target, amount });
    }
  },
});

registerScript(PROC_PACKAGE_KEYS.RicochetTheology, {
  [ScriptVerb.ProcEvaluate]: (world, ctx) => {
    if (String(ctx?.kind || "") !== "onHit") return;
    if (!ctx?.tags?.has?.("ranged") || !ctx?.tags?.has?.("projectile")) return;
    const source = Number(ctx?.source || 0) | 0;
    const target = Number(ctx?.target || 0) | 0;
    const pos = world.get(target, Position);
    if (!(source > 0) || !(target > 0) || !pos) return;

    const neighbors = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    let hasWall = !!ctx?.tags?.has?.("wallRicochet");
    for (let i = 0; i < neighbors.length && !hasWall; i++) {
      const nx = (pos.x | 0) + neighbors[i][0];
      const ny = (pos.y | 0) + neighbors[i][1];
      if (isOpaque(nx, ny)) hasWall = true;
    }
    if (!hasWall) return;

    const direction = getRicochetDirection(world, source, target);
    if (!direction) return;
    const ricochetTargets = [];
    for (const [nearId] of world.query(Position)) {
      if (!(nearId > 0) || nearId === source || nearId === target || !world.isAlive?.(nearId)) continue;
      const nearPos = world.get(nearId, Position);
      if (!nearPos) continue;
      const scoring = scoreRicochetCandidate(direction, pos, nearPos);
      if (!scoring || scoring.distance > 2) continue;
      ricochetTargets.push({
        id: nearId,
        pos: nearPos,
        distance: scoring.distance,
        forward: scoring.forward,
        lateral: scoring.lateral,
      });
    }

    ricochetTargets.sort(compareRicochetTargets);
    const bounceCount = Math.min(2, ricochetTargets.length);
    for (let i = 0; i < bounceCount; i++) {
      const rebound = ricochetTargets[i];
      ctx.proc.dealDamage(rebound.id, Math.max(1, Math.floor(Number(ctx?.damage?.amount || 0) * 0.4)), "electric", {
        source,
        cause: "procPackage:ricochetTheology",
        noTrigger: true,
        nonLethal: true,
      });
      emit(world, "projectile:spawn", {
        kind: "ricochet",
        style: "ricochet_theology",
        actor: source,
        sourceId: target,
        targetId: rebound.id,
        from: { x: pos.x | 0, y: pos.y | 0 },
        to: { x: rebound.pos.x | 0, y: rebound.pos.y | 0 },
        speed: 14,
      });
      emit(world, "proc:ricochetTheology", {
        actor: source,
        from: target,
        to: rebound.id,
        bounceIndex: i,
        bounceCount,
        fromPos: { x: pos.x | 0, y: pos.y | 0 },
        toPos: { x: rebound.pos.x | 0, y: rebound.pos.y | 0 },
      });
    }
  },
});

registerScript(PROC_PACKAGE_KEYS.DoomClock, {
  [ScriptVerb.ProcEvaluate]: (world, ctx) => {
    if (String(ctx?.kind || "") !== "onHit") return;
    const source = Number(ctx?.source || 0) | 0;
    const target = Number(ctx?.target || 0) | 0;
    if (!(source > 0) || !(target > 0)) return;
    const activeEffects = ensureActiveEffects(world, target);
    if (!activeEffects) return;

    const existing = getEffect(world, target, "doom_clock");
    const nextStacks = Math.max(1, Number(existing?.stacks || 0) + 1);
    if (existing) {
      existing.turnsLeft = 9;
      existing.potency = nextStacks;
      existing.stacks = nextStacks;
    } else {
      activeEffects.effects.push({
        key: "doom_clock",
        turnsLeft: 9,
        potency: nextStacks,
        stacks: nextStacks,
      });
    }

    if (nextStacks >= 3) {
      removeEffect(world, target, "doom_clock");
      ctx.proc.dealDamage(target, Math.max(4, Math.floor(Number(ctx?.damage?.amount || 0) * 0.5)), "shadow", {
        source,
        cause: "procPackage:doomClock",
        noTrigger: true,
      });
      ctx.proc.applyStatus(target, "stun", 1, 1);
      ctx.proc.message("The doom clock tolls.");
      emit(world, "proc:doomClock", { actor: source, target });
      return;
    }

    emit(world, "proc:doomClock:tick", { actor: source, target, stacks: nextStacks });
  },
});

registerScript(PROC_PACKAGE_KEYS.SoulMortgage, {
  [ScriptVerb.ProcEvaluate]: (world, ctx) => {
    if (String(ctx?.kind || "") !== "onHit") return;
    const source = Number(ctx?.source || 0) | 0;
    const target = Number(ctx?.target || 0) | 0;
    if (!(source > 0)) return;
    const activeEffects = ensureActiveEffects(world, source);
    if (!activeEffects) return;
    const existing = getEffect(world, source, "soul_mortgage_debt");
    const nextDebt = Math.max(1, Number(existing?.stacks || 0) + 1);
    upsertTimedEffect(activeEffects.effects, {
      key: "soul_mortgage_debt",
      turnsLeft: 99,
      potency: nextDebt,
      stacks: nextDebt,
    });
    emit(world, "proc:soulMortgage:debt", { actor: source, target, debt: nextDebt });
  },
});

registerScript(PROC_PACKAGE_KEYS.CataclysmChain, {
  [ScriptVerb.ProcEvaluate]: (world, ctx) => {
    const kind = String(ctx?.kind || "");
    const source = Number(ctx?.source || 0) | 0;
    const target = Number(ctx?.target || 0) | 0;
    if (!(source > 0) || !(target > 0)) return;

    if (kind === "onCritKill") {
      const pos = world.get(target, Position);
      if (!pos) return;
      ctx.proc.spawnEntity("cataclysm_hazard", 1, "target");
      ctx.proc.message("Cataclysm breaks outward.");
      emit(world, "proc:cataclysmChain:knockbackWave", { actor: source, target, at: { x: pos.x, y: pos.y } });

      const sourceFaction = world.get(source, Faction)?.key || "";
      for (const [nearId] of world.query(Position)) {
        if (!isHostileNear(world, source, pos, nearId, 2) || nearId === target) continue;
        const targetFaction = world.get(nearId, Faction)?.key || "";
        if (!areFactionsHostile(sourceFaction, targetFaction)) continue;
        ctx.proc.applyStatus(nearId, "cataclysm_mark", 4, 1);
      }
      return;
    }

    if (kind === "onBeforeHit") {
      const mark = getEffect(world, target, "cataclysm_mark");
      if (!mark) return;
      ctx.proc.addCritChance(1);
      removeEffect(world, target, "cataclysm_mark");
      emit(world, "proc:cataclysmChain:prime", { actor: source, target });
      return;
    }

    if (kind === "onHit") {
      if (!ctx?.tags?.has?.("cataclysmDetonate")) return;
      const pos = world.get(target, Position);
      if (!pos) return;
      for (const [nearId] of world.query(Position)) {
        if (!isHostileNear(world, source, pos, nearId, 1)) continue;
        ctx.proc.dealDamage(nearId, Math.max(2, Math.floor(Number(ctx?.damage?.amount || 0) * 0.3)), "void", {
          source,
          cause: "procPackage:cataclysmChain",
          noTrigger: true,
          nonLethal: nearId !== target,
        });
      }
      emit(world, "proc:cataclysmChain:detonate", { actor: source, target });
    }
  },
});

// ── Blood Tithe ───────────────────────────────────────────────────────────
// OnHit: bank 10% of dealt damage as blood_tithe_debt stacks on self (max 20).
// OnDamaged: detonate all stacks as a burst heal, then clear.
registerScript(PROC_PACKAGE_KEYS.BloodTithe, {
  [ScriptVerb.ProcEvaluate]: (world, ctx) => {
    const source = Number(ctx?.source || 0) | 0;
    const target = Number(ctx?.target || 0) | 0;
    const kind = String(ctx?.kind || "");
    if (!(source > 0)) return;

    if (kind === "onHit") {
      if (!(target > 0)) return;
      const amount = Math.max(0, Number(ctx?.damage?.amount || 0));
      if (amount <= 0) return;
      const tithe = Math.max(1, Math.floor(amount * 0.1));
      const ae = ensureActiveEffects(world, source);
      if (!ae) return;
      const existing = getEffect(world, source, "blood_tithe_debt");
      const next = Math.min(20, Math.max(1, Number(existing?.stacks || 0) + tithe));
      upsertTimedEffect(ae.effects, {
        key: "blood_tithe_debt",
        turnsLeft: 99,
        potency: next,
        stacks: next,
      });
      emit(world, "proc:bloodTithe:bank", { actor: source, target, banked: tithe, total: next });
      return;
    }

    if (kind === "onDamaged") {
      const debt = getEffect(world, source, "blood_tithe_debt");
      const stacks = Math.max(0, Number(debt?.stacks || 0));
      if (stacks <= 0) return;
      removeEffect(world, source, "blood_tithe_debt");
      ctx.proc.heal(source, stacks);
      ctx.proc.message("Blood debt repaid.");
      emit(world, "proc:bloodTithe:burst", { actor: source, healed: stacks });
      return;
    }
  },
});

// ── Fool's Errand ─────────────────────────────────────────────────────────
// OnMiss (30% chance): apply confuse (2 turns) to both attacker AND defender.
// With luck ≥ 5 only the defender is confused.
registerScript(PROC_PACKAGE_KEYS.FoolsErrand, {
  [ScriptVerb.ProcEvaluate]: (world, ctx) => {
    if (String(ctx?.kind || "") !== "onMiss") return;
    const source = Number(ctx?.source || 0) | 0;
    const target = Number(ctx?.target || 0) | 0;
    if (!(source > 0) || !(target > 0)) return;

    // Luck-based mercy: if source has luck >= 5, only confuse defender
    const vit = world.get(source, Vitality);
    const luckyEnough = Number(vit?.luck || 0) >= 5;

    ctx.proc.applyStatus(target, "confused", 2, 1);
    if (!luckyEnough) {
      ctx.proc.applyStatus(source, "confused", 2, 1);
    }
    ctx.proc.message(luckyEnough
      ? "Your wild miss bewilders the enemy!"
      : "Such a spectacular miss — everyone is bewildered!");
    emit(world, "proc:foolsErrand:bewildered", {
      actor: source,
      target,
      selfConfused: !luckyEnough,
    });
  },
});

// ── Venom Clock ───────────────────────────────────────────────────────────
// OnHit: accumulate "venom_clock" stacks on the target (max 3, timer 6).
// On the 3rd stack: detonate — deal shadow chip, apply virulent poison + disease, clear stacks.
registerScript(PROC_PACKAGE_KEYS.VenomClock, {
  [ScriptVerb.ProcEvaluate]: (world, ctx) => {
    if (String(ctx?.kind || "") !== "onHit") return;
    const source = Number(ctx?.source || 0) | 0;
    const target = Number(ctx?.target || 0) | 0;
    if (!(source > 0) || !(target > 0)) return;
    const ae = ensureActiveEffects(world, target);
    if (!ae) return;

    const existing = getEffect(world, target, "venom_clock");
    const nextStacks = Math.max(1, Number(existing?.stacks || 0) + 1);
    if (existing) {
      existing.turnsLeft = 6;
      existing.potency = nextStacks;
      existing.stacks = nextStacks;
    } else {
      ae.effects.push({ key: "venom_clock", turnsLeft: 6, potency: nextStacks, stacks: nextStacks });
    }

    if (nextStacks >= 3) {
      removeEffect(world, target, "venom_clock");
      ctx.proc.dealDamage(target, Math.max(3, Math.floor(Number(ctx?.damage?.amount || 0) * 0.6)), "shadow", {
        source,
        cause: "procPackage:venomClock",
        noTrigger: true,
      });
      ctx.proc.applyStatus(target, "poison", 6, 3);
      ctx.proc.applyStatus(target, "disease", 4, 2);
      ctx.proc.message("The venom clock detonates.");
      emit(world, "proc:venomClock:detonate", { actor: source, target });
      return;
    }

    emit(world, "proc:venomClock:tick", { actor: source, target, stacks: nextStacks });
  },
});

// ── Hollow Tide ───────────────────────────────────────────────────────────
// OnBeforeHit: the lower the attacker's HP, the more damage is added.
// Below 75%: +1. Below 50%: +3 total. Below 25%: +6 total + weaken the target.
// The tide rises as the wielder drowns.
registerScript(PROC_PACKAGE_KEYS.HollowTide, {
  [ScriptVerb.ProcEvaluate]: (world, ctx) => {
    if (String(ctx?.kind || "") !== "onBeforeHit") return;
    const source = Number(ctx?.source || 0) | 0;
    const target = Number(ctx?.target || 0) | 0;
    if (!(source > 0)) return;
    const vit = world.get(source, Vitality);
    if (!vit || !(Number(vit.maxHp) > 0)) return;
    const ratio = Number(vit.hp) / Number(vit.maxHp);

    if (ratio < 0.25) {
      ctx.proc.addBonusDamage(6);
      if (target > 0) ctx.proc.applyStatus(target, "weaken", 3, 1);
      emit(world, "proc:hollowTide:surge", { actor: source, target, tier: 3 });
    } else if (ratio < 0.50) {
      ctx.proc.addBonusDamage(3);
      emit(world, "proc:hollowTide:surge", { actor: source, target, tier: 2 });
    } else if (ratio < 0.75) {
      ctx.proc.addBonusDamage(1);
      emit(world, "proc:hollowTide:surge", { actor: source, target, tier: 1 });
    }
  },
});

const PROC_PACKAGE_SPECS = Object.freeze([
  Object.freeze({
    id: "echoStrike",
    name: "Echo Strike",
    summary: "Stores the last landed hit and replays part of it as spectral force on the next swing.",
    stateKeys: Object.freeze(["echo_strike_memory"]),
    hostIdeas: Object.freeze(["duelist blades", "memory gems", "echoing relics"]),
    passiveExpressions: Object.freeze([]),
    procTrees: Object.freeze([
      Object.freeze({ trigger: "onBeforeHit", script: PROC_PACKAGE_KEYS.EchoStrike, priority: 10 }),
      Object.freeze({ trigger: "onHit", script: PROC_PACKAGE_KEYS.EchoStrike, priority: 20 }),
    ]),
  }),
  Object.freeze({
    id: "ricochetTheology",
    name: "Ricochet Theology",
    summary: "Wall-adjacent hits refract into a nearby hostile as arcane backlash.",
    stateKeys: Object.freeze([]),
    hostIdeas: Object.freeze(["sanctified bucklers", "mirror bows", "cathedral hammers"]),
    passiveExpressions: Object.freeze([]),
    procTrees: Object.freeze([
      Object.freeze({
        trigger: "onHit",
        script: PROC_PACKAGE_KEYS.RicochetTheology,
        priority: 10,
        gates: Object.freeze([gateHasActionTag("ranged"), gateHasActionTag("projectile")]),
      }),
    ]),
  }),
  Object.freeze({
    id: "doomClock",
    name: "Doom Clock",
    summary: "Repeated hits build a visible countdown that detonates into shadow punishment on the third toll.",
    stateKeys: Object.freeze(["doom_clock"]),
    hostIdeas: Object.freeze(["cursed rings", "oracular pendants", "judgment blades"]),
    passiveExpressions: Object.freeze([]),
    procTrees: Object.freeze([
      Object.freeze({ trigger: "onHit", script: PROC_PACKAGE_KEYS.DoomClock, priority: 10 }),
    ]),
  }),
  Object.freeze({
    id: "soulMortgage",
    name: "Soul Mortgage",
    summary: "Front-loads obscene crit power and quietly accrues soul debt for later divine reckoning.",
    stateKeys: Object.freeze(["soul_mortgage_debt"]),
    deferredHooks: Object.freeze(["onDeath", "onShrineInteract"]),
    hostIdeas: Object.freeze(["cursed early weapons", "warlock heirlooms", "shrine bargains"]),
    passiveExpressions: Object.freeze([
      Object.freeze(exprAddConst("critChance", 0.12, { stage: "derived", priority: 10 })),
      Object.freeze(exprAddConst("critMultiplier", 0.75, { stage: "derived", priority: 10 })),
      Object.freeze(exprAddConst("baseDamageMin", 2, { stage: "base", priority: 10 })),
      Object.freeze(exprAddConst("baseDamageMax", 4, { stage: "base", priority: 10 })),
    ]),
    procTrees: Object.freeze([
      Object.freeze({ trigger: "onHit", script: PROC_PACKAGE_KEYS.SoulMortgage, priority: 10 }),
    ]),
  }),
  Object.freeze({
    id: "cataclysmChain",
    name: "Cataclysm Chain",
    summary: "Crit kills fork into local combat weather: hazard, wave, marks, and detonation follow-through.",
    stateKeys: Object.freeze(["cataclysm_mark"]),
    hostIdeas: Object.freeze(["apocalypse relics", "boss artifacts", "doomsday gems"]),
    passiveExpressions: Object.freeze([]),
    procTrees: Object.freeze([
      Object.freeze({ trigger: "onCritKill", script: PROC_PACKAGE_KEYS.CataclysmChain, priority: 10 }),
      Object.freeze({ trigger: "onBeforeHit", script: PROC_PACKAGE_KEYS.CataclysmChain, priority: 20 }),
      Object.freeze({ trigger: "onHit", script: PROC_PACKAGE_KEYS.CataclysmChain, priority: 30 }),
    ]),
  }),
  Object.freeze({
    id: "bloodTithe",
    name: "Blood Tithe",
    summary: "Banks a fraction of every wound you deal; when you take a hit the debt is repaid as healing.",
    stateKeys: Object.freeze(["blood_tithe_debt"]),
    hostIdeas: Object.freeze(["sanguine rings", "leech blades", "blood-pact talismans"]),
    passiveExpressions: Object.freeze([]),
    procTrees: Object.freeze([
      Object.freeze({ trigger: "onHit", script: PROC_PACKAGE_KEYS.BloodTithe, priority: 10 }),
      Object.freeze({ trigger: "onDamaged", script: PROC_PACKAGE_KEYS.BloodTithe, priority: 10 }),
    ]),
  }),
  Object.freeze({
    id: "foolsErrand",
    name: "Fool's Errand",
    summary: "Whiffed attacks have a chance to confuse everyone involved — you included.",
    stateKeys: Object.freeze([]),
    hostIdeas: Object.freeze(["jester bells", "chaos wands", "drunken-master wraps"]),
    passiveExpressions: Object.freeze([]),
    procTrees: Object.freeze([
      Object.freeze({
        trigger: "onMiss",
        script: PROC_PACKAGE_KEYS.FoolsErrand,
        priority: 10,
        gates: Object.freeze([gateChance(0.3)]),
      }),
    ]),
  }),
  Object.freeze({
    id: "venomClock",
    name: "Venom Clock",
    summary: "Three consecutive hits on a target detonate a burst of shadow damage, virulent poison, and disease. The clock resets if the target goes untouched for 6 turns.",
    stateKeys: Object.freeze(["venom_clock"]),
    hostIdeas: Object.freeze(["plague daggers", "assassin relics", "corrupted fangs"]),
    passiveExpressions: Object.freeze([]),
    procTrees: Object.freeze([
      Object.freeze({ trigger: "onHit", script: PROC_PACKAGE_KEYS.VenomClock, priority: 10 }),
    ]),
  }),
  Object.freeze({
    id: "hollowTide",
    name: "Hollow Tide",
    summary: "Bonus damage scales inversely with the wielder's remaining HP. Below 75% HP: +1. Below 50%: +3. Below 25%: +6 and weakens the target. The closer to death, the more dangerous.",
    stateKeys: Object.freeze([]),
    hostIdeas: Object.freeze(["berserker blades", "death-wish hammers", "last-stand relics"]),
    passiveExpressions: Object.freeze([]),
    procTrees: Object.freeze([
      Object.freeze({ trigger: "onBeforeHit", script: PROC_PACKAGE_KEYS.HollowTide, priority: 5 }),
    ]),
  }),
]);

const PROC_PACKAGE_REGISTRY = new Map(PROC_PACKAGE_SPECS.map((spec) => [spec.id, spec]));

export function getProcPackage(id) {
  return PROC_PACKAGE_REGISTRY.get(String(id || "")) || null;
}

export function listProcPackages() {
  return Array.from(PROC_PACKAGE_REGISTRY.values());
}

export function listProcPackageIds() {
  return Array.from(PROC_PACKAGE_REGISTRY.keys());
}

export function attachProcPackage(world, parentId, packageId) {
  const spec = getProcPackage(packageId);
  const resolvedParentId = Number(parentId || 0) | 0;
  if (!spec || !(resolvedParentId > 0) || !world?.isAlive?.(resolvedParentId)) return 0;

  const packageNodeId = addAttachedComponent(world, resolvedParentId, ProcPackageNode, {
    packageId: spec.id,
  });

  for (let i = 0; i < spec.passiveExpressions.length; i++) {
    attachDerivedExpression(world, packageNodeId, { ...spec.passiveExpressions[i] });
  }

  for (let i = 0; i < spec.procTrees.length; i++) {
    const tree = spec.procTrees[i];
    attachProcNode(world, packageNodeId, {
      priority: Number(tree.priority || 0),
      gates: [gateEventKind(tree.trigger), ...(Array.isArray(tree.gates) ? tree.gates : [])],
      script: tree.script,
    });
  }

  return packageNodeId;
}

export function detachProcPackages(world, parentId, packageId = "") {
  const resolvedParentId = Number(parentId || 0) | 0;
  const wanted = String(packageId || "");
  if (!(resolvedParentId > 0) || !world?.isAlive?.(resolvedParentId)) return 0;

  let removed = 0;
  for (const childId of children(world, resolvedParentId)) {
    const marker = world.get(childId, ProcPackageNode);
    if (!marker) continue;
    if (wanted && String(marker.packageId || "") !== wanted) continue;
    destroySubtree(world, childId);
    removed += 1;
  }
  return removed;
}

export function hasProcPackageScript(id) {
  return !!getScriptHandlers(id);
}
