// Monster innate scripts.
// Registers script handlers directly from monster defs so behavior stays local to each monster record.

import { ScriptVerb, registerScript } from "../scripting.js";
import { MONSTERS } from "../data/monsters.js";

const HOOK_TO_VERB = Object.freeze({
  onBeforeHit: ScriptVerb.AffixOnBeforeHit,
  onHit: ScriptVerb.AffixOnHit,
  onDamaged: ScriptVerb.AffixOnDamaged,
});

for (let i = 0; i < MONSTERS.length; i++) {
  const monster = MONSTERS[i];
  const script = String(monster?.script || "");
  const hooks = monster?.hooks;
  if (!script || !hooks || typeof hooks !== "object") continue;

  const handlers = {};
  for (const [hookName, verb] of Object.entries(HOOK_TO_VERB)) {
    const fn = hooks[hookName];
    if (typeof fn !== "function") continue;
    handlers[verb] = (world, ctx) => fn({ world, ctx });
  }

  if (Object.keys(handlers).length > 0) {
    registerScript(script, handlers);
  }
}
