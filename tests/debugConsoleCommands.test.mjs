import { assertEquals, assertStringIncludes } from "jsr:@std/assert";

import { World } from "../src/lib/ecs-js/index.js";
import {
  formatNpcWorkStatus,
  registerBuiltinCommands,
} from "../src/main/debug/consoleCommands.js";
import { NamedIdentity } from "../src/rules/components/NamedIdentity.js";
import { Position } from "../src/rules/components/Position.js";
import { TownfolkJob, TOWNFOLK_STATES } from "../src/rules/components/TownfolkJob.js";

function addTownfolk(world, opts) {
  const id = world.create();
  world.add(id, Position, { x: opts.x, y: opts.y });
  world.add(id, NamedIdentity, {
    name: opts.name,
    identity: `townfolk_${opts.role}`,
  });
  world.add(id, TownfolkJob, {
    role: opts.role,
    state: opts.state,
    targetX: opts.targetX,
    targetY: opts.targetY,
    workTurns: opts.workTurns,
    workSiteKind: opts.workSiteKind,
    carrying: opts.carrying || "",
    carryCount: opts.carryCount || 0,
  });
  return id;
}

Deno.test("formatNpcWorkStatus lists town NPC work state", () => {
  const world = new World({ seed: 1 });
  const woodcutter = addTownfolk(world, {
    role: "woodcutter",
    name: "Woodcutter",
    x: 7,
    y: 5,
    state: TOWNFOLK_STATES.working,
    targetX: 8,
    targetY: 5,
    workTurns: 2,
    workSiteKind: "chop",
    carrying: "fuel_firewood",
    carryCount: 1,
  });

  const text = formatNpcWorkStatus(world);

  assertStringIncludes(text, "id, role, x, y, status, workSite, target, workTurns, carrying, name");
  assertStringIncludes(text, `${woodcutter}, woodcutter, 7, 5, working, chop, 8:5, 2, fuel_firewood:1, Woodcutter`);
});

Deno.test("registerBuiltinCommands exposes npc-work-status", () => {
  const commands = new Map();
  const world = new World({ seed: 1 });
  addTownfolk(world, {
    role: "woodcutter",
    name: "Woodcutter",
    x: 3,
    y: 4,
    state: TOWNFOLK_STATES.returning,
    targetX: 1,
    targetY: 2,
    workTurns: 0,
    workSiteKind: "chop",
  });

  registerBuiltinCommands({
    registerCommand(name, helpText, handler) {
      commands.set(name, { helpText, handler });
    },
  }, {
    world,
    messageLog: { log() {} },
  });

  const command = commands.get("npc-work-status");
  assertEquals(command?.helpText, "npc-work-status — list town NPC work state");
  assertStringIncludes(command.handler(""), "woodcutter, 3, 4, returning");
});
