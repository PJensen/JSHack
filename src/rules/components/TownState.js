import { defineComponent } from "../../lib/ecs-js/index.js";

export const TownState = defineComponent("TownState", {
  foodStores: 0,
  materialStores: 0,
  medicineStores: 0,
  repairBacklog: 0,
  threatLevel: 0,
  morale: 50,
  weather: "clear",
  lowFood: false,
  lowMaterials: false,
  lowMedicine: false,
  nextPulseStep: 0,
  lastPulseStep: -1,
});
