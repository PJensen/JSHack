import { createMessageContext } from "./messages/messageHelpers.js";
import { installSpellMessages } from "./messages/spellMessages.js";
import { installCombatMessages } from "./messages/combatMessages.js";
import { installCreatureMessages } from "./messages/creatureMessages.js";
import { installItemMessages } from "./messages/itemMessages.js";
import { installEnvironmentMessages } from "./messages/environmentMessages.js";
import { installEconomyMessages } from "./messages/economyMessages.js";
import { createFountainMessagesExtension } from "./messages/fountainMessages.js";
import { defineExtension } from "../../../lib/ecs-js/index.js";

const MESSAGE_WIRING_KEY = Symbol.for("jshack:display:messageWiring");

/**
 * Centralized message event handling — thin dispatcher.
 * Delegates to domain-specific sub-installers in messages/.
 */
export function installMessageWiring(opts) {
  const { world, messageLog, playerEntity } = opts;
  if (!world || !messageLog || typeof playerEntity !== "function") return;
  world.install(defineExtension("jshack:display:messageWiring", (installedWorld) => {
    const ctx = createMessageContext({ ...opts, world: installedWorld });
    installSpellMessages(ctx);
    installCombatMessages(ctx);
    installCreatureMessages(ctx);
    installItemMessages(ctx);
    installEnvironmentMessages(ctx);
    installEconomyMessages(ctx);
    installedWorld.install(createFountainMessagesExtension(ctx));
  }, { key: MESSAGE_WIRING_KEY }));
}
