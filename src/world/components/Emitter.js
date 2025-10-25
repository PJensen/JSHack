// Emitter.js
// ECS Component: General-purpose particle emitter (no MapView; uses RenderContext particle pool)
import { defineComponent } from '../../lib/ecs/core.js';

export const Emitter = defineComponent('Emitter', {
  enabled: true,
  // Spawn behavior
  continuous: true,        // if false and burstCount>0, spawn once then disable
  rate: 12,                // particles per second
  burstCount: 0,           // optional immediate burst when enabled
  // Kinematics
  angle: -Math.PI / 2,     // default: up
  spread: Math.PI / 8,     // radians around angle
  speed: 1.2,              // base speed (tiles/sec)
  speedJitter: 0.4,        // +/- fraction of speed (0.4 => 60%..140%)
  vx: 0, vy: 0,            // additive initial velocity
  ax: 0, ay: -0.6,         // acceleration (gravity up is negative vy in our coords)
  // Lifetime/visuals
  life: 0.9,               // seconds
  lifeJitter: 0.3,         // +/- fraction of life
  size: 0.9,
  sizeEnd: 0.1,
  color: '#ffa500',        // default warm orange
  // Origin offset (tile space)
  offsetX: 0,
  offsetY: -0.2,
  // Runtime accumulator (internal)
  _acc: 0,
  _didBurst: false
});
