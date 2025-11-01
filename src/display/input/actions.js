// display/input/actions.js
// Normalized input actions and sink mapping (display-only; no rules imports)

export const Sinks = Object.freeze({
  rules: "rules",
  display: "display",
});

// Canonical action names; payload shape documented per action
export const Actions = Object.freeze({
  // Rules-directed intents
  Move: "rules.move", // payload: { dx:number, dy:number }
  Wait: "rules.wait", // payload: {}
  DrinkPotion: "rules.drinkPotion", // payload: { itemId?:number, targetId?:number }
  CastActiveSpell: "rules.castActiveSpell", // payload: { spellId?:number, targetId?:number }

  // Display-directed UI
  OpenInventory: "display.openInventory", // payload: {}
  OpenMessageLog: "display.openMessageLog", // payload: {}
});

// Default routing from action → sink
export const defaultActionSinks = Object.freeze({
  [Actions.Move]: Sinks.rules,
  [Actions.Wait]: Sinks.rules,
  [Actions.DrinkPotion]: Sinks.rules,
  [Actions.CastActiveSpell]: Sinks.rules,
  [Actions.OpenInventory]: Sinks.display,
  [Actions.OpenMessageLog]: Sinks.display,
});

// Utility to build an action object
export function makeAction(type, payload = {}) {
  return { type, payload };
}
