import { defineComponent } from '../lib/ecs-js/index.js';

export const Glyph = defineComponent('Glyph', {
  char: '@',
  // fontSize is dynamic per-frame (based on viewport); base is a hint multiplier
  baseScale: 0.72, // fraction of min(viewport)
  fg: '#e8f7ff',
  weight: '900',
  family: 'monospace',
});
