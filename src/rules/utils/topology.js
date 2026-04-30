import { children } from "../../lib/ecs-js/hierarchy.js";

/**
 * Iterate direct child entities that have `Component`.
 *
 * This rules-layer facade is the canonical import path for JSHack topology
 * traversal. Keep domain systems here instead of importing hierarchy helpers
 * directly when they are looking for attached runtime nodes.
 *
 * @param {import("../../lib/ecs-js/index.js").World} world
 * @param {number} parent
 * @param {import("../../lib/ecs-js/index.js").Component} Component
 * @returns {Generator<[number, object]>}
 */
export function* childrenWith(world, parent, Component) {
  if (!world || !Component || !(parent > 0)) return;

  for (const child of children(world, parent)) {
    if (!world.has(child, Component)) continue;
    yield [child, world.get(child, Component)];
  }
}

/**
 * Return the first direct child with `Component`, or null.
 *
 * @param {import("../../lib/ecs-js/index.js").World} world
 * @param {number} parent
 * @param {import("../../lib/ecs-js/index.js").Component} Component
 * @returns {[number, object] | null}
 */
export function firstChildWith(world, parent, Component) {
  for (const match of childrenWith(world, parent, Component)) {
    return match;
  }

  return null;
}

/**
 * Iterate descendants that have `Component`, depth-first in ECS child order.
 *
 * @param {import("../../lib/ecs-js/index.js").World} world
 * @param {number} parent
 * @param {import("../../lib/ecs-js/index.js").Component} Component
 * @returns {Generator<[number, object]>}
 */
export function* descendantsWith(world, parent, Component) {
  if (!world || !Component || !(parent > 0)) return;

  for (const child of children(world, parent)) {
    if (world.has(child, Component)) {
      yield [child, world.get(child, Component)];
    }

    yield* descendantsWith(world, child, Component);
  }
}
