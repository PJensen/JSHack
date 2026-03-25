import { assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { createPlayer } from "../src/rules/archetypes/Player.js";
import { Vitality } from "../src/rules/components/Vitality.js";
import { Status } from "../src/rules/components/Status.js";
import { ActiveEffects } from "../src/rules/components/ActiveEffects.js";
import { getChannelInterruptionReason } from "../src/rules/utils/channelInterruptionPolicy.js";

Deno.test("channelInterruptionPolicy: canonical reasons and aliases", () => {
  const world = new World({ seed: 0xC0FFEE });
  const player = createPlayer(world, { x: 0, y: 0, name: "Tester" });

  assertEquals(getChannelInterruptionReason(world, player), "");

  world.add(player, Status, { statuses: [{ type: "silence", duration: 2, potency: 1, stacks: 1 }] });
  assertEquals(getChannelInterruptionReason(world, player), "silenced");
  world.set(player, Status, { statuses: [] });

  world.add(player, Status, { statuses: [{ type: "sleep", duration: 2, potency: 1, stacks: 1 }] });
  assertEquals(getChannelInterruptionReason(world, player), "asleep");
  world.set(player, Status, { statuses: [] });

  world.add(player, ActiveEffects, { effects: [{ key: "stun", turnsLeft: 2, potency: 1, stacks: 1 }] });
  assertEquals(getChannelInterruptionReason(world, player), "stunned");
  world.set(player, ActiveEffects, { effects: [] });

  world.add(player, Status, { statuses: [{ type: "mindlock", duration: 2, potency: 1, stacks: 1 }] });
  assertEquals(getChannelInterruptionReason(world, player), "mindlocked");
  world.set(player, Status, { statuses: [] });

  world.set(player, Vitality, { maxHp: 20, hp: 0 });
  world.add(player, Status, { statuses: [{ type: "silenced", duration: 2, potency: 1, stacks: 1 }] });
  assertEquals(getChannelInterruptionReason(world, player), "dead");
});

