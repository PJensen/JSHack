// ecs/hierarchy.js
// One-Shot ECS — Hierarchy Extension (Parent/Child/Siblings)
// -----------------------------------------------------------
// • Pure ES module. No build. No framework.
// • Works with the existing one_shot_ecs.js World API.
// • Provides: Parent/Sibling components + attach/detach, child iteration,
//   ordering (before/after/index), subtree destroy, and safety checks.
//
// Design:
// - Intrusive linked list per parent: Parent{first,last,count}, Sibling{parent,prev,next,index}.
// - O(1) attach/detach; stable child order; index maintained on local relinks.
// - No core patching required. Optional destroySubtree() for cascade.
//
// Usage:
//   import { World, defineComponent } from './ecs/core.js';
//   import * as H from './ecs/hierarchy.js';
//
//   const w = new World();
//   const A = w.create(), B = w.create(), C = w.create();
//   H.ensureParent(w, A);
//   H.attach(w, B, A);                   // A -> B
//   H.attach(w, C, A, { before: B });    // A -> C, B
//   for (const id of H.children(w, A)) console.log(id); // C, B
//   H.detach(w, C);
//   H.destroySubtree(w, A);              // destroys A and any remaining descendants
//
// Optional: filtered child queries
//   const Position = defineComponent('Position', {x:0,y:0});
//   for (const [id, p] of H.childrenWith(w, A, Position)) { /* ... */ }

const KEY = Object.freeze({
  Parent: Symbol('Parent'),
  Sibling: Symbol('Sibling'),
});

/** Components */
export const Parent  = { key: KEY.Parent,  name: 'Parent',  defaults: Object.freeze({ first:0, last:0, count:0 }) };
export const Sibling = { key: KEY.Sibling, name: 'Sibling', defaults: Object.freeze({ parent:0, prev:0, next:0, index:0 }) };

/** Install marker components on an entity to act as a parent node (idempotent). */
export function ensureParent(world, id){
  if (!world.has(id, Parent)) world.add(id, Parent, { first:0, last:0, count:0 });
  return id;
}

/** True if entity has Sibling (i.e., participates in a hierarchy). */
export function isChild(world, id){ return world.has(id, Sibling); }

/** Get parent id of a child (0 if none). */
export function getParent(world, child){ const s = world.get(child, Sibling); return s ? s.parent|0 : 0; }

/** Iterate direct children of a parent (in order). */
export function *children(world, parent){
  const p = world.get(parent, Parent); if (!p) return;
  let c = p.first|0;
  while (c){ yield c; const s = world.get(c, Sibling); c = s ? (s.next|0) : 0; }
}

/** Iterate direct children of a parent that also have given components. */
export function *childrenWith(world, parent, ...comps){
  for (const c of children(world, parent)){
    let ok = true;
    for (const k of comps){ if (!world.has(c, k)) { ok=false; break; } }
    if (!ok) continue;
    yield [c, ...comps.map(k=>world.get(c,k))];
  }
}

/** Count children in O(1). */
export function childCount(world, parent){ const p = world.get(parent, Parent); return p ? p.count|0 : 0; }

/**
 * Attach child under parent with optional ordering:
 *   { before:id } insert before sibling
 *   { after:id }  insert after sibling
 *   { index:n }   insert at position (0..count), clamped
 * Defaults to append at end.
 */
export function attach(world, child, parent, opts={}){
  if (child === parent) throw new Error('attach: cannot parent to self');
  ensureParent(world, parent);

  // If already attached somewhere, detach first (stable if same parent+position)
  if (isChild(world, child)){
    const curP = getParent(world, child);
    if (curP === parent){
      // Fast path: reposition within same parent if needed
      return _reinsertSameParent(world, child, parent, opts);
    }
    detach(world, child);
  }

  // Add Sibling comp
  world.add(child, Sibling, { parent, prev:0, next:0, index:0 });

  // Compute insertion point
  const p = world.get(parent, Parent);
  let before = (opts.before|0) || 0;
  let after  = (opts.after|0)  || 0;
  let useIndex = (typeof opts.index === 'number') ? (opts.index|0) : null;

  if (before && after) throw new Error('attach: provide at most one of before/after');

  if (useIndex != null){
    useIndex = Math.max(0, Math.min(p.count, useIndex));
    // Find neighbour by index
    if (useIndex === p.count){ after = p.last|0; }
    else if (useIndex === 0){ before = p.first|0; }
    else {
      // Walk to index (bounded walk; children are often tiny)
      let i=0, c = p.first|0;
      while (c && i < useIndex){ c = (world.get(c, Sibling).next|0); i++; }
      before = c|0;
    }
  }

  let prev=0, next=0, idx=0;

  if (before){
    const bs = world.get(before, Sibling);
    if (!bs || bs.parent !== parent) throw new Error('attach: before target not child of parent');
    next = before; prev = bs.prev|0; idx = bs.index|0;
    // hook into chain
    if (prev){ world.set(prev, Sibling, { next: child }); } else { world.set(parent, Parent, { first: child }); }
    world.set(next, Sibling, { prev: child });
    _bumpIndices(world, parent, idx, +1);
  } else if (after){
    const as = world.get(after, Sibling);
    if (!as || as.parent !== parent) throw new Error('attach: after target not child of parent');
    prev = after; next = as.next|0; idx = (as.index|0)+1;
    if (next){ world.set(next, Sibling, { prev: child }); } else { world.set(parent, Parent, { last: child }); }
    world.set(prev, Sibling, { next: child });
    _bumpIndices(world, parent, idx, +1);
  } else {
    // append
    prev = p.last|0;
    idx = p.count|0;
    if (prev){ world.set(prev, Sibling, { next: child }); }
    else { world.set(parent, Parent, { first: child }); }
    world.set(parent, Parent, { last: child });
  }

  world.set(child, Sibling, { parent, prev, next, index: idx });
  world.set(parent, Parent, { count: p.count + 1 });
  return child;
}

