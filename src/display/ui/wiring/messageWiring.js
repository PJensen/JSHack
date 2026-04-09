import { createMessageContext } from "./messages/messageHelpers.js";
import { installSpellMessages } from "./messages/spellMessages.js";
import { installCombatMessages } from "./messages/combatMessages.js";
import { installCreatureMessages } from "./messages/creatureMessages.js";
import { installItemMessages } from "./messages/itemMessages.js";
import { installEnvironmentMessages } from "./messages/environmentMessages.js";
import { installEconomyMessages } from "./messages/economyMessages.js";

const INSTALLED = Symbol.for("jshack:display:messageWiring:installed");

/**
 * Centralized message event handling — thin dispatcher.
 * Delegates to domain-specific sub-installers in messages/.
 */
export function installMessageWiring(opts) {
  const { world, messageLog, playerEntity } = opts;
  if (!world || !messageLog || typeof playerEntity !== "function") return;
  if (world[INSTALLED]) return;
  world[INSTALLED] = true;

  const ctx = createMessageContext(opts);

  installSpellMessages(ctx);
  installCombatMessages(ctx);
  installCreatureMessages(ctx);
  installItemMessages(ctx);
  installEnvironmentMessages(ctx);
  installEconomyMessages(ctx);
}
