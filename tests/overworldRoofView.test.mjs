import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { buildWorldView } from "../src/bridge/schema/worldView.js";
import { initDungeon } from "../src/rules/environment/dungeon/index.js";
import { clearAll } from "../src/rules/environment/dungeon/tileMap.js";
import { clearExplored } from "../src/rules/environment/dungeon/exploredMap.js";
import { NamedIdentity } from "../src/rules/components/NamedIdentity.js";
import { Player } from "../src/rules/components/Player.js";
import { Position } from "../src/rules/components/Position.js";

function posOfIdentity(world, identity) {
  for (const [, ident, pos] of world.query(NamedIdentity, Position)) {
    if (ident.identity === identity) return { x: pos.x, y: pos.y };
  }
  throw new Error(`missing ${identity}`);
}

function roofHas(view, x, y) {
  return Array.isArray(view.roofs) && view.roofs.some((roof) => roof.x === x && roof.y === y);
}

function roofAt(view, x, y) {
  return Array.isArray(view.roofs) ? view.roofs.find((roof) => roof.x === x && roof.y === y) ?? null : null;
}

Deno.test("overworld roofs appear from outside and hide only the building the player is inside", () => {
  clearAll();
  clearExplored();

  const world = new World({ seed: 0xC0FFEE });
  const spawn = initDungeon(world, { startDepth: 0 });
  const player = world.create();
  world.add(player, Player, {});
  world.add(player, NamedIdentity, { name: "Hero", identity: "player" });
  world.add(player, Position, { x: spawn.x, y: spawn.y });

  const houseInterior = posOfIdentity(world, "alchemy_bench");
  const tavernInterior = posOfIdentity(world, "tavern_keg");
  const windmillInterior = posOfIdentity(world, "millstone");

  let view = buildWorldView(world);
  assert(roofHas(view, houseInterior.x, houseInterior.y), "house roof should show while the player is outside");
  assert(roofHas(view, tavernInterior.x, tavernInterior.y), "tavern roof should show while the player is outside");
  assert(roofHas(view, windmillInterior.x, windmillInterior.y), "windmill roof should show while the player is outside");
  assert(!view.isVisible?.(houseInterior.x, houseInterior.y), "house interior should still be hidden by walls while the player is outside");
  assert(roofAt(view, houseInterior.x, houseInterior.y)?.alpha === 1, "house roof should still render at full alpha while the shell is visible");

  world.set(player, Position, houseInterior);
  view = buildWorldView(world);
  assert(!roofHas(view, houseInterior.x, houseInterior.y), "house roof should hide when the player steps inside");
  assert(roofHas(view, tavernInterior.x, tavernInterior.y), "tavern roof should remain visible when the player is in the house");
  assert(roofHas(view, windmillInterior.x, windmillInterior.y), "windmill roof should remain visible when the player is in the house");

  world.set(player, Position, tavernInterior);
  view = buildWorldView(world);
  assert(roofHas(view, houseInterior.x, houseInterior.y), "house roof should reappear when the player leaves it");
  assert(!roofHas(view, tavernInterior.x, tavernInterior.y), "tavern roof should hide when the player steps inside");
  assert(roofHas(view, windmillInterior.x, windmillInterior.y), "windmill roof should remain visible when the player is in the tavern");

  clearAll();
  clearExplored();
});

Deno.test("overworld door roof tiles render translucent so entrances read through the roofline", () => {
  clearAll();
  clearExplored();

  const world = new World({ seed: 0xC0FFEE });
  const spawn = initDungeon(world, { startDepth: 0 });
  const player = world.create();
  world.add(player, Player, {});
  world.add(player, NamedIdentity, { name: "Hero", identity: "player" });
  world.add(player, Position, { x: spawn.x, y: spawn.y });

  const view = buildWorldView(world);
  assertEquals(roofAt(view, spawn.x, spawn.y - 1)?.alpha, 0.4);

  clearAll();
  clearExplored();
});

Deno.test("overworld roof shading bands run straight across each building instead of diagonally", () => {
  clearAll();
  clearExplored();

  const world = new World({ seed: 0xC0FFEE });
  const spawn = initDungeon(world, { startDepth: 0 });
  const player = world.create();
  world.add(player, Player, {});
  world.add(player, NamedIdentity, { name: "Hero", identity: "player" });
  world.add(player, Position, { x: spawn.x, y: spawn.y });

  const tavernInterior = posOfIdentity(world, "tavern_keg");
  const view = buildWorldView(world);

  assertEquals(roofAt(view, tavernInterior.x, tavernInterior.y - 1)?.kind, "roof_thatch_shadow");
  assertEquals(roofAt(view, tavernInterior.x + 5, tavernInterior.y - 1)?.kind, "roof_thatch_shadow");
  assertEquals(roofAt(view, tavernInterior.x, tavernInterior.y + 4)?.kind, "roof_thatch_lit");
  assertEquals(roofAt(view, tavernInterior.x + 5, tavernInterior.y + 4)?.kind, "roof_thatch_lit");

  clearAll();
  clearExplored();
});
