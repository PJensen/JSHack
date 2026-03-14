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

  function containerName(targetId) {
    return String(world.get(Number(targetId || 0) | 0, NamedIdentity)?.identity || "");
  }

  world.on("rack:looted", ({ count, targetId }) => {
    const n = Number(count || 0) | 0;
    const identity = containerName(targetId);
    if (identity === "potion_shelf") {
      log(n === 1 ? "A potion tumbles from the shelf." : "Potions tumble from the shelf.");
      return;
    }
    if (identity === "gem_display_case") {
      log(n === 1 ? "A gem drops from the display case." : "Gems drop from the display case.");
      return;
    }
    log(n === 1 ? "A weapon clatters to the ground." : "Weapons clatter to the ground.");
  });

  world.on("rack:empty", ({ targetId }) => {
    const identity = containerName(targetId);
    if (identity === "potion_shelf") {
      log("The potion shelf is empty.");
      return;
    }
    if (identity === "gem_display_case") {
      log("The display case is empty.");
      return;
    }
    log("The rack is empty.");
  });
}
