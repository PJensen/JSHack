import { assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { Position } from "../src/rules/components/Position.js";
import { createDelayedDeathFxController } from "../src/display/fx/delayedDeathFxController.js";

function createFxHarness() {
  let fxTime = 0;
  return {
    getFxTime: () => fxTime,
    advance: (dt) => { fxTime += Number(dt || 0); },
  };
}

Deno.test("delayed death fx hides corpse/loot until projectile impact window closes", () => {
  const world = new World({ seed: 1 });
  const victim = world.create();
  const corpse = world.create();
  const gold = world.create();
  world.add(victim, Position, { x: 4, y: 7 });

  const harness = createFxHarness();
  const fx = createDelayedDeathFxController({ world, getFxTime: harness.getFxTime });
  fx.installListeners();

  world.emit("damaged", { target: victim, projectileDelay: 0.5 });
  world.emit("died", { id: victim });
  world.emit("item:dropped", { itemId: corpse, at: { x: 4, y: 7 } });
  world.emit("item:dropped", { itemId: gold, at: { x: 4, y: 7 } });

  assertEquals(fx.isItemHidden(corpse), true);
  assertEquals(fx.isItemHidden(gold), true);

  harness.advance(0.49);
  fx.tick(0.49);
  assertEquals(fx.isItemHidden(corpse), true);

  harness.advance(0.02);
  fx.tick(0.02);
  assertEquals(fx.isItemHidden(corpse), false);
  assertEquals(fx.isItemHidden(gold), false);
});

Deno.test("delayed death fx ignores immediate deaths without projectile delay", () => {
  const world = new World({ seed: 1 });
  const victim = world.create();
  const item = world.create();
  world.add(victim, Position, { x: 1, y: 2 });

  const harness = createFxHarness();
  const fx = createDelayedDeathFxController({ world, getFxTime: harness.getFxTime });
  fx.installListeners();

  world.emit("died", { id: victim });
  world.emit("item:dropped", { itemId: item, at: { x: 1, y: 2 } });

  assertEquals(fx.isItemHidden(item), false);
});

Deno.test("delayed death fx preserves the victim render record until impact", () => {
  const world = new World({ seed: 1 });
  const victim = world.create();
  world.add(victim, Position, { x: 9, y: 3 });

  const harness = createFxHarness();
  const fx = createDelayedDeathFxController({ world, getFxTime: harness.getFxTime });
  fx.installListeners();

  const liveEntity = {
    id: victim,
    kind: "orc",
    pos: { x: 9, y: 3 },
    tags: ["enemy"],
    layer: 300,
    hp: 4,
    maxHp: 10,
    isPet: false,
    showHealthBar: true,
  };
  fx.syncWorldView({ entities: [liveEntity] });

  world.emit("damaged", { target: victim, projectileDelay: 0.4 });
  world.emit("died", { id: victim });

  let renderables = fx.getRenderableEntities([]);
  assertEquals(renderables.length, 1);
  assertEquals(renderables[0].id, victim);
  assertEquals(renderables[0].kind, "orc");
  assertEquals(renderables[0].showHealthBar, true);
  assertEquals(renderables[0].hp, 4);

  harness.advance(0.41);
  fx.tick(0.41);
  renderables = fx.getRenderableEntities([]);
  assertEquals(renderables.length, 0);
});
