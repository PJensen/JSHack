// display/ui/charCreation.js
// Character creation screen. Pure presentation — no rules/ imports.
// Data is passed in by main.js via showCharCreation(opts).

/**
 * @param {{
 *   classes: Array<{ id: string, name: string, description: string, deityName: string, deityAlignment: string }>,
 *   onConfirm: (result: { name: string, classId: string }) => void,
 * }} opts
 * @returns {{ dispose: () => void }}
 */
export function showCharCreation({ classes, onConfirm }) {
  let selectedClassId = null;

  // ---- backdrop (full-viewport, blocks all input) ----
  const panel = document.createElement('div');
  panel.id = 'char-creation';
  Object.assign(panel.style, {
    position: 'fixed', left: '0', top: '0', right: '0', bottom: '0',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    pointerEvents: 'auto',
    background: 'rgba(6,9,14,0.97)',
    fontFamily: 'monospace', zIndex: '1400',
    color: '#cfe8ff',
  });

  // ---- inner box ----
  const box = document.createElement('div');
  Object.assign(box.style, {
    width: 'min(460px, 90vw)',
    maxHeight: '92vh', overflowY: 'auto',
    textAlign: 'center',
    background: '#0b0e16', border: '1px solid #2d3b52', borderRadius: '10px',
    padding: '24px 20px', boxShadow: '0 0 60px rgba(40,80,160,0.25)',
  });

  // ---- title ----
  const title = document.createElement('div');
  title.textContent = 'Enter the Dungeon';
  Object.assign(title.style, {
    fontSize: '22px', fontWeight: 'bold', color: '#7ab8ff',
    textShadow: '0 0 12px rgba(80,140,255,0.3)', marginBottom: '20px',
  });
  box.appendChild(title);

  // ---- name input ----
  const nameLabel = document.createElement('label');
  nameLabel.textContent = 'Name';
  Object.assign(nameLabel.style, {
    display: 'block', fontSize: '13px', color: '#6a8ab0',
    marginBottom: '4px', textAlign: 'left',
  });
  box.appendChild(nameLabel);

  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.value = 'Hero';
  nameInput.maxLength = 24;
  nameInput.setAttribute('autocomplete', 'off');
  nameInput.setAttribute('autocapitalize', 'words');
  Object.assign(nameInput.style, {
    display: 'block', width: '100%', boxSizing: 'border-box',
    minHeight: '44px', padding: '8px 12px',
    fontSize: '18px', fontFamily: 'monospace',
    background: '#111827', color: '#cfe8ff',
    border: '1px solid #2d3b52', borderRadius: '6px',
    outline: 'none', marginBottom: '20px',
  });
  nameInput.addEventListener('focus', () => { nameInput.style.borderColor = '#4a6a9a'; });
  nameInput.addEventListener('blur', () => { nameInput.style.borderColor = '#2d3b52'; });
  box.appendChild(nameInput);

  // ---- class section ----
  const classLabel = document.createElement('div');
  classLabel.textContent = 'Choose your path';
  Object.assign(classLabel.style, {
    fontSize: '13px', color: '#6a8ab0',
    marginBottom: '10px', textAlign: 'left',
  });
  box.appendChild(classLabel);

  // ---- class grid (2x2) ----
  const grid = document.createElement('div');
  Object.assign(grid.style, {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '10px',
    marginBottom: '20px',
  });

  const cards = [];
  for (const cls of classes) {
    const card = document.createElement('div');
    card.dataset.classId = cls.id;
    Object.assign(card.style, {
      minHeight: '88px', padding: '12px 10px',
      background: '#111827', border: '2px solid #1e2a3e',
      borderRadius: '8px', cursor: 'pointer',
      textAlign: 'left',
      transition: 'border-color 120ms, background 120ms',
    });

    const cName = document.createElement('div');
    cName.textContent = cls.name;
    Object.assign(cName.style, {
      fontSize: '16px', fontWeight: 'bold', color: '#cfe8ff',
      marginBottom: '4px',
    });
    card.appendChild(cName);

    const cDesc = document.createElement('div');
    cDesc.textContent = cls.description;
    Object.assign(cDesc.style, {
      fontSize: '11px', color: '#8a9ab0', lineHeight: '1.4',
      marginBottom: '6px',
    });
    card.appendChild(cDesc);

    const cDeity = document.createElement('div');
    cDeity.textContent = `${cls.deityName} (${cls.deityAlignment})`;
    Object.assign(cDeity.style, {
      fontSize: '11px', color: '#5a7a9a', fontStyle: 'italic',
    });
    card.appendChild(cDeity);

    card.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      selectedClassId = cls.id;
      for (const c of cards) {
        c.style.borderColor = '#1e2a3e';
        c.style.background = '#111827';
      }
      card.style.borderColor = '#4a8aff';
      card.style.background = '#141e30';
      confirmBtn.disabled = false;
      confirmBtn.style.opacity = '1';
      confirmBtn.style.cursor = 'pointer';
    });

    grid.appendChild(card);
    cards.push(card);
  }
  box.appendChild(grid);

  // ---- confirm button ----
  const confirmBtn = document.createElement('button');
  confirmBtn.textContent = 'Begin';
  confirmBtn.disabled = true;
  Object.assign(confirmBtn.style, {
    display: 'block', width: '100%',
    minHeight: '52px', padding: '12px',
    fontSize: '18px', fontWeight: 'bold', fontFamily: 'monospace',
    background: '#1a2a44', color: '#7ab8ff',
    border: '1px solid #4a6a9a', borderRadius: '8px',
    cursor: 'default', opacity: '0.4',
    transition: 'opacity 120ms, background 120ms',
  });
  confirmBtn.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    if (confirmBtn.disabled) return;
    const name = (nameInput.value || '').trim() || 'Hero';
    onConfirm({ name, classId: selectedClassId });
    dispose();
  });
  box.appendChild(confirmBtn);

  panel.appendChild(box);
  document.body.appendChild(panel);

  // Select the name text on show so the player can immediately type
  nameInput.select();

  // Enter key confirms if ready
  panel.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !confirmBtn.disabled) {
      e.preventDefault();
      const name = (nameInput.value || '').trim() || 'Hero';
      onConfirm({ name, classId: selectedClassId });
      dispose();
    }
  });

  function dispose() {
    if (panel.parentNode) panel.parentNode.removeChild(panel);
  }

  return { dispose };
}
