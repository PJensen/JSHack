export function defineComponent(name, template = {}) {
  if (!name) {
    throw new Error("Component name is required");
  }
  const defaults = structuredClone(template);
  return {
    name,
    defaults,
    create(initial = {}) {
      return Object.assign(structuredClone(defaults), structuredClone(initial));
    }
  };
}

const SYSTEM_REGISTRY = new Map();

export function resetSystems() {
  SYSTEM_REGISTRY.clear();
}

export function registerSystem(handler, phase, options = {}) {
  if (!handler) {
    throw new Error("registerSystem requires a handler");
  }
  const record = { handler, phase, options };
  const list = SYSTEM_REGISTRY.get(phase) ?? [];
  list.push(record);
  SYSTEM_REGISTRY.set(phase, list);
  return handler;
}

export function composeScheduler(...phases) {
  const ordered = phases.length ? phases : Array.from(SYSTEM_REGISTRY.keys());
  return function scheduler(world, dt = 1) {
    for (const phase of ordered) {
      const systems = SYSTEM_REGISTRY.get(phase);
      if (!systems) continue;
      for (const { handler } of systems) {
        handler(world, dt);
      }
    }
  };
}

export class World {
  constructor() {
    this._nextId = 1;
    this._components = new Map();
    this._entities = new Set();
    this._events = [];
    this._scheduler = null;
    this.step = 0;
  }

  create() {
    const id = this._nextId++;
    this._entities.add(id);
    return id;
  }

  ensureStorage(component) {
    if (!this._components.has(component)) {
      this._components.set(component, new Map());
    }
    return this._components.get(component);
  }

  add(entity, component, initial = {}) {
    if (!this._entities.has(entity)) {
      throw new Error(`Entity ${entity} does not exist`);
    }
    const storage = this.ensureStorage(component);
    const value = component.create(initial);
    storage.set(entity, value);
    return value;
  }

  get(entity, component) {
    const storage = this._components.get(component);
    return storage ? storage.get(entity) : undefined;
  }

  has(entity, component) {
    const storage = this._components.get(component);
    return storage ? storage.has(entity) : false;
  }

  remove(entity, component) {
    const storage = this._components.get(component);
    if (storage) {
      storage.delete(entity);
    }
  }

  query(...components) {
    if (components.length === 0) {
      return [];
    }
    const storages = components.map((comp) => this.ensureStorage(comp));
    const [primary, ...rest] = storages;
    const results = [];
    for (const [entity, value] of primary.entries()) {
      const tuple = [entity, value];
      let match = true;
      for (let i = 0; i < rest.length; i++) {
        const storage = rest[i];
        const other = storage.get(entity);
        if (!other) {
          match = false;
          break;
        }
        tuple.push(other);
      }
      if (match) {
        results.push(tuple);
      }
    }
    return results;
  }

  on(name, handler) {
    this._events.push({ type: "listener", name, handler });
    return () => {
      this._events = this._events.filter((evt) => evt.handler !== handler);
    };
  }

  emit(name, payload) {
    this._events.push({ type: "event", name, payload, step: this.step });
  }

  consumeEvents(name) {
    const consumed = [];
    this._events = this._events.filter((evt) => {
      if (evt.type === "event" && evt.name === name) {
        consumed.push(evt.payload);
        return false;
      }
      return true;
    });
    return consumed;
  }

  setScheduler(fn) {
    this._scheduler = fn;
  }

  tick(dt = 1) {
    if (!this._scheduler) {
      throw new Error("World scheduler not set");
    }
    this._scheduler(this, dt);
    this.step += 1;
  }
}
