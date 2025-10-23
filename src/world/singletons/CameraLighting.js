import { defineComponent } from '../../lib/ecs/core.js';

export const CameraLighting = defineComponent('CameraLighting', {
  eye: [0,0],
  exposure: 1.0,
  gamma: 2.2
});

export function ensureCameraLighting(world){
  let id = 0; for (const e of world.alive){ if (world.has(e, CameraLighting)){ id = e; break; } }
  if (!id){ id = world.create(); world.add(id, CameraLighting, {}); }
  return id;
}
