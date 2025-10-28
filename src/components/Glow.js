import { defineComponent } from '../lib/ecs-js/index.js';

export const Glow = defineComponent('Glow', {
  color: '#6cf', // halo color
  intensity: 3.0, // base brightness
  pulse: 0.35, // +/- fraction
  speedHz: 0.6, // pulse speed (Hz)
  blurBase: 12, // outer blur baseline (px at 1x)
  blurMax: 120, // peak blur (px at 1x)
});
