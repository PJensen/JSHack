// display/ui/overlay.js
// Minimal UI overlays for inventory and message log; display-only.

export function initOverlays() {
  const root = ensureRoot();
  const inv = ensurePanel('inventory');
  const log = ensurePanel('messageLog');
  const pick = ensurePanel('pickup');

  window.addEventListener('ui:openInventory', () => {
    show(inv);
    // Request data from app; app will respond with ui:inventoryData
    window.dispatchEvent(new CustomEvent('ui:requestInventoryData'));
  });
  window.addEventListener('ui:openMessageLog', () => {
    show(log);
    // Request messages; app may respond with ui:messageLogData
    window.dispatchEvent(new CustomEvent('ui:requestMessageLogData'));
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { hide(inv); hide(log); hide(pick); }
  });

  // Data feeds
  window.addEventListener('ui:inventoryData', (e) => {
    const items = e.detail?.items || [];
    renderInventory(inv, items);
  });
  window.addEventListener('ui:messageLogData', (e) => {
    const entries = e.detail?.entries || [];
    renderMessageLog(log, entries);
  });

  // Open pickup chooser: expects items array [{ id, name, type, count }]
  window.addEventListener('ui:openPickupChooser', (e) => {
    const items = e.detail?.items || [];
    renderPickupChooser(pick, items);
    show(pick);
  });

  return { root, inv, log };
}

function ensureRoot() {
  let root = document.getElementById('ui-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'ui-root';
    root.style.position = 'fixed';
    root.style.left = '0';
    root.style.top = '0';
    root.style.right = '0';
    root.style.bottom = '0';
    root.style.pointerEvents = 'none';
    root.style.zIndex = '1000';
    document.body.appendChild(root);
  }
  return root;
}

function ensurePanel(kind) {
  const root = ensureRoot();
  const panel = document.createElement('div');
  panel.className = `ui-panel ui-panel-${kind}`;
  Object.assign(panel.style, {
    position: 'absolute', left: '0', top: '0', right: '0', bottom: '0',
    display: 'none', pointerEvents: 'auto',
    background: 'rgba(6,9,14,0.85)', color: '#cfe8ff',
    fontFamily: 'monospace',
  });

  const inner = document.createElement('div');
  Object.assign(inner.style, {
    position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
    width: 'min(600px, 90vw)', maxHeight: '80vh', overflow: 'auto',
    border: '1px solid #2d3b52', borderRadius: '8px', padding: '12px',
    background: '#0b0e16', boxShadow: '0 10px 40px rgba(0,0,0,0.6)'
  });
  // Close button
  const close = document.createElement('button');
  close.textContent = '×';
  Object.assign(close.style, {
    position: 'absolute', right: '6px', top: '6px', width: '28px', height: '28px',
    border: '1px solid #2d3b52', borderRadius: '6px', background: '#101626', color: '#cfe8ff',
    cursor: 'pointer'
  });
  close.addEventListener('click', () => hide(panel));
  inner.appendChild(close);
  panel.appendChild(inner);
  root.appendChild(panel);
  panel._inner = inner;
  return panel;
}

function show(panel) { panel.style.display = 'block'; }
function hide(panel) { panel.style.display = 'none'; }

function renderInventory(panel, items) {
  const el = panel._inner;
  el.innerHTML = '';
  const title = document.createElement('div');
  title.textContent = 'Inventory';
  title.style.fontWeight = 'bold';
  title.style.marginBottom = '8px';
  el.appendChild(title);

  if (!items.length) {
    const empty = document.createElement('div');
    empty.textContent = '(empty)';
    el.appendChild(empty);
    return;
  }

  for (const it of items) {
    const row = document.createElement('button');
    Object.assign(row.style, {
      display: 'flex', alignItems: 'center', gap: '8px',
      width: '100%', textAlign: 'left', margin: '4px 0', padding: '8px',
      background: '#0f1421', color: '#cfe8ff', border: '1px solid #2d3b52', borderRadius: '6px',
      cursor: 'pointer'
    });
    row.innerHTML = `<span style="color:#9cf">${sanitize(it.type)}</span> ` +
                    `<span>${sanitize(it.description || it.type)}</span> ` +
                    `<span style="margin-left:auto;opacity:0.8">x${it.count ?? 1}</span>`;
    row.addEventListener('click', () => {
      // Ask app to drink this item (no direct rules coupling here)
      window.dispatchEvent(new CustomEvent('ui:requestDrink', { detail: { itemId: it.id } }));
    });
    el.appendChild(row);
  }
}

