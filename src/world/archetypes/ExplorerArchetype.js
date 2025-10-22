import { defineArchetype } from '../../lib/ecs/archetype.js';
import Glyph from '../components/Glyph.js';
import { Position } from '../components/Position.js';
import { InputIntent } from '../components/InputIntent.js';
import { Inventory } from '../components/Inventory.js';
import { Health } from '../components/Health.js';
import { Player } from '../components/Player.js';
import { CameraFocus } from '../components/CameraFocus.js';

// Explorer: player-centric bundle that can see, act, and be acted upon.
export const ExplorerArchetype = defineArchetype('Explorer',
  [Glyph, (p)=>({
    char: p?.Glyph?.char ?? '@',
    fg:   p?.Glyph?.fg   ?? '#fff',
    bg:   p?.Glyph?.bg   ?? null,
    color:p?.Glyph?.color?? (p?.Glyph?.fg ?? '#fff')
  })],
  [Position, (p)=>({ x: p?.Position?.x ?? 0, y: p?.Position?.y ?? 0 })],
  [InputIntent, (p)=>({
    dx: p?.InputIntent?.dx ?? 0,
    dy: p?.InputIntent?.dy ?? 0,
    action: p?.InputIntent?.action ?? null
  })],
  [Inventory, (p)=>({ items: p?.Inventory?.items ?? [] })],
  [Health, (p)=>({ maxHp: p?.Health?.maxHp ?? 20, hp: p?.Health?.hp ?? 20 })],
  [Player, (p)=>({
    gold: p?.Player?.gold ?? 0,
    name: p?.Player?.name ?? 'Hero',
    spells: p?.Player?.spells ?? [],
    activeSpellIndex: p?.Player?.activeSpellIndex ?? -1
  })],
  [CameraFocus, (p)=>({ active: p?.CameraFocus?.active ?? true })]
);
