import { defineComponent } from "../../lib/ecs-js/index.js";

// Projectile — velocity-based movement; used by projectileSystem
export const Projectile = defineComponent("Projectile", {
  vx: 0,
  vy: 0,
  speed: 0, // optional scalar; if >0 normalizes (vx,vy) to this speed
});
