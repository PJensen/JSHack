import { assertEquals } from "jsr:@std/assert";
import { World, defineComponent } from "../src/lib/ecs-js/index.js";
import { attach } from "../src/lib/ecs-js/hierarchy.js";
import {
  childrenWith,
  descendantsWith,
  firstChildWith,
} from "../src/rules/utils/topology.js";

const Marker = defineComponent("TopologyTestMarker", {
  label: "",
});

const Other = defineComponent("TopologyTestOther", {
  label: "",
});

function makeWorld() {
  return new World({ seed: 0xC0FFEE });
}

function entity(world, Component = null, value = {}) {
  const id = world.create();
  if (Component) world.add(id, Component, value);
  return id;
}

Deno.test("childrenWith yields direct matching children in ECS child order", () => {
  const world = makeWorld();
  const parent = entity(world);
  const first = entity(world, Marker, { label: "first" });
  const skipped = entity(world, Other, { label: "skipped" });
  const second = entity(world, Marker, { label: "second" });

  attach(world, first, parent);
  attach(world, skipped, parent);
  attach(world, second, parent);

  assertEquals([...childrenWith(world, parent, Marker)], [
    [first, { label: "first" }],
    [second, { label: "second" }],
  ]);
});

Deno.test("firstChildWith returns first direct matching child or null", () => {
  const world = makeWorld();
  const parent = entity(world);
  const skipped = entity(world, Other, { label: "skipped" });
  const match = entity(world, Marker, { label: "match" });

  attach(world, skipped, parent);
  attach(world, match, parent);

  assertEquals(firstChildWith(world, parent, Marker), [match, { label: "match" }]);
  assertEquals(firstChildWith(world, skipped, Marker), null);
});

Deno.test("descendantsWith yields matching descendants depth-first", () => {
  const world = makeWorld();
  const root = entity(world);
  const branchA = entity(world, Marker, { label: "branch-a" });
  const leafA = entity(world, Marker, { label: "leaf-a" });
  const branchB = entity(world);
  const leafB = entity(world, Marker, { label: "leaf-b" });

  attach(world, branchA, root);
  attach(world, branchB, root);
  attach(world, leafA, branchA);
  attach(world, leafB, branchB);

  assertEquals([...descendantsWith(world, root, Marker)], [
    [branchA, { label: "branch-a" }],
    [leafA, { label: "leaf-a" }],
    [leafB, { label: "leaf-b" }],
  ]);
});

Deno.test("topology helpers tolerate empty or missing topology", () => {
  const world = makeWorld();
  const parent = entity(world);

  assertEquals([...childrenWith(world, parent, Marker)], []);
  assertEquals([...childrenWith(world, 0, Marker)], []);
  assertEquals(firstChildWith(world, parent, Marker), null);
  assertEquals([...descendantsWith(world, parent, Marker)], []);
  assertEquals([...descendantsWith(world, 0, Marker)], []);
});
