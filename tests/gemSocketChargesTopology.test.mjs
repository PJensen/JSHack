import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { Charges } from "../src/rules/components/Charges.js";
import { Equipment } from "../src/rules/components/Equipment.js";
import { GemSocketNode } from "../src/rules/components/GemSocketNode.js";
import { ItemInfo } from "../src/rules/components/ItemInfo.js";
import {
  attachGemSocketNodes,
  installGemSocketListener,
} from "../src/rules/data/gemSocketAffixes.js";
import { runScript, ScriptVerb } from "../src/rules/scripting.js";
import { resolveCharges, setCharges } from "../src/rules/utils/charges.js";
import { childrenWith } from "../src/rules/utils/topology.js";

function makeWeapon(world) {
  const weapon = world.create();
  world.add(weapon, ItemInfo, {
    type: "weapon",
    sockets: ["gem_fluorite"],
    maxSockets: 1,
  });
  return weapon;
}

function fluoriteSocket(world, weapon) {
  for (const [nodeId, socket] of childrenWith(world, weapon, GemSocketNode)) {
    if (socket.gemId === "gem_fluorite") return nodeId;
  }
  return 0;
}

Deno.test("fluorite socket owns runtime Charges on its socket node", () => {
  const world = new World({ seed: 7201 });
  const weapon = makeWeapon(world);

  attachGemSocketNodes(world, weapon, "gem_fluorite");

  const socket = fluoriteSocket(world, weapon);
  assert(socket > 0, "fluorite socket node should exist");
  assertEquals(world.get(socket, Charges), { current: 0, max: 6 });
  assertEquals(resolveCharges(world, weapon), {
    entityId: socket,
    current: 0,
    max: 6,
    source: "topology",
  });
  assertEquals(world.get(weapon, ItemInfo).charges, 0);
  assertEquals(world.get(weapon, ItemInfo).maxCharges, 6);
});

Deno.test("fluorite electric charge updates topology and legacy mirror", () => {
  const world = new World({ seed: 7202 });
  const weapon = makeWeapon(world);
  attachGemSocketNodes(world, weapon, "gem_fluorite");

  const events = [];
  runScript("gem_socket:fluorite:charge", ScriptVerb.ProcEvaluate, world, {
    kind: "onDamaged",
    damage: { type: "electric" },
    item: weapon,
    source: 99,
    proc: { emit: (event, payload) => events.push({ event, payload }) },
  });

  const socket = fluoriteSocket(world, weapon);
  assertEquals(world.get(socket, Charges), { current: 2, max: 6 });
  assertEquals(world.get(weapon, ItemInfo).charges, 2);
  assertEquals(events[0]?.event, "proc:fluorite:charge");
  assertEquals(events[0]?.payload?.charges, 2);
});

Deno.test("fluorite discharge spends topology charges and mirrors legacy", () => {
  const world = new World({ seed: 7203 });
  const weapon = makeWeapon(world);
  attachGemSocketNodes(world, weapon, "gem_fluorite");
  setCharges(world, weapon, 4, 6);

  const proc = {
    bonus: 0,
    statuses: [],
    events: [],
    addBonusDamage(min) {
      this.bonus += Number(min || 0);
    },
    applyStatus(target, key, turnsLeft, potency) {
      this.statuses.push({ target, key, turnsLeft, potency });
    },
    emit(event, payload) {
      this.events.push({ event, payload });
    },
  };

  runScript("gem_socket:fluorite:discharge", ScriptVerb.ProcEvaluate, world, {
    kind: "onBeforeHit",
    item: weapon,
    source: 1,
    target: 2,
    proc,
  });

  const socket = fluoriteSocket(world, weapon);
  assertEquals(world.get(socket, Charges), { current: 0, max: 6 });
  assertEquals(world.get(weapon, ItemInfo).charges, 0);
  assertEquals(proc.bonus, 8);
  assertEquals(proc.statuses, [{ target: 2, key: "blinded", turnsLeft: 1, potency: 1 }]);
  assertEquals(proc.events[0]?.payload?.chargesSpent, 4);
});

Deno.test("shrine combat scaling charges fluorite on equipped weapon", () => {
  const world = new World({ seed: 7204 });
  const actor = world.create();
  const weapon = makeWeapon(world);
  world.add(actor, Equipment, { weapon });
  attachGemSocketNodes(world, weapon, "gem_fluorite");
  installGemSocketListener(world);

  const events = [];
  world.on("proc:fluorite:charge", (event) => events.push(event));

  world.emit("shrine:combat:scaling", { attacker: actor, mult: 1.5 });

  const socket = fluoriteSocket(world, weapon);
  assertEquals(world.get(socket, Charges), { current: 1, max: 6 });
  assertEquals(world.get(weapon, ItemInfo).charges, 1);
  assertEquals(events[0]?.source, "shrine");
});
