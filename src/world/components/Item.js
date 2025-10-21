// Item component for ECS (data only)
import { defineComponent } from '../../lib/ecs/core.js';

// Item is a pure data component for ECS entities representing items.
// Example fields: id, name, type, properties (all optional, see archetypes for usage)
const Item = defineComponent({
    id: null,
    name: '',
    type: '',
    properties: {},
});

export default Item;
