import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { buildWorldView } from "../src/bridge/schema/worldView.js";
import { collectLightSources } from "../src/display/lighting/sources/index.js";
import { materializeSpawn } from "../src/rules/environment/dungeon/populate.js";
import { Position } from "../src/rules/components/Position.js";
import { Player } from "../src/rules/components/Player.js";
import { NamedIdentity } from "../src/rules/components/NamedIdentity.js";
import { Material } from "../src/rules/components/Material.js";
import { Trap } from "../src/rules/components/Trap.js";

Deno.test("dungeon atmospheric decorations materialize as concrete world objects", () => {
  const world = new World({ seed: 42 });
  const kinds = [
    "candle_cluster",
    "ember_brazier",
    "glowcap_patch",
    "web_mote_cluster",
    "armor_stand",
    "polished_mirror",
    "void_crack",
    "dark_reliquary",
    "mist_vent",
  ];

  for (let i = 0; i < kinds.length; i++) {
    const id = materializeSpawn(world, { x: i + 1, y: 3, kind: kinds[i], params: {} });
    assert(id > 0, `${kinds[i]} should materialize`);
    assertEquals(world.get(id, NamedIdentity)?.identity, kinds[i]);
    assert(world.get(id, Position), `${kinds[i]} should have a position`);
    assert(world.get(id, Material), `${kinds[i]} should have a material`);
  }
});

Deno.test("worldView derives optical interaction from existing material facts", () => {
  const world = new World({ seed: 42 });
  const player = world.create();
  world.add(player, Player, {});
  world.add(player, Position, { x: 4, y: 5 });
  const id = world.create();
  world.add(id, Position, { x: 5, y: 5 });
  world.add(id, NamedIdentity, { name: "Armor Stand", identity: "armor_stand" });
  world.add(id, Material, { kind: "steel" });

  const view = buildWorldView(world);
  const rec = view.entities.find((e) => e.id === id);
  assert(rec, "armor stand should be projected");
  assert(rec.matOptical, "steel decoration should receive material optical data");
  assert(rec.matOptical.lightReflect > 0.15, "steel should be reflective enough for glints");
});

Deno.test("worldView projects revealed armed shock traps as semantic trap state", () => {
  const world = new World({ seed: 42 });
  const player = world.create();
  world.add(player, Player, {});
  world.add(player, Position, { x: 7, y: 8 });
  const id = world.create();
  world.add(id, Position, { x: 8, y: 8 });
  world.add(id, NamedIdentity, { name: "Shock Trap", identity: "trap_shock" });
  world.add(id, Trap, {
    type: "shock",
    revealed: true,
    armed: true,
    script: "trap_shock",
    params: { percent: 0.15 },
  });

  const view = buildWorldView(world);
  const rec = view.entities.find((e) => e.id === id);
  assert(rec, "revealed shock trap should be projected");
  assert(rec.tags.includes("trap_shock"));
  assert(rec.tags.includes("trap_armed"));
});

Deno.test("collectLightSources infers dungeon atmosphere from decoration identity", () => {
  const view = {
    turn: 1,
    player: null,
    entities: [
      { id: 1, kind: "candle_cluster", pos: { x: 1, y: 1 }, tags: [] },
      { id: 2, kind: "glowcap_patch", pos: { x: 3, y: 1 }, tags: [] },
      { id: 3, kind: "void_crack", pos: { x: 5, y: 1 }, tags: [] },
      { id: 4, kind: "trap_shock", pos: { x: 7, y: 1 }, tags: ["trap_shock", "trap_armed"] },
    ],
  };

  const lights = collectLightSources(view, { fxTime: 1, dt: 0.016 });
  assert(lights.some((l) => l.x === 1.5 && Array.isArray(l.color) && l.color[0] > l.color[2]), "candle should emit warm light");
  assert(lights.some((l) => l.x === 3.5 && Array.isArray(l.color) && l.color[1] > l.color[0]), "glowcap should emit green-blue light");
  assert(lights.some((l) => l.kind === "void" && l.x === 5.5), "void crack should emit absorptive light");
  assert(lights.some((l) => l.x === 7.5 && Array.isArray(l.color) && l.color[2] >= l.color[0]), "armed shock trap should emit storm light");
});
