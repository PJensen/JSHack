// Simple ring-buffer message log used for game messages.
// API: new MessageLog(capacity)
// - push(text): append a message (timestamped)
// - recent(n): return up to n most recent messages (newest first)
// - all(): return all messages (oldest first)

export class MessageLog {
  constructor(capacity = 128){
    this.capacity = Math.max(1, capacity);
    this._buf = new Array(this.capacity);
    this._start = 0; // index of oldest
    this._len = 0;
    this._seq = 0;
  }

  push(text){
    const ts = Date.now();
    const rec = { seq: ++this._seq, ts, text };
    const idx = (this._start + this._len) % this.capacity;
    this._buf[idx] = rec;
    if (this._len < this.capacity){ this._len++; }
    else { // overwrite oldest
      this._start = (this._start + 1) % this.capacity;
    }
    return rec;
  }

  // return up to n most recent messages as array newest->oldest
  recent(n = 10){
    n = Math.max(0, n|0);
    const out = [];
    for (let i = 0; i < Math.min(n, this._len); i++){
      const idx = (this._start + this._len - 1 - i + this.capacity) % this.capacity;
      out.push(this._buf[idx]);
    }
    return out;
  }

  // return all messages oldest->newest
  all(){
    const out = new Array(this._len);
    for (let i = 0; i < this._len; i++){
      out[i] = this._buf[(this._start + i) % this.capacity];
    }
    return out;
  }

  clear(){ this._buf = new Array(this.capacity); this._start = 0; this._len = 0; }
}

export default MessageLog;
