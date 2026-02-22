import { NamedIdentity } from "../../rules/components/NamedIdentity.js";

const INSTALLED = Symbol.for("jshack:main:rackWiring:installed");

/**
 * @param {{
 *   world: import("../../lib/ecs-js/index.js").World,
 *   log: (msg: string) => void,
 * }} opts
 */
export function installRackWiring({ world, log }) {
  if (!world || typeof log !== "function") return;
  if (world[INSTALLED]) return;
  world[INSTALLED] = true;

  world.on("rack:looted", ({ count }) => {
    const n = Number(count || 0) | 0;
    log(n === 1 ? "A weapon clatters to the ground." : "Weapons clatter to the ground.");
  });

  world.on("rack:empty", () => {
    log("The rack is empty.");
  });
}
