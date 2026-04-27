const COMBAT_ROOT = "combat/";

const WEAPON_FOLDERS = Object.freeze({
  axe_large: "AXE LARGE",
  axe_small: "AXE SMALL",
  dagger: "DAGGER",
  flail: "FLAIL",
  hammer_large: "HAMMER LARGE",
  mace: "MACE",
  spear: "SPEAR",
  sword_large: "SWORD LARGE",
  sword_small: "SWORD SMALL",
  wooden_staff: "WOODEN STAFF",
});

const SHIELD_FOLDERS = Object.freeze({
  shield_metal: "SHIELD METAL",
  shield_wood: "SHIELD WOOD",
});

const WEAPON_ACTIONS = Object.freeze({
  deflect: "Deflect",
  deflect_body: "Deflect Body",
  deflect_tail: "Deflect Tail",
  equip: "Equip",
  finisher: "Finisher",
  impact_hard: "Impact Hard",
  impact_hard_body: "Impact Hard Body",
  impact_hard_tail: "Impact Hard Tail",
  impact_soft: "Impact Soft",
  unequip: "Unequip",
  whoosh_long: "Whoosh Long",
  whoosh_short: "Whoosh Short",
});

const SHIELD_ACTIONS = Object.freeze({
  deflect: "Deflect",
  equip: "Equip",
  finisher: "Finisher",
  impact_hard: "Impact Hard",
  impact_soft: "Impact Soft",
  unequip: "Unequip",
  whoosh_long: "Whoosh Long",
  whoosh_short: "Whoosh Short",
});

const GORE_ACTIONS = Object.freeze({
  impact_large: "Impact Large",
  impact_medium: "Impact Medium",
  impact_small: "Impact Small",
  slice_large: "Slice Large",
  slice_medium: "Slice Medium",
  slice_small: "Slice Small",
  stab_large: "Stab Large",
  stab_medium: "Stab Medium",
  stab_small: "Stab Small",
});

const COUNT_OVERRIDES = Object.freeze({
  "DAGGER|Whoosh Long": 7,
  "WOODEN STAFF|Equip": 7,
  "GORE|Impact Small": 5,
});

function countFor(folder, action) {
  return COUNT_OVERRIDES[`${folder}|${action}`] || 6;
}

function filePool(folder, action) {
  const count = countFor(folder, action);
  const files = [];
  for (let i = 1; i <= count; i++) {
    files.push(`${COMBAT_ROOT}${folder}/${folder}-${action}-${String(i).padStart(2, "0")}.mp3`);
  }
  return files;
}

function soundEntry(files, volume = 1) {
  return {
    files,
    bus: "combat",
    maxVoices: 5,
    randomPitch: 35,
    volume,
  };
}

function buildFamily(folder, actions) {
  const out = {};
  for (const [key, action] of Object.entries(actions)) {
    out[key] = filePool(folder, action);
  }
  return Object.freeze(out);
}

function buildPack() {
  const pack = {};
  for (const [family, folder] of Object.entries(WEAPON_FOLDERS)) {
    pack[family] = buildFamily(folder, WEAPON_ACTIONS);
  }
  for (const [family, folder] of Object.entries(SHIELD_FOLDERS)) {
    pack[family] = buildFamily(folder, SHIELD_ACTIONS);
  }
  pack.gore = buildFamily("GORE", GORE_ACTIONS);
  return Object.freeze(pack);
}

export const COMBAT_PACK = buildPack();

function buildSounds() {
  const sounds = {};
  for (const [family, actions] of Object.entries(COMBAT_PACK)) {
    for (const [action, files] of Object.entries(actions)) {
      const id = family === "gore"
        ? `combat:gore:${action}`
        : `combat:weapon:${family}:${action}`;
      const quieter = action.endsWith("_tail") || action.startsWith("whoosh");
      sounds[id] = soundEntry(files, quieter ? 0.78 : 1);
    }
  }
  return Object.freeze(sounds);
}

export const COMBAT_SOUNDS = buildSounds();

export function combatSoundId(family, action) {
  if (!family || !action) return null;
  if (family === "gore") return COMBAT_PACK.gore[action] ? `combat:gore:${action}` : null;
  return COMBAT_PACK[family]?.[action] ? `combat:weapon:${family}:${action}` : null;
}

export function allCombatPackFiles() {
  return Object.values(COMBAT_PACK)
    .flatMap((actions) => Object.values(actions))
    .flat();
}
