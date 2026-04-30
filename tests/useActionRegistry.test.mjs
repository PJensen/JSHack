import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { Channeling } from "../src/rules/components/Channeling.js";
import { channelingSystem } from "../src/rules/systems/channelingSystem.js";
import { defineUseAction, getChannelAction, getUseAction } from "../src/rules/content/useActions/useActionRegistry.js";

Deno.test("use-action registry exposes canonical lookup and compatibility alias", () => {
  const action = {
    channelTurns: 3,
    targeting: { name: "Test Tool" },
    onComplete() {},
  };

  defineUseAction("test_tool", action);

  assertEquals(getUseAction("test_tool")?.channelTurns, 3);
  assertEquals(getUseAction("test_tool")?.targeting?.name, "Test Tool");
  assertEquals(getChannelAction("test_tool"), getUseAction("test_tool"));
});

Deno.test("channeling completion dispatches item use-actions by itemActionId", () => {
  const world = new World({ seed: 4401 });
  const actor = world.create();
  const completions = [];

  defineUseAction("test_channel_tool", {
    onComplete(world, actorId, channel) {
      completions.push({
        actorId,
        x: channel.x,
        y: channel.y,
        itemActionId: channel.itemActionId,
      });
    },
  });

  world.add(actor, Channeling, {
    mode: "cast",
    turnsRemaining: 1,
    turnsTotal: 1,
    spellId: "not_a_spell",
    itemActionId: "test_channel_tool",
    x: 4,
    y: 5,
  });

  channelingSystem(world);

  assertEquals(world.has(actor, Channeling), false);
  assertEquals(completions, [{
    actorId: actor,
    x: 4,
    y: 5,
    itemActionId: "test_channel_tool",
  }]);
});

Deno.test("fishing registers as a use-action", async () => {
  await import("../src/rules/content/useActions/fishingAction.js");
  const { installFishingAction } = await import("../src/rules/content/useActions/fishingAction.js");
  const world = new World({ seed: 4402 });

  installFishingAction(world);

  const action = getUseAction("fishing_rod");
  assert(action, "expected fishing_rod use-action to be registered");
  assertEquals(action?.channelTurns, 12);
  assertEquals(action?.targeting?.name, "Fishing");
  assertEquals(typeof action?.onComplete, "function");
});
