import { assert, assertEquals } from "jsr:@std/assert";
import { children, World } from "../src/lib/ecs-js/index.js";
import { ActiveEffects } from "../src/rules/components/ActiveEffects.js";
import { DerivedExpression } from "../src/rules/components/DerivedExpression.js";
import { Faction } from "../src/rules/components/Faction.js";
import { Position } from "../src/rules/components/Position.js";
import { ProcNode } from "../src/rules/components/ProcNode.js";
import { ProcPackageNode } from "../src/rules/components/ProcPackageNode.js";
import { Vitality } from "../src/rules/components/Vitality.js";
import { CHUNK_SIZE, TILE_FLOOR, TILE_WALL } from "../src/rules/environment/dungeon/constants.js";
import { clearAll, loadChunk } from "../src/rules/environment/dungeon/tileMap.js";
import {
  attachProcPackage,
  detachProcPackages,
  getProcPackage,
  hasProcPackageScript,
  listProcPackageIds,
  PROC_PACKAGE_KEYS,
} from "../src/rules/data/procPackages.js";
import { getScriptHandlers, runScript, ScriptVerb } from "../src/rules/scripting.js";

function makeProcContext(overrides = {}) {
  const directDamage = [];
  const statusesToApply = [];
  const resourcesToRestore = [];
  const vitalityToRestore = [];
  const spawnedEntities = [];
  const messages = [];
  let bonusCritChance = 0;

  return {
    source: overrides.source ?? 1,
    target: overrides.target ?? 2,
    kind: overrides.kind ?? "onHit",
    damage: overrides.damage ?? { amount: 8, type: "physical", crit: false, blocked: false },
    tags: overrides.tags ?? new Set(),
    proc: {
      addBonusDamage(min, max = min, type = "physical") {
        this._bonusDamage = { min, max, type };
      },
      addCritChance(amount) {
        bonusCritChance += Number(amount || 0);
      },
      dealDamage(target, amount, type = "physical", options = {}) {
        directDamage.push({ target, amount, type, ...options });
      },
      applyStatus(target, key, turnsLeft, potency = 1) {
        statusesToApply.push({ target, key, turnsLeft, potency });
      },
      restoreResource(target, resource, amount) {
        resourcesToRestore.push({ target, resource, amount });
      },
      heal(target, amount) {
        vitalityToRestore.push({ target, amount });
      },
      spawnEntity(kind, count = 1, anchor = "target") {
        spawnedEntities.push({ kind, count, anchor });
      },
      message(text) {
        messages.push(text);
      },
      emit() {},
    },
    get directDamage() { return directDamage; },
    get statusesToApply() { return statusesToApply; },
    get resourcesToRestore() { return resourcesToRestore; },
    get vitalityToRestore() { return vitalityToRestore; },
    get spawnedEntities() { return spawnedEntities; },
    get messages() { return messages; },
    get bonusCritChance() { return bonusCritChance; },
  };
}

function collectSubtreeWith(world, rootId, Comp, out = []) {
  const record = world.get(rootId, Comp);
  if (record) out.push({ entityId: rootId, record });
  for (const childId of children(world, rootId)) {
    collectSubtreeWith(world, childId, Comp, out);
  }
  return out;
}

Deno.test("proc package registry exposes all detached moonshots", () => {
  assertEquals(listProcPackageIds(), [
    "echoStrike",
    "ricochetTheology",
    "doomClock",
    "soulMortgage",
    "cataclysmChain",
  ]);
  for (const key of Object.values(PROC_PACKAGE_KEYS)) {
    assert(hasProcPackageScript(key), `expected script ${key} to be registered`);
    assert(getScriptHandlers(key), `expected handlers for ${key}`);
  }
  assertEquals(getProcPackage("soulMortgage")?.deferredHooks, ["onDeath", "onShrineInteract"]);
});

Deno.test("proc package attachment materializes detached topology under a host", () => {
  const world = new World({ seed: 19 });
  const host = world.create();
  const echoRoot = attachProcPackage(world, host, "echoStrike");
  const soulRoot = attachProcPackage(world, host, "soulMortgage");
  const cataclysmRoot = attachProcPackage(world, host, "cataclysmChain");

  assert(world.get(echoRoot, ProcPackageNode));
  assert(world.get(soulRoot, ProcPackageNode));
  assert(world.get(cataclysmRoot, ProcPackageNode));

  assertEquals(collectSubtreeWith(world, echoRoot, ProcNode).length, 2);
  assertEquals(collectSubtreeWith(world, soulRoot, DerivedExpression).length, 4);
  assertEquals(collectSubtreeWith(world, soulRoot, ProcNode).length, 1);
  assertEquals(collectSubtreeWith(world, cataclysmRoot, ProcNode).length, 3);

  assertEquals(detachProcPackages(world, host, "echoStrike"), 1);
  assert(!world.isAlive(echoRoot), "expected detached package subtree to be destroyed");
});

