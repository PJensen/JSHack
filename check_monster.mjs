import { getMonster } from './src/rules/data/monsters.js';
const def = getMonster('grid_bug');
if (!def) { console.log('NOT FOUND'); } 
else {
  const onDeath = def.hooks?.onDeath;
  console.log('has onDeath:', Array.isArray(onDeath), 'len:', onDeath?.length);
  if (Array.isArray(onDeath)) console.log('fn type:', typeof onDeath[0]);
}
