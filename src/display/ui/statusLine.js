// display/ui/statusLine.js
// NetHack-style horizontal status line (bottom of screen, above action bar).

export function initStatusLine() {
  let root = document.getElementById('ui-root');
  if (!root) return;

  const line = document.createElement('div');
  Object.assign(line.style, {
    position: 'fixed',
    left: '8px',
    right: '8px',
    bottom: 'calc(var(--jshack-actionbar-height, 48px) + 12px + env(safe-area-inset-bottom, 0px))',
    textAlign: 'center',
    fontFamily: 'monospace',
    fontSize: 'min(12px, 3vw)',
    color: '#cfd3dc',
    opacity: '0.85',
    pointerEvents: 'none',
    zIndex: '900',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  });
  root.appendChild(line);

  let depth = 1;
  let turn = 0;
  let atk = 0;
  let def = 0;
  let luck = 0;
  let armorClass = 10;
  let critPct = 0;

  function colorForDelta(value) {
    const n = Number(value || 0);
    if (n > 0) return '#64c87a';
    if (n < 0) return '#e06a6a';
    return '#98a0ab';
  }

  function fmtSigned(value) {
    const n = Number(value || 0);
    return n > 0 ? `+${n}` : `${n}`;
  }

  function fmtSignedPct(value) {
    const n = Number(value || 0);
    const rounded = Math.round(n * 10) / 10;
    const core = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
    return `${rounded > 0 ? "+" : ""}${core}%`;
  }

  function pushSegment(parts, label, value, color = '#cfd3dc') {
    const wrap = document.createElement('span');
    const l = document.createElement('span');
    const v = document.createElement('span');
    l.textContent = `${label}:`;
    v.textContent = value;
    Object.assign(v.style, { color });
    wrap.appendChild(l);
    wrap.appendChild(v);
    parts.push(wrap);
  }

  function render() {
    const parts = [];
    pushSegment(parts, 'DLvl', String(depth));
    pushSegment(parts, 'Turn', String(turn));
    pushSegment(parts, 'Atk', fmtSigned(atk), colorForDelta(atk));
    pushSegment(parts, 'Def', fmtSigned(def), colorForDelta(def));
    pushSegment(parts, 'Lk', fmtSigned(luck), colorForDelta(luck));
    pushSegment(parts, 'AC', String(armorClass), colorForDelta(armorClass - 10));
    pushSegment(parts, 'Crit', fmtSignedPct(critPct), colorForDelta(critPct));

    line.replaceChildren();
    for (let i = 0; i < parts.length; i++) {
      if (i > 0) {
        const sep = document.createElement('span');
        sep.textContent = ' \u2022 ';
        Object.assign(sep.style, { color: '#7f8793' });
        line.appendChild(sep);
      }
      line.appendChild(parts[i]);
    }
  }

  window.addEventListener('ui:updateDepth', (ev) => {
    /** @type {CustomEvent} */ // @ts-ignore
    const e = ev;
    depth = Number(e?.detail?.depth ?? depth);
    render();
  });

  window.addEventListener('ui:updateVitals', (ev) => {
    // Status line no longer shows vitals; keep listener as a no-op for compatibility.
  });

  window.addEventListener('ui:updateTurn', (ev) => {
    /** @type {CustomEvent} */ // @ts-ignore
    const e = ev;
    turn = Math.max(0, Number(e?.detail?.turn ?? turn) | 0);
    render();
  });

  window.addEventListener('ui:updateCombatHUD', (ev) => {
    /** @type {CustomEvent} */ // @ts-ignore
    const e = ev;
    atk = Number(e?.detail?.attack ?? e?.detail?.weapon?.attack ?? 0);
    def = Number(e?.detail?.defense ?? 0);
    luck = Number(e?.detail?.luck ?? 0);
    armorClass = Number(e?.detail?.armorClass ?? (10 + def));
    critPct = Number(e?.detail?.critChancePercent ?? 0);
    render();
  });

  render();
}
