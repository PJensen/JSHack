import { defineComponent } from "../../lib/ecs-js/index.js";

export const Traits = defineComponent('Traits', {
  ambidextrous: false,
  gluttonous: false,
  iron_stomach: false,
  ratCorpsesEaten: 0,
  // Serpent Blood: eat 3 cave_snake corpses → permanent toxMult 0.5
  snakesEaten: 0,
  serpent_blood: false,
  // Venom Tolerance: eat 2 venomous corpses → permanent toxMult 0.5
  venomCorpsesEaten: 0,
  venom_tolerance: false,
  // Thick Hide: eat 2 cave_bear corpses → permanent kinetic DR +2
  bearCorpsesEaten: 0,
  thick_hide: false,
  // Deathless: eat 3 wight corpses → permanent slow regen
  wightCorpsesEaten: 0,
  deathless: false,
  // Third Eye: survive floating_eye mindwipe → sense enemies through walls
  third_eye: false,
  // Demon Fire: eat demon corpse (40%) → +1 fire bonus damage on melee
  demon_fire: false,
  // Dragonheart: eat dragon corpse → fire immunity + attack bonus
  dragonheart: false,
});
