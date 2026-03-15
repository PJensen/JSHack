import { assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { Position } from "../src/rules/components/Position.js";
import { NamedIdentity } from "../src/rules/components/NamedIdentity.js";
import { Player } from "../src/rules/components/Player.js";
import { createSceneRuntime } from "../src/main/sceneRuntime.js";

Deno.test("scene runtime plays beats in order and resolves dynamic targets", () => {
  const world = new World({ seed: 7 });
  const playerId = world.create();
  world.add(playerId, Player, {});
  world.add(playerId, Position, { x: 4, y: 4 });

  const speakerId = world.create();
  world.add(speakerId, NamedIdentity, { name: "Priest", identity: "townfolk_priest" });
  world.add(speakerId, Position, { x: 1, y: 4 });

  const runtime = createSceneRuntime({
    world,
    getPlayerEntity: () => ({ id: playerId, pos: world.get(playerId, Position) }),
    getCam: () => ({ scale: 1 }),
    getCanvas: () => ({ width: 320, height: 200, offsetWidth: 320, offsetHeight: 200 }),
    getCanvasSetup: () => ({ cssW: 320, cssH: 200 }),
  });

  const events = [];
  world.on("scene:test", (payload) => events.push(payload));

  runtime.playScene([
    {
      type: "walk",
      resolveEntityId: () => runtime.findEntityIdByIdentity("townfolk_priest"),
      resolveTarget: () => ({ x: 3, y: 4 }),
      stepDelaySec: 0.1,
    },
    {
      type: "emit",
      name: "scene:test",
      payload: () => ({ speakerId: runtime.findEntityIdByIdentity("townfolk_priest") }),
    },
    {
      type: "say",
      entityId: speakerId,
      text: "We should talk.",
      durationSec: 0.2,
    },
  ]);

  runtime.tick(0.4);
  runtime.tick(0.4);
  runtime.tick(0.4);

  assertEquals(world.get(speakerId, Position), { x: 3, y: 4 });
  assertEquals(events, [{ speakerId }]);
});
