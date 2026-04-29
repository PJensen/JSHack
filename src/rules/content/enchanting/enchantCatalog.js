export const ENCHANTING_INGREDIENTS = Object.freeze({
  emberRoot: Object.freeze({ identity: "reagent_ember_root", label: "Ember Root" }),
  moonleaf: Object.freeze({ identity: "reagent_moonleaf", label: "Moonleaf" }),
  thornPods: Object.freeze({ identity: "reagent_thorn_pod", label: "Thorn Pods" }),
  venomFronds: Object.freeze({ identity: "reagent_venom_frond", label: "Venom Fronds" }),
  spiderLeg: Object.freeze({ identity: "reagent_spider_leg", label: "Spider Leg" }),
  venomGland: Object.freeze({ identity: "reagent_venom_gland", label: "Venom Gland" }),
  resin: Object.freeze({ identity: "reagent_resin", label: "Resin" }),
  boneDust: Object.freeze({ identity: "reagent_bone_dust", label: "Bone Dust" }),
  ectoplasm: Object.freeze({ identity: "reagent_ectoplasm", label: "Ectoplasm" }),
  runeFragment: Object.freeze({ identity: "reagent_rune_fragment", label: "Rune Fragment" }),
  frostCore: Object.freeze({ identity: "reagent_frost_core", label: "Frost Core" }),
  beastClaw: Object.freeze({ identity: "reagent_beast_claw", label: "Beast Claw" }),
  cursedThread: Object.freeze({ identity: "reagent_cursed_thread", label: "Cursed Thread" }),
  oil: Object.freeze({ identity: "potion_oil", label: "Flask of Oil" }),
  water: Object.freeze({ identity: "potion_water", label: "Water Flask" }),
  ashes: Object.freeze({ identity: "ashes", label: "Ashes" }),
  gold: Object.freeze({ identity: "gold", label: "Gold" }),
});

export const ENCHANT_SCROLL_DEFS = Object.freeze([
  Object.freeze({
    itemId: "scroll_enchant_poison",
    recipeKey: "venomous_script",
    name: "Scroll of Venom Binding",
    enchantType: "poison",
    affixId: "venomous1",
    description: "Apply to a weapon to bind a persistent venomous enchantment.",
    effectSummary: "On hit, weapon strikes can poison enemies.",
    detail: "Strikes from the enchanted gear can poison your enemies.",
    stationTitle: "✧ Enchantress's Satchel",
    flavor: "Spider chitin, gland venom, and lacquered resin are worked into a bitter green script.",
    requirements: Object.freeze({ spiderLeg: 2, venomGland: 1, resin: 1, gold: 65 }),
  }),
  Object.freeze({
    itemId: "scroll_enchant_fire",
    recipeKey: "firestorm_script",
    name: "Scroll of Firestorm Binding",
    enchantType: "fire",
    affixId: "firestorm1",
    description: "Apply to a weapon to bind a persistent firestorm enchantment.",
    effectSummary: "On hit, weapon strikes can kindle lingering fire damage.",
    detail: "Strikes from the enchanted gear can ignite lingering fire.",
    stationTitle: "✧ Enchantress's Satchel",
    flavor: "Ember root, old ashes, and a scored rune flare together across the vellum.",
    requirements: Object.freeze({ emberRoot: 2, ashes: 1, oil: 1, runeFragment: 1, gold: 70 }),
  }),
  Object.freeze({
    itemId: "scroll_enchant_frost",
    recipeKey: "frostbite_script",
    name: "Scroll of Frost Binding",
    enchantType: "frost",
    affixId: "frostbite1",
    description: "Apply to a weapon to bind a persistent frostbite enchantment.",
    effectSummary: "On hit, weapon strikes can chill enemies with frost.",
    detail: "Strikes from the enchanted gear can chill foes with frost.",
    stationTitle: "✧ Enchantress's Satchel",
    flavor: "Moonleaf, meltwater, and a cold crystal set a pale blue sigil into the page.",
    requirements: Object.freeze({ moonleaf: 2, water: 1, frostCore: 1, runeFragment: 1, gold: 70 }),
  }),
  Object.freeze({
    itemId: "scroll_enchant_flame_ward",
    recipeKey: "flame_ward_script",
    name: "Scroll of Flame Ward Binding",
    enchantType: "fire ward",
    affixId: "fireWard1",
    description: "Apply to armor, offhand gear, or an amulet to bind a persistent flame ward.",
    effectSummary: "Adds enduring fire resistance to defensive gear.",
    detail: "The binding settles into the gear as a steady ward against flame.",
    stationTitle: "✧ Enchantress's Satchel",
    flavor: "Ash, resin, and ember-powder are stitched into a warding lattice.",
    requirements: Object.freeze({ ashes: 1, resin: 1, emberRoot: 1, boneDust: 1, gold: 80 }),
  }),
  Object.freeze({
    itemId: "scroll_enchant_venom_ward",
    recipeKey: "venom_ward_script",
    name: "Scroll of Venom Ward Binding",
    enchantType: "venom ward",
    affixId: "poisonWard1",
    description: "Apply to armor, rings, or an amulet to bind a persistent venom ward.",
    effectSummary: "Adds enduring poison resistance to defensive gear.",
    detail: "The script stiffens into a bitter ward against poison.",
    stationTitle: "✧ Enchantress's Satchel",
    flavor: "Fern sap, a venom sac, and black thread braid together into a warding seal.",
    requirements: Object.freeze({ venomFronds: 2, venomGland: 1, cursedThread: 1, gold: 80 }),
  }),
  Object.freeze({
    itemId: "scroll_enchant_fortified",
    recipeKey: "fortified_script",
    name: "Scroll of Fortified Binding",
    enchantType: "fortified",
    affixId: "kineticWard1",
    description: "Apply to armor, offhand gear, or an amulet to bind a persistent fortified ward.",
    effectSummary: "Adds enduring impact resistance to heavy gear.",
    detail: "The page hardens the gear into a patient, stubborn bulwark.",
    stationTitle: "✧ Enchantress's Satchel",
    flavor: "Resin, claw keratin, and grave dust press the script into a stubborn shell.",
    requirements: Object.freeze({ resin: 1, beastClaw: 1, boneDust: 1, gold: 75 }),
  }),
]);

const ENCHANT_SCROLL_DEF_MAP = new Map(ENCHANT_SCROLL_DEFS.map((def) => [def.itemId, def]));

export function listEnchantScrollDefs() {
  return ENCHANT_SCROLL_DEFS.slice();
}

export function getEnchantScrollDef(itemId) {
  return ENCHANT_SCROLL_DEF_MAP.get(String(itemId || "").trim()) || null;
}

export function listEnchantRecipeDefs() {
  return ENCHANT_SCROLL_DEFS.map((def) => ({
    key: def.recipeKey,
    label: def.name.replace(/^Scroll of /, "").replace(/ Binding$/, ""),
    outputIdentity: def.itemId,
    outputName: def.name,
    enchantType: def.enchantType,
    affixId: def.affixId,
    effectSummary: def.effectSummary,
    flavor: def.flavor,
    requirements: { ...(def.requirements || {}) },
  }));
}
