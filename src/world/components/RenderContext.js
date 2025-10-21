import { defineComponent } from '../../lib/ecs/core.js';

export const RenderContext = defineComponent('RenderContext', {
  canvas: null, // HTMLCanvasElement
  ctx: null, // CanvasRenderingContext2D
  bg: '#0f1320',
  font: '18px monospace',
  cellW: 16,
  cellH: 24,
  cols: 60,
  rows: 22,
  pixelated: true
});
