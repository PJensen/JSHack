import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { buildWorldView } from "../src/bridge/schema/worldView.js";
import { Player } from "../src/rules/components/Player.js";
import { Position } from "../src/rules/components/Position.js";
import { NamedIdentity } from "../src/rules/components/NamedIdentity.js";
import { Facing } from "../src/rules/components/Facing.js";

Deno.test("WorldView projects normalized facing vector for visible actors", () => {
  const world = new World({ seed: 0xC0FFEE });

  const player = world.create();
  world.add(player, Player, {});
  world.add(player, Position, { x: 10, y: 10 });
  world.add(player, NamedIdentity, { name: "Hero", identity: "player" });
  world.add(player, Facing, { dx: 3, dy: -2 });

  const view = buildWorldView(world);
  const playerView = view.entities.find((e) => e.id === player);
  assert(playerView, "expected player in world view");
  assert(playerView.facing, "expected player facing to be projected");
  assertEquals(playerView.facing, { dx: 1, dy: -1 });
});

Deno.test("WorldView omits zero facing vectors", () => {
  const world = new World({ seed: 0xA77A77 });

  const player = world.create();
  world.add(player, Player, {});
  world.add(player, Position, { x: 6, y: 6 });
  world.add(player, NamedIdentity, { name: "Hero", identity: "player" });
  world.add(player, Facing, { dx: 0, dy: 0 });

  const view = buildWorldView(world);
  const playerView = view.entities.find((e) => e.id === player);
  assert(playerView, "expected player in world view");
  assertEquals(playerView.facing, null);
});
