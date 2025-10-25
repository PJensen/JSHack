import { defineComponent } from '../../lib/ecs/core.js';

export const RenderContext = defineComponent('RenderContext', {
  canvas: null, // HTMLCanvasElement
  ctx: null, // CanvasRenderingContext2D
  // Optional backbuffer/present separation for post-processing
  backCanvas: null, // Offscreen/backing canvas to render the scene into
  backCtx: null,    // 2D context for backCanvas (renderers draw here)
  presentCanvas: null, // On-screen canvas
  presentCtx: null,    // 2D context for on-screen canvas (present step)
  bg: '#0f1320',
  font: '18px monospace',
  cellW: 16,
  cellH: 24,
  cols: 60,
  rows: 22,
  pixelated: true
  ,
  // Camera origin in world tiles (used by renderers to transform world->screen)
  camX: 0,
  camY: 0
  ,
  // Optional runtime particle system instance (JS object managing particles)
  particleSystem: null
});
