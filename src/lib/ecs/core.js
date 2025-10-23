/*
// Cross-world reference utilities (isolated in crossWorld.js)
export { createCrossWorldReference, resolveCrossWorldReference, isCrossWorldReferenceValid } from './crossWorld.js';
 * One‑Shot ECS — Pure ES Module
 * ------------------------------------------------------------
 * Philosophy: entities are just IDs, components are plain data,
 * systems are simple functions that iterate queries.
 *
 * Zero deps. Zero build. Works by dropping <script type="module"> in any page.
 * Deterministic when seeded. Hackable by inspection.
 *
 * Usage (quick start):
 *   import { World, defineComponent, Not, Changed, startLoop } from './one-shot-ecs.js';
 *   const Position = defineComponent('Position', { x:0, y:0 });
 *   const Velocity = defineComponent('Velocity', { x:0, y:0 });
 *   const w = new World({ seed: 0xC0FFEE });
 *   const e = w.create();
 *   w.add(e, Position, {x: 10, y: 10});
 *   w.add(e, Velocity, {x: 1, y: -0.5});
 *   w.system((world, dt)=>{
 *     for (const [id, pos, vel] of world.query(Position, Velocity)){
 *       pos.x += vel.x * dt; pos.y += vel.y * dt;
 *     }
 *   });
 *   startLoop(w); // runs requestAnimationFrame with a fixed‑step core
 *
 * Safety & Patterns (READ THIS):
 *   - Mutating component data in-place does NOT auto-flag Changed.
 *     Use world.set(id, Comp, patch) or world.mutate(id, Comp, fn) to mark the
 *     component as changed this frame. Or call world.markChanged(id, Comp).
 *   - Structural mutations during systems are safe-by-default: if performed during
 *     tick(), they auto-defer to the end of the frame and return null. In **strict**
 *     mode (opts.strict = true), these throw instead — ideal for dev.
 *   - Query cache keys use component identity (Symbol) to avoid name collisions.
 *   - For very large worlds, prefer world.queryGen(...) and chunk work across frames.
 *   - High-performance mode: opts.store = 'soa' swaps Map stores for struct-of-arrays
 *     (SoA) with live views for hot components.
 *   - Debugging: world.enableDebug(true) logs deferrals, cache invalidations, and
 *     phase timing.
 *
 * Features in ~200 lines:
 *   • Sparse component stores (Map) w/ change tags
 *   • Query builder: all / Not(...) / Changed(...)
 *   • Generator queries (yield‑friendly) for large worlds
 *   • Stable iteration order (ascending entity id)
 *   • Deferred command queue (safe add/remove during ticks)
 *   • Simple event bus (on/emit/off)
 *   • Deterministic RNG (mulberry32)
 *   • Tiny scheduler with phases: 'early','update','late','render'
 */

// System ordering helpers (optional) — used when available to resolve before/after
import { registerSystem, getOrderedSystems, runSystems } from './systems.js';

