import { defineComponent } from '../../lib/ecs/core.js';

// MapView: minimal contract for map visualisation
// - glyphAt(x,y) => a single‑char string (e.g. '█', '·', '<')
// - visibleMask: Uint8Array(w*h) where 1 = currently visible
// - seenMask : Uint8Array(w*h) where 1 = explored
export const MapView = defineComponent('MapView', {
  w: 0,
  h: 0,
  glyphAt: null, // function(x,y)
  tileAt: null,  // function(x,y) -> { glyph, walkable, blocksLight } | null
  opaqueAt: null, // function(x,y) -> boolean (true if blocksLight)
  visibleMask: null, // Uint8Array
  seenMask: null // Uint8Array
});
