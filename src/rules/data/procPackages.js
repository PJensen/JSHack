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
  gateEventKind,
} from "../utils/statProcAuthoring.js";

export const PROC_PACKAGE_KEYS = Object.freeze({
  EchoStrike: "procPackage:echoStrike",
  RicochetTheology: "procPackage:ricochetTheology",
  DoomClock: "procPackage:doomClock",
  SoulMortgage: "procPackage:soulMortgage",
  CataclysmChain: "procPackage:cataclysmChain",
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
    || a.pos.y - b.pos.y
    || a.pos.x - b.pos.x
    || a.id - b.id;
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

    const sourceFaction = world.get(source, Faction)?.key || "";
    const ricochetTargets = [];
    for (const [nearId] of world.query(Position)) {
      if (!isHostileNear(world, source, pos, nearId, 2) || nearId === target) continue;
      const targetFaction = world.get(nearId, Faction)?.key || "";
      if (!areFactionsHostile(sourceFaction, targetFaction)) continue;
      const nearPos = world.get(nearId, Position);
      if (!nearPos) continue;
      ricochetTargets.push({
        id: nearId,
        pos: nearPos,
        distance: Math.max(Math.abs((nearPos.x | 0) - (pos.x | 0)), Math.abs((nearPos.y | 0) - (pos.y | 0))),
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
      Object.freeze({ trigger: "onHit", script: PROC_PACKAGE_KEYS.RicochetTheology, priority: 10 }),
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
      gates: [gateEventKind(tree.trigger)],
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
