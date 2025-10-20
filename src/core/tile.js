// Tile component and helpers
// Pure ES module, compatible with the project's ECS (defineComponent).
import { defineComponent } from '../ecs/core.js';

// Tile component describes a single map tile's properties.
// - walkable: can entities walk across it (bool)
// - transparent: blocks light / vision when false
// - glyph: printable representation (string)
// - color: foreground color (CSS)
// - bg: background color (CSS)
export const Tile = defineComponent('Tile', {
  walkable: true,
  transparent: true,
  glyph: '.',
  color: '#ffffff',
  bg: '#000000'
});

// Small helper to create a tile definition object (not an ECS operation).
// Keeps one-file-one-idea simple: factories that mutate the world live in other modules.
export function tileDef(overrides = {}){
  return Object.assign({}, Tile.defaults, overrides);
}

export default Tile;
