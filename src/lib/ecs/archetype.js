// ecs/archetypes.js
// One-Shot ECS — Archetypes (Prefab-like entity creation)
// -------------------------------------------------------
// Zero deps. Pure ES module. Works with one_shot_ecs.js.
// Design goals:
//  - One file = one idea (prefabs).
//  - Composable: archetypes can include other archetypes.
//  - Hackable: steps are plain data or tiny functions.
//  - Deterministic: no hidden randomness; pass params/seed yourself.
//  - Safe: uses world.batch() to avoid cache churn; a deferred creator is provided.
//
// Glossary
//  Archetype = { name, steps: [Step...] }
//  Step ∈ one of:
//    • [Comp, init]               // add Comp with data (object) or init(params, world, id) -> object
//    • fn(world, id, params)      // arbitrary custom step
//    • { use: Archetype, with? }  // include another archetype with optional component overrides
//
// API
//  defineArchetype(name, ...steps) -> Archetype
//  compose(name, ...archetypesOrSteps) -> Archetype
//  withOverrides(archetype, overrides) -> Archetype
//  createFrom(world, archetype, params?) -> entityId
//  createMany(world, archetype, count, paramsMaker?) -> entityIds[]
//  createDeferred(world, archetype, params?) -> void (queues a command)
//  cloneFrom(world, sourceId, comps?) -> entityId  (copy listed comps or all present)
//

/**
 * Define a reusable archetype (prefab).
 *
 * An archetype is a lightweight description: { name, steps }
 * Steps may be component tuples, functions, or nested archetype usages.
 *
 * @param {string} name - Human-readable archetype name.
 * @param {...any} steps - Steps making up the archetype (see module docs).
 * @returns {{name:string,steps:Array}} Read-only Archetype object.
 */
export function defineArchetype(name, ...steps){
  return Object.freeze({ name: String(name||'Archetype'), steps: _norm(steps) });
}

/**
 * Compose a new archetype from other archetypes, step arrays, or individual steps.
 *
 * @param {string} name - Resulting archetype name.
 * @param {...(Archetype|Array|Function|Object)} parts - Pieces to compose.
 * @returns {{name:string,steps:Array}} Composite Archetype.
 */
export function compose(name, ...parts){
  const steps = [];
  for (const p of parts){
    if (!p) continue;
    if (_isArchetype(p)) steps.push({ use:p });
    else if (Array.isArray(p)) steps.push(..._norm(p));
    else steps.push(p);
  }
  return Object.freeze({ name: String(name||'Composite'), steps });
}

/**
 * Create an entity immediately from an archetype.
 * Runs the creation inside `world.batch()` to minimize cache invalidation.
 *
 * @param {World} world - The ECS world instance (must implement create, add, batch).
 * @param {Object} archetype - The archetype returned by `defineArchetype`/`compose`.
 * @param {Object} [params={}] - Optional params passed to component initializers.
 * @returns {number} The newly created entity id.
 */
export function createFrom(world, archetype, params={}){
  if (!_isArchetype(archetype)) throw new Error('createFrom: not an Archetype');
  let created = 0;
  return world.batch(()=>{
    const id = world.create(); created = id;
    _apply(world, id, archetype, params, null);
    return id;
  });
}

/**
 * Create multiple entities from an archetype.
 *
 * @param {World} world - ECS world instance.
 * @param {Object} archetype - Archetype to instantiate.
 * @param {number} count - Number of instances to create.
 * @param {(function(number,number):Object)=} paramsMaker - Optional function (i,id) -> params.
 * @returns {number[]} Array of created entity ids.
 */
export function createMany(world, archetype, count, paramsMaker){
  const out = new Array(Math.max(0, count|0));
  return world.batch(()=>{
    for (let i=0;i<out.length;i++){
      const id = world.create(); out[i]=id;
      const params = paramsMaker ? paramsMaker(i, id) : {};
      _apply(world, id, archetype, params, null);
    }
    return out;
  });
}

/**
 * Queue an archetype creation to run later (safe during a tick).
 * Uses `world.command()` to defer execution according to the world's semantics.
 *
 * @param {World} world - ECS world instance with .command(fn).
 * @param {Object} archetype - Archetype to instantiate.
 * @param {Object=} params - Optional params forwarded to createFrom.
 */
export function createDeferred(world, archetype, params={}){
  if (!_isArchetype(archetype)) throw new Error('createDeferred: not an Archetype');
  world.command(()=> createFrom(world, archetype, params));
}

/** Wrap an archetype with component overrides: { [Comp.key]: data|fn(params, w, id, prev)->data } */
/**
 * Return a shallow wrapper archetype that applies component overrides.
 *
 * Overrides may be provided as a Map keyed by component key or name, or
 * as a plain object mapping keys to data or functions.
 *
 * @param {Object} archetype - Archetype to wrap.
 * @param {Object|Map} overrides - Overrides map/object: { [Comp.key|Comp.name]: data|fn }
 * @returns {Object} New archetype that composes the original with overrides applied.
 */
export function withOverrides(archetype, overrides){
  if (!_isArchetype(archetype)) throw new Error('withOverrides: not an Archetype');
  // Accept either a Map (already keyed by Comp.key or string) or a plain object.
  const ov = (overrides instanceof Map) ? new Map(overrides) : new Map();
  if (!(overrides instanceof Map)){
    for (const k of Object.keys(overrides||{})){
      const maybeComp = overrides[k];
      // If the user provided the component constructor as the key (unlikely for objects),
      // detect common shape and use its .key symbol. Otherwise keep the provided key (string).
      const sym = (typeof k === 'symbol') ? k
               : (maybeComp && maybeComp.key && maybeComp.defaults !== undefined) ? maybeComp.key
               : null;
      ov.set(sym || k, overrides[k]);
    }
  }
  const wrapped = Object.freeze({ name: archetype.name+'+with', steps: [{ use:archetype, with:ov }] });
  return wrapped;
}

