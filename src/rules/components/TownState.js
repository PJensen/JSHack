import { defineComponent } from "../../lib/ecs-js/index.js";

export const TownState = defineComponent("TownState", {
  foodStores: 0,
  fuelStores: 0,
  materialStores: 0,
  medicineStores: 0,
  repairBacklog: 0,
  threatLevel: 0,
  morale: 50,
  weather: "clear",
  foodQuality: "none",
  laborReadiness: 50,
  lowFood: false,
  lowFuel: false,
  lowMaterials: false,
  lowMedicine: false,
  nextPulseStep: 0,
  lastPulseStep: -1,
});
