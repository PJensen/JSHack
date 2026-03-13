// display/ui/tileInspector.js
// Debug panel that shows all data about the tile the player is standing on.
// Unlike the canvas-based debug graphs, this is an HTML DOM panel rendering
// structured text (tile type, entities, all components).

/**
 * @typedef {object} TileEntityInfo
 * @property {number} id
 * @property {string} name
 * @property {string} identity
 * @property {{name:string, data:object}[]} components
 */

/**
 * @typedef {object} TileInspectorData
 * @property {number} x
 * @property {number} y
 * @property {number} tileType
 * @property {string} tileName
 * @property {boolean} walkable
 * @property {boolean} opaque
 * @property {boolean} flyable
 * @property {boolean} visible
 * @property {boolean} explored
 * @property {TileEntityInfo[]} entities
 */

/**
 * Shallow-serialize a component data object for display.
 * Skips functions, truncates long arrays and deep nesting.
 * @param {*} val
 * @param {number} depth
 * @returns {string}
 */
function formatValue(val, depth = 0) {
  if (val === null) return 'null';
  if (val === undefined) return 'undefined';
  if (typeof val === 'function') return 'fn()';
  if (typeof val === 'symbol') return val.toString();
  if (typeof val === 'string') {
    if (val.length > 60) return `"${val.slice(0, 57)}..."`;
    return `"${val}"`;
  }
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  if (depth > 2) return '{...}';
  if (Array.isArray(val)) {
    if (val.length === 0) return '[]';
    if (val.length > 8) {
      const items = val.slice(0, 6).map(v => formatValue(v, depth + 1));
      return `[${items.join(', ')}, ...(${val.length})]`;
    }
    return `[${val.map(v => formatValue(v, depth + 1)).join(', ')}]`;
  }
  if (typeof val === 'object') {
    const keys = Object.keys(val).filter(k => typeof val[k] !== 'function');
    if (keys.length === 0) return '{}';
    if (keys.length > 10) {
      const entries = keys.slice(0, 8).map(k => `${k}: ${formatValue(val[k], depth + 1)}`);
      return `{ ${entries.join(', ')}, ...(${keys.length}) }`;
    }
    return `{ ${keys.map(k => `${k}: ${formatValue(val[k], depth + 1)}`).join(', ')} }`;
  }
  return String(val);
}

/**
 * Create a tile inspector debug panel.
 * @returns {{ el: HTMLDivElement, show: () => void, hide: () => void, startPolling: () => void, stopPolling: () => void, setSampler: (fn: () => TileInspectorData|null) => void }}
 */
export function createTileInspector() {
  let sampler = null;
  let pollInterval = null;
  let lastJson = '';

  const el = document.createElement('div');
  el.id = 'tile-inspector-panel';
  Object.assign(el.style, {
    width: '320px',
    maxHeight: '70vh',
    overflowY: 'auto',
    overflowX: 'hidden',
    background: 'rgba(10, 14, 22, 0.85)',
    border: '1px solid #2d3b52',
    borderRadius: '6px',
    padding: '8px 10px',
    fontFamily: 'monospace',
    fontSize: '11px',
    color: '#cfe8ff',
    lineHeight: '1.45',
    display: 'none',
    pointerEvents: 'auto',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    zIndex: '910',
  });

  // Scrollbar styling (webkit)
  const style = document.createElement('style');
  style.textContent = `
    #tile-inspector-panel::-webkit-scrollbar { width: 6px; }
    #tile-inspector-panel::-webkit-scrollbar-track { background: transparent; }
    #tile-inspector-panel::-webkit-scrollbar-thumb { background: #2d3b52; border-radius: 3px; }
  `;
  document.head.appendChild(style);

  function render(data) {
    if (!data) {
      el.textContent = 'Tile Inspector\n─────────────────────────\nNo data available';
      return;
    }

    const lines = [];
    lines.push(`Tile Inspector  (${data.x}, ${data.y})`);
    lines.push('─────────────────────────────');
    lines.push('');

    // Tile info
    lines.push(`TILE: ${data.tileName} (${data.tileType})`);
    lines.push(`  walkable: ${data.walkable}  opaque: ${data.opaque}  flyable: ${data.flyable}`);
    lines.push(`  visible: ${data.visible}   explored: ${data.explored}`);
    lines.push('');

    // Entities
    const ents = data.entities || [];
    if (ents.length === 0) {
      lines.push('ENTITIES: none');
    } else {
      lines.push(`ENTITIES (${ents.length}):`);
      for (let ei = 0; ei < ents.length; ei++) {
        const ent = ents[ei];
        const isLast = ei === ents.length - 1;
        const branch = ents.length === 1 ? '─' : isLast ? '└' : ei === 0 ? '┌' : '├';
        const cont = ents.length === 1 ? ' ' : isLast ? ' ' : '│';

        const idLabel = `[id:${ent.id}]`;
        const nameLabel = ent.name || ent.identity || '???';
        lines.push(`  ${branch} ${nameLabel} ${idLabel}`);

        // Components
        const comps = ent.components || [];
        for (const comp of comps) {
          const dataStr = comp.data != null ? formatValue(comp.data) : '(marker)';
          lines.push(`  ${cont}   ${comp.name} ${dataStr}`);
        }
        if (ei < ents.length - 1) lines.push(`  ${cont}`);
      }
    }

    el.textContent = lines.join('\n');
  }

  function poll() {
    if (!sampler) return;
    const data = sampler();
    const json = JSON.stringify(data);
    if (json === lastJson) return;
    lastJson = json;
    render(data);
  }

  function show() { el.style.display = 'block'; }
  function hide() { el.style.display = 'none'; lastJson = ''; }

  function startPolling() {
    if (pollInterval !== null) return;
    poll();
    pollInterval = setInterval(poll, 200);
  }

  function stopPolling() {
    if (pollInterval !== null) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
    lastJson = '';
  }

  function setSampler(fn) { sampler = fn; }

  return { el, show, hide, startPolling, stopPolling, setSampler };
}
