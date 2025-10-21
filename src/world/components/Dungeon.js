import { defineComponent } from '../../lib/ecs/core.js';

// Dungeon component holds information about the dungeon level or map association for an entity
export const Dungeon = defineComponent('Dungeon', {
  level: 1, // Dungeon level or floor number
  id: null, // Optional unique dungeon/map identifier
  name: '', // Optional dungeon name
});