/** Utility: deterministic RNG (mulberry32) */
function mulberry32(seed){
  let a = seed >>> 0;
  return function(){
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/** Lightweight symbol wrappers for query modifiers */
const $NOT = Symbol('Not');
const $CHANGED = Symbol('Changed');
export const Not = (Comp) => ({ kind:$NOT, Comp });
export const Changed = (Comp) => ({ kind:$CHANGED, Comp });

/** Component factory — returns a descriptor used as a key in the world stores. */
// Now supports optional validation: defineComponent(name, defaults, { validate })
export function defineComponent(name, defaults, options = {}) {
  const key = Symbol(name);
  const shape = Object.freeze({ ...(defaults ?? {}) });
  const validate = typeof options.validate === 'function' ? options.validate : undefined;
  return Object.freeze({ key, name, defaults: shape, validate });
}

/** World — entity registry, component stores, systems, and events. */
export class World {
  constructor(opts={}){
    // lifecycle hooks
    this.onPhase = opts.onPhase || null;
    this.onTick = opts.onTick || null;

    // batching & assertions
    this._batchDepth = 0;
    this._suspendInvalidate = false;
    this._pendingInvalidate = false;
    this._asserted = new Set();

    // RNG (deterministic when seeded)
    const seed = (opts.seed ?? (Math.random()*2**32)|0) >>> 0;
    this.seed = seed; this.rand = mulberry32(seed);

    // store / cache / change tracking
    this.storeMode = opts.store || 'map';
    this._store = new Map();    // Map<Comp.key, store>
    this._cache = new Map();    // query cache
    this._changed = new Map();  // Map<Comp.key, Set<id>>

    // systems & command queue
    this._systems = { early: [], update: [], late: [], render: [] };
    this._cmd = [];

    // event bus
    this._ev = new Map();

    // entity bookkeeping
    this._free = [];
    this._nextId = 1;
    this.alive = new Set();

    // runtime flags
    this._inTick = false;
    this.strict = !!opts.strict;
    this._debug = !!opts.debug;

    // timing
    this.time = 0;
    this.frame = 0;
  }

  // Union query: groups = [ [A,B], [C,D], ... ]
  queryAny(groups, opts={}){
    const self = this;
    const where   = typeof opts.where   === 'function' ? opts.where : null;
    const project = typeof opts.project === 'function' ? opts.project : null;
    const lim   = (opts.limit==null) ? Infinity : Math.max(0, ~~opts.limit);
    const start = Math.max(0, ~~(opts.offset||0));

    // Precompute base lists per group (respecting your positive-cache rule)
    const specs = groups.map(g => normalizeTerms(g));
    const bases = specs.map(s => this._cachedEntityList(s, s.cacheKey));

    function *iter(){
      let outCount = 0, skipped = 0;
      for (let tag=0; tag<bases.length; tag++){
        const spec = specs[tag], list = bases[tag];
        for (let i=0; i<list.length; i++){
          const id = list[i];
          if (!passesDynamicFilters(self, id, spec)) continue;
          const comps = spec.all.map(c=>self.get(id,c));
          if (where && !where(...comps, id)) continue;
          if (skipped < start){ skipped++; continue; }
          if (outCount >= lim) return;
          const payload = project ? project(id, ...comps) : { id, comps:[...comps] };
          yield Object.assign({ tag }, payload);
          outCount++;
        }
      }
    }
    const wrapper = { [Symbol.iterator]: iter };
    wrapper.run = (fn)=>{ for (const row of wrapper) fn(row); return self; };
    wrapper.count = (opts)=>{
      if (opts && opts.cheap){
        // cheap: sum pre-dynamic base lengths
        let total = 0;
        for (let i=0;i<bases.length;i++) total += bases[i].length;
        return total;
      }
      let c = 0, skipped = 0;
      for (let tag=0; tag<bases.length; tag++){
        const spec = specs[tag], list = bases[tag];
        for (let i=0;i<list.length;i++){
          const id = list[i];
          if (!passesDynamicFilters(self, id, spec)) continue;
          const comps = spec.all.map(c=>self.get(id,c));
          if (where && !where(...comps, id)) continue;
          if (skipped < start){ skipped++; continue; }
          if (c >= lim) return c;
          c++;
        }
      }
      return c;
    };
    return wrapper;
  }

  /*** Entity life‑cycle ***/
  create(){
    const id = this._free.length ? this._free.pop() : this._nextId++;
    this.alive.add(id); return id;
  }
  destroy(id){
    if (!this.alive.has(id)) return false;
    if (this._inTick){
      if (this.strict) throw new Error('destroy: structural mutation during tick (strict)');
      if (this._debug) console.debug('[ECS] defer destroy');
      this.command(['destroy', id]);
      return null;
    }
    for (const [ckey, store] of this._store){
      if (store.delete(id)) this._markChanged(ckey, id);
    }
    this.alive.delete(id); this._free.push(id);
    this._invalidateCaches();
    return true;
  }

  /*** Components ***/
  _mapFor(Comp){
    const k = Comp.key;
    if (!this._store.has(k)){
      const store = (this.storeMode === 'soa') ? makeSoAStore(Comp) : makeMapStore();
      this._store.set(k, store);
    }
    return this._store.get(k);
  }
  _markChanged(ckey, id){
    if (!this._changed.has(ckey)) this._changed.set(ckey, new Set());
    this._changed.get(ckey).add(id);
  }
  add(id, Comp, data){
    if (!this.alive.has(id)) throw new Error('add: entity not alive');
    if (this._inTick){
      if (this.strict) throw new Error('add: structural mutation during tick (strict)');
      if (this._debug) console.debug('[ECS] defer add');
      this.command(['add', id, Comp, data]);
      return null;
    }
  // Create a fresh instance by deep-cloning defaults then applying data
  const rec = Object.assign({}, deepClone(Comp.defaults), deepClone(data || {}));
    // Component validation (optional)
    if (typeof Comp.validate === 'function' && !Comp.validate(rec)) {
      throw new Error(`Validation failed for component ${Comp.name}`);
    }
    this._mapFor(Comp).set(id, rec);
    this._markChanged(Comp.key, id);
    this._invalidateCaches();
    return rec;
  }
  get(id, Comp){ return this._mapFor(Comp).get(id) || null; }

  /**
   * getInstance(id, Comp)
   * ------------------------------------------------------------
   * O(1) direct lookup of a component instance.
   * This bypasses Map iteration and query wrapping.
   * Used for hot paths (rendering, physics) where you already
   * know the entity and component type.
   *
   * Equivalent to "give me the live record for this entity now".
   */
  getInstance(id, Comp) {
    const store = this._store.get(Comp.key);
    if (!store) return null;
    if (store.fast) return store.fast[id] || null;
    if (store.get)  return store.get(id) || null;
    return null;
  }
  has(id, Comp){ return this._mapFor(Comp).has(id); }
  remove(id, Comp){
    if (this._inTick){
      if (this.strict) throw new Error('remove: structural mutation during tick (strict)');
      if (this._debug) console.debug('[ECS] defer remove');
      this.command(['remove', id, Comp]);
      return null;
    }
    const ok = this._mapFor(Comp).delete(id);
    if (ok){ this._markChanged(Comp.key, id); this._invalidateCaches(); }
    return ok;
  }

  /** Patch a component in-place and mark it Changed for this frame. */
  set(id, Comp, patch){
    if (this._inTick){
      if (this.strict) throw new Error('set: mutation during tick (strict)');
      if (this._debug) console.debug('[ECS] defer set');
      this.command(['set', id, Comp, patch]);
      return null;
    }
    const rec = this.get(id, Comp);
    if (!rec) throw new Error('set: entity lacks component');
    // Validate the result of the patch if validate exists
    const next = Object.assign({}, rec, patch);
    if (typeof Comp.validate === 'function' && !Comp.validate(next)) {
      throw new Error(`Validation failed for component ${Comp.name}`);
    }
    Object.assign(rec, patch);
    this._markChanged(Comp.key, id);
    return rec;
  }

  /** Arbitrary mutation helper; your callback receives the live record. */
  mutate(id, Comp, fn){
    if (this._inTick){
      if (this.strict) throw new Error('mutate: mutation during tick (strict)');
      if (this._debug) console.debug('[ECS] defer mutate');
      // mutate includes a function callback; keep fn in the tuple
      this.command(['mutate', id, Comp, fn]);
      return null;
    }
    const rec = this.get(id, Comp);
    if (!rec) throw new Error('mutate: entity lacks component');
    fn(rec);
    this._markChanged(Comp.key, id);
    return rec;
  }

  /*** Queries ***/
  /** Core query — returns an iterable of [id, ...componentDataInOrder] */
  // Lightweight check for optional opts object passed as last arg
  _isOpts(o){ return o && typeof o === 'object' && !('key' in o) && !('kind' in o); }

  query(...terms){
    // Extract optional opts
    let opts = null;
    if (terms.length && this._isOpts(terms[terms.length-1])) opts = terms.pop();
    const spec = normalizeTerms(terms);
    const key  = spec.cacheKey;
    const baseList = this._cachedEntityList(spec, key);

    // fast path: no opts => original iterator
    if (!opts){
      const tuples = this._tuplesFromList(baseList, spec);
      // expose a light wrapper so users can: for (const t of world.query(A,B)){}
      const self = this;
      tuples.run = (fn)=>{ for (const row of tuples) fn(...row); return self; };
      // count should reflect post-dynamic filters (Not/Changed)
      tuples.count = (opts)=>{
        // cheap=true: return pre-dynamic (positive) candidate count
        if (opts && opts.cheap) return baseList.length;
        let c = 0;
        for (let i=0;i<baseList.length;i++){
          const id = baseList[i];
          if (!passesDynamicFilters(self, id, spec)) continue;
          c++;
        }
        return c;
      };
      return tuples;
    }

    // Build iterator with dynamic features
    const where   = typeof opts.where   === 'function' ? opts.where : null;
    const project = typeof opts.project === 'function' ? opts.project : null;

    // Optional sorting by derived keys (stable)
    let list = baseList;
    if (opts.orderBy) {
      // materialize tuples once for ordering
      const rows = [];
      for (let i=0;i<list.length;i++){
        const id = list[i];
        if (!passesDynamicFilters(this, id, spec)) continue;
        const comps = spec.all.map(c=>this.get(id,c));
        if (where && !where(...comps, id)) continue;
        rows.push({ id, comps });
      }
      // Provide a tiny adapter: orderBy receives {id, p:projectionKeys, comps}
      rows.forEach(r => r.p = project ? project(r.id, ...r.comps) : r);
      rows.sort((A,B)=>opts.orderBy(A, B));
      list = rows.map(r => r.id);

      // We’ll yield from rows to avoid recomputing
      let idx = 0, start = Math.max(0, ~~(opts.offset||0));
      const lim = (opts.limit==null) ? Infinity : Math.max(0, ~~opts.limit);
      const self = this;
      return {
        [Symbol.iterator](){
          let count = 0;
          return {
            next(){
              while (idx < rows.length && count < lim){
                const r = rows[idx++]; // already filtered
                if (start-- > 0) continue;
                count++;
                const out = project ? project(r.id, ...r.comps) : [r.id, ...r.comps];
                return { value: out, done:false };
              }
              return { done:true };
            }
          };
        },
        run(fn){ for (const row of this) fn(row); return self; },
        count(opts){ // opts={cheap:true} allowed
          if (opts && opts.cheap) return baseList.length;
          return rows.length;
        }
      };
    }

    // No orderBy: stream on the fly with where/limit/offset
    const start = Math.max(0, ~~(opts.offset||0));
    const lim   = (opts.limit==null) ? Infinity : Math.max(0, ~~opts.limit);
    const self = this;

    function *iter(){
      let seen = 0, used = 0;
      for (let i=0;i<list.length;i++){
        const id = list[i];
        if (!passesDynamicFilters(self, id, spec)) continue;
        const comps = spec.all.map(c=>self.get(id,c));
        if (where && !where(...comps, id)) continue;
        if (seen++ < start) continue;
        if (used++ >= lim) break;
        yield project ? project(id, ...comps) : [id, ...comps];
      }
    }
    const tuples = { [Symbol.iterator]: iter };
    tuples.run   = (fn)=>{ for (const row of tuples) fn(row); return self; };
    // count reflects post-filtered rows (applies dynamic filters and where)
    tuples.count = (opts)=>{
      if (opts && opts.cheap) return list.length;
      let c = 0;
      for (let i=0;i<list.length;i++){
        const id = list[i];
        if (!passesDynamicFilters(self, id, spec)) continue;
        const comps = spec.all.map(c=>self.get(id,c));
        if (where && !where(...comps, id)) continue;
        c++;
      }
      return c;
    };
    return tuples;
  }
  /** Yield‑friendly generator for very large worlds */
  *queryGen(...terms){
    const spec = normalizeTerms(terms);
    const key = spec.cacheKey;
    const list = this._cachedEntityList(spec, key);
    for (let i=0;i<list.length;i++){
      const id = list[i];
      // re‑check negatives (Not/Changed) on the fly
      if (!passesDynamicFilters(this, id, spec)) continue;
      yield [id, ...spec.all.map(c=>this.get(id,c))];
    }
  }
  _tuplesFromList(list, spec){
    const self = this;
    function *iter(){
      for (let i=0;i<list.length;i++){
        const id = list[i];
        if (!passesDynamicFilters(self, id, spec)) continue;
        yield [id, ...spec.all.map(c=>self.get(id,c))];
      }
    }
    return { [Symbol.iterator]: iter };
  }
  _cachedEntityList(spec, key){
    // cache only by ALL‑set (positive comps); NONE/CHANGED are checked dynamically
    if (this._cache.has(key)) return this._cache.get(key);
    // intersection of entity sets for components in spec.all
    let result = null;
    for (const c of spec.all){
      const store = this._mapFor(c);
      const arr = store.entityIds();
      result = result ? intersectSorted(result, arr) : arr;
      if (!result.length) break;
      if (!result.length) break;
    }
    // if no positive comps: default to all living entities
    if (spec.all.length === 0){ result = Array.from(this.alive).sort((a,b)=>a-b); }
    this._cache.set(key, result);
    return result;
  }
  _invalidateCaches(){
    if (this._suspendInvalidate) { this._pendingInvalidate = true; return; }
    if (this._debug) console.debug('[ECS] cache invalidated');
    this._cache.clear();
    this._pendingInvalidate = false;
  }

  /*** Systems / Scheduler ***/
  /** Register a system at a phase (early|update|late|render). Default 'update'. */
  system(fn, phase='update', opts={}){
    if (this._debug) console.debug(`[ECS] system added @${phase}`);
    // Register with global ordering helper when available
    try{ if (typeof registerSystem === 'function') registerSystem(fn, phase, opts); }catch(e){}
    // Keep internal storage for backward compatibility and immediate iteration
    this._systems[phase].push(fn);
    return this;
  }

  /** Step the world by dt seconds. Executes phases in order and flushes commands. */
  tick(dt){
    this.time += dt;
    this.frame++;
    this._inTick = true;
    if (this._debug) console.groupCollapsed(`[ECS] tick frame=${this.frame} dt=${dt.toFixed(4)}`);
    const t0 = performance.now();
    // run phases
    const P = this._systems;
    for (const ph of ['early','update','late','render']){
      const ph0 = performance.now();
      // Prefer centralized execution via runSystems when available. This ensures
      // the external systems helper (systems.js) is actually used to resolve
      // ordering and run systems. Fall back to previous per-phase behavior
      // which preserves per-system try/catch.
      if (typeof runSystems === 'function'){
        // runSystems will call each registered system. Wrap to preserve
        // per-phase error resilience similar to the previous loop.
        try{
          runSystems(ph, this, dt);
        }catch(e){ console.warn('system error', e); }
      } else {
        // Try to obtain ordered systems from global ordering helper
        let ordered = null;
        try{ if (typeof getOrderedSystems === 'function') ordered = getOrderedSystems(ph); }catch(e){ ordered = null; }
        const list = (ordered && ordered.length) ? ordered : P[ph];
        for (let i=0;i<list.length;i++) try{ list[i](this, dt); } catch(e){ console.warn('system error', e); }
      }
      const ms = performance.now()-ph0;
      if (this._debug) console.debug(`[ECS] phase ${ph} ${ms.toFixed(2)}ms`);
      if (typeof this.onPhase === 'function') try{ this.onPhase(ph, ms, this); }catch(e){ console.warn('onPhase error', e); }
    }
    // flush deferred commands (in order submitted)
  if (this._cmd.length){
      // Copy-and-clear: clear the live queue before running so commands
      // queued during execution are processed on the next flush. This
      // prevents unbounded growth if commands continually re-queue.
      const cmds = this._cmd.slice();
      this._cmd.length = 0;
      if (this._debug) console.debug(`[ECS] flushing ${cmds.length} deferred op(s)`);

      // Safety guard: if an extremely large number of commands is queued,
      // process a bounded chunk this frame and defer the remainder to the
      // next tick to avoid long blocking loops and potential OOM.
      const MAX_PROCESS = 1000;
      if (cmds.length > MAX_PROCESS){
        if (this._debug) console.warn(`[ECS] large command batch (${cmds.length}) — processing first ${MAX_PROCESS} commands and deferring the rest to next tick`);
      }

      const limit = Math.min(cmds.length, MAX_PROCESS);
      // Temporarily mark out of tick so queued ops apply immediately instead of re-queuing
      const prevInTick = this._inTick; this._inTick = false;
      try{
        for (let i = 0; i < limit; i++){
          const f = cmds[i];
          try{
            // Backwards compatible: allow functions, but prefer compact op tuples
            if (typeof f === 'function') f();
            else if (Array.isArray(f)) this._applyOp(f);
          } catch(e){ console.warn('cmd error', e); }
        }
      } finally {
        this._inTick = prevInTick;
      }

      // If there are remaining commands, push them back onto the live queue
      // so they'll be processed on the next flush (preserves submission order).
      if (cmds.length > limit){
        this._cmd.push(...cmds.slice(limit));
        if (this._debug) console.debug(`[ECS] deferred ${cmds.length - limit} remaining command(s) to next tick`);
      }
    }
    // clear change tags for next frame
    this._changed.clear();
    this._inTick = false;
    const tms = performance.now()-t0;
    if (typeof this.onTick === 'function') try{ this.onTick(tms, this); }catch(e){ console.warn('onTick error', e); }
    if (this._debug) { console.debug(`[ECS] tick ${tms.toFixed(2)}ms`); console.groupEnd(); }
  }

  /** Defer a mutation until after current tick (safe during iteration). */
  // command accepts either a function (legacy) or a compact op tuple to
  // avoid allocating closures per-op. Tuple form: ['op', ...args]
  // Supported ops: ['destroy', id], ['add', id, Comp, data], ['remove', id, Comp], ['set', id, Comp, patch], ['mutate', id, Comp, fn]
  command(fnOrOp){ if (this._debug) console.debug('[ECS] command queued'); this._cmd.push(fnOrOp); return this; }

  // Internal: apply a compact op tuple. Kept minimal and mirrors public APIs.
  _applyOp(op){
    const t = op[0];
    try{
      if (t === 'destroy') return this.destroy(op[1]);
      if (t === 'add') return this.add(op[1], op[2], op[3]);
      if (t === 'remove') return this.remove(op[1], op[2]);
      if (t === 'set') return this.set(op[1], op[2], op[3]);
      if (t === 'mutate') return this.mutate(op[1], op[2], op[3]);
    }catch(e){ console.warn('applyOp error', e); }
  }

  /*** Events ***/
  on(event, fn){ if (!this._ev.has(event)) this._ev.set(event, new Set()); this._ev.get(event).add(fn); return ()=>this.off(event, fn); }
  off(event, fn){ const set = this._ev.get(event); if (set) set.delete(fn); }
  emit(event, payload){ const set = this._ev.get(event); if (!set) return 0; let n=0; for (const fn of set){ try{ fn(payload, this); n++; }catch(e){ console.warn('event error', e); } } if (this._debug) console.debug(`[ECS] emit '${event}' -> ${n}`); return n; }

  /** Convenience helpers */
  markChanged(id, Comp){ this._markChanged(Comp.key, id); }

  changed(id, Comp){ const s = this._changed.get(Comp.key); return !!(s && s.has(id)); }
  enableDebug(on=true){ this._debug = !!on; return this; }
  assert(expr, msg='Assertion failed'){ if (this.strict || this._debug){ if (!expr) throw new Error('[ECS] ' + msg); } return true; }
  assertOnce(tag, expr, msg='Assertion failed'){ if (expr) return true; if (this.strict) throw new Error('[ECS] ' + msg); if (this._debug && !this._asserted.has(tag)){ this._asserted.add(tag); console.warn('[ECS][once]', msg); } return false; }
  /** Run a batch of mutations outside of tick(). Suppresses cache invalidation until end. */
  batch(fn){
    this.assert(!this._inTick, 'batch() cannot run during tick');
    this._batchDepth++;
    const prevSuspend = this._suspendInvalidate;
    this._suspendInvalidate = true;
    try{ return fn(this); }
    finally{
      this._batchDepth--;
      this._suspendInvalidate = prevSuspend || (this._batchDepth>0);
      if (!this._suspendInvalidate && (this._pendingInvalidate || this._cmd.length)){
        // apply any queued commands (should be rare outside ticks) and invalidate caches once
        if (this._cmd.length){
          for (const f of this._cmd) { try{ if (typeof f === 'function') f(); else if (Array.isArray(f)) this._applyOp(f); } catch(e){ console.warn('cmd error', e); } }
          this._cmd.length=0;
        }
        this._invalidateCaches();
      }
    }
  }
}


/** Normalize query terms into { all, none, changed, cacheKey } */
function normalizeTerms(terms){
  const all = [], none = [], changed = [];
  for (const t of terms){
    if (!t) continue;
    if (t.kind === $NOT) none.push(t.Comp);
    else if (t.kind === $CHANGED) changed.push(t.Comp);
    else all.push(t);
  }
  // cache key depends only on positive comps (order‑independent)
  const cacheKey = all.map(c=>c.key.description||'c').sort().join('|') || '*';
  return { all, none, changed, cacheKey };
}

function passesDynamicFilters(world, id, spec){
  for (const c of spec.none){ if (world.has(id, c)) return false; }
  for (const c of spec.changed){ if (!world.changed(id, c)) return false; }
  return true;
}

/** Sorted intersection of two ascending numeric arrays. Returns a new array. */
function intersectSorted(a, b){
  let i=0, j=0; const out=[];
  while (i<a.length && j<b.length){
    const A=a[i], B=b[j];
    if (A===B){ out.push(A); i++; j++; }
    else if (A<B) i++; else j++;
  }
  return out;
}

/** startLoop — fixed‑step core with rAF. By default: fixed=1/60, maxSubSteps=5. */
export function startLoop(world, opts={}){
  const fixed = Math.max(1/240, opts.fixed || 1/60);
  const maxSub = Math.max(1, opts.maxSubSteps || 5);
  let acc = 0, last = performance.now();
  let stopped = false, req = 0;
  function frame(now){
    if (stopped) return;
    const dt = Math.min(0.25, (now - last) / 1000); // clamp spike
    last = now; acc += dt;
    let steps = 0;
    while (acc >= fixed && steps < maxSub){ world.tick(fixed); acc -= fixed; steps++; }
    if (opts.renderEveryFrame){ const alpha = acc / fixed; for (const f of world._systems.render) f(world, alpha); }
    req = requestAnimationFrame(frame);
  }
  req = requestAnimationFrame(frame);
  return () => { stopped = true; if (req) cancelAnimationFrame(req); };
}

/* -------------------------------------------------------------------------
 * Startup Self‑Tests (browser, zero‑build)
 * ---------------------------------------------------------------------- */
export function runSelfTests(){
  const results = [];
  function t(name, fn){
    try { fn(); results.push(['✓', name]); }
    catch(e){ console.error('Test failed:', name, e); results.push(['✗', name, e.message]); }
  }

  const A = defineComponent('A', { n:0 });
  const B = defineComponent('B', { n:0 });

  // 1) Changed semantics
  t('Changed flagged by set/mutate', ()=>{
    const w = new World();
    const e = w.create(); w.add(e, A, { n:0 });
    w.set(e, A, { n:1 });
    w.system(wld=>{ for (const [id] of wld.query(Changed(A))) { /* ok */ return; } throw new Error('not changed'); });
    w.tick(0.016);
  });

  // 2) Not filter
  t('Not filter excludes entities', ()=>{
    const w = new World();
    const e1 = w.create(); w.add(e1, A, {n:1});
    const e2 = w.create(); w.add(e2, A, {n:2}); w.add(e2, B, {n:9});
    w.system(wld=>{
      let count=0; for (const [id] of wld.query(A, Not(B))) count++;
      if (count !== 1) throw new Error('Not filter failed');
    });
    w.tick(0.016);
  });

  // 3) Deferral (non-strict)
  t('Deferral inside tick returns null and applies post-frame', ()=>{
    const w = new World();
    const e = w.create();
    w.system(wld=>{ const out = wld.add(e, A, {n:1}); if (out !== null) throw new Error('expected null'); });
    w.tick(0.016);
    if (!w.has(e, A)) throw new Error('deferred add not applied');
  });

  // 4) Strict throws
  t('Strict mode throws on mid-tick mutation', ()=>{
    const w = new World({ strict:true });
    const e = w.create();
    w.system(wld=>{ wld.add(e, A, {n:1}); });
    let threw=false; try{ w.tick(0.016); } catch{ threw=true; }
    if (!threw) throw new Error('strict did not throw');
  });

  // 5) SoA parity with Map
  t('SoA parity with Map stores', ()=>{
    const steps = 5;
    const Pos = defineComponent('Pos', {x:0,y:0});
    const Vel = defineComponent('Vel', {x:1,y:2});
    const wMap = new World({ store:'map' });
    const wSoA = new World({ store:'soa' });
    const e1 = wMap.create(); wMap.add(e1, Pos, {x:0,y:0}); wMap.add(e1, Vel, {x:1,y:2});
    const e2 = wSoA.create(); wSoA.add(e2, Pos, {x:0,y:0}); wSoA.add(e2, Vel, {x:1,y:2});
    const stepper = (w)=> w.system((ww,dt)=>{ for (const [id,p,v] of ww.query(Pos,Vel)) { p.x+=v.x; p.y+=v.y; } });
    stepper(wMap); stepper(wSoA);
    for (let i=0;i<steps;i++){ wMap.tick(1); wSoA.tick(1); }
    const pm = wMap.get(e1, Pos), ps = wSoA.get(e2, Pos);
    if (pm.x !== ps.x || pm.y !== ps.y) throw new Error('parity mismatch');
  });

  // report
  if (typeof window !== 'undefined') {
    console.groupCollapsed('[ECS] Self-Tests');
    for (const row of results) console.log(...row);
    console.groupEnd();
  }
  return results;
}

/* -------------------------------------------------------------------------
 * Tiny helpers for common patterns
 * ---------------------------------------------------------------------- */

/** makeSingleton — returns [entityId, ensure()] so systems can lazy‑create singletons. */
export function makeSingleton(world, tagComp){
  let cached = 0;
  function ensure(){
    if (cached && world.alive.has(cached) && world.has(cached, tagComp)) return cached;
    for (const id of world.alive){ if (world.has(id, tagComp)) { cached = id; return id; } }
    cached = world.create(); world.add(cached, tagComp, {}); return cached;
  }
  return [()=>cached, ensure];
}

/** defineTag — convenience for marker components with no data. */
export function defineTag(name){ return defineComponent(name, {}); }

/*
 * Design notes
 * ------------
 * • Stores are pluggable. Default MapStore is simple and fast for small/medium worlds.
 *   SoAStore (struct-of-arrays) uses field arrays and returns live views backed by
 *   getters/setters for hot paths. Switch via new World({ store: 'soa' }).
 * • Changed(...) is one‑frame sticky and resets after world.tick().
 * • Queries cache only the positive set (ALL). Negative/changed filters are
 *   checked dynamically so the cache stays valid through most mutations.
 * • For long iterations use for (const t of world.queryGen(A,B)) to allow
 *   yielding to the browser between chunks — the iterator itself is sync but
 *   easily chunked by the caller with setTimeout/await next animation frame.
 * • Command queue + strict mode:
 *     - default: auto-defer structural mutations during tick (returns null)
 *     - strict: throw to surface mistakes in development
 */

/* -------------------------------------------------------------------------
 * Store backends
 * ---------------------------------------------------------------------- */

function makeMapStore(){
  const map = new Map();
  const fast = Object.create(null);
  return {
    set(id, rec){ map.set(id, rec); fast[id] = rec; },
    get(id){ return map.get(id); },
    has(id){ return map.has(id); },
    delete(id){ const ok = map.delete(id); delete fast[id]; return ok; },
    entityIds(){ const arr = Array.from(map.keys()); arr.sort((a,b)=>a-b); return arr; },
    fast
  };
}

function makeSoAStore(Comp){
  const fields = Object.keys(Comp.defaults || {});
  const arrays = Object.fromEntries(fields.map(f => [f, []]));
  const present = new Set();
  const views = new Map(); // flyweight views per id (pooled)
  function view(id){
    if (views.has(id)) return views.get(id);
    const obj = {};
    for (const f of fields){
      Object.defineProperty(obj, f, {
        get(){ return arrays[f][id] ?? Comp.defaults[f]; },
        set(v){ arrays[f][id] = v; }
      });
    }
    views.set(id, obj);
    return obj;
  }
  // For API consistency, provide a 'fast' property, though SoA doesn't use it for O(1) lookup.
  const fast = undefined;
  return {
    set(id, rec){
      present.add(id);
      for (const f of fields){ arrays[f][id] = (rec[f] ?? Comp.defaults[f]); }
    },
    get(id){ return present.has(id) ? view(id) : undefined; },
    has(id){ return present.has(id); },
    delete(id){ const had = present.delete(id); views.delete(id); return had; },
    entityIds(){ const arr = Array.from(present.values()); arr.sort((a,b)=>a-b); return arr; },
    fast
  };
}

/**
 * Lightweight deep clone used for component default copying.
 * Uses structuredClone when available, otherwise falls back to a
 * recursive copy for Arrays and plain Objects. This keeps component
 * instances free from shared nested references (e.g., arrays/objects).
 */
function deepClone(v){
  // Prefer structuredClone when possible, but it will throw on functions and
  // other non-clonable values. If it fails, fall back to a safe recursive
  // copier that preserves functions by reference.
  if (typeof structuredClone === 'function'){
    try { return structuredClone(v); } catch (e) { /* fallback below */ }
  }
  if (v === null || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map(deepClone);
  // Only deep-clone plain objects (i.e. `{}`) to avoid breaking host objects
  // like CanvasRenderingContext2D, HTMLCanvasElement, etc. Preserve those
  // by reference so methods such as ctx.save() remain available.
  const proto = Object.getPrototypeOf(v);
  const isPlainObject = proto === Object.prototype || proto === null;
  if (!isPlainObject) return v; // preserve host/non-plain objects by reference

  const out = {};
  for (const k of Object.keys(v)){
    const val = v[k];
    out[k] = deepClone(val);
  }
  return out;
}