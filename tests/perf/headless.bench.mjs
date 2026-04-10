import { createGameRuntime } from "../../src/main/runtime/gameRuntime.js";

const runtimeTick = createGameRuntime({
  seed: 0xC0FFEE,
  classId: "outlaw",
  playerName: "Bench Tick",
  startDepth: 1,
});

const runtimeDispatch = createGameRuntime({
  seed: 0xA77A77,
  classId: "outlaw",
  playerName: "Bench Dispatch",
  startDepth: 1,
});

Deno.bench({
  name: "headless: runtime.tick(1)",
  group: "jshack-headless",
  warmup: 3,
  n: 60,
  fn() {
    runtimeTick.tick(1);
  },
});

Deno.bench({
  name: "headless: dispatch rules.wait",
  group: "jshack-headless",
  warmup: 3,
  n: 60,
  fn() {
    runtimeDispatch.dispatch({ type: "rules.wait", payload: {} });
  },
});

Deno.bench({
  name: "headless: tick + buildWorldView",
  group: "jshack-headless",
  warmup: 3,
  n: 40,
  fn() {
    runtimeTick.tick(1);
    runtimeTick.view();
  },
});
