// src/rules/systems/equipmentSystem.js
// Recompute derived stats from equipped items and passive affixes.
// Keeps results on Equipment component; other systems may consume them.

import { Equipment } from '../components/Equipment.js';
import { ItemInfo } from '../components/ItemInfo.js';
import { AFFIX_DEFS } from '../data/affixes.js';
import { runScript, ScriptVerb } from '../scripting.js';

function emptyDerived() {
  return {
    attackDerived: 0,
    defenseDerived: 0,
    maxHpDerived: 0,
    critChanceDerived: 0,
    critMultDerived: 0,
    manaRegenDerived: 0,
    staminaRegenDerived: 0,
    maxStaminaDerived: 0,
    kineticDRDerived: 0,
    fireResistDerived: 0,
    poisonResistDerived: 0,
    acidResistDerived: 0,
    radiationResistDerived: 0,
    electricOhmsDerived: 0,
    bluntResistDerived: 0,
    slashResistDerived: 0,
    pierceResistDerived: 0,
  };
}

function applyBonuses(acc, bonuses) {
  if (!bonuses) return;
  if (Number.isFinite(bonuses.attack)) acc.attackDerived += bonuses.attack;
  if (Number.isFinite(bonuses.defense)) acc.defenseDerived += bonuses.defense;
  if (Number.isFinite(bonuses.maxHp)) acc.maxHpDerived += bonuses.maxHp;
  if (Number.isFinite(bonuses.critChance)) acc.critChanceDerived += bonuses.critChance;
  if (Number.isFinite(bonuses.critMult)) acc.critMultDerived += bonuses.critMult;
  if (Number.isFinite(bonuses.manaRegen)) acc.manaRegenDerived += bonuses.manaRegen;
  if (Number.isFinite(bonuses.staminaRegen)) acc.staminaRegenDerived += bonuses.staminaRegen;
  if (Number.isFinite(bonuses.maxStamina)) acc.maxStaminaDerived += bonuses.maxStamina;
  if (Number.isFinite(bonuses.kineticDR)) acc.kineticDRDerived += bonuses.kineticDR;
  if (Number.isFinite(bonuses.fireResist)) acc.fireResistDerived += bonuses.fireResist;
  if (Number.isFinite(bonuses.poisonResist)) acc.poisonResistDerived += bonuses.poisonResist;
  if (Number.isFinite(bonuses.acidResist)) acc.acidResistDerived += bonuses.acidResist;
  if (Number.isFinite(bonuses.radiationResist)) acc.radiationResistDerived += bonuses.radiationResist;
  if (Number.isFinite(bonuses.electricOhms)) acc.electricOhmsDerived += bonuses.electricOhms;
  if (Number.isFinite(bonuses.bluntResist)) acc.bluntResistDerived += bonuses.bluntResist;
  if (Number.isFinite(bonuses.slashResist)) acc.slashResistDerived += bonuses.slashResist;
  if (Number.isFinite(bonuses.pierceResist)) acc.pierceResistDerived += bonuses.pierceResist;
}

function runAffixPassives(world, ctx, affixIds) {
  for (const aId of affixIds || []) {
    const a = AFFIX_DEFS[aId];
    if (!a || !a.passive) continue;
    runScript(a.passive, ScriptVerb.AffixPassive, world, ctx);
  }
}

export function equipmentSystem(world) {
  for (const [id, eq] of world.query(Equipment)) {
    const d = emptyDerived();

    // equip slots contain entity ids of items
    const slots = [eq.weapon, eq.armor, eq.shield, eq.ring1, eq.ring2, eq.ranged];
    for (const itemId of slots) {
      if (!Number.isInteger(itemId)) continue;
      const info = world.get(itemId, ItemInfo);
      if (!info) continue;
      // base item bonuses
      applyBonuses(d, info.bonuses);
      // passive affixes
      const ctx = {
        addBonus: (k, v) => {
          if (k in d) d[k] += v;
          else if (k === 'attack') d.attackDerived += v;
          else if (k === 'defense') d.defenseDerived += v;
          else if (k === 'maxHp') d.maxHpDerived += v;
          else if (k === 'critChance') d.critChanceDerived += v;
          else if (k === 'critMult') d.critMultDerived += v;
          else if (k === 'manaRegen') d.manaRegenDerived += v;
          else if (k === 'staminaRegen') d.staminaRegenDerived += v;
          else if (k === 'maxStamina') d.maxStaminaDerived += v;
          else if (k === 'kineticDR') d.kineticDRDerived += v;
          else if (k === 'fireResist') d.fireResistDerived += v;
          else if (k === 'poisonResist') d.poisonResistDerived += v;
          else if (k === 'acidResist') d.acidResistDerived += v;
          else if (k === 'radiationResist') d.radiationResistDerived += v;
          else if (k === 'electricOhms') d.electricOhmsDerived += v;
          else if (k === 'bluntResist') d.bluntResistDerived += v;
          else if (k === 'slashResist') d.slashResistDerived += v;
          else if (k === 'pierceResist') d.pierceResistDerived += v;
        },
        entityId: id,
        itemId,
        world
      };
      runAffixPassives(world, ctx, info.affixes);
    }

    // write back results
    eq.attackDerived = d.attackDerived;
    eq.defenseDerived = d.defenseDerived;
    eq.maxHpDerived = d.maxHpDerived;
    eq.critChanceDerived = d.critChanceDerived;
    eq.critMultDerived = d.critMultDerived;
    eq.manaRegenDerived = d.manaRegenDerived;
    eq.staminaRegenDerived = d.staminaRegenDerived;
    eq.maxStaminaDerived = d.maxStaminaDerived;
    eq.kineticDRDerived = d.kineticDRDerived;
    eq.fireResistDerived = d.fireResistDerived;
    eq.poisonResistDerived = d.poisonResistDerived;
    eq.acidResistDerived = d.acidResistDerived;
    eq.radiationResistDerived = d.radiationResistDerived;
    eq.electricOhmsDerived = d.electricOhmsDerived;
    eq.bluntResistDerived = d.bluntResistDerived;
    eq.slashResistDerived = d.slashResistDerived;
    eq.pierceResistDerived = d.pierceResistDerived;
  }
}
