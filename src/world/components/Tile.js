import { defineComponent } from '../../lib/ecs/core.js';

// Tile component for ECS: describes a tile's properties
export const Tile = defineComponent('Tile', {
  glyph: '',        // Visual representation (ideally unicode character, emoji, letter, etc.)
  walkable: true,   // Can entities walk on this tile?
  blocksLight: false // Does this tile block light/vision?
});
