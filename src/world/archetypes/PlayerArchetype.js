import { defineArchetype } from '../../lib/ecs/archetype.js';
import { Glyph } from '../components/Glyph.js';
import { Score } from '../components/Score.js';
import { MapView } from '../components/MapView.js';
import { Camera } from '../components/Camera.js';
import { Player } from '../components/Player.js';
import { Health } from '../components/Health.js';
import { Mana } from '../components/Mana.js';
import { Equipment } from '../components/Equipment.js';
import { Position } from '../components/Position.js';
import { Inventory } from '../components/Inventory.js';
import { Gold } from '../components/Gold.js';
import { Status } from '../components/Status.js';
import { Alignment} from '../components/Alignment.js';
import { Deity } from '../components/Deity.js';

// PlayerArchetype: basic player entity template using archetype steps
export const PlayerArchetype = defineArchetype('Player',
  [Glyph, (params)=> ({ char: params?.Glyph?.char ?? '@', fg: params?.Glyph?.fg ?? '#fff', bg: params?.Glyph?.bg ?? '#000' })],
  [Score, (params)=> ({ value: params?.Score?.value ?? 0 })],
  [MapView, (params)=> ({ radius: params?.MapView?.radius ?? 8 })],
  [Camera, (params)=> ({ active: params?.Camera?.active ?? true })],
  [Player, (params)=> ({ gold: 0, inventory: [], spells: [], activeSpellIndex: -1 })],
  [Health, (params)=> ({ maxHp: params?.Health?.maxHp ?? 20, hp: params?.Health?.hp ?? 20 })],
  [Mana, (params)=> ({ maxMana: params?.Mana?.maxMana ?? 30, mana: params?.Mana?.mana ?? 30, manaRegen: params?.Mana?.manaRegen ?? 3 })],
  [Equipment, (params)=> ({ weapon: null, armor: null, ring1: null, ring2: null })],
  [Position, (params)=> ({ x: params?.Position?.x ?? 0, y: params?.Position?.y ?? 0 })],
  [Inventory, (params)=> ({ items: [] })],
  [Gold, (params)=> ({ amount: 0 })],
  [Status, (params)=> ({ statuses: [] })],
  [Alignment, (params)=> ({ value: params?.Alignment?.value ?? 'neutral' })],
  [Deity, (params)=> ({ name: params?.Deity?.name ?? '' })]
);