function renderMessageLog(panel, entries) {
  const el = panel._inner;
  el.innerHTML = '';
  const title = document.createElement('div');
  title.textContent = 'Message Log';
  title.style.fontWeight = 'bold';
  title.style.marginBottom = '8px';
  el.appendChild(title);
  const box = document.createElement('div');
  Object.assign(box.style, {
    display: 'flex', flexDirection: 'column', gap: '4px'
  });
  for (const m of entries) {
    const row = document.createElement('div');
    row.textContent = String(m);
    box.appendChild(row);
  }
  if (!entries.length) {
    const empty = document.createElement('div');
    empty.textContent = '(no messages yet)';
    box.appendChild(empty);
  }
  el.appendChild(box);
}

function sanitize(s) {
  return (s ?? '').toString().replace(/[<>]/g, '');
}

function renderPickupChooser(panel, items) {
  const el = panel._inner;
  el.innerHTML = '';
  const title = document.createElement('div');
  title.textContent = 'Pick up what?';
  title.style.fontWeight = 'bold';
  title.style.marginBottom = '8px';
  el.appendChild(title);

  if (!items.length) {
    const empty = document.createElement('div');
    empty.textContent = '(nothing here)';
    el.appendChild(empty);
    return;
  }

  const list = document.createElement('div');
  list.style.display = 'flex';
  list.style.flexDirection = 'column';
  list.style.gap = '6px';

  const selections = new Set();

  for (const it of items) {
    const row = document.createElement('label');
    Object.assign(row.style, {
      display: 'flex', alignItems: 'center', gap: '8px',
      padding: '6px 8px', border: '1px solid #2d3b52', borderRadius: '6px',
      background: '#0f1421'
    });
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.addEventListener('change', () => {
      if (cb.checked) selections.add(it.id); else selections.delete(it.id);
    });
    const name = document.createElement('span');
    name.style.color = '#9cf';
    name.textContent = sanitize(it.name || it.type || 'item');
    const desc = document.createElement('span');
    desc.style.opacity = '0.85';
    desc.textContent = `x${it.count ?? 1}`;

    row.appendChild(cb);
    row.appendChild(name);
    row.appendChild(desc);
    list.appendChild(row);
  }

  el.appendChild(list);

  const actions = document.createElement('div');
  actions.style.display = 'flex';
  actions.style.gap = '8px';
  actions.style.marginTop = '10px';

  const btnPickSel = document.createElement('button');
  btnPickSel.textContent = 'Pick Selected';
  decorateButton(btnPickSel);
  btnPickSel.addEventListener('click', () => {
    const ids = Array.from(selections);
    if (!ids.length) return;
    window.dispatchEvent(new CustomEvent('ui:requestPickup', { detail: { itemIds: ids } }));
    hide(panel);
  });

  const btnPickAll = document.createElement('button');
  btnPickAll.textContent = 'Pick All';
  decorateButton(btnPickAll);
  btnPickAll.addEventListener('click', () => {
    const ids = items.map(i => i.id);
    if (!ids.length) return;
    window.dispatchEvent(new CustomEvent('ui:requestPickup', { detail: { itemIds: ids } }));
    hide(panel);
  });

  const btnCancel = document.createElement('button');
  btnCancel.textContent = 'Cancel';
  decorateButton(btnCancel);
  btnCancel.addEventListener('click', () => hide(panel));

  actions.appendChild(btnPickSel);
  actions.appendChild(btnPickAll);
  actions.appendChild(btnCancel);
  el.appendChild(actions);
}

function decorateButton(btn) {
  Object.assign(btn.style, {
    padding: '6px 10px', background: '#101626', color: '#cfe8ff',
    border: '1px solid #2d3b52', borderRadius: '6px', cursor: 'pointer'
  });
}
