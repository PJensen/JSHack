import { assert } from "jsr:@std/assert";
import { World } from '../src/lib/ecs-js/index.js';
import { buildEquipmentItem, listEquipment } from '../src/rules/data/equipmentLoader.js';
import { ItemInfo } from '../src/rules/components/ItemInfo.js';
import { Material } from '../src/rules/components/Material.js';
import { NamedIdentity } from '../src/rules/components/NamedIdentity.js';

Deno.test("equipment data is available and buildEquipmentItem works", () => {
  const all = listEquipment();
  assert(Array.isArray(all) && all.length > 0, 'equipment defs available');
  assert(all.some(x => x.id === 'sword_plain'), 'sword_plain exists');

  const world = new World({ seed: 1 });
  const id = buildEquipmentItem(world, 'sword_plain', {});
  assert(world.isAlive(id), 'item entity created');
  const ident = world.get(id, NamedIdentity);
  const info = world.get(id, ItemInfo);
  const mat = world.get(id, Material);
  assert(ident && ident.identity === 'sword_plain', 'identity set');
  assert(info && info.type === 'equip', 'type equip');
  assert(info.slot === 'weapon', 'slot weapon');
  assert(info.bonuses && info.bonuses.attack === 2, 'bonuses propagated');
  assert(mat && mat.kind === 'steel', 'material propagated');
});
