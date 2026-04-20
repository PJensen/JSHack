import { assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { FloatText } from "../src/display/passes/vfx/text/floatText.js";
import { installFloatTextWiring } from "../src/display/ui/wiring/floatTextWiring.js";

Deno.test("floatText addStatus respects caller overrides", () => {
  const ftext = new FloatText();
  const rec = ftext.addStatus(4, 5, "GAZE 4/5", {
    color: "#ff5fd2",
    life: 1.25,
    scaleStart: 1.4,
    scaleEnd: 0.9,
  });

  assertEquals(rec.color, "#ff5fd2");
  assertEquals(rec.life, 1.25);
  assertEquals(rec.scaleStart, 1.4);
  assertEquals(rec.scaleEnd, 0.9);
});

Deno.test("floatText wiring restores damage number emission with crit and delay", () => {
  const world = new World({ seed: 7 });
  const target = world.create();
  const source = world.create();
  const calls = [];
  const ftext = {
    addStatus() {},
    addHeal() {},
    addDamage(x, y, amount, opts) { calls.push({ x, y, amount, opts }); },
  };
  const fx = { pool: { spawn() {} } };
  const getPosition = (id) => {
    if (id === target) return { x: 3, y: 4 };
    if (id === source) return { x: 1, y: 4 };
    return null;
  };

  installFloatTextWiring({
    world,
    ftext,
    fx,
    getPosition,
    isPet: () => false,
    isPlayer: (id) => id === target,
  });

  world.emit("damaged", {
    target,
    source,
    amount: 12,
    rawAmount: 14,
    type: "pierce",
    cause: "ranged",
    critical: true,
    projectileDelay: 0.25,
    goreType: "blood",
    targetKind: "player",
  });

  assertEquals(calls.length, 1);
  assertEquals(calls[0].x, 3.5);
  assertEquals(calls[0].y, 3.7);
  assertEquals(calls[0].amount, 12);
  assertEquals(calls[0].opts?.crit, true);
  assertEquals(calls[0].opts?.delay, 0.25);
  assertEquals(calls[0].opts?.color, "#ff6060");
});

Deno.test("floatText wiring shows quest progress status text", () => {
  const world = new World({ seed: 8 });
  const player = world.create();
  const calls = [];
  const ftext = {
    addStatus(x, y, text, opts) { calls.push({ x, y, text, opts }); },
    addHeal() {},
    addDamage() {},
    addGold() {},
  };
  const fx = { pool: { spawn() {} } };

  installFloatTextWiring({
    world,
    ftext,
    fx,
    getPosition: (id) => (id === player ? { x: 6, y: 7 } : null),
    isPet: () => false,
    isPlayer: (id) => id === player,
  });

  world.emit("quest:progress", {
    questId: "starter.rat_infestation",
    playerId: player,
    progress: 3,
    target: 5,
    label: "RATS",
  });

  assertEquals(calls.length, 1);
  assertEquals(calls[0].x, 6);
  assertEquals(calls[0].y, 6.05);
  assertEquals(calls[0].text, "RATS 3/5");
  assertEquals(calls[0].opts?.color, "#ffd85a");
});
