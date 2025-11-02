import { EQUIP_DEFS } from '../src/rules/data/equipment.js';
import { AFFIX_DEFS } from '../src/rules/data/affixes.js';
import { validateAll } from '../src/rules/data/validate.js';

function assert(c,m){ if(!c) throw new Error('Assertion failed: '+m); }

async function run(){
  const ok = validateAll({ EQUIP_DEFS, AFFIX_DEFS });
  assert(ok === true, 'validation returns true');
  console.log('Data validation PASS');
}
run().catch(e=>{ console.error(e); process.exitCode = 1; });
