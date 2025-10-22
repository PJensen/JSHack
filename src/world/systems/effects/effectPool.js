// Lightweight array-based pool for particle objects.
// Designed to allocate typed plain objects and reuse them to avoid GC churn.

export function createEffectPool(itemFactory, initialSize = 256, maxSize = Infinity){
  // A bounded pool: pre-fill up to initialSize, and never allocate more than
  // maxSize items. When exhausted, allocate() returns null so callers can
  // gracefully skip creating more objects instead of growing without bound.
  const pool = {
    free: [],
    _allocated: 0,
    itemFactory,
    maxSize: maxSize === undefined || maxSize === null ? Infinity : maxSize,
    _initialSize: initialSize,
    allocate(){
      if (this.free.length > 0) return this.free.pop();
      if (this._allocated < this.maxSize){
        this._allocated++;
        return this.itemFactory();
      }
      // Pool exhausted; return null to signal caller to skip allocation.
      return null;
    },
    release(item){
      // reset fields if item has reset method
      if (typeof item.reset === 'function') item.reset();
      this.free.push(item);
    },
    ensure(size){
      while (this.free.length < size && this._allocated < this.maxSize){
        this.free.push(this.itemFactory());
        this._allocated++;
      }
    },
    // Trim the free list down to `reserve` objects, freeing references so
    // the JS engine can reclaim memory. If reserve is omitted, a sensible
    // default is used (max(16, 25% of allocated)). Returns number trimmed.
    trim(reserve){
      const allocated = typeof this._allocated === 'number' ? this._allocated : (typeof this.totalAllocated === 'function' ? this.totalAllocated() : 0);
      const def = Math.max(16, Math.floor(allocated * 0.25));
      const r = (typeof reserve === 'number') ? Math.max(0, reserve) : def;
      let removed = 0;
      while (this.free.length > r){
        this.free.pop();
        if (typeof this._allocated === 'number') this._allocated = Math.max(0, this._allocated - 1);
        removed++;
      }
      return removed;
    },
    size(){
      return this.free.length;
    },
    totalAllocated(){ return this._allocated; }
  };
  pool.ensure(initialSize);
  return pool;
}

export function createSimplePool(itemShape, initialSize = 256, maxSize = initialSize){
  // itemShape is an object describing default fields
  const factory = () => {
    // shallow copy defaults
    const obj = Object.assign({}, itemShape);
    // attach a lightweight reset
    obj.reset = function(){
      for (const k in itemShape){
        this[k] = itemShape[k];
      }
    };
    return obj;
  };
  return createEffectPool(factory, initialSize, maxSize);
}