Deno.test("echo strike package stores and replays prior hit memory", () => {
  const world = new World({ seed: 7 });
  const attacker = world.create();
  const defender = world.create();
  world.add(attacker, Vitality, { maxHp: 20, hp: 20 });
  world.add(defender, Vitality, { maxHp: 20, hp: 20 });
  world.add(attacker, ActiveEffects, { effects: [] });

  const onHit = makeProcContext({ source: attacker, target: defender, kind: "onHit", damage: { amount: 10, type: "physical" } });
  runScript(PROC_PACKAGE_KEYS.EchoStrike, ScriptVerb.ProcEvaluate, world, onHit);

  const stored = world.get(attacker, ActiveEffects).effects.find((entry) => entry.key === "echo_strike_memory");
  assert(stored, "expected echo memory to be stored");
  assertEquals(stored.potency, 10);

  const onBeforeHit = makeProcContext({ source: attacker, target: defender, kind: "onBeforeHit", damage: { amount: 4, type: "physical" } });
  runScript(PROC_PACKAGE_KEYS.EchoStrike, ScriptVerb.ProcEvaluate, world, onBeforeHit);
  assert(onBeforeHit.proc._bonusDamage.min > 0, "expected echo strike to replay bonus damage");
});

Deno.test("doom clock package builds debt and detonates on the third toll", () => {
  const world = new World({ seed: 11 });
  const attacker = world.create();
  const defender = world.create();
  world.add(attacker, Vitality, { maxHp: 20, hp: 20 });
  world.add(defender, Vitality, { maxHp: 20, hp: 20 });
  world.add(defender, ActiveEffects, { effects: [] });

  for (let i = 0; i < 2; i++) {
    const ctx = makeProcContext({ source: attacker, target: defender, kind: "onHit" });
    runScript(PROC_PACKAGE_KEYS.DoomClock, ScriptVerb.ProcEvaluate, world, ctx);
  }
  const ticking = world.get(defender, ActiveEffects).effects.find((entry) => entry.key === "doom_clock");
  assert(ticking, "expected doom clock to be ticking");
  assertEquals(ticking.stacks, 2);

  const third = makeProcContext({ source: attacker, target: defender, kind: "onHit", damage: { amount: 12, type: "physical" } });
  runScript(PROC_PACKAGE_KEYS.DoomClock, ScriptVerb.ProcEvaluate, world, third);
  assert(third.directDamage.length > 0, "expected doom clock to detonate into direct damage");
  assert(third.statusesToApply.some((entry) => entry.key === "stun"), "expected doom clock to apply stun");
});

Deno.test("ricochet theology package rebounds off wall-adjacent targets", () => {
  const world = new World({ seed: 13 });
  const attacker = world.create();
  const defender = world.create();
  const bystander = world.create();
  world.add(attacker, Position, { x: 1, y: 1 });
  world.add(defender, Position, { x: 2, y: 1 });
  world.add(bystander, Position, { x: 3, y: 1 });
  world.add(attacker, Faction, { key: "player" });
  world.add(defender, Faction, { key: "enemy" });
  world.add(bystander, Faction, { key: "enemy" });
  world.add(attacker, Vitality, { maxHp: 20, hp: 20 });
  world.add(defender, Vitality, { maxHp: 20, hp: 20 });
  world.add(bystander, Vitality, { maxHp: 20, hp: 20 });

  clearAll();
  const tiles = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE).fill(TILE_FLOOR);
  tiles[0 * CHUNK_SIZE + 2] = TILE_WALL;
  loadChunk(0, 0, tiles);

  const ctx = makeProcContext({
    source: attacker,
    target: defender,
    kind: "onHit",
    damage: { amount: 10, type: "physical" },
    tags: new Set(["wallRicochet"]),
  });
  runScript(PROC_PACKAGE_KEYS.RicochetTheology, ScriptVerb.ProcEvaluate, world, ctx);
  assert(ctx.directDamage.some((entry) => entry.target === bystander), "expected ricochet to hit a nearby hostile");
});

Deno.test("cataclysm chain package marks nearby hostiles and cashes a marked follow-up into crit pressure", () => {
  const world = new World({ seed: 23 });
  const attacker = world.create();
  const corpse = world.create();
  const marked = world.create();
  world.add(attacker, Position, { x: 1, y: 1 });
  world.add(corpse, Position, { x: 2, y: 1 });
  world.add(marked, Position, { x: 3, y: 1 });
  world.add(attacker, Faction, { key: "player" });
  world.add(corpse, Faction, { key: "enemy" });
  world.add(marked, Faction, { key: "enemy" });
  world.add(attacker, Vitality, { maxHp: 20, hp: 20 });
  world.add(corpse, Vitality, { maxHp: 20, hp: 0 });
  world.add(marked, Vitality, { maxHp: 20, hp: 20 });
  world.add(marked, ActiveEffects, { effects: [] });

  const onCritKill = makeProcContext({
    source: attacker,
    target: corpse,
    kind: "onCritKill",
    damage: { amount: 14, type: "physical", crit: true },
  });
  runScript(PROC_PACKAGE_KEYS.CataclysmChain, ScriptVerb.ProcEvaluate, world, onCritKill);
  assert(onCritKill.spawnedEntities.some((entry) => entry.kind === "cataclysm_hazard"), "expected cataclysm hazard spawn");
  assert(onCritKill.statusesToApply.some((entry) => entry.target === marked && entry.key === "cataclysm_mark"), "expected nearby enemy to be marked");

  world.get(marked, ActiveEffects).effects.push({ key: "cataclysm_mark", turnsLeft: 4, potency: 1, stacks: 1 });
  const onBeforeHit = makeProcContext({
    source: attacker,
    target: marked,
    kind: "onBeforeHit",
    damage: { amount: 8, type: "physical", crit: false },
  });
  runScript(PROC_PACKAGE_KEYS.CataclysmChain, ScriptVerb.ProcEvaluate, world, onBeforeHit);
  assert(onBeforeHit.bonusCritChance > 0, "expected marked follow-up to gain forced crit pressure");
});