/** Shallow clone: copy a set of components from an entity to a new entity. */
/**
 * Shallow clone an entity by copying listed components (or all present components).
 *
 * @param {World} world - ECS world instance.
 * @param {number} sourceId - Entity id to clone from.
 * @param {Array=} comps - Optional array of component constructors to copy. If omitted, attempts
 *                         to detect attached components via internal stores (best-effort).
 * @returns {number} New entity id of the clone.
 */
export function cloneFrom(world, sourceId, comps=null){
  const all = comps ?? _allComponentsOn(world, sourceId);
  return world.batch(()=>{
    const id = world.create();
    for (const Comp of all){
      const src = world.get(sourceId, Comp);
      if (src) {
        // Let World.add() perform the deep-clone/copy; it handles functions and
        // other non-serializable values robustly. Passing the raw object keeps
        // behavior consistent with direct creation paths.
        world.add(id, Comp, src);
      }
    }
    return id;
  });
}

/* ===================== internals ===================== */

function _isArchetype(x){ return !!(x && Array.isArray(x.steps)); }

function _norm(steps){
  // Normalize steps without flattening arrays passed as individual steps.
  // Accepts either an array of steps or nested arrays where each element
  // may itself be an array representing a component tuple [Comp, init].
  const out = [];
  for (const s of steps){
    if (!s) continue;
    if (typeof s === 'function'){ out.push(s); continue; }
    // If the step itself is an array and its first element is also an array,
    // treat it as a list of steps to include (e.g., compose(name, [...steps])).
    if (Array.isArray(s) && Array.isArray(s[0])){
      for (const sub of s) {
        if (!sub) continue;
        if (typeof sub === 'function') { out.push(sub); continue; }
        if (Array.isArray(sub)){
          const [Comp, init] = sub;
          if (!Comp || !Comp.key) throw new Error('archetype step: expected [Component, init]');
          out.push({ t:'comp', Comp, init });
          continue;
        }
        if (_isArchetype(sub) || (sub.use && _isArchetype(sub.use))){ out.push({ use: sub.use || sub, with: sub.with || null }); continue; }
        if (sub.Comp && sub.t==='comp'){ out.push(sub); continue; }
        if (typeof sub.run === 'function'){ out.push((w,id,p)=>sub.run(w,id,p)); continue; }
        throw new Error('archetype step: unknown form');
      }
      continue;
    }
    if (Array.isArray(s)){
      const [Comp, init] = s;
      if (!Comp || !Comp.key) throw new Error('archetype step: expected [Component, init]');
      out.push({ t:'comp', Comp, init });
      continue;
    }
    if (_isArchetype(s) || (s.use && _isArchetype(s.use))){ out.push({ use: s.use || s, with: s.with || null }); continue; }
    if (s.Comp && s.t==='comp'){ out.push(s); continue; }
    // last resort: treat as custom step object with .run(world,id,params)
    if (typeof s.run === 'function'){ out.push((w,id,p)=>s.run(w,id,p)); continue; }
    throw new Error('archetype step: unknown form');
  }
  return out;
}

function _apply(world, id, archetype, params, inheritedOverrides){
  for (const step of archetype.steps){
    // Composition: include other archetypes with local overrides
    if (step && step.use && _isArchetype(step.use)){
      const merged = _mergeOverrides(inheritedOverrides, step.with);
      _apply(world, id, step.use, params, merged);
      continue;
    }
    if (typeof step === 'function'){
      step(world, id, params);
      continue;
    }
    if (step && step.t === 'comp'){
      const Comp = step.Comp;
      const init = step.init;
      // Base data: object or function(params,w,id) -> object
      const base = (typeof init === 'function') ? init(params, world, id) : (init || {});
      // Apply override if present
      const ov = _overrideFor(inheritedOverrides, Comp);
      const data = (typeof ov === 'function')
        ? ov(params, world, id, base)
        : (ov ? { ...base, ...ov } : base);
      world.add(id, Comp, data);
      continue;
    }
    // Fallback: ignore unknown step types
  }
}

function _mergeOverrides(parent, local){
  if (!parent && !local) return null;
  const m = new Map();
  if (parent) for (const [k,v] of parent) m.set(k,v);
  if (local) for (const [k,v] of local) m.set(k,v);
  return m;
}

function _overrideFor(map, Comp){
  if (!map) return null;
  if (map.has(Comp.key)) return map.get(Comp.key);
  if (map.has(Comp.name)) return map.get(Comp.name); // string key fallback
  return null;
}

function _allComponentsOn(world, id){
  // Best-effort scan of world internals: iterate known stores
  const out = [];
  // Defensive: world._store may not be a Map or may be hidden; try to iterate when possible.
  const stores = world && world._store;
  if (stores && typeof stores[Symbol.iterator] === 'function'){
    for (const entry of stores){
      const store = Array.isArray(entry) ? entry[1] : entry;
      try{
        if (store && typeof store.has === 'function' && store.has(id)){
          if (store._comp) out.push(store._comp);
        }
      }catch(e){ /* ignore per-store errors */ }
    }
  }
  return out;
}
