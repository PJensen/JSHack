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
  Pray: "rules.pray", // payload: {}
  DrinkPotion: "rules.drinkPotion", // payload: { itemId?:number, targetId?:number }
  CastActiveSpell: "rules.castActiveSpell", // payload: { spellId?:number, targetId?:number, x?:number, y?:number }
  EquipItem: "rules.equipItem", // payload: { itemId:number }
  ShootRanged: "rules.shootRanged", // payload: {}
  Engrave: "rules.engrave", // payload: { text:string }

  // Display-directed UI
  OpenInventory: "display.openInventory", // payload: {}
  OpenCharacter: "display.openCharacter", // payload: {}
  OpenEquipment: "display.openEquipment", // payload: {}
  OpenMessageLog: "display.openMessageLog", // payload: {}
  Zoom: "display.zoom", // payload: { factor:number } (pinch scale delta)
  // Open a chooser for items underfoot; display will query and let user pick
  OpenPickupChooser: "display.openPickupChooser", // payload: {}
  // Request stair traversal from keyboard (desktop Enter)
  TraverseStairs: "display.traverseStairs", // payload: {}
  // Direct rules pickup (used by chooser submission)
  PickupItem: "rules.pickupItem", // payload: { itemId?:number, count?:number }
  // Apply a tool to a target inventory item
  OpenApplyChooser: "display.openApplyChooser", // payload: {}
  // Death log (all past deaths from localStorage)
  OpenDeathLog: "display.openDeathLog", // payload: {}
});

// Default routing from action → sink
export const defaultActionSinks = Object.freeze({
  // Rules-directed intents
  [Actions.Move]: Sinks.rules,
  [Actions.Wait]: Sinks.rules,
  [Actions.Pray]: Sinks.rules,
  [Actions.DrinkPotion]: Sinks.rules,
  [Actions.PickupItem]: Sinks.rules,
  [Actions.CastActiveSpell]: Sinks.rules,
  [Actions.EquipItem]: Sinks.rules,
  [Actions.ShootRanged]: Sinks.rules,
  [Actions.Engrave]: Sinks.rules,

  // Display-directed UI actions
  [Actions.OpenInventory]: Sinks.display,
  [Actions.OpenCharacter]: Sinks.display,
  [Actions.OpenEquipment]: Sinks.display,
  [Actions.OpenMessageLog]: Sinks.display,
  [Actions.Zoom]: Sinks.display,
  [Actions.OpenPickupChooser]: Sinks.display,
  [Actions.TraverseStairs]: Sinks.display,
  [Actions.OpenApplyChooser]: Sinks.display,
  [Actions.OpenDeathLog]: Sinks.display,
});

// Utility to build an action object
export function makeAction(type, payload = {}) {
  return { type, payload };
}
