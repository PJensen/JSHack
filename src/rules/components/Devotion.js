import { defineComponent } from '../../lib/ecs-js/index.js';

export const Devotion = defineComponent('Devotion', {
  deityId: null, // key into DEITY_DEFS, e.g. 'molkhar'
  pantheon: false, // when true, deity influence can shift with playstyle
});
