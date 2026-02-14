// src/main/bootstrap/loadGameData.js
// Bootstrap-time data warm-up with progress callbacks.

import { MONSTERS } from "../../rules/data/monsters.js";
import { SPELL_DEFS } from "../../rules/data/spells.js";
import { ITEM_DEFS } from "../../rules/data/items.js";
import { AFFIX_DEFS } from "../../rules/data/affixes.js";
import { EQUIP_DEFS } from "../../rules/data/equipment.js";
import { LOOT_TABLES } from "../../rules/data/lootTables.js";
import { DEITY_DEFS } from "../../rules/data/deities.js";
import { GEM_DEFS } from "../../rules/data/gems.js";
import { APPLY_DEFS } from "../../rules/data/applyDefs.js";
import { NUTRITION_BY_SIZE, CORPSE_EFFECTS } from "../../rules/data/food.js";
import { validateAll } from "../../rules/data/validate.js";

/**
 * @typedef {Object} DataLoadProgress
 * @property {'data'} phase
 * @property {string} dataset
 * @property {string} label
 * @property {number} processed
 * @property {number} total
 * @property {number} completed
 * @property {number} overallTotal
 */

/**
 * @typedef {{ id: string, label: string, total: number }} DataLoadPlanItem
 */

/**
 * @returns {{ datasets: DataLoadPlanItem[], overallTotal: number }}
 */
export function getGameDataLoadPlan() {
  /** @type {DataLoadPlanItem[]} */
  const datasets = [
    { id: "monsters", label: "Loading monster defs", total: MONSTERS.length },
    { id: "spells", label: "Loading spell defs", total: Object.keys(SPELL_DEFS).length },
    { id: "items", label: "Loading item defs", total: Object.keys(ITEM_DEFS).length },
    { id: "affixes", label: "Loading affix defs", total: Object.keys(AFFIX_DEFS).length },
    { id: "equipment", label: "Loading equipment defs", total: Object.keys(EQUIP_DEFS).length },
    { id: "loot", label: "Loading loot tables", total: Object.keys(LOOT_TABLES).length },
    { id: "deities", label: "Loading deity defs", total: Object.keys(DEITY_DEFS).length },
    { id: "gems", label: "Loading gem defs", total: Object.keys(GEM_DEFS).length },
    {
      id: "food",
      label: "Loading nutrition defs",
      total: Object.keys(NUTRITION_BY_SIZE).length + Object.keys(CORPSE_EFFECTS).length,
    },
    { id: "apply", label: "Loading apply defs", total: Object.keys(APPLY_DEFS).length },
    { id: "validate", label: "Validating data", total: 1 },
  ];
  const overallTotal = datasets.reduce((sum, ds) => sum + ds.total, 0);
  return { datasets, overallTotal };
}

/**
 * @param {{ onProgress?: (progress: DataLoadProgress) => void }} [opts]
 * @returns {{ completed: number, overallTotal: number }}
 */
export function loadGameData(opts = {}) {
  const onProgress = typeof opts.onProgress === "function" ? opts.onProgress : null;
  const plan = getGameDataLoadPlan();
  let completed = 0;

  /**
   * @param {DataLoadPlanItem} ds
   * @param {number} processed
   */
  function emit(ds, processed) {
    if (!onProgress) return;
    onProgress({
      phase: "data",
      dataset: ds.id,
      label: ds.label,
      processed,
      total: ds.total,
      completed,
      overallTotal: plan.overallTotal,
    });
  }

  for (const ds of plan.datasets) {
    emit(ds, 0);

    if (ds.id === "monsters") {
      for (let i = 0; i < MONSTERS.length; i++) {
        void MONSTERS[i];
        completed++;
        emit(ds, i + 1);
      }
      continue;
    }

    if (ds.id === "spells") {
      const keys = Object.keys(SPELL_DEFS);
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        void SPELL_DEFS[key];
        completed++;
        emit(ds, i + 1);
      }
      continue;
    }

    if (ds.id === "items") {
      const keys = Object.keys(ITEM_DEFS);
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        void ITEM_DEFS[key];
        completed++;
        emit(ds, i + 1);
      }
      continue;
    }

    if (ds.id === "affixes") {
      const keys = Object.keys(AFFIX_DEFS);
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        void AFFIX_DEFS[key];
        completed++;
        emit(ds, i + 1);
      }
      continue;
    }

    if (ds.id === "equipment") {
      const keys = Object.keys(EQUIP_DEFS);
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        void EQUIP_DEFS[key];
        completed++;
        emit(ds, i + 1);
      }
      continue;
    }

    if (ds.id === "loot") {
      const keys = Object.keys(LOOT_TABLES);
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        void LOOT_TABLES[key];
        completed++;
        emit(ds, i + 1);
      }
      continue;
    }

    if (ds.id === "deities") {
      const keys = Object.keys(DEITY_DEFS);
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        void DEITY_DEFS[key];
        completed++;
        emit(ds, i + 1);
      }
      continue;
    }

    if (ds.id === "gems") {
      const keys = Object.keys(GEM_DEFS);
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        void GEM_DEFS[key];
        completed++;
        emit(ds, i + 1);
      }
      continue;
    }

    if (ds.id === "food") {
      const nKeys = Object.keys(NUTRITION_BY_SIZE);
      let processed = 0;
      for (let i = 0; i < nKeys.length; i++) {
        const key = nKeys[i];
        void NUTRITION_BY_SIZE[key];
        completed++;
        processed++;
        emit(ds, processed);
      }
      const cKeys = Object.keys(CORPSE_EFFECTS);
      for (let i = 0; i < cKeys.length; i++) {
        const key = cKeys[i];
        void CORPSE_EFFECTS[key];
        completed++;
        processed++;
        emit(ds, processed);
      }
      continue;
    }

    if (ds.id === "apply") {
      const keys = Object.keys(APPLY_DEFS);
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        void APPLY_DEFS[key];
        completed++;
        emit(ds, i + 1);
      }
      continue;
    }

    if (ds.id === "validate") {
      validateAll({ EQUIP_DEFS, AFFIX_DEFS });
      completed++;
      emit(ds, 1);
    }
  }

  return { completed, overallTotal: plan.overallTotal };
}
