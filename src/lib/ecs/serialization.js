// ecs_serialize.js
// One-Shot ECS — Snapshots (Serialize / Deserialize / Clone)
// ----------------------------------------------------------
// Pure ES module. No build. Works with one_shot_ecs.js (Map or SoA stores).
//
// Goals:
//  - Deterministic structure, human-readable JSON
//  - No magic globals; you supply a component registry on load
//  - Fast: uses world.batch() and store.entityIds()
//  - Flexible: serialize entire world or selected entities/components
//
// Snapshot format (v1):
// {
//   v: 1,
//   meta: { seed, frame, time, store: "map"|"soa"?, note? },
//   comps: { [compName]: [ [id, {data}], ... ] },
//   alive: [ id, id, ... ]         // convenience (ascending)
// }
//
// NOTES:
// - RNG state: we can save the initial seed, but cannot capture mulberry32’s
//   internal cursor without a core hook. Restores are deterministic *from seed*
//   only for code paths that do not depend on intermediate random draws.
// - Systems aren’t serialized; only data. Re-register systems in code.
// - Component *names* must map to actual component objects via a registry you pass.
//
// API:
//   makeRegistry(...Comps) -> Map<string,Comp>
//   serializeWorld(world, opts?) -> object
//   serializeEntities(world, ids, opts?) -> object
//   deserializeWorld(data, registry, opts?) -> World
//   applySnapshot(world, data, registry, opts?) -> World (into existing world)
//   serializeEntity(world, id, opts?) -> object (mini snapshot for just one id)
//

export function makeRegistry(...comps){
  const reg = new Map();
  for (const c of comps.flat()){
    if (!c || !c.key || typeof c.name !== 'string') continue;
    reg.set(c.name, c);
  }
  return reg;
}

export function serializeWorld(world, opts={}){
  const pickEntity = opts.pickEntity || (()=>true);
  const include = _normalizeInclude(opts.include);   // Set<name> or null
  const exclude = new Set(opts.exclude || []);       // names to skip

  const comps = {};
  const alive = Array.from(world.alive).sort((a,b)=>a-b).filter(pickEntity);

  // Traverse stores → per-component arrays of [id, data]
  for (const [ckey, store] of world._store){
    const name = _guessCompName(world, ckey, store);
    if (!name) continue;
    if (include && !include.has(name)) continue;
    if (exclude.has(name)) continue;

    const rows = [];
    const ids = store.entityIds ? store.entityIds() : alive; // fallback
    for (const id of ids){
      if (!world.alive.has(id)) continue;
      if (!pickEntity(id)) continue;
      const rec = store.get ? store.get(id) : world.get(id, _lookupCompByName(world, name));
      if (!rec) continue;
      rows.push([id, _clonePlain(rec)]);
    }
    if (rows.length) comps[name] = rows;
  }

  const meta = {
    seed: world.seed >>> 0,
    frame: world.frame|0,
    time: +world.time || 0,
    store: world.storeMode || (_guessStore(world) || 'map'),
    note: opts.note || undefined
  };

  return { v:1, meta, comps, alive };
}

export function serializeEntities(world, ids, opts={}){
  const set = new Set(ids.filter(id => world.alive.has(id)));
  const pickEntity = (id)=> set.has(id);
  return serializeWorld(world, { ...opts, pickEntity });
}

export function serializeEntity(world, id, opts={}){
  return serializeEntities(world, [id], opts);
}

/** Create a new World and populate it from a snapshot. */
export function deserializeWorld(data, registry, opts={}){
  const storeMode = opts.store || (data?.meta?.store) || undefined;
  const seed = (opts.seed != null) ? (opts.seed>>>0) : (data?.meta?.seed>>>0);
  const WorldCtor = opts.World || (globalThis.World);
  if (!WorldCtor) throw new Error('deserializeWorld: supply opts.World or ensure World is global');

  const w = new WorldCtor({ seed, store: storeMode });
  return applySnapshot(w, data, registry, opts);
}

