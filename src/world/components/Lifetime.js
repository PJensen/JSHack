// Lifetime.js
// ECS Component: Time-to-live for transient entities
import { defineComponent } from '../../lib/ecs/core.js';

export const Lifetime = defineComponent('Lifetime', {
  ttl: 1.0 // time to live in seconds (or ticks if your systems interpret it so)
});
