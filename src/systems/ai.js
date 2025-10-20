// AISystem
// Exports: runAI(world, dt)
// Very small state machine: wandering NPCs pick a random velocity occasionally.

import { randomInt } from '../util/rng.js';

export function runAI(world, dt){
  if (typeof world.query !== 'function') return;

  for (const eid of world.query('AI','Position','Velocity')){
    const ai = world.getComponent(eid, 'AI');
    const vel = world.getComponent(eid, 'Velocity');
    if (!ai || !vel) continue;
    ai.cooldown = (ai.cooldown || 0) - dt;
    if (ai.cooldown <= 0){
      // pick new direction
      const dir = randomInt(0,3);
      switch(dir){
        case 0: vel.dx = -1; vel.dy = 0; break;
        case 1: vel.dx = 1; vel.dy = 0; break;
        case 2: vel.dx = 0; vel.dy = -1; break;
        case 3: vel.dx = 0; vel.dy = 1; break;
      }
      ai.cooldown = 0.5 + Math.random() * 2.0; // seconds
    }
  }
}
