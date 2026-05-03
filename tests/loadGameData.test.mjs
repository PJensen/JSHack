import "./helpers/installContentMonsters.mjs";
import { assert } from "jsr:@std/assert";
import { getGameDataLoadPlan, loadGameData } from "../src/main/bootstrap/loadGameData.js";

Deno.test("getGameDataLoadPlan exposes monster dataset and total work", () => {
  const plan = getGameDataLoadPlan();
  assert(plan && typeof plan === "object", "plan should exist");
  assert(Array.isArray(plan.datasets) && plan.datasets.length > 0, "datasets should exist");
  assert(Number.isFinite(plan.overallTotal) && plan.overallTotal > 0, "overall total should be > 0");

  const monsters = plan.datasets.find((d) => d.id === "monsters");
  assert(monsters, "monsters dataset should exist");
  assert(Number(monsters.total) > 0, "monsters dataset should have entries");
});

Deno.test("loadGameData emits monotonic overall progress and completes", () => {
  const events = [];
  const result = loadGameData({
    onProgress: (progress) => {
      if (progress?.phase === "data") events.push(progress);
    },
  });

  assert(events.length > 0, "expected progress events");
  assert(result.completed === result.overallTotal, "load should complete all planned work");

  const overallTotal = events[0].overallTotal;
  let lastCompleted = -1;
  let sawMonsters = false;

  for (const evt of events) {
    assert(evt.overallTotal === overallTotal, "overallTotal should stay constant");
    assert(evt.completed >= lastCompleted, "completed should be monotonic");
    if (evt.dataset === "monsters") sawMonsters = true;
    lastCompleted = evt.completed;
  }

  assert(sawMonsters, "should emit monster dataset progress");
  assert(lastCompleted === overallTotal, "final completed should match overallTotal");
});
