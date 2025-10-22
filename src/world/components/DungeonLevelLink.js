// DungeonLevelLink.js
// Component: describes a link from one dungeon level to another
import { defineComponent } from '../../lib/ecs/core.js';

export const DungeonLevelLink = defineComponent('DungeonLevelLink', {
  sourceLevelId: null,
  destinationLevelId: null,
  destinationPosition: null, // optional { x, y }
  oneWay: false,
  autoActivate: true,
  scriptRef: null,
  traversed: 0,
  tags: []
});