/** Detach child from its parent; keeps Sibling component but clears links unless opts.remove is true. */
export function detach(world, child, opts={}){
  const s = world.get(child, Sibling);
  if (!s || !s.parent) return child;
  const parent = s.parent|0; const p = world.get(parent, Parent);
  if (!p) { _clearSibling(world, child); return child; }
  const prev = s.prev|0, next = s.next|0, idx = s.index|0;

  if (prev){ world.set(prev, Sibling, { next }); } else { world.set(parent, Parent, { first: next }); }
  if (next){ world.set(next, Sibling, { prev }); } else { world.set(parent, Parent, { last: prev }); }

  _bumpIndices(world, parent, idx+1, -1);
  world.set(parent, Parent, { count: Math.max(0, p.count-1) });
  if (opts.remove) world.remove(child, Sibling);
  else world.set(child, Sibling, { parent:0, prev:0, next:0, index:0 });
  return child;
}

/** Move child within the same parent to a new position (via {before/after/index}). */
function _reinsertSameParent(world, child, parent, opts){
  // Compute current head/tail and short-circuit if no move necessary
  const s = world.get(child, Sibling), curIdx = s.index|0;
  let targetIdx = curIdx;

  if (typeof opts.index === 'number'){
    targetIdx = Math.max(0, Math.min(childCount(world, parent), opts.index|0));
  } else if (opts.before){
    const bs = world.get(opts.before|0, Sibling);
    if (!bs || bs.parent !== parent) throw new Error('attach: before target not child of same parent');
    targetIdx = bs.index|0;
  } else if (opts.after){
    const as = world.get(opts.after|0, Sibling);
    if (!as || as.parent !== parent) throw new Error('attach: after target not child of same parent');
    targetIdx = (as.index|0) + 1;
  } else {
    // Append if no directive
    const p = world.get(parent, Parent); targetIdx = p ? p.count : curIdx;
  }

  if (targetIdx === curIdx) return child;

  // Extract and re-insert
  detach(world, child);
  attach(world, child, parent, { index: targetIdx });
  return child;
}

/** Internal: bump indices for children in [start..end) by delta (+/-1). */
function _bumpIndices(world, parent, startIdx, delta){
  let i=0;
  for (const c of children(world, parent)){
    if (i >= startIdx){ const s = world.get(c, Sibling); world.set(c, Sibling, { index: (s.index|0) + delta }); }
    i++;
  }
}

/** Internal: clear sibling links on a node (keeps component unless removed by caller). */
function _clearSibling(world, id){
  if (world.has(id, Sibling)) world.set(id, Sibling, { parent:0, prev:0, next:0, index:0 });
}

/** Destroy an entity and all descendants (depth-first). Safe with deferral. */
export function destroySubtree(world, root){
  // Snapshot ids first to avoid walking a mutating list
  const toDestroy = [];
  (function walk(id){
    for (const c of children(world, id)) walk(c);
    toDestroy.push(id);
  })(root);

  // Destroy leaves first, then root; deferrals will queue correctly
  for (const id of toDestroy) world.destroy(id);
}

/** Reparent: move child to a new parent with optional ordering. */
export function reparent(world, child, newParent, opts={}){
  detach(world, child);
  ensureParent(world, newParent);
  return attach(world, child, newParent, opts);
}

/** Utility: indexOf child within parent (-1 if not found). */
export function indexOf(world, child){
  const s = world.get(child, Sibling); return s ? (s.index|0) : -1;
}

/** Utility: nth child (0-based); returns 0 if out of range. */
export function nthChild(world, parent, n){
  const p = world.get(parent, Parent); if (!p) return 0;
  if (n < 0 || n >= p.count) return 0;
  let i=0; for (const c of children(world, parent)){ if (i++===n) return c; }
  return 0;
}
