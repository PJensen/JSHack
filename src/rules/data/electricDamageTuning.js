/**
 * Electric damage tuning constants.
 * Keep balance knobs in data so rules logic stays stable.
 */
export const ELECTRIC_DAMAGE_TUNING = Object.freeze({
  baseOhms: 1000,
  baseBodyConductivity: 0.2,
  resistMultiplierMin: 0.1,
  resistMultiplierMax: 2.5,
  conductivityScale: 1.8,
  conductivityMultiplierMin: 0.65,
  conductivityMultiplierMax: 2.0,
  slotWeights: Object.freeze({
    armor: 0.55,
    offhand: 0.25,
    weapon: 0.20,
    legs: 0.15,
    gloves: 0.10,
    belt: 0.08,
    feet: 0.10,
    head: 0.08,
    neck: 0.04,
    ring1: 0.08,
    ring2: 0.08,
    ammo: 0.04,
  }),
});
