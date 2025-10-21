import { defineComponent } from '../../lib/ecs/core.js';

export const Camera = defineComponent('Camera', {
  x: 0, y: 0, // top‑left of the viewport in world tiles
  cols: 60, rows: 22, // viewport size in tiles
  shakeMag: 0, // 0..1 small sub‑tile jitter
  shakeTtl: 0
});