/** Populate an existing world (default mode: replace). */
export function applySnapshot(world, data, registry, opts={}){
  _assertSnapshot(data);

  const mode = opts.mode || 'replace'; // 'replace' | 'append'
  const mapNameToComp = _normalizeRegistry(registry);
  const remap = opts.remapId || null;  // function(oldId)->newId, optional

  return world.batch(()=> {
    if (mode === 'replace'){
      // wipe: destroy all entities and clear stores
      for (const id of Array.from(world.alive)) world.destroy(id);
      // NOTE: stores are cleared via destroy() calls in current ECS; if your build
      // keeps empty stores around, that’s fine — they’ll be repopulated.
    }

    // 1) Create entities (IDs may be remapped)
    const idMap = new Map();
    const sourceAlive = (data.alive || _collectAliveFromComps(data)).sort((a,b)=>a-b);
    for (const oldId of sourceAlive){
      let newId;
      if (mode === 'append'){
        newId = world.create();
      } else if (remap){
        newId = remap(oldId);
        if (!world.alive.has(newId)) { /* create if caller picked a hole */ while (world.alive.has(newId)) newId = world.create(); }
      } else {
        // Try to reuse numeric IDs in ascending order for readability.
        // If taken, fall back to create().
        if (!world.alive.has(oldId) && _canAssignId(world, oldId)){
          // No public API to force id; use create() and ignore value; we’ll just map
          newId = world.create();
        } else {
          newId = world.create();
        }
      }
      idMap.set(oldId, newId);
    }

    // 2) Add components
    for (const [name, rows] of Object.entries(data.comps || {})){
      const Comp = mapNameToComp.get(name);
      if (!Comp) {
        if (!opts.skipUnknown) throw new Error(`applySnapshot: unknown component '${name}'`);
        continue;
      }
      for (const [oldId, payload] of rows){
        const id = idMap.get(oldId);
        if (!id) continue;
        world.add(id, Comp, _clonePlain(payload));
      }
    }

    // 3) Meta (best-effort)
    if (data.meta){
      world.time = +data.meta.time || world.time || 0;
      world.frame = (data.meta.frame|0) || world.frame || 0;
      // RNG cursor is not restorable without a hook; seed is already set from ctor
    }

    return world;
  });
}

/* ====================== helpers ====================== */

function _normalizeInclude(val){
  if (!val) return null;
  if (val instanceof Set) return val;
  return new Set(Array.isArray(val) ? val : [val]);
}

function _assertSnapshot(data){
  if (!data || typeof data !== 'object' || data.v !== 1 || !data.comps) {
    throw new Error('snapshot: unsupported or invalid format');
  }
}

function _normalizeRegistry(reg){
  if (!reg) throw new Error('deserialize/apply: component registry required');
  if (reg instanceof Map) return reg;
  // accept plain object { name: Comp }
  const m = new Map();
  for (const [k,v] of Object.entries(reg)) m.set(k, v);
  return m;
}

function _clonePlain(x){
  if (!x || typeof x !== 'object') return x;
  // fast structured clone for data-only records (no functions/sets)
  return JSON.parse(JSON.stringify(x));
}

function _guessCompName(world, ckey, store){
  // Prefer store._comp?.name if the store exposes it (SoA impl often does)
  if (store && store._comp && typeof store._comp.name === 'string') return store._comp.name;
  // Fallback: Symbol description (defineComponent uses Symbol(name))
  const desc = ckey && typeof ckey.description === 'string' ? ckey.description : null;
  return desc || null;
}

function _lookupCompByName(world, name){
  // Best-effort walk of known stores to find a Comp object with matching name.
  for (const [ckey, store] of world._store){
    const n = _guessCompName(world, ckey, store);
    if (n === name && store._comp) return store._comp;
  }
  return null;
}

function _collectAliveFromComps(data){
  const s = new Set();
  for (const rows of Object.values(data.comps || {})) for (const [id] of rows) s.add(id|0);
  return Array.from(s);
}

function _guessStore(world){
  // Extremely conservative; presence of SoA store methods often differ;
  // the world already keeps mode internally; prefer meta.store
  return world.storeMode || 'map';
}

function _canAssignId(){ return false; } // placeholder — current World doesn’t expose custom-id creation
