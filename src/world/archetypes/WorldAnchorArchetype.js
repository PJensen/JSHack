import { defineArchetype } from '../../lib/ecs/archetype.js';
import Glyph from '../components/Glyph.js';
import { Position } from '../components/Position.js';
import { Collider } from '../components/Collider.js';
import { Interactable } from '../components/Interactable.js';
import { ScriptRef } from '../components/ScriptRef.js';

// World Anchor: doors, chests, altars, portals — same bundle, different data.
export const WorldAnchorArchetype = defineArchetype('WorldAnchor',
  [Glyph, (p)=>({
    char: p?.Glyph?.char ?? '+',
    fg:   p?.Glyph?.fg   ?? '#ccc',
    bg:   p?.Glyph?.bg   ?? null,
    color:p?.Glyph?.color?? (p?.Glyph?.fg ?? '#ccc')
  })],
  [Position, (p)=>({ x: p?.Position?.x ?? 0, y: p?.Position?.y ?? 0 })],
  [Collider, (p)=>({ solid: p?.Collider?.solid ?? true, blocksSight: p?.Collider?.blocksSight ?? false })],
  [Interactable, (p)=>({ type: p?.Interactable?.type ?? 'generic', enabled: p?.Interactable?.enabled ?? true, prompt: p?.Interactable?.prompt ?? null })],
  // Optional ScriptRef: only added if provided in params
  (world, id, p)=>{
    const sr = p?.ScriptRef;
    if (sr) world.add(id, ScriptRef, { ref: sr.ref ?? null, params: sr.params ?? {} });
  }
);
